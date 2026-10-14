/**
 * RISE Changes: what merged into RISE, as a RISE reading.
 *
 * `/changes` lists the digests, newest first; `/changes/<id>` shows one: its
 * reading, the pull requests it speaks about, and how every merged pull
 * request was routed. The weekly workflow writes the files to the
 * `changes-data` branch and the Worker serves them at `/content/changes/`
 * (worker/changes.mjs). Everything in them is model- or PR-written, so each
 * file is held to its contract here before anything of it is shown, and the
 * digest's Current to the admission a card's Current passes at the Worker's
 * door (worker/mcp-server.mjs): the Current validator, and every generated
 * scene's code and figure's SVG. A file that fails is one line and
 * no reading. Nothing here calls a model. Loaded only when a changes address
 * is opened.
 */
import './changes.css';
import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../core/rise-current.js';
import { sceneRefusal } from '../core/scene-admission.js';

const INDEX_SCHEMA = 'syberlabs.changes-index/v1';
const DIGEST_SCHEMA = 'syberlabs.changes-digest/v1';
const DIGEST_ID = /^\d{4}-\d{2}-\d{2}(?:-[a-z0-9]{1,8})?$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const SHA = /^[0-9a-f]{40}$/u;
const PULL = 'https://github.com/SyberLabs/RISE/pull/';
export const CHANGES_LIMITS = Object.freeze({ digests: 200, changes: 60, included: 24, title: 200, name: 120, bytes: 256 * 1024 });

const AUDIENCES = ['team', 'readers'];
const ROUTE = Object.freeze({
  audience: ['skip', 'team', 'readers', 'both'],
  significance: ['minor', 'notable', 'major'],
  kind: ['feature', 'fix', 'performance', 'design', 'infrastructure', 'records']
});
const REASONS = ['routed', 'records-only', 'limit'];
const AUDIENCE_WORDS = { team: 'the team', readers: 'readers' };
const BADGES = { team: 'Team', readers: 'Readers' };

const utf8Bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function refuse(what) {
  throw new Error(`RISE Changes refused the file: ${what}`);
}

const record = (value, what) => (value && typeof value === 'object' && !Array.isArray(value) ? value : refuse(`${what} is not an object`));

function only(value, allowed, what) {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra !== undefined) refuse(`${what} has an unknown field`);
}

function text(value, limit, what) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) refuse(`${what} is not text of at most ${limit} characters`);
  return value;
}

function time(value, what) {
  if (typeof value !== 'string' || !ISO_TIME.test(value) || !Number.isFinite(Date.parse(value))) refuse(`${what} is not an ISO-8601 time`);
  return value;
}

function period(value, what) {
  only(record(value, what), ['from', 'to'], what);
  time(value.from, `${what}.from`);
  time(value.to, `${what}.to`);
  if (Date.parse(value.from) > Date.parse(value.to)) refuse(`${what} ends before it begins`);
  return { from: value.from, to: value.to };
}

const oneOf = (value, list, what) => (list.includes(value) ? value : refuse(`${what} is not one of ${list.join(', ')}`));

/** The index's entries, newest first as written. Throws for anything outside `syberlabs.changes-index/v1`. */
export function admitChangesIndex(value) {
  only(record(value, 'the index'), ['schema', 'digests'], 'the index');
  if (value.schema !== INDEX_SCHEMA) refuse('the index has another schema');
  if (!Array.isArray(value.digests) || value.digests.length > CHANGES_LIMITS.digests) refuse('the index lists no digests');
  return value.digests.map((entry, index) => {
    const what = `digest ${index}`;
    only(record(entry, what), ['id', 'audience', 'title', 'period', 'count'], what);
    if (typeof entry.id !== 'string' || !DIGEST_ID.test(entry.id)) refuse(`${what} has no id`);
    if (!Number.isInteger(entry.count) || entry.count < 0 || entry.count > CHANGES_LIMITS.changes) refuse(`${what} has no count`);
    return {
      id: entry.id, audience: oneOf(entry.audience, AUDIENCES, `${what}.audience`),
      title: text(entry.title, CHANGES_LIMITS.title, `${what}.title`), period: period(entry.period, `${what}.period`), count: entry.count
    };
  });
}

function admitChange(value, index) {
  const what = `change ${index}`;
  only(record(value, what), ['number', 'title', 'url', 'mergedAt', 'mergeSha', 'route', 'included', 'reason'], what);
  if (!Number.isInteger(value.number) || value.number < 1) refuse(`${what} has no pull request number`);
  if (value.url !== `${PULL}${value.number}`) refuse(`${what} links elsewhere than its pull request`);
  if (typeof value.mergeSha !== 'string' || !SHA.test(value.mergeSha)) refuse(`${what} has no merge commit`);
  const route = record(value.route, `${what}.route`);
  only(route, Object.keys(ROUTE), `${what}.route`);
  for (const [field, list] of Object.entries(ROUTE)) oneOf(route[field], list, `${what}.route.${field}`);
  if (typeof value.included !== 'boolean') refuse(`${what} does not say whether it is included`);
  oneOf(value.reason, REASONS, `${what}.reason`);
  if (value.included && (value.reason !== 'routed' || route.audience === 'skip')) refuse(`${what} is included against its route`);
  return {
    number: value.number, title: text(value.title, CHANGES_LIMITS.title, `${what}.title`), url: value.url,
    mergedAt: time(value.mergedAt, `${what}.mergedAt`), mergeSha: value.mergeSha,
    route: { audience: route.audience, significance: route.significance, kind: route.kind },
    included: value.included, reason: value.reason
  };
}

