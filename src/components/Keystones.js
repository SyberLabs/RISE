import { KEYSTONE_MANIFESTS, resolveKeystone } from '../content/keystones.js';
import { archiveReviewEnabled } from '../content/archive/index.js';
import { countWords } from '../core/chunker.js';
import { escapeHtml } from '../core/sanitize.js';
import { shippedStillUrl } from '../visuals/engine-stills.js';
import './Keystones.css';

const DISTRIBUTION_MANIFEST_PATH = '/media/keystones/distribution.json';

/** The reading the corridor opens on when no route named one. */
const DEFAULT_SLUG = 'metamorphoses';

/**
 * Which shipped engine still may sit on the void as an orb face.
 *
 * The register in `visuals/engine-stills.js` is the list of pictures, but not
 * every picture is a field: the Iris plate ships drawn on a light ground,
 * because it is a printed plate. Dropped into a near-black composition it
 * reads as a lamp. Only the flame is already black-ground, so only the flame
 * is shown; the other faces are drawn as fields in the stylesheet.
 */
const STILL_FACES = new Set(['fractal']);

/** How far a pointer must travel across the rail before it counts as a swipe. */
const SWIPE_DISTANCE = 44;

async function loadPublishedMp4s(signal) {
  try {
    const response = await fetch(DISTRIBUTION_MANIFEST_PATH, { signal });
    if (!response.ok) return new Map();
    const manifest = await response.json();
    if (manifest?.schema !== 'rise.keystone-distribution.v1'
      || !Array.isArray(manifest.results)) return new Map();
    const known = new Set(KEYSTONE_MANIFESTS.map(item => item.slug));
    return new Map(manifest.results
      .filter(item => item?.status === 'published'
        && known.has(item.slug)
        && /^\.\/[a-z0-9-]+\.mp4$/u.test(item.url || ''))
      .map(item => [item.slug, {
        ...item,
        url: `/media/keystones/${item.url.slice(2)}`
      }]));
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn('[Keystones] MP4 manifest unavailable:', error);
    return new Map();
  }
}

/** Which reading the corridor seats in the centre for a given route. */
function initialIndex(slug) {
  const named = KEYSTONE_MANIFESTS.findIndex(item => item.slug === slug);
  if (named >= 0) return named;
  return Math.max(0, KEYSTONE_MANIFESTS.findIndex(item => item.slug === DEFAULT_SLUG));
}

/**
 * Public threshold for the three canonical launch compositions.
 *
 * The three readings are one instrument in three states, so they are shown as
 * one navigable field rather than three parallel offers: exactly one reading
 * holds the centre, the other two sit out to either side, and a single action
 * enters whichever is centred. Selection is the interface; entering is a
 * second, deliberate act.
 */
