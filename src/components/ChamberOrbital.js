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
  GALLERY_CADENCE_DEFAULT,
  VISUAL_PRESENCE_DEFAULT_MS,
  normalizeGalleryCadence,
  normalizeVisualPresence
} from '../core/visual-presence.js';
import {
  deserializeVisualProgram,
  normalizeVisualProgram,
  serializeVisualProgram
} from '../core/visual-program.js';
import {
  clearLaunchVisualSelection,
  createReadingVisualIdentity,
  isLaunchHeldFocal,
  normalizeReadingVisualIdentity,
  reconcileReadingVisualIdentity,
  releaseLaunchHeldFocal
} from '../core/visual-identity.js';
import {
  recoverLegacyChapelCollectionIdentity,
  recoverLegacyChapelScriptureSources,
  recoverLegacyChapelVisualProgram
} from '../content/chapel/imagery/program-recovery.js';
import {
  availableVoicePacks,
  defaultVoicePackId
} from '../audio/voice-pack.js';
import {
  SEQUENCE_CAPABILITIES,
  normalizeSequenceCapabilities,
  sequenceHasCapability
} from '../core/sequence-capabilities.js';
import './VisualInterlocutionPanel.css';

// Last-used session settings survive across chamber visits (the orbital
// instance itself is destroyed whenever a session runs in the shared view)
const ORBITAL_PREFS_KEY = 'rise_orbital_prefs_v1';
// The loaded text lives under its own key, apart from the settings:
// texts can be book-sized, and a quota failure on one must never cost
// the other. Prefs shed only the focal image; text sheds only itself.
const ORBITAL_TEXT_KEY = 'rise_orbital_text_v1';
// Every id the engine can actually play. `drift` is a legacy engine preset,
// valid even though the orbital exposes four choices. `personal` is not here:
// it was a Workshop sentinel the engine never knew, so admitting it let an
// unplayable preset through the very guard that exists to stop one.
const AUDIO_PRESET_IDS = new Set([
  'silent', 'focus', 'deep', 'drift', 'gateway'
]);
/* The padlock drawn on a chunking mode Recitation has taken. Declared
   once so the first render and the runtime toggle cannot disagree —
   the gap after it is CSS, never a text node (see the toggle). */
const LOCK_MARK = '<span class="chunk-lock" aria-hidden="true">🔒</span>';

const STATIC_VOICE_PACKS = availableVoicePacks();
const STATIC_VOICE_IDS = new Set(STATIC_VOICE_PACKS.map(pack => pack.id));
const DEFAULT_STATIC_VOICE_ID = defaultVoicePackId();

/**
 * Factory defaults for the orbital — shared by constructor and Reset.
 * Exported so defaults can be asserted; silent default drift breaks e2e.
 */
