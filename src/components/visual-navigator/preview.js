/**
 * Cortex preview and specimen ink. Imported lazily so the Orbital does not
 * pay for generation until a reader opens a leaf.
 */
import { safeUrl } from '../../core/sanitize.js';
import { substylesFor } from '../../core/visual-taxonomy.js';
import { wordFillValue } from './markup.js';

/**
 * One still in flight, for every navigator on the page.
 *
 * The cortex draws continuous procedural stills on canvases the reading also
 * uses, and a preview once drained the Fractal frame queue the reading opens
 * on. A rail asks for a dozen stills at once, so the rule has to live below
 * any one panel: a single line, the cache shared, a failure costing only
 * itself. The cache outlives a navigator so reopening the panel is free.
 *
 * ONLY ENGINE RENDERS WAIT IN THE LINE. A sourced still is a network fetch
 * that shares no canvas; put in the line, one hung request would hold every
 * picture behind it. It is deduplicated and cached, and nothing more. An
 * engine render that never answers is abandoned after SERIAL_LIMIT_MS for
 * the same reason.
 */
const SERIAL_LIMIT_MS = 8000;

export const stillQueue = (() => {
  const cache = new Map();
  const waiting = [];
  const pending = new Map();
  let running = false;

  const settle = (key, url) => {
    if (url) cache.set(key, url);
    pending.delete(key);
    return url;
  };

  const attempt = async loader => {
    try {
      return (await loader()) || null;
    } catch {
      return null;
    }
  };

  const pump = async () => {
    if (running) return;
    running = true;
    while (waiting.length) {
      const job = waiting.shift();
      let timer = null;
      const limit = new Promise(resolve => { timer = setTimeout(() => resolve(null), SERIAL_LIMIT_MS); });
      const url = await Promise.race([attempt(job.loader), limit]);
      clearTimeout(timer);
      job.resolve(settle(job.key, url));
    }
    running = false;
  };

  return {
    SERIAL_LIMIT_MS,
    request(key, loader, { serial = true, signal = null } = {}) {
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      if (pending.has(key)) return pending.get(key);
      let job = null;
      const promise = serial
        ? new Promise(resolve => {
          job = { key, loader, resolve };
          waiting.push(job);
          void pump();
        })
        : attempt(loader).then(url => settle(key, url));
      pending.set(key, promise);
      // An abandoned request is withdrawn, or the subject would stay "in
      // flight" and a reader returning to it would never see its picture.
      signal?.addEventListener('abort', () => {
        if (pending.get(key) === promise) pending.delete(key);
        const at = job ? waiting.indexOf(job) : -1;
        if (at >= 0) {
          waiting.splice(at, 1);
          job.resolve(null);
        }
      }, { once: true });
      return promise;
    },
    cached(key) {
      return cache.get(key) ?? null;
    },
    prioritize(key) {
      const at = waiting.findIndex(job => job.key === key);
      if (at > 0) waiting.unshift(...waiting.splice(at, 1));
    },
    _reset() {
      cache.clear();
      waiting.length = 0;
      pending.clear();
    }
  };
})();

