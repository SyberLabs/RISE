/**
 * Section-by-section Jev visual direction for one reading (browser side).
 *
 * Reading never waits for this. Local direction is always present; this
 * coordinator only asks for richer direction ahead of the reader:
 *
 * - the current section first, then only the next one;
 * - at most one request in flight and six per minute from this client;
 * - no new request while paused, hidden, outside the Chamber, in Hold or
 *   Off, or without permission to send this text;
 * - a failed section is not retried in the same session;
 * - a response is accepted only for the exact source and section it was
 *   asked about, and only if its generation is still current;
 * - valid responses are cached locally (LRU, 100 sections) and staged for
 *   blocks the reader has not entered. Staging never restarts playback.
 */

import { SEGMENTATION_VERSION, canonicalSectionDigest, prepareVisualSource } from './segmentation.js';
import {
  VISUAL_SCORE_MODEL,
  VISUAL_SCORE_PROMPT_VERSION,
  VISUAL_SCORE_SCHEMA_VERSION,
  validateScoreResponse
} from './score-protocol.js';
import { TREATMENT_CATALOG_VERSION } from './treatments.js';

export const VISUAL_SCORE_ENDPOINT = '/api/jev-visual-score';
export const VISUAL_SCORE_CACHE_KEY = 'rise:visual-scores:v1';
export const VISUAL_SCORE_CACHE_LIMIT = 100;
export const CLIENT_REQUESTS_PER_MINUTE = 6;
const CLIENT_TIMEOUT_MS = 12_000;

/** The versioned identity under which a section's choices are reusable. */
export function scoreCacheKey(sourceDigest, sectionDigest) {
  return [sourceDigest, sectionDigest, `s${SEGMENTATION_VERSION}`, `c${TREATMENT_CATALOG_VERSION}`,
    `p${VISUAL_SCORE_PROMPT_VERSION}`, VISUAL_SCORE_MODEL].join(':');
}

/** Least-recently-used local cache that degrades to memory on storage failure. */
export class VisualScoreCache {
  constructor({ storage = null, limit = VISUAL_SCORE_CACHE_LIMIT } = {}) {
    this.storage = storage;
    this.limit = limit;
    this.entries = new Map();
    try {
      const raw = storage?.getItem(VISUAL_SCORE_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed?.entries)) {
        for (const [key, value] of parsed.entries.slice(-limit)) {
          if (typeof key === 'string' && Array.isArray(value?.choices)) this.entries.set(key, value);
        }
      }
    } catch {
      this.entries.clear();
    }
  }

  get(key) {
    const value = this.entries.get(key);
    if (!value) return null;
    this.entries.delete(key);
    this.entries.set(key, value);
    this._persist();
    return value;
  }

  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    this._persist();
  }

  _persist() {
    try {
      this.storage?.setItem(VISUAL_SCORE_CACHE_KEY, JSON.stringify({ entries: [...this.entries] }));
    } catch {
      // Storage full, private mode, or blocked: the in-memory cache stands.
    }
  }
}

