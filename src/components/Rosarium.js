/**
 * The Rosarium — the Rosary's own room.
 *
 * Three states, one register:
 *
 *  CHOOSING — the glass rosary full size at center; mystery-set chips
 *    (the calendar's set pre-selected), Plain/Imagistic, sound, pace,
 *    and Start. Selection and commitment are different gestures.
 *
 *  STRAND — the between-space. After every prayer the room returns
 *    here: the just-prayed bead's warmth settling, the NEXT bead
 *    beckoning, one quiet line naming where you are. Advance (click /
 *    Space / →) moves into the next prayer. This is the physical
 *    rosary's own rhythm: pray, then the fingers find the next bead.
 *
 *  PRAYER — total. The prayer text with the icon (Plain) or the
 *    decade's painting (Imagistic) — the SAME slot, never both
 *    (the coexistence bug is dissolved by design). Ends by recitation
 *    timer, or by click in Unhurried mode; either way the room
 *    returns to the strand.
 *
 * The LiturgyRunner's fixed steps drive everything; this component
 * decides nothing about the form (non-negotiable #3). Transitions are
 * slow crossfades — lowering and raising the eyes.
 */

import { compileLiturgy } from '../core/liturgy-runner.js';
import { buildRosaryDefinition } from '../content/chapel/liturgy/rosary-liturgy.js';
import { MYSTERY_SETS, mysterySetForDate } from '../content/chapel/liturgy/rosary.js';
import { mysteryWork, ROSARY_MYSTERY_WORKS } from '../content/chapel/liturgy/rosary-imagery.js';
import { CHAPEL_ICONS, CHAPEL_ICON_DEFAULTS, findChapelIcon } from '../content/chapel/imagery/icons.js';
import { RosaryStrand } from '../visuals/rosary-strand.js';
import { escapeHtml } from '../core/sanitize.js';

const MODE_KEY = 'rise_chapel_rosary_mode_v1';
const SOUND_KEY = 'rise_rosarium_sound_v1';
const ADVANCE_KEY = 'rise_rosarium_advance_v1';

const SOUNDS = Object.freeze([
  ['none', 'Silence'],
  ['chant-gregorian', 'Gregorian'],
  ['chant-znamenny', 'Znamenny'],
  ['aurora', 'Aurora']
]);

export class Rosarium {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.iconId = options.iconId && findChapelIcon(options.iconId)
      ? options.iconId
      : CHAPEL_ICON_DEFAULTS.marian;

    this.setId = MYSTERY_SETS[options.setId] ? options.setId : mysterySetForDate();
    this.mode = this._pref(MODE_KEY) === 'imagistic' ? 'imagistic' : 'plain';
    this.sound = SOUNDS.some(([id]) => id === this._pref(SOUND_KEY)) ? this._pref(SOUND_KEY) : 'none';
    this.autoAdvance = this._pref(ADVANCE_KEY) === 'auto';
    this.pace = 1;

    // Prayer state
    this.phase = 'choosing';        // 'choosing' | 'strand' | 'prayer' | 'complete'
    this.compiled = null;
    this.stepIndex = -1;
    this._prayerTimer = null;
    this._strandTimer = null;
    this._decadeWorkCache = new Map();
    this._galleryOpen = false;

    // VISUAL GENERATION: every async result must prove the devotional
    // moment that authorized it still exists. The token increments —
    // and in-flight work aborts — on any change of moment: a new
    // mystery set, a start, a gallery open/close, a return to
    // choosing, exit, destroy. A stale resolution that survives its
    // await must find its generation unchanged before it may touch
    // the DOM or the speakers; otherwise it evaporates.
    this._visualGeneration = 0;
    this._visualAbort = null;

