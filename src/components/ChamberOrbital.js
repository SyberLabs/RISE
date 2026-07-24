/**
 * Chamber Orbital Component
 * Fidget spinner interface for session configuration
 *
 * Design: 3 orbit nodes (Visual, Audio, Temporal) around central TEXT
 * - Each orbit shows collapsed state
 * - Click to expand modal with full controls
 * - Drag handles to rotate entire structure (aesthetic only)
 */

import { VisualInterlocutionPanel } from './VisualInterlocutionPanel.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { namingModal } from './NamingModal.js';
import { escapeHtml } from '../core/sanitize.js';
import {
  hasVisualSelectionFields,
  normalizeVisualSelection
} from '../core/visual-selection.js';
import {
  VISUAL_PRESENCE_DEFAULT_MS,
  normalizeVisualPresence
} from '../core/visual-presence.js';
import './VisualInterlocutionPanel.css';

// Last-used session settings survive across chamber visits (the orbital
// instance itself is destroyed whenever a session runs in the shared view)
const ORBITAL_PREFS_KEY = 'rise_orbital_prefs_v1';
// The loaded text lives under its own key, apart from the settings:
// texts can be book-sized, and a quota failure on one must never cost
// the other. Prefs shed only the focal image; text sheds only itself.
const ORBITAL_TEXT_KEY = 'rise_orbital_text_v1';
// `personal` is a Workshop sentinel and `drift` is a legacy engine preset.
// Keep both valid even though the orbital currently exposes four choices.
const AUDIO_PRESET_IDS = new Set([
  'silent', 'focus', 'deep', 'drift', 'gateway', 'personal'
]);

/**
 * Factory defaults for the orbital — one source of truth for the
 * constructor and the Reset button.
 */
function createDefaultConfig() {
  return {
    text: null,
    textSource: null, // 'drop', 'paste', 'library', 'starter'
    // Launch origin (wayfinding): { view, icon, name } set by app.js
    // launch handlers (SOL / Vault / Library); null for plain sessions
    origin: null,
    // Optional canonical multi-source payload and bounded provenance. Atrium
    // uses these to keep passage boundaries intact through configuration.
    sources: null,
    provenance: null,

    // Visual orbit
    visualInterlocution: {
      // Top-level mode: 'off' | 'focals' | 'attractor' | 'genesis' | 'interlocution'
      visualMode: 'off',

      // Focals config (persistent gentle focal point)
      focals: {
        type: 'standard',
        standardGlyph: 'breath',
        personalImage: null
      },

      // Attractor config (persistent strange-attractor field)
      attractor: {
        system: 'aizawa',
        palette: 'white',
        form: 'mirror'
      },

      // Genesis config (continuously growing Klee composition)
      genesis: {
        preset: 'random',
        glass: true
      },

      // Living Text (semantic hue/glow on the text stream)
      livingText: {
        enabled: false
      },

      // Interlocution config (probabilistic interrupts).
      // Nothing pre-checked: visual packages arrive only through explicit
      // configs (Vault archetypes, SOL sequences) — never implied by a text.
      interlocution: {
        sourceFamily: 'procedural',
        procedural: [],
        sourced: [],
        frequency: 0.2,
        duration: VISUAL_PRESENCE_DEFAULT_MS,
        renderLanguage: 'native',
        presentation: 'full-frame',
        streamGlass: true,
        kleePreset: 'random',
        harmonographClimate: 'auto',
        blueprintClimate: 'auto',
        responsive: false,
        responsiveMood: true,
        responsiveRhythm: true
      }
    },

    // Audio orbit
    soundscape: 'none',
    audioPreset: 'silent',
    entrainmentMode: 'binaural',
    entrainmentWaveform: 'sine',
    voiceEnabled: false,
    voiceId: null,
    selectedSwellId: null,

    // Temporal orbit
    wpm: 200,
    curve: 'flat',
    chunkMode: 'word'
  };
}

export class ChamberOrbital {
  constructor(container, options = {}) {
    console.log('[ChamberOrbital] Constructor called', container, options);
    this.container = container;
    this.onBeginSession = options.onBeginSession || (() => { });
    this.onNavigate = options.onNavigate || (() => { });
    this.visualConsentScope = crypto.randomUUID();

    // Session configuration state (factory defaults; see createDefaultConfig)
    this.config = createDefaultConfig();

    // Restore the user's last-used settings (persisted at Begin) so
    // returning from a session never resets the controls to defaults
    this._applySavedPrefs();

    // Restore the loaded text too — without it the saved visual and
    // audio settings are stranded behind an empty text card after a
    // refresh. A launch that carries fresh text (SOL, Vault, Library)
    // overwrites this via loadText immediately after construction.
    this._applySavedText();

    // Active modal
    this.activeModal = null;

    // Visual interlocution panel instance
    this.viPanel = null;

    // Persist at every exit point — not only at Begin. Otherwise settings
    // changed after the last session (e.g. Genesis -> Focals) are lost on
    // refresh and the stale last-used state resurrects.
    this._boundPersist = () => this._persistPrefs();
    window.addEventListener('beforeunload', this._boundPersist);

    this.render();
    this.attachEvents();
    // A restored origin needs its chip painted (loadText does this
    // itself; the constructor path must match)
    if (this.config.origin) this.updateOriginChip();
  }