/** The Current, held to what a card's Current is held to at the Worker's door; the original is what plays. */
function admitCurrent(current, composer) {
  const valid = validateRiseCurrent(current);
  if (valid.schema !== RISE_CURRENT_SCHEMA_V2) refuse('the Current is not a rise.current.v2');
  if (valid.origin.kind !== 'model' || valid.origin.name !== composer) refuse('the Current names another author than the digest');
  for (const scene of valid.scenes) {
    if (scene.code === undefined && scene.svg === undefined) continue;
    const refusal = sceneRefusal(scene);
    if (refusal) refuse(refusal);
  }
  return valid;
}

/**
 * One digest, held to `syberlabs.changes-digest/v1` and served as `id`, with its included changes in order.
 * Throws for anything else: the page then shows no part of it.
 */
export function admitChangesDigest(value, id) {
  const digest = record(value, 'the digest');
  only(digest, ['schema', 'id', 'audience', 'title', 'period', 'generatedAt', 'model', 'changes', 'current', 'sources'], 'the digest');
  if (digest.schema !== DIGEST_SCHEMA) refuse('the digest has another schema');
  if (digest.id !== id || !DIGEST_ID.test(id)) refuse('the digest is not the one asked for');
  if (utf8Bytes(digest) > CHANGES_LIMITS.bytes) refuse('the digest is over 256 KB');
  const model = record(digest.model, 'the model');
  only(model, ['router', 'composer', 'via'], 'the model');
  for (const field of ['router', 'composer', 'via']) text(model[field], CHANGES_LIMITS.name, `model.${field}`);
  if (!Array.isArray(digest.changes) || digest.changes.length > CHANGES_LIMITS.changes) refuse('the digest lists too many changes');
  const changes = digest.changes.map(admitChange);
  const numbers = new Set(changes.map(change => change.number));
  if (numbers.size !== changes.length) refuse('a pull request is listed twice');
  const included = changes.filter(change => change.included);
  if (included.length < 1 || included.length > CHANGES_LIMITS.included) refuse('the digest includes no changes, or too many');
  const current = admitCurrent(digest.current, model.composer);
  const sources = record(digest.sources, 'the sources');
  const cited = new Set();
  for (const [beat, list] of Object.entries(sources)) {
    if (!/^(?:0|[1-9]\d*)$/u.test(beat) || Number(beat) >= current.beats.length) refuse(`source ${beat} names no beat`);
    if (!Array.isArray(list) || list.length < 1) refuse(`source ${beat} cites nothing`);
    for (const number of list) {
      if (!included.some(change => change.number === number)) refuse(`source ${beat} cites a change that is not included`);
      cited.add(number);
    }
  }
  if (included.some(change => !cited.has(change.number))) refuse('an included change is cited by no beat');
  return {
    id, audience: oneOf(digest.audience, AUDIENCES, 'the audience'), title: text(digest.title, CHANGES_LIMITS.title, 'the title'),
    period: period(digest.period, 'the period'), generatedAt: time(digest.generatedAt, 'generatedAt'),
    model: { router: model.router, composer: model.composer, via: model.via },
    changes, included, current: digest.current
  };
}

async function fetchJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

export async function loadChangesIndex(load = fetchJson) {
  return admitChangesIndex(await load('/content/changes/index.json'));
}