export function createDefaultConfig() {
  return {
    text: null,
    textSource: null, // 'drop', 'paste', 'library', 'starter'
    // Launch origin (wayfinding): { view, icon, name } set by app.js
    // launch handlers (SOL / Vault / Library); null for plain sessions
    origin: null,
    // Optional canonical multi-source payload and bounded provenance. A
    // packaged launch uses these to keep passage boundaries intact through
    // configuration.
    sources: null,
    provenance: null,
    continuation: null,
    // Launch-scoped authority. Capabilities travel with the reading that
    // received them; they are never inferred from installed media or prefs.
    capabilities: [],
    // Content-authored cue schedule. Launch identity, persisted with the
    // reading rather than with the user's reusable visual preferences.
    visualProgram: null,

    // The reading MEDIUM (SPATIAL-CHAMBER-SPEC): 'stream' (of Time) or
    // 'page' (of Space). A reusable preference, like wpm or soundscape.
    projection: 'stream',
    // Text arrival and voice are orthogonal reader choices.
    revealMode: 'instant',
    // Ordinary-reading collections are weaker than a visualProgram but still
    // belong to the loaded reading, never to reusable preferences.
    readingVisualIdentity: null,

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
        // New ordinary readings should demonstrate RISE's semantic text
        // condition without requiring discovery of a secondary control.
        enabled: true
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
        galleryCadence: GALLERY_CADENCE_DEFAULT,
        renderLanguage: 'native',
        // GALLERY IS THE DEFAULT. It is the only surface that never
        // flashes and never goes black, and it is what a reader who has
        // expressed no preference should meet. This is the DEFAULT only —
        // a domain that authors its own surface still wins, per the
        // three-layer law: the Chapel asks for behind-stream and a Vault
        // program for full-frame, and neither is overruled here.
        presentation: 'continuous',
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
    voiceId: DEFAULT_STATIC_VOICE_ID,
    selectedSwellId: null,

    // Temporal orbit
    wpm: 200,
    // Text presentation (RECITATION-SPEC). Off by default: an ordinary
    // reading takes the same path it always has.
    recitation: { enabled: false },
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

    // One abortable event scope owns every listener installed by this
    // Orbital. The Chamber and immersive session reuse the same container,
    // so DOM replacement alone cannot retire delegated container listeners.
    this._eventController = null;
    this._destroyed = false;
    this._boundPersist = () => this._persistPrefs();

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

    const scalarKeys = ['wpm', 'curve', 'chunkMode', 'revealMode', 'soundscape', 'audioPreset',
      'entrainmentMode', 'entrainmentWaveform', 'voiceId', 'selectedSwellId'];
    for (const key of scalarKeys) {
      if (saved[key] !== undefined) this.config[key] = saved[key];
    }

    // Recitation is intentionally not a preference: authority belongs to a
    // particular loaded sequence and must never leak to an ordinary reading.
    // A saved q4f16-era voice must not resurrect browser inference.
    if (!STATIC_VOICE_IDS.has(this.config.voiceId)) {
      this.config.voiceId = DEFAULT_STATIC_VOICE_ID;
    }
    if (!DEFAULT_STATIC_VOICE_ID) {
      this.config.recitation = { enabled: false };
    } else if (this.config.recitation.enabled) {
      // Migrate stale runtime-inference sessions onto the only segmentation
      // whose static asset identity is admitted.
      this.config.chunkMode = 'phrase';
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
          galleryCadence: normalizeGalleryCadence(
            vi.interlocution?.galleryCadence ?? defaults.interlocution.galleryCadence
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

    const {
      text,
      textSource,
      origin,
      sources,
      provenance,
      continuation,
      capabilities,
      projection,
      visualProgram,
      readingVisualIdentity
    } = this.config;
    this.config = {
      ...createDefaultConfig(),
      text,
      textSource,
      origin,
      sources,
      provenance,
      continuation,
      capabilities,
      projection,
      visualProgram,
      readingVisualIdentity
    };
    if (this.config.readingVisualIdentity && !this.config.visualProgram) {
      this.config.visualInterlocution.interlocution =
        reconcileReadingVisualIdentity(
          this.config.visualInterlocution.interlocution,
          this.config.readingVisualIdentity
        );
    }

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
        // Projection belongs to the loaded reading, not the reusable
        // preference bundle. A Page reading must survive an Orbital rebuild,
        // while older records (which predate this field) safely reopen in
        // Stream.
        this.config.projection = saved.projection === 'page' ? 'page' : 'stream';
        this.config.origin = saved.origin || null;
        this.config.provenance = saved.provenance || null;
        this.config.continuation = saved.continuation || null;
        this.config.capabilities = normalizeSequenceCapabilities(saved.capabilities);
        const recitationAvailable = STATIC_VOICE_PACKS.length > 0
          && sequenceHasCapability(
            this.config.capabilities,
            SEQUENCE_CAPABILITIES.RECITATION_AUDIO
          );
        this.config.recitation = {
          enabled: recitationAvailable && saved.recitation?.enabled === true
        };
        if (this.config.recitation.enabled) this.config.chunkMode = 'phrase';
        this.config.verseLines = saved.verseLines === true;
        const persistedProgram = deserializeVisualProgram(saved.visualProgram);
        this.config.visualProgram = persistedProgram
          || recoverLegacyChapelVisualProgram({
            provenance: this.config.provenance,
            origin: this.config.origin,
            sources: this.config.sources,
            textSource: this.config.textSource,
            visualConfig: this.config.visualInterlocution
          });
        const persistedIdentity = this.config.visualProgram
          ? null
          : normalizeReadingVisualIdentity(saved.readingVisualIdentity);
        this.config.readingVisualIdentity = persistedIdentity
          || (!this.config.visualProgram
            ? recoverLegacyChapelCollectionIdentity({
              provenance: this.config.provenance,
              origin: this.config.origin,
              visualConfig: this.config.visualInterlocution
            })
            : null);
        if (this.config.readingVisualIdentity) {
          this.config.visualInterlocution.interlocution =
            reconcileReadingVisualIdentity(
              this.config.visualInterlocution.interlocution,
              this.config.readingVisualIdentity
            );
        }
        if (this.config.visualProgram) {
          this.config.sources = recoverLegacyChapelScriptureSources({
            provenance: this.config.provenance,
            origin: this.config.origin,
            sources: this.config.sources,
            textSource: this.config.textSource,
            text: this.config.text
          });
        }
        if ((!persistedProgram && this.config.visualProgram)
          || (!persistedIdentity && this.config.readingVisualIdentity)) {
          console.info('[ChamberOrbital] Recovered legacy Chapel visual identity', {
            bookId: this.config.provenance?.bookId || this.config.origin?.data?.bookId,
            chapter: this.config.provenance?.chapter || this.config.origin?.data?.chapter,
            episodes: this.config.visualProgram?.segments?.length || 0,
            collections: this.config.readingVisualIdentity?.collections || []
          });
          // Heal the durable record immediately; every later visit takes the
          // ordinary deserialize path and never depends on this migration.
          this._persistText();
        }
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
          projection: this.config.projection === 'page' ? 'page' : 'stream',
          origin: this.config.origin,
          sources,
          provenance: this.config.provenance,
          continuation: this.config.continuation,
          capabilities: normalizeSequenceCapabilities(this.config.capabilities),
          recitation: {
            enabled: sequenceHasCapability(
              this.config.capabilities,
              SEQUENCE_CAPABILITIES.RECITATION_AUDIO
            ) && this.config.recitation?.enabled === true
          },
          verseLines: this.config.verseLines === true,
          visualProgram: serializeVisualProgram(this.config.visualProgram),
          readingVisualIdentity: this.config.visualProgram
            ? null
            : normalizeReadingVisualIdentity(this.config.readingVisualIdentity)
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
    const { wpm, curve, chunkMode, revealMode, soundscape, audioPreset, entrainmentMode,
      entrainmentWaveform, voiceId, selectedSwellId,
      visualInterlocution } = this.config;
    // atriumCollections and the visual program are LAUNCH-SCOPED
    // identity, not preferences — they belong to the specific reading
    // that was launched, never to the tab. Persisting them would
    // resurrect a "From this reading" pill on a fresh load with no
    // source behind it (the pill-leak fix's persistence arm).
    const { atriumCollections, ...persistableInterlocution } =
      visualInterlocution.interlocution || {};
    const normalizedVisuals = {
      ...visualInterlocution,
      interlocution: {
        ...persistableInterlocution,
        duration: normalizeVisualPresence(
          persistableInterlocution.duration
          ?? VISUAL_PRESENCE_DEFAULT_MS
        ),
        galleryCadence: normalizeGalleryCadence(
          persistableInterlocution.galleryCadence
          ?? GALLERY_CADENCE_DEFAULT
        ),
        ...normalizeVisualSelection(persistableInterlocution)
      }
    };
    const payload = {
      // paceV2: this WPM was chosen under the honest temporal contract
      // (post-1.4375× repair) — never migrate it again
      paceV2: true,
      wpm, curve, chunkMode,
      revealMode: revealMode === 'progressive' ? 'progressive' : 'instant',
      soundscape, audioPreset, entrainmentMode,
      entrainmentWaveform, voiceId, selectedSwellId,
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
    const recitationAvailable = STATIC_VOICE_PACKS.length > 0
      && sequenceHasCapability(
        this.config.capabilities,
        SEQUENCE_CAPABILITIES.RECITATION_AUDIO
      );
    const recitationEnabled =
      recitationAvailable && this.config.recitation?.enabled === true;
    const voiceOptions = STATIC_VOICE_PACKS.map(pack => `
      <option value="${escapeHtml(pack.id)}"
        ${this.config.voiceId === pack.id ? 'selected' : ''}>
        ${escapeHtml(pack.label)}
      </option>
    `).join('');
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
              <div class="pure-tone-controls" id="pure-tone-controls"
                ${this.config.audioPreset === 'silent' ? 'hidden' : ''}>

            <!-- These parameters belong to the selected Pure Tone. -->
            <div class="config-subsection">
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
            <div class="config-subsection">
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
              </div>
            </div>
            <!-- Recitation (RECITATION-SPEC): static voice packs, not speechSynthesis. -->
            <div class="config-section" data-recitation-capability
              ${recitationAvailable ? '' : 'hidden'}>
              <label class="config-label">Recitation</label>
              <div class="chunk-options">
                <button class="chunk-option ${!recitationEnabled ? 'active' : ''}"
                  data-recitation="off">Off</button>
                <button class="chunk-option ${recitationEnabled ? 'active' : ''}"
                  data-recitation="on" ${recitationAvailable ? '' : 'disabled'}
                  title="${recitationAvailable ? 'Use a bundled static voice pack' : 'No static voice pack is installed in this build'}">Spoken</button>
              </div>
              <p class="config-note text-mist" data-recitation-note ${recitationEnabled || !recitationAvailable ? '' : 'hidden'}>
                ${recitationAvailable
                  ? `The reading uses pre-generated audio from this RISE build.
                     No model, account, or API is used. An unpacked reading
                     continues silently. Static Recitation uses Phrase chunking.`
                  : `No static Recitation pack is installed in this build.
                     Ordinary silent reading remains available.`}
              </p>
            </div>

            <!-- Only voice packs actually present in this deployment. -->
            <div class="config-section" id="voice-select-section" ${recitationEnabled ? '' : 'hidden'}>
              <label class="config-label">Voice</label>
              <select id="voice-select" class="voice-select" ${recitationAvailable ? '' : 'disabled'}>
                ${voiceOptions || '<option value="">No voice pack installed</option>'}
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

            <!-- Chunking.
                 A DISABLED CONTROL MUST SAY WHO DISABLED IT.
                 Word and Sentence are unavailable while Recitation is
                 on, and the reason was written down in the AUDIO panel
                 — a different orb, behind a different tap. From here
                 the two buttons simply did not respond, which is
                 indistinguishable from broken. The lock is drawn on
                 the control it applies to, and named. -->
            <div class="config-section">
              <label class="config-label">Chunking Mode</label>
              <div class="chunk-options">
                <button class="chunk-option ${this.config.chunkMode === 'word' ? 'active' : ''} ${recitationEnabled ? 'is-locked' : ''}" data-chunk="word"
                  ${recitationEnabled ? 'disabled title="Recitation is spoken in phrases"' : ''}>${recitationEnabled ? LOCK_MARK : ''}Word</button>
                <button class="chunk-option ${this.config.chunkMode === 'phrase' ? 'active' : ''}" data-chunk="phrase">Phrase</button>
                <button class="chunk-option ${this.config.chunkMode === 'sentence' ? 'active' : ''} ${recitationEnabled ? 'is-locked' : ''}" data-chunk="sentence"
                  ${recitationEnabled ? 'disabled title="Recitation is spoken in phrases"' : ''}>${recitationEnabled ? LOCK_MARK : ''}Sentence</button>
              </div>
              <p class="config-note text-mist" data-chunk-lock-note ${recitationEnabled ? '' : 'hidden'}>
                Recitation locks Word and Sentence. The voice is a pack of
                pre-recorded phrases built into this release — one audio
                file per phrase — so a reading cut any other way has no
                recording to play and would run silent. Turn Recitation
                off to read by word or by sentence.
              </p>
            </div>

            <div class="config-section">
              <label class="config-label">Text arrival</label>
              <div class="chunk-options" role="group" aria-label="Text arrival">
                <button class="chunk-option ${this.config.revealMode !== 'progressive' ? 'active' : ''}"
                  data-reveal="instant">Instant</button>
                <button class="chunk-option ${this.config.revealMode === 'progressive' ? 'active' : ''}"
                  data-reveal="progressive">Progressive</button>
              </div>
              <p class="config-note text-mist">
                Progressive reveals words across each beat. Voice remains an independent Audio choice.
              </p>
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
          programInfo: this.config.visualProgram?.segments?.length
            ? { episodes: this.config.visualProgram.segments.length }
            : null,
          readingVisualDomain: this.config.readingVisualIdentity?.domain || null,
          onChange: (config) => {
            const previouslyHeld = isLaunchHeldFocal(
              this.config.visualInterlocution?.focals
            );
            const releasedHeldFocal = previouslyHeld
              && !isLaunchHeldFocal(config?.focals);
            if (releasedHeldFocal) {
              this._unlockVisualProgramAfterFocalRelease();
            }
            // Store the panel's config verbatim — never mix in activeTypes
            // (cortex vocabulary); app.js derives those from procedural +
            // sourced at session start.
            this.config.visualInterlocution = { ...config };
            if (this.config.readingVisualIdentity && !this.config.visualProgram) {
              this.config.readingVisualIdentity = normalizeReadingVisualIdentity({
                ...this.config.readingVisualIdentity,
                collections: config.interlocution?.atriumCollections || []
              });
            }
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

  _listen(target, type, listener, options = {}) {
    if (!target || this._destroyed || !this._eventController) return;
    target.addEventListener(type, listener, {
      ...options,
      signal: this._eventController.signal
    });
  }

  attachEvents() {
    // Full renders replace the controls but not `this.container`. Abort the
    // prior scope before binding the new DOM so delegated listeners cannot
    // multiply across Reset or shared-container reconstruction.
    this._eventController?.abort();
    this._eventController = new AbortController();
    this._listen(window, 'beforeunload', this._boundPersist);

    // Back button
    this._listen(this.container.querySelector('[data-action="back"]'), 'click', () => {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Origin chip (delegated — the chip re-renders on loadText/clearText)
    this._listen(this.container, 'click', (e) => {
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
    this._listen(this.container.querySelector('[data-action="reset-prefs"]'), 'click', () => {
      window.rise?.audioEngine?.playClick();
      this.resetPrefs();
    });

    // Text source actions
    this.attachTextSourceEvents();

    // Orbit node clicks
    this.attachOrbitEvents();

    // Begin button
    this._listen(this.container.querySelector('#begin-btn'), 'click', () => {
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
    this._listen(this.container.querySelector('[data-action="library"]'), 'click', () => {
      window.rise?.audioEngine?.playHiss();
      this.onNavigate('library');
    });

    // Clear text
    this._listen(this.container.querySelector('[data-action="clear-text"]'), 'click', () => {
      window.rise?.audioEngine?.playHiss();
      this.clearText();
    });
  }

  attachOrbitEvents() {
    const nodes = this.container.querySelectorAll('.orbit-node');
    nodes.forEach(node => {
      this._listen(node, 'click', () => {
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
      this._listen(btn, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.closeModal(btn.dataset.close);
      });
    });

    // Click outside to close
    const modals = this.container.querySelectorAll('.orbital-modal');
    modals.forEach(modal => {
      this._listen(modal, 'click', (e) => {
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
    // The shared Chamber container may have changed owners while IndexedDB
    // resolved. Never let a retired Orbital bind into the successor's DOM.
    if (this._destroyed || !this.container.contains(listEl)) return;

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
      this._listen(row, 'click', (e) => {
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
      this._listen(btn, 'click', async (e) => {
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
    const pureToneControls = this.container.querySelector('#pure-tone-controls');

    soundscapeOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.soundscape = opt.dataset.soundscape;
        if (opt.dataset.soundscape !== 'none' && this.config.audioPreset !== 'silent') {
          this.config.audioPreset = 'silent';
          presetOptions.forEach(o => o.classList.toggle('active', o.dataset.audioPreset === 'silent'));
          if (pureToneControls) pureToneControls.hidden = true;
        }
        this.updateOrbitStatus('audio');
        soundscapeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    presetOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.audioPreset = opt.dataset.audioPreset;
        if (pureToneControls) pureToneControls.hidden = opt.dataset.audioPreset === 'silent';
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
      this._listen(opt, 'click', () => {
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
      this._listen(opt, 'click', () => {
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

    // Static voice-pack controls are bound with the rest of Recitation
    // in attachConfigEvents.

    // Personal Pool Upload
    const swellUpload = this.container.querySelector('#swell-upload');
    this._listen(swellUpload, 'change', async (e) => {
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

  attachTemporalModalEvents() {
    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    this._listen(wpmSlider, 'input', () => {
      this.config.wpm = parseInt(wpmSlider.value, 10);
      wpmVal.textContent = `${wpmSlider.value} WPM`;
      this.updateOrbitStatus('temporal');
    });

    // Curve options
    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.curve = opt.dataset.curve;
        curveOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // Chunk mode
    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.chunkMode = opt.dataset.chunk;
        chunkOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    const revealOptions = this.container.querySelectorAll('[data-reveal]');
    revealOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.revealMode = opt.dataset.reveal === 'progressive'
          ? 'progressive' : 'instant';
        revealOptions.forEach(candidate => candidate.classList.toggle(
          'active', candidate === opt));
      });
    });

    // Recitation. A voice pack is served as ordinary same-origin audio;
    // phrase mode is the asset identity used by the installed pack.
    const recitationOptions = this.container.querySelectorAll('[data-recitation]');
    const recitationNote = this.container.querySelector('[data-recitation-note]');
    const chunkLockNote = this.container.querySelector('[data-chunk-lock-note]');
    const voiceSection = this.container.querySelector('#voice-select-section');
    recitationOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        if (opt.disabled) return;
        window.rise?.audioEngine?.playHiss();
        const enabled = opt.dataset.recitation === 'on';
        this.config.recitation = { enabled };
        if (enabled) this.config.chunkMode = 'phrase';
        recitationOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        chunkOptions.forEach(chunk => {
          chunk.classList.toggle('active', chunk.dataset.chunk === this.config.chunkMode);
          const locked = enabled && chunk.dataset.chunk !== 'phrase';
          chunk.disabled = locked;
          // The lock is drawn where the reader is looking when they
          // find the button dead — in the Temporal panel, on the
          // button itself, not in the Audio panel behind another orb.
          chunk.classList.toggle('is-locked', locked);
          chunk.title = locked ? 'Recitation is spoken in phrases' : '';
          // The mark is its own element and the gap after it is CSS.
          // A text node for the space would have made the span's
          // nextSibling " Word", and removing the mark would have
          // taken the label with it.
          const mark = chunk.querySelector('.chunk-lock');
          if (locked && !mark) {
            const lock = document.createElement('span');
            lock.className = 'chunk-lock';
            lock.setAttribute('aria-hidden', 'true');
            lock.textContent = '🔒';
            chunk.prepend(lock);
          } else if (!locked && mark) {
            mark.remove();
          }
        });
        if (recitationNote) recitationNote.hidden = !enabled;
        if (chunkLockNote) chunkLockNote.hidden = !enabled;
        // The voice picker is meaningless without a voice to pick for.
        if (voiceSection) voiceSection.hidden = !enabled;
      });
    });

    const voiceSelect = this.container.querySelector('#voice-select');
    if (voiceSelect) {
      this._listen(voiceSelect, 'change', () => {
        this.config.voiceId = voiceSelect.value || DEFAULT_STATIC_VOICE_ID;
      });
    }
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
    const available = STATIC_VOICE_PACKS.length > 0
      && sequenceHasCapability(
        this.config.capabilities,
        SEQUENCE_CAPABILITIES.RECITATION_AUDIO
      );
    const enabled = available
      && this.config.recitation?.enabled === true;
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
      opt.disabled = enabled && opt.dataset.chunk !== 'phrase';
    });
    this.container.querySelectorAll('[data-reveal]').forEach(opt => {
      const selected = this.config.revealMode === 'progressive' ? 'progressive' : 'instant';
      opt.classList.toggle('active', opt.dataset.reveal === selected);
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
    const pureToneControls = this.container.querySelector('#pure-tone-controls');
    if (pureToneControls) pureToneControls.hidden = this.config.audioPreset === 'silent';

    // Recitation, and the voice picker that only matters when it is on.
    const recitationSection = this.container.querySelector('[data-recitation-capability]');
    if (recitationSection) recitationSection.hidden = !available;
    this.container.querySelectorAll('[data-recitation]').forEach(opt => {
      opt.classList.toggle('active',
        (opt.dataset.recitation === 'on') === enabled);
      opt.disabled = !available;
    });
    const note = this.container.querySelector('[data-recitation-note]');
    if (note) note.hidden = !enabled;
    const voiceSection = this.container.querySelector('#voice-select-section');
    if (voiceSection) voiceSection.hidden = !enabled;
    const voiceSelect = this.container.querySelector('#voice-select');
    if (voiceSelect && this.config.voiceId) voiceSelect.value = this.config.voiceId;
  }

  loadText(text, source, config = {}) {
    this.visualConsentScope = crypto.randomUUID();
    this.viPanel?.setConsentScope(this.visualConsentScope);

    // Each load begins from a clean launch identity: the prior
    // reading's pills, program, and domain are cleared before this
    // source's own visual selection (if any) is applied below. A
    // plain library text carries none, so it correctly opens with no
    // "From this reading" pills — the Doré/Chapel leak the reader
    // caught (2026-07). A source WITH a selection re-establishes its
    // own identity through applyVisualConfig / the visualProgram
    // assignment that follow.
    this._clearLaunchVisualIdentity();
    console.log('[ChamberOrbital] loadText called', {
      text: text?.substring(0, 50),
      source,
      sourceCount: Array.isArray(config.sources) ? config.sources.length : 0,
      hasProvenance: Boolean(config.provenance)
    });
    this.config.text = text;
    this.config.textSource = source;
    // Every load establishes its own projection identity. In particular, a
    // plain Stream reading must not inherit Page from the text it replaces.
    this.config.projection = config.projection === 'page' ? 'page' : 'stream';
    this.config.sources = Array.isArray(config.sources) && config.sources.length
      ? config.sources.slice(0, 64)
      : null;
    this.config.provenance = config.provenance || null;
    this.config.continuation = config.continuation || null;

    // A compiled visual program (PERICOPE-IMAGERY-SPEC §6) rides
    // through as reading identity. The orbital validates its generic
    // boundary but does not interpret or edit its cues; it must carry
    // it to Begin so the Chamber's scheduler receives it. Without this
    // pass-through the schedule was compiled
    // by the handoff and then silently dropped here, so a Gospel
    // chapter stayed frozen on its first episode.
    this.config.visualProgram = normalizeVisualProgram(config.visualProgram)
      || recoverLegacyChapelVisualProgram({
        provenance: this.config.provenance,
        origin: config.origin,
        sources: this.config.sources,
        textSource: source,
        visualConfig: config.visualConfig || this.config.visualInterlocution
      });
    if (this.config.visualProgram) {
      this.config.sources = recoverLegacyChapelScriptureSources({
        provenance: this.config.provenance,
        origin: config.origin,
        sources: this.config.sources,
        textSource: source,
        text
      });
    }

    // WHETHER THIS TEXT IS SET AS VERSE, read off the edition at ingest and
    // carried here by whoever opened it. Established per load like every
    // other reading identity above: a poem must not leave the flag set for
    // the prose that replaces it.
    this.config.verseLines = config.verseLines === true;
    this.config.capabilities = normalizeSequenceCapabilities(config.capabilities);
    const recitationAvailable = STATIC_VOICE_PACKS.length > 0
      && sequenceHasCapability(
        this.config.capabilities,
        SEQUENCE_CAPABILITIES.RECITATION_AUDIO
      );
    this.config.recitation = {
      enabled: recitationAvailable && config.recitation?.enabled === true
    };
    if (this.config.recitation.enabled) this.config.chunkMode = 'phrase';

    // Launch origin for the wayfinding chip (null when launched plainly)
    this.config.origin = config.origin || null;
    this.updateOriginChip();

    // Apply optional config parameters from source
    if (config.wpm) this.config.wpm = config.wpm;
    if (config.curve) this.config.curve = config.curve;
    if (config.chunkMode) this.config.chunkMode = config.chunkMode;
    if (config.revealMode) {
      this.config.revealMode = config.revealMode === 'progressive' ? 'progressive' : 'instant';
    }
    if (config.audioPreset) this.config.audioPreset = config.audioPreset;
    if (config.soundscape) this.config.soundscape = config.soundscape;
    if (config.entrainmentMode) this.config.entrainmentMode = config.entrainmentMode;
    if (config.entrainmentWaveform) this.config.entrainmentWaveform = config.entrainmentWaveform;
    // Phrase assets are the unit of the admitted static voice pack. This
    // authority wins over a conflicting authored chunkMode at the boundary.
    if (this.config.recitation.enabled) this.config.chunkMode = 'phrase';
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
          galleryCadence: normalizeGalleryCadence(mergedInterlocution.galleryCadence),
          ...normalizeVisualSelection(selectionInput)
        }
      };

      // Update the VisualInterlocutionPanel if it exists
      if (this.viPanel) {
        this.viPanel.setConfig(config.visualConfig);
        // A curated visual program (a Gospel chapter's pericope
        // schedule) makes the panel show its read-only Special
        // Collection banner. Cleared for ordinary readings.
        const program = this.config.visualProgram;
        this.viPanel.setProgramInfo(
          program && Array.isArray(program.segments) && program.segments.length
            ? { episodes: program.segments.length }
            : null
        );
      }
    }

    const authoredInterlocution = config.visualConfig?.interlocution;
    this.config.readingVisualIdentity = createReadingVisualIdentity({
      visualProgram: this.config.visualProgram,
      provenance: this.config.provenance,
      origin: this.config.origin,
      collections: authoredInterlocution?.atriumCollections,
      hasAuthoredCollections: Boolean(
        authoredInterlocution
        && Object.hasOwn(authoredInterlocution, 'atriumCollections')
        && Array.isArray(authoredInterlocution.atriumCollections)
      )
    });

    // Persist only after text and visual identity have both crossed the load
    // boundary. _persistPrefs writes the reading record first, then the
    // effective reusable controls, so a replacement cannot leave the prior
    // reading's sourced pool stranded on disk.
    this._persistPrefs();

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

  /**
   * Reset every piece of launch-scoped visual IDENTITY — the pills,
   * the pericope program, the Chapel-domain memory — so it never
   * outlives the reading that created it. Called on clear-text and on
   * loading a source that carries no visual selection of its own.
   */
  _clearLaunchVisualIdentity() {
    this.config.visualProgram = null;
    this.config.readingVisualIdentity = null;
    const visual = this.config.visualInterlocution;
    if (visual?.interlocution) {
      visual.interlocution = clearLaunchVisualSelection(visual.interlocution);
    }
    // The Chapel-HELD focal — an Icon (type:'icon') or the per-book Rosa
    // Mystica (type:'rose') — is seeded by the Chapel launch and belongs
    // to that reading, exactly like the pericope program and the pills.
    // Without releasing it here, clearing a Chapel reading and loading a
    // plain text (which carries no visualConfig and so never overwrites
    // focals) stranded "✛ The Transfiguration · Held from the Chapel" in
    // the panel — the same launch-scope leak the pills had (2026-07). A
    // real new Chapel launch re-seeds its own icon via visualConfig after
    // this reset, so nothing legitimate is lost. The standard glyphs and
    // a Personal image are user choices, never Chapel-held: they survive.
    const released = releaseLaunchHeldFocal(visual?.focals);
    if (released) visual.focals = released;
    if (this.viPanel) {
      this.viPanel.clearLaunchVisualIdentity();
    }
  }

  /**
   * A true Chapel Icon locks a Gospel schedule while the icon is held.
   * Releasing that focal transfers authority back to the reading's episodes;
   * the stale icon must not remain as the disabled program's fallback.
   */
  _unlockVisualProgramAfterFocalRelease() {
    const program = this.config.visualProgram;
    if (!program) return false;
    if (program.enabled === true && program.fallback?.kind === 'still') return false;
    this.config.visualProgram = {
      ...program,
      enabled: true,
      fallback: { kind: 'still' }
    };
    return true;
  }

  clearText() {
    this.config.text = null;
    this.config.textSource = null;
    this.config.origin = null;
    this.config.sources = null;
    this.config.provenance = null;
    this.config.capabilities = [];
    this.config.recitation = { enabled: false };
    // LAUNCH-SCOPED VISUAL IDENTITY dies with the text that carried it
    // (2026-07 pill-leak fix): a Doré/Chapel/pericope reading's "From
    // this reading" pills, its program, and the Chapel-domain flag all
    // belong to the cleared reading. Without this, clearing a Numbers
    // launch and loading a plain text left the Doré pill stranded.
    this._clearLaunchVisualIdentity();
    this.updateOriginChip();
    this._persistPrefs(); // clears both the reading and its effective pool

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
      continuation: this.config.continuation,
      capabilities: normalizeSequenceCapabilities(this.config.capabilities),
      wpm: this.config.wpm,
      curve: this.config.curve,
      chunkMode: this.config.chunkMode,
      revealMode: this.config.revealMode === 'progressive' ? 'progressive' : 'instant',
      verseLines: this.config.verseLines === true,
      audioPreset: this.config.audioPreset,
      soundscape: this.config.soundscape,
      entrainmentMode: this.config.entrainmentMode,
      entrainmentWaveform: this.config.entrainmentWaveform,
      voiceId: this.config.voiceId,
      // Recitation rides through to the compiler, which normalises it.
      recitation: {
        enabled: STATIC_VOICE_PACKS.length > 0
          && sequenceHasCapability(
            this.config.capabilities,
            SEQUENCE_CAPABILITIES.RECITATION_AUDIO
          )
          && this.config.recitation?.enabled === true
      },
      selectedSwellId: this.config.selectedSwellId,
      // The compiled visual program rides opaquely to the Chamber's
      // scheduler (PERICOPE-IMAGERY-SPEC §6) — carried through, never
      // edited here.
      ...(this.config.visualProgram ? { visualProgram: this.config.visualProgram } : {}),
      // Which MEDIUM renders this reading (SPATIAL-CHAMBER-SPEC §3). The
      // two chambers share every field above; they differ only here.
      // Absent or unknown means the Stream — today's reading, unchanged.
      projection: this.config.projection === 'page' ? 'page' : 'stream',
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
          galleryCadence: normalizeGalleryCadence(
            vi.interlocution?.galleryCadence ?? GALLERY_CADENCE_DEFAULT
          ),
          kleePreset: vi.interlocution?.kleePreset ?? 'random'
        }
      }
    };

    this.onBeginSession(sessionData);
  }

  destroy() {
    if (this._destroyed) return;
    // The latest dials are the user's truth — capture them on the way out
    // (session start destroys this instance; so does navigating away)
    this._persistPrefs();
    this._destroyed = true;
    this._eventController?.abort();
    this._eventController = null;

    // Cleanup
    if (this.viPanel) {
      this.viPanel.destroy();
    }
  }
}
