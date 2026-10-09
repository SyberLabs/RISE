/**
 * Chamber Orbital Component
 * Fidget spinner interface for session configuration
 *
 * Design: 3 orbit nodes (Visual, Audio, Temporal) around central TEXT
 * - Each orbit shows collapsed state
 * - Click to expand modal with full controls
 * - Drag handles to rotate entire structure (aesthetic only)
 */

import { VisualNavigator } from '../VisualNavigator.js';
import { escapeHtml } from '../../core/sanitize.js';
import { PACE_CURVE_IDS } from '../../core/pacing.js';
import {
  hasVisualSelectionFields,
  normalizeVisualSelection
} from '../../core/visual-selection.js';
import {
  GALLERY_CADENCE_DEFAULT,
  VISUAL_PRESENCE_DEFAULT_MS,
  normalizeGalleryCadence,
  normalizeVisualPresence
} from '../../core/visual-presence.js';
import {
  deserializeVisualProgram,
  normalizeVisualProgram,
  serializeVisualProgram
} from '../../core/visual-program.js';
import {
  clearLaunchVisualSelection,
  createReadingVisualIdentity,
  isLaunchHeldFocal,
  normalizeReadingVisualIdentity,
  reconcileReadingVisualIdentity,
  releaseLaunchHeldFocal
} from '../../core/visual-identity.js';
import {
  recoverLegacyChapelCollectionIdentity,
  recoverLegacyChapelScriptureSources,
  recoverLegacyChapelVisualProgram
} from '../../content/chapel/imagery/program-recovery.js';
import {
  availableVoicePacks,
  defaultVoicePackId
} from '../../audio/voice-pack.js';
import { SOUND_GROUPS, soundOf } from '../../audio/sound-list.js';
import { standInSound } from '../../audio/sound-ids.js';
import {
  SEQUENCE_CAPABILITIES,
  normalizeSequenceCapabilities,
  sequenceHasCapability
} from '../../core/sequence-capabilities.js';
import { LOOKS, applyLook, lookOf } from '../../core/looks.js';
import { JEV_PALETTES, jevColors } from '../../core/jev-palette.js';
import { FONT_SIZE_CHIPS, resolveFontSize } from '../../core/chamber-type-size.js';
import { themeEngine } from '../../core/theme-engine-map.js';
// One engine has a name; the taxonomy is where it is kept.
import { leafById } from '../../core/visual-taxonomy.js';
import '../VisualNavigator.css';
import { createSetupPreview, firstUnit } from './setup-preview.js';
import './ChamberOrbital.css';
import markUrl from '../../content/compositions/syberlabs-mark.png';

const lookById = id => LOOKS.find(look => look.id === id);
// The smallest screen limit any look carries; crossing it changes what is offered.
const NARROWEST_LIMIT = Math.min(...LOOKS.map(look => look.maxViewportWidth || Infinity));
// Size for this reading: S, M and L, and Fit, which only Inlay offers.
const LOOK_SIZES = FONT_SIZE_CHIPS.filter(chip => chip.id !== 'xl');
const CHUNK_LABELS = Object.freeze({ phrase: 'Phrase', sentence: 'Sentence', word: 'Word' });
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The engine a reading's field draws first, or null when it draws none the preview can show. */
const previewEngine = visual => {
  if (visual.visualMode === 'attractor') return 'attractor';
  if (visual.visualMode === 'genesis') return 'klee';
  if (visual.visualMode === 'living-flame') return 'living-flame';
  if (visual.visualMode === 'interlocution') {
    return normalizeVisualSelection(visual.interlocution || {}).procedural[0] || null;
  }
  return null;
};

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
const RECITATION_LOCK_NOTE = 'Recitation locks Word and Sentence. The voice is a pack of pre-recorded phrases built into this release — one audio file per phrase — so a reading cut any other way has no recording to play and would run silent. Turn Recitation off to read by word or by sentence.';
const INLAY_LOCK_NOTE = 'Inlay paints one word at a time, the imagery inside each word. Choose another look to read by phrase or by sentence.';
const LOCK_MARK ='<svg class="chunk-lock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Locked" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

