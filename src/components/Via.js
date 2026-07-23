/**
 * The Via — the Stations of the Cross room.
 *
 * The second liturgy room, on the Rosarium's proven pattern but with
 * the Stations' own nature: here the PAINTING is the room. Each
 * station holds Tiepolo's canvas large while its phases pass beneath
 * — announcement, the versicle and response, Liguori's meditation,
 * silence — then the nave strip (fourteen small frames, the walked
 * ones warm) carries you to the next.
 *
 * Progression is manual by default (spec §5: the reader moves between
 * stations deliberately, as one walks a nave); Carried mode times the
 * phases for those who want to be borne along.
 *
 * Fixed forms are fixed: the steps come compiled from the
 * LiturgyRunner; this room decides nothing.
 */

import { compileLiturgy } from '../core/liturgy-runner.js';
import { buildStationsDefinition } from '../content/chapel/liturgy/stations-liturgy.js';
import { STATIONS, STATIONS_ATTRIBUTION, stationByNumber } from '../content/chapel/liturgy/stations.js';
import { escapeHtml } from '../core/sanitize.js';

const ADVANCE_KEY = 'rise_via_advance_v1';
const SOUND_KEY = 'rise_via_sound_v1';

const SOUNDS = Object.freeze([
  ['none', 'Silence'],
  ['chant-gregorian', 'Gregorian'],
  ['chant-znamenny', 'Znamenny']
]);