export class VisualScoreCoordinator {
  /**
   * @param {object} options
   * @param {import('./director.js').PassageDirector} options.director
   * @param {{ id: string, text: string }[]} options.sources exact source text
   * @param {typeof fetch} [options.fetchImpl]
   * @param {VisualScoreCache} [options.cache]
   * @param {() => number} [options.now]
   * @param {(event: object) => void} [options.onEvent]
   */
  constructor({ director, sources, fetchImpl = globalThis.fetch?.bind(globalThis), cache = null,
    now = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id),
    onEvent = () => {} }) {
    this.director = director;
    this.sources = sources;
    this.fetchImpl = fetchImpl;
    this.cache = cache || new VisualScoreCache();
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onEvent = onEvent;
    this.prepared = null;
    this.sections = [];
    this.status = new Map();
    this.permitted = new Set();
    this.activity = { playing: false, visible: true, inChamber: true, mode: 'follow' };
    this.currentBlock = -1;
    this.inFlight = null;
    this.generation = 0;
    this.sent = [];
    this.timer = null;
    this.destroyed = false;
  }

  /** Prepare identities for every source (async digests) and read the cache. */
  async prepare() {
    const prepared = [];
    for (const source of this.sources) {
      const result = await prepareVisualSource(source.text);
      this.director.identify(source.id, result.blocks);
      prepared.push({ ...result, sourceId: source.id, text: source.text });
    }
    if (this.destroyed) return false;
    this.prepared = prepared;
    const firstBlockOf = new Map(this.director.sources.map(source => [source.id, source.firstBlock]));
    this.sections = prepared.flatMap((source, sourceIndex) => source.sections.map(section => ({
      key: `${sourceIndex}:${section.index}`,
      sourceIndex,
      sourceDigest: source.sourceDigest,
      startBlock: firstBlockOf.get(source.sourceId) + section.start,
      endBlock: firstBlockOf.get(source.sourceId) + section.end,
      blocks: source.blocks.slice(section.start, section.end).map(block => ({
        id: block.id, text: source.text.slice(block.from, block.to)
      })),
      digest: null
    })));
    this._pump();
    return true;
  }

  /** Source digests, for consent that names exactly this text. */
  get sourceDigests() {
    return (this.prepared || []).map(source => source.sourceDigest);
  }

  /** Which source digests may be transmitted (catalog-verified or consented). */
  setPermission(digests) {
    this.permitted = new Set(digests || []);
    if (!this.permitted.size) this._abort('permission-withdrawn');
    this._pump();
  }

  /** Revoke: cancel queued and in-flight work; nothing further is sent. */
  revoke() {
    this.permitted = new Set();
    this._abort('revoked');
    this._clearTimer();
  }

  setActivity(activity) {
    this.activity = { ...this.activity, ...activity };
    this._pump();
  }

  /** The reader is now in this block. */
  observe(blockIndex) {
    if (!Number.isInteger(blockIndex) || blockIndex === this.currentBlock) return;
    this.currentBlock = blockIndex;
    this._pump();
  }

  sectionIndexForBlock(blockIndex) {
    return this.sections.findIndex(section => blockIndex >= section.startBlock && blockIndex < section.endBlock);
  }

  _active() {
    const { playing, visible, inChamber, mode } = this.activity;
    return playing && visible && inChamber && mode === 'follow';
  }

  _clearTimer() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  _abort(reason) {
    if (!this.inFlight) return;
    this.generation += 1;
    try { this.inFlight.controller.abort(); } catch { /* already settled */ }
    const section = this.inFlight.section;
    // An obsolete request is not a failure: it may be asked again later.
    if (this.status.get(section.key) === 'pending') this.status.delete(section.key);
    this.inFlight = null;
    this.onEvent({ kind: 'aborted', section: section.key, reason });
  }

  async _fromCache(section) {
    section.digest ||= await canonicalSectionDigest(section.blocks);
    if (this.status.has(section.key)) return this.status.get(section.key) === 'scored';
    const hit = this.cache.get(scoreCacheKey(section.sourceDigest, section.digest));
    if (!hit) return false;
    this.director.stage(hit.choices, 'jev');
    this.status.set(section.key, 'scored');
    this.onEvent({ kind: 'cached', section: section.key });
    return true;
  }

  /** Pumps are serialized so two atoms can never race two requests. */
  _pump() {
    if (this.destroyed || !this.prepared || this.currentBlock < 0) return;
    this._chain = (this._chain || Promise.resolve())
      .then(() => this._pumpAsync())
      .catch(() => {});
  }

  async _pumpAsync() {
    const index = this.sectionIndexForBlock(this.currentBlock);
    if (index < 0) return;
    const wanted = [this.sections[index], this.sections[index + 1]].filter(Boolean);
    for (const section of wanted) await this._fromCache(section);
    if (this.destroyed) return;

    // A large seek makes an in-flight section obsolete: cancel it and
    // prioritize the destination.
    if (this.inFlight && !wanted.includes(this.inFlight.section)) this._abort('seek');
    if (this.inFlight || !this._active()) return;

    const current = wanted[0];
    const target = !this.status.has(current.key)
      ? current
      : (wanted[1] && !this.status.has(wanted[1].key) ? wanted[1] : null);
    if (!target || !this.permitted.has(target.sourceDigest)) return;

    const since = this.now() - 60_000;
    this.sent = this.sent.filter(time => time > since);
    if (this.sent.length >= CLIENT_REQUESTS_PER_MINUTE) {
      if (this.timer === null) {
        this.timer = this.setTimer(() => { this.timer = null; this._pump(); }, this.sent[0] - since + 50);
      }
      return;
    }
    this._request(target);
  }

  /** Starts synchronously (the digest is already known), then settles async. */
  _request(section) {
    if (this.inFlight || this.destroyed || !section.digest) return;
    const previousIndex = section.startBlock - 1;
    const previous = previousIndex >= 0 ? this.director.pendingChoice(previousIndex)?.treatmentId : null;
    const request = {
      schemaVersion: VISUAL_SCORE_SCHEMA_VERSION,
      sourceDigest: section.sourceDigest,
      sectionDigest: section.digest,
      treatmentCatalogVersion: TREATMENT_CATALOG_VERSION,
      blocks: section.blocks,
      ...(previous ? { previousTreatmentId: previous } : {})
    };
    const controller = new AbortController();
    const generation = ++this.generation;
    this.inFlight = { section, controller, generation };
    this.status.set(section.key, 'pending');
    this.sent.push(this.now());
    this.onEvent({ kind: 'requested', section: section.key });
    void this._settle(section, request, controller, generation);
  }

  async _settle(section, request, controller, generation) {
    const timeout = this.setTimer(() => controller.abort(), CLIENT_TIMEOUT_MS);
    let outcome;
    try {
      const response = await this.fetchImpl(VISUAL_SCORE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) {
        outcome = { ok: false, code: `HTTP_${response.status}` };
      } else {
        const checked = validateScoreResponse(await response.json(), request);
        outcome = checked.ok ? { ok: true, response: checked.response } : { ok: false, code: `INVALID_${checked.code}` };
      }
    } catch (cause) {
      outcome = { ok: false, code: cause?.name === 'AbortError' ? 'ABORTED' : 'NETWORK' };
    } finally {
      this.clearTimer(timeout);
    }
    if (this.inFlight?.generation === generation) this.inFlight = null;
    // A superseded, revoked, or destroyed request is discarded whatever it
    // returned: its generation is no longer the current one.
    if (generation !== this.generation) return;
    if (outcome.ok && this.prepared?.[section.sourceIndex]?.sourceDigest === outcome.response.sourceDigest) {
      this.cache.set(scoreCacheKey(section.sourceDigest, section.digest), {
        choices: outcome.response.choices, model: outcome.response.model
      });
      // Staging reaches only unentered blocks and never restarts playback,
      // so a reply that lands while paused or in Hold is still kept.
      const staged = this.director.stage(outcome.response.choices, 'jev');
      this.status.set(section.key, 'scored');
      this.onEvent({ kind: 'scored', section: section.key, staged });
    } else {
      // Offline, 429, timeout, missing configuration, or an invalid reply:
      // local direction stays, and this section is not retried this session.
      this.status.set(section.key, 'failed');
      this.onEvent({ kind: 'failed', section: section.key, code: outcome.code || 'IDENTITY' });
    }
    if (!this.destroyed) this._pump();
  }

  destroy() {
    this.destroyed = true;
    this._abort('destroyed');
    this._clearTimer();
  }
}