const svgIcon = paths => `<svg class="reader-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
// One entry per pace profile, in the order pacing.js lists them: what a reader
// reads on the button. A profile without an entry fails the test that holds
// this table to PACE_CURVE_IDS, so none can be offered unnamed or named unoffered.
export const CURVE_OPTIONS = Object.freeze({
  flat: { label: 'Flat', path: 'M3 12h18' },
  induction: { label: 'Induction', path: 'M4 6l16 12' },
  ascent: { label: 'Ascent', path: 'M4 18L20 6' },
  wave: { label: 'Wave', path: 'M3 12c3-6 6-6 9 0s6 6 9 0' },
  climax: { label: 'Climax', path: 'M4 18l8-12 8 12' },
  breath: { label: 'Breath', path: 'M3 12c3-3 6-3 9 0s6 3 9 0' }
});
const ICON_BACK = svgIcon('<path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path>');
const ICON_ARROW = svgIcon('<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>');
const ICON_CHEVRON_RIGHT = svgIcon('<path d="m9 6 6 6-6 6"></path>');
const ICON_CLOSE = svgIcon('<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>');

const STATIC_VOICE_PACKS = availableVoicePacks();
const STATIC_VOICE_IDS = new Set(STATIC_VOICE_PACKS.map(pack => pack.id));
const DEFAULT_STATIC_VOICE_ID = defaultVoicePackId();

/**
 * Factory defaults for the orbital — shared by the constructor and the
 * Rhythm & pace sheet's Default.
 * Exported so defaults can be asserted; silent default drift breaks e2e.
 */
export function createDefaultConfig() {
  return {
    text: null,
    textSource: null, // 'drop', 'paste', 'library', 'starter'
    // Launch origin (wayfinding): { view, icon, name } set by app.js
    // launch handlers (Vault / Library); null for plain sessions
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
      // Top-level mode: 'off' | 'focals' | 'attractor' | 'genesis' | 'living-flame' | 'interlocution'
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
      // configs (Vault archetypes) — never implied by a text.
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
    chunkMode: 'phrase'
  };
}

export class ChamberOrbital {
  constructor(container, options = {}) {
    console.log('[ChamberOrbital] Constructor called', container, options);
    this.container = container;
    this.onBeginSession = options.onBeginSession || (() => { });
    this.onNavigate = options.onNavigate || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getSettings = options.getSettings || (() => ({}));
    this.onSettingChange = options.onSettingChange || (() => { });
    this.onSettingsTransaction = options.onSettingsTransaction || (() => { });
    this.visualConsentScope = crypto.randomUUID();

    // Session configuration state (factory defaults; see createDefaultConfig)
    this.config = createDefaultConfig();

    // Restore the user's last-used settings (persisted at Begin) so
    // returning from a session never resets the controls to defaults
    this._applySavedPrefs();

    // Restore the loaded text too — without it the saved visual and
    // audio settings are stranded behind an empty text card after a
    // refresh. A launch that carries fresh text (Vault, Library)
    // overwrites this via loadText immediately after construction.
    this._applySavedText();
    this._ownLook = this._readingLook();

    // Open dialogs, innermost last: a sheet can open a panel over itself.
    this._modals = [];

    // The Chamber's single visual-control surface.
    this.visualNavigator = null;
    this._previewOptions = options.preview;
    this.preview = null;

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

    // A tone's delivery and waveform are not setup's to keep: an older save of them is not read, so no
    // choice is left that setup cannot show (the Workshop shapes a tone).
    const scalarKeys = ['wpm', 'curve', 'chunkMode', 'revealMode', 'soundscape', 'audioPreset', 'voiceId'];
    for (const key of scalarKeys) {
      if (saved[key] !== undefined) this.config[key] = saved[key];
    }
    this.config.soundscape = standInSound(this.config.soundscape);
    // RHYTHM DEFAULT MIGRATION: a Word saved without phraseDefault was the
    // old default, not a choice, and reads in phrases from now on. A Word
    // saved with it was chosen, and a Word under Fit is what Fit needs to
    // paint one word at a time; both are kept.
    if (!saved.phraseDefault && this.config.chunkMode === 'word'
      && this.getSettings()?.fontSize !== 'fit') this.config.chunkMode = 'phrase';

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
        // Living Text is the reader's Setting for every reading, not setup's: a setup reading always asks,
        // and an older save of the switch setup no longer shows is not read.
        livingText: { ...defaults.livingText },
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
        this.config.presentation = saved.presentation || null;
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
          presentation: this.config.presentation,
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
    const { wpm, curve, chunkMode, revealMode, soundscape, audioPreset, voiceId, visualInterlocution } = this.config;
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
      // phraseDefault: this rhythm was chosen with Phrase as the default
      phraseDefault: true,
      wpm, curve, chunkMode,
      revealMode: revealMode === 'progressive' ? 'progressive' : 'instant',
      soundscape, audioPreset, voiceId,
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
  }

  render() {
    console.log('[ChamberOrbital] Rendering HTML to container');
    this.container.innerHTML = `
      <div class="chamber-orbital reader-setup" role="main">
        <header class="reader-header">
          <div class="reader-header-inner">
            <span class="reader-lockup">
              <img src="${markUrl}" alt="" class="reader-mark">
              <span>SYBERLABS<span class="reader-lockup-sep"> / </span>RISE</span>
            </span>
            <div class="reader-header-actions">
              <!-- Launch origin chip (wayfinding back to Vault / Library) -->
              <div class="orbital-origin-slot" id="orbital-origin-slot">${this.renderOriginChip()}</div>
              <button type="button" class="orbital-back" data-action="back">
                ${ICON_BACK}
                <span>Home</span>
              </button>
            </div>
          </div>
        </header>

        <div class="reader-body">
          <div class="reader-column">
            <div class="setup-preview" aria-hidden="true"></div>

            <section class="reader-text" aria-label="Your text">
              <div class="text-source" id="text-source">
                ${this.renderTextSource()}
              </div>
            </section>

            <!-- FOUR CHOICES (CONSOLIDATED-READER §3): text, look, rhythm and
                 pace, Begin. Every other control is one sheet away. -->
            <section class="orbital-stage reader-choices" aria-label="How it reads">
              <span class="reader-label" id="reader-look-label">Look</span>
              <div class="look-tiles" id="look-tiles" role="group" aria-labelledby="reader-look-label">${this.renderTiles()}</div>
              <p class="reader-help look-line" id="look-line">${escapeHtml(this.getLookLine())}</p>
              <div class="reader-rows">
                ${this.renderSheetRow('look', 'Customize look', this.getLookStatus())}
                ${this.renderSheetRow('temporal', 'Rhythm &amp; pace', this.getTemporalStatus())}
              </div>
            </section>
          </div>
        </div>

        <!-- Begin -->
        <div class="orbital-actions">
          <div class="reader-actions-inner">
            <p class="reader-summary" id="reader-summary" aria-live="polite">
              <span class="reader-dot" aria-hidden="true"></span>
              <span id="reader-summary-text">${escapeHtml(this.getReaderSummary())}</span>
            </p>
            <div class="reader-buttons">
              <button type="button" class="btn-large" id="begin-btn" ${!this.config.text ? 'disabled' : ''}>
                <span>Begin reading</span>
                ${ICON_ARROW}
              </button>
            </div>
          </div>
        </div>

        <!-- Modals (hidden by default) -->
        <div class="orbital-modals">
          ${this.renderModals()}
        </div>
      </div>
    `;

    this.initVisualPanel();
    this.preview = createSetupPreview(this.container.querySelector('.setup-preview'), this._previewOptions);
    this._paintPreview();
  }

  /**
   * The preview: the field this configuration draws, in the colours the
   * reading opens in, under its first unit. An attractor left white takes the
   * theme's row, as the Chamber mounts it.
   */
  _paintPreview() {
    const visual = this.config.visualInterlocution || {};
    const theme = this._effectivePresentation().colorTheme;
    const colors = this.config.presentation?.colors || jevColors(theme, theme, theme);
    const engine = previewEngine(visual);
    const attractor = visual.attractor || {};
    const { text, sources, chunkMode, verseLines } = this.config;
    this.preview?.show({
      engine,
      style: engine !== 'attractor' ? {}
        : (!attractor.palette || attractor.palette === 'white'
          ? { ...attractor, ...themeEngine(theme, 'attractor') }
          : attractor),
      ground: colors.background,
      ink: colors.text,
      unit: firstUnit({ text, sources, chunkMode, verseLines })
    });
  }

  /** A row that opens a sheet or panel; its status says what is chosen there. */
  renderSheetRow(orbit, label, status) {
    return `
      <button type="button" class="orbit-node orbit-${orbit}" data-orbit="${orbit}"
        aria-haspopup="dialog" aria-controls="modal-${orbit}">
        <span class="orbit-content">
          <span class="orbit-label">${label}</span>
          <span class="orbit-status">${escapeHtml(status)}</span>
        </span>
        ${ICON_CHEVRON_RIGHT}
      </button>
    `;
  }

  getReaderSummary() {
    if (!this.config.text) return 'Choose a text to begin.';
    const name = this.config.textSource || 'Your text';
    return `${name} · ${this.getLookStatus()}`;
  }

  getLookStatus() {
    return lookById(lookOf(this.config))?.name || 'Custom';
  }

  getLookLine() {
    return lookById(lookOf(this.config))?.line || 'A look of your own: field, sound and type as you set them.';
  }

  getImageryLabel() {
    return this.config.visualInterlocution?.visualMode === 'focals' ? 'Glyph' : 'Imagery';
  }

  getTextMeta() {
    const words = this.getWordCount();
    const minutes = Math.max(1, Math.round(words / (this.config.wpm || 200)));
    return `${words.toLocaleString('en-US')} words · about ${minutes} min`;
  }

  _paintSummaries() {
    const summary = this.container.querySelector('#reader-summary-text');
    if (summary) summary.textContent = this.getReaderSummary();
    const meta = this.container.querySelector('.text-meta');
    if (meta && this.config.text) meta.textContent = this.getTextMeta();
  }

  /** Whether this screen may offer a look; a look limited to narrow screens says how narrow. */
  _offered(id) {
    const width = lookById(id)?.maxViewportWidth;
    return !width || (typeof window.matchMedia === 'function'
      && window.matchMedia(`(max-width: ${width}px)`).matches);
  }

  /**
   * The look this reading arrived in, or null. Read once per reading so the
   * tiles hold still while the reader chooses among them; a reading that
   * claims no type or colour has no look of its own.
   */
  _readingLook() {
    if (!this.config.presentation) return null;
    const id = lookOf(this.config);
    return id === 'custom' ? null : id;
  }

  /**
   * The three tiles: this reading's own look, else Gallery; then Plain; then
   * Inlay where it is offered, else Nocturne. A look already shown gives its
   * place to Gallery, then Nocturne.
   */
  _tileLooks() {
    const own = this._ownLook;
    const first = own && own !== 'plain' && this._offered(own) ? own : 'gallery';
    const third = this._offered('inlay') ? 'inlay' : 'nocturne';
    return [...new Set([first, 'plain', third, 'gallery', 'nocturne'])].slice(0, 3);
  }

  /**
   * The look tiles. Which one is marked is READ OFF the configuration
   * (`lookOf`) rather than remembered, so no tile goes on claiming a look the
   * reader has already adjusted away from.
   */
  renderTiles() {
    const current = lookOf(this.config);
    return this._tileLooks().map(id => {
      const look = lookById(id);
      const palette = JEV_PALETTES[look.config.presentation.colorTheme];
      const field = look.config.visualInterlocution.visualMode !== 'off';
      return `
        <button type="button" class="look-tile" data-look="${escapeHtml(id)}" aria-pressed="${id === current}">
          <span class="look-tile-swatch${field ? ' has-field' : ''}" aria-hidden="true"
            style="--look-bg:${palette.background};--look-ink:${palette.text};--look-accent:${palette.accent}"></span>
          <span class="look-tile-name">${escapeHtml(look.name)}</span>
          <span class="look-tile-mark" aria-hidden="true"></span>
        </button>
      `;
    }).join('');
  }

  _paintTiles() {
    const row = this.container.querySelector('#look-tiles');
    if (row) row.innerHTML = this.renderTiles();
  }

  /**
   * The colour and size the reading will open in: its own where it claims
   * them, else the classic theme and the reader's own Settings size.
   */
  _effectivePresentation() {
    const claimed = this.config.presentation || {};
    return {
      colorTheme: claimed.colorTheme || 'classic',
      fontSize: claimed.fontSize || resolveFontSize(this.getSettings()?.fontSize)
    };
  }

  /** Repaint everything that names or marks the look the configuration is in. */
  _syncLookRow() {
    const current = lookOf(this.config);
    const presentation = this._effectivePresentation();
    const mark = (selector, key, value) => this.container.querySelectorAll(selector).forEach(el => {
      el.setAttribute('aria-pressed', String(value !== undefined && el.dataset[key] === value));
    });
    mark('[data-look]', 'look', current);
    mark('[data-look-option]', 'lookOption', current);
    mark('[data-colour]', 'colour', presentation.colorTheme);
    mark('[data-look-size]', 'lookSize', presentation.fontSize);
    this.container.querySelectorAll('[data-look-option]').forEach(option => {
      option.hidden = !this._offered(option.dataset.lookOption);
    });
    const fit = this.container.querySelector('[data-look-size="fit"]');
    if (fit) fit.hidden = current !== 'inlay';
    const lab = this.container.querySelector('[data-action="open-visual-lab"]');
    if (lab) lab.hidden = current !== 'flame';
    const line = this.container.querySelector('#look-line');
    if (line) line.textContent = this.getLookLine();
    const status = this.container.querySelector('.orbit-look .orbit-status');
    if (status) status.textContent = this.getLookStatus();
    const imagery = this.container.querySelector('.orbit-visual .orbit-label');
    if (imagery) imagery.textContent = this.getImageryLabel();
    this._paintRhythmLocks();
    this._paintSummaries();
    this._paintPreview();
  }

  /**
   * Choose a look. The config it produces goes through exactly the paths a
   * hand-built one goes through: this method sets no field the panels and
   * the session compiler do not already validate.
   */
  chooseLook(id) {
    this.config = applyLook(this.config, id);
    // The visual panel keeps its own copy of the visual orbit, and its
    // change event is what writes the normalized truth back here. Telling
    // it leaves one answer in the room rather than two.
    if (this.visualNavigator) this.visualNavigator.setConfig(this.config.visualInterlocution);
    this._normalizeAudioExclusivity();
    this.syncUIWithConfig();
    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('audio');
    this.updateOrbitStatus('visual');
    this._persistPrefs();
  }

  /** One of the nine themes for this reading: ink, ground and accent together. */
  setColour(theme) {
    this.config.presentation = {
      ...(this.config.presentation || {}),
      colorTheme: theme,
      textColor: theme,
      backgroundColor: theme,
      colors: jevColors(theme, theme, theme)
    };
    this._syncLookRow();
    this._persistPrefs();
  }

  /** The text size for this reading; the reader's own Settings size is left alone. */
  setSize(fontSize) {
    this.config.presentation = { ...(this.config.presentation || {}), fontSize };
    this._syncLookRow();
    this._persistPrefs();
  }

  /** The Rhythm & pace sheet's Default: its own four choices, and nothing else; Inlay keeps its word. */
  resetRhythm() {
    const inlay = lookOf(this.config) === 'inlay';
    const { wpm, curve, chunkMode, revealMode } = createDefaultConfig();
    Object.assign(this.config, { wpm, curve, chunkMode: inlay ? 'word' : chunkMode, revealMode });
    this.syncUIWithConfig();
    this.updateOrbitStatus('temporal');
    this._persistPrefs();
  }

  /**
   * Origin chip — shows where the loaded configuration came from and
   * returns there on click. Origin metadata is app-authored (not user
   * data). Empty for plain orbital sessions.
   */
  renderOriginChip() {
    const origin = this.config.origin;
    // The back button already says Home; a chip for Home would say it twice.
    if (!origin || !origin.view || origin.view === 'home') return '';
    return `
      <button type="button" class="orbital-origin-chip" data-action="origin-return" title="Return to ${origin.name}">
        <span class="origin-chip-label">${origin.name}</span>
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
          <h1 class="text-name" title="${escapeHtml(this.config.textSource || 'Text loaded')}">${escapeHtml(this.config.textSource || 'Text loaded')}</h1>
          <p class="text-meta">${this.getTextMeta()}</p>
          <button type="button" class="reader-link text-change" data-action="library">Change text</button>
        </div>
      `;
    }

    return `
      <div class="text-empty">
        <h1 class="text-name">No text chosen</h1>
        <p class="text-meta">Pick something from the Library to read.</p>
        <button type="button" class="reader-link text-change" data-action="library">Choose a text</button>
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
    const currentLook = lookOf(this.config);
    const presentation = this._effectivePresentation();
    return `
      <!-- Customize look: a side panel on a desk, a bottom sheet on a phone -->
      <div class="orbital-modal reader-sheet" id="modal-look" hidden>
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-look-title">
          <div class="modal-header">
            <h2 id="modal-look-title">Customize look</h2>
            <button type="button" class="modal-close" data-close="look" aria-label="Close Customize look">${ICON_CLOSE}</button>
          </div>
          <div class="modal-body">
            <div class="config-section">
              <span class="config-label" id="sheet-look-label">Look</span>
              <div class="sheet-looks" role="group" aria-labelledby="sheet-look-label">
                ${LOOKS.map(look => `
                <button type="button" class="chunk-option" data-look-option="${escapeHtml(look.id)}"
                  aria-pressed="${look.id === currentLook}" ${this._offered(look.id) ? '' : 'hidden'}>${escapeHtml(look.name)}</button>`).join('')}
              </div>
            </div>

            <div class="config-section">
              <span class="config-label" id="sheet-colour-label">Colour</span>
              <div class="sheet-colours" role="group" aria-labelledby="sheet-colour-label">
                ${Object.entries(JEV_PALETTES).map(([id, palette]) => `
                <button type="button" class="sheet-colour" data-colour="${id}"
                  aria-pressed="${id === presentation.colorTheme}" aria-label="${this.capitalizeFirst(id)}" title="${this.capitalizeFirst(id)}"
                  style="--swatch-bg:${palette.background};--swatch-accent:${palette.accent}"></button>`).join('')}
              </div>
            </div>

            <div class="config-section sheet-rows">
              ${this.renderSheetRow('audio', 'Sound', this.getAudioStatus())}
              ${this.renderSheetRow('visual', this.getImageryLabel(), this.getVisualPreview())}
            </div>

            <div class="config-section">
              <span class="config-label" id="sheet-size-label">Size</span>
              <div class="chunk-options sheet-sizes" role="group" aria-labelledby="sheet-size-label">
                ${LOOK_SIZES.map(chip => `
                <button type="button" class="chunk-option" data-look-size="${chip.fontSize}"
                  aria-pressed="${chip.fontSize === presentation.fontSize}"
                  ${chip.fontSize === 'fit' && currentLook !== 'inlay' ? 'hidden' : ''}>${chip.label}</button>`).join('')}
              </div>
            </div>

            <button type="button" class="reader-link sheet-lab" data-action="open-visual-lab"
              ${currentLook === 'flame' ? '' : 'hidden'}>Open in Visual Lab ›</button>
          </div>
        </div>
      </div>

      <!-- Visual Modal -->
      <div class="orbital-modal" id="modal-visual" hidden>
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-visual-title">
          <div class="modal-header">
            <h2 id="modal-visual-title">Visuals</h2>
            <button type="button" class="modal-close" data-close="visual" aria-label="Close visuals settings">${ICON_CLOSE}</button>
          </div>
          <div class="modal-body">
            <!-- Visual Interlocution -->
            <div id="orbital-visual-navigator" class="config-section"></div>
          </div>
        </div>
      </div>

      <!-- Audio Modal -->
      <div class="orbital-modal" id="modal-audio" hidden>
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-audio-title">
          <div class="modal-header">
            <h2 id="modal-audio-title">Sound</h2>
            <button type="button" class="modal-close" data-close="audio" aria-label="Close sound settings">${ICON_CLOSE}</button>
          </div>
          <div class="modal-body">
            <!-- One sound list (RDR-024): Silence, the soundscapes and the
                 tones. One choice; choosing any sound rests the others. -->
            ${SOUND_GROUPS.map(group => `
            <div class="config-section" data-sound-group="${group.id}">
              ${group.id === 'silence' ? '' : `<div class="config-label-row">
                <span class="config-label">${group.label}</span>
                ${group.id === 'tones' ? `<span class="config-info" tabindex="0" role="img" aria-label="Presets target specific brainwave frequencies. Focus (Alpha 10Hz) enhances concentration. Deep (Theta 6Hz) promotes meditation. Gateway (Delta 2Hz) yields deep flow states." data-tooltip="Presets target specific brainwave frequencies. Focus (Alpha 10Hz) enhances concentration. Deep (Theta 6Hz) promotes meditation. Gateway (Delta 2Hz) yields deep flow states.">?</span>` : ''}
              </div>`}
              <div class="audio-preset-options soundscape-options">
                ${group.entries.map(sound => this.renderSoundChoice(sound)).join('')}
              </div>
            </div>`).join('')}
            <!-- Chant is Chapel-exclusive: recorded sacred music
                 belongs to the room built for it, not to ambient
                 texture under arbitrary text — the same scoping
                 contract as chapel-* imagery. Rendered always,
                 shown only for Chapel launches (loadText sets
                 provenance after the first render; syncUIWithConfig
                 keeps the hidden state honest). -->
            <div class="config-section chant-only" ${this.isChapelSession() ? '' : 'hidden'}>
              <span class="config-label">Chant</span>
              <div class="audio-preset-options soundscape-options">
                <button class="audio-preset-option chant-only ${this.config.soundscape === 'chant-gregorian' ? 'active' : ''}" data-soundscape="chant-gregorian"
                  ${this.isChapelSession() ? '' : 'hidden'}
                  title="Recorded Gregorian chant with long breaths of silence between pieces">
                  <span class="preset-label">Gregorian</span>
                </button>
                <button class="audio-preset-option chant-only ${this.config.soundscape === 'chant-znamenny' ? 'active' : ''}" data-soundscape="chant-znamenny"
                  ${this.isChapelSession() ? '' : 'hidden'}
                  title="Znamenny chant of the Moscow Patriarchate choir — long breaths of silence between pieces">
                  <span class="preset-label">Znamenny</span>
                </button>
              </div>
            </div>
            <!-- Recitation (RECITATION-SPEC): static voice packs, not speechSynthesis. -->
            <div class="config-section" data-recitation-capability
              ${recitationAvailable ? '' : 'hidden'}>
              <label class="config-label">Voice</label>
              <div class="chunk-options">
                <button class="chunk-option ${!recitationEnabled ? 'active' : ''}"
                  data-recitation="off">None</button>
                <button class="chunk-option ${recitationEnabled ? 'active' : ''}"
                  data-recitation="on" ${recitationAvailable ? '' : 'disabled'}
                  title="${recitationAvailable ? 'Use a bundled static voice pack' : 'No static voice pack is installed in this build'}">Recited</button>
              </div>
              <p class="config-note text-mist" data-recitation-note ${recitationEnabled ? '' : 'hidden'}>
                Rhythm: Phrase (recited). The voice is recorded one phrase at a
                time, built into this release, so the reading is cut in phrases.
                Turn the voice off to read by word or by sentence.
              </p>
            </div>

            <!-- Only voice packs actually present in this deployment. -->
            <div class="config-section" id="voice-select-section" ${recitationEnabled ? '' : 'hidden'}>
              <label class="config-label" for="voice-select">Voice pack</label>
              <select id="voice-select" class="voice-select" ${recitationAvailable ? '' : 'disabled'}>
                ${voiceOptions || '<option value="">No voice pack installed</option>'}
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Rhythm & pace: how the text is cut, and how fast it comes -->
      <div class="orbital-modal reader-sheet" id="modal-temporal" hidden>
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-temporal-title">
          <div class="modal-header">
            <h2 id="modal-temporal-title">Rhythm &amp; pace</h2>
            <button type="button" class="modal-close" data-close="temporal" aria-label="Close Rhythm and pace">${ICON_CLOSE}</button>
          </div>
          <div class="modal-body">
            <!-- Chunking.
                 A DISABLED CONTROL MUST SAY WHO DISABLED IT.
                 Word and Sentence are unavailable while Recitation is
                 on, and the reason was written down in the AUDIO panel
                 — a different orb, behind a different tap. From here
                 the two buttons simply did not respond, which is
                 indistinguishable from broken. The lock is drawn on
                 the control it applies to, and named. -->
            <div class="config-section">
              <label class="config-label">Rhythm</label>
              <div class="chunk-options">
                <button class="chunk-option ${this.config.chunkMode === 'phrase' ? 'active' : ''}" data-chunk="phrase">Phrase</button>
                <button class="chunk-option ${this.config.chunkMode === 'sentence' ? 'active' : ''} ${recitationEnabled ? 'is-locked' : ''}" data-chunk="sentence"
                  ${recitationEnabled ? 'disabled title="Recitation is spoken in phrases"' : ''}>${recitationEnabled ? LOCK_MARK : ''}Sentence</button>
                <button class="chunk-option ${this.config.chunkMode === 'word' ? 'active' : ''} ${recitationEnabled ? 'is-locked' : ''}" data-chunk="word"
                  ${recitationEnabled ? 'disabled title="Recitation is spoken in phrases"' : ''}>${recitationEnabled ? LOCK_MARK : ''}Word</button>
              </div>
              <p class="config-note text-mist" data-chunk-lock-note ${recitationEnabled ? '' : 'hidden'}>${RECITATION_LOCK_NOTE}</p>
            </div>

            <!-- Pacing -->
            <div class="config-section">
              <label class="input-label">
                <span>Pace</span>
                <span class="input-label-value font-mono" id="wpm-val">${this.config.wpm} WPM</span>
              </label>
              <input type="range" id="wpm-slider" class="slider" min="100" max="500" value="${this.config.wpm}" step="10" aria-label="Pace in words per minute">
              <div class="config-notice text-fog font-mono" style="font-size: 12px; margin-top: 0.5rem;">
                Adjustable while reading with the arrow keys
              </div>
            </div>

            <!-- Curve -->
            <div class="config-section">
              <label class="config-label">Curve</label>
              <div class="curve-options">
                ${PACE_CURVE_IDS.map(id => `
                <button class="curve-option ${this.config.curve === id ? 'active' : ''}" data-curve="${id}">
                  <span class="curve-icon">${svgIcon(`<path d="${CURVE_OPTIONS[id].path}"></path>`)}</span>
                  <span>${CURVE_OPTIONS[id].label}</span>
                </button>`).join('')}
              </div>
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

            <div class="sheet-actions">
              <button type="button" class="reader-link" data-action="rhythm-default">Default</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initVisualPanel() {
    try {
      const container = this.container.querySelector('#orbital-visual-navigator');
      console.log('[ChamberOrbital] initVisualPanel - container found:', !!container);
      if (!container) {
        console.error('[ChamberOrbital] orbital-visual-navigator not found in DOM!');
        return;
      }
      if (!this.visualNavigator) {
        console.log('[ChamberOrbital] Instantiating VisualNavigator...');
        this.visualNavigator = new VisualNavigator(container, {
          visualConfig: this.config.visualInterlocution,
          locked: !this.config.text,
          lockedMessage: 'Choose a reading before bringing visuals into the Reader.',
          programInfo: this.config.visualProgram?.segments?.length
            ? { episodes: this.config.visualProgram.segments.length }
            : null,
          readingVisualDomain: this.config.readingVisualIdentity?.domain || null,
          onOpenPersonal: () => this.onNavigate('workshop'),
          onClose: () => this.closeModal('visual'),
          getSampleText: () => this.config.text || '',
          getSettings: this.getSettings,
          onSettingChange: this.onSettingChange,
          onTextMaterialTransaction: transaction => this.applyTextMaterialTransaction(transaction),
          onChange: (config) => {
            const previouslyHeld = isLaunchHeldFocal(
              this.config.visualInterlocution?.focals
            );
            const releasedHeldFocal = previouslyHeld
              && !isLaunchHeldFocal(config?.focals);
            if (releasedHeldFocal) {
              this._unlockVisualProgramAfterFocalRelease();
            }
            // Store the Navigator's config verbatim — never mix in activeTypes
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
            this._syncLookRow();
            // Visual settings are the most-edited dials — durable immediately
            this._persistPrefs();
          }
        });
        console.log('[ChamberOrbital] Navigator mounted; HTML length:', container.innerHTML.length);
      }
    } catch (err) {
      console.error('[ChamberOrbital] Error initializing VisualNavigator:', err);
    }
  }

  applyTextMaterialTransaction({ settings = {}, temporal = null, visualConfig }) {
    this.onSettingsTransaction(settings);
    if (temporal?.chunkMode) this.config.chunkMode = temporal.chunkMode;
    if (temporal?.recitation === false) this.config.recitation = { enabled: false };
    this.config.visualInterlocution = visualConfig;
    this.syncUIWithConfig();
    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('visual');
    this._syncLookRow();
    this._persistPrefs();
  }

  getVisualPreview() {
    if (!this.config) return 'Configuration missing';

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
      return `Focals · ${glyph}`;
    }

    if (mode === 'attractor') {
      return `Attractor · ${this.capitalizeFirst(vi.attractor?.system || 'aizawa')}`;
    }

    if (mode === 'genesis') {
      return `Genesis · ${this.capitalizeFirst(vi.genesis?.preset || 'random')}`;
    }

    if (mode === 'living-flame') return 'Living Flame';

    if (mode === 'interlocution') {
      // ONE ENGINE HAS A NAME; A SHELF FULL OF THEM HAS A FAMILY.
      //
      // The family alone — 'Rhythmic' named the mechanism rather than the
      // choice, and paired with a family it was the one status long enough to
      // need two lines on the disc. But a reader who chose exactly one engine
      // chose THAT engine, and 'Procedural' tells them less than the disc has
      // room for. Attractor arrives here now rather than through a mode of its
      // own, and would otherwise have lost its name on the way.
      const inter = vi.interlocution || {};
      const only = (inter.procedural || []).length === 1 && !(inter.sourced || []).length
        ? leafById(inter.procedural[0])?.label
        : null;
      if (only) return only;
      const family = inter.sourceFamily || 'procedural';
      return this.capitalizeFirst(family);
    }

    return 'Off';
  }

  /** The one sound this reading plays: its soundscape, else its tone, else `none`. */
  _soundId() {
    const { soundscape, audioPreset } = this.config;
    if (soundscape && soundscape !== 'none') return soundscape;
    return audioPreset && audioPreset !== 'silent' ? audioPreset : 'none';
  }

  /** One choice in the Sound panel; a tone sets the tone, anything else the soundscape. */
  renderSoundChoice(sound) {
    const key = sound.kind === 'tone' ? 'data-audio-preset' : 'data-soundscape';
    return `
      <button type="button" class="audio-preset-option ${this._soundId() === sound.id ? 'active' : ''}" ${key}="${sound.id}">
        <span class="preset-label">${escapeHtml(sound.name)}</span>
      </button>`;
  }

  getAudioStatus() {
    const chant = { 'chant-gregorian': 'Gregorian', 'chant-znamenny': 'Znamenny' };
    const id = this._soundId();
    return soundOf(id)?.name || chant[id] || this.capitalizeFirst(id);
  }

  getTemporalStatus() {
    // A recitation is recorded phrase by phrase; the row says so rather than
    // showing a Phrase the reader did not choose.
    const rhythm = this.config.recitation?.enabled === true
      ? 'Phrase (recited)'
      : CHUNK_LABELS[this.config.chunkMode] || CHUNK_LABELS.phrase;
    return `${rhythm} · ${this.config.wpm} wpm`;
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
    // multiply across shared-container reconstruction.
    this._eventController?.abort();
    this._eventController = new AbortController();
    this._listen(window, 'beforeunload', this._boundPersist);

    // Back button
    this._listen(this.container.querySelector('[data-action="back"]'), 'click', () => {
      this.getAudioEngine()?.playClick();
      this.onNavigate('home');
    });

    // Origin chip (delegated — the chip re-renders on loadText)
    this._listen(this.container, 'click', (e) => {
      if (e.target.closest('[data-action="origin-return"]') && this.config.origin?.view) {
        this.getAudioEngine()?.playClick();
        if (this.config.origin.data) {
          this.onNavigate(this.config.origin.view, this.config.origin.data);
        } else {
          this.onNavigate(this.config.origin.view);
        }
      }
    });

    // Text source actions
    this.attachTextSourceEvents();

    // Looks, colours and sizes (delegated: the tiles repaint)
    this.attachLookEvents();

    // Orbit node clicks
    this.attachOrbitEvents();

    // Begin button
    this._listen(this.container.querySelector('#begin-btn'), 'click', () => {
      if (this.config.text) {
        this.getAudioEngine()?.playClick();
        this.beginSession();
      }
    });

    // Modal events
    this.attachModalEvents();
  }

  attachTextSourceEvents() {
    // Change text: the Library is where another text is chosen
    this._listen(this.container.querySelector('[data-action="library"]'), 'click', () => {
      this.getAudioEngine()?.playHiss();
      this.onNavigate('library');
    });
  }

  attachLookEvents() {
    this._listen(this.container, 'click', (e) => {
      const look = e.target.closest('[data-look], [data-look-option]');
      const colour = e.target.closest('[data-colour]');
      const size = e.target.closest('[data-look-size]');
      if (look) {
        this.getAudioEngine()?.playClick();
        this.chooseLook(look.dataset.look || look.dataset.lookOption);
      } else if (colour) {
        this.getAudioEngine()?.playClick();
        this.setColour(colour.dataset.colour);
      } else if (size) {
        this.getAudioEngine()?.playClick();
        this.setSize(size.dataset.lookSize);
      } else if (e.target.closest('[data-action="open-visual-lab"]')) {
        this.getAudioEngine()?.playClick();
        this.onNavigate('visual-lab');
      } else if (e.target.closest('[data-action="rhythm-default"]')) {
        this.getAudioEngine()?.playClick();
        this.resetRhythm();
      }
    });

    // Crossing the narrowest look's limit changes which looks are offered.
    const narrow = Number.isFinite(NARROWEST_LIMIT) && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${NARROWEST_LIMIT}px)`)
      : null;
    if (narrow?.addEventListener) {
      this._listen(narrow, 'change', () => {
        this._paintTiles();
        this._syncLookRow();
      });
    }
  }

  attachOrbitEvents() {
    const nodes = this.container.querySelectorAll('.orbit-node');
    nodes.forEach(node => {
      this._listen(node, 'click', () => {
        this.getAudioEngine()?.playClick();
        const orbit = node.dataset.orbit;
        this.openModal(orbit);
      });
    });
  }


  attachModalEvents() {
    const closeBtns = this.container.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => {
      this._listen(btn, 'click', () => {
        this.getAudioEngine()?.playHiss();
        this.closeModal(btn.dataset.close);
      });
    });

    // The two sheets keep focus inside and close on Escape themselves; the
    // panels they open close through the router's Escape (handleEscape).
    for (const sheet of ['look', 'temporal']) {
      const dialog = this.container.querySelector(`#modal-${sheet} [role="dialog"]`);
      this._listen(dialog, 'keydown', event => this._sheetKeydown(event, sheet, dialog));
    }

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

  attachAudioModalEvents() {
    // One sound at a time: a soundscape is a finished mix and never shares
    // the room with the tone stack (steady tones at the same carrier simply
    // mask it), so every choice sets both fields.
    this.container.querySelectorAll('#modal-audio [data-soundscape], #modal-audio [data-audio-preset]').forEach(opt => {
      this._listen(opt, 'click', () => {
        this.getAudioEngine()?.playHiss();
        this.config.soundscape = opt.dataset.soundscape || 'none';
        this.config.audioPreset = opt.dataset.audioPreset || 'silent';
        this._paintSound();
        this.updateOrbitStatus('audio');
        this._syncLookRow();
      });
    });

    // Static voice-pack controls are bound with the rest of Recitation
    // in attachConfigEvents.
  }

  /**
   * The rhythms the reading cannot take, locked where the reader finds them dead and named: a recitation is
   * recorded phrase by phrase, and Inlay paints one word at a time. The lock is drawn on the button, in the
   * Rhythm sheet, not in the panel that caused it; its mark is its own element (a text node for the gap would
   * have taken the label with it when removed).
   */
  _paintRhythmLocks() {
    const recited = this.config.recitation?.enabled === true;
    const inlay = !recited && lookOf(this.config) === 'inlay';
    const keep = recited ? 'phrase' : inlay ? 'word' : null;
    const reason = recited ? 'Recitation is spoken in phrases' : 'Inlay paints one word at a time';
    this.container.querySelectorAll('[data-chunk]').forEach(chunk => {
      chunk.classList.toggle('active', chunk.dataset.chunk === this.config.chunkMode);
      const locked = keep !== null && chunk.dataset.chunk !== keep;
      chunk.disabled = locked;
      chunk.classList.toggle('is-locked', locked);
      chunk.title = locked ? reason : '';
      const mark = chunk.querySelector('.chunk-lock');
      if (locked && !mark) chunk.insertAdjacentHTML('afterbegin', LOCK_MARK);
      else if (!locked && mark) mark.remove();
    });
    const note = this.container.querySelector('[data-chunk-lock-note]');
    if (!note) return;
    note.hidden = keep === null;
    if (keep !== null) note.textContent = recited ? RECITATION_LOCK_NOTE : INLAY_LOCK_NOTE;
  }

  /** Mark the one sound chosen. A tone's delivery and waveform are shaped in the Workshop. */
  _paintSound() {
    const id = this._soundId();
    this.container.querySelectorAll('#modal-audio [data-soundscape], #modal-audio [data-audio-preset]').forEach(opt => {
      opt.classList.toggle('active', (opt.dataset.soundscape || opt.dataset.audioPreset) === id);
    });
  }

  attachTemporalModalEvents() {
    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    this._listen(wpmSlider, 'input', () => {
      this.config.wpm = parseInt(wpmSlider.value, 10);
      wpmVal.textContent = `${wpmSlider.value} WPM`;
      this.updateOrbitStatus('temporal');
      this._syncLookRow();
    });

    // Curve options
    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        this.getAudioEngine()?.playHiss();
        this.config.curve = opt.dataset.curve;
        curveOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this._syncLookRow();
      });
    });

    // Chunk mode
    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        this.getAudioEngine()?.playHiss();
        this.config.chunkMode = opt.dataset.chunk;
        chunkOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.updateOrbitStatus('temporal');
        this._syncLookRow();
      });
    });

    const revealOptions = this.container.querySelectorAll('[data-reveal]');
    revealOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        this.getAudioEngine()?.playHiss();
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
    const voiceSection = this.container.querySelector('#voice-select-section');
    recitationOptions.forEach(opt => {
      this._listen(opt, 'click', () => {
        if (opt.disabled) return;
        this.getAudioEngine()?.playHiss();
        const enabled = opt.dataset.recitation === 'on';
        this.config.recitation = { enabled };
        if (enabled) this.config.chunkMode = 'phrase';
        recitationOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this._paintRhythmLocks();
        if (recitationNote) recitationNote.hidden = !enabled;
        this.updateOrbitStatus('temporal');
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

  /** The innermost open dialog, or null. */
  get activeModal() {
    return this._modals.at(-1) ?? null;
  }

  openModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = false;
      this._modals = [...this._modals.filter(open => open !== orbit), orbit];
      this.preview?.suspend('sheet');
      if (orbit === 'visual') this.visualNavigator?.enterStage();
      modal.querySelector('.modal-close')?.focus();
    }
  }

  closeModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = true;
      this._modals = this._modals.filter(open => open !== orbit);
      if (!this._modals.length) this.preview?.resume('sheet');
      if (orbit === 'visual') this.visualNavigator?.leaveStage();
      this.container.querySelector(`[data-orbit="${orbit}"]`)?.focus();
    }
  }

  /** Escape closes a sheet; Tab and Shift+Tab wrap inside it. */
  _sheetKeydown(event, sheet, dialog) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeModal(sheet);
      return;
    }
    if (event.key !== 'Tab') return;
    const reachable = [...dialog.querySelectorAll(FOCUSABLE)]
      .filter(el => !el.disabled && !el.closest('[hidden]'));
    if (!reachable.length) return;
    const first = reachable[0];
    const last = reachable[reachable.length - 1];
    const active = dialog.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
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
    this._paintSummaries();
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

    this._paintRhythmLocks();
    this.container.querySelectorAll('[data-reveal]').forEach(opt => {
      const selected = this.config.revealMode === 'progressive' ? 'progressive' : 'instant';
      opt.classList.toggle('active', opt.dataset.reveal === selected);
    });

    this._paintSound();

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
    this._syncLookRow();
  }

  loadText(text, source, config = {}) {
    this.visualConsentScope = crypto.randomUUID();

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
    // A composed reading's opening look (face, size, colours), carried to
    // Begin untouched. The Chamber holds it as a lens the reader can take
    // back key by key (session-presentation.js); it is never a preference.
    this.config.presentation = config.presentation || null;
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

      // Update the Visual Navigator if it exists.
      if (this.visualNavigator) {
        this.visualNavigator.setConfig(this.config.visualInterlocution);
        // A curated visual program (a Gospel chapter's pericope
        // schedule) makes the panel show its read-only Special
        // Collection banner. Cleared for ordinary readings.
        const program = this.config.visualProgram;
        this.visualNavigator.setProgramInfo(
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

    this._ownLook = this._readingLook();
    this._paintTiles();

    // Sync HTML modal elements with new config state
    this.syncUIWithConfig();

    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('audio');
    this.updateOrbitStatus('visual');

    // Unlock visual interlocution
    if (this.visualNavigator) {
      this.visualNavigator.setLocked(false);
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
      console.log('[ChamberOrbital] Begin button enabled');
    }
  }

  /**
   * Reset every piece of launch-scoped visual IDENTITY — the pills,
   * the pericope program, the Chapel-domain memory — so it never
   * outlives the reading that created it. Called on every load, before the
   * new source's own visual selection (if any) is applied.
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
    if (this.visualNavigator) {
      this.visualNavigator.clearLaunchVisualIdentity();
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

  beginSession() {
    this.preview?.suspend('begin');
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
      ...(this.config.presentation ? { presentation: this.config.presentation } : {}),
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
    if (this.visualNavigator) {
      this.visualNavigator.destroy();
    }
    this.preview?.destroy();
  }
}
