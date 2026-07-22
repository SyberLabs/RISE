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
    try {
      const { resolveCollection } = await import('../content/atrium/imagery/service.js');
      const works = ROSARY_MYSTERY_WORKS[this.setId] || [];
      for (let index = 0; index < works.length; index += 1) {
        const pin = works[index];
        if (!pin) continue;
        const slot = this.container.querySelector(`[data-gallery-slot="${index}"]`);
        if (!slot) continue;
        const resolved = await resolveCollection({ works: [pin] });
        const work = resolved[0];
        if (!work || !this.container.isConnected) continue;
        slot.innerHTML = `<img src="${escapeHtml(work.imageUrl)}" alt="${escapeHtml(work.title)}" title="${escapeHtml(`${work.title} — ${work.artist}`)}" />`;
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

  async _prewarmMysteryWorks() {
    try {
      const { resolveCollection } = await import('../content/atrium/imagery/service.js');
      for (let decade = 1; decade <= 5; decade += 1) {
        const pin = mysteryWork(this.setId, decade);
        const key = `${this.setId}:${decade}`;
        if (!pin) { this._decadeWorkCache.set(key, null); continue; }
        if (this._decadeWorkCache.has(key)) continue;
        const resolved = await resolveCollection({ works: [pin] });
        const work = resolved[0] || null;
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

    if (this.autoAdvance || true) {
      // In BOTH modes the prayer holds at least its recitation length;
      // Unhurried simply also waits for the click after that.
      clearTimeout(this._prayerTimer);
      if (this.autoAdvance) {
        this._prayerTimer = setTimeout(() => this.returnToStrand(), step.durationMs);
      }
    }
  }

  /** Unhurried: the reader says when the prayer is prayed. */
  prayerDone() {
    if (this.phase !== 'prayer' || this.autoAdvance) return;
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

    // ONE slot: the decade's painting in Imagistic (when pinned),
    // the icon otherwise. Never both.
    if (this.mode === 'imagistic' && decade) {
      const pin = mysteryWork(this.setId, decade);
      if (pin) {
        const key = `${this.setId}:${decade}`;
        let work = this._decadeWorkCache.get(key);
        if (work === undefined) {
          try {
            const { resolveCollection } = await import('../content/atrium/imagery/service.js');
            const resolved = await resolveCollection({ works: [pin] });
            work = resolved[0] || null;
          } catch { work = null; }
          this._decadeWorkCache.set(key, work);
        }
        // Re-query: the overlay may have re-rendered during the await
        const liveSlot = this.container.querySelector('[data-art-slot]');
        if (work && liveSlot && this.phase === 'prayer'
          && this.compiled.steps[this.stepIndex]?.state.decade === decade) {
          liveSlot.innerHTML = `<img src="${escapeHtml(work.imageUrl)}" alt="${escapeHtml(work.title)}" title="${escapeHtml(`${work.title} — ${work.artist}`)}" />`;
          return;
        }
        if (work) return; // painting exists but the moment passed — show nothing stale
      }
    }
    const icon = findChapelIcon(this.iconId) || CHAPEL_ICONS[CHAPEL_ICON_DEFAULTS.marian];
    slot.innerHTML = `<img src="${escapeHtml(icon.image)}" alt="${escapeHtml(icon.name)}" title="${escapeHtml(icon.attribution)}" />`;
  }

  // ── Sound ─────────────────────────────────────────────────

  async _startSound() {
    if (this.sound === 'none') return;
    try {
      const engine = window.rise?.audioEngine;
      if (!engine) return;
      if (!engine.isInitialized) await engine.init?.();
      engine.stopAmbient?.();
      engine.startSoundscape?.(this.sound);
    } catch (e) {
      console.warn('[Rosarium] Sound unavailable:', e);
    }
  }

  _stopSound() {
    try { window.rise?.audioEngine?.stopSoundscape?.(); } catch { /* released */ }
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

    if (target.dataset.set) { this.setId = target.dataset.set; this.renderOverlay(); return; }
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
      case 'gallery': this._galleryOpen = true; this.renderOverlay(); break;
      case 'gallery-close': this._galleryOpen = false; this.renderOverlay(); break;
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
    this._stopSound();
    this.onNavigate('chapel');
  }

  activate() {
    document.addEventListener('keydown', this._keyHandler);
    this.container.addEventListener('input', event => this.handleInput(event), { signal: this._abort.signal });
  }

  deactivate() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  destroy() {
    this.deactivate();
    clearTimeout(this._strandTimer);
    clearTimeout(this._prayerTimer);
    this._stopSound();
    this._abort.abort();
    this.container.innerHTML = '';
  }
}