export async function loadChangesDigest(id, load = fetchJson) {
  if (typeof id !== 'string' || !DIGEST_ID.test(id)) refuse('the address names no digest');
  return admitChangesDigest(await load(`/content/changes/${id}.json`), id);
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A period in words, in UTC: `12–19 October 2026`, `28 September – 5 October 2026`. */
export function periodWords({ from, to }) {
  const start = new Date(from);
  const end = new Date(to);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return `${FULL.format(start)} – ${FULL.format(end)}`;
  if (start.getUTCMonth() !== end.getUTCMonth()) return `${DAY_MONTH.format(start)} – ${FULL.format(end)}`;
  return `${DAY.format(start)}–${FULL.format(end)}`;
}

const escape = value => String(value).replace(/[&<>"']/gu, c => `&#${c.charCodeAt(0)};`);
const changesPath = id => (id ? `/changes/${encodeURIComponent(id)}` : '/changes');
const plural = (count, one) => `${count} ${one}${count === 1 ? '' : 's'}`;
const EYEBROW = '<p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>RISE Changes</p>';
const badge = audience => `<span class="changes-badge">${BADGES[audience]}</span>`;
// Set when the reader follows a changes link, so the next page's heading takes focus.
let moved = false;

/** Why a change is or is not in a digest for `audience`, in words. */
function reasonWords({ included, reason, route }, audience) {
  if (included) return 'Included';
  if (reason === 'records-only') return 'Left out: records only';
  if (reason === 'limit') return `Left out: over the ${CHANGES_LIMITS.included}-change limit`;
  if (route.audience === 'skip') return 'Left out: routed to no audience';
  if (route.audience !== 'both' && route.audience !== audience) return `Left out: routed to ${AUDIENCE_WORDS[route.audience]} only`;
  return route.significance === 'minor' ? 'Left out: minor' : 'Left out';
}

function listView(digests) {
  const rows = digests.map(({ id, audience, title, period: when, count }) => `<li class="changes-digest">
        <a class="changes-digest-title" href="${changesPath(id)}" data-changes-go>${escape(title)}</a>
        <p class="changes-meta">${escape(periodWords(when))} · ${plural(count, 'change')} ${badge(audience)}</p>
      </li>`).join('');
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">What changed in RISE</h1>
    <div id="changes">
      <p class="portal-help">Each digest is the pull requests merged into RISE over a week, told as a RISE reading. A model writes it; RISE checks it before showing it. Nothing here calls a model.</p>
      ${digests.length ? `<ul class="changes-digests">${rows}</ul>`
        : '<p class="portal-help" role="status">No digest has been written yet.</p>'}
    </div>`;
}

function detailView(digest) {
  const when = periodWords(digest.period);
  const { composer, router, via } = digest.model;
  const included = digest.included.map(({ number, title, url }) => `<li>
        <a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><span class="changes-number">#${number}</span> ${escape(title)}</a>
      </li>`).join('');
  const chosen = digest.changes.map(change => `<li class="changes-route"${change.included ? ' data-included' : ''}>
        <a href="${escape(change.url)}" target="_blank" rel="noopener noreferrer"><span class="changes-number">#${change.number}</span> ${escape(change.title)}</a>
        <p class="changes-meta"><span class="changes-route-words">${change.route.audience} · ${change.route.significance} · ${change.route.kind}</span> — ${reasonWords(change, digest.audience)}</p>
      </li>`).join('');
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">${escape(digest.title)}</h1>
    <div id="changes">
      <p class="changes-meta">${escape(when)} · ${plural(digest.included.length, 'change')} in the reading ${badge(digest.audience)}</p>
      <div class="portal-actions">
        <button class="portal-primary" type="button" data-changes-play>Play the reading</button>
        <p class="portal-status" id="changes-status" role="status" aria-live="polite"></p>
      </div>
      <p class="portal-help">Written by ${escape(composer)} via ${escape(via)} from ${plural(digest.included.length, 'merged pull request')}, ${escape(when)}.</p>
      <section class="changes-section" aria-labelledby="changes-included-title">
        <h2 class="changes-heading" id="changes-included-title">What changed</h2>
        <ol class="changes-included">${included}</ol>
      </section>
      <details class="changes-chosen">
        <summary>How this was chosen</summary>
        <p class="portal-help">Every pull request merged in the period, routed by ${escape(router)} via ${escape(via)}: who it is for, how much it matters, what kind of change it is, and whether the reading tells it.</p>
        <ul class="changes-routes">${chosen}</ul>
      </details>
      <p class="portal-help"><a href="/changes" data-changes-go>All digests</a></p>
    </div>`;
}

function emptyView(line, href, link) {
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">RISE Changes</h1>
    <div id="changes">
      <p class="portal-help" role="status">${escape(line)}</p>
      <p class="portal-help"><a href="${href}" data-changes-go>${link}</a></p>
    </div>`;
}

/**
 * Show a changes address in `section`: the list (no `digestId`), or one digest. Its reading is one press
 * away: `launch(current, path)` plays the admitted Current at the digest's own address. `go(path)` moves
 * to another address in place.
 */
export async function mountChanges(section, { digestId = null, launch, go, load }) {
  section.innerHTML = `${EYEBROW}<p class="portal-status" role="status">Loading…</p>`;
  let digest = null;
  try {
    if (digestId === null) section.innerHTML = listView(await loadChangesIndex(load));
    else {
      digest = await loadChangesDigest(digestId, load);
      section.innerHTML = detailView(digest);
    }
  } catch (error) {
    console.warn('[RISE] Changes unavailable:', error);
    section.innerHTML = digestId === null
      ? emptyView('The list of digests could not be shown.', '/', 'Back to Home')
      : emptyView('This digest could not be shown.', '/changes', 'All digests');
  }
  if (moved) section.querySelector('h1')?.focus();
  moved = false;
  section.addEventListener('click', event => {
    const link = event.target.closest('a[data-changes-go]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    moved = true;
    go(link.getAttribute('href'));
  });
  const play = section.querySelector('[data-changes-play]');
  const status = section.querySelector('#changes-status');
  play?.addEventListener('click', async () => {
    if (play.disabled) return;
    play.disabled = true;
    status.textContent = 'Opening the reading…';
    try {
      await launch(digest.current, changesPath(digest.id));
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'This reading could not be opened.';
    } finally {
      play.disabled = false;
    }
  });
}