  /**
   * Hydrate config from the last-used preferences — the dials the user
   * set. The loaded text/source/origin live under their own key (see
   * _applySavedText). Nested visual config merges over defaults so
   * newer fields keep their defaults when the saved shape predates them.
   */
  _applySavedPrefs() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(ORBITAL_PREFS_KEY));
    } catch (e) {
      console.warn('[ChamberOrbital] Could not read saved prefs:', e);
    }
    if (!saved) return;

    const scalarKeys = ['wpm', 'curve', 'chunkMode', 'soundscape', 'audioPreset',
      'entrainmentMode', 'entrainmentWaveform', 'voiceEnabled', 'voiceId', 'selectedSwellId'];
    for (const key of scalarKeys) {
      if (saved[key] !== undefined) this.config[key] = saved[key];
    }

    // TEMPORAL CONTRACT MIGRATION: WPM saved before the honest-pacing
    // contract was calibrated under a hidden 1.4375× slowdown. Scale
    // once so the delivered feel is unchanged — only the label moves.
    if (!saved.paceV2 && Number.isFinite(this.config.wpm)) {
      this.config.wpm = Math.max(100, Math.min(500,
        Math.round((this.config.wpm * 1.4375) / 10) * 10));
    }
    this._sanitizeChapelExclusives();
    this._normalizeAudioExclusivity();

    const vi = saved.visualInterlocution;
    if (vi) {
      const defaults = this.config.visualInterlocution;
      this.config.visualInterlocution = {
        ...defaults,
        ...vi,
        focals: { ...defaults.focals, ...(vi.focals || {}) },
        attractor: { ...defaults.attractor, ...(vi.attractor || {}) },
        genesis: { ...defaults.genesis, ...(vi.genesis || {}) },
        livingText: { ...defaults.livingText, ...(vi.livingText || {}) },
        interlocution: {
          ...defaults.interlocution,
          ...(vi.interlocution || {}),
          duration: normalizeVisualPresence(
            vi.interlocution?.duration ?? defaults.interlocution.duration
          ),
          ...normalizeVisualSelection(vi.interlocution || defaults.interlocution)
        }
      };
    }
  }

  /** A Chapel launch, known by its provenance. */
  isChapelSession() {
    return this.config.provenance?.kind === 'chapel-book';
  }

  /**
   * Chapel-exclusive settings must not leak into plain sessions: a
   * chant bed persisted from a Chapel reading falls back to silence
   * when the next session is not a Chapel launch — the same scoping
   * contract as chapel-* imagery.
   */
  _sanitizeChapelExclusives() {
    if (!this.isChapelSession() && String(this.config.soundscape || '').startsWith('chant-')) {
      this.config.soundscape = 'none';
    }
  }

  /**
   * Reset: restore factory-default settings. The loaded text, its source,
   * and the origin chip survive — this is settings amnesia, not session
   * amnesia (the text card has its own ✕ for that).
   */
  resetPrefs() {
    try {
      localStorage.removeItem(ORBITAL_PREFS_KEY);
    } catch (e) {
      console.warn('[ChamberOrbital] Could not clear prefs:', e);
    }

    const { text, textSource, origin, sources, provenance } = this.config;
    this.config = { ...createDefaultConfig(), text, textSource, origin, sources, provenance };

    // The visual panel holds its own copy of the config — rebuild it
    if (this.viPanel) {
      this.viPanel.destroy();
      this.viPanel = null;
    }
    this.render();
    this.attachEvents();
    this.syncUIWithConfig();
    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('audio');
    this.updateOrbitStatus('visual');

    if (window.rise?.showToast) {
      // Name what SURVIVED, not only what changed. Reset clearing every
      // dial while the text stays put reads as a half-finished reset
      // unless the boundary is stated at the moment it is crossed.
      window.rise.showToast(
        this.config.text
          ? 'Settings restored — the loaded text stays'
          : 'Settings restored to defaults'
      );
    }
  }

  _applySavedText() {
    try {
      const saved = JSON.parse(localStorage.getItem(ORBITAL_TEXT_KEY));
      const savedSources = Array.isArray(saved?.sources) ? saved.sources.slice(0, 64) : null;
      if (saved?.text || savedSources?.length) {
        this.config.sources = savedSources;
        this.config.text = saved.text || savedSources
          .map(source => typeof source?.data === 'string' ? source.data : '')
          .filter(Boolean)
          .join('\n\n');
        this.config.textSource = saved.textSource || null;
        this.config.origin = saved.origin || null;
        this.config.provenance = saved.provenance || null;
      }
    } catch (e) {
      console.warn('[ChamberOrbital] Could not read saved text:', e);
    }
  }

  _persistText() {
    try {
      if (this.config.text) {
        const sources = Array.isArray(this.config.sources) && this.config.sources.length
          ? this.config.sources
          : null;
        localStorage.setItem(ORBITAL_TEXT_KEY, JSON.stringify({
          // Avoid storing the combined preview twice when canonical source
          // segments already contain the same payload.
          text: sources ? null : this.config.text,
          textSource: this.config.textSource,
          origin: this.config.origin,
          sources,
          provenance: this.config.provenance
        }));
      } else {
        localStorage.removeItem(ORBITAL_TEXT_KEY);
      }
    } catch (e) {
      // Oversized text (storage quota): drop the stale entry rather
      // than let an older text resurrect on the next refresh
      try { localStorage.removeItem(ORBITAL_TEXT_KEY); } catch (e2) { /* full */ }
      console.warn('[ChamberOrbital] Text too large to persist across refresh:', e);
    }
  }

  /**
   * A soundscape is a finished mix — it never shares the bed with the
   * pure-tone stack (steady tones at the same carrier mask it). Saved
   * shapes or incoming configs holding both resolve in the
   * soundscape's favor.
   */
  _normalizeAudioExclusivity() {
    // Older builds allowed Klee chips to leak values such as `harmonic`
    // into this field. Repair those persisted sessions at the boundary so
    // the audio engine never receives an unknown preset and falls silent.
    if (!AUDIO_PRESET_IDS.has(this.config.audioPreset)) {
      this.config.audioPreset = 'silent';
    }
    if (this.config.soundscape && this.config.soundscape !== 'none'
      && this.config.audioPreset !== 'silent') {
      this.config.audioPreset = 'silent';
    }
  }

  _persistPrefs() {
    this._normalizeAudioExclusivity();
    const { wpm, curve, chunkMode, soundscape, audioPreset, entrainmentMode,
      entrainmentWaveform, voiceEnabled, voiceId, selectedSwellId,
      visualInterlocution } = this.config;
    const normalizedVisuals = {
      ...visualInterlocution,
      interlocution: {
        ...(visualInterlocution.interlocution || {}),
        duration: normalizeVisualPresence(
          visualInterlocution.interlocution?.duration
          ?? VISUAL_PRESENCE_DEFAULT_MS
        ),
        ...normalizeVisualSelection(visualInterlocution.interlocution)
      }
    };
    const payload = {
      // paceV2: this WPM was chosen under the honest temporal contract
      // (post-1.4375× repair) — never migrate it again
      paceV2: true,
      wpm, curve, chunkMode, soundscape, audioPreset, entrainmentMode,
      entrainmentWaveform, voiceEnabled, voiceId, selectedSwellId,
      visualInterlocution: normalizedVisuals
    };
    this._persistText();
    try {
      localStorage.setItem(ORBITAL_PREFS_KEY, JSON.stringify(payload));
    } catch (e) {
      // Quota overflow: the personal focal image is the only unbounded
      // field — shed it and save the rest, so one oversized image can
      // never silently kill ALL settings persistence
      try {
        const vi = payload.visualInterlocution || {};
        const slim = {
          ...payload,
          visualInterlocution: {
            ...vi,
            focals: { ...(vi.focals || {}), personalImage: null }
          }
        };
        localStorage.setItem(ORBITAL_PREFS_KEY, JSON.stringify(slim));
        console.warn('[ChamberOrbital] Prefs saved without the personal focal image (storage quota)');
      } catch (e2) {
        console.warn('[ChamberOrbital] Could not persist prefs:', e2);
      }
    }
  }

  update(data) {
    console.log('[ChamberOrbital] update called with hot-payload:', data);
    if (data && data.text) {
      this.loadText(data.text, data.source || 'Library', data.config);
    }
    // Always refresh swells when view is updated/re-entered
    this.renderPersonalPool();
  }

  render() {
    console.log('[ChamberOrbital] Rendering HTML to container');
    this.container.innerHTML = `
      <div class="chamber-orbital" role="main">
        <!-- Back button -->
        <button class="orbital-back btn-ghost" data-action="back">
          <span class="icon">←</span>
          <span>Portal</span>
        </button>

        <!-- Launch origin chip (wayfinding back to SOL / Vault / Library) -->
        <div class="orbital-origin-slot" id="orbital-origin-slot">${this.renderOriginChip()}</div>

        <!-- Orbital Interface -->
        <div class="orbital-stage">
          <!-- Orbit container -->
          <div class="orbit-container" id="orbit-container">

            <!-- Temporal Orbit (top) - Master dimension -->
            <div class="orbit-node orbit-temporal" data-orbit="temporal">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Temporal</div>
                <div class="orbit-status text-light">${this.getTemporalStatus()}</div>
              </div>
            </div>

            <!-- Audio Orbit (bottom-left) - Sonic layer -->
            <div class="orbit-node orbit-audio" data-orbit="audio">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Audio</div>
                <div class="orbit-status text-light">${this.getAudioStatus()}</div>
              </div>
            </div>

            <!-- Visual Orbit (bottom-right) - Visual layer -->
            <div class="orbit-node orbit-visual" data-orbit="visual">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Visual</div>
                <div class="orbit-status text-light">${this.getVisualPreview()}</div>
              </div>
            </div>
          </div>

          <!-- Center: TEXT -->
          <div class="orbit-center" id="orbit-center">
            <div class="text-source" id="text-source">
              ${this.renderTextSource()}
            </div>
          </div>
        </div>

        <!-- Begin Button -->
        <div class="orbital-actions">
          <button class="btn-primary btn-large" id="begin-btn" ${!this.config.text ? 'disabled' : ''}>
            ${this.config.text ? 'Begin Session' : 'Load Text First'}
          </button>
          <button type="button" class="orbital-reset" data-action="reset-prefs" title="Restore default settings (keeps loaded text)">
            ↺ Reset Settings
          </button>
        </div>

        <!-- Modals (hidden by default) -->
        <div class="orbital-modals">
          ${this.renderModals()}
        </div>
      </div>
    `;

    this.initVisualPanel();
  }

  /**
   * Origin chip — shows where the loaded configuration came from and
   * returns there on click. Origin metadata is app-authored (not user
   * data). Empty for plain orbital sessions.
   */
  renderOriginChip() {
    const origin = this.config.origin;
    if (!origin || !origin.view) return '';
    return `
      <button class="orbital-origin-chip" data-action="origin-return" title="Return to ${origin.name}">
        <span class="origin-chip-icon">${origin.icon || '◇'}</span>
        <span class="origin-chip-label">${origin.name}</span>
        <span class="origin-chip-arrow">‹</span>
      </button>
    `;
  }

  updateOriginChip() {
    const slot = this.container.querySelector('#orbital-origin-slot');
    if (slot) slot.innerHTML = this.renderOriginChip();
  }

  renderTextSource() {
    if (this.config.text) {
      return `
        <div class="text-loaded">
          <div class="text-sigil">文</div>
          <div class="text-info">
            <div class="text-name text-light">${escapeHtml(this.config.textSource || 'Text Loaded')}</div>
            <div class="text-meta text-fog">${this.getWordCount()} words</div>
          </div>
          <button class="text-clear btn-ghost-sm" data-action="clear-text"
            title="Remove this text" aria-label="Remove this text">✕</button>
        </div>
      `;
    }

    return `
      <div class="text-empty">
        <button class="text-choose-btn" data-action="library">
          <span class="choose-sigil">無</span>
          <span class="choose-label">Choose Text</span>
        </button>
      </div>
    `;
  }

  renderModals() {
    return `
      <!-- Visual Modal -->
      <div class="orbital-modal" id="modal-visual" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Visual Configuration</h2>
            <button class="modal-close" data-close="visual">✕</button>
          </div>
          <div class="modal-body">
            <!-- Visual Interlocution -->
            <div id="orbital-vi-panel-container" class="config-section"></div>
          </div>
        </div>
      </div>

      <!-- Audio Modal -->
      <div class="orbital-modal" id="modal-audio" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Audio Configuration</h2>
            <button class="modal-close" data-close="audio">✕</button>
          </div>
          <div class="modal-body">
            <!-- Soundscapes: living compositions, synthesized in real time -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Soundscape</label>
                <span class="config-info" data-tooltip="Living compositions synthesized in real time — slowly evolving, never looping. Aurora: a deep just-intoned pad visited by wandering harmonics. Plays alongside the pure tones below.">?</span>
              </div>
              <div class="audio-preset-options soundscape-options">
                <button class="audio-preset-option ${this.config.soundscape === 'none' ? 'active' : ''}" data-soundscape="none">
                  <span class="preset-icon">○</span>
                  <span class="preset-label">None</span>
                </button>
                <button class="audio-preset-option ${this.config.soundscape === 'aurora' ? 'active' : ''}" data-soundscape="aurora">
                  <span class="preset-icon">✧</span>
                  <span class="preset-label">Aurora</span>
                </button>
                <button class="audio-preset-option ${this.config.soundscape === 'faded-signal' ? 'active' : ''}" data-soundscape="faded-signal">
                  <span class="preset-icon">◌</span>
                  <span class="preset-label">Faded Signal</span>
                </button>
                <!-- Chant is Chapel-exclusive: recorded sacred music
                     belongs to the room built for it, not to ambient
                     texture under arbitrary text — the same scoping
                     contract as chapel-* imagery. Rendered always,
                     shown only for Chapel launches (loadText sets
                     provenance after the first render; syncUIWithConfig
                     keeps the hidden state honest). -->
                <button class="audio-preset-option chant-only ${this.config.soundscape === 'chant-gregorian' ? 'active' : ''}" data-soundscape="chant-gregorian"
                  ${this.isChapelSession() ? '' : 'hidden'}
                  title="Recorded Gregorian chant with long breaths of silence between pieces">
                  <span class="preset-icon">✛</span>
                  <span class="preset-label">Gregorian</span>
                </button>
                <button class="audio-preset-option chant-only ${this.config.soundscape === 'chant-znamenny' ? 'active' : ''}" data-soundscape="chant-znamenny"
                  ${this.isChapelSession() ? '' : 'hidden'}
                  title="Znamenny chant of the Moscow Patriarchate choir — long breaths of silence between pieces">
                  <span class="preset-icon">☦</span>
                  <span class="preset-label">Znamenny</span>
                </button>
              </div>
            </div>

            <!-- Pure Tones (brainwave presets) -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Pure Tones</label>
                <span class="config-info" data-tooltip="Presets target specific brainwave frequencies. Focus (Alpha 10Hz) enhances concentration. Deep (Theta 6Hz) promotes meditation. Gateway (Delta 2Hz) yields deep flow states.">?</span>
              </div>
              <div class="audio-preset-options">
                <button class="audio-preset-option ${this.config.audioPreset === 'silent' ? 'active' : ''}" data-audio-preset="silent">
                  <span class="preset-icon">○</span>
                  <span class="preset-label">Silent</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'focus' ? 'active' : ''}" data-audio-preset="focus">
                  <span class="preset-icon">◇</span>
                  <span class="preset-label">Focus</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'deep' ? 'active' : ''}" data-audio-preset="deep">
                  <span class="preset-icon">◈</span>
                  <span class="preset-label">Deep</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'gateway' ? 'active' : ''}" data-audio-preset="gateway">
                  <span class="preset-icon">⬡</span>
                  <span class="preset-label">Gateway</span>
                </button>
              </div>
            </div>

            <!-- Entrainment Type -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Entrainment Type</label>
                <span class="config-info" data-tooltip="The method used to deliver frequency stimulation. Binaural requires headphones (different tones per ear). Monaural works on speakers. Isochronic uses rhythmic pulses. Spatial rotates the sound field around your head.">?</span>
              </div>
              <div class="audio-mode-options">
                <button class="audio-mode-option ${this.config.entrainmentMode === 'binaural' ? 'active' : ''}" data-entrainment="binaural">Binaural</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'monaural' ? 'active' : ''}" data-entrainment="monaural">Monaural</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'isochronic' ? 'active' : ''}" data-entrainment="isochronic">Isochronic</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'spatial' ? 'active' : ''}" data-entrainment="spatial">Spatial</button>
              </div>
            </div>

            <!-- Waveform -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Waveform</label>
                <span class="config-info" data-tooltip="The shape of the audio wave. Sine is smooth and gentle. Triangle adds subtle harmonic texture. Saw is brighter and more present.">?</span>
              </div>
              <div class="audio-waveform-options">
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'sine' ? 'active' : ''}" data-waveform="sine">Sine</button>
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'triangle' ? 'active' : ''}" data-waveform="triangle">Triangle</button>
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'sawtooth' ? 'active' : ''}" data-waveform="sawtooth">Saw</button>
              </div>
            </div>
            <!-- Voice -->
            <div class="config-section">
              <label class="toggle">
                <input type="checkbox" id="voice-toggle" ${this.config.voiceEnabled ? 'checked' : ''}>
                <span class="toggle-switch"></span>
                <span class="toggle-label">Text-to-Speech</span>
              </label>
            </div>

            <!-- Voice Selection (shown when TTS enabled) -->
            <div class="config-section voice-select-section" id="voice-select-section" ${this.config.voiceEnabled ? '' : 'hidden'}>
              <label class="config-label">Voice</label>
              <select id="voice-select" class="voice-select">
                <option value="">System Default</option>
              </select>
            </div>

            <!-- Personal Swell Pool -->
            <div class="config-section">
              <div class="section-header-row">
                <label class="config-label">Personal Swell Pool</label>
                <div class="pool-actions">
                  <label class="pool-upload-btn" title="Upload MP3 Swell">
                    <span>+</span>
                    <input type="file" id="swell-upload" accept="audio/mpeg,audio/mp3" hidden>
                  </label>
                </div>
              </div>
              <div id="personal-swell-list" class="personal-swell-list">
                <!-- Swells rendered dynamically -->
                <div class="pool-empty">No personal swells uploaded.</div>
              </div>
              <p class="config-note">Upload high-quality MP3 swells. The selected swell opens the session; with none selected, one plays at random.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Temporal Modal -->
      <div class="orbital-modal" id="modal-temporal" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Temporal Configuration</h2>
            <button class="modal-close" data-close="temporal">✕</button>
          </div>
          <div class="modal-body">
            <!-- Pacing -->
            <div class="config-section">
              <label class="input-label">
                <span>Pacing</span>
                <span class="input-label-value font-mono" id="wpm-val">${this.config.wpm} WPM</span>
              </label>
              <input type="range" id="wpm-slider" class="slider" min="100" max="500" value="${this.config.wpm}" step="10">
              <div class="config-notice text-fog font-mono" style="font-size: 9px; margin-top: 0.5rem; opacity: 0.7;">
                ◊ Adjustable in-chamber via Arrow Keys
              </div>
            </div>

            <!-- Curve -->
            <div class="config-section">
              <label class="config-label">Pacing Curve</label>
              <div class="curve-options">
                <button class="curve-option ${this.config.curve === 'flat' ? 'active' : ''}" data-curve="flat">
                  <span class="curve-icon">─</span>
                  <span>Flat</span>
                </button>
                <button class="curve-option ${this.config.curve === 'induction' ? 'active' : ''}" data-curve="induction">
                  <span class="curve-icon">╲</span>
                  <span>Induction</span>
                </button>
                <button class="curve-option ${this.config.curve === 'ascent' ? 'active' : ''}" data-curve="ascent">
                  <span class="curve-icon">╱</span>
                  <span>Ascent</span>
                </button>
                <button class="curve-option ${this.config.curve === 'wave' ? 'active' : ''}" data-curve="wave">
                  <span class="curve-icon">∿</span>
                  <span>Wave</span>
                </button>
                <button class="curve-option ${this.config.curve === 'climax' ? 'active' : ''}" data-curve="climax">
                  <span class="curve-icon">∧</span>
                  <span>Climax</span>
                </button>
              </div>
            </div>

            <!-- Chunking -->
            <div class="config-section">
              <label class="config-label">Chunking Mode</label>
              <div class="chunk-options">
                <button class="chunk-option ${this.config.chunkMode === 'word' ? 'active' : ''}" data-chunk="word">Word</button>
                <button class="chunk-option ${this.config.chunkMode === 'phrase' ? 'active' : ''}" data-chunk="phrase">Phrase</button>
                <button class="chunk-option ${this.config.chunkMode === 'sentence' ? 'active' : ''}" data-chunk="sentence">Sentence</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initVisualPanel() {
    try {
      const container = this.container.querySelector('#orbital-vi-panel-container');
      console.log('[ChamberOrbital] initVisualPanel - container found:', !!container);
      if (!container) {
        console.error('[ChamberOrbital] orbital-vi-panel-container not found in DOM!');
        return;
      }
      if (!this.viPanel) {
        console.log('[ChamberOrbital] Instantiating VisualInterlocutionPanel...');
        this.viPanel = new VisualInterlocutionPanel(container, {
          ...this.config.visualInterlocution,
          consentScope: this.visualConsentScope,
          expanded: true,
          locked: !this.config.text,
          lockedMessage: 'Please load a text source first to configure Visuals.',
          onChange: (config) => {
            // Store the panel's config verbatim — never mix in activeTypes
            // (cortex vocabulary); app.js derives those from procedural +
            // sourced at session start.
            this.config.visualInterlocution = { ...config };
            this.updateOrbitStatus('visual');
            // Visual settings are the most-edited dials — durable immediately
            this._persistPrefs();
          }
        });
        console.log('[ChamberOrbital] InnerHTML after instantiation length:', container.innerHTML.length);
      }
    } catch (err) {
      console.error('[ChamberOrbital] Error initializing viPanel:', err);
    }
  }

  getVisualPreview() {
    if (!this.config) return '◎ Configuration missing';

    const vi = this.config.visualInterlocution;
    const mode = vi?.visualMode || 'off';

    if (mode === 'focals') {
      const glyph = vi.focals?.type === 'personal'
        ? 'Personal'
        : vi.focals?.type === 'icon'
          ? 'Icon'
          : vi.focals?.type === 'rose'
            ? 'Rosa Mystica'
            : this.capitalizeFirst(vi.focals?.standardGlyph || 'breath');
      return `◯ Focals · ${glyph}`;
    }

    if (mode === 'attractor') {
      return `∮ Attractor · ${this.capitalizeFirst(vi.attractor?.system || 'aizawa')}`;
    }

    if (mode === 'genesis') {
      return `✎ Genesis · ${this.capitalizeFirst(vi.genesis?.preset || 'random')}`;
    }

    if (mode === 'interlocution') {
      const family = vi.interlocution?.sourceFamily || 'procedural';
      return `◈ Rhythmic · ${this.capitalizeFirst(family)}`;
    }

    return `◎ Off`;
  }

  getAudioStatus() {
    const preset = this.capitalizeFirst(this.config.audioPreset);
    const hasSwell = !!this.config.selectedSwellId;
    const hasPreset = this.config.audioPreset !== 'silent';
    const hasSoundscape = this.config.soundscape && this.config.soundscape !== 'none';

    if (hasSoundscape) {
      const labels = {
        aurora: 'Aurora', 'faded-signal': 'Faded Signal',
        'chant-gregorian': 'Gregorian', 'chant-znamenny': 'Znamenny'
      };
      const scape = labels[this.config.soundscape] || this.capitalizeFirst(this.config.soundscape);
      return (hasPreset || hasSwell) ? `✧ ${scape} +` : `✧ ${scape}`;
    }
    if (hasSwell && hasPreset) {
      return `○ Mixed`;
    }
    if (hasSwell) {
      return `○ Personal`;
    }
    return `○ ${preset}`;
  }

  getTemporalStatus() {
    return `${this.config.wpm} WPM`;
  }

  getWordCount() {
    if (!this.config.text) return 0;
    return this.config.text.split(/\s+/).filter(w => w.length > 0).length;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Origin chip (delegated — the chip re-renders on loadText/clearText)
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="origin-return"]') && this.config.origin?.view) {
        window.rise?.audioEngine?.playClick();
        if (this.config.origin.data) {
          this.onNavigate(this.config.origin.view, this.config.origin.data);
        } else {
          this.onNavigate(this.config.origin.view);
        }
      }
    });

    // Reset settings to factory defaults (keeps the loaded text)
    this.container.querySelector('[data-action="reset-prefs"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.resetPrefs();
    });

    // Text source actions
    this.attachTextSourceEvents();

    // Orbit node clicks
    this.attachOrbitEvents();

    // Begin button
    this.container.querySelector('#begin-btn')?.addEventListener('click', () => {
      if (this.config.text) {
        window.rise?.audioEngine?.playClick();
        this.beginSession();
      }
    });

    // Modal events
    this.attachModalEvents();
  }

  attachTextSourceEvents() {
    // Browse library (single entry point)
    this.container.querySelector('[data-action="library"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.onNavigate('library');
    });

    // Clear text
    this.container.querySelector('[data-action="clear-text"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.clearText();
    });
  }

  attachOrbitEvents() {
    const nodes = this.container.querySelectorAll('.orbit-node');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        window.rise?.audioEngine?.playClick();
        const orbit = node.dataset.orbit;
        this.openModal(orbit);
      });
    });
  }


  attachModalEvents() {
    // Close buttons
    const closeBtns = this.container.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.closeModal(btn.dataset.close);
      });
    });

    // Click outside to close
    const modals = this.container.querySelectorAll('.orbital-modal');
    modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          const modalId = modal.id.replace('modal-', '');
          this.closeModal(modalId);
        }
      });
    });

    // Visual modal controls
    this.attachVisualModalEvents();

    // Audio modal controls
    this.attachAudioModalEvents();

    // Temporal modal controls
    this.attachTemporalModalEvents();
  }

  attachVisualModalEvents() {
    // VI Panel handles its own events
  }

  async renderPersonalPool() {
    const listEl = this.container.querySelector('#personal-swell-list');
    if (!listEl) return;

    const swells = await PersonalSwells.getAll();

    // The pool can shrink elsewhere (Workshop deletes, cleared data);
    // a selection pointing at a missing swell would silently degrade
    // to random playback, so reconcile it where the truth is in hand
    if (this.config.selectedSwellId && !swells.some(s => s.id === this.config.selectedSwellId)) {
      this.config.selectedSwellId = null;
      this.updateOrbitStatus('audio');
    }

    if (swells.length === 0) {
      listEl.innerHTML = '<div class="pool-empty">No personal swells uploaded.</div>';
      return;
    }

    listEl.innerHTML = swells.map(swell => {
      const isSelected = this.config.selectedSwellId === swell.id;
      return `
        <div class="swell-item ${isSelected ? 'selected' : ''}" data-id="${swell.id}">
          <span class="swell-name" title="${swell.name}">${swell.name}</span>
          <div class="swell-actions">
            <button class="swell-btn preview-btn" data-action="preview" title="Preview Swell">▶</button>
            <button class="swell-btn delete-btn" data-action="delete" title="Delete Swell">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events (Selection)
    listEl.querySelectorAll('.swell-item').forEach(row => {
      row.addEventListener('click', (e) => {
        // Only select if we didn't click a button
        if (e.target.closest('.swell-btn')) return;
        
        const id = row.dataset.id;
        if (this.config.selectedSwellId === id) {
          this.config.selectedSwellId = null; // Deselect if already selected
        } else {
          this.config.selectedSwellId = id;
        }
        
        if (window.rise?.audioEngine) window.rise.audioEngine.playClick();
        this.renderPersonalPool();
        this.updateOrbitStatus('audio');
      });
    });

    // Attach button events (Delete / Preview)
    listEl.querySelectorAll('.swell-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent row selection
        const id = btn.closest('.swell-item').dataset.id;
        const action = btn.dataset.action;

        if (action === 'delete') {
          if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
          await PersonalSwells.removeSwell(id);
          if (this.config.selectedSwellId === id) this.config.selectedSwellId = null;
          if (window.rise?.audioEngine) await window.rise.audioEngine.reloadPersonalSwells();
          this.renderPersonalPool();
          this.updateOrbitStatus('audio');
        } else if (action === 'preview') {
          if (window.rise?.audioEngine) {
            // Targeted preview!
            window.rise.audioEngine.playSwell(id);
          }
        }
      });
    });
  }

  attachAudioModalEvents() {
    // Soundscapes and pure tones are mutually exclusive beds: a
    // soundscape is a finished mix and never shares the room with the
    // tone stack (steady tones at the same carrier simply mask it).
    // Auto-switch rather than disable — the selection visibly moving
    // teaches the rule, and one tap undoes it.
    const soundscapeOptions = this.container.querySelectorAll('[data-soundscape]');
    const presetOptions = this.container.querySelectorAll('[data-audio-preset]');

    soundscapeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.soundscape = opt.dataset.soundscape;
        if (opt.dataset.soundscape !== 'none' && this.config.audioPreset !== 'silent') {
          this.config.audioPreset = 'silent';
          presetOptions.forEach(o => o.classList.toggle('active', o.dataset.audioPreset === 'silent'));
        }
        this.updateOrbitStatus('audio');
        soundscapeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    presetOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.audioPreset = opt.dataset.audioPreset;
        if (opt.dataset.audioPreset !== 'silent' && this.config.soundscape !== 'none') {
          this.config.soundscape = 'none';
          soundscapeOptions.forEach(o => o.classList.toggle('active', o.dataset.soundscape === 'none'));
        }
        this.updateOrbitStatus('audio');
        presetOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });


    // Entrainment mode
    const entrainmentOptions = this.container.querySelectorAll('[data-entrainment]');
    entrainmentOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.entrainmentMode = opt.dataset.entrainment;
        this.updateOrbitStatus('audio');
        entrainmentOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // Waveform
    const waveformOptions = this.container.querySelectorAll('[data-waveform]');
    waveformOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playClick();
        this.config.entrainmentWaveform = opt.dataset.waveform;
        this.updateOrbitStatus('audio');
        waveformOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });


    // Initial active states
    this.container.querySelectorAll('[data-entrainment]').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.entrainment === this.config.entrainmentMode);
    });
    this.container.querySelectorAll('[data-waveform]').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.waveform === this.config.entrainmentWaveform);
    });

    // Voice toggle
    const voiceToggle = this.container.querySelector('#voice-toggle');
    const voiceSelectSection = this.container.querySelector('#voice-select-section');
    const voiceSelect = this.container.querySelector('#voice-select');

    voiceToggle?.addEventListener('change', () => {
      window.rise?.audioEngine?.playClick();
      this.config.voiceEnabled = voiceToggle.checked;
      // Show/hide voice selector
      if (voiceSelectSection) {
        voiceSelectSection.hidden = !voiceToggle.checked;
      }
      // Populate voices if enabling
      if (voiceToggle.checked && voiceSelect) {
        this.populateVoices(voiceSelect);
      }
      this.updateOrbitStatus('audio');
    });

    // Voice selection change
    voiceSelect?.addEventListener('change', () => {
      this.config.voiceId = voiceSelect.value;
      this.updateOrbitStatus('audio');
    });

    // Pre-populate voices if TTS is already enabled
    if (this.config.voiceEnabled && voiceSelect) {
      this.populateVoices(voiceSelect);
    }

    // Personal Pool Upload
    const swellUpload = this.container.querySelector('#swell-upload');
    swellUpload?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
      
      const displayName = await namingModal.show(file.name, 'Name Swell', 'Atmospheric Metadata');
      if (!displayName) {
        swellUpload.value = '';
        return;
      }
      
      try {
        await PersonalSwells.addSwell(file, displayName);
        if (window.rise?.audioEngine) {
          await window.rise.audioEngine.reloadPersonalSwells();
        }
        this.renderPersonalPool();
      } catch (err) {
        console.error('[Orbital] Upload failed:', err);
      }

      // Reset input
      swellUpload.value = '';
    });

    // Initial render of pool
    this.renderPersonalPool();
  }

  async populateVoices(selectEl) {
    // Get voices from SpeechSynthesis API
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn('[ChamberOrbital] SpeechSynthesis not available');
      return;
    }

    const getVoices = () => {
      return new Promise((resolve) => {
        let voices = synth.getVoices();
        if (voices.length > 0) {
          resolve(voices);
          return;
        }
        // Chrome loads voices async
        synth.onvoiceschanged = () => {
          resolve(synth.getVoices());
        };
        // Fallback timeout
        setTimeout(() => resolve(synth.getVoices()), 100);
      });
    };

    const voices = await getVoices();

    // Clear existing options except default
    selectEl.innerHTML = '<option value="">System Default</option>';

    // Group voices by language
    const grouped = {};
    voices.forEach(voice => {
      const lang = voice.lang.split('-')[0].toUpperCase();
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push(voice);
    });

    // Add grouped options
    Object.keys(grouped).sort().forEach(lang => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = lang;
      grouped[lang].forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} ${voice.localService ? '' : '(Online)'}`;
        if (this.config.voiceId === voice.name) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });
      selectEl.appendChild(optgroup);
    });
  }

  attachTemporalModalEvents() {
    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    wpmSlider?.addEventListener('input', () => {
      this.config.wpm = parseInt(wpmSlider.value, 10);
      wpmVal.textContent = `${wpmSlider.value} WPM`;
      this.updateOrbitStatus('temporal');
    });

    // Curve options
    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.curve = opt.dataset.curve;
        curveOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // Chunk mode
    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.chunkMode = opt.dataset.chunk;
        chunkOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  /**
   * Router Escape dispatch — close an open config modal instead of
   * losing the whole orbital context to a portal reset. Returns false
   * when no modal is open so the router's default (portal) applies.
   */
  handleEscape() {
    if (this.activeModal) {
      this.closeModal(this.activeModal);
      return true;
    }
    return false;
  }

  openModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = false;
      this.activeModal = orbit;
    }
  }

  closeModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = true;
      this.activeModal = null;
    }
  }

  updateOrbitStatus(orbit) {
    const node = this.container.querySelector(`.orbit-${orbit}`);
    if (!node) return;

    const statusEl = node.querySelector('.orbit-status');
    if (!statusEl) return;

    let status = '';
    switch (orbit) {
      case 'visual':
        status = this.getVisualPreview();
        break;
      case 'audio':
        status = this.getAudioStatus();
        break;
      case 'temporal':
        status = this.getTemporalStatus();
        break;
    }

    statusEl.textContent = status;
  }

  syncUIWithConfig() {
    // Temporal Modal
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    if (wpmSlider && wpmVal) {
      wpmSlider.value = this.config.wpm;
      wpmVal.textContent = `${this.config.wpm} WPM`;
    }

    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.curve === this.config.curve);
    });

    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.chunk === this.config.chunkMode);
    });

    // Audio Modal
    const soundscapeOptions = this.container.querySelectorAll('[data-soundscape]');
    soundscapeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.soundscape === (this.config.soundscape || 'none'));
    });

    const presetOptions = this.container.querySelectorAll('[data-audio-preset]');
    presetOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.audioPreset === this.config.audioPreset);
    });

    // Voice toggle
    const voiceToggle = this.container.querySelector('#voice-toggle');
    if (voiceToggle) {
      voiceToggle.checked = !!this.config.voiceEnabled;
    }
  }

  loadText(text, source, config = {}) {
    this.visualConsentScope = crypto.randomUUID();
    this.viPanel?.setConsentScope(this.visualConsentScope);
    console.log('[ChamberOrbital] loadText called', {
      text: text?.substring(0, 50),
      source,
      sourceCount: Array.isArray(config.sources) ? config.sources.length : 0,
      hasProvenance: Boolean(config.provenance)
    });
    this.config.text = text;
    this.config.textSource = source;
    this.config.sources = Array.isArray(config.sources) && config.sources.length
      ? config.sources.slice(0, 64)
      : null;
    this.config.provenance = config.provenance || null;

    // A compiled visual program (PERICOPE-IMAGERY-SPEC §6) rides
    // through opaquely — the orbital neither reads nor edits it, but
    // must carry it to the begin payload so the Chamber's scheduler
    // receives it. Without this pass-through the schedule was compiled
    // by the handoff and then silently dropped here, so a Gospel
    // chapter stayed frozen on its first episode.
    this.config.visualProgram = config.visualProgram || null;

    // Launch origin for the wayfinding chip (null when launched plainly)
    this.config.origin = config.origin || null;
    this.updateOriginChip();

    // Capture immediately — a refresh right after choosing a text
    // should bring it back, not wait for an exit event
    this._persistText();

    // Apply optional config parameters from source
    if (config.wpm) this.config.wpm = config.wpm;
    if (config.curve) this.config.curve = config.curve;
    if (config.chunkMode) this.config.chunkMode = config.chunkMode;
    if (config.audioPreset) this.config.audioPreset = config.audioPreset;
    if (config.soundscape) this.config.soundscape = config.soundscape;
    if (config.entrainmentMode) this.config.entrainmentMode = config.entrainmentMode;
    if (config.entrainmentWaveform) this.config.entrainmentWaveform = config.entrainmentWaveform;
    // Provenance is set above, so this correctly KEEPS chant for a
    // Chapel launch and clears it for anything else
    this._sanitizeChapelExclusives();
    this._normalizeAudioExclusivity();
    // Reveal or hide the Chapel-exclusive chant chips now that the
    // session's nature is known
    this.container.querySelectorAll('.chant-only').forEach(chip => {
      chip.hidden = !this.isChapelSession();
    });

    // Apply visual configuration from archetype/source
    if (config.visualConfig) {
      console.log('[ChamberOrbital] Applying visualConfig from source:', config.visualConfig);
      const incomingInterlocution = config.visualConfig.interlocution || null;
      const currentInterlocution = this.config.visualInterlocution.interlocution;
      const mergedInterlocution = {
        ...currentInterlocution,
        ...(incomingInterlocution || {})
      };
      const selectionInput = hasVisualSelectionFields(incomingInterlocution)
        ? {
          sourceFamily: incomingInterlocution.sourceFamily,
          procedural: Object.hasOwn(incomingInterlocution, 'procedural')
            ? incomingInterlocution.procedural
            : [],
          sourced: Object.hasOwn(incomingInterlocution, 'sourced')
            ? incomingInterlocution.sourced
            : []
        }
        : currentInterlocution;
      this.config.visualInterlocution = {
        ...this.config.visualInterlocution,
        visualMode: config.visualConfig.visualMode || 'off',
        focals: config.visualConfig.focals || this.config.visualInterlocution.focals,
        attractor: config.visualConfig.attractor || this.config.visualInterlocution.attractor,
        genesis: config.visualConfig.genesis || this.config.visualInterlocution.genesis,
        livingText: config.visualConfig.livingText || this.config.visualInterlocution.livingText,
        interlocution: {
          ...mergedInterlocution,
          duration: normalizeVisualPresence(mergedInterlocution.duration),
          ...normalizeVisualSelection(selectionInput)
        }
      };

      // Update the VisualInterlocutionPanel if it exists
      if (this.viPanel) {
        this.viPanel.setConfig(config.visualConfig);
      }
    }

    // Sync HTML modal elements with new config state
    this.syncUIWithConfig();

    // Update UI state for all orbits
    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('audio');
    this.updateOrbitStatus('visual');

    // Unlock visual interlocution
    if (this.viPanel) {
      this.viPanel.setLocked(false);
    }

    // Re-render text source area
    const textSourceEl = this.container.querySelector('#text-source');
    console.log('[ChamberOrbital] textSourceEl found:', !!textSourceEl);
    if (textSourceEl) {
      textSourceEl.innerHTML = this.renderTextSource();
      this.attachTextSourceEvents();
      console.log('[ChamberOrbital] Text source area re-rendered');
    }

    // Enable begin button
    const beginBtn = this.container.querySelector('#begin-btn');
    if (beginBtn) {
      beginBtn.disabled = false;
      beginBtn.textContent = 'Begin Session';
      console.log('[ChamberOrbital] Begin button enabled');
    }

    // Refresh personal pool to sync with any changes made in Workshop
    this.renderPersonalPool();
  }

  clearText() {
    this.config.text = null;
    this.config.textSource = null;
    this.config.origin = null;
    this.config.sources = null;
    this.config.provenance = null;
    this.updateOriginChip();
    this._persistText(); // clearing the card clears its persistence

    // Lock visual interlocution again
    if (this.viPanel) {
      this.viPanel.setLocked(true);
      this.updateOrbitStatus('visual');
    }

    // Re-render text source area
    const textSourceEl = this.container.querySelector('#text-source');
    if (textSourceEl) {
      textSourceEl.innerHTML = this.renderTextSource();
      this.attachTextSourceEvents();
    }

    // Disable begin button
    const beginBtn = this.container.querySelector('#begin-btn');
    if (beginBtn) {
      beginBtn.disabled = true;
      beginBtn.textContent = 'Load Text First';
    }
  }

  beginSession() {
    // The moment settings are used is the moment they become "last known"
    this._persistPrefs();

    // Build session data from config
    const vi = this.config.visualInterlocution;
    const visualSelection = normalizeVisualSelection(vi.interlocution);
    const sessionData = {
      text: this.config.text,
      textSource: this.config.textSource,
      ...(Array.isArray(this.config.sources) && this.config.sources.length
        ? { sources: this.config.sources }
        : {}),
      origin: this.config.origin,
      provenance: this.config.provenance,
      wpm: this.config.wpm,
      curve: this.config.curve,
      chunkMode: this.config.chunkMode,
      audioPreset: this.config.audioPreset,
      soundscape: this.config.soundscape,
      entrainmentMode: this.config.entrainmentMode,
      entrainmentWaveform: this.config.entrainmentWaveform,
      voiceEnabled: this.config.voiceEnabled,
      voiceId: this.config.voiceId,
      selectedSwellId: this.config.selectedSwellId,
      // The compiled visual program rides opaquely to the Chamber's
      // scheduler (PERICOPE-IMAGERY-SPEC §6) — carried through, never
      // edited here.
      ...(this.config.visualProgram ? { visualProgram: this.config.visualProgram } : {}),
      visualConfig: {
        consentScope: this.visualConsentScope,
        visualMode: vi.visualMode || 'off',
        focals: vi.focals || { type: 'standard', standardGlyph: 'breath', personalImage: null },
        attractor: vi.attractor || { system: 'aizawa', palette: 'white', form: 'mirror' },
        genesis: vi.genesis || { preset: 'random', glass: true },
        livingText: vi.livingText || { enabled: false },
        interlocution: {
          ...(vi.interlocution || {}),
          // Panel vocabulary only (klee/turrell/...) — activeTypes is the
          // cortex's derived vocabulary and must never be persisted here
          ...visualSelection,
          procedural: visualSelection.procedural,
          sourced: visualSelection.sourced,
          frequency: vi.interlocution?.frequency ?? 0.2,
          duration: normalizeVisualPresence(
            vi.interlocution?.duration ?? VISUAL_PRESENCE_DEFAULT_MS
          ),
          kleePreset: vi.interlocution?.kleePreset ?? 'random'
        }
      }
    };

    this.onBeginSession(sessionData);
  }

  destroy() {
    // The latest dials are the user's truth — capture them on the way out
    // (session start destroys this instance; so does navigating away)
    this._persistPrefs();
    window.removeEventListener('beforeunload', this._boundPersist);

    // Cleanup
    if (this.viPanel) {
      this.viPanel.destroy();
    }
  }
}