export class Via {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});

    this.autoAdvance = this._pref(ADVANCE_KEY) === 'auto';
    this.sound = SOUNDS.some(([id]) => id === this._pref(SOUND_KEY)) ? this._pref(SOUND_KEY) : 'none';

    this.phase = 'choosing';   // 'choosing' | 'walking' | 'complete'
    this.compiled = null;
    this.stepIndex = -1;
    this._timer = null;
    this._abort = new AbortController();

    this.render();
    this.attachEvents();
    this._prewarmImages();
  }

  _pref(key) { try { return localStorage.getItem(key); } catch { return null; } }
  _setPref(key, value) { try { localStorage.setItem(key, value); } catch { /* this visit */ } }

  _prewarmImages() {
    for (const station of STATIONS) {
      const img = new Image();
      img.src = station.image;
    }
  }

  // ── Rendering ─────────────────────────────────────────────

  /**
   * Reverent degradation for stage imagery: a failed painting must
   * become absence — the meditation text alone — never a browser
   * broken-image glyph. Attached after each stage render.
   */
  _armImageAbsence(root) {
    for (const img of root.querySelectorAll('.via-art img, .via-nave-frame img')) {
      img.addEventListener('error', () => {
        const frame = img.closest('.via-art, .via-nave-frame');
        if (frame) frame.remove(); else img.remove();
      }, { once: true });
    }
  }

  render() {
    this.container.innerHTML = `
      <main class="via" aria-label="The Stations of the Cross">
        <div class="via-stage" data-phase="${this.phase}"></div>
        <p class="chant-credit font-mono" aria-live="polite" hidden></p>
      </main>
    `;
    this.renderStage();
  }

  renderStage() {
    const stage = this.container.querySelector('.via-stage');
    if (!stage) return;
    stage.dataset.phase = this.phase;
    if (this.phase === 'choosing') stage.innerHTML = this.renderChoosing();
    else if (this.phase === 'walking') stage.innerHTML = this.renderStation();
    else stage.innerHTML = this.renderComplete();
    this._armImageAbsence(stage);
  }

  renderChoosing() {
    const frames = STATIONS.map(station => `
      <div class="via-nave-frame" title="${escapeHtml(`${station.number}. ${station.title}`)}">
        <img src="${escapeHtml(station.image)}" alt="" loading="lazy" decoding="async" />
      </div>
    `).join('');
    const sounds = SOUNDS.map(([id, label]) => `
      <button class="via-pill${this.sound === id ? ' via-pill-selected' : ''}" data-sound="${id}">${label}</button>
    `).join('');
    return `
      <button class="btn-ghost via-back" data-action="back"><span aria-hidden="true">←</span> Chapel</button>
      <header class="via-heading">
        <p class="via-kicker font-mono">THE STATIONS OF THE CROSS</p>
        <p class="via-deck">Fourteen stations, walked as a nave is walked. Tiepolo's Via Crucis, San Polo, Venice.</p>
      </header>
      <div class="via-nave">${frames}</div>
      <div class="via-panel">
        <div class="via-row">
          <span class="via-row-label font-mono">Sound</span>
          ${sounds}
          <span class="via-row-label font-mono" style="margin-left:auto">Walked</span>
          <button class="via-pill${!this.autoAdvance ? ' via-pill-selected' : ''}" data-advance="manual" title="You move between phases and stations yourself">By hand</button>
          <button class="via-pill${this.autoAdvance ? ' via-pill-selected' : ''}" data-advance="auto" title="The way carries you at meditation pace">Carried</button>
        </div>
        <button class="via-start" data-action="start">Begin the Way of the Cross</button>
        <p class="via-attribution font-mono">${escapeHtml(STATIONS_ATTRIBUTION)}</p>
      </div>
    `;
  }

  renderStation() {
    const step = this.compiled.steps[this.stepIndex];
    const state = step.state;
    const station = state.station ? stationByNumber(state.station) : null;
    const isSilence = state.phase === 'silence';

    return `
      ${this._renderQuietExit()}
      ${this._renderNaveStrip(state.station)}
      <div class="via-station${this.autoAdvance ? '' : ' via-station-byhand'}" data-action="${this.autoAdvance ? '' : 'advance'}">
        ${station ? `
          <div class="via-art${isSilence ? ' via-art-dimmed' : ''}">
            <img src="${escapeHtml(station.image)}" alt="${escapeHtml(station.title)}"
              title="${escapeHtml(`Station ${station.number}: ${station.title} — Giandomenico Tiepolo (photograph © Didier Descouens, CC BY-SA 4.0)`)}" />
          </div>
        ` : ''}
        <p class="via-text via-text-${escapeHtml(state.phase)}">${escapeHtml(step.text).replace(/\n/g, '<br/>')}</p>
        ${this.autoAdvance ? '' : `<span class="via-hint">${isSilence ? 'be still · then walk on ›' : 'walk on ›'}</span>`}
      </div>
    `;
  }

  _renderNaveStrip(currentStation) {
    return `
      <div class="via-strip" aria-hidden="true">
        ${STATIONS.map(station => `
          <span class="via-strip-mark${station.number === currentStation ? ' via-strip-here'
            : station.number < (currentStation ?? 0) ? ' via-strip-walked' : ''}">${station.number === currentStation ? '✛' : '·'}</span>
        `).join('')}
      </div>
    `;
  }

  _renderQuietExit() {
    return `
      <button class="via-quiet-exit" data-action="exit-chapel"
        title="Leave the Way and return to the Chapel"
        aria-label="Return to the Chapel">✛ Chapel</button>
    `;
  }

  renderComplete() {
    return `
      <div class="via-complete">
        <p class="via-text">The Way of the Cross is complete.</p>
        <button class="via-start" data-action="back">Return to the Chapel</button>
      </div>
    `;
  }

  // ── The walk ──────────────────────────────────────────────

  start() {
    this.compiled = compileLiturgy(buildStationsDefinition());
    this.stepIndex = -1;
    this.phase = 'walking';
    this._startSound();
    this.advance();
  }

  advance() {
    if (this.phase !== 'walking' && this.phase !== 'choosing') return;
    clearTimeout(this._timer);
    this.stepIndex += 1;
    const step = this.compiled.steps[this.stepIndex];
    if (!step) { this.finish(); return; }
    this.phase = 'walking';
    this.renderStage();
    if (this.autoAdvance) {
      this._timer = setTimeout(() => this.advance(), step.durationMs);
    }
  }

  finish() {
    this.phase = 'complete';
    this._stopSound();
    this.renderStage();
  }

  // ── Sound ─────────────────────────────────────────────────

  async _startSound() {
    if (this.sound === 'none') return;
    // The walk that authorized this sound must still be under way
    // when the engine finishes initializing — never chant after exit
    const generation = (this._soundGeneration = (this._soundGeneration || 0) + 1);
    try {
      const engine = window.rise?.audioEngine;
      if (!engine) return;
      if (!engine.isInitialized) await engine.init?.();
      if (generation !== this._soundGeneration) return;
      // The provenance contract: each recording's credit, as it begins
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
      console.warn('[Via] Sound unavailable:', e);
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
      if ((event.code === 'Space' || event.key === 'ArrowRight')
        && this.phase === 'walking' && !this.autoAdvance) {
        event.preventDefault();
        this.advance();
      }
    };
  }

  handleClick(event) {
    const target = event.target.closest('[data-action], [data-sound], [data-advance]');
    if (!target || !this.container.contains(target)) return;
    window.rise?.audioEngine?.playClick?.();

    if (target.dataset.sound) { this.sound = target.dataset.sound; this._setPref(SOUND_KEY, this.sound); this.renderStage(); return; }
    if (target.dataset.advance) {
      this.autoAdvance = target.dataset.advance === 'auto';
      this._setPref(ADVANCE_KEY, this.autoAdvance ? 'auto' : 'manual');
      this.renderStage();
      return;
    }
    switch (target.dataset.action) {
      case 'back': this._exitToChapel(); break;
      case 'exit-chapel': this._exitToChapel(); break;
      case 'start': this.start(); break;
      case 'advance': this.advance(); break;
      default: break;
    }
  }

  /** Escape: walking → choosing → Chapel. */
  handleEscape() {
    if (this.phase === 'walking' || this.phase === 'complete') {
      clearTimeout(this._timer);
      this._stopSound();
      this.phase = 'choosing';
      this.renderStage();
      return true;
    }
    this._exitToChapel();
    return true;
  }

  _exitToChapel() {
    clearTimeout(this._timer);
    this._stopSound();
    this.onNavigate('chapel');
  }

  activate() { document.addEventListener('keydown', this._keyHandler); }
  deactivate() { document.removeEventListener('keydown', this._keyHandler); }

  destroy() {
    this.deactivate();
    clearTimeout(this._timer);
    this._stopSound();
    this._abort.abort();
    this.container.innerHTML = '';
  }
}