    this._abort = new AbortController();
    this.render();
    this.attachEvents();
  }

  _pref(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  _setPref(key, value) {
    try { localStorage.setItem(key, value); } catch { /* this visit only */ }
  }

  // ── Rendering ──────────────────────────────────────────────

  render() {
    this.container.innerHTML = `
      <main class="rosarium" aria-label="The Rosarium">
        <div class="rosarium-stage" data-phase="${this.phase}">
          <canvas class="rosarium-strand" width="640" height="760" aria-hidden="true"></canvas>
          <div class="rosarium-overlay"></div>
          <p class="chant-credit font-mono" aria-live="polite" hidden></p>
        </div>
      </main>
    `;
    this.strand = new RosaryStrand(this.container.querySelector('.rosarium-strand'));
    this.strand.render();
    this.renderOverlay();
  }

  renderOverlay() {
    const overlay = this.container.querySelector('.rosarium-overlay');
    const stage = this.container.querySelector('.rosarium-stage');
    if (!overlay || !stage) return;
    stage.dataset.phase = this.phase;

    if (this.phase === 'choosing') overlay.innerHTML = this.renderChoosing();
    else if (this.phase === 'strand') overlay.innerHTML = this.renderStrandOverlay();
    else if (this.phase === 'prayer') overlay.innerHTML = this.renderPrayer();
    else overlay.innerHTML = this.renderComplete();
  }

  renderChoosing() {
    const today = mysterySetForDate();
    const sets = Object.values(MYSTERY_SETS).map(set => `
      <button class="rosarium-set${set.id === this.setId ? ' rosarium-set-selected' : ''}${set.id === today ? ' rosarium-set-today' : ''}"
        data-set="${escapeHtml(set.id)}" aria-pressed="${set.id === this.setId}">
        <span class="rosarium-set-name">${escapeHtml(set.name.replace('The ', '').replace(' Mysteries', ''))}</span>
        <span class="rosarium-set-days font-mono">${escapeHtml(set.daysLabel)}</span>
        ${set.id === today ? '<span class="rosarium-set-flame" aria-hidden="true">✦</span>' : ''}
      </button>
    `).join('');

    const sounds = SOUNDS.map(([id, label]) => `
      <button class="rosarium-pill${this.sound === id ? ' rosarium-pill-selected' : ''}" data-sound="${id}">${label}</button>
    `).join('');

    return `
      <button class="btn-ghost rosarium-back" data-action="back"><span aria-hidden="true">←</span> Chapel</button>
      <header class="rosarium-heading">
        <p class="rosarium-kicker font-mono">THE ROSARIUM</p>
        <p class="rosarium-deck">${escapeHtml(new Date().toLocaleDateString('en-US', { weekday: 'long' }))} keeps ${escapeHtml(MYSTERY_SETS[today].name.toLowerCase())}.</p>
      </header>

      <div class="rosarium-panel">
        <div class="rosarium-sets">${sets}</div>

        <div class="rosarium-row">
          <span class="rosarium-row-label font-mono">Imagery</span>
          <button class="rosarium-pill${this.mode === 'plain' ? ' rosarium-pill-selected' : ''}" data-mode="plain" title="The icon holds the center through every prayer">Plain</button>
          <button class="rosarium-pill${this.mode === 'imagistic' ? ' rosarium-pill-selected' : ''}" data-mode="imagistic" title="Each mystery brings its painting">Imagistic</button>
          <button class="rosarium-gallery-link" data-action="gallery">view the mysteries</button>
        </div>

        <div class="rosarium-row">
          <span class="rosarium-row-label font-mono">Sound</span>
          ${sounds}
        </div>

        <div class="rosarium-row">
          <span class="rosarium-row-label font-mono">Pace</span>
          <input type="range" class="rosarium-pace" min="0.6" max="1.6" step="0.1" value="${this.pace}" aria-label="Prayer pace" />
          <span class="rosarium-pace-value font-mono">${this.pace.toFixed(1)}×</span>
          <span class="rosarium-row-label font-mono" style="margin-left:auto">Carried</span>
          <button class="rosarium-pill${this.autoAdvance ? ' rosarium-pill-selected' : ''}" data-advance="auto" title="The rosary carries you: the strand shows briefly, then the next prayer begins">Auto</button>
          <button class="rosarium-pill${!this.autoAdvance ? ' rosarium-pill-selected' : ''}" data-advance="manual" title="You advance from bead to bead yourself">By hand</button>
        </div>

        <button class="rosarium-start" data-action="start">Begin the ${escapeHtml(MYSTERY_SETS[this.setId].name)}</button>
      </div>

      ${this._galleryOpen ? this.renderGallery() : ''}
    `;
  }

  renderGallery() {
    const works = ROSARY_MYSTERY_WORKS[this.setId] || [];
    const mysteries = MYSTERY_SETS[this.setId].mysteries;
    const cards = mysteries.map((mystery, index) => {
      const pin = works[index];
      return `
        <div class="rosarium-gallery-card">
          <div class="rosarium-gallery-frame" data-gallery-slot="${index}">
            ${pin
              ? '<span class="rosarium-gallery-loading">…</span>'
              : `<span class="rosarium-gallery-absent" title="No rights-cleared painting has been found for this mystery; during its decade the icon holds the center alone.">✛<br/>the icon holds<br/>this mystery</span>`}
          </div>
          <span class="rosarium-gallery-title">${escapeHtml(mystery.title)}</span>
        </div>
      `;
    }).join('');
    // resolve after paint
    queueMicrotask(() => this._hydrateGallery());
    return `
      <div class="rosarium-gallery" role="dialog" aria-label="The mysteries of this set">
        <button class="btn-ghost rosarium-gallery-close" data-action="gallery-close">✕</button>
        <div class="rosarium-gallery-grid">${cards}</div>
      </div>
    `;
  }

  async _hydrateGallery() {
    // A gallery hydration belongs to the generation and set that
    // opened it; a re-opened gallery mints a new generation, so an
    // old hydration can never write into identically numbered slots
    const generation = this._visualGeneration;
    const setId = this.setId;
    try {
      const works = ROSARY_MYSTERY_WORKS[setId] || [];
      for (let index = 0; index < works.length; index += 1) {
        const pin = works[index];
        if (!pin) continue;
        if (generation !== this._visualGeneration) return;
        const slot = this.container.querySelector(`[data-gallery-slot="${index}"]`);
        if (!slot) continue;
        const work = await this._resolvePin(pin);
        if (generation !== this._visualGeneration || setId !== this.setId) return;
        if (!work || !this._galleryOpen) continue;
        const { mountSacredImage } = await import('../content/chapel/imagery/sacred-image.js');
        await mountSacredImage(slot, work, {
          stillAlive: () => generation === this._visualGeneration && this._galleryOpen
        });
      }
    } catch (e) {
      console.warn('[Rosarium] Gallery unavailable:', e);
    }
  }

  renderStrandOverlay() {
    const step = this.compiled.steps[this.stepIndex + 1] || null;
    const where = this._whereLine();
    return `
      ${this._renderQuietExit()}
      <button class="rosarium-advance-surface" data-action="advance" aria-label="Advance to the next prayer">
        <span class="rosarium-where">${escapeHtml(where)}</span>
        <span class="rosarium-advance-hint">${step ? 'advance ›' : ''}</span>
      </button>
    `;
  }

  /** A small constant way out — top right, present, never loud. */
  _renderQuietExit() {
    return `
      <button class="rosarium-quiet-exit" data-action="exit-chapel"
        title="Leave the Rosary and return to the Chapel"
        aria-label="Return to the Chapel">✛ Chapel</button>
    `;
  }

  renderPrayer() {
    const step = this.compiled.steps[this.stepIndex];
    const decade = step.state.decade;
    const artSlot = `<div class="rosarium-art" data-art-slot></div>`;
    return `
      ${this._renderQuietExit()}
      <div class="rosarium-prayer${this.autoAdvance ? '' : ' rosarium-prayer-unhurried'}" data-action="${this.autoAdvance ? '' : 'prayer-done'}">
        ${artSlot}
        <p class="rosarium-prayer-text">${escapeHtml(step.text)}</p>
        ${this.autoAdvance ? '' : '<span class="rosarium-prayer-hint">click when prayed ›</span>'}
      </div>
    `;
  }

  renderComplete() {
    return `
      <div class="rosarium-complete">
        <p class="rosarium-where">The Rosary is complete.</p>
        <button class="rosarium-start" data-action="back">Return to the Chapel</button>
      </div>
    `;
  }

  _whereLine() {
    const next = this.compiled?.steps[this.stepIndex + 1];
    if (!next) return 'The Rosary is complete.';
    const state = next.state;
    if (state.phase === 'mystery') {
      return `${MYSTERY_SETS[this.setId].name} — the ${['first', 'second', 'third', 'fourth', 'fifth'][state.decade - 1]} mystery`;
    }
    if (state.repetition) {
      return `${this._nthWord(state.repetition)} Hail Mary${state.decade ? ` · ${this._nthWord(state.decade)} mystery` : ''}`;
    }
    const names = {
      'sign-opening': 'The Sign of the Cross', creed: 'The Apostles’ Creed',
      'opening-our-father': 'The Our Father', 'opening-glory-be': 'The Glory Be',
      'hail-holy-queen': 'The Hail, Holy Queen', 'closing-prayer': 'The closing prayer',
      'sign-closing': 'The Sign of the Cross'
    };
    const baseId = next.id.replace(/-\d+$/, '');
    if (names[baseId]) return names[baseId];
    if (/our-father/.test(baseId)) return `The Our Father · ${this._nthWord(state.decade)} mystery`;
    if (/glory-be/.test(baseId)) return `The Glory Be · ${this._nthWord(state.decade)} mystery`;
    if (/fatima/.test(baseId)) return `The Fatima Prayer · ${this._nthWord(state.decade)} mystery`;
    return '';
  }

  _nthWord(n) {
    return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n - 1] || `${n}th`;
  }

  // ── Prayer flow ────────────────────────────────────────────

  start() {
    this._beginVisualGeneration();
    this.compiled = compileLiturgy(buildRosaryDefinition(this.setId), { paceMultiplier: this.pace });
    this.stepIndex = -1;
    this.strand.reset();
    this.phase = 'strand';
    this.renderOverlay();
    this._startSound();
    // Imagistic: warm every mystery painting now, so no decade waits
    // on a museum API mid-prayer
    if (this.mode === 'imagistic') this._prewarmMysteryWorks();
    if (this.autoAdvance) this._queueAutoAdvance();
  }

  /**
   * Begin a new visual generation: abort all in-flight image/audio
   * work and mint the token every subsequent async result must match.
   */
  _beginVisualGeneration() {
    this._visualGeneration += 1;
    try { this._visualAbort?.abort(); } catch { /* already dead */ }
    this._visualAbort = new AbortController();
    return this._visualGeneration;
  }

  /**
   * Resolve one mystery pin to a displayable work. Museum pins go
   * through the imagery service; `source: 'commons'` pins carry their
   * verified data baked (no per-object API to call at prayer time).
   */
  async _resolvePin(pin) {
    if (!pin) return null;
    if (pin.source === 'commons') {
      return {
        title: pin.title,
        artist: pin.artist,
        imageUrl: pin.imageUrl,
        attribution: pin.attribution,
        sourceUrl: pin.sourceUrl
      };
    }
    const { resolveCollection } = await import('../content/atrium/imagery/service.js');
    const resolved = await resolveCollection(
      { works: [pin] },
      { signal: this._visualAbort?.signal }
    );
    return resolved[0] || null;
  }

  async _prewarmMysteryWorks() {
    const generation = this._visualGeneration;
    const setId = this.setId;
    try {
      for (let decade = 1; decade <= 5; decade += 1) {
        if (generation !== this._visualGeneration) return;
        const pin = mysteryWork(setId, decade);
        const key = `${setId}:${decade}`;
        if (!pin) { this._decadeWorkCache.set(key, null); continue; }
        if (this._decadeWorkCache.has(key)) continue;
        const work = await this._resolvePin(pin);
        if (generation !== this._visualGeneration) return;
        this._decadeWorkCache.set(key, work);
        // Also warm the browser's image cache
        if (work?.imageUrl) { const img = new Image(); img.src = work.imageUrl; }
      }
    } catch (e) {
      console.warn('[Rosarium] Prewarm unavailable:', e);
    }
  }

  advance() {
    if (this.phase !== 'strand') return;
    clearTimeout(this._strandTimer);
    this.stepIndex += 1;
    const step = this.compiled.steps[this.stepIndex];
    if (!step) { this.finish(); return; }

    this.phase = 'prayer';
    this.strand.setBead(step.state.bead);
    this.renderOverlay();
    this._mountPrayerArt(step);

    // In BOTH modes the prayer holds a floor: auto advances after the
    // full recitation length; Unhurried accepts the click only after
    // a brief settling (a tap cannot skip the prayer it just opened)
    clearTimeout(this._prayerTimer);
    this._prayerOpenedAt = Date.now();
    if (this.autoAdvance) {
      this._prayerTimer = setTimeout(() => this.returnToStrand(), step.durationMs);
    }
  }

  /** Unhurried: the reader says when the prayer is prayed. */
  prayerDone() {
    if (this.phase !== 'prayer' || this.autoAdvance) return;
    // The floor: an accidental double-tap must not consume a prayer
    if (Date.now() - (this._prayerOpenedAt || 0) < 1200) return;
    this.returnToStrand();
  }

  returnToStrand() {
    if (this.phase !== 'prayer') return;
    clearTimeout(this._prayerTimer);
    const done = this.stepIndex >= this.compiled.steps.length - 1;
    this.phase = done ? 'complete' : 'strand';
    this.renderOverlay();
    if (done) { this._stopSound(); return; }
    if (this.autoAdvance) this._queueAutoAdvance();
  }

  _queueAutoAdvance() {
    clearTimeout(this._strandTimer);
    // The between-breath: the strand shows briefly, then carries on
    this._strandTimer = setTimeout(() => this.advance(), 2500);
  }

  finish() {
    this.phase = 'complete';
    this._stopSound();
    this.renderOverlay();
  }

  async _mountPrayerArt(step) {
    const slot = this.container.querySelector('[data-art-slot]');
    if (!slot) return;
    const decade = step.state.decade;
    // The moment that authorizes this mount:
    const generation = this._visualGeneration;
    const setId = this.setId;
    const stepId = step.id;

    // ONE slot: the decade's painting in Imagistic (when pinned),
    // the icon otherwise. Never both.
    if (this.mode === 'imagistic' && decade) {
      const pin = mysteryWork(setId, decade);
      if (pin) {
        const key = `${setId}:${decade}`;
        let work = this._decadeWorkCache.get(key);
        if (work === undefined) {
          try {
            work = await this._resolvePin(pin);
          } catch { work = null; }
          // A stale generation must not even poison the cache under
          // a key another set could share the shape of
          if (generation === this._visualGeneration) {
            this._decadeWorkCache.set(key, work);
          }
        }
        // The devotional moment must still exist: same generation,
        // same set, same step, still praying
        const liveSlot = this.container.querySelector('[data-art-slot]');
        const momentStands = () => generation === this._visualGeneration
          && setId === this.setId
          && this.phase === 'prayer'
          && this.compiled?.steps[this.stepIndex]?.id === stepId;
        if (work && liveSlot && momentStands()) {
          const { mountSacredImage } = await import('../content/chapel/imagery/sacred-image.js');
          await mountSacredImage(liveSlot, work, { stillAlive: momentStands });
          return;
        }
        if (work || !momentStands()) return; // never show a stale image
      }
    }
    const icon = findChapelIcon(this.iconId) || CHAPEL_ICONS[CHAPEL_ICON_DEFAULTS.marian];
    const { mountSacredImage } = await import('../content/chapel/imagery/sacred-image.js');
    await mountSacredImage(slot, {
      imageUrl: icon.image, title: icon.name, attribution: icon.attribution
    }, {
      stillAlive: () => generation === this._visualGeneration && this.phase === 'prayer'
    });
  }

  // ── Sound ─────────────────────────────────────────────────

  async _startSound() {
    if (this.sound === 'none') return;
    // Audio belongs to a devotional moment exactly as imagery does:
    // if the user leaves while the engine initializes, the chant must
    // not begin after departure. _stopSound invalidates pending starts.
    const generation = (this._soundGeneration = (this._soundGeneration || 0) + 1);
    try {
      const engine = window.rise?.audioEngine;
      if (!engine) return;
      if (!engine.isInitialized) await engine.init?.();
      if (generation !== this._soundGeneration) return;
      // The provenance contract: show each recording's credit as it
      // begins — quiet, factual, per the chant registry's promise
      engine.onChantTrackChange = (chant) => {
        if (generation !== this._soundGeneration) return;
        const line = this.container.querySelector('.chant-credit');
        if (!line) return;
        line.textContent = chant.attribution || `${chant.title} — ${chant.performer}`;
        line.hidden = false;
      };
      engine.stopAmbient?.();
      engine.startSoundscape?.(this.sound);
    } catch (e) {
      console.warn('[Rosarium] Sound unavailable:', e);
    }
  }

  _stopSound() {
    this._soundGeneration = (this._soundGeneration || 0) + 1;
    const engine = window.rise?.audioEngine;
    if (engine) engine.onChantTrackChange = null;
    const line = this.container.querySelector('.chant-credit');
    if (line) line.hidden = true;
    try { engine?.stopSoundscape?.(); } catch { /* released */ }
  }

  // ── Events / wayfinding ───────────────────────────────────

  attachEvents() {
    const { signal } = this._abort;
    this.container.addEventListener('click', event => this.handleClick(event), { signal });
    this._keyHandler = event => {
      if (event.code === 'Space' || event.key === 'ArrowRight') {
        if (this.phase === 'strand') { event.preventDefault(); this.advance(); }
        else if (this.phase === 'prayer' && !this.autoAdvance) { event.preventDefault(); this.prayerDone(); }
      }
    };
  }

  handleClick(event) {
    const target = event.target.closest('[data-action], [data-set], [data-mode], [data-sound], [data-advance]');
    if (!target || !this.container.contains(target)) return;
    window.rise?.audioEngine?.playClick?.();

    if (target.dataset.set) {
      this.setId = target.dataset.set;
      this._beginVisualGeneration(); // a new set is a new devotional moment
      this.renderOverlay();
      return;
    }
    if (target.dataset.mode) {
      this.mode = target.dataset.mode === 'imagistic' ? 'imagistic' : 'plain';
      this._setPref(MODE_KEY, this.mode);
      this.renderOverlay();
      return;
    }
    if (target.dataset.sound) { this.sound = target.dataset.sound; this._setPref(SOUND_KEY, this.sound); this.renderOverlay(); return; }
    if (target.dataset.advance) {
      this.autoAdvance = target.dataset.advance === 'auto';
      this._setPref(ADVANCE_KEY, this.autoAdvance ? 'auto' : 'manual');
      this.renderOverlay();
      return;
    }

    switch (target.dataset.action) {
      case 'back': this._exitToChapel(); break;
      case 'exit-chapel': this._exitToChapel(); break;
      case 'start': this.start(); break;
      case 'advance': this.advance(); break;
      case 'prayer-done': this.prayerDone(); break;
      case 'gallery':
        this._beginVisualGeneration(); // each opening is its own moment
        this._galleryOpen = true;
        this.renderOverlay();
        break;
      case 'gallery-close':
        this._beginVisualGeneration(); // pending hydrations die with the view
        this._galleryOpen = false;
        this.renderOverlay();
        break;
      default: break;
    }
  }

  /** Range input (pace) — change events */
  handleInput(event) {
    if (event.target.classList?.contains('rosarium-pace')) {
      this.pace = Number(event.target.value) || 1;
      const label = this.container.querySelector('.rosarium-pace-value');
      if (label) label.textContent = `${this.pace.toFixed(1)}×`;
    }
  }

  /**
   * Escape walks back one register at a time:
   * prayer → strand → choosing → Chapel.
   * Consumed (return true) unless already at choosing.
   */
  handleEscape() {
    if (this.phase === 'prayer') { this.returnToStrand(); return true; }
    if (this.phase === 'strand' || this.phase === 'complete') {
      clearTimeout(this._strandTimer);
      clearTimeout(this._prayerTimer);
      this._beginVisualGeneration(); // the devotion ended; its work dies
      this._stopSound();
      this.phase = 'choosing';
      this.strand.reset();
      this.renderOverlay();
      return true;
    }
    // choosing → back to the Chapel (the room's true parent), not the
    // portal the router would default to
    this._exitToChapel();
    return true;
  }

  _exitToChapel() {
    clearTimeout(this._strandTimer);
    clearTimeout(this._prayerTimer);
    this._beginVisualGeneration(); // departure invalidates all pending work
    this._stopSound();
    this.onNavigate('chapel');
  }

  activate() {
    document.addEventListener('keydown', this._keyHandler);
    // One listener for the component's life — re-activation must not
    // stack another (the abort signal only fires at destroy)
    if (!this._inputHandlerBound) {
      this._inputHandlerBound = true;
      this.container.addEventListener('input', event => this.handleInput(event), { signal: this._abort.signal });
    }
  }

  deactivate() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  destroy() {
    this.deactivate();
    clearTimeout(this._strandTimer);
    clearTimeout(this._prayerTimer);
    this._beginVisualGeneration();
    this._stopSound();
    this._abort.abort();
    this.container.innerHTML = '';
  }
}