export const previewMethods = {
  async _mountLeafPreview() {
    const leaf = this.focus;
    const slot = this.container.querySelector('.vnav-preview');

    // WHAT IS BEING PREVIEWED, NOT HOW MANY TIMES THE PANEL HAS REDRAWN.
    //
    // render() replaces the whole panel on every selection, so this runs
    // again after changes that have nothing to do with the picture. Keyed on
    // the render, it aborted a fetch in flight and started it over each time
    // — measured at two requests for one leaf, the first killed by an
    // unrelated toggle. On a slow connection a reader adjusting anything
    // could keep a sourced preview from ever arriving.
    //
    // Keyed on the subject instead, an unrelated redraw is simply not news:
    // the request in flight is for the same thing it was for, and is left
    // alone to finish. Only a change of subject cancels.
    const key = leaf?.engineId
      ? this._engineStillKey(leaf.engineId)
      : (leaf?.pool ? this.selection.pool?.[leaf.id] : null);

    if (!key || !slot) {
      this._cancelPreview();
      return;
    }

    const cached = stillQueue.cached(key);
    if (cached) {
      this._previewKey = key;
      this._paintLeafPreview(slot, cached, key);
      return;
    }

    // Already fetching this very thing: the rebuilt slot will be painted by
    // the request that is already running.
    if (this._previewKey === key && this._previewAbort) return;

    this._cancelPreview();
    this._previewKey = key;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._previewAbort = controller;

    const url = await this._fetchStill(key, cortex => leaf.engineId
      ? cortex.renderLeafStill(leaf.engineId).then(still => still?.url)
      : this._sourcedStill(cortex, key, controller?.signal),
    { serial: Boolean(leaf.engineId), signal: controller?.signal });
    if (this._previewAbort === controller) this._previewAbort = null;
    if (this._previewKey !== key || !url) return;
    this._paintLeafPreview(this.container.querySelector('.vnav-preview'), url, key);
  },

  async _mountSpecimenInk() {
    const value = wordFillValue(this.selection.wordFill);
    const isEngine = value.startsWith('procedural:');
    const key = isEngine
      ? value.slice('procedural:'.length)
      : (value.startsWith('sourced:') ? value.slice('sourced:'.length) : null);

    if (!key || !this.hasActiveMask()) {
      this._cancelInk();
      return;
    }
    if (stillQueue.cached(key)) {
      this._inkKey = key;
      this._paintSpecimen(key);
      return;
    }
    if (this._inkKey === key && this._inkAbort) return;

    this._cancelInk();
    this._inkKey = key;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._inkAbort = controller;
    const url = await this._fetchStill(key, cortex => isEngine
      ? cortex.renderLeafStill(key).then(still => still?.url)
      : this._sourcedStill(cortex, key, controller?.signal),
    { serial: isEngine, signal: controller?.signal });
    if (this._inkAbort === controller) this._inkAbort = null;
    if (this._inkKey !== key || !url) return;
    this._paintSpecimen(key);
  },

  _fetchStill(key, loadUrl, options = {}) {
    return stillQueue.request(key, async () => {
      const { visualCortex } = await import('../../visuals/visual-cortex.js');
      return loadUrl(visualCortex);
    }, options);
  },

  _paintSpecimen(key) {
    const figure = this.container.querySelector('.vnav-specimen');
    if (!figure || this._inkKey !== key) return;
    const safe = safeUrl(stillQueue.cached(key) || '');
    if (!safe) return;
    figure.classList.add('has-ink');
    figure.style.setProperty('--specimen-ink', `url('${safe}')`);
  },

  _cancelInk() {
    this._inkAbort?.abort();
    this._inkAbort = null;
    this._inkKey = null;
  },

  _cancelPreview() {
    this._previewAbort?.abort();
    this._previewAbort = null;
    this._previewKey = null;
  },

  async _sourcedStill(visualCortex, collectionId, signal) {
    const works = await visualCortex.resolveCollectionWorks(collectionId, { limit: 1, signal });
    const work = Array.isArray(works) ? works[0] : null;
    return work?.data?.url || work?.url || null;
  },

  _engineStillKey(engineId) {
    const style = this.styleOf(engineId);
    const parts = substylesFor(engineId)
      .map(b => `${b.key}=${style[b.key] ?? ''}`)
      .join('&');
    return parts ? `${engineId}?${parts}` : engineId;
  },

  _paintLeafPreview(slot, url, key) {
    if (!slot || !slot.isConnected || this._previewKey !== key) return;
    const safe = safeUrl(url);
    if (!safe) return;
    slot.classList.add('has-still');
    slot.style.backgroundImage = `url("${safe}")`;
    // The glyph and the caption were both placeholders for a picture. Once
    // the picture is here they are not a label on it, they are litter on it.
    for (const sel of ['.vnav-preview-note', '.vnav-preview-glyph']) {
      slot.querySelector(sel)?.remove();
    }
  },
};