export class Keystones {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onLaunch = options.onLaunch || (() => {});
    this.initialSlug = options.initialSlug || null;
    this.reviewMode = archiveReviewEnabled();
    this.results = new Map();
    this.extents = new Map();
    this.publishedMp4s = new Map();
    this.selected = initialIndex(this.initialSlug);
    this._events = new AbortController();
    this._fetch = new AbortController();
    this._swiped = false;
    this.render();
    this.attachEvents();
    this.applySelection(this.selected);
    this.refresh();
  }

  get manifest() {
    return KEYSTONE_MANIFESTS[this.selected];
  }

  get result() {
    return this.results.get(this.manifest?.slug) || null;
  }

  /** Whether the centred reading may be opened at all. */
  canLaunch(result) {
    return Boolean(result?.ready || result?.admitted
      || (this.reviewMode && result?.reviewable));
  }

  orbMarkup(item, index) {
    const face = item.visual.kind === 'procedural' ? item.visual.id : 'collection';
    const still = STILL_FACES.has(face) ? shippedStillUrl(face) : null;
    return `
      <button class="keystone-orb" id="keystone-${escapeHtml(item.slug)}"
        role="radio" aria-checked="false" tabindex="-1"
        data-slug="${escapeHtml(item.slug)}" data-index="${index}" data-pos="${index - this.selected}">
        <span class="keystone-figure" data-face="${escapeHtml(face)}"
          ${still ? `style="--keystone-still: url('${escapeHtml(still)}')"` : ''}>
          <span class="keystone-face" aria-hidden="true">
            <span class="keystone-layer" data-layer="a"></span>
            <span class="keystone-layer" data-layer="b"></span>
            <span class="keystone-layer" data-layer="c"></span>
          </span>
          <span class="keystone-veil" aria-hidden="true"></span>
        </span>
        <span class="keystone-plaque">
          <span class="keystone-index">0${index + 1}</span>
          <span class="keystone-axis">${escapeHtml(item.axis)}</span>
          <span class="keystone-title">${escapeHtml(item.title)}</span>
          <span class="keystone-relation">${escapeHtml(item.author)} × ${escapeHtml(item.relation)}</span>
          <span class="keystone-extent" data-extent aria-hidden="true"></span>
        </span>
      </button>`;
  }

  render() {
    const orbs = KEYSTONE_MANIFESTS.map((item, index) => this.orbMarkup(item, index)).join('');
    this.container.innerHTML = `
      <main class="keystones" id="main-content">
        <button class="keystone-back" data-nav="portal" aria-label="Return to Portal">← Portal</button>
        <header class="keystone-header">
          <h1>Three canonical readings</h1>
          <p class="keystone-intro">One instrument, composed three ways: mind, transformation, and world.</p>
        </header>
        <section class="keystone-field">
          <div class="keystone-rail" role="radiogroup" aria-label="Canonical RISE readings">
            <span class="keystone-hairline" aria-hidden="true"></span>
            <span class="keystone-nodes" aria-hidden="true"></span>
            ${orbs}
          </div>
          <button class="keystone-step" data-step="-1" aria-label="Previous reading">
            <span aria-hidden="true">‹</span>
          </button>
          <button class="keystone-step" data-step="1" aria-label="Next reading">
            <span aria-hidden="true">›</span>
          </button>
        </section>
        <div class="keystone-console">
          <button class="btn-primary keystone-enter" data-enter>Enter reading</button>
          <a class="btn-ghost keystone-mp4" data-mp4 href="#" hidden>Watch full MP4</a>
          <p class="keystone-state" data-state="pending" hidden></p>
        </div>
      </main>`;
  }

  attachEvents() {
    const options = { signal: this._events.signal };
    this.container.querySelector('[data-nav="portal"]')?.addEventListener(
      'click', () => this.onNavigate('portal'), options
    );
    this.container.querySelector('[data-enter]')?.addEventListener(
      'click', () => this.launch(), options
    );

    const rail = this.container.querySelector('.keystone-rail');
    rail?.addEventListener('click', event => {
      const orb = event.target.closest('.keystone-orb');
      if (!orb) return;
      // A swipe ends in a click on whatever was under the finger; the
      // gesture already chose, so the click must not choose again.
      if (this._swiped) {
        this._swiped = false;
        return;
      }
      const index = Number(orb.dataset.index);
      // The centre is the selection position, so a press on the centre is
      // no longer a choice — it is the entry.
      if (index === this.selected) this.launch();
      else this.applySelection(index, { focus: true });
    }, options);

    this.container.querySelectorAll('[data-step]').forEach(step => {
      step.addEventListener('click', () => {
        this.applySelection(this.selected + Number(step.dataset.step), {
          focus: this.container.querySelector('.keystone-rail')?.contains(document.activeElement)
        });
      }, options);
    });

    this.attachGestures(rail, options);
    window.addEventListener('keydown', event => this.onKeydown(event), options);
  }

  /** Horizontal swipe, from pointer events already in the platform. */
  attachGestures(rail, options) {
    let origin = null;
    rail?.addEventListener('pointerdown', event => {
      // Cleared for every press, not only for touches: a swipe that ended
      // over nothing must not swallow the next deliberate one.
      this._swiped = false;
      if (event.pointerType === 'mouse') return;
      origin = { x: event.clientX, y: event.clientY };
    }, options);
    rail?.addEventListener('pointerup', event => {
      if (!origin) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      origin = null;
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      this._swiped = true;
      this.applySelection(this.selected + (dx < 0 ? 1 : -1));
    }, options);
    rail?.addEventListener('pointercancel', () => { origin = null; }, options);
  }

  onKeydown(event) {
    if (this.container.hidden || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // A control that owns the arrow keys keeps them.
    if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const rail = this.container.querySelector('.keystone-rail');
      event.preventDefault();
      this.applySelection(this.selected + (event.key === 'ArrowLeft' ? -1 : 1), {
        focus: rail?.contains(document.activeElement)
      });
      return;
    }
    // Enter belongs to whichever control has focus; it only reaches the
    // reading when nothing on the page has claimed it.
    if (event.key === 'Enter'
      && (document.activeElement === document.body || document.activeElement === null)) {
      event.preventDefault();
      this.launch();
    }
  }

  /**
   * Move the centre. The rail has two ends, so it clamps: wrapping would fly
   * one reading across the whole composition, which is the opposite of the
   * spatial claim this arrangement makes.
   */
  applySelection(index, { focus = false } = {}) {
    const next = Math.min(KEYSTONE_MANIFESTS.length - 1, Math.max(0, index));
    this.selected = next;
    KEYSTONE_MANIFESTS.forEach((item, position) => {
      const orb = this.container.querySelector(`#keystone-${item.slug}`);
      if (!orb) return;
      const selected = position === next;
      orb.dataset.pos = String(position - next);
      orb.classList.toggle('is-selected', selected);
      orb.setAttribute('aria-checked', selected ? 'true' : 'false');
      orb.tabIndex = selected ? 0 : -1;
      const extent = orb.querySelector('[data-extent]');
      const words = this.extents.get(item.slug);
      if (extent) {
        extent.textContent = selected && words ? `${words.toLocaleString()} words` : '';
        if (selected && words) extent.removeAttribute('aria-hidden');
        else extent.setAttribute('aria-hidden', 'true');
      }
      if (selected && focus) orb.focus();
    });
    this.updateConsole();
  }

  /** The one action, and — only when it is refused — why. */
  updateConsole() {
    const manifest = this.manifest;
    const result = this.result;
    if (!manifest) return;

    const state = this.container.querySelector('.keystone-state');
    const enter = this.container.querySelector('[data-enter]');
    const mp4Link = this.container.querySelector('[data-mp4]');

    const blockers = result?.blockers || [];
    const launchable = this.canLaunch(result);
    // Only a refusal is worth saying. A reading that opens says so by
    // opening, and a certification note is not something a reader can act on.
    const refusal = !result || launchable
      ? ''
      : blockers.length
        ? blockers.map(blocker => blocker.message).join(' ')
        : 'This reading is not yet admitted.';
    if (state) {
      state.textContent = refusal;
      state.hidden = !refusal;
      state.dataset.state = result?.ready ? 'ready' : result?.admitted ? 'admitted' : 'pending';
    }

    if (enter) {
      enter.textContent = result?.ready || result?.admitted
        ? 'Enter reading'
        : launchable ? 'Review without missing media' : 'Not yet admitted';
      enter.disabled = !launchable;
      enter.dataset.keystone = manifest.slug;
      enter.setAttribute('aria-label', `Enter ${manifest.title}`);
    }

    const mp4 = this.publishedMp4s.get(manifest.slug);
    if (mp4Link) {
      mp4Link.hidden = !mp4;
      if (mp4) mp4Link.href = mp4.url;
    }

    const first = this.selected === 0;
    const last = this.selected === KEYSTONE_MANIFESTS.length - 1;
    this.container.querySelectorAll('[data-step]').forEach(step => {
      step.disabled = Number(step.dataset.step) < 0 ? first : last;
    });
    const rail = this.container.querySelector('.keystone-rail');
    if (rail) rail.dataset.edge = first ? 'start' : last ? 'end' : 'middle';
  }

  launch() {
    const manifest = this.manifest;
    if (!manifest || !this.canLaunch(this.result)) return;
    this.onLaunch(manifest.slug);
  }

  async refresh() {
    const token = {};
    this._refreshToken = token;
    const [settled, publishedMp4s] = await Promise.all([
      Promise.all(KEYSTONE_MANIFESTS.map(async item => [
        item.slug,
        await resolveKeystone(item.slug, { allowIncomplete: this.reviewMode })
      ])),
      loadPublishedMp4s(this._fetch.signal)
    ]);
    if (this._refreshToken !== token) return;
    this.results = new Map(settled);
    this.extents = new Map(settled
      .filter(([, result]) => typeof result.sessionInput?.text === 'string')
      .map(([slug, result]) => [slug, countWords(result.sessionInput.text)]));
    this.publishedMp4s = publishedMp4s;
    // The arrangement is already on screen and may already have been moved.
    // Evidence arriving late updates it in place rather than rebuilding it,
    // so a reader mid-selection is never thrown back to the default.
    this.applySelection(this.selected);
  }

  update(data) {
    this.initialSlug = data?.slug || null;
    this.applySelection(initialIndex(this.initialSlug));
  }

  activate() {}
  deactivate() {}

  destroy() {
    this._refreshToken = null;
    this._events.abort();
    this._fetch.abort();
  }
}
