import {
  bandTravelPx,
  clampBandFraction,
  readBandOffsetSetting,
  writeBandOffsetSetting
} from '../../core/band-offset.js';
import { visualCortex } from '../../visuals/visual-cortex.js';
import { parsePageCollectionId, sampleWorkEngine } from '../../visuals/work-engines.js';
import { TIME_SCALE as WORK_ENGINE_TIME_SCALE } from '../../visuals/work-engine-field.js';
import { MemoryCore } from '../../core/memory.js';
import { AttractorField } from '../../visuals/attractor.js';
import { NightStreaks } from '../../visuals/night-streaks.js';
import { KleeField } from '../../visuals/klee-field.js';
import { VisualFieldDirector } from '../../visuals/visual-field-director.js';
import { escapeHtml } from '../../core/sanitize.js';
import { createDive } from '../../core/dive.js';
import { undercurrentAt } from '../../core/undercurrent.js';
import { renderUndercurrent } from './chamber-undercurrent.js';
// The reveal and its emphasis notation are pure logic — no DOM, no
// audio — so they live in core and are tested without a browser.
import {
  splitWords, stripEmphasis, sizeAtomScale, revealBudget, revealSchedule
} from '../../core/recitation.js';
import { Voice } from '../../audio/voice.js';
import { audioDiag } from '../../core/audio-diagnostics.js';

/**
 * The bar's icons, drawn rather than typed.
 *
 * These were text glyphs — U+2699 for the gear, U+25B6 and U+23F8 for
 * transport, U+2715 for the exit. On a desktop the system resolves them
 * from a text font and they read as line art; on iOS the emoji font
 * claims them first, so the same bar arrives as a row of small colour
 * cartoons. There is no font stack that reliably prevents that, because
 * the character genuinely has an emoji presentation and the platform is
 * entitled to prefer it.
 *
 * So the bar no longer asks for a character. Each icon is a path on a
 * 24-unit grid, stroked in currentColor so hover, the engaged state and
 * every theme keep working exactly as they did for the glyphs.
 */
const ICON_STROKE = 'fill="none" stroke="currentColor" stroke-width="1.5" '
  + 'stroke-linecap="round" stroke-linejoin="round"';

const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" ${extra || ICON_STROKE} `
  + `aria-hidden="true" focusable="false">${body}</svg>`;

/** Eight teeth on a ring. A gear reads at 18px only if the teeth are heavier than the ring. */
const GEAR_TEETH = [
  [18.5, 12, 21, 12], [16.6, 16.6, 18.36, 18.36],
  [12, 18.5, 12, 21], [7.4, 16.6, 5.64, 18.36],
  [5.5, 12, 3, 12], [7.4, 7.4, 5.64, 5.64],
  [12, 5.5, 12, 3], [16.6, 7.4, 18.36, 5.64]
].map(([x1, y1, x2, y2]) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="2.1"/>`).join('');

export const ICONS = Object.freeze({
  play: svg('<path d="M9 6.4 18.2 12 9 17.6Z"/>',
    'fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"'),
  pause: svg('<rect x="8.6" y="6.4" width="2.6" height="11.2" rx="1.3"/>'
    + '<rect x="12.8" y="6.4" width="2.6" height="11.2" rx="1.3"/>',
    'fill="currentColor" stroke="none"'),
  gear: svg(`<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.6"/>${GEAR_TEETH}`),
  exit: svg('<path d="M7 7 17 17M17 7 7 17"/>'),
  page: svg('<rect x="4.5" y="4" width="15" height="16" rx="1.6"/>'
    + '<path d="M8 9h8M8 12.5h8M8 16h5"/>'),
  elongate: svg('<path d="M12 4.5v15M12 4.5 8.8 7.7M12 4.5l3.2 3.2'
    + 'M12 19.5l-3.2-3.2M12 19.5l3.2-3.2"/>'),
  kaleidoscope: svg('<path d="M12 3.5v17M4.64 7.75l14.72 8.5M4.64 16.25l14.72-8.5"/>'
    + '<circle cx="12" cy="12" r="2.2"/>'),
  fullscreen: svg('<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>'),
  spark: svg('<path d="M12 4v4M12 16v4M4 12h4M16 12h4M7.1 7.1l2.1 2.1M14.8 14.8l2.1 2.1'
    + 'M16.9 7.1l-2.1 2.1M9.2 14.8l-2.1 2.1"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  dive: svg('<path d="M4.5 9.5c2.5-2 5-2 7.5 0s5 2 7.5 0"/>'
    + '<path d="M4.5 15c2.5-2 5-2 7.5 0s5 2 7.5 0"/>'),
  pace: svg('<path d="M4.5 17a7.5 7.5 0 1 1 15 0"/><path d="m12 17 3.6-5.2"/>')
});

import { livingTextAppearance, ensureTextContrast, scoreAtoms, planInterlocution } from '../../core/conductor.js';
import { cueForAtom, VisualScheduleController } from '../../core/visual-scheduler.js';
import {
  authoredVisualTransition,
  isContinuousPresentation
} from '../../core/visual-presence.js';
import {
  MovementScheduleController,
  AudioScheduleController
} from '../../core/journey-schedulers.js';
import {
  applyVisualViewportBottom,
  clearVisualViewportBottom
} from '../../core/visual-viewport.js';
import { hasNextLibraryDivision } from '../../core/reading-continuation.js';
import { READING_PACE } from '../../core/reading-limits.js';
import { resolveChamberStreamFace } from '../../core/chamber-stream-face.js';
import { beginStep } from '../../core/begin-steps.js';
import { clearChromeTheme, paintChromeTheme } from '../../core/chrome-theme.js';
import {
  estimateGlyphBox,
  fitWordAtomPx,
  FONT_SIZE_CHIPS,
  isChamberWordFit,
  resolveFontSize,
  threeStepIntent
} from '../../core/chamber-type-size.js';
import { resolveTextMaterialCapability } from '../../core/chamber-text-material.js';
import { FitMaskRuntime } from '../../core/fit-mask-runtime.js';
import { resolveSessionWordFill } from '../../core/visual-selection.js';
import { sessionColorTheme, sessionColorThemeId } from '../../core/session-presentation.js';
import { themeEngine, themedFlameLookup } from '../../core/theme-engine-map.js';
import { RISE_CURRENT_THEMES } from '../../core/rise-current.js';
import { SEQUENCE_PILOT, nextSequencePilot } from '../../content/sequence-pilot.js';
import { saveSequencePilotFeedback } from '../../core/sequence-pilot-feedback.js';
import { advanceJevVisualArc } from '../../core/jev-sequence.js';
import { livingFlameConfigKey, normalizeFlameRecipe, normalizeLivingFlameConfig, validateFlameRecipe } from '../../core/flame-recipe.js';
import { directionStateFor, ensureDirector, followProgram, permittedSourceDigests } from '../../core/passage-visuals/reading-state.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';
import { JEV_INKS, JEV_PALETTES, jevColors } from '../../core/jev-palette.js';
import { SOUND_GROUPS, soundOf } from '../../audio/sound-list.js';
import { connectionState } from '../../core/ai-connection.js';
import { LOOKS, applyLook, lookOfSession } from '../../core/looks.js';
import { ATTRACTOR_VISUAL_MANIFEST } from '../../core/visual-control-contract.js';
import './Chamber.css';

const RHYTHMS = Object.freeze([['phrase', 'Phrase'], ['sentence', 'Sentence'], ['word', 'Word']]);
const RHYTHM_UNAVAILABLE = 'a new rhythm recuts the text, and a reading cannot yet reopen at your place';
const LOOK_UNAVAILABLE = 'this reading opened without a gallery, and a reading cannot yet reopen in another look at your place';

/**
 * THE SEAM, AS THE CHAMBER IS WILLING TO DRAW IT.
 *
 * The compiler decides what a seam SAYS (session-compiler.js); this decides
 * whether there is anything drawable here at all. A restored session, a
 * hand-edited export or an older Vault entry may carry anything under
 * `atom.seam`, and the law at every such door is the same: a seam that
 * cannot be named is ABSENT — the boundary stays the silence it already was
 * — never a frame with nothing in it and never the word "undefined".
 *
 * An unrecognised depth degrades to the quieter of the two rather than the
 * louder, so a value nobody wrote cannot announce itself as a new book.
 */
function seamOf(atom) {
  const seam = atom?.seam;
  if (!seam || typeof seam !== 'object') return null;
  const label = typeof seam.label === 'string' ? seam.label.trim() : '';
  if (!label) return null;
  const name = typeof seam.name === 'string' ? seam.name.trim() : '';
  return { depth: seam.depth === 'work' ? 'work' : 'piece', label, name: name || label };
}

/**
 * Chamber Component
 * The session space - three display modes (Focal, Chamber, Orbital)
 *
 * Design principles:
 * - Darkness as container
 * - Content emerges through luminosity
 * - Minimal chrome, maximum presence
 * - Hidden controls (appear on movement, fade after 2s)
 */

/**
 * How far each word's glass pane ramps from nothing to solid, in pixels.
 * It is also the pane's horizontal padding, so neighbours overlap by two
 * ramps and sum back to solid between them, while the outermost word
 * simply dissolves.
 */
const PROGRESSIVE_GLASS_FEATHER = 24;

/** One pane: opaque through the middle, ramped away at both ends. */
const PROGRESSIVE_GLASS_PANE = 'linear-gradient(to right, '
  + 'rgba(0, 0, 0, 0) 0, '
  + `rgb(0, 0, 0) ${PROGRESSIVE_GLASS_FEATHER}px, `
  + `rgb(0, 0, 0) calc(100% - ${PROGRESSIVE_GLASS_FEATHER}px), `
  + 'rgba(0, 0, 0, 0) 100%)';

export class Chamber {
  constructor(container, options = {}) {
    this.container = container;
    this.session = options.session;
    this.player = options.player;
    // A host that runs the reading itself (a live Current, whose Player is
    // started by the runtime once this view is up) wants the reading shown
    // and not gated behind Begin, but must not have the Chamber start it.
    this.hostPlays = options.hostPlays === true;
    this.autoStart = this.hostPlays || (options.autoStart !== undefined ? options.autoStart : false);
    // A host that draws its own controls gets the field, the words and the
    // progress hairline, and none of the Chamber's chrome: no bar, no key
    // handler, no exit dialog, no closing screen.
    this.chromeless = options.chrome === 'none';
    this._colourTheme = null;
    this._fieldOwnPalette = null;
    this.onExit = options.onExit || (() => { });
    this.onEnterStream = typeof options.onEnterStream === 'function'
      ? options.onEnterStream : async () => true;
    this.audioEngine = options.audioEngine || null;
    this.getSettings = options.getSettings || (() => ({}));
    this.onSettingsChange = options.onSettingsChange || (() => {});
    this.onDataCleared = options.onDataCleared || (() => {});

    this.controlsTimeout = null;
    this.controlsVisible = false;
    this._settingsInstance = null;
    this._settingsFailed = false;
    this._jevLook = {};
    this._destroyed = false;
    this._firstReadChoiceSeen = false;
    this._fitBoxSnapshot = null;
    this.fitMask = new FitMaskRuntime(this);
    this.loadSettingsClass = typeof options.loadSettingsClass === 'function'
      ? options.loadSettingsClass
      : async () => (await import('../Settings.js')).Settings;
    this.attractorField = null;
    this.nightStreaks = null;
    this.kleeField = null;
    this._visualFieldDirector = null;
    this._fillMaskGeneration = 0;
    this.fillFieldHost = null;
    this.fillViewport = null;
    this._fitMaskSvg = null;
    this._fitMaskMask = null;
    this._fitMaskText = null;
    this._fitMaskId = null;
    this._fitMaskSeed = null;
    this._fitMaskTurn = 0;
    this._fitMaskSignature = null;
    this.maskGroundPlate = null;
    this._scheduledVisualGeneration = 0;
    // Page Mode (PAGE-MODE-SPEC): the spatial projection, mounted lazily
    // on demand. Null until the reader opens it; nothing is paid before.
    this.pageReader = null;
    this.pageModeActive = false;
    // The reader's place in the Page, kept across a trip to the Stream.
    this._lastPage = null;

    // Voice and text arrival are separate reader choices. An instant spoken
    // reading and a silent progressive reading are both valid contracts.
    this.recitationEnabled = this.session?.recitation?.enabled === true;
    this.progressiveRevealEnabled = this.session?.revealMode === 'progressive';
    this._revealTimers = null;
    this._revealMotionMedia = null;
    this._onRevealMotionChange = null;
    // A full-frame interlocution lays the successor out while an opaque
    // presence still owns the screen. Keep its hidden word spans here so the
    // reveal can begin at the later semantic entrance, alongside the WAV,
    // without emitting or laying out the atom a second time.
    this._concealedReveal = null;

    // The voice exists only when a reading asks for it. It now resolves
    // bundled static assets and never starts browser inference. App normally
    // passes a prepared instance; this fallback preserves embedded callers.
    this.voice = this.recitationEnabled
      ? (options.voice || new Voice({
        audioEngine: this.audioEngine,
        voiceId: this.session?.voiceId,
        packUrl: this.session?.recitation?.pack ?? null
      }))
      : null;
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);
    this.hasRhythmicVisuals = this.session?.visualConfig?.visualMode === 'interlocution';
    this.rhythmicVisualsEnabled = this.hasRhythmicVisuals;
    /**
     * Whether the bar offers the visuals toggle (interlocution flashes
     * only — not Gallery continuous-field). Separate from
     * rhythmicVisualsEnabled: bar offer vs handler permission.
     */
    this.offersVisualsToggle = this.hasRhythmicVisuals
        && !isContinuousPresentation(this.session?.visualConfig?.interlocution?.presentation);
    // Only a reading that opened with a Gallery has the cortex identity and
    // the host a Gallery look needs; the fields mount anywhere.
    this.opensWithGallery = this.hasRhythmicVisuals && !this.offersVisualsToggle;
    /**
     * A dive looks under the passage the reading is at, so it is offered only
     * where something was written to lie there. An ordinary reading carries
     * no threads and gains no control.
     */
    this.offersDive = this.session?.experienceProgram?.tracks
        ?.some(track => track.kind === 'thread') === true;
    this._dive = createDive();
    // Whether this dive paused a reading that was playing, so that surfacing
    // resumes exactly what it stopped and nothing else.
    this._diveHeld = false;
    this._diveKeyDown = false;
    this._divePointerUpAt = -Infinity;
    this.boundKeyupHandler = this.handleKeyup.bind(this);
    this._spokenIndex = null;
    this._spokenPlayback = null;
    this._spokenMs = null;
    this._spokenCompletion = null;
    // The attractor is a persistent field, so its symmetry can be
    // changed mid-reading — the first in-chamber visual control.
    // ATTRACTOR IS A LISTED PROCEDURAL AGAIN, NOT A MODE OF ITS OWN.
    //
    // Asking for `visualMode === 'attractor'` was asking for the sixth mode
    // PR #33 said not to create; when it went, so would the Kaleidoscope
    // control, silently. Both spellings are read: a config stored under the
    // dedicated mode still finds its field.
    const attractorConfig = this.session?.visualConfig?.visualMode === 'attractor'
      ? this.session?.visualConfig?.attractor
      : (this.session?.visualConfig?.interlocution?.procedural || []).includes('attractor')
        ? this.session?.visualConfig?.interlocution?.attractor
        : null;
    this.hasAttractorField = Boolean(attractorConfig)
      || this.session?.visualConfig?.visualMode === 'attractor';
    this.kaleidoscopeEngaged = attractorConfig?.form === 'kaleido';

    // Semantic conductor track — needed by Living Text and by responsive
    // interlocutions. Scored once per session and stashed on the session
    // object so the player shares the same track. Purely additive — a null
    // track means the raw platform behavior everywhere.
    this.semanticTrack = null;
    const wantsLivingText = this.session?.visualConfig?.livingText?.enabled;
    const wantsResponsive = this.session?.visualConfig?.visualMode === 'interlocution'
      && this.session?.visualConfig?.interlocution?.responsive;
    if ((wantsLivingText || wantsResponsive) && Array.isArray(this.session?.atoms)) {
      try {
        this.session.semanticTrack = this.session.semanticTrack || scoreAtoms(this.session.atoms);
        // Living Text reads the track locally; when only responsive
        // interlocutions want it, the player reads it off the session.
        if (wantsLivingText) this.semanticTrack = this.session.semanticTrack;
        console.log('[Chamber] Semantic track active:', this.session.semanticTrack.length, 'atoms scored',
          `(livingText=${!!wantsLivingText}, responsive=${!!wantsResponsive})`);
      } catch (e) {
        console.warn('[Chamber] Semantic scoring failed, continuing without:', e);
        this.semanticTrack = null;
      }
    }

    // Dynamic speed tracking
    this.baseWpm = Number.isFinite(Number(this.session?.wpm)) ? Number(this.session.wpm) : 200;
    this.currentWpm = this.baseWpm;
    this.speedHudTimeout = null;

    // The visual schedule (PERICOPE-IMAGERY-SPEC §6): when the session
    // carries a compiled visual program, a generic controller follows
    // the reading and sends cues to the cortex. Lazy-built so a plain
    // session pays nothing. Chapel-agnostic: the Chamber wires the
    // controller to the cortex's generic applyCue and never inspects
    // what the cue means. Built SYNCHRONOUSLY: an async import() here
    // raced auto-start — the session began flashing before the
    // scheduler existed, and every atom's observe() silently no-oped
    // on a null _visualSchedule, so the pool never switched (the
    // regression the reader caught in the live app). The module is
    // tiny; a static import costs nothing and removes the race.
    this._visualSchedule = null;
    // Living Flame reads the reading clock: elapsed reading time, shifted
    // to an atom's own start when the reader jumps, so a seek evaluates the
    // destination rather than continuing from where the jump began.
    this._visualClockOffsetMs = 0;
    this._lastVisualAtomIndex = null;
    this._atomStartsMs = null;
    // The reader's global Energy control (0..1). 0.35 is the default.
    this._visualEnergy = 0.35;
    this._jevCurrentAtom = null;
    this._authoredGalleryPaused = false;
    const program = this.session?.visualProgram;
    if (program && Array.isArray(program.segments) && program.segments.length) {
      this._visualSchedule = new VisualScheduleController(
        program,
        (cue, meta) => this.applyScheduledVisualCue(cue, meta),
        { atoms: this.session.atoms }
      );
      console.info(
        `[Chamber] Visual schedule ready: ${program.segments.length} episodes`
      );
    } else if (this.session?.visualConfig?.interlocution?.sourced
      ?.some(id => id.startsWith('chapel-gospel-'))) {
      console.warn('[Chamber] Gospel episode selection has no visual schedule');
    }

    // PASSAGE-DIRECTED VISUALS. An authored program above always wins; an
    // eligible new reading follows its own text by default, from local
    // direction, without waiting for anything. Built synchronously for the
    // same reason as the authored schedule: nothing may race auto-start.
    this._direction = directionStateFor(this.session);
    this._directedSchedule = null;
    this._lastDirectedCue = null;
    this._lastDirectedCueId = null;
    this._currentVisualCue = null;
    // What the reading brings on its own: an authored schedule and the
    // Gallery pool the session installed. Hold and Off restore to these.
    this._ownSchedule = this._visualSchedule;
    this._ownActiveTypes = [...(visualCortex.config?.activeTypes || [])];
    this._visualEnergy = Number.isFinite(this._direction?.energy) ? this._direction.energy : 0.35;
    // A scene carried from the Visual Lab through the reading chooser is a
    // manual Hold, which outranks any authored or directed visuals.
    const pendingRecipe = normalizeFlameRecipe(options.pendingVisualRecipe);
    if (pendingRecipe && this._direction) {
      this._direction.mode = 'hold';
      this._direction.heldCue = this._flameCue(pendingRecipe, pendingRecipe.macros.energy);
    }
    if (this._direction?.mode === 'follow') this._startFollowText();
    else if (this._direction?.mode === 'off' || this._direction?.heldCue) this._visualSchedule = null;

    // A JOURNEY'S TWO SIBLINGS (JOURNEYS-SPEC §8.4). Built here for the
    // same reason and with the same discipline as the visual schedule
    // above: synchronously, so nothing races auto-start, and wired to
    // generic subsystems the Chamber does not interpret. It receives
    // movement labels and bounded audio commands; it never learns what
    // "metaphysical" or "industrial" means.
    this._movementSchedule = null;
    this._audioSchedule = null;
    this._activeMovement = null;

    const movementProgram = this.session?.movementProgram;
    if (movementProgram?.movements?.length) {
      this._movementSchedule = new MovementScheduleController(
        movementProgram,
        (position) => this.onMovementChange(position)
      );
      console.info(
        `[Chamber] Movement schedule ready: ${movementProgram.movements.length} movements, `
        + `${movementProgram.boundaries.length} boundaries`
      );
    }

    const audioProgram = this.session?.audioProgram;
    if (audioProgram?.segments?.length) {
      this._audioSchedule = new AudioScheduleController(
        audioProgram,
        this.audioEngine,
        // A JOURNEY'S AUDIO AUTHORITY IS ITS PROGRAM, NOT A PRESET.
        //
        // This asked `audioPreset !== 'silent'`, which is a question
        // from the generic Session's vocabulary — the pure-tone bed a
        // reader picks in the orbital. A Journey never sets it, so it
        // defaulted to 'silent' and the controller was constructed
        // DISABLED on every launch. Seven cues compiled, the schedule
        // announced itself in the log, and not one of them was ever
        // delivered.
        //
        // The absence of a preset is not a request for silence. §3.3's
        // "a reader may silence a Journey" is an explicit act, and it
        // has an explicit route: setEnabled(false).
        {
          enabled: true,
          defaultCue: this.session.soundscape && this.session.soundscape !== 'none'
            ? { kind: 'soundscape', soundscapeId: this.session.soundscape, fadeMs: 500 }
            : this.session.audioPreset && this.session.audioPreset !== 'silent'
              ? { kind: 'tone', presetId: this.session.audioPreset, fadeMs: 500 }
              : null
        }
      );
      console.info(
        `[Chamber] Audio schedule ready: ${audioProgram.segments.length} cues`
      );
    }

    console.log('[Chamber] Auto-start:', this.autoStart);

    this.render();
    this.applySessionColors();
    this.applyChamberStreamFace();
    this.applyChamberTypeSize();
    this.attachEvents();
    this.bindProgressiveRevealMotion();
    this.bindVisualViewport();
    this.initializeDisplay();
    this.applyChamberMask();
    beginStep('chamber:mounted');

    // A spatial reading opens as a page (SPATIAL-CHAMBER-SPEC §3).
    // projection === 'page' is parked in production UI; e2e/page-suspend.spec.js
    // guards the path. Unknown values normalize to 'stream'.
    if (this.session?.projection === 'page') {
      // Tracked so a Chamber destroyed during the delay cannot mount a
      // reader into detached DOM.
      this._pageOpenTimer = setTimeout(() => {
        this._pageOpenTimer = null;
        this.togglePageMode(true);
      }, 120);
    } else if (this.autoStart && !this.hostPlays) {
      // Auto-start if requested (skip pre-session screen). Tracked and
      // Page-aware: a reader who opens the Page inside this delay must
      // not have a stream start underneath them when it fires.
      this._autoStartTimer = setTimeout(async () => {
        this._autoStartTimer = null;
        if (this._destroyed || this.pageModeActive) return;
        beginStep('chamber:autostart');

        // A READING MUST NOT BEGIN INTO A CONTEXT THAT IS NOT RUNNING.
        //
        // Browsers will not start audio without a gesture, and RISE has a
        // path that reaches a reading without ever collecting one: the
        // threshold gate grants access immediately when localStorage
        // already holds a session, so a returning reader is admitted with
        // no click at all. The AudioContext is then created suspended,
        // resume() is refused because nothing was tapped, and the reading
        // opens in silence - the whole reading, not the first phrase,
        // because the clock never starts. It looks intermittent only
        // because any incidental tap before this fires cures it, and a
        // first-time visitor never sees it: the gate's own button IS the
        // gesture, which is why a fresh origin cannot reproduce it.
        //
        // Ask for the clock. If the browser gives it, begin as before. If
        // it does not, do not open a silent reading - show the threshold
        // this session already has, whose Begin is a real gesture, and
        // let the reader start it themselves.
        // ONLY WHEN THERE IS A CONTEXT AND IT WILL NOT RUN. A missing
        // context is not evidence of a refused one - the engine may
        // simply not have been asked yet, and stalling a reading that
        // would have played is worse than the silence this exists to
        // prevent. So this defers on the one state it can actually read:
        // a context that exists, has been asked for the clock, and did
        // not get it.
        if (this._sessionWantsAudio() && this.audioEngine?.context) {
          await this.audioEngine.resume();
          if (this._destroyed || this.pageModeActive) return;
          const state = this.audioEngine.context?.state ?? 'none';
          if (state !== 'running' && this._deferToGesture()) {
            audioDiag('autostart:deferred', { context: state });
            console.warn('[Chamber] No audio clock yet — waiting for the reader.');
            return;
          }
          audioDiag('autostart', { context: state });
        }

        console.log('[Chamber] Auto-starting session...');
        // Fullscreen is the reader's choice (the Fullscreen control), never
        // a side effect of starting.
        if (this.player) {
          beginStep('chamber:play');
          this.player.play();
          if (this.audioEngine) {
            console.log('[Chamber] Triggering atmospheric swell (auto-start)');
            this.audioEngine.fadeInSession(1.2);
          }
        }
      }, 500); // Relaxed timing for engine stability
    }
  }

  render() {
    const session = this.session || {};
    const pilotCurrent = session.provenance?.kind === 'keystone'
      ? SEQUENCE_PILOT.find(item => item.slug === session.provenance.keystone) : null;
    const pilotNext = pilotCurrent && nextSequencePilot(pilotCurrent.slug);
    const title = session.title || session.name || 'Untitled Session';
    const duration = session.totalDuration || 0;
    const sources = session.sources;

    this.container.innerHTML = `
      <div class="chamber" role="main">
        <!-- Pre-Session State -->
        <div class="chamber-pre-session" id="chamber-pre" ${this.autoStart ? 'style="display: none;"' : ''}>
          <button class="chamber-back btn-ghost" id="chamber-back">
            <span class="icon" aria-hidden="true">←</span>
            <span>back</span>
          </button>

          <div class="chamber-ready" id="chamber-ready">
            <span class="ready-indicator text-threshold">ready ◊</span>
          </div>

          <div class="chamber-info">
            <h2 class="chamber-session-title text-light">${escapeHtml(title)}</h2>
            <div class="chamber-session-meta text-fog">
              <span class="meta-item font-mono">${this.formatDuration(duration)}</span>
              ${sources && sources.length > 0 ? `<span class="meta-separator">·</span><span class="meta-item">${sources.length} source${sources.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>

          <button class="chamber-begin btn-primary" id="chamber-begin">
            <span>Begin</span>
            <span class="icon">${ICONS.play}</span>
          </button>
        </div>

        <!-- Session Display -->
        <div class="chamber-display" id="chamber-display" style="${this.autoStart ? 'display: flex; opacity: 1;' : 'display: none;'}">
          <!-- Content area - mode-specific rendering -->
          <div class="chamber-field" id="chamber-field">
            <div class="movement-title" id="movement-title" role="status"
                 aria-live="polite" hidden></div>
            <!-- #atom-band holds glass; #atom-display fades independently
                 (display:contents except on phone). -->
            <div class="atom-band" id="atom-band">
              <div class="atom-display" id="atom-display"></div>
            </div>
          </div>

          <!-- PAGE MODE (PAGE-MODE-SPEC): the SPATIAL projection of this
               same reading. Empty and hidden until engaged; the Stream
               above is never modified, only paused while the reader
               studies. Mounted lazily so a reader who never opens it
               pays nothing. -->
          <div class="chamber-page" id="chamber-page" hidden></div>

          <!-- Speed HUD - briefly appears on WPM change -->
          <div id="chamber-speed-hud" class="speed-hud hidden">
            <span class="speed-hud-label">Speed</span>
            <span id="speed-hud-value" class="speed-hud-value">300</span>
            <span class="speed-hud-unit">words per minute</span>
          </div>

          <!-- Progress indicator - bottom, subtle, thin -->
          <div class="chamber-progress">
            <div class="chamber-progress-fill" id="progress-fill"></div>
          </div>

          ${this.session?.firstReadPreview === true ? `
            <div class="first-read-choice" id="first-read-choice" role="group"
              aria-label="How would you like to continue reading?" hidden>
              <button type="button" id="first-read-continue">Continue in Stream</button>
              <button type="button" id="first-read-page">Read as Page</button>
              <button type="button" id="first-read-pause">Pause</button>
            </div>
          ` : ''}

          ${this.offersDive ? `
            <section class="chamber-undercurrent" id="chamber-undercurrent" role="region"
              aria-label="Under this passage" aria-live="polite" hidden></section>
          ` : ''}

          ${this.chromeless ? '' : `
          <!-- Hidden controls - appear on mouse movement -->
          <div class="chamber-controls" id="chamber-controls" style="opacity: 0;">
            <button class="control-btn" id="play-pause-btn" type="button" aria-label="Play or pause" title="Play or pause (Space)">
              <span class="icon play-icon" id="play-icon">${ICONS.play}</span>
              <span class="icon pause-icon hidden" id="pause-icon">${ICONS.pause}</span>
            </button>

            <!-- No whitespace between these: a newline in the source is a
                 space in the bar, and with one on each side of the slash the
                 two halves of the clock read as three separate things. -->
            <span class="time-display" id="time-display"><span
              id="time-current">0:00</span><span
              class="time-separator" aria-hidden="true">/</span><span
              id="time-total">0:00</span></span>

            <!-- Seven buttons, and Dive where the text has threads. Everything
                 that changes the picture is in the Look sheet, and the pace
                 in the Rhythm & pace sheet; Page view's turn and Elongate
                 exist only in Page view. -->
            <button class="control-btn look-btn" id="look-btn" type="button"
              aria-label="Look" aria-haspopup="dialog" aria-expanded="false" aria-controls="look-sheet">
              <span class="icon" aria-hidden="true">${ICONS.spark}</span>
              <span class="control-label">Look</span>
            </button>

            <button class="control-btn pace-btn" id="pace-btn" type="button"
              aria-label="${this._paceName()}" aria-haspopup="dialog" aria-expanded="false" aria-controls="pace-sheet">
              <span class="icon" aria-hidden="true">${ICONS.pace}</span>
              <span class="control-label" id="pace-label">${this._paceLabel()}</span>
            </button>

            <!-- PAGE TURN, IN THE BAR THAT ALREADY EXISTS.
                 The Page Reader used to float its own pager above this
                 one. Two stacked control clusters at the foot of the
                 screen overlapped on a short frame and, even apart,
                 read as two competing objects rather than one place
                 where the controls live. There is one bar. -->
            <span class="page-turn" id="page-turn" hidden>
              <button class="control-btn" id="page-prev" type="button"
                aria-label="Previous page" title="Previous page">
                <span class="icon icon-flip" aria-hidden="true">${ICONS.arrow}</span>
              </button>
              <span class="page-turn-count" id="page-turn-count" aria-live="polite"></span>
              <button class="control-btn" id="page-next" type="button"
                aria-label="Next page" title="Next page">
                <span class="icon" aria-hidden="true">${ICONS.arrow}</span>
              </button>
            </span>

            <!-- ELONGATE. The reading's length picks a projection; this
                 lets the reader overrule it without leaving the Page.
                 Shown only when there is genuinely a choice to make. -->
            <button class="control-btn page-elongate" id="page-elongate" type="button" hidden
              aria-pressed="false" aria-label="Elongate into one column"
              title="Elongate — read as one continuous column">
              <span class="icon" aria-hidden="true">${ICONS.elongate}</span>
              <span class="control-label">Elongate</span>
            </button>

            ${this.offersDive ? `
              <button class="control-btn dive-btn" id="dive-btn" type="button"
                aria-pressed="false" aria-expanded="false" aria-controls="chamber-undercurrent"
                aria-label="Look under this passage"
                title="Look under this passage (D). Hold to glance, tap to stay.">
                <span class="icon" aria-hidden="true">${ICONS.dive}</span>
                <span class="control-label">Dive</span>
              </button>
            ` : ''}

            <!-- Stream ⇄ Page: the two projections of one reading -->
            <button class="control-btn page-mode-toggle" id="page-mode-btn"
              type="button" aria-pressed="false" aria-label="Read as a page"
              title="Read as a page (the spatial projection)">
              <span class="icon" aria-hidden="true">${ICONS.page}</span>
              <span class="control-label">Page view</span>
            </button>

            <!-- Fullscreen: only when the reader asks for it. -->
            <button class="control-btn fullscreen-toggle" id="fullscreen-btn"
              type="button" aria-pressed="false" aria-label="Fullscreen" title="Fullscreen">
              <span class="icon" aria-hidden="true">${ICONS.fullscreen}</span>
              <span class="control-label">Fullscreen</span>
            </button>

            <button class="control-btn chamber-settings-btn" id="chamber-settings-btn"
              type="button" aria-label="Settings" title="Settings"
              aria-expanded="false" aria-controls="chamber-settings-overlay">
              <span class="icon" aria-hidden="true">${ICONS.gear}</span>
            </button>

            <button class="control-btn" id="exit-btn" type="button" aria-label="End reading" title="End reading (Esc)">
              <span class="icon" aria-hidden="true">${ICONS.exit}</span>
            </button>
            <span class="chamber-settings-fail" id="chamber-settings-fail" hidden>Settings will not open.</span>
          </div>
          `}
        </div>

        ${this.chromeless ? '' : `
        <!-- Post-Session State -->
        <div class="chamber-post-session" id="chamber-post" style="display: none;">
          <!-- Choice Screen -->
          <div id="post-choice-screen" class="post-complete-screen">
            <p class="post-status">
              <span class="post-status-icon" aria-hidden="true">${ICONS.check}</span>
              Reading complete
            </p>
            <h2 class="post-complete-title">${escapeHtml(title)}</h2>

            ${pilotNext ? `
              <section class="post-pilot" aria-label="Next reading">
                <p class="post-pilot-label">Continue the sequence</p>
                <p id="post-pilot-reason">${escapeHtml(pilotNext.promise)}</p>
                <button class="btn-primary post-btn-continue" id="post-pilot-next" type="button">
                  Explore ${escapeHtml(pilotNext.title)}
                  <span class="post-btn-icon" aria-hidden="true">${ICONS.arrow}</span>
                </button>
                <div class="post-pilot-feedback">
                  <p class="post-pilot-question">Was this worth your time?</p>
                  <label class="post-pilot-consent"><input type="checkbox" id="post-pilot-consent">
                    Save my answer on this device. Nothing is sent.</label>
                  <div class="post-pilot-feedback-answers" role="group" aria-label="Was this worth your time?">
                    <button class="btn-secondary" type="button" data-pilot-feedback="yes" disabled>Yes</button>
                    <button class="btn-secondary" type="button" data-pilot-feedback="somewhat" disabled>Somewhat</button>
                    <button class="btn-secondary" type="button" data-pilot-feedback="no" disabled>No</button>
                  </div>
                  <p class="post-pilot-data-note">After reading, Settings has Export Personal Data and Clear All Personal Data.</p>
                  <p id="post-pilot-feedback-status" role="status"></p>
                </div>
              </section>` : ''}

            <div class="post-complete-actions">
              ${hasNextLibraryDivision(this.session?.continuation) ? `
              <button class="btn-primary post-btn-continue" id="post-continue" type="button">
                Next ${escapeHtml(this.session.continuation.noun)}
                <span class="post-btn-icon" aria-hidden="true">${ICONS.arrow}</span>
              </button>` : ''}
              <button class="btn-secondary post-btn-recursion" id="post-recursion" type="button">
                Write a reflection
              </button>
              <button class="btn-ghost post-btn-return" id="post-return-chamber" type="button">
                Back
              </button>
            </div>
          </div>

          <div id="synthesis-screen" class="synthesis-container" style="display: none;">
            <h2 class="synthesis-title">Write a reflection</h2>
            <p class="synthesis-subtitle">It is saved on this device and opened in Compose.</p>
            <label class="synthesis-label" for="synthesis-input">Reflection on ${escapeHtml(title)}</label>
            <textarea
              id="synthesis-input"
              class="journal-input"
              placeholder="What stayed with you?"
            ></textarea>

            <div class="journal-actions">
              <button class="btn-ghost" id="post-close" type="button">
                Discard
              </button>
              <button class="btn-primary" id="post-seal" type="button">
                Save and open in Compose
              </button>
            </div>
          </div>
        </div>
        `}

        <div class="chamber-settings-overlay" id="chamber-settings-overlay" hidden></div>
        ${this.chromeless ? '' : this.renderLookSheet()}
        ${this.chromeless ? '' : this.renderPaceSheet()}

        ${this.chromeless ? '' : `
        <!-- Custom Exit Confirmation Overlay -->
        <div id="exit-confirm-overlay" class="exit-overlay hidden" style="display: none;">
          <div class="exit-modal" role="alertdialog" aria-modal="true"
            aria-labelledby="exit-title" aria-describedby="exit-message">
            <h2 class="exit-title" id="exit-title">End this reading?</h2>
            <p class="exit-message" id="exit-message">The reading stops here.</p>
            <div class="exit-actions">
              <button class="btn-secondary" id="exit-cancel" type="button">Keep reading</button>
              <button class="btn-primary" id="exit-confirm" type="button">End reading</button>
            </div>
          </div>
        </div>
        `}
      </div>
    `;
  }

  /**
   * THE LOOK SHEET: one dialog for everything that changes the picture, in
   * every reading the reader started. A control appears only where a live
   * path for it exists today; what depends on the moment (the field on
   * screen, the direction mode) is settled when the sheet opens.
   */
  renderLookSheet() {
    const session = this.session || {};
    const capital = id => id[0].toUpperCase() + id.slice(1);
    const volume = Math.round((this.getSettings()?.masterVolume ?? 0.75) * 100);
    const offersHold = this._direction?.eligibility?.canFollow === true;
    const offersOff = Boolean(this._direction && this._offersVisualDrawer()) || this.offersVisualsToggle;
    const offersNextScene = ['jev', 'jev-sample'].includes(session.origin?.experience)
      && session.visualProgram?.segments?.length > 1
      && session.visualConfig?.visualMode === 'interlocution'
      && isContinuousPresentation(session.visualConfig.interlocution?.presentation)
      && session.projection !== 'page';
    return `
        <div class="look-sheet" id="look-sheet" role="dialog" aria-modal="true"
          aria-labelledby="look-sheet-title" hidden>
          <div class="look-sheet-head">
            <h2 class="look-sheet-title" id="look-sheet-title">Look</h2>
            <span class="look-sheet-name" id="look-sheet-name"></span>
            <button type="button" class="look-sheet-close" id="look-sheet-close" aria-label="Close Look">
              <span class="icon" aria-hidden="true">${ICONS.exit}</span>
            </button>
          </div>
          <div class="look-sheet-row">
            <div class="look-chips" role="group" aria-label="Looks">
              ${LOOKS.filter(look => this._lookOffered(look)).map(look => `<button type="button" class="look-chip"
                data-look-id="${look.id}" aria-pressed="false">${look.name}</button>`).join('')}
            </div>
            <p class="look-sheet-note" id="look-unavailable-note" hidden>Gallery looks open from Reader setup for now: a reading cannot yet reopen in another look at your place.</p>
          </div>
          <div class="look-sheet-row">
            <span class="look-sheet-label" id="look-colour-label">Colour</span>
            <div class="look-colours" role="group" aria-labelledby="look-colour-label">
              ${Object.entries(JEV_PALETTES).map(([id, palette]) => `<button type="button" class="look-colour"
                data-look-colour="${id}" aria-pressed="false" aria-label="${capital(id)}" title="${capital(id)}"
                style="--swatch-bg:${palette.background};--swatch-accent:${palette.accent}"></button>`).join('')}
            </div>
          </div>
          <div class="look-sheet-row">
            <span class="look-sheet-label" id="look-size-label">Size</span>
            <div class="look-chips" role="group" aria-labelledby="look-size-label">
              ${FONT_SIZE_CHIPS.filter(chip => chip.fontSize !== 'fit' || session.chunkMode === 'word')
                .map(chip => `<button type="button" class="look-chip" data-look-size="${chip.fontSize}"
                  aria-pressed="false">${chip.label}</button>`).join('')}
            </div>
          </div>
          <div class="look-sheet-row look-sheet-sound">
            <label class="look-sheet-label" for="look-sound">Sound</label>
            <select id="look-sound" name="look-sound">
              <option value="authored">As written</option>
              ${SOUND_GROUPS.map(group => {
                const options = group.entries.map(sound => `<option value="${sound.id}">${escapeHtml(sound.name)}</option>`).join('');
                return group.id === 'silence' ? options : `<optgroup label="${group.label}">${options}</optgroup>`;
              }).join('')}
            </select>
            <label class="look-sheet-label" for="look-volume">Volume
              <output id="look-volume-value">${volume}%</output></label>
            <input id="look-volume" name="look-volume" type="range" min="0" max="100" step="1" value="${volume}" />
          </div>
          <div class="look-sheet-row" id="look-vivid-row" hidden>
            <label class="look-sheet-label" for="look-vivid">Visuals</label>
            <div class="look-vivid">
              <span aria-hidden="true">Calmer</span>
              <input id="look-vivid" name="look-vivid" type="range" min="0" max="100" step="1" value="50" />
              <span aria-hidden="true">Vivid</span>
            </div>
          </div>
          ${offersHold || offersOff ? `
            <div class="look-chips" role="group" aria-label="Visuals">
              ${offersHold ? '<button type="button" class="look-chip" data-look-visuals="hold" aria-pressed="false">Hold this scene</button>' : ''}
              ${offersOff ? '<button type="button" class="look-chip" data-look-visuals="off" aria-pressed="false">Visuals off</button>' : ''}
            </div>
          ` : ''}
          <div class="look-direction" id="look-direction"></div>
          ${this.hasAttractorField ? `
            <button type="button" class="look-chip kaleidoscope-toggle" id="kaleidoscope-btn"
              aria-pressed="false" aria-label="Fold the field into a kaleidoscope" title="Kaleidoscope (K)">
              <span class="icon" aria-hidden="true">${ICONS.kaleidoscope}</span><span>Kaleidoscope</span>
            </button>
          ` : ''}
          ${offersNextScene ? `
            <button type="button" class="look-chip jev-next-scene" id="jev-next-scene" disabled
              aria-label="Bring the next visual scene forward" title="Bring the next visual scene forward">
              <span class="icon" aria-hidden="true">${ICONS.spark}</span><span>Next scene</span>
            </button>
            <span class="jev-scene-status" id="jev-scene-status" role="status"></span>
          ` : ''}
          <button type="button" class="look-link" data-vd="lab" hidden>Edit in Visual Lab ›</button>
        </div>`;
  }

  /**
   * RHYTHM & PACE, IN THE READING. Pace changes live, as the arrow keys change
   * it. A rhythm recuts the text, which a reading in progress cannot do, so
   * the others are shown with that reason.
   */
  renderPaceSheet() {
    return `
        <div class="look-sheet pace-sheet" id="pace-sheet" role="dialog" aria-modal="true"
          aria-labelledby="pace-sheet-title" hidden>
          <div class="look-sheet-head">
            <h2 class="look-sheet-title" id="pace-sheet-title">Rhythm &amp; pace</h2>
            <button type="button" class="look-sheet-close" id="pace-sheet-close" aria-label="Close Rhythm and pace">
              <span class="icon" aria-hidden="true">${ICONS.exit}</span>
            </button>
          </div>
          <div class="look-sheet-row">
            <span class="look-sheet-label" id="pace-rhythm-label">Rhythm</span>
            <div class="look-chips" role="group" aria-labelledby="pace-rhythm-label">
              ${RHYTHMS.map(([id, label]) => this.session?.chunkMode === id
                ? `<button type="button" class="look-chip" data-rhythm="${id}" aria-pressed="true">${label}</button>`
                : `<button type="button" class="look-chip" data-rhythm="${id}" aria-pressed="false" disabled
                  aria-label="${label}, unavailable: ${RHYTHM_UNAVAILABLE}" title="${RHYTHM_UNAVAILABLE}">${label}</button>`).join('')}
            </div>
            <p class="look-sheet-note">A new rhythm recuts the text, so it is chosen in Reader setup.</p>
          </div>
          <div class="look-sheet-row">
            <label class="look-sheet-label" for="pace-wpm">Pace
              <output id="pace-wpm-value">${this.currentWpm} wpm</output></label>
            <input id="pace-wpm" name="pace-wpm" type="range" min="${READING_PACE.min}" max="${READING_PACE.max}"
              step="10" value="${this.currentWpm}" aria-valuetext="${this.currentWpm} words per minute" />
          </div>
        </div>`;
  }

  /** What the bar's pace button reads: the rhythm and the pace, or the pace alone. */
  _paceLabel() {
    const rhythm = RHYTHMS.find(([id]) => id === this.session?.chunkMode)?.[1];
    return rhythm ? `${rhythm} · ${this.currentWpm}` : `${this.currentWpm} wpm`;
  }

  _paceName() {
    const rhythm = RHYTHMS.find(([id]) => id === this.session?.chunkMode)?.[1];
    return `Rhythm and pace: ${rhythm ? `${rhythm}, ` : ''}${this.currentWpm} words per minute`;
  }

  _syncPace() {
    const label = this.container.querySelector('#pace-label');
    if (label) label.textContent = this._paceLabel();
    this.container.querySelector('#pace-btn')?.setAttribute('aria-label', this._paceName());
    const output = this.container.querySelector('#pace-wpm-value');
    if (output) output.textContent = `${this.currentWpm} wpm`;
    const range = this.container.querySelector('[name="pace-wpm"]');
    if (range) {
      range.value = String(this.currentWpm);
      range.setAttribute('aria-valuetext', `${this.currentWpm} words per minute`);
    }
  }

  /** Whether this screen and this rhythm may offer a look; a look that cuts the text is offered only in its own rhythm. */
  _lookOffered(look) {
    const width = look.maxViewportWidth;
    if (width && window.matchMedia?.(`(max-width: ${width}px)`)?.matches !== true) return false;
    return !look.config.chunkMode || look.config.chunkMode === this.session?.chunkMode;
  }

  /** Whether a look's field is a Gallery pool, which only the cortex can hold. Living Flame is drawn as a field. */
  _lookDrawsGallery(look) {
    return look.config.visualInterlocution.visualMode === 'interlocution' && !look.engines.includes('living-flame');
  }

  /** A Gallery look in a reading that opened without one would need the reading reopened, which no path does yet. */
  _lookNeedsReopen(look) {
    return this._lookDrawsGallery(look) && !this.opensWithGallery;
  }

  applyChamberStreamFace() {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) return false;
    atomDisplay.dataset.chamberFace = resolveChamberStreamFace(
      this._jevLook?.face || this.getSettings()?.chamberFace
    );
    if (atomDisplay.classList.contains('is-mask')) {
      void this.syncFillGlyphMask();
    }
    return true;
  }

  effectiveFontSize() {
    return this._jevLook?.fontSize || this.getSettings()?.fontSize;
  }

  setColourTheme(theme) {
    if (theme !== null && !Object.hasOwn(RISE_CURRENT_THEMES, theme)) return false;
    this._colourTheme = theme;
    // The variables applySessionColors sets; cleared so a reading with no theme of its own returns to the frame's ground.
    for (const name of ['--color-void', '--color-light', '--color-cloud', '--color-accent', '--color-accent-rgb', '--color-threshold']) this.container.style.removeProperty(name);
    this.applySessionColors();
    this.attractorField?.setPalette(theme ? RISE_CURRENT_THEMES[theme].attractor.palette : this._fieldOwnPalette);
    return true;
  }

  applySessionColors() {
    const colors = this._colourTheme ? jevColors(this._colourTheme) : sessionColorTheme(this.session);
    // The page's chrome follows the theme, unless a host draws the chrome around this reading.
    if (!this.chromeless) {
      if (colors) paintChromeTheme(document.documentElement, colors.accent, this);
      else clearChromeTheme(document.documentElement, this);
    }
    if (!colors && !this._jevLook?.textColor && !this._jevLook?.backgroundColor) return;
    const accent = colors?.accent || JEV_PALETTES.classic.accent;
    const hex = accent.slice(1);
    const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ');
    for (const [name, value] of Object.entries({
      '--color-void': this._jevLook?.backgroundColor
        ? JEV_PALETTES[this._jevLook.backgroundColor].background : colors?.background,
      '--color-light': this._jevLook?.textColor
        ? JEV_INKS[this._jevLook.textColor] : colors?.text,
      '--color-cloud': this._jevLook?.textColor
        ? JEV_INKS[this._jevLook.textColor] : colors?.text,
      '--color-accent': accent,
      '--color-accent-rgb': rgb,
      '--color-threshold': accent
    })) {
      if (value) this.container.style.setProperty(name, value);
    }
    if (['jev', 'jev-sample'].includes(this.session?.origin?.experience)) {
      const atom = this.container.querySelector('#atom-display');
      if (atom && !atom.classList.contains('is-mask-ready')) {
        atom.style.color = 'var(--color-light)';
        atom.style.removeProperty('text-shadow');
      }
    }
  }

  applyScheduledColorTheme(colorTheme) {
    const presentation = this.session?.presentation;
    const colors = jevColors(colorTheme, presentation?.textColor,
      presentation?.backgroundColor ?? colorTheme);
    if (!colors) return false;
    if (!this.session) this.session = {};
    this.session.presentation = {
      ...(this.session?.presentation || {}),
      colorTheme,
      colors
    };
    this.applySessionColors();
    // The engines follow the phase's theme, as they did at the opening.
    visualCortex.updateConfig(
      { colorTheme, flameColors: sessionColorTheme(this.session) },
      { preservePresentation: true }
    );
    return true;
  }

  applyChamberTypeSize() {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) return false;
    atomDisplay.dataset.fontSize = resolveFontSize(this.effectiveFontSize());
    const content = (atomDisplay.textContent || '').trim();
    if (content) this.sizeAtomText(atomDisplay, content);
    void this.syncFillGlyphMask();
    return true;
  }

  _reportFaceApply(requested) {
    const fail = this.container.querySelector('#chamber-face-fail');
    if (!fail) return;
    const allowlisted = resolveChamberStreamFace(requested) === requested;
    const atomDisplay = this.container.querySelector('#atom-display');
    fail.hidden = allowlisted && atomDisplay?.dataset.chamberFace === requested;
  }

  chamberMaskApplies() {
    return this._textMaterialCapabilityContext().capability.maskActive;
  }

  /**
   * GLASS IS A TILE BEHIND THE TEXT, AND A FIT WORD LEAVES NO BEHIND.
   *
   * Every glass path was gated on the imagery mask alone, so choosing Fit
   * with a flat Accent ink kept the glass switch live: a word scaled to fill
   * the chamber then carried a frosted plate the size of the room, and the
   * field the reader chose was behind it. Fit is the condition, not the mask
   * — the mask is only one of the ways a reader reaches Fit.
   */
  wordHoldsTheFrame() {
    return isChamberWordFit(this.effectiveFontSize()) && this.session?.chunkMode === 'word';
  }

  glassCanApply() {
    return !this.chamberMaskApplies() && !this.wordHoldsTheFrame();
  }

  _textMaterialCapabilityContext() {
    const settings = this.getSettings();
    const visualConfig = this.session?.visualConfig;
    const presentation = this.session?.visualConfig?.interlocution?.presentation;
    const input = {
      face: this._jevLook?.face || settings.chamberFace,
      fontSize: this.effectiveFontSize(),
      chunkMode: this.session?.chunkMode,
      visualMode: visualConfig?.visualMode,
      presentation,
      wordFill: visualConfig?.interlocution?.wordFill,
      wordFillDeclared: visualConfig?.interlocution?.wordFillDeclared,
      legacyMask: settings.chamberMask === true
    };
    return {
      capability: resolveTextMaterialCapability(input),
      materialKey: JSON.stringify(input)
    };
  }

  applyChamberMask() {
    this.fitMask?.apply();
  }

  /**
   * Fill understudy inside the glyph wrapper, behind the engine.
   * The wrapper carries the mask and has no background. Layer A stays
   * unmasked so counters show the room only.
   */
  _maskSourceConfig() {
    const interlocution = this.session?.visualConfig?.interlocution || {};
    const cortexTypes = visualCortex.config?.activeTypes;
    const activeTypes = Array.isArray(cortexTypes) && cortexTypes.length
      ? cortexTypes
      : [...(interlocution.procedural || []), ...(interlocution.sourced || [])];
    const wordFill = interlocution.wordFill != null
      ? interlocution.wordFill
      : resolveSessionWordFill(interlocution);
    return {
      sourced: interlocution.sourced,
      procedural: interlocution.procedural,
      activeTypes,
      wordFill
    };
  }

  syncMaskGroundPlate() {
    this.fitMask?.syncGround();
  }

  syncFillGlyphMask() {
    return this.fitMask?.sync();
  }

  destroyFillField() {
    this.fitMask?.destroyField();
  }

  _revertFillToOpaqueWord(...args) {
    this.fitMask?.revertToOpaqueWord(...args);
  }

  _waitThickFontReady(text) {
    return this.fitMask?.waitThickFontReady(text);
  }

  attachEvents() {
    // Pre-session
    const backBtn = this.container.querySelector('#chamber-back');
    const beginBtn = this.container.querySelector('#chamber-begin');

    backBtn?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      this.onExit('back');
    });
    beginBtn?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      this.beginSession();
    });
    // In-session controls
    const playPauseBtn = this.container.querySelector('#play-pause-btn');
    this.container.querySelector('#jev-next-scene')?.addEventListener('click', () => {
      void this.advanceJevScene();
    });
    const settingsBtn = this.container.querySelector('#chamber-settings-btn');
    const exitBtn = this.container.querySelector('#exit-btn');

    playPauseBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.togglePlayPause();
    });
    this._bindDive();
    this.container.querySelector('#page-prev')?.addEventListener('click', () => {
      this.pageReader?.prevPage();
    });
    this.container.querySelector('#page-next')?.addEventListener('click', () => {
      this.pageReader?.nextPage();
    });
    this.container.querySelector('#page-elongate')?.addEventListener('click', () => {
      const r = this.pageReader;
      if (r) r.setPaged(!r.isPaged);
    });

    const fullscreenBtn = this.container.querySelector('#fullscreen-btn');
    if (fullscreenBtn && !document.documentElement.requestFullscreen) fullscreenBtn.hidden = true;
    fullscreenBtn?.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    this._syncFullscreenControl = () => {
      const on = Boolean(document.fullscreenElement);
      fullscreenBtn?.setAttribute('aria-pressed', String(on));
      fullscreenBtn?.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
      const text = fullscreenBtn?.querySelector('.control-label');
      if (text) text.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    };
    document.addEventListener('fullscreenchange', this._syncFullscreenControl);
    // A reading can open while the document is already fullscreen.
    this._syncFullscreenControl();

    const pageModeBtn = this.container.querySelector('#page-mode-btn');
    pageModeBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.togglePageMode();
    });
    this.container.querySelector('#first-read-continue')?.addEventListener('click', () => {
      this.dismissFirstReadChoice();
    });
    this.container.querySelector('#first-read-page')?.addEventListener('click', () => {
      this.dismissFirstReadChoice();
      this.togglePageMode(true);
    });
    this.container.querySelector('#first-read-pause')?.addEventListener('click', () => {
      this.dismissFirstReadChoice();
      this._pauseLikePlay(true);
    });
    const kaleidoscopeBtn = this.container.querySelector('#kaleidoscope-btn');
    kaleidoscopeBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.toggleKaleidoscope();
    });
    settingsBtn?.addEventListener('click', () => {
      this.closeLookSheet(false);
      this._closeSheet('pace', false);
      this.audioEngine?.playHiss();
      this.toggleSettings();
    });
    exitBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.exitSession();
    });

    // Post-session (Choice and Synthesis phase)
    const returnBtn = this.container.querySelector('#post-return-chamber');
    const continueBtn = this.container.querySelector('#post-continue');
    const recursionBtn = this.container.querySelector('#post-recursion');
    const sealBtn = this.container.querySelector('#post-seal');
    const closeBtn = this.container.querySelector('#post-close');
    const pilotNextButton = this.container.querySelector('#post-pilot-next');
    const pilotConsent = this.container.querySelector('#post-pilot-consent');
    const pilotAnswers = this.container.querySelectorAll('[data-pilot-feedback]');

    pilotNextButton?.addEventListener('click', () => {
      const next = nextSequencePilot(this.session.provenance.keystone);
      if (next) this.onExit('pilot-next', { slug: next.slug });
    });
    pilotConsent?.addEventListener('change', () => {
      pilotAnswers.forEach(button => { button.disabled = !pilotConsent.checked; });
    });
    pilotAnswers.forEach(button => button.addEventListener('click', () => {
      if (!pilotConsent.checked) return;
      const current = SEQUENCE_PILOT.find(item => item.slug === this.session.provenance.keystone);
      const status = this.container.querySelector('#post-pilot-feedback-status');
      try {
        saveSequencePilotFeedback({
          sequenceId: current.id, version: current.version,
          value: button.dataset.pilotFeedback, consent: true
        });
        status.textContent = 'Saved on this device. Export or erase it in Settings after reading.';
      } catch {
        status.textContent = 'Could not save on this device.';
      }
    }));

    continueBtn?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      continueBtn.disabled = true;
      this.onExit('continue');
    });
    returnBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.onExit('close');
    });
    recursionBtn?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      this.showSynthesisScreen();
    });
    sealBtn?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      this.handleSynthesisSealing();
    });
    closeBtn?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.onExit('close');
    });

    const synthesisInput = this.container.querySelector('#synthesis-input');
    synthesisInput?.addEventListener('keydown', (e) => {
      this.audioEngine?.playKeyPress(e.keyCode);
    });

    // Exit Modal specific
    const exitCancel = this.container.querySelector('#exit-cancel');
    const exitConfirm = this.container.querySelector('#exit-confirm');

    exitCancel?.addEventListener('click', () => {
      this.audioEngine?.playHiss();
      this.hideExitConfirmation();
    });

    exitConfirm?.addEventListener('click', () => {
      this.audioEngine?.playClick();
      this.performExit();
    });

    // Mouse movement for hidden controls
    const display = this.container.querySelector('#chamber-display');
    display?.addEventListener('mousemove', () => this.showControls());
    display?.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') this.showControls();
    });

    this.attachBandMove();
    this.attachLookSheet();
    this.attachPaceSheet();

    // Player events
    if (this.player) {
      // Register native interlocution for perfect synchronicity.
      // When the player forwards a semantic signal (responsive mode),
      // it chooses generator, Klee preset, and flash sharpness; without
      // a signal this is the raw platform path.
      this.player.setInterlocutionHandler(async (duration, signal, lifecycle) => {
        if (!this.rhythmicVisualsEnabled) {
          return {
            presented: false,
            requestedDurationMs: duration,
            presentedDurationMs: 0,
            reason: 'user-disabled'
          };
        }
        if (signal) {
          const interlocution = this.session?.visualConfig?.interlocution || {};
          const mood = interlocution.responsiveMood ?? true;
          const rhythm = interlocution.responsiveRhythm ?? true;
          const plan = planInterlocution(signal, {
            duration,
            activeTypes: visualCortex.config.activeTypes,
            kleePreset: interlocution.kleePreset ?? 'random',
            mood,
            rhythm
          });
          if (plan.kleePreset) {
            // Semantic choices are one-shot decisions. Persisting them would
            // overwrite the user's Random envelope after the first flash.
            visualCortex.queueKleePreset(plan.kleePreset);
          }
          // The flame queue's signal-matching is a mood behavior
          return visualCortex.flash(
            plan.duration,
            plan.type || undefined,
            mood ? signal : undefined,
            lifecycle
          );
        } else {
          return visualCortex.flash(duration, undefined, undefined, lifecycle);
        }
      }, reason => visualCortex.cancelPresentation(reason));

      this._onPlayer('atom', (data) => {
        // ORDER IS THE CONTRACT (JOURNEYS-SPEC §8.4): movement, then
        // visual, then audio, then recitation, then display. The
        // movement is announced before the cues it explains, and the
        // text is painted last so nothing a reader sees precedes the
        // world it belongs to.
        this._movementSchedule?.observe(data.atom);
        this._trackVisualClock(data.index);
        // Admission first: entering a block freezes its treatment, so the
        // cue the scheduler emits next is the one this reader will keep.
        if (this._directedSchedule && this._visualSchedule === this._directedSchedule) {
          const entered = this._direction.director.observe(data.atom);
          if (entered) {
            this._direction.currentBlock = entered.index;
            this._direction.scoring?.observe(entered.index);
          }
        }

        // The visual schedule follows the reading (PERICOPE-IMAGERY-
        // SPEC §6): each atom's coordinates drive at most one cue
        // change, which the generic scheduler sends to the cortex.
        // Chapel-agnostic — the Chamber knows nothing of pericopes.
        this._visualSchedule?.observe(data.atom);
        this._updateJevSceneControl(data.atom);

        this._audioSchedule?.observe(data.atom);

        // AN AUTHORED BOUNDARY SPEAKS NOTHING (§8.4). It is empty, so
        // the voice would find nothing to say in any case — but saying
        // so here keeps that a decision rather than a coincidence that
        // a later change to the speakable test could quietly undo.
        const isBoundary = data.atom?.tags?.includes('authored-boundary') === true;

        // Speak BEFORE painting, so the reveal can follow the voice's
        // real onsets rather than an interpolation. `speak` never waits
        // — if the buffer has not reached this atom it returns null and
        // the reading proceeds silently at its own pace.
        // A full-frame presence may prepare the next text while its opaque
        // overlay covers the Stream. That is layout preparation, not an atom
        // entrance: its WAV begins only after the presence has resolved.
        const concealed = data.concealed === true;
        const spoken = (concealed || isBoundary) ? null : this._startSpokenAtom(data.index);

        this.displayAtom(data.atom, data.index, {
          concealed,
          spoken
        });

        // Refill after painting: generation is the slow neighbour and
        // must never delay the frame the reader is waiting on.
        this.voice?.prime(this.session?.atoms, data.index + 1);
      });
      // A spoken atom advances on its actual end (RECITATION-SPEC §2).
      // Its duration is retained for progress accounting and for the
      // silent fallback after interruption or playback failure.
      this.player.atomDurationOverride = (_atom, index) =>
        index === this._spokenIndex ? this._spokenMs : null;
      this.player.atomCompletionOverride = (_atom, index) =>
        this._startSpokenAtom(index)?.finished ?? null;

      this._onPlayer('progress', (progress) => this.updateProgress(progress));
      this._onPlayer('complete', () => this.onSessionComplete());
      this._onPlayer('state', (state) => this.onStateChange(state));
      // A live reading is longer each time a segment arrives, and may already
      // have grown while this view was being built (a sealed Current arrives whole).
      this._onPlayer('extended', () => this._adoptExtendedSession());
      this._adoptExtendedSession();
      // Shuttle transitions the Player makes on its own (pause drops
      // home; rewind clamps home at atom 0) carry the same subsystem
      // contract and HUD as key-initiated steps
      this._onPlayer('shuttle', ({ velocity }) => {
        // Speech has no meaningful 2×/4× representation. Leaving home
        // stops the current utterance; its completion promise degrades
        // to the shuttle timer, and narration may resume next atom once
        // traversal returns home.
        if (velocity !== 1) this.voice?.stop();
        this._applyShuttleState(velocity);
        this.showShuttleHud(velocity);
      });
    }
  }

  /**
   * Start one atom's static narration exactly once. Ordinary atoms call this
   * before painting so word reveal can follow measured onsets. A concealed
   * full-frame successor calls it later through atomCompletionOverride, after
   * the visual presence has fully yielded the Stream.
   */
  _startSpokenAtom(index) {
    if (!this.voice) {
      this._startConcealedReveal(index, null);
      return null;
    }
    if (this._spokenIndex === index) return this._spokenPlayback;

    const spoken = this.voice.speak(index) ?? null;
    this._spokenIndex = index;
    this._spokenPlayback = spoken;
    this._spokenMs = spoken?.durationMs ?? null;
    this._spokenCompletion = spoken?.finished ?? null;
    this._startConcealedReveal(index, spoken);
    return spoken;
  }

  /**
   * Give a successor prepared behind a full-frame presence its real entrance.
   * The presence has resolved by the time atomCompletionOverride reaches this
   * method, so starting these timers here keeps text and narration on the same
   * clock. If static audio is unavailable, the ordinary authored visual budget
   * remains the graceful fallback.
   */
  _startConcealedReveal(index, spoken) {
    const pending = this._concealedReveal;
    if (!pending || pending.index !== index) return;
    this._concealedReveal = null;

    const spans = pending.spans?.filter(span => span.isConnected);
    if (!spans?.length) return;

    const reducedMotion = this._prefersReducedMotion();
    const budget = spoken && !reducedMotion
      ? spoken.durationMs
      : revealBudget(pending.durationMs, { reducedMotion });
    if (!(budget > 0)) {
      this.cancelReveal();
      for (const span of spans) span.removeAttribute('data-pending');
      return;
    }

    // The words themselves, not merely how many: their lengths are what
    // let the schedule keep the voice's rhythm between detected onsets.
    this.revealAtomWords(spans, revealSchedule(
      spans.map(span => span.textContent),
      budget,
      spoken && !reducedMotion ? spoken.onsets : null
    ));
  }

  handleKeyboard(e) {
    const settingsOverlay = this.container.querySelector('#chamber-settings-overlay');
    if (settingsOverlay && !settingsOverlay.hidden) return;
    // The sheets are modal: their own controls own the keys while one is open.
    if (this.container.querySelector('#look-sheet:not([hidden]), #pace-sheet:not([hidden])')) return;

    // Don't let spacebar trigger play/pause while user is typing in a field
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'TEXTAREA' || tag === 'INPUT' || document.activeElement?.isContentEditable;
    const isInteractive = document.activeElement?.closest?.(
      'button, a[href], input, select, textarea, summary, [contenteditable="true"], [role="button"]'
    );

    // While the Page holds the reading, the keyboard belongs to the page:
    // Space scrolls (its native behaviour) instead of driving a hidden
    // stream. Only Escape still reaches the Chamber, so the reader can
    // always leave. (PAGE-MODE-SPEC §4 — page authority.)
    if (this.pageModeActive && e.code !== 'Escape') return;

    // Spacebar: play/pause only from the reading surface. Focused controls
    // keep their native Space activation (for example, buttons and selects).
    if (e.code === 'Space' && !isTyping && !isInteractive) {
      e.preventDefault();
      this.togglePlayPause();
    } else if (isTyping) {
      // Trigger mechanical key sound ONLY while typing in journal/inputs
      this.audioEngine?.playKeyPress(e.keyCode);
    }

    // Escape is owned via handleEscape(), dispatched by the router —
    // do not handle it here or the exit modal double-fires.

    // Two orthogonal axes (LATERAL-TRAVERSAL-SPEC §2): ↑↓ is PACE
    // (how fast you read), ←→ is the SHUTTLE (which way and how hard
    // you are moving). Only when NOT typing.
    if (!isTyping) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.updateWpm(10);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.updateWpm(-10);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.shuttleStep(1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.shuttleStep(-1);
        } else if ((e.key === 'k' || e.key === 'K') && this.hasAttractorField) {
            e.preventDefault();
            this.audioEngine?.playHiss();
            this.toggleKaleidoscope();
        } else if ((e.key === 'd' || e.key === 'D') && this.offersDive
            && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            if (!e.repeat && !this._diveKeyDown) {
                this._diveKeyDown = true;
                this._diveApply(this._dive.press(performance.now()));
            }
        }
    }
  }

  /**
   * One shuttle keypress (direction +1 = →, -1 = ←). Liturgical
   * sessions are traversal-exempt; outside a playing session the
   * keys are inert.
   */
  shuttleStep(direction) {
    if (!this.player?.shuttleAvailable) return;
    const velocity = direction > 0
      ? this.player.shuttleForward()
      : this.player.shuttleBackward();
    if (velocity === null) return;
    this._applyShuttleState(velocity);
    this.showShuttleHud(velocity);
  }

  /**
   * The subsystem contract at velocity changes (spec §5): entrainment
   * suspends off home and returns at home; focals, soundscapes, and
   * chant beds persist untouched; rhythmic interlocution is already
   * structural (the Player rolls only at home).
   */
  _applyShuttleState(velocity) {
    const suspended = velocity !== 1;
    try { this.audioEngine?.setShuttleSuspension?.(suspended); }
    catch (e) { /* audio is optional */ }
  }

  /** Transient HUD: ‹‹4× · 2×› · the same surface as the pace HUD. */
  showShuttleHud(velocity) {
    const hud = this.container.querySelector('#chamber-speed-hud');
    const value = this.container.querySelector('#speed-hud-value');
    const label = hud?.querySelector('.speed-hud-label');
    const unit = hud?.querySelector('.speed-hud-unit');
    if (!hud || !value) return;
    if (velocity === 1) {
      if (label) label.textContent = 'Speed';
      value.textContent = String(this.currentWpm);
      if (unit) unit.textContent = 'words per minute';
    } else {
      if (label) label.textContent = velocity < 0 ? 'Rewind' : 'Forward';
      value.textContent = `${Math.abs(velocity)}×`;
      if (unit) unit.textContent = '';
    }
    hud.classList.remove('hidden');
    clearTimeout(this.speedHudTimeout);
    this.speedHudTimeout = setTimeout(() => {
      // The HUD lingers while shuttling (the reader should always
      // know their velocity); it fades only at home
      if (this.player?.shuttle?.atHome) hud.classList.add('hidden');
      else this.showShuttleHud(this.player?.shuttle?.velocity ?? 1);
    }, 1600);
  }

  /** Whether this reading has anything to say or play. */
  _sessionWantsAudio() {
    const session = this.session;
    if (!session || !this.audioEngine) return false;
    return session.recitation?.enabled === true
      || Boolean(session.selectedSwellId)
      || (session.soundscape && session.soundscape !== 'none')
      || (session.audioPreset && session.audioPreset !== 'silent')
      || session.audioProgram?.segments?.length > 0;
  }

  /**
   * Hand the opening back to the reader.
   *
   * The threshold this session already renders is the affordance: its
   * Begin runs the same beginSession() an ordinary launch does, and the
   * tap that reaches it is the gesture the audio was missing. Returns
   * false if there is no threshold to show, in which case a silent
   * reading is still better than no reading.
   */
  _deferToGesture() {
    const pre = this.container.querySelector('#chamber-pre');
    const display = this.container.querySelector('#chamber-display');
    if (!pre || !display) return false;
    display.style.display = 'none';
    pre.style.display = '';
    pre.style.opacity = '1';
    return true;
  }

  beginSession() {
    this.applyChamberStreamFace();
    this.applyChamberTypeSize();
    this.applyChamberMask();
    const preSession = this.container.querySelector('#chamber-pre');
    const display = this.container.querySelector('#chamber-display');

    preSession.style.transition = 'opacity 400ms var(--ease-in)';
    preSession.style.opacity = '0';

    setTimeout(() => {
      preSession.style.display = 'none';
      display.style.display = 'flex';
      display.style.opacity = '0';
      display.style.transition = 'opacity 400ms var(--ease-out)';

      // The stage has geometry only now that it is displayed. Begin material
      // hydration here, while the opaque word remains the readable fallback.
      this.applyChamberMask();
      if (this._destroyed || !display.isConnected) return;
      display.style.opacity = '1';

      // Fullscreen is the reader's choice (the Fullscreen control), never
      // a side effect of Begin.

      if (this.player) {
        this.player.play();
        this.audioEngine?.fadeInSession(1.2); // Smooth swell at start
        // Immediately show pause icon since we are now playing
        const playIcon = this.container.querySelector('#play-icon');
        const pauseIcon = this.container.querySelector('#pause-icon');
        playIcon?.classList.add('hidden');
        pauseIcon?.classList.remove('hidden');
      }
    }, 400);
  }

  initializeDisplay() {
    // Mode-specific initialization
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    field.classList.add(`chamber-field-focal`);
    this._visualFieldDirector = new VisualFieldDirector({
      mount: (cue, meta) => this.mountVisualFieldCue(cue, meta)
    });

    // A direct Page launch consumes the same authored session but must not
    // start a hidden temporal presenter during the brief lazy-mount window.
    // The configuration remains intact for PageReader; Stream presenters
    // are initialized only if the reader later returns to the Stream.
    this._temporalVisualsDeferred = this.session?.projection === 'page';
    if (this._temporalVisualsDeferred) {
      // Whole-reading dynamic fields already have an honest Page contract:
      // the resolver samples their parameter space. Build only that sampler
      // and pause it synchronously; no field clock advances under the Page.
      if (this.session?.visualConfig?.visualMode === 'genesis') this.initializeGenesis();
      if (this.session?.visualConfig?.visualMode === 'attractor') this.initializeAttractor();
      this._visualFieldDirector.pause();
      return;
    }

    this._initializeTemporalVisuals(field);
  }

  _initializeTemporalVisuals(field = this.container.querySelector('#chamber-field')) {
    if (!field) return;
    this._temporalVisualsDeferred = false;
    // Video is a scored visual work, not a Gallery image. Its host belongs
    // to Stream execution and therefore is not installed for Page-only use.
    visualCortex.setSequenceVideoHost(field);

    // Initialize focal point if in focals mode
    this.initializeFocal();

    // Initialize persistent attractor field if in attractor mode
    this.initializeAttractor();

    // Initialize the growing Klee field if in genesis mode
    this.initializeGenesis();

    // Behind-stream rhythmic: imagery presents beneath the reading text,
    // so the text keeps a glass tile for legibility over the imagery
    // (the same pane Genesis uses — one grammar, one implementation).
    this.initializeStreamPresentation();

    // Gallery (Continuous Field): a persistent crossfading gallery behind
    // the reading, a third interlocution presentation beside behind-stream.
    this.initializeContinuousField();

    // A held scene or Off is in force from the first frame.
    if (this._direction?.mode === 'off') this._stopVisualWork(0);
    else if (this._direction?.mode === 'hold' && this._direction.heldCue) {
      this.applyScheduledVisualCue(this._direction.heldCue, { transitionMs: 0 });
    }
  }

  _updateJevSceneControl(atom) {
    this._jevCurrentAtom = atom || null;
    const button = this.container.querySelector('#jev-next-scene');
    if (!button) return;
    // Without its schedule (a look chosen, or the scene held) there is no next scene to bring.
    const visualsAllowed = !this.pageModeActive
      && Boolean(this._visualSchedule)
      && this.player?.state === 'playing'
      && this.session?.jevSceneShifted !== true
      && this.session?.visualConfig?.visualMode === 'interlocution'
      && !this._prefersReducedMotion()
      && !document.documentElement.classList.contains('reduced-motion')
      && !document.documentElement.classList.contains('photosensitivity-mode');
    button.disabled = this._jevShiftPending === true || !visualsAllowed || !advanceJevVisualArc(
      this.session.visualProgram, Number(atom?.sourceProgress)
    );
  }

  /** A reader may bring forward only the next scene Jev already chose. */
  async advanceJevScene() {
    if (!['jev', 'jev-sample'].includes(this.session?.origin?.experience) || !this._visualSchedule) return false;
    const atom = this._jevCurrentAtom;
    this._updateJevSceneControl(atom);
    if (this.container.querySelector('#jev-next-scene')?.disabled) return false;
    const program = advanceJevVisualArc(this.session.visualProgram, Number(atom.sourceProgress));
    if (!program) return false;
    const previous = this.session.visualProgram;
    const status = this.container.querySelector('#jev-scene-status');
    const nextCue = cueForAtom(program, atom).cue;
    this._jevShiftPending = true;
    this._updateJevSceneControl(atom);
    if (!visualCortex.isCuePrepared(nextCue)) {
      status.textContent = 'Preparing the next scene…';
      let ready = false;
      try { ready = await visualCortex.prepareCue(nextCue); } catch { /* keep the original */ }
      if (!ready) {
        status.textContent = 'The next scene could not be prepared.';
        this._jevShiftPending = false;
        this._updateJevSceneControl(this._jevCurrentAtom);
        return false;
      }
    }
    this._jevShiftPending = false;
    this._updateJevSceneControl(this._jevCurrentAtom);
    if (this._destroyed || this._jevCurrentAtom !== atom
      || this.session.visualProgram !== previous
      || this.container.querySelector('#jev-next-scene')?.disabled) {
      status.textContent = 'The reading moved before the scene was ready.';
      return false;
    }
    const oldSchedule = this._visualSchedule;
    try {
      this.session.visualProgram = program;
      this._visualSchedule = new VisualScheduleController(
        program,
        (cue, meta) => this.applyScheduledVisualCue(cue, meta),
        { atoms: this.session.atoms }
      );
      this._visualSchedule.observe(atom);
    } catch {
      this.session.visualProgram = previous;
      this._visualSchedule = oldSchedule;
      status.textContent = 'The next scene could not be prepared.';
      return false;
    }
    this.session.jevSceneShifted = true;
    status.textContent = 'Next scene selected.';
    this._updateJevSceneControl(atom);
    return true;
  }

  _flameCue(recipe, intensity = 0.35) {
    return {
      kind: 'field', renderer: 'living-flame',
      config: { recipe, intensity: Math.max(0, Math.min(1, Number(intensity) || 0.35)) }
    };
  }

  _offersVisualDrawer() {
    const mode = this.session?.visualConfig?.visualMode;
    return Boolean(this._direction?.eligibility?.canFollow || (mode && mode !== 'off')
      || this._direction?.heldCue);
  }

  _currentReadingAtom() {
    const index = this.player?.sessionState?.currentIndex;
    return this._jevCurrentAtom || this.session?.atoms?.[Number.isInteger(index) ? index : 0] || null;
  }

  _currentFlameConfig() {
    const cue = this._direction?.mode === 'hold' && this._direction.heldCue
      ? this._direction.heldCue
      : this._currentVisualCue;
    return cue?.kind === 'field' && cue.renderer === 'living-flame'
      ? normalizeLivingFlameConfig(cue.config) : null;
  }

  _visualTransitionMs() {
    const reduced = this._prefersReducedMotion()
      || document.documentElement.classList.contains('reduced-motion')
      || document.documentElement.classList.contains('photosensitivity-mode');
    return reduced ? 0 : 1200;
  }

  /** Where the scene on screen comes from: Jev, Local, Saved, or Manual. */
  _visualProvenanceLabel() {
    const state = this._direction;
    if (!state) return '';
    if (state.mode === 'off') return 'Direction: Off';
    if (state.mode === 'hold') {
      if (state.heldCue) return 'Direction: Manual';
      return this._ownSchedule ? 'Direction: Saved' : 'Direction: Manual';
    }
    if (state.cueSource === 'saved') return 'Direction: Saved';
    const record = state.director?.blocks[state.currentBlock]?.admitted;
    const label = { jev: 'Jev', local: 'Local', saved: 'Saved' }[record?.provenance] || 'Local';
    const unavailable = label === 'Local' && state.lastScoring?.kind === 'failed'
      && (state.catalogVerified || state.consent);
    return `Direction: ${label}${unavailable ? ' — Jev is unavailable, so visuals follow the text locally' : ''}`;
  }

  attachLookSheet() {
    const button = this.container.querySelector('#look-btn');
    const sheet = this.container.querySelector('#look-sheet');
    if (!button || !sheet) return;
    button.addEventListener('click', () => this.toggleLookSheet());
    sheet.querySelector('#look-sheet-close')?.addEventListener('click', () => this.closeLookSheet());
    sheet.addEventListener('keydown', event => this._sheetKeydown(event, sheet, 'look'));
    sheet.addEventListener('click', (event) => {
      const target = event.target.closest?.('button');
      if (!target || target.disabled) return;
      const { lookId, lookColour, lookSize, lookVisuals, vd } = target.dataset;
      if (lookId) this.chooseLook(lookId);
      else if (lookColour) this.setLookColour(lookColour);
      else if (lookSize) this.changeJevLook('jev-font-size', lookSize);
      else if (lookVisuals === 'hold') this.toggleHoldScene();
      else if (lookVisuals === 'off') this.setVisualsOff(!this._visualsOff());
      else if (vd === 'lab') void this.openVisualLab();
      else if (vd === 'workshop') void this.editPassagesInWorkshop();
      else if (vd === 'consent') void this.grantVisualConsent();
      else if (vd === 'revoke') this.revokeVisualConsent();
      this._refreshLookSheet();
    });
    sheet.querySelector('[name="look-sound"]')?.addEventListener('change', (event) => {
      this.changeJevLook('jev-soundscape', event.target.value);
      this._refreshLookSheet();
    });
    sheet.querySelector('[name="look-volume"]')?.addEventListener('input', (event) => {
      const volume = Number(event.target.value);
      if (!Number.isInteger(volume) || volume < 0 || volume > 100) return;
      this.setVolume(volume / 100);
      const output = sheet.querySelector('#look-volume-value');
      if (output) output.textContent = `${volume}%`;
    });
    sheet.querySelector('[name="look-vivid"]')?.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      event.target.setAttribute('aria-valuetext', `${value} percent vivid`);
      this._vividPath()?.set(value / 100);
    });
    this._refreshLookSheet();
  }

  attachPaceSheet() {
    const button = this.container.querySelector('#pace-btn');
    const sheet = this.container.querySelector('#pace-sheet');
    if (!button || !sheet) return;
    button.addEventListener('click', () => this._toggleSheet('pace'));
    sheet.querySelector('#pace-sheet-close')?.addEventListener('click', () => this._closeSheet('pace'));
    sheet.addEventListener('keydown', event => this._sheetKeydown(event, sheet, 'pace'));
    sheet.querySelector('[name="pace-wpm"]')?.addEventListener('input', (event) => {
      const wpm = Number(event.target.value);
      if (Number.isFinite(wpm)) this.updateWpm(wpm - this.currentWpm);
    });
  }

  toggleLookSheet() {
    this._toggleSheet('look');
  }

  openLookSheet() {
    return this._openSheet('look');
  }

  closeLookSheet(refocus = true) {
    return this._closeSheet('look', refocus);
  }

  _toggleSheet(name) {
    const sheet = this.container.querySelector(`#${name}-sheet`);
    if (!sheet) return;
    if (sheet.hidden) this._openSheet(name);
    else this._closeSheet(name);
  }

  /** A modal dialog over the reading, which goes on playing beneath it. One sheet is open at a time. */
  _openSheet(name) {
    const sheet = this.container.querySelector(`#${name}-sheet`);
    if (!sheet || !sheet.hidden) return false;
    this.closeSettings();
    this._closeSheet(name === 'look' ? 'pace' : 'look', false);
    sheet.hidden = false;
    // The stylesheet lays the reading out beside the side sheet while this is set.
    this.container.classList.add('is-look-open');
    this.container.querySelector(`#${name}-btn`)?.setAttribute('aria-expanded', 'true');
    if (name === 'look') this._refreshLookSheet();
    else this._syncPace();
    this.showControls();
    this._sheetReachable(sheet)[0]?.focus();
    return true;
  }

  _closeSheet(name, refocus = true) {
    const sheet = this.container.querySelector(`#${name}-sheet`);
    if (!sheet || sheet.hidden) return false;
    sheet.hidden = true;
    this.container.classList.remove('is-look-open');
    const button = this.container.querySelector(`#${name}-btn`);
    button?.setAttribute('aria-expanded', 'false');
    if (refocus) {
      this.showControls();
      button?.focus();
    }
    return true;
  }

  _sheetReachable(sheet) {
    return [...sheet.querySelectorAll('button, input, select')]
      .filter(element => !element.disabled && !element.closest('[hidden]'));
  }

  /** Escape closes the sheet and goes no further; Tab and Shift+Tab wrap inside it. */
  _sheetKeydown(event, sheet, name) {
    if (event.key === 'Escape') {
      if (!this._closeSheet(name)) return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'Tab') return;
    const reachable = this._sheetReachable(sheet);
    if (!reachable.length) return;
    const first = reachable[0];
    const last = reachable[reachable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !sheet.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  /** The look this reading is in, with the reader's own colour, size and sound laid over it, or 'custom'. */
  _lookId() {
    const session = this.session || {};
    const theme = this._jevLook.backgroundColor;
    const fontSize = this._jevLook.fontSize;
    const presentation = theme || fontSize ? {
      ...(session.presentation || {}),
      ...(theme ? { colorTheme: theme, textColor: theme, backgroundColor: theme, colors: jevColors(theme, theme, theme) } : {}),
      ...(fontSize ? { fontSize } : {})
    } : session.presentation;
    const sound = this._jevSoundChoice && this._jevSoundChoice !== 'authored'
      ? { soundscape: this._jevSoundChoice } : {};
    return lookOfSession({ ...session, presentation, ...sound });
  }

  /**
   * A LOOK CHOSEN IN THE READING becomes the reading's own configuration, as
   * Begin would have handed it, and is applied through the live paths: face,
   * colour, size and sound as the sheet's own controls apply them, and the
   * field through the cue path an authored schedule uses. Like a scene from
   * the Visual Lab it is a manual Hold. The player is not touched, so the
   * reader's place and pace hold.
   */
  chooseLook(id) {
    const look = LOOKS.find(entry => entry.id === id);
    if (!look || this.pageModeActive || !this._lookOffered(look) || this._lookNeedsReopen(look)) return false;
    const previousShelf = this.session.visualConfig?.interlocution?.procedural || [];
    // A look never flashes: the flash economy stops for good, before its
    // switch can write the reading's visual mode back.
    if (this.offersVisualsToggle) {
      this.toggleRhythmicVisuals(false);
      this.offersVisualsToggle = false;
    }
    const next = applyLook({ presentation: this.session.presentation, visualInterlocution: this.session.visualConfig }, id);
    Object.assign(this.session, {
      visualConfig: next.visualInterlocution,
      presentation: next.presentation,
      soundscape: next.soundscape,
      audioPreset: next.audioPreset
    });
    const { chamberFace, colorTheme, fontSize } = next.presentation;
    this._jevLook.face = chamberFace;
    this.applyChamberStreamFace();
    this.applyScheduledColorTheme(colorTheme);
    this.setLookColour(colorTheme);
    this.changeJevLook('jev-font-size', fontSize);
    this.changeJevLook('jev-soundscape', next.soundscape);
    this._applyLookField(look, previousShelf);
    this._refreshLookSheet();
    return true;
  }

  _applyLookField(look, previousShelf) {
    const state = this._direction;
    const visual = this.session.visualConfig;
    const transitionMs = this._visualTransitionMs();
    if (state?.mode === 'off') this._resumeVisualWork();
    if (state) state.mode = 'hold';
    this._ownSchedule = null;
    this._visualSchedule = null;
    const cue = this._lookDrawsGallery(look) ? null : this._lookFieldCue();
    if (state) state.heldCue = cue;
    if (cue) {
      this.applyScheduledVisualCue(cue, { transitionMs });
    } else {
      // The pool keeps the reading's own works and takes the look's engines.
      this._ownActiveTypes = [
        ...(visual.interlocution?.procedural || []),
        ...this._ownActiveTypes.filter(type => !previousShelf.includes(type))
      ];
      const cadence = visual.interlocution?.galleryCadence;
      if (Number.isFinite(cadence)) visualCortex.updateConfig({ galleryCadence: cadence }, { preservePresentation: true });
      this._restoreOwnVisuals(transitionMs);
    }
    this._syncScoringActivity();
  }

  /** The cue that draws a look's field, from the reading's configuration as the look left it. */
  _lookFieldCue() {
    const visual = this.session.visualConfig;
    if (visual.visualMode === 'off') return { kind: 'still' };
    if (visual.visualMode === 'genesis') return { kind: 'field', renderer: 'genesis', config: visual.genesis || {} };
    if (visual.visualMode === 'attractor') return { kind: 'field', renderer: 'attractor', config: visual.attractor || {} };
    if (visual.visualMode === 'focals') return { kind: 'field', renderer: 'focal', config: visual.focals || {} };
    // The flame's composition is the theme's, and its hue the accent's, as Follow text themes it.
    const composition = themeEngine(sessionColorThemeId(this.session), 'livingFlame')?.composition;
    const recipe = themedFlameLookup(flamePreset, sessionColorTheme(this.session))(composition);
    return recipe ? this._flameCue(recipe) : { kind: 'still' };
  }

  _syncLooks() {
    const current = this._lookId();
    let unavailable = false;
    this.container.querySelectorAll('[data-look-id]').forEach(chip => {
      const look = LOOKS.find(entry => entry.id === chip.dataset.lookId);
      const blocked = this._lookNeedsReopen(look);
      unavailable ||= blocked;
      chip.setAttribute('aria-pressed', String(look.id === current));
      chip.disabled = blocked || this.pageModeActive;
      if (blocked) {
        chip.setAttribute('aria-label', `${look.name}, unavailable: ${LOOK_UNAVAILABLE}`);
        chip.title = LOOK_UNAVAILABLE;
      }
    });
    const note = this.container.querySelector('#look-unavailable-note');
    if (note) note.hidden = !unavailable;
  }

  /** One of the nine themes over this reading: ink, ground and accent together, as Reader setup gives them. */
  setLookColour(theme) {
    if (!Object.hasOwn(JEV_PALETTES, theme)) return false;
    this._jevLook.textColor = theme;
    this._jevLook.backgroundColor = theme;
    return this.setColourTheme(theme);
  }

  /**
   * CALMER ↔ VIVID, ONE CONTROL OVER EACH ENGINE'S OWN SETTING. The attractor
   * takes Composer's visual command, bounded by its manifest; the flame takes
   * the reader's Energy; the Gallery takes its cadence. Anything else has no
   * live setting, and the control is not offered.
   */
  _vividPath() {
    if (this._direction?.mode === 'off') return null;
    const discovery = this.discoverVisual();
    if (discovery?.manifest?.surface === ATTRACTOR_VISUAL_MANIFEST.surface) {
      const { minimum, maximum, default: initial } = ATTRACTOR_VISUAL_MANIFEST.parameters.intensity;
      const current = discovery.target?.intensity ?? discovery.current?.intensity ?? initial;
      return {
        value: (current - minimum) / (maximum - minimum),
        set: value => this.controlVisual({
          surface: ATTRACTOR_VISUAL_MANIFEST.surface,
          parameter: 'intensity',
          value: Math.round((minimum + value * (maximum - minimum)) * 100) / 100
        })
      };
    }
    if (this._currentFlameConfig()) {
      return { value: this._visualEnergy, set: value => this.setVisualEnergy(value) };
    }
    const visual = this.session?.visualConfig;
    if (visual?.visualMode === 'interlocution' && isContinuousPresentation(visual.interlocution?.presentation)) {
      return {
        value: visualCortex.config?.galleryCadence ?? 0.5,
        set: value => visualCortex.updateConfig({ galleryCadence: value }, { preservePresentation: true })
      };
    }
    return null;
  }

  _visualsOff() {
    return this._direction?.mode === 'off' || (this.offersVisualsToggle && !this.rhythmicVisualsEnabled);
  }

  /** Off stops the direction's work and the flashes both; on restores the mode Off left. */
  setVisualsOff(off) {
    const state = this._direction;
    if (off) {
      if (state && state.mode !== 'off' && this._offersVisualDrawer()) {
        this._modeBeforeOff = state.mode;
        this.setVisualDirectionMode('off');
      }
      if (this.offersVisualsToggle) this.toggleRhythmicVisuals(false);
    } else {
      if (this.offersVisualsToggle) this.toggleRhythmicVisuals(true);
      if (state?.mode === 'off') this.setVisualDirectionMode(this._modeBeforeOff || 'hold');
    }
    this._refreshLookSheet();
    return this._visualsOff();
  }

  /** Hold this scene, or let the visuals follow the text again. */
  toggleHoldScene() {
    const state = this._direction;
    if (!state) return false;
    return this.setVisualDirectionMode(state.mode === 'hold' ? 'follow' : 'hold');
  }

  _syncLookSize() {
    const size = resolveFontSize(this.effectiveFontSize());
    this.container.querySelectorAll('[data-look-size]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.lookSize === size));
      chip.disabled = this.pageModeActive;
    });
  }

  _refreshLookSheet() {
    const sheet = this.container.querySelector('#look-sheet');
    if (!sheet) return;
    const name = sheet.querySelector('#look-sheet-name');
    if (name) name.textContent = LOOKS.find(look => look.id === this._lookId())?.name || 'Custom';
    this._syncLooks();
    const colour = this._jevLook.backgroundColor || this._colourTheme || sessionColorThemeId(this.session);
    sheet.querySelectorAll('[data-look-colour]').forEach(swatch => {
      swatch.setAttribute('aria-pressed', String(swatch.dataset.lookColour === colour));
    });
    this._syncLookSize();
    const sound = sheet.querySelector('[name="look-sound"]');
    if (sound) sound.value = this._jevSoundChoice || 'authored';
    const path = this._vividPath();
    const row = sheet.querySelector('#look-vivid-row');
    if (row) row.hidden = !path;
    const vivid = sheet.querySelector('[name="look-vivid"]');
    if (path && vivid && document.activeElement !== vivid) {
      const value = Math.round(Math.max(0, Math.min(1, path.value)) * 100);
      vivid.value = String(value);
      vivid.setAttribute('aria-valuetext', `${value} percent vivid`);
    }
    const state = this._direction;
    const hold = sheet.querySelector('[data-look-visuals="hold"]');
    if (hold) {
      hold.hidden = !(state?.eligibility.canFollow && !state.directorError);
      hold.setAttribute('aria-pressed', String(state?.mode === 'hold'));
    }
    sheet.querySelector('[data-look-visuals="off"]')?.setAttribute('aria-pressed', String(this._visualsOff()));
    this._renderLookDirection();
    const lab = sheet.querySelector('[data-vd="lab"]');
    if (lab) lab.hidden = !(lookOfSession(this.session) === 'flame' || this._currentFlameConfig());
  }

  /** Who directs the visuals while they can follow the text, and the reader's consent to Jev. */
  _renderLookDirection() {
    const host = this.container.querySelector('#look-direction');
    const state = this._direction;
    if (!host) return;
    if (!state?.eligibility.canFollow || state.directorError) {
      host.replaceChildren();
      return;
    }
    let consent = '';
    const ai = connectionState();
    const who = ai.kind === 'local' ? 'Kev on this computer' : 'Jev, through your OpenRouter account (billed to you),';
    if (state.mode === 'follow' && state.director && state.scoring?.prepared && ai.kind === 'none') {
      consent = '<p class="vd-note">Visuals follow this text locally. Connect OpenRouter on Home, or run RISE locally, to let a decision model direct them.</p>';
    } else if (state.mode === 'follow' && state.director && state.scoring?.prepared) {
      if (state.catalogVerified) {
        consent = `<p class="vd-note">${who} directs this released text automatically, one section ahead of you.</p>`;
      } else if (state.consent) {
        consent = `<div class="vd-consent"><p>Jev is directing these visuals. Sections of this reading are sent as you read; text already sent cannot be recalled.</p>
          <button type="button" data-vd="revoke">Stop sending</button></div>`;
      } else {
        consent = `<div class="vd-consent"><p>This reading stays on your device, and visuals follow it locally. Jev can direct them more closely if the reading is sent to it, one section at a time as you read.</p>
          <button type="button" class="vd-primary" data-vd="consent">Send this reading to Jev to direct its visuals.</button></div>`;
      }
    }
    host.innerHTML = `
      <p class="vd-provenance" id="vd-provenance" role="status">${escapeHtml(this._visualProvenanceLabel())}</p>
      ${consent}
      <p class="vd-status" id="vd-status" role="status" aria-live="polite">${escapeHtml(this._visualStatus || '')}</p>
      ${state.director ? '<button type="button" class="look-link" data-vd="workshop">Edit passage assignments in Workshop</button>' : ''}`;
  }

  /** Follow text, Hold this scene, or Off. Pending replies never change this. */
  setVisualDirectionMode(mode) {
    const state = this._direction;
    if (!state || !['follow', 'hold', 'off'].includes(mode) || state.mode === mode) return false;
    const previous = state.mode;
    const transitionMs = this._visualTransitionMs();
    if (mode === 'follow' && !(state.eligibility.canFollow && !state.directorError)) return false;
    state.mode = mode;
    this._visualStatus = '';
    if (mode === 'off') {
      this._visualSchedule = null;
      this._stopVisualWork(transitionMs);
    } else {
      if (previous === 'off') this._resumeVisualWork();
      if (mode === 'follow') {
        state.heldCue = null;
        if (!this._startFollowText()) {
          state.mode = previous;
          this._refreshLookSheet();
          return false;
        }
      this._lastDirectedCue = null;
      this._lastDirectedCueId = null;
        this._directedSchedule.reset();
        const atom = this._currentReadingAtom();
        if (atom) {
          const entered = state.director.observe(atom);
          if (entered) state.currentBlock = entered.index;
          this._directedSchedule.observe(atom);
        }
      } else if (previous === 'follow') {
        // Hold keeps exactly the scene on screen and stops following.
        this._visualSchedule = null;
        state.heldCue = this._currentVisualCue || null;
      } else if (state.heldCue) {
        this._visualSchedule = null;
        this.applyScheduledVisualCue(state.heldCue, { transitionMs });
      } else {
        this._restoreOwnVisuals(transitionMs);
      }
    }
    this._syncScoringActivity();
    this._refreshLookSheet();
    return true;
  }

  /** Off: stop all visual work, including the Gallery's own clock. */
  _stopVisualWork(transitionMs = 0) {
    this.applyScheduledVisualCue({ kind: 'still' }, { transitionMs });
    this._visualFieldDirector?.clear({ transitionMs });
    if (visualCortex.pauseContinuousField?.() === true) this._offGalleryPaused = true;
  }

  _resumeVisualWork() {
    if (this._offGalleryPaused && this.player?.state === 'playing') visualCortex.resumeContinuousField?.();
    this._offGalleryPaused = false;
  }

  /** The reading's own visuals: its authored schedule or its configuration. */
  _restoreOwnVisuals(transitionMs = 0) {
    if (this._ownSchedule) {
      this._visualSchedule = this._ownSchedule;
      this._ownSchedule.reset();
      const atom = this._currentReadingAtom();
      if (atom) this._ownSchedule.observe(atom);
      return;
    }
    const mode = this.session?.visualConfig?.visualMode;
    this._currentVisualCue = null;
    this._visualFieldDirector?.clear({ transitionMs });
    if (mode === 'genesis') this.initializeGenesis();
    else if (mode === 'attractor') this.initializeAttractor();
    else if (mode === 'focals') this.initializeFocal();
    else if (mode === 'interlocution') {
      visualCortex.updateConfig({ activeTypes: [...this._ownActiveTypes] }, { preservePresentation: true });
    }
  }

  setVisualEnergy(energy) {
    this._visualEnergy = Math.max(0, Math.min(1, Number(energy) || 0));
    if (this._direction) this._direction.energy = this._visualEnergy;
    // Energy alone never changes the direction mode.
    this._visualFieldDirector?.active?.setEnergy?.();
  }

  /** Geometry, color, or mutation selects Hold: the reader has taken the scene. */
  _editHeldFlame(transform, { record = true, transitionMs = this._visualTransitionMs() } = {}) {
    const state = this._direction;
    const current = this._currentFlameConfig();
    if (!state || !current) return false;
    let recipe;
    try {
      recipe = validateFlameRecipe(transform(current.recipe));
    } catch {
      return false;
    }
    if (record) {
      state.history.push(current.recipe);
      if (state.history.length > 20) state.history.shift();
    }
    state.mode = 'hold';
    state.heldCue = this._flameCue(recipe, current.intensity);
    this._visualSchedule = null;
    this.applyScheduledVisualCue(state.heldCue, { transitionMs });
    this._syncScoringActivity();
    this._refreshLookSheet();
    return true;
  }

  /** Explicit reader action, scoped to this exact source and this reading. */
  async grantVisualConsent() {
    const state = this._direction;
    if (!state?.scoring?.prepared) return false;
    state.consent = { sourceDigests: [...state.scoring.sourceDigests] };
    this._syncScoringPermission();
    this._syncScoringActivity();
    this._refreshLookSheet();
    return true;
  }

  revokeVisualConsent() {
    const state = this._direction;
    if (!state) return false;
    state.consent = null;
    state.scoring?.revoke();
    this._syncScoringPermission();
    this._refreshLookSheet();
    return true;
  }

  /** The Lab over the reading: reading and audio pause; position is kept. */
  async openVisualLab() {
    if (this._labOpen || this._destroyed) return false;
    this._labOpen = true;
    this._pauseLikePlay(true);
    this._syncScoringActivity();
    this.closeLookSheet(false);
    const host = document.createElement('div');
    host.className = 'chamber-lab-host';
    this.container.appendChild(host);
    this._labHost = host;
    try {
      const { VisualLab } = await import('../make/VisualLab.js');
      if (!this._labOpen || this._destroyed) return false;
      this._lab = new VisualLab(host, {
        mode: 'overlay',
        recipe: this._currentFlameConfig()?.recipe || null,
        onUseInReading: recipe => {
          this.closeVisualLab();
          this._holdRecipe(recipe);
        },
        onEditInWorkshop: () => {
          this.closeVisualLab();
          void this.editPassagesInWorkshop();
        },
        onClose: () => this.closeVisualLab()
      });
      return true;
    } catch (error) {
      console.warn('[Chamber] Visual Lab unavailable:', error);
      this.closeVisualLab();
      return false;
    }
  }

  /** Returning keeps the reading paused: audio never resumes silently. */
  closeVisualLab() {
    this._lab?.destroy();
    this._lab = null;
    this._labHost?.remove();
    this._labHost = null;
    this._labOpen = false;
    this._syncScoringActivity();
    this.container.querySelector('#look-btn')?.focus?.();
  }

  _holdRecipe(recipe) {
    const valid = normalizeFlameRecipe(recipe);
    const state = this._direction;
    if (!valid || !state) return false;
    if (state.mode === 'off') this._resumeVisualWork();
    const current = this._currentFlameConfig();
    if (current) state.history.push(current.recipe);
    state.mode = 'hold';
    state.heldCue = this._flameCue(valid, valid.macros.energy);
    this._visualSchedule = null;
    this.applyScheduledVisualCue(state.heldCue, { transitionMs: this._visualTransitionMs() });
    this._syncScoringActivity();
    return true;
  }

  /**
   * Save this reading, with the choices it has admitted, as a Workshop
   * project and open its passage assignments there.
   */
  async editPassagesInWorkshop() {
    const director = this._direction?.director;
    if (!director) return false;
    try {
      const { readingToWorkshopProject } = await import('../../core/passage-visuals/workshop-export.js');
      const projectId = `directed-${Date.now().toString(36)}`;
      const project = readingToWorkshopProject({
        session: this.session, director, projectId, updatedAt: Date.now(),
        flameRecipe: themedFlameLookup(flamePreset, sessionColorTheme(this.session))
      });
      const saved = await MemoryCore.saveWorkshopBlueprintAsync(project);
      if (!saved) throw new Error('The Workshop project was not saved.');
      this.onExit('visual-passages', { blueprintId: projectId });
      return true;
    } catch (error) {
      console.warn('[Chamber] Could not open this reading in the Workshop:', error);
      this._visualStatus = 'This reading could not be opened in the Workshop.';
      this._refreshLookSheet();
      return false;
    }
  }

  /** Follow text: schedule this reading's own passage direction. */
  _startFollowText() {
    const director = ensureDirector(this.session, this._direction);
    if (!director) {
      console.warn('[Chamber] Passage direction unavailable:', this._direction?.directorError);
      if (this._direction) this._direction.mode = 'hold';
      return false;
    }
    this._directedSchedule ||= new VisualScheduleController(
      followProgram(this.session, director, this._direction.eligibility),
      (cue, meta) => this._applyDirectedCue(cue, meta),
      { atoms: this.session.atoms }
    );
    this._visualSchedule = this._directedSchedule;
    // The reading's own Gallery engine must not flash up before the first
    // directed cue arrives with the first atom.
    visualCortex.applyCue({ kind: 'still' }, { cueId: 'passage-direction' });
    void this._startVisualScoring();
    return true;
  }

  /**
   * Lazily attach Jev lookahead. Catalog readings verified against the
   * released archive may be scored automatically; any other text is sent
   * only after the reader's explicit consent for this exact source.
   */
  async _startVisualScoring() {
    const state = this._direction;
    if (!state?.director) return;
    try {
      if (!state.scoring) {
        const [{ VisualScoreCoordinator, VisualScoreCache }, { verifyCatalogReading }] = await Promise.all([
          import('../../core/passage-visuals/scoring-client.js'),
          import('../../core/passage-visuals/catalog-identity.js')
        ]);
        if (state.scoring) return this._startVisualScoring();
        let storage = null;
        try { storage = window.localStorage; } catch { storage = null; }
        state.scoring = new VisualScoreCoordinator({
          director: state.director,
          sources: state.director.sources.map(source => ({ id: source.id, text: source.text })),
          cache: new VisualScoreCache({ storage }),
          onEvent: event => state.onScoringEvent?.(event)
        });
        state.scoringReady = state.scoring.prepare();
        state.catalogCheck = verifyCatalogReading(this.session).catch(() => false);
      }
      await state.scoringReady;
      state.catalogVerified = await state.catalogCheck;
    } catch (error) {
      console.warn('[Chamber] Jev visual direction unavailable:', error?.message || error);
      return;
    }
    if (this._destroyed) return;
    state.onScoringEvent = event => this._onScoringEvent(event);
    this._syncScoringPermission();
    this._syncScoringActivity();
    const current = this._direction.director.blockIndexForAtom(this._jevCurrentAtom || this.session?.atoms?.[0]);
    if (current >= 0) state.scoring.observe(current);
  }

  /** Transmission permission: verified catalog text, or explicit consent. */
  _syncScoringPermission() {
    const state = this._direction;
    if (!state?.scoring?.prepared) return;
    state.scoring.setPermission(permittedSourceDigests({
      digests: state.scoring.sourceDigests,
      catalogVerified: state.catalogVerified,
      consent: state.consent
    }));
  }

  /** No new request while paused, hidden, outside the Chamber, Hold, or Off. */
  _syncScoringActivity() {
    const state = this._direction;
    state?.scoring?.setActivity({
      playing: this.player?.state === 'playing',
      visible: typeof document === 'undefined' || !document.hidden,
      inChamber: !this._destroyed && this._active !== false && !this.pageModeActive && !this._labOpen,
      mode: state.mode
    });
  }

  _onScoringEvent(event) {
    if (event?.kind === 'scored' || event?.kind === 'cached' || event?.kind === 'failed') {
      this._direction.lastScoring = event;
      this._refreshLookSheet();
    }
  }

  /**
   * Present one block's admitted cue. Identical adjacent cues collapse, a
   * very short block holds the scene before it, and a change crossfades
   * over 1.2 s (immediately under reduced motion).
   */
  _applyDirectedCue(cue, meta = {}) {
    if (this._direction?.mode !== 'follow') return false;
    const director = this._direction.director;
    const index = director?.program.segments.findIndex(segment => segment.id === meta.cueId) ?? -1;
    this._direction.cueSource = index >= 0 ? 'block' : 'saved';
    if (this._lastDirectedCue && index >= 0 && director.holdsPrevious(index)) return false;
    const cueId = meta.cueId ?? null;
    if (this._lastDirectedCue && cueId === this._lastDirectedCueId
      && JSON.stringify(cue) === JSON.stringify(this._lastDirectedCue)) return false;
    this._lastDirectedCue = cue;
    this._lastDirectedCueId = cueId;
    const reduced = this._prefersReducedMotion()
      || document.documentElement.classList.contains('reduced-motion')
      || document.documentElement.classList.contains('photosensitivity-mode');
    return this.applyScheduledVisualCue(cue, { ...meta, transitionMs: reduced ? 0 : 1200 });
  }

  /** One scheduled cue owns the complete visual presentation transition. */
  applyScheduledVisualCue(cue, meta = {}) {
    this._currentVisualCue = cue || null;
    this.applyScheduledColorTheme(cue?.colorTheme);
    const fieldCue = cue?.kind === 'focal'
      ? { kind: 'field', renderer: 'focal', config: cue.focal || {} }
      : cue;
    const transitionMs = Number.isFinite(meta.transitionMs)
      ? Math.max(0, Math.min(meta.transitionMs, 2000))
      : authoredVisualTransition(meta.durationMs, 320);
    const authority = (Number.isInteger(this._scheduledVisualGeneration)
      ? this._scheduledVisualGeneration : 0) + 1;
    this._scheduledVisualGeneration = authority;
    const commit = () => {
      if (authority !== this._scheduledVisualGeneration) return false;
      if (fieldCue?.kind === 'field') {
        // Mount the incoming field before retiring any cortex presenter.
        this._visualFieldDirector?.applyCue(fieldCue, { transitionMs });
        visualCortex.applyCue(cue, { ...meta, transitionMs });
      } else {
        // The successor is admitted before the outgoing field is retired.
        visualCortex.applyCue(cue, { ...meta, transitionMs });
        this._visualFieldDirector?.applyCue(fieldCue, { transitionMs });
      }
      return true;
    };
    if (fieldCue?.kind === 'field') {
      return commit();
    }
    // Cue authority changes synchronously. A cold Gallery already holds its
    // committed work, while an outgoing field is retired only after the new
    // cue has a decoded/generated first frame.
    visualCortex.applyCue(cue, { ...meta, transitionMs });
    if (visualCortex.isCuePrepared(cue)) {
      this._visualFieldDirector?.applyCue(fieldCue, { transitionMs });
      return true;
    }
    void visualCortex.prepareCue(cue).then((ready) => {
      if (!ready || authority !== this._scheduledVisualGeneration) return;
      visualCortex.presentPreparedCue(cue, { ...meta, transitionMs });
      this._visualFieldDirector?.applyCue(fieldCue, { transitionMs });
    });
    return false;
  }

  /**
   * Gallery — the Continuous Field (CONTINUOUS-FIELD-SPEC). A persistent
   * two-layer crossfade behind the reading that never fades to black,
   * holding whichever pool the reading provides and swapping smoothly at
   * each pericope boundary. Like Genesis and the attractor, its host sits
   * behind the text on a glass tile; unlike the flash economy, it is a
   * steady presenter with no flash rate. The cortex owns its lifecycle —
   * here we only mount the host and hand it over.
   */
  initializeContinuousField() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'interlocution') return;
    if (!isContinuousPresentation(visualConfig.interlocution?.presentation)) return;

    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    field.classList.add('chamber-field-stream');

    const host = document.createElement('div');
    host.className = 'chamber-continuous-field';
    host.id = 'chamber-continuous-field';

    const atomDisplay = field.querySelector('#atom-display');
    this._insertBehindReading(field, host);

    // Glass tile on by default — the text must stay legible over imagery
    // (the field's whole reason to exist is a presence behind the reading).
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false && this.glassCanApply()) {
      atomDisplay.classList.add('glass-tile');
    }

    visualCortex.setContinuousFieldHost(host);
    console.log('[Chamber] Continuous Field (Gallery) host mounted');
    this.applyChamberMask();
    this.syncMaskGroundPlate();
  }

  /**
   * Stream-maintaining Rhythmic: the reading stream never leaves the
   * screen while imagery presents beneath it. Because nothing is
   * concealed there is no covered phase and no concealed text swap —
   * this surface is structurally free of the full-frame handoff race.
   */
  initializeStreamPresentation() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'interlocution') return;
    if (visualConfig.interlocution?.presentation !== 'behind-stream') return;

    const field = this.container.querySelector('#chamber-field');
    field?.classList.add('chamber-field-stream');

    const atomDisplay = this.container.querySelector('#atom-display');
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false && this.glassCanApply()) {
      atomDisplay.classList.add('glass-tile');
    }
  }

  /**
   * One Page plate of the attractor at `seconds`. With night streaks the
   * plate carries both layers, as the Stream shows them.
   */
  _sampleAttractorPlate(seconds) {
    const filament = this.attractorField.sampleAt(seconds);
    const streaks = this.nightStreaks;
    if (!streaks?.sampleAt || !filament) return filament;
    try {
      streaks.sampleAt(seconds);
      const under = streaks.canvas;
      const over = this.attractorField.canvas;
      const plate = document.createElement('canvas');
      plate.width = over.width;
      plate.height = over.height;
      const ctx = plate.getContext('2d');
      if (!ctx) return filament;
      ctx.drawImage(under, 0, 0, plate.width, plate.height);
      ctx.drawImage(over, 0, 0);
      return plate.toDataURL('image/webp', 0.9);
    } catch {
      return filament;
    }
  }

  mountVisualFieldCue(cue) {
    const field = this.container.querySelector('#chamber-field');
    if (!field || cue?.kind !== 'field') return null;
    const config = cue.config && typeof cue.config === 'object' ? cue.config : {};
    // The reading's theme fills what the cue left to the engine: an absent
    // or white palette, an absent or random preset. An explicit value wins,
    // and the cue is never written, so a saved cue replays exactly.
    const theme = sessionColorThemeId(this.session);
    const atomDisplay = field.querySelector('#atom-display');
    let controller = null;
    let visualControl = null;
    let destroyed = false;
    const host = document.createElement('div');

    if (cue.renderer === 'genesis') {
      host.className = 'chamber-genesis';
      field.classList.add('chamber-field-genesis');
      if (atomDisplay && config.glass !== false && this.glassCanApply()) {
        atomDisplay.classList.add('glass-tile');
      }
      this._insertBehindReading(field, host);
      controller = new KleeField(host, {
        preset: config.preset && config.preset !== 'random'
          ? config.preset
          : (themeEngine(theme, 'genesis')?.preset ?? 'random')
      });
      this.kleeField = controller;
    } else if (cue.renderer === 'attractor') {
      host.className = 'chamber-attractor';
      this._insertBehindReading(field, host);
      // Night drive: light streaks run underneath the filament, on the
      // same pause, resume and sample contract.
      const streaks = config.streaks === true
        ? new NightStreaks(host, { speed: config.speed, intensity: config.intensity })
        : null;
      if (streaks) {
        host.classList.add('chamber-attractor-night');
        field.classList.add('chamber-field-night');
        // Bright filaments cross the centre; the stream glass keeps the
        // words readable against the brightest frame.
        if (atomDisplay && this.glassCanApply()) atomDisplay.classList.add('glass-tile');
      }
      // White is no choice: the theme's whole row (system, palette, form) goes
      // in, since brightness is pinned per palette-and-form pair.
      const look = !config.palette || config.palette === 'white'
        ? { ...config, ...themeEngine(theme, 'attractor') }
        : config;
      const attractor = new AttractorField(host, {
        system: look.system || 'aizawa',
        palette: look.palette,
        form: look.form,
        ...(Number.isFinite(config.intensity) ? { intensity: config.intensity } : {}),
        ...(Number.isFinite(config.speed) ? { speed: config.speed } : {})
      });
      // The cue keeps its own palette; a theme set over the reading recolours the filament it mounts.
      this._fieldOwnPalette = attractor.palette;
      if (this._colourTheme) attractor.setPalette(RISE_CURRENT_THEMES[this._colourTheme].attractor.palette);
      this.attractorField = attractor;
      visualControl = {
        discoverVisual: () => destroyed ? null : attractor.discoverVisual(),
        controlVisual: command => destroyed
          ? { status: 'refused', code: 'NO_ACTIVE_VISUAL' }
          : attractor.controlVisual(command),
        cancelVisualControl: () => attractor.cancelVisualControl()
      };
      // What the field was actually given, where a test or an inspector can read it.
      host.dataset.attractorSpeed = String(attractor.speed);
      host.dataset.attractorIntensity = String(attractor.intensity);
      this.nightStreaks = streaks;
      controller = streaks ? {
        pause: () => { streaks.pause(); return attractor.pause(); },
        resume: () => { streaks.resume(); attractor.resume(); },
        destroy: () => {
          streaks.destroy();
          attractor.destroy();
          if (this.nightStreaks === streaks) this.nightStreaks = null;
          if (this.attractorField === attractor) this.attractorField = null;
        }
      } : attractor;
    } else if (cue.renderer === 'living-flame') {
      const flame = normalizeLivingFlameConfig(config);
      if (!flame) return null;
      host.className = 'chamber-living-flame';
      // The same glass grammar Genesis uses keeps words readable over light.
      field.classList.add('chamber-field-genesis');
      if (atomDisplay && this.glassCanApply()) atomDisplay.classList.add('glass-tile');
      this._insertBehindReading(field, host);
      let paused = this._visualFieldDirector?.paused === true;
      let intensity = flame.intensity;
      const reducedMotion = this._prefersReducedMotion()
        || document.documentElement.classList.contains('reduced-motion')
        || document.documentElement.classList.contains('photosensitivity-mode');
      void import('../../visuals/living-flame/index.js').then(({ createLivingFlameField }) => {
        if (destroyed || !host.isConnected) return;
        controller = createLivingFlameField(host, {
          recipe: flame.recipe,
          energy: this._effectiveFlameEnergy(intensity),
          clock: () => this._visualClockMs(),
          reducedMotion
        });
        if (paused) controller.pause();
        this.livingFlameField = controller;
      }).catch(error => console.warn('[Chamber] Living Flame unavailable:', error));
      return {
        node: host,
        renderer: 'living-flame',
        pause: () => { paused = true; controller?.pause?.(); },
        resume: () => { paused = false; controller?.resume?.(); },
        setEnergy: () => controller?.setEnergy?.(this._effectiveFlameEnergy(intensity)),
        morph: (next, { transitionMs } = {}) => {
          const nextFlame = normalizeLivingFlameConfig(next?.config);
          if (!nextFlame || !controller?.canMorphTo?.(nextFlame.recipe)) return false;
          intensity = nextFlame.intensity;
          controller.setRecipe(nextFlame.recipe, { transitionMs: reducedMotion ? 0 : transitionMs });
          controller.setEnergy(this._effectiveFlameEnergy(intensity));
          return true;
        },
        destroy: () => {
          destroyed = true;
          controller?.destroy?.();
          if (this.livingFlameField === controller) this.livingFlameField = null;
          host.remove();
          if (!field.querySelector('.chamber-genesis, .chamber-living-flame')) {
            field.classList.remove('chamber-field-genesis');
            if (!field.classList.contains('chamber-field-stream')) {
              atomDisplay?.classList.remove('glass-tile');
            }
          }
        }
      };
    } else if (cue.renderer === 'focal') {
      host.className = 'chamber-focal';
      const personalImage = config.type === 'personal'
        ? (config.personalImage || this.session?.sequenceVisualAssets?.find(asset =>
          asset.id === config.personalAssetId && asset.kind !== 'video')?.uri)
        : null;
      if (config.type === 'rose' || config.standardGlyph === 'rose') {
        const roseConfig = config.type === 'rose' ? config : {
          petala: config.petala || 12, seed: config.seed, roseMode: config.roseMode
        };
        void this.initializeRoseFocal(host, roseConfig, { assign: false }).then(instance => {
          if (!instance) return;
          if (destroyed || !host.isConnected) instance.destroy();
          else { controller = instance; this.rosaField = instance; }
        });
      } else if (config.type === 'icon' && config.iconId) {
        void this.initializeIconFocal(host, config.iconId);
      } else if (config.type === 'personal' && personalImage) {
        const image = document.createElement('img');
        image.src = personalImage;
        image.alt = 'Personal focal';
        image.className = 'focal-image';
        const frame = document.createElement('div');
        frame.className = 'focal-personal';
        frame.appendChild(image);
        host.appendChild(frame);
      } else {
        const glyphData = this.getFocalGlyph(config.standardGlyph || 'breath');
        const glyph = document.createElement('div');
        glyph.className = `focal-glyph ${glyphData.dynamic ? 'focal-dynamic' : ''}`;
        const icon = document.createElement('span');
        icon.className = 'focal-icon';
        icon.textContent = glyphData.icon;
        glyph.appendChild(icon);
        host.appendChild(glyph);
      }
      this._insertBehindReading(field, host);
    } else {
      return null;
    }

    return {
      node: host,
      pause: () => controller?.pause?.(),
      resume: () => controller?.resume?.(),
      ...(visualControl || {}),
      destroy: () => {
        destroyed = true;
        controller?.destroy?.();
        if (this.kleeField === controller) this.kleeField = null;
        if (this.attractorField === controller) this.attractorField = null;
        if (this.rosaField === controller) this.rosaField = null;
        host.remove();
        if (!field.querySelector('.chamber-attractor-night')) field.classList.remove('chamber-field-night');
        if (!field.querySelector('.chamber-genesis, .chamber-living-flame')) {
          field.classList.remove('chamber-field-genesis');
          if (!field.classList.contains('chamber-field-stream')) {
            atomDisplay?.classList.remove('glass-tile');
          }
        }
      }
    };
  }

  /**
   * Whether this Chamber's visual is on screen to discover or control. The
   * router shows the view (hidden = false) before fading it in and naming it
   * current, and the reading and its field start then, so visibility is
   * `hidden` on the Chamber's pane or the Read room around it, not the
   * router's current view.
   */
  visualShown() {
    return !this._destroyed && !this.pageModeActive && !this._temporalVisualsDeferred
      && !this.container?.closest('[hidden]');
  }

  discoverVisual() {
    if (!this.visualShown()) return null;
    return this._visualFieldDirector?.discoverVisual() || null;
  }

  controlVisual(command) {
    if (!this.visualShown()) {
      return { status: 'refused', code: 'NO_ACTIVE_VISUAL' };
    }
    return this._visualFieldDirector?.controlVisual(command)
      || { status: 'refused', code: 'NO_ACTIVE_VISUAL' };
  }

  /** Logical reading time for Living Flame, in milliseconds. */
  _visualClockMs() {
    const elapsed = Number(this.player?.elapsed) || 0;
    return Math.max(0, elapsed + this._visualClockOffsetMs);
  }

  /** A non-sequential atom is a seek: move the clock to that atom's start. */
  _trackVisualClock(index) {
    if (!Number.isInteger(index)) return;
    const last = this._lastVisualAtomIndex;
    this._lastVisualAtomIndex = index;
    if (last === null || index === last + 1) return;
    if (!this._atomStartsMs) {
      const atoms = Array.isArray(this.session?.atoms) ? this.session.atoms : [];
      const starts = new Float64Array(atoms.length + 1);
      for (let i = 0; i < atoms.length; i += 1) {
        starts[i + 1] = starts[i] + Math.max(0, Number(atoms[i]?.duration) || 0);
      }
      this._atomStartsMs = starts;
    }
    const start = this._atomStartsMs[Math.min(index, this._atomStartsMs.length - 1)] || 0;
    this._visualClockOffsetMs = start - (Number(this.player?.elapsed) || 0);
  }

  /**
   * Effective Living Flame energy in the reader: the cue's intensity band
   * scaled by the reader's Energy control, never above 0.65.
   */
  _effectiveFlameEnergy(intensity) {
    const band = Number.isFinite(intensity) ? intensity : 0.35;
    return Math.max(0, Math.min(0.65, band * this._visualEnergy / 0.35));
  }

  /**
   * Genesis ("Motion Klee"): a Klee composition grows continuously around
   * the constant token stream — no flashes, no interruption. The text sits
   * on a glass panel (see Chamber.css) for readability over the drawing.
   */
  initializeGenesis() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'genesis') return;
    this._visualFieldDirector?.applyCue({
      kind: 'field', renderer: 'genesis', config: visualConfig.genesis || {}
    });
  }

  /**
   * Initialize persistent strange-attractor field
   * A continuous chaotic filament orbiting the centered text stream
   */
  initializeAttractor() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'attractor') return;
    this._visualFieldDirector?.applyCue({
      kind: 'field', renderer: 'attractor', config: visualConfig.attractor || {}
    });
  }

  /**
   * Initialize persistent focal point for neurosensitive-friendly viewing
   */
  initializeFocal() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'focals') return;
    this._visualFieldDirector?.applyCue({
      kind: 'field', renderer: 'focal', config: visualConfig.focals || {}
    });
  }

  /**
   * Mount the ROSA MYSTICA rose window as a persistent focal field.
   * Lazy import keeps the engine out of non-Chapel graphs; any
   * failure yields stillness.
   */
  async initializeRoseFocal(focalContainer, focals, { assign = true } = {}) {
    try {
      const { RosaMystica } = await import('../../visuals/rosa-mystica.js');
      if (!this.container.contains(focalContainer)) return;
      const host = document.createElement('div');
      host.className = 'focal-rose';
      focalContainer.appendChild(host);
      const instance = new RosaMystica(host, {
        petala: focals.petala,
        seed: focals.seed,
        mode: focals.roseMode
      });
      if (assign) this.rosaField = instance;
      console.log('[Chamber] Rosa Mystica initialized:', instance.petala, 'petala,',
        instance.mode, '· OPVS', instance.seed.toString(16).toUpperCase());
      return instance;
    } catch (e) {
      console.warn('[Chamber] Rosa Mystica unavailable:', e);
      return null;
    }
  }

  /**
   * Resolve and mount a Chapel icon focal. Lazy import keeps chapel
   * content out of every non-Chapel session's graph; a failed load
   * yields an empty focal (reverent degradation — stillness, never a
   * wrong image, never an error surface mid-devotion).
   */
  async initializeIconFocal(focalContainer, iconId) {
    try {
      const { findChapelIcon } = await import('../../content/chapel/imagery/icons.js');
      const icon = findChapelIcon(iconId);
      if (!icon || !this.container.contains(focalContainer)) return;

      const img = document.createElement('img');
      img.className = 'focal-icon-image';
      img.alt = icon.name;
      img.decoding = 'async';
      img.onload = () => {
        if (!this.container.contains(focalContainer)) return;
        const frame = document.createElement('div');
        frame.className = 'focal-icon-frame';
        frame.title = icon.attribution;
        frame.appendChild(img);
        focalContainer.appendChild(frame);
      };
      // onerror: nothing mounts — the focal stays still and empty
      img.src = icon.image;
    } catch (e) {
      console.warn('[Chamber] Icon focal unavailable:', e);
    }
  }

  /**
   * Get focal glyph data by ID
   */
  getFocalGlyph(id) {
    const glyphs = {
      breath: { icon: '◯', dynamic: true },
      anchor: { icon: '⚓', dynamic: false },
      lotus: { icon: '❀', dynamic: false },
      eye: { icon: '◉', dynamic: true },
      spiral: { icon: '◌', dynamic: true },
      star: { icon: '✦', dynamic: false },
      wave: { icon: '≈', dynamic: true },
      void: { icon: '●', dynamic: false }
    };
    return glyphs[id] || glyphs.breath;
  }

  /**
   * Living Text: map the semantic signal for this atom onto text hue + glow.
   * Valence shifts hue (cool blue ← neutral → warm parchment) at near-constant
   * luminance; arousal drives a soft glow. Styles are static per atom — the
   * smoothed track makes consecutive atoms perceptually continuous, so there
   * is no flicker and nothing for photosensitive users to worry about.
   * No-op when the track is absent (Living Text off).
   */
  /**
   * Paint an atom's text into the display.
   *
   * Two shapes, and the cheap one is the default. Plain text goes
   * through `textContent` exactly as it always has — no spans, no
   * parsing, no HTML — because that is the hot path every ordinary
   * reading takes and it must not pay for a feature it is not using.
   *
   * Text that carries authored emphasis, or an atom that will be
   * revealed word by word, is built from per-word spans instead.
   * `textContent` cannot colour part of a phrase and cannot reveal one
   * word at a time, so this is the price of both features.
   *
   * SAFETY. Building markup from content is a new injection surface
   * where `textContent` was inherently safe, so every word is escaped.
   * The only markup that reaches the DOM is the span scaffolding this
   * function writes.
   *
   * @returns {HTMLElement[]|null} the word spans, or null when the text
   *   was painted plainly and there is nothing to reveal.
   */
  /**
   * Put a visual layer into the field behind the reading.
   *
   * Single insert path for continuous field, genesis, attractor, and
   * focal: insert before the band (or append if missing). Do not
   * insertBefore relative to #atom-display — after the band wrapper,
   * the display is no longer a direct field child.
   */
  _insertBehindReading(field, node) {
    const anchor = field.querySelector('#atom-band')
      || field.querySelector('#atom-display');
    if (anchor && anchor.parentNode === field) {
      field.insertBefore(node, anchor);
    } else {
      field.appendChild(node);
    }
  }

  paintAtomText(atomDisplay, content, { reveal = false } = {}) {
    const words = splitWords(content);
    const marked = words.some(w => w.emphasised);

    if (!reveal && !marked) {
      atomDisplay.textContent = stripEmphasis(content);
      return null;
    }

    atomDisplay.innerHTML = words.map(w =>
      `<span class="atom-word${w.emphasised ? ' is-emphasised' : ''}"` +
      `${reveal ? ' data-pending=""' : ''}>${escapeHtml(w.text)}</span>`
    ).join(' ');

    return reveal ? Array.from(atomDisplay.querySelectorAll('.atom-word')) : null;
  }

  /**
   * Draw the seam between two pieces.
   *
   * A DEPTH IS A DIFFERENT WEIGHT, NOT A DIFFERENT SENTENCE. Arriving in
   * another epitaph and arriving in another book were indistinguishable, and
   * the fix is not more words — it is that one crossing is a quiet name and
   * the other is an announcement with a rule under it. Both last exactly as
   * long as the boundary atom the score already scheduled; nothing here owns
   * a clock.
   *
   * Built with DOM calls rather than markup, so a work title or a division
   * label is text and can never be anything else.
   */
  paintSeam(atomDisplay, seam) {
    this.cancelReveal();
    this._concealedReveal = null;
    atomDisplay.textContent = '';
    // A seam belongs to the reading, not to the passage that just ended:
    // Living Text's colour and the previous phrase's size are both cleared
    // so a mood does not leak across a boundary.
    atomDisplay.style.removeProperty('color');
    atomDisplay.style.removeProperty('text-shadow');
    atomDisplay.style.removeProperty('--atom-scale');

    const mark = document.createElement('div');
    mark.className = 'atom-seam';
    mark.dataset.seamDepth = seam.depth;
    // The eye is given the part that changed; a reader who cannot see the
    // screen is given the whole identity, since they have no page around it.
    mark.setAttribute('aria-label', seam.name);
    const label = document.createElement('span');
    label.className = 'atom-seam-label';
    label.textContent = seam.label;
    mark.append(label);
    atomDisplay.append(mark);

    atomDisplay.style.transition = 'opacity 150ms var(--ease-out)';
    atomDisplay.style.opacity = '1';
    void this.syncFillGlyphMask();
  }

  /**
   * Reveal an atom's words over time.
   *
   * The schedule decides WHEN each word appears; this only applies it.
   * Timers are tracked so a reader who advances early does not get the
   * previous atom's words arriving over the new one — the commonest way
   * an animation like this goes wrong.
   */
  revealAtomWords(spans, schedule) {
    this.cancelReveal();
    if (!spans?.length) return;
    this._beginProgressiveGlass(spans);
    // THE WORD THE READER LANDS ON DOES NOT CONDENSE. Every other word
    // has a successor to draw the eye onward while it finishes resolving,
    // and 360ms of blur costs it nothing. The last one has none, and an
    // atom can end before that 360ms is up — so the final word of a
    // phrase was still soft at the moment the phrase was replaced, and
    // never came into focus at all. It fades in sharp instead.
    spans[spans.length - 1].setAttribute('data-final', '');
    // NOTHING TRAVELS. The glass is not a bound that moves to meet each
    // word; it is fog that arrives with the word, where the word is. So a
    // word and its glass share one timer, and neither leads the other.
    this._revealTimers = spans.map((span, i) => {
      const at = Math.max(0, Number(schedule[i]) || 0);
      if (at <= 0) { this._revealAtomWord(span); return null; }
      return setTimeout(() => this._revealAtomWord(span), at);
    }).filter(Boolean);
  }

  _beginProgressiveGlass(spans) {
    const atomDisplay = spans?.[0]?.parentElement;
    if (!this._progressiveGlassCanApply(atomDisplay)) return;
    this._progressiveGlassElement = atomDisplay;
    this._progressiveGlassPanes = [];
    atomDisplay.classList.add('is-progressive-glass');
  }

  _progressiveGlassCanApply(atomDisplay) {
    return this.progressiveRevealEnabled
      && atomDisplay?.classList.contains('glass-tile')
      && !this._prefersReducedMotion()
      && window.matchMedia?.('(max-width: 640px)').matches !== true;
  }

  _revealAtomWord(span) {
    span.removeAttribute('data-pending');
    this._expandProgressiveGlass(span);
  }

  /**
   * The word's box in the display's own coordinates, or null if the
   * layout cannot be trusted yet.
   *
   * Offset metrics describe layout, not paint. The pending word's
   * entrance used to be a translateY, and a visual client rect taken
   * mid-entrance baked that transform permanently into the glass
   * position; the entrance is a blur now and has no transform to bake,
   * but the offset path stays preferred for the same underlying reason —
   * the atom box carries its own opacity and transform between atoms, and
   * layout is the only thing here that is never mid-animation.
   */
  _progressiveGlassWordBox(span, atomDisplay) {
    const layoutValues = [
      span.offsetLeft, span.offsetTop, span.offsetWidth, span.offsetHeight,
      atomDisplay.clientWidth, atomDisplay.clientHeight
    ];
    const hasLayoutBox = layoutValues.every(Number.isFinite)
      && span.offsetWidth > 0 && span.offsetHeight > 0
      && atomDisplay.clientWidth > 0 && atomDisplay.clientHeight > 0;

    let box;
    if (hasLayoutBox) {
      box = {
        left: span.offsetLeft,
        top: span.offsetTop,
        right: span.offsetLeft + span.offsetWidth,
        bottom: span.offsetTop + span.offsetHeight,
        displayWidth: atomDisplay.clientWidth,
        displayHeight: atomDisplay.clientHeight
      };
    } else {
      const wordRect = span.getBoundingClientRect();
      const displayRect = atomDisplay.getBoundingClientRect();
      box = {
        left: wordRect.left - displayRect.left,
        top: wordRect.top - displayRect.top,
        right: wordRect.right - displayRect.left,
        bottom: wordRect.bottom - displayRect.top,
        displayWidth: displayRect.width,
        displayHeight: displayRect.height
      };
    }

    const finite = [box.left, box.top, box.right, box.bottom,
      box.displayWidth, box.displayHeight].every(Number.isFinite);
    if (!finite || box.right <= box.left || box.bottom <= box.top
      || box.displayWidth <= 0 || box.displayHeight <= 0) return null;
    return box;
  }

  /**
   * Adds one word's pane to the fog.
   *
   * THE GLASS HAS NO EDGE, WHICH IS THE WHOLE POINT. An envelope that
   * grew to the union of the revealed words had a hard frontier, and a
   * hard frontier advancing left to right over a known distance is a
   * progress bar whatever curve it moves on — easing it only changes the
   * bar's feel, and animating it continuously (the previous attempt) made
   * it worse, because constant velocity is the one signature no living
   * thing has. Here each word contributes its own pane, feathered out
   * horizontally into nothing, and the panes sum. Adjacent words merge
   * into one band; the last one dissolves rather than stopping. There is
   * no boundary for the eye to follow and nothing moves at all.
   */
  _expandProgressiveGlass(span) {
    const atomDisplay = this._progressiveGlassElement;
    if (!atomDisplay?.classList.contains('is-progressive-glass')) return;

    const box = this._progressiveGlassWordBox(span, atomDisplay);
    if (!box) { this._resetProgressiveGlass(); return; }

    const style = getComputedStyle(atomDisplay);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;

    // Horizontal padding is the feather itself, so a word's pane reaches
    // full strength exactly at the word and neighbours overlap by two
    // feathers — which is what lets their ramps sum back to solid.
    const left = box.left - PROGRESSIVE_GLASS_FEATHER;
    const top = Math.max(0, box.top - padTop);
    const width = (box.right - box.left) + PROGRESSIVE_GLASS_FEATHER * 2;
    const height = Math.min(box.displayHeight - top, (box.bottom - box.top) + padTop + padBottom);
    if (!(width > 0) || !(height > 0)) { this._resetProgressiveGlass(); return; }

    const panes = this._progressiveGlassPanes || (this._progressiveGlassPanes = []);
    panes.push({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height)
    });

    atomDisplay.style.setProperty('--progressive-glass-mask',
      panes.map(() => PROGRESSIVE_GLASS_PANE).join(', '));
    atomDisplay.style.setProperty('--progressive-glass-mask-position',
      panes.map(pane => `${pane.left}px ${pane.top}px`).join(', '));
    atomDisplay.style.setProperty('--progressive-glass-mask-size',
      panes.map(pane => `${pane.width}px ${pane.height}px`).join(', '));
    atomDisplay.classList.add('is-progressive-glass-ready');
  }

  _resetProgressiveGlass() {
    const atomDisplay = this._progressiveGlassElement
      || this.container?.querySelector('#atom-display');
    atomDisplay?.classList.remove('is-progressive-glass', 'is-progressive-glass-ready');
    for (const property of [
      '--progressive-glass-mask',
      '--progressive-glass-mask-position',
      '--progressive-glass-mask-size'
    ]) {
      atomDisplay?.style.removeProperty(property);
    }
    this._progressiveGlassElement = null;
    this._progressiveGlassPanes = null;
  }

  _refreshProgressiveGlass() {
    const atomDisplay = this._progressiveGlassElement
      || this.container?.querySelector('#atom-display');
    const spans = [...(atomDisplay?.querySelectorAll('.atom-word') || [])];
    const hasPendingWords = spans.some(span => span.hasAttribute('data-pending'));
    const revealed = spans.filter(span => !span.hasAttribute('data-pending'));

    this._resetProgressiveGlass();
    if (!hasPendingWords || !this._progressiveGlassCanApply(atomDisplay)) return;

    // Re-measured from what is on screen. Nothing is in flight to preserve
    // now that a pane arrives with its word rather than travelling to it.
    this._beginProgressiveGlass(spans);
    for (const span of revealed) this._expandProgressiveGlass(span);
  }

  /** Stop a reveal in flight. Idempotent. */
  cancelReveal() {
    if (this._revealTimers) {
      for (const t of this._revealTimers) clearTimeout(t);
      this._revealTimers = null;
    }
    this._resetProgressiveGlass();
  }


  /**
   * How large the phrase is set — as a RATIO, not a pixel value.
   *
   * This wrote `style.fontSize = '40px'` directly, and an inline style
   * beats every rule in every stylesheet. So the mobile composition
   * could not size its own text: the media query specified 22px, the
   * element received 40px from here, and a seven-word phrase ran off a
   * 390px screen no matter what the CSS said.
   *
   * The intent was always right — a longer phrase wants a smaller face,
   * or it wraps to a wall — and it is kept exactly. What changes is that
   * the intent is published as a scale and the SIZE is decided in CSS,
   * where the viewport is known. Desktop multiplies it against 72px and
   * gets the same four steps it always had. The phone multiplies it
   * against a clamp, and compresses the range: at 22px a 0.44 step
   * would be ten pixels, so a long phrase there gains lines instead of
   * losing legibility.
   *
   * Sized on what is SHOWN — emphasis marks are notation and would
   * otherwise push a phrase into a smaller face than it needs.
   */
  sizeAtomText(atomDisplay, content) {
    atomDisplay.style.removeProperty('font-size');
    const fontSize = resolveFontSize(this.effectiveFontSize());
    atomDisplay.dataset.fontSize = fontSize;
    atomDisplay.style.setProperty('--font-size-intent', String(threeStepIntent(fontSize)));

    const useFit = isChamberWordFit(fontSize)
      && this.session?.chunkMode === 'word'
      && Boolean(stripEmphasis(content).trim());

    if (!useFit) {
      atomDisplay.classList.remove('is-word-fit');
      atomDisplay.style.removeProperty('--atom-fit-px');
      this._applyFitBorder(atomDisplay, false);
      atomDisplay.style.setProperty('--atom-scale', String(sizeAtomScale(content)));
      return;
    }

    const box = this._wordFitBox();
    const cs = getComputedStyle(atomDisplay);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const shown = stripEmphasis(content);
    const measured = this._measureWordGlyph(atomDisplay, shown);
    const computedFontPx = parseFloat(cs.fontSize);
    const computedLineHeight = parseFloat(cs.lineHeight);
    const lineHeightRatio = Number.isFinite(computedLineHeight)
      ? (Number.isFinite(computedFontPx) && computedFontPx > 0 && /px$/i.test(cs.lineHeight)
        ? computedLineHeight / computedFontPx
        : computedLineHeight)
      : 1.4;
    const px = fitWordAtomPx({
      fieldWidth: box.width,
      fieldHeight: box.height,
      padX,
      padY,
      measuredWidth: measured.width,
      measuredHeight: measured.height,
      measuredAt: measured.at,
      lineHeightRatio
    });
    if (px == null) {
      atomDisplay.classList.remove('is-word-fit');
      atomDisplay.style.removeProperty('--atom-fit-px');
      this._applyFitBorder(atomDisplay, false);
      atomDisplay.style.setProperty('--atom-scale', String(sizeAtomScale(content)));
      return;
    }
    atomDisplay.classList.add('is-word-fit');
    atomDisplay.style.setProperty('--atom-fit-px', `${px}px`);
    this._applyFitBorder(atomDisplay, true);
    atomDisplay.style.setProperty('--atom-scale', '1');
  }

  /**
   * THE BORDER IS THE FIT WORD'S EDGE, NOT THE MASK'S.
   *
   * It was set inside applyChamberMask and so existed only while imagery was
   * being painted through the letters. But its whole job is to give a word
   * that fills the chamber an edge to read against a busy field, and a word
   * filled with the accent needs that as much as one filled with a Rembrandt.
   * Gating it on the mask meant choosing Fit + Accent offered no border at
   * all — the panel did not even show the control.
   *
   * Owned here, on the one path that already decides whether a word is a Fit
   * word, so the property can never disagree with the class.
   */
  _applyFitBorder(atomDisplay, useFit) {
    const border = useFit ? this._maskSourceConfig().wordFill?.border : null;
    const color = border === 'cream'
      ? 'var(--color-light)'
      : border === 'accent'
        ? 'var(--color-accent)'
        : '';
    if (color) atomDisplay.style.setProperty('--fit-border-color', color);
    else atomDisplay.style.removeProperty('--fit-border-color');
  }

  _resolveWordFitBox() {
    const display = this.container.querySelector('#chamber-display');
    const rect = display?.getBoundingClientRect?.();
    const stageWidth = display?.clientWidth || rect?.width || 0;
    const stageHeight = display?.clientHeight || rect?.height || 0;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const smallestPositive = (...values) => {
      const positive = values.map(Number).filter(value => value > 1);
      return positive.length ? Math.min(...positive) : 0;
    };
    const stage = {
      width: smallestPositive(stageWidth, viewport?.width, root?.clientWidth),
      height: smallestPositive(stageHeight, viewport?.height, root?.clientHeight),
      source: 'chamber-stage'
    };
    const mobileSurface = stage.width <= 768
      || window.matchMedia?.('(pointer: coarse)')?.matches === true;
    if (mobileSurface) return stage;
    const aperture = visualCortex.getContinuousFieldArtworkAperture?.();
    if (!aperture?.width || !aperture?.height) return stage;
    return {
      width: Math.min(stage.width, aperture.width),
      height: Math.min(stage.height, aperture.height),
      source: 'collection-artwork'
    };
  }

  _wordFitBox() {
    return this._fitBoxSnapshot || this._resolveWordFitBox();
  }

  _measureWordGlyph(atomDisplay, text, atPx = 100) {
    const at = atPx;
    const cs = atomDisplay ? getComputedStyle(atomDisplay) : null;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext?.('2d');
      if (ctx && typeof ctx.measureText === 'function') {
        const family = cs?.fontFamily || 'serif';
        const weight = cs?.fontWeight || '400';
        ctx.font = `${weight} ${at}px ${family}`;
        const metrics = ctx.measureText(text || '');
        const width = Number(metrics.width);
        const height = (Number(metrics.actualBoundingBoxAscent) || 0)
          + (Number(metrics.actualBoundingBoxDescent) || 0);
        if (width > 0) {
          return { width, height: height > 0 ? height : at * 1.15, at };
        }
      }
    } catch {
      /* jsdom and missing canvas fall through to the estimate. */
    }
    const box = estimateGlyphBox(text, at);
    return { width: box.width, height: box.height, at };
  }

  /**
   * LIVING TEXT COLOURS THE TEXT. THAT IS THE WHOLE OF IT.
   *
   * It used also to wash the fill: a flat mood colour laid over the whole
   * generated image at up to 45% opacity, plus saturate and brightness
   * filters. Measured on real readings that reached 33-41% — so one control
   * moved the ink by a tenth and covered two fifths of the picture, with
   * nothing to say it did both. Worse, the wash was applied only to
   * procedural fills, so the same setting did a great deal, a little, or
   * nothing depending on a choice made in another pane.
   *
   * Tinting a generated field is a real idea and it is not this one. The way
   * to it is through the engine rather than over it: an Accent option on the
   * procedurals that hands the engine the colourway's own palette, so the
   * field is GENERATED in those colours instead of being covered in one.
   * That leaves the picture intact, which a wash by its nature cannot.
   */
  applyLivingText(atomDisplay, index) {
    if (!this.semanticTrack) return;
    const sig = this.semanticTrack[index];
    if (!sig) return;

    const intensity = this.session?.visualConfig?.livingText?.intensity ?? 1;
    const wordFill = this.session?.visualConfig?.interlocution?.wordFill;
    const accentRgb = wordFill?.mode === 'accent'
      ? getComputedStyle(this.container)
        .getPropertyValue('--color-accent-rgb')
        .split(',')
        .map(channel => Number(channel.trim()))
      : null;
    const appearance = accentRgb
      ? livingTextAppearance(sig, intensity, { baseRgb: accentRgb })
      : livingTextAppearance(sig, intensity);
    if (atomDisplay?.classList.contains('is-mask-ready')) {
      atomDisplay.style.color = 'transparent';
      atomDisplay.style.removeProperty('text-shadow');
      return;
    }
    if (['jev', 'jev-sample'].includes(this.session?.origin?.experience)
      && sessionColorTheme(this.session)) {
      atomDisplay.style.color = 'var(--color-light)';
      atomDisplay.style.removeProperty('text-shadow');
      return;
    }
    // The scrim is sized for white artwork, but retained accents such as
    // Cobalt can still fall below 4.5:1 on it. Preserve the accent hue while
    // mixing only as far toward Atlas vellum as the contrast floor requires.
    const visibleRgb = accentRgb
      ? ensureTextContrast(appearance.rgb, [56, 55, 72])
      : appearance.rgb;
    atomDisplay.style.color = `rgb(${visibleRgb[0]}, ${visibleRgb[1]}, ${visibleRgb[2]})`;
    const [r, g, b] = visibleRgb;
    atomDisplay.style.textShadow = `0 0 ${appearance.glowRadius.toFixed(0)}px rgba(${r}, ${g}, ${b}, ${appearance.glowAlpha.toFixed(3)})`;
  }

  displayAtom(atom, index, { concealed = false, spoken = null } = {}) {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) {
      console.error('[Chamber] No atom-display element found!');
      return;
    }
    // Commit the aperture once per atom so a Gallery dissolve cannot resize
    // a word while it is being read. The next atom sees the next artwork.
    this._fitBoxSnapshot = this._resolveWordFitBox();
    this.applyChamberMask();

    // Genesis field follows the passage's mood when Living Text has a track
    if (this.kleeField && this.semanticTrack) {
      this.kleeField.setSignal(this.semanticTrack[index] || null);
    }

    // Empty atoms (paragraph breaks, pause markers) are silence, not frames:
    // render nothing and drop opacity so no residue — like the glass tile
    // collapsing into a caret-like slab — ever pulses between tokens.
    if (!atom.content || !atom.content.trim()) {
      this.cancelReveal();
      // ONE EMPTY ATOM IS NOT LIKE THE OTHERS. A boundary between two pieces
      // carries a seam, and the reader is shown who speaks next — silently,
      // because the voice says nothing here and should not (§8.4). Every
      // other empty atom is a paragraph break and stays blank.
      const seam = seamOf(atom);
      if (seam) {
        this.paintSeam(atomDisplay, seam);
        return;
      }
      atomDisplay.style.transition = 'opacity 150ms var(--ease-out)';
      atomDisplay.style.opacity = '0';
      atomDisplay.textContent = '';
      void this.syncFillGlyphMask();
      return;
    }

    // A boundary presence prepares the next atom while the overlay is fully
    // opaque. Make that hidden update instantaneous so the reveal exposes one
    // stable, already-laid-out text frame instead of a post-flash text fade.
    // In Recitation its words remain pending until the presence yields; the
    // lazy voice start then releases them on the same measured clock.
    // Fast, non-concealed atoms use the whole-text path to avoid strobing.
    if (concealed || (atom.duration && atom.duration < 400)) {
      atomDisplay.style.transition = 'none';
      // A fast atom appears whole — revealing a phrase that lives 300ms
      // would strobe — but it may still carry emphasis to colour.
      this.cancelReveal();
      this._concealedReveal = null;
      const reducedMotion = this._prefersReducedMotion();
      const deferReveal = concealed && this.progressiveRevealEnabled && !reducedMotion;
      const spans = this.paintAtomText(
        atomDisplay,
        atom.content,
        { reveal: deferReveal }
      );
      if (spans) {
        this._concealedReveal = {
          index,
          spans,
          durationMs: atom.duration
        };
      }

      this.sizeAtomText(atomDisplay, atom.content);

      this.applyLivingText(atomDisplay, index);
      atomDisplay.style.opacity = '1';
    } else {
      this._concealedReveal = null;
      // Force instantaneous opacity wipe 
      atomDisplay.style.transition = 'none';
      atomDisplay.style.opacity = '0';

      // Inject new content. The reveal is decided here rather than in
      // paintAtomText so the budget can consult the atom's duration and
      // the reader's motion preference in one place.
      // With a voice the reveal follows SPEECH: words appear as they
      // are spoken, and the utterance is the clock. Without one it
      // borrows a share of the atom's duration and never extends it.
      const reducedMotion = this._prefersReducedMotion();
      const budget = this.progressiveRevealEnabled
        ? (spoken && !reducedMotion
          ? spoken.durationMs
          : revealBudget(atom.duration, { reducedMotion }))
        : 0;
      const spans = this.paintAtomText(atomDisplay, atom.content, { reveal: budget > 0 });

      this.sizeAtomText(atomDisplay, atom.content);

      this.applyLivingText(atomDisplay, index);

      // Force synchronous DOM layout calculation (reflow)
      void atomDisplay.offsetWidth;

      // Restore transition for smooth fade in
      atomDisplay.style.transition = 'opacity 150ms var(--ease-out)';
      atomDisplay.style.opacity = '1';

      // Reveal AFTER the frame is laid out and fading in, so the words
      // arrive over a stable frame rather than racing the reflow.
      if (spans) {
        this.revealAtomWords(spans, revealSchedule(
          spans.map(span => span.textContent),
          budget,
          spoken && !reducedMotion ? spoken.onsets : null));
      } else {
        this.cancelReveal();
      }
    }
    // THE OFFSET IS PIXELS DERIVED FROM A LAYOUT THAT KEEPS CHANGING.
    //
    // It was computed once when the listeners were attached, and after
    // that only on drag and on window resize. Two things were therefore
    // wrong. At attach time the stage may have no geometry yet - a band
    // with no text in it has no height, and a field that has not been
    // shown has none either - so travel came out zero and an authored
    // offset became 0px and stayed there. And travel is
    // (fieldHeight - bandHeight) / 2, which moves with every phrase: one
    // line and three lines are different bands, so a figure computed for
    // the first was already stale for the second.
    //
    // The fraction is the stable thing. Turn it into pixels here, where
    // the band has just been laid out and its height is finally known.
    this.applyBandOffset();
    void this.syncFillGlyphMask();
  }

  /**
   * Reduced motion is read live rather than cached: a reader may change
   * the system setting mid-session, and the reveal should stop being
   * animated the moment they do. RISE's own Reduced motion setting counts
   * the same as the system's.
   */
  _prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      || document.documentElement.classList.contains('reduced-motion');
  }

  bindProgressiveRevealMotion() {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media?.addEventListener) return;
    this._revealMotionMedia = media;
    this._onRevealMotionChange = ({ matches }) => {
      if (!matches) return;
      const pending = this.container?.querySelectorAll('.atom-word[data-pending]') || [];
      this.cancelReveal();
      for (const span of pending) span.removeAttribute('data-pending');
    };
    media.addEventListener('change', this._onRevealMotionChange);
  }

  updateProgress(progress) {
    const fill = this.container.querySelector('#progress-fill');
    const timeCurrent = this.container.querySelector('#time-current');
    const timeTotal = this.container.querySelector('#time-total');

    if (fill) {
      const fraction = Number(progress.progress);
      const percent = Number.isFinite(fraction)
        ? Math.max(0, Math.min(100, fraction <= 1 ? fraction * 100 : fraction))
        : 0;
      // A transform remains on the compositor and can accept a new value each
      // animation frame without layout or a perpetually restarting transition.
      fill.style.transform = `scaleX(${percent / 100})`;
    }

    if (timeCurrent) {
      timeCurrent.textContent = this.formatDuration(progress.elapsed);
    }

    if (timeTotal && progress.total) {
      timeTotal.textContent = this.formatDuration(progress.total);
    }

    if (this.session?.firstReadPreview === true && !this._firstReadChoiceSeen
        && !this._destroyed && !this.pageModeActive && this.player?.state !== 'complete'
        && progress.elapsed >= 30000) {
      this._firstReadChoiceSeen = true;
      const choice = this.container.querySelector('#first-read-choice');
      if (choice) choice.hidden = false;
    }
  }

  dismissFirstReadChoice() {
    this._firstReadChoiceSeen = true;
    const choice = this.container.querySelector('#first-read-choice');
    if (choice) choice.hidden = true;
  }

  togglePlayPause(ignoreDebounce = false) {
    if (!this.player) return;

    // Page authority (PAGE-MODE-SPEC §4): while Page is open, do not start Stream.
    if (this.pageModeActive) return;

    // Debounce to prevent double-click issues (hardware or accidental)
    const now = Date.now();
    if (!ignoreDebounce && this._lastToggleTime && now - this._lastToggleTime < 200) return;
    this._lastToggleTime = now;

    // Asking to play while looking under a passage means: read on.
    if (this._dive.state !== 'surface') {
      this._diveApply(this._dive.surface());
      if (this.player.state === 'playing' || this.player.state === 'interlocuting') return;
      this._holdReading(false);
      return;
    }

    this._holdReading(this.player.state === 'playing' || this.player.state === 'interlocuting');
  }

  /**
   * Hold the reading (pause it) or let it go (play it), with the fades and the
   * bar's icons that pausing and playing have always had. The one place the
   * Chamber does either, so a dive holds a reading exactly as the reader does.
   */
  _holdReading(held) {
    const playIcon = this.container.querySelector('#play-icon');
    const pauseIcon = this.container.querySelector('#pause-icon');
    if (held) {
      this.player.pause();
      this.audioEngine?.fadeOutSession(0.4);
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    } else {
      this.player.play();
      this.audioEngine?.fadeInSession(0.6);
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    }
  }

  // ─── Diving: looking under the passage the reading is at ───
  //
  // A dive holds the reading the way pausing does and never moves it, so
  // surfacing returns to the same atom with everything still scheduled. There
  // is no seek here to get wrong (LATERAL-TRAVERSAL-SPEC §1). It is a button
  // and a key, and takes neither pair of arrows.

  _bindDive() {
    const button = this.container.querySelector('#dive-btn');
    if (!button) return;
    const press = () => this._diveApply(this._dive.press(performance.now()));
    const release = () => this._diveApply(this._dive.release(performance.now()));
    const isActivation = event => event.key === 'Enter' || event.key === ' ';

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      // The release belongs to this control wherever the pointer is by then:
      // the panel opens near it, and a release that landed on the panel
      // instead would leave a glance open with nobody holding it.
      try { button.setPointerCapture(event.pointerId); } catch { /* synthetic or already released */ }
      press();
    });
    const pointerRelease = () => {
      this._divePointerUpAt = performance.now();
      release();
    };
    button.addEventListener('pointerup', pointerRelease);
    button.addEventListener('pointercancel', pointerRelease);

    // Enter and Space are a press and a release, like the pointer. Both are
    // taken over so the click the browser would follow them with never arrives.
    button.addEventListener('keydown', (event) => {
      if (!isActivation(event)) return;
      event.preventDefault();
      if (!event.repeat) press();
    });
    button.addEventListener('keyup', (event) => {
      if (!isActivation(event)) return;
      event.preventDefault();
      release();
    });

    // A long press must be a glance, not the browser's own long-press menu.
    button.addEventListener('contextmenu', event => event.preventDefault());

    // A click with no press before it is how a screen reader, a switch, or a
    // script activates a button: it has no hold, so it is a tap.
    button.addEventListener('click', () => {
      if (performance.now() - this._divePointerUpAt < 500) return;
      this._diveApply(this._dive.tap());
    });
  }

  /** Act on a change of state: hold or release the reading, and show it. */
  _diveApply(change) {
    if (!change) return;
    const panel = this.container.querySelector('#chamber-undercurrent');
    const button = this.container.querySelector('#dive-btn');
    if (!panel || !button) return;

    if (change.from === 'surface') {
      const reading = this.player?.state === 'playing' || this.player?.state === 'interlocuting';
      this._diveHeld = reading;
      if (reading) this._holdReading(true);
      // Sit just above the bar wherever it is: on a phone it wraps to two rows
      // and a fixed offset would cover the control that opened this.
      const barTop = this.container.querySelector('#chamber-controls')?.getBoundingClientRect().top;
      if (barTop > 0) panel.style.bottom = `${Math.max(16, window.innerHeight - barTop + 12)}px`;
      // Shown before it is filled, so the region announces what arrives.
      panel.hidden = false;
      renderUndercurrent(panel, undercurrentAt(this.session, this._pageHead()));
    } else if (change.to === 'surface') {
      panel.hidden = true;
      if (this._diveHeld) {
        this._diveHeld = false;
        this._holdReading(false);
      }
    }

    const open = change.to !== 'surface';
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-pressed', String(change.to === 'anchored'));
    const label = button.querySelector('.control-label');
    if (label) label.textContent = open ? 'Surface' : 'Dive';
    button.setAttribute('aria-label', open ? 'Return to the reading' : 'Look under this passage');
  }

  handleKeyup(e) {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (!this._diveKeyDown) return;
    this._diveKeyDown = false;
    this._diveApply(this._dive.release(performance.now()));
  }

  _pauseLikePlay(ignoreDebounce = false) {
    if (!this.player) return;
    if (this.player.state === 'playing' || this.player.state === 'interlocuting') {
      this.togglePlayPause(ignoreDebounce);
    }
  }

  /**
   * The gear opens the panel and the gear closes it.
   *
   * It used to only open: the panel had one way out, the × inside it, so
   * the control that summoned the thing could not dismiss it. A button
   * that discloses something is expected to undisclose it, which is what
   * `aria-expanded` on it has been promising.
   */
  toggleSettings() {
    if (this._settingsInstance) {
      this.closeSettings();
      return;
    }
    void this.openSettings();
  }

  async openSettings() {
    if (this._settingsFailed || this._settingsInstance) return;
    let Settings;
    try {
      Settings = await this.loadSettingsClass();
      if (typeof Settings !== 'function') throw new Error('Settings unavailable');
    } catch {
      this._failSettingsDoor();
      return;
    }
    try {
      this._mountSettingsOverlay(Settings);
    } catch {
      this.closeSettings();
      this._failSettingsDoor();
      return;
    }
    this._pauseLikePlay();
  }

  _mountSettingsOverlay(Settings) {
    const host = this.container.querySelector('#chamber-settings-overlay');
    if (!host) {
      this._failSettingsDoor();
      return;
    }
    host.hidden = false;
    this._anchorSettingsToBar(host);
    this._markSettingsExpanded(true);
    this._settingsInstance = new Settings(host, {
      // This door holds persistent preferences and safety switches. Jev's
      // Look panel also offers immediate size and volume controls while the
      // reading is active.
      scope: 'bar',
      settings: this.getSettings(),
      onClose: () => this.closeSettings(),
      onNavigate: () => this.closeSettings(),
      onDataCleared: this.onDataCleared,
      onChange: (key, value) => {
        this.onSettingsChange(key, value);
        if (key === 'chamberFace') this._jevLook.face = null;
        if (key === 'chamberFace' || key === 'chamberMask') {
          this.applyChamberStreamFace();
          this.applyChamberMask();
        }
        if (key === 'fontSize') {
          this._jevLook.fontSize = null;
          this._syncLookSize();
          this.applyChamberTypeSize();
          this.applyChamberMask();
        }
        if (key === 'chamberFace') this._reportFaceApply(value);
      }
    });
  }

  closeSettings() {
    const host = this.container.querySelector('#chamber-settings-overlay');
    this._settingsInstance?.destroy?.();
    this._settingsInstance = null;
    if (host) {
      host.replaceChildren();
      host.hidden = true;
    }
    this._markSettingsExpanded(false);
  }

  changeJevLook(name, value) {
    if (name === 'jev-font-size') {
      if (value !== 'authored' && !FONT_SIZE_CHIPS.some(chip => chip.fontSize === value
          && (value !== 'fit' || this.session?.chunkMode === 'word'))) return;
      this._jevLook.fontSize = value === 'authored' ? null : value;
      this.applyChamberTypeSize();
      this.applyChamberMask();
      this._syncLookSize();
    } else if (name === 'jev-soundscape') {
      const sound = soundOf(value);
      if (value !== 'authored' && !sound) return;
      if (!this.audioEngine) return;
      this._jevSoundChoice = value;
      this._audioSchedule?.setEnabled(false);
      this.audioEngine.stopSoundscape?.();
      this.audioEngine.applyPreset?.('silent');
      if (this.player?.state === 'paused' || this.pageModeActive) {
        this._jevSoundPending = value;
        return;
      }
      this._jevSoundPending = null;
      if (value !== 'authored' && value !== 'none'
          && (this.audioEngine.sessionActive === false
            || this.audioEngine.isInitialized === false)
          && typeof this.audioEngine.startSession === 'function') {
        void this.audioEngine.startSession(sound.kind === 'tone'
          ? { preset: value, entrySwell: false } : { soundscape: value, entrySwell: false })
          .then(result => {
            if (result?.cancelled || this._destroyed) return;
            if (this._jevSoundChoice === value) this.audioEngine.fadeInSession?.(0.6);
            else {
              this.changeJevLook('jev-soundscape', this._jevSoundChoice);
              if (this._jevSoundChoice !== 'none' && !this._jevSoundPending
                  && (this._jevSoundChoice !== 'authored' || this._sessionWantsAudio())) {
                this.audioEngine.fadeInSession?.(0.6);
              }
            }
          })
          .catch(error => console.warn('[Chamber] Jev sound could not start:', error));
        return;
      }
      if (value === 'authored') {
        if (this._audioSchedule) this._audioSchedule.setEnabled(true);
        else if (this.session?.soundscape && this.session.soundscape !== 'none') {
          this.audioEngine.startSoundscape?.(this.session.soundscape);
        } else if (this.session?.audioPreset && this.session.audioPreset !== 'silent') {
          this.audioEngine.applyPreset?.(this.session.audioPreset);
        }
      } else if (sound.kind === 'tone') this.audioEngine.applyPreset?.(value);
      else if (value !== 'none') this.audioEngine.startSoundscape?.(value);
    }
  }

  /** The gear says whether the thing it discloses is open. */
  _markSettingsExpanded(open) {
    this.container.querySelector('#chamber-settings-btn')
      ?.setAttribute('aria-expanded', String(Boolean(open)));
  }

  /**
   * Put the panel over the control that opened it.
   *
   * A card that belongs to the bar has to look like it does; pinned to the
   * viewport's right edge it read as an unrelated thing that had appeared.
   * Centred on the button, then clamped so it cannot leave the frame at
   * either end — a panel half off screen is worse than one slightly off
   * centre. The phone breakpoint takes the full width and ignores this.
   */
  _anchorSettingsToBar(host) {
    const button = this.container.querySelector('#chamber-settings-btn');
    if (!button || typeof window === 'undefined') return;
    const rect = button.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const margin = 24;
    const width = Math.min(336, window.innerWidth - margin * 2);
    const centred = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(margin, Math.min(centred, window.innerWidth - width - margin));
    host.style.setProperty('--settings-anchor-left', `${Math.round(left)}px`);
    host.style.setProperty('--settings-anchor-right', 'auto');
    host.style.setProperty(
      '--settings-anchor-bottom',
      `${Math.round(Math.max(margin, window.innerHeight - rect.top + 12))}px`
    );
  }

  _failSettingsDoor() {
    this._settingsFailed = true;
    const button = this.container.querySelector('#chamber-settings-btn');
    const fail = this.container.querySelector('#chamber-settings-fail');
    if (button) {
      button.classList.add('is-failed');
      button.disabled = true;
      button.style.opacity = '0.75';
    }
    if (fail) fail.hidden = false;
  }

  /**
   * Stream ⇄ Page — the two projections of one reading (PAGE-MODE-SPEC §4).
   *
   * Engaging the Page pauses the Stream and typesets the SAME compiled
   * session in space; leaving it returns the reader to the stream exactly
   * where it stood. This adds a projection; it modifies nothing about how
   * the Stream, the cortex, or the flash economy behave. The reader may
   * outpace a page — that is the point of a page.
   */
  async togglePageMode(forceOn) {
    const host = this.container.querySelector('#chamber-page');
    if (!host) return false;

    const next = typeof forceOn === 'boolean' ? forceOn : !this.pageModeActive;
    if (next === this.pageModeActive) return next;
    if (next && this.session?.firstReadPreview === true) this.dismissFirstReadChoice();
    this.pageModeActive = next;
    if (next) this._diveApply(this._dive.surface());
    const diveButton = this.container.querySelector('#dive-btn');
    if (diveButton) diveButton.hidden = next;
    this._syncLookSize();
    this._syncLooks();
    this._updateJevSceneControl(this._jevCurrentAtom);
    if (!next) this._syncPageTurn();

    const btn = this.container.querySelector('#page-mode-btn');
    const display = this.container.querySelector('#chamber-display');
    btn?.setAttribute('aria-pressed', String(next));
    btn?.setAttribute('aria-label', next ? 'Return to the stream' : 'Read as a page');
    const label = btn?.querySelector('.control-label');
    if (label) label.textContent = next ? 'Back to stream' : 'Page view';
    btn?.classList.toggle('is-on', next);
    display?.classList.toggle('page-mode-on', next);

    // OWNERSHIP TOKEN. Activation awaits a dynamic import, so a rapid
    // on → off → on can otherwise land two readers: the first activation
    // resolves after being revoked, overwrites this.pageReader, and
    // leaks an observer. Every activation claims a generation and must
    // still hold it after each await, or it withdraws silently. (The
    // same SOL-review principle the cortex and scheduler already use:
    // the moment that requested this must still exist.)
    const generation = (this._pageGeneration = (this._pageGeneration || 0) + 1);

    if (!next) {
      // Leaving the Page: tear it down and give the stream back. The
      // abort revokes any provider/decode work the reader had begun.
      host.hidden = true;
      this._pageAbort?.abort();
      this._pageAbort = null;
      this.pageReader?.destroy();
      this.pageReader = null;
      if (this._temporalVisualsDeferred) {
        // The Page was the initial projection, so there is nothing to resume:
        // construct the Stream presenters now, from the still-intact config.
        const activated = await this.onEnterStream();
        if (activated !== false && !this.pageModeActive) {
          this._initializeTemporalVisuals();
          this._visualFieldDirector?.resume();
        }
      } else {
        this._resumeTemporalVisuals();
      }
      this.applyChamberMask();
      return false;
    }

    // The temporal presenters stop too. `visibility: hidden` only stops
    // PAINTING — the Gallery's cadence clock, Genesis's growth loop, and
    // the attractor's rAF keep running behind the page, contradicting the
    // Page's "no advance clock" principle and burning CPU/GPU/network for
    // imagery no one can see (red-team #4).
    this.destroyFillField();
    if (!this._temporalVisualsDeferred) this._suspendTemporalVisuals();
    // Speech is temporal too: a page is read at the reader's pace, and
    // a voice narrating over it would be reading something else.
    this.voice?.stop();

    // A page is read, not raced: hold the stream while it is open.
    const streamWasActive = this.player?.state === 'playing' || this.player?.state === 'interlocuting';
    // A page is read at the reader's pace, so hold the stream while it is open.
    this.player?.pause?.();
    if (streamWasActive) {
      this.audioEngine?.fadeOutSession(0.4);
      this.container.querySelector('#play-icon')?.classList.remove('hidden');
      this.container.querySelector('#pause-icon')?.classList.add('hidden');
    }

    host.hidden = false;
    // The toggle keeps DOM focus after a click, so a reader who presses
    // Space to scroll would instead re-activate the focused button and be
    // thrown back to the Stream. Hand focus to the page itself: Space
    // scrolls it, and the reading owns the keyboard it is read with.
    btn?.blur();
    host.setAttribute('tabindex', '-1');
    host.focus?.({ preventScroll: true });
    // One controller per activation: closing the Page, replacing it, or
    // destroying the Chamber revokes the work it started.
    this._pageAbort?.abort();
    const abort = (this._pageAbort = new AbortController());
    try {
      const [{ PageReader }, { visualCortex }] = await Promise.all([
        import('../../page/PageReader.js'),
        import('../../visuals/visual-cortex.js')
      ]);
      // Authority check: a newer toggle (or a destroy) superseded us.
      if (generation !== this._pageGeneration || !this.container?.isConnected) {
        return this.pageModeActive;
      }
      this.pageReader = new PageReader(host, {
        // One bar: the Chamber owns the page turn (see #page-turn).
        showPager: false,
        // The public Page opens as one elongated composition. Pagination is
        // retained as an explicit projection choice in the Chamber bar.
        scrollUnderPages: Number.POSITIVE_INFINITY,
        onPageChange: (state) => this._syncPageTurn(state),
        session: this._pageSession(),
        // Session stores the compiled title as `name`; `title` is only an
        // input alias and is undefined on the model, which left every
        // masthead untitled.
        title: this.session?.name || this.session?.title || '',
        source: this.session?.sources?.[0]?.name || '',
        signal: abort.signal,
        // One preference, every presenter: the reader's artwork-label
        // setting governs the Page exactly as it governs the flash
        // economy and the Gallery. Required credits are never optional.
        showOptionalLabels: visualCortex.showArtworkLabels !== false,
        // The SAME provider dispatch the Stream uses — one source path,
        // two projections. A collection that cannot resolve yields
        // stillness, never a substitute.
        resolveCollection: (id, count) =>
          this._resolvePageCollection(id, count, abort.signal, visualCortex)
      });
      // OPEN WHERE THE READING IS. The Stream's head is the reading's one
      // place, and nothing done in the Page moves it. While the head is
      // where it was when the Page was left, the page the reader had
      // reached is still right; once the head has moved that page is
      // stale and the Page opens on the head.
      //
      // Read before render(): render() reports page 0 through
      // onPageChange, and that same callback is what records the page.
      const head = this._pageHead();
      const kept = this._lastPage?.head === head ? this._lastPage.index : null;
      this.pageReader.render();
      if (kept !== null) this.pageReader.goToPage(kept);
      else this.pageReader.showAtom(head);
    } catch (error) {
      console.warn('[Chamber] Page Mode unavailable:', error);
      if (generation !== this._pageGeneration) return this.pageModeActive;
      host.hidden = true;
      this.pageModeActive = false;
      const unavailableDive = this.container.querySelector('#dive-btn');
      if (unavailableDive) unavailableDive.hidden = false;
      this._syncLookSize();
      this._syncLooks();
      btn?.setAttribute('aria-pressed', 'false');
      btn?.classList.remove('is-on');
      display?.classList.remove('page-mode-on');
      return false;
    }
    return true;
  }

  /**
   * Resolve one Page collection to works.
   *
   * Most ids go straight to the cortex's provider dispatch. The two
   * PERSISTENT FIELDS are different: they are dynamic systems the Chamber
   * owns, not pools, and a single still would misrepresent them. Their
   * honest spatial translation is a SEQUENCE — the same system sampled at
   * evenly spaced states, the last being its settled form — so a page
   * asking for three images gets the field at three moments of its life.
   *
   * @param {string} id collection id
   * @param {number} [count] how many samples the page wants
   */
  async _resolvePageCollection(id, count, signal, visualCortex) {
    const wanted = Math.max(1, Math.min(Number.isFinite(count) ? count : 3, 6));

    if (id.startsWith?.('sequence-asset:')) {
      const assetId = id.slice('sequence-asset:'.length);
      const asset = (this.session?.sequenceVisualAssets || []).find(item =>
        item?.id === assetId && item.kind !== 'video' && item.uri);
      return asset ? [{
        name: asset.name || 'Project image',
        data: { url: asset.uri, title: asset.name || 'Project image' }
      }] : [];
    }

    if (id.startsWith?.('living-flame:')) {
      const key = id.slice('living-flame:'.length);
      const recipeId = key.split('~')[0];
      const flameRecipe = themedFlameLookup(flamePreset, sessionColorTheme(this.session));
      const config = this._pageFlameRecipes?.get(key)
        || (flameRecipe(recipeId) ? { recipe: flameRecipe(recipeId) } : null);
      if (!config) return [];
      const { sampleLivingFlame } = await import('../../visuals/living-flame/index.js');
      // A flame is one composition: two moments of it are enough to show
      // that it moves without making the Page wait on many renders.
      const SWEEP_SECONDS = 40;
      const samples = [];
      for (let n = 0; n < Math.min(wanted, 2); n++) {
        if (signal?.aborted) break;
        const url = await sampleLivingFlame(config.recipe, {
          seconds: (n / wanted) * SWEEP_SECONDS,
          energy: this._effectiveFlameEnergy(config.intensity)
        });
        if (url) samples.push({ name: config.recipe.name, data: { url, title: config.recipe.name } });
      }
      return samples;
    }

    if (id === 'genesis' && this.kleeField?.sampleAt) {
      // Growth is parameterised 0..1, so the samples are evenly spaced
      // through the composition's life and the LAST is the settled work.
      return this._fieldSamples(wanted, (n) =>
        this.kleeField.sampleAt((n + 1) / wanted), 'Genesis');
    }

    if (id === 'attractor' && this.attractorField?.sampleAt) {
      // The filament's appearance is a function of elapsed time; spacing
      // the samples across a full sweep shows the field in different
      // states rather than three near-identical frames.
      const SWEEP_SECONDS = 24;
      return this._fieldSamples(wanted, (n) =>
        this._sampleAttractorPlate(((n + 1) / wanted) * SWEEP_SECONDS), 'Attractor');
    }

    // Engines authored FOR a work are persistent fields too, and they
    // get the same answer Genesis and the attractor already get: a
    // SEQUENCE, not a still. One frame of Milton's chariot is a
    // photograph of a wheel mid-turn — the same misrepresentation the
    // Gallery made before it was given a clock.
    //
    // What these can do that the two general fields cannot is
    // CORRESPOND: the id names one engine, so the flaming sword stands
    // beside the passage where Michael's sword falls.
    const work = parsePageCollectionId(id);
    if (work) {
      // Spaced across a sweep long enough for the slow figures to have
      // visibly moved. The last sample is the most developed state, as
      // it is for Genesis.
      const SWEEP_SECONDS = 45;
      const samples = [];
      for (let n = 0; n < wanted; n++) {
        if (signal?.aborted) break;
        const url = await sampleWorkEngine(
          work.familyId, work.engineId,
          ((n + 1) / wanted) * SWEEP_SECONDS,
          { timeScale: WORK_ENGINE_TIME_SCALE }
        );
        // A field that will not draw yields stillness, never a broken
        // frame — and never a substitute from another family.
        if (url) samples.push({ name: work.engineId || work.familyId, data: { url } });
      }
      return samples;
    }

    return visualCortex.resolveCollectionWorks(id, { limit: 12, signal });
  }

  /**
   * The session the Page lays out. When the reading follows its text, the
   * Page receives the directed program so each passage shows its assigned
   * treatment; flame recipes are registered for still sampling.
   */
  _pageSession() {
    this._pageFlameRecipes = new Map();
    const program = this._visualSchedule === this._directedSchedule && this._direction?.director
      ? this._direction.director.pageProgram()
      : this.session?.visualProgram;
    const held = this._direction?.mode === 'hold' ? this._direction.heldCue : null;
    for (const cue of [...(program?.segments || []).map(segment => segment.cue), program?.fallback, held]) {
      if (cue?.kind === 'field' && cue.renderer === 'living-flame' && cue.config?.recipe?.id) {
        this._pageFlameRecipes.set(livingFlameConfigKey(cue.config), cue.config);
      }
    }
    if (program === this.session?.visualProgram) return this.session;
    return Object.create(this.session, { visualProgram: { value: program, enumerable: true } });
  }

  /** Turn N field samples into the Page's image-work contract. */
  _fieldSamples(count, sample, title) {
    const works = [];
    for (let n = 0; n < count; n++) {
      let url = null;
      try { url = sample(n); } catch { url = null; }
      // A field that will not draw yields stillness, never a broken frame.
      if (url) works.push({ name: title, data: { url, title } });
    }
    return works;
  }

  /**
   * Stop every TEMPORAL presenter while the Page holds the reading.
   *
   * Hiding the stream field stops painting, not running: each of these
   * owns its own clock and would keep advancing behind the page. Only
   * engines that are actually live are touched, and what was suspended is
   * recorded so leaving the page restores exactly that and nothing more.
   */
  _suspendTemporalVisuals() {
    this.destroyFillField();
    if (this._temporalSuspended) return;
    this._temporalSuspended = {
      gallery: false,
      video: false,
      klee: false,
      attractor: false
    };
    // The Gallery lives in the (singleton) cortex; releasing its host
    // stops its cadence clock and drops its layers.
    if (visualCortex.hasContinuousFieldHost?.()) {
      this._galleryHost = this.container.querySelector('#chamber-continuous-field');
      visualCortex.setContinuousFieldHost(null);
      this._temporalSuspended.gallery = true;
    }
    // Sequence-local MP4 cues are temporal even when holding a decoded
    // frame. Relinquishing the host cancels decode/playback while Page owns
    // the reading, and restores the current authoritative cue on return.
    if (visualCortex.hasSequenceVideoHost?.()) {
      this._sequenceVideoHost = this.container.querySelector('#chamber-field');
      visualCortex.setSequenceVideoHost(null);
      this._temporalSuspended.video = true;
    }
    // Genesis grows on its own loop.
    if (this.kleeField?.pause) {
      this.kleeField.pause();
      this._temporalSuspended.klee = true;
    }
    // The attractor integrates on its own rAF. Hiding the field stops
    // painting, not the integration beneath it.
    if (this.attractorField?.pause) {
      this.attractorField.pause();
      this.nightStreaks?.pause();
      this._temporalSuspended.attractor = true;
    }
    // The flash economy is already inert: the Page pauses the Player, and
    // flashes are Player-driven opportunities. Cancel any in-flight one so
    // a committed presentation cannot paint over the page.
    visualCortex.cancelPresentation('page-mode');
  }

  /** Restore exactly what _suspendTemporalVisuals stopped. */
  _resumeTemporalVisuals() {
    const suspended = this._temporalSuspended;
    if (!suspended) return;
    this._temporalSuspended = null;
    if (suspended.gallery && this._galleryHost?.isConnected) {
      visualCortex.setContinuousFieldHost(this._galleryHost);
    }
    this._galleryHost = null;
    if (suspended.video && this._sequenceVideoHost?.isConnected) {
      visualCortex.setSequenceVideoHost(this._sequenceVideoHost);
    }
    this._sequenceVideoHost = null;
    if (suspended.klee && this.kleeField?.resume) this.kleeField.resume();
    if (suspended.attractor && this.attractorField?.resume) {
      this.attractorField.resume();
      this.nightStreaks?.resume();
    }
  }

  /**
   * Session-local kill switch for warning-governed rhythmic visuals.
   * Persistent Genesis, attractor, and focal modes never expose this control.
   */
  toggleRhythmicVisuals(forceEnabled) {
    if (!this.hasRhythmicVisuals || !this.session?.visualConfig) return false;

    const enabled = typeof forceEnabled === 'boolean'
      ? forceEnabled
      : !this.rhythmicVisualsEnabled;
    if (enabled === this.rhythmicVisualsEnabled) return enabled;

    this.rhythmicVisualsEnabled = enabled;
    // The compiled Session is ephemeral. Switching its execution mode blocks
    // Player opportunities without changing the user's saved orbital choices.
    this.session.visualConfig.visualMode = enabled ? 'interlocution' : 'off';
    if (!enabled) visualCortex.cancelPresentation('user-disabled');

    this.showControls();
    this._updateJevSceneControl(this._jevCurrentAtom);
    return enabled;
  }

  /**
   * Fold the attractor field into a six-fold rosette, or unfold it.
   *
   * The first visual control that applies and un-applies mid-session:
   * the attractor is a persistent field, so its symmetry can change
   * without re-integrating the system or interrupting the reading. No
   * frame is dropped — the next tick simply draws the same filament
   * through a different symmetry, so the form appears to fold.
   */
  toggleKaleidoscope(forceEngaged) {
    if (!this.hasAttractorField) return false;

    const engaged = typeof forceEngaged === 'boolean'
      ? forceEngaged
      : !this.kaleidoscopeEngaged;
    if (engaged === this.kaleidoscopeEngaged) return engaged;

    // THE FIELD IS NOT ALWAYS THIS CHAMBER'S. A reading that IS an
    // attractor mounts one here as a field cue; an interlocution with an
    // attractor among its engines has it mounted in the continuous field
    // instead. The control is offered on configuration, which is true of
    // both, so asking only for our own left the button inert for every
    // reader who reached the attractor the second way.
    //
    // The field owns which form to restore, so unfolding returns the
    // reader to the form they were reading in, not a fixed default.
    let folded;
    if (this.attractorField) {
      folded = { engaged: this.attractorField.toggleKaleidoscope(), form: this.attractorField.form };
    } else {
      folded = visualCortex.toggleAttractorKaleidoscope();
    }
    if (!folded) return false;
    this.kaleidoscopeEngaged = folded.engaged;

    // Keep the ephemeral session honest for anything that inspects it —
    // under whichever key the attractor was configured.
    if (this.session?.visualConfig?.attractor) {
      this.session.visualConfig.attractor.form = folded.form;
    }
    if (this.session?.visualConfig?.interlocution?.attractor) {
      this.session.visualConfig.interlocution.attractor.form = folded.form;
    }

    const button = this.container.querySelector('#kaleidoscope-btn');
    if (button) {
      const label = this.kaleidoscopeEngaged
        ? 'Unfold the kaleidoscope'
        : 'Fold the field into a kaleidoscope';
      button.setAttribute('aria-pressed', String(this.kaleidoscopeEngaged));
      button.setAttribute('aria-label', label);
      button.title = `${label} (K)`;
      button.classList.toggle('is-engaged', this.kaleidoscopeEngaged);
    }
    this.showControls();
    return this.kaleidoscopeEngaged;
  }

  setVolume(volume) {
    this.audioEngine?.setVolume(volume);
    this.onSettingsChange('masterVolume', volume);
  }

  /**
   * The reading band can be moved out of the picture's way.
   *
   * On a phone the text sits over the centre of the screen, which is
   * exactly where a visualiser puts its subject; the two contend for the
   * same pixels and the text wins because it must. This lets a reader
   * say where the words should sit instead.
   *
   * IT IS A PREFERENCE, NOT A PROPERTY OF THE READING. No content domain
   * authors a band position — the Experience Program has no field for
   * one — so there is nothing here for a reader's choice to overrule.
   * When a domain wants to place its own band, that precedence gets
   * decided with a real case in hand rather than in advance.
   *
   * SELECT, THEN MOVE. A press that lands on the text selects it and
   * shows a frame; only a selected band follows the pointer. The reading
   * surface takes no other input — its one listener reveals the control
   * bar on mousemove — so there is no tap to disambiguate a drag from,
   * but a reader should still not shift the words by brushing them.
   */
  attachBandMove() {
    const field = this.container.querySelector('#chamber-field');
    const band = this.container.querySelector('#atom-display');
    if (!field || !band) return;

    this._bandOffsetFraction = readBandOffsetSetting(this.getSettings());
    this.applyBandOffset();

    const DRAG_THRESHOLD_PX = 4;
    let pointerId = null;
    let startY = 0;
    let startFraction = 0;
    let moved = false;

    const selected = () => band.classList.contains('is-band-movable');

    const onDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      if (!selected()) {
        // First press selects and shows the frame; it does not move.
        this.setBandMovable(true);
        return;
      }
      pointerId = event.pointerId;
      startY = event.clientY;
      startFraction = this._bandOffsetFraction;
      moved = false;
      band.classList.add('is-band-moving');
      band.setPointerCapture?.(pointerId);
    };

    const onMove = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const travel = bandTravelPx(field, band);
      if (travel <= 0) return;
      const delta = event.clientY - startY;
      if (!moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      moved = true;
      // The pointer moves in px; the setting is a fraction of the travel
      // available, so a phone and a monitor keep the same intent.
      this._bandOffsetFraction = clampBandFraction(startFraction + delta / travel);
      this.applyBandOffset();
      event.preventDefault();
    };

    const onUp = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      band.releasePointerCapture?.(pointerId);
      pointerId = null;
      band.classList.remove('is-band-moving');
      if (moved) writeBandOffsetSetting(this._bandOffsetFraction, this.onSettingsChange);
    };

    // Pressing away from the band puts it down again.
    const onDismiss = (event) => {
      if (!selected() || band.contains(event.target)) return;
      this.setBandMovable(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape' && selected()) this.setBandMovable(false);
    };

    band.addEventListener('pointerdown', onDown);
    band.addEventListener('pointermove', onMove);
    band.addEventListener('pointerup', onUp);
    band.addEventListener('pointercancel', onUp);
    this.container.addEventListener('pointerdown', onDismiss, true);
    document.addEventListener('keydown', onKey);

    this._bandMoveCleanup = () => {
      if (this._bandOffsetRetry != null) {
        cancelAnimationFrame(this._bandOffsetRetry);
        this._bandOffsetRetry = null;
      }
      this.container.removeEventListener('pointerdown', onDismiss, true);
      document.removeEventListener('keydown', onKey);
    };

    // Recomputed on resize: the fraction is stable, the pixels are not.
    this._bandResize = () => {
      this.applyBandOffset();
      this._refreshProgressiveGlass();
    };
    window.addEventListener('resize', this._bandResize);
  }

  setBandMovable(on) {
    const band = this.container.querySelector('#atom-display');
    if (!band) return;
    band.classList.toggle('is-band-movable', !!on);
    if (!on) band.classList.remove('is-band-moving');
  }

  applyBandOffset() {
    const field = this.container.querySelector('#chamber-field');
    const band = this.container.querySelector('#atom-display');
    if (!field || !band) return;
    const travel = bandTravelPx(field, band);

    // NO ROOM IS NOT THE SAME FACT AS NO OFFSET. A stage that has not
    // been laid out reports zero travel, and multiplying the fraction by
    // it writes 0px - which is indistinguishable from a reader who
    // wanted the band centred, and is what a reading that opens before
    // its own first paint used to settle on. Wait for a frame instead
    // and ask again; the fraction has not gone anywhere.
    if (travel <= 0) {
      if (this._bandOffsetRetry != null) return;
      this._bandOffsetRetry = requestAnimationFrame(() => {
        this._bandOffsetRetry = null;
        if (!this._destroyed) this.applyBandOffset();
      });
      return;
    }

    const px = clampBandFraction(this._bandOffsetFraction ?? 0) * travel;
    field.style.setProperty('--band-offset', `${Math.round(px)}px`);
    void this.syncFillGlyphMask();
  }

  showControls() {
    const controls = this.container.querySelector('#chamber-controls');
    if (!controls) return;

    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }

    controls.style.transition = 'opacity 200ms var(--ease-out)';
    controls.style.opacity = '1';
    this.controlsVisible = true;

    this.controlsTimeout = setTimeout(() => {
      controls.style.transition = 'opacity 400ms var(--ease-in)';
      controls.style.opacity = '0';
      this.controlsVisible = false;
    }, 3000);
  }

  updateWpm(delta) {
    if (!this.player) return;

    this.currentWpm = Math.max(
      READING_PACE.min,
      Math.min(READING_PACE.max, this.currentWpm + delta)
    );
    const factor = this.baseWpm / this.currentWpm;
    this.player.setSpeedFactor(factor);

    this.showSpeedHud();
    this._syncPace();
    
    this.audioEngine?.playClick();
  }

  showSpeedHud() {
    const hud = this.container.querySelector('#chamber-speed-hud');
    const valueDisp = this.container.querySelector('#speed-hud-value');
    
    if (hud && valueDisp) {
        valueDisp.textContent = this.currentWpm;
        hud.classList.remove('hidden');
        hud.style.opacity = '1';

        if (this.speedHudTimeout) {
            clearTimeout(this.speedHudTimeout);
        }

        this.speedHudTimeout = setTimeout(() => {
            hud.style.opacity = '0';
            setTimeout(() => {
                if (hud.style.opacity === '0') hud.classList.add('hidden');
            }, 500);
        }, 1500);
    }
  }


  showSynthesisScreen() {
    const choiceScreen = this.container.querySelector('#post-choice-screen');
    const synthesisScreen = this.container.querySelector('#synthesis-screen');
    const synthesisInput = this.container.querySelector('#synthesis-input');

    if (choiceScreen && synthesisScreen) {
      choiceScreen.style.display = 'none';
      synthesisScreen.style.display = 'block';
      if (synthesisInput) {
        synthesisInput.value = '';
        setTimeout(() => synthesisInput.focus(), 100);
      }
    }
  }

  /**
   * Router Escape dispatch — the Chamber always owns Escape during a
   * session. First press opens the exit confirmation (pausing playback);
   * a second press dismisses it and resumes. Never falls through to the
   * router's portal reset, which would strand a running player.
   */
  /**
   * Keep the bar's page turn honest about where the reader is.
   * Hidden entirely when there is nothing to turn — a single-page
   * reading should not carry disabled arrows.
   */
  /** The atom the Stream is at: the reading's one place. */
  _pageHead() {
    return this.player?.sessionState?.currentIndex ?? 0;
  }

  _syncPageTurn(state = {}) {
    // The reader's own report, taken whole. Inferring `isPaged` and
    // `canPage` from `total` is what made Elongate a one-way door: an
    // elongated reading is ONE page and reads as "nothing to paginate".
    const { index = 0, total = 0, isPaged = false, canPage = false } = state;
    // Remembered here rather than read back on close: by the time Page
    // Mode is torn down the reader is already gone. It is kept with the
    // head it was reached under, because it means nothing once the head
    // has moved.
    if (total > 1) this._lastPage = { index, head: this._pageHead() };

    const elongate = this.container.querySelector('#page-elongate');
    if (elongate) {
      // Only offered when the reading is long enough for the two
      // projections to differ.
      elongate.hidden = !(this.pageModeActive && canPage);
      elongate.setAttribute('aria-pressed', String(!isPaged));
      elongate.classList.toggle('is-on', !isPaged);
      const label = elongate.querySelector('.control-label');
      if (label) label.textContent = isPaged ? 'Elongate' : 'Paginate';
      elongate.title = isPaged
        ? 'Elongate — read as one continuous column'
        : 'Paginate — read in pages';
    }
    const turn = this.container.querySelector('#page-turn');
    if (!turn) return;
    const many = this.pageModeActive && total > 1;
    turn.hidden = !many;
    if (!many) return;
    const count = turn.querySelector('#page-turn-count');
    if (count) count.textContent = `${index + 1} / ${total}`;
    const prev = turn.querySelector('#page-prev');
    const next = turn.querySelector('#page-next');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index >= total - 1;
  }

  handleEscape() {
    // Under a host's own controls the key is the host's: nothing here to close or end.
    if (this.chromeless) return true;
    // Looking under a passage is the topmost thing a reader can be doing.
    if (this._dive.state !== 'surface') {
      this._diveApply(this._dive.surface());
      return true;
    }
    // The router dispatches Escape here first; an open Lab is the top layer.
    if (this._labOpen) {
      this.closeVisualLab();
      return true;
    }
    const settingsOverlay = this.container.querySelector('#chamber-settings-overlay');
    if (settingsOverlay && !settingsOverlay.hidden) {
      this.closeSettings();
      return true;
    }
    if (this.closeLookSheet() || this._closeSheet('pace')) return true;
    const overlay = this.container.querySelector('#exit-confirm-overlay');
    const overlayVisible = overlay && overlay.style.display === 'flex' && !overlay.classList.contains('hidden');
    if (overlayVisible) {
      this.hideExitConfirmation();
    } else {
      this.exitSession();
    }
    return true;
  }

  exitSession() {
    const overlay = this.container.querySelector('#exit-confirm-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.remove('hidden'), 10);
      
      // Auto-pause session if it was playing/interlocuting
      if (this.player && (this.player.state === 'playing' || this.player.state === 'interlocuting')) {
        this._wasPlayingOnExitPrompt = true;
        this.player.pause();
        this.audioEngine?.fadeOutSession(0.3);
      } else {
        this._wasPlayingOnExitPrompt = false;
        this.audioEngine?.fadeOutSession(0.3);
      }
    } else {
      // Fallback
      if (window.confirm('Exit session?')) {
        this.performExit();
      }
    }
  }

  hideExitConfirmation() {
    const overlay = this.container.querySelector('#exit-confirm-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.style.display = 'none', 300);

      // Resume if it was playing before
      if (this._wasPlayingOnExitPrompt && this.player) {
        this.player.play();
        this.audioEngine?.fadeInSession(0.3);
      }
    }
  }

  performExit() {
    if (this.player) {
      this.player.stop();
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    this.onExit('exit');
  }

  onSessionComplete() {
    if (this.chromeless) {
      // The host shows what comes next; the field holds its last frame under the last sentence.
      this._visualFieldDirector?.pause();
      return;
    }
    if (this.session?.firstReadPreview === true) this.dismissFirstReadChoice();
    const display = this.container.querySelector('#chamber-display');
    const postSession = this.container.querySelector('#chamber-post');

    // Fade out display
    display.style.transition = 'opacity 400ms var(--ease-in)';
    display.style.opacity = '0';

    this.audioEngine?.fadeOutSession(1.2); // Slower fade for completion

    setTimeout(() => {
      display.style.display = 'none';
      // The field went out of sight with the reading; hidden, it would go on drawing.
      this._visualFieldDirector?.clear({ immediate: true });

      // Reset nested screens
      const choiceScreen = this.container.querySelector('#post-choice-screen');
      const synthesisScreen = this.container.querySelector('#synthesis-screen');
      if (choiceScreen && synthesisScreen) {
        choiceScreen.style.display = '';
        synthesisScreen.style.display = 'none';
      }

      // Show post-session
      postSession.style.display = 'flex';
      postSession.style.opacity = '0';
      postSession.style.transition = 'opacity 400ms var(--ease-out)';
      setTimeout(() => {
        postSession.style.opacity = '1';
        
        // Restore UI audio capability by stopping the session (resets master gain volume)
        this.audioEngine?.stopSession();
      }, 50);
    }, 400);

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  /**
   * A movement, or a scored transition between two, has been entered.
   *
   * The Chamber receives a LABEL and an identity, never a meaning
   * (JOURNEYS-SPEC §5). It does not know that "war-heaven" is
   * metaphysical or that Guillemont is the Somme; it knows a title
   * changed and that a reader may want to be told.
   */
  onMovementChange(position) {
    if (!position) return;
    if (position.kind === 'boundary') {
      // A transition announces nothing. It is the silence between two
      // worlds, and naming it would be talking over it.
      this._activeMovement = null;
      this.announceMovement(null);
      return;
    }
    this._activeMovement = position.movement;
    console.info(`[Chamber] Movement: ${position.movement.title || position.movement.id}`);
    this.announceMovement(position.movement.title || null);
  }

  /**
   * Put the movement's title where a reader can find it without it
   * interrupting them. Assertive would speak over the reading itself.
   */
  announceMovement(title) {
    const region = this.container?.querySelector('#movement-title');
    if (!region) return;
    region.textContent = title || '';
    region.hidden = !title;
  }

  onStateChange(data) {
    const state = data.state;
    console.log('[Chamber] Player state change:', state);

    // NO AUDIO OUTLIVES THE READING (§8.3). The engine owns its own
    // pause path for scheduled ramps; this stops the Journey's score
    // from continuing to mean something while nothing is being read.
    if (state === 'paused') this._audioSchedule?.pause();
    else if (state === 'idle' || state === 'complete') this._audioSchedule?.stop();
    else if (state === 'playing') this._audioSchedule?.resume();
    if (state === 'playing' && this._jevSoundPending && !this.pageModeActive) {
      this.changeJevLook('jev-soundscape', this._jevSoundPending);
    }

    // The Genesis field breathes with the session: pausing the text
    // pauses the pen
    // A paused reading is silent. The voice speaks one atom at a time
    // and cannot be resumed mid-phrase, so pausing stops it outright —
    // the next atom speaks from its beginning. Stopping also restores
    // the ducked music, which would otherwise stay down while paused.
    if (state === 'paused' || state === 'idle') this.voice?.stop();

    if (state === 'paused') this._visualFieldDirector?.pause();
    else if (state === 'playing') this._visualFieldDirector?.resume();
    this._syncScoringActivity();

    // Authored imagery is bound to the reading clock: pause holds the exact
    // Gallery frame and living-engine state. An unscored ambient Gallery is
    // deliberately independent and continues drifting while text is paused.
    if (state === 'paused' && this._visualSchedule && !this._authoredGalleryPaused) {
      this._authoredGalleryPaused = visualCortex.pauseContinuousField() === true;
    } else if (state === 'playing' && this._authoredGalleryPaused) {
      // Off stays off: resuming the reading never restarts visual work.
      if (this._direction?.mode !== 'off') visualCortex.resumeContinuousField();
      this._authoredGalleryPaused = false;
    }

    const playIcon = this.container.querySelector('#play-icon');
    const pauseIcon = this.container.querySelector('#pause-icon');

    if (state === 'playing' || state === 'interlocuting') {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    } else {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    }
    this._updateJevSceneControl(this._jevCurrentAtom);
  }

  handleSynthesisSealing() {
    const input = this.container.querySelector('#synthesis-input');
    const text = input ? input.value.trim() : '';

    if (text && this.session) {
      MemoryCore.saveSynthesis(this.session, text);
    }

    // Pass the text to the exit handler to route to the Workshop
    this.onExit('workshop', { text });
  }

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  activate() {
    if (this._active) return;
    this._active = true;
    if (!this.chromeless) {
      document.addEventListener('keydown', this.boundKeyboardHandler);
      document.addEventListener('keyup', this.boundKeyupHandler);
    }
    this._onVisualVisibility ||= () => this._syncScoringActivity();
    document.addEventListener('visibilitychange', this._onVisualVisibility);
    this._syncScoringActivity();

    // App normally completed the initial static lead during session
    // preparation. prepare() is idempotent, and is required here for direct
    // Chamber callers because it performs complete-pack admission before any
    // phrase may play.
    if (this.voice) {
      this.voice.enabled = true;
      this.voice.prepare(this.session?.atoms, 0)
        .catch(() => { /* silent reading; already logged by Voice */ });
    }
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
    document.removeEventListener('keyup', this.boundKeyupHandler);
    if (this._onVisualVisibility) document.removeEventListener('visibilitychange', this._onVisualVisibility);
    this._syncScoringActivity();
  }

  bindVisualViewport() {
    this._syncVisualViewport = () => {
      applyVisualViewportBottom(document.documentElement);
    };
    this._syncVisualViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', this._syncVisualViewport, { passive: true });
    vv?.addEventListener('scroll', this._syncVisualViewport, { passive: true });
    window.addEventListener('resize', this._syncVisualViewport, { passive: true });
  }

  unbindVisualViewport() {
    if (!this._syncVisualViewport) return;
    const vv = window.visualViewport;
    vv?.removeEventListener('resize', this._syncVisualViewport);
    vv?.removeEventListener('scroll', this._syncVisualViewport);
    window.removeEventListener('resize', this._syncVisualViewport);
    this._syncVisualViewport = null;
    clearVisualViewportBottom(document.documentElement);
  }

  /**
   * Listen to the Player, and let go of it in destroy(). A Player can outlive
   * a Chamber (a Dive that has come back is mounted on again), and a torn-down
   * Chamber must not go on painting into DOM that is no longer there.
   */
  _onPlayer(event, callback) {
    const off = this.player.on(event, callback);
    if (typeof off === 'function') (this._playerOffs ||= []).push(off);
  }

  /**
   * The Player was given a longer Session (live reading). The schedules that
   * follow the reading take the longer programs; what was already cued or
   * announced stays as it was.
   */
  _adoptExtendedSession() {
    const next = this.player?.sessionState?.session;
    if (!next || next === this.session) return;
    this.session = next;
    this._atomStartsMs = null;
    if (this._visualSchedule && this._visualSchedule !== this._directedSchedule && next.visualProgram) {
      this._visualSchedule.extend(next.visualProgram, next.atoms);
    }
    if (this._movementSchedule && next.movementProgram) this._movementSchedule.extend(next.movementProgram);
  }

  destroy() {
    for (const off of this._playerOffs || []) off();
    this._playerOffs = [];
    this._destroyed = true;
    if (this._syncFullscreenControl) {
      document.removeEventListener('fullscreenchange', this._syncFullscreenControl);
      this._syncFullscreenControl = null;
    }
    if (this.session?.firstReadPreview === true) this.dismissFirstReadChoice();
    for (const name of ['--color-void', '--color-light', '--color-cloud',
      '--color-accent', '--color-accent-rgb', '--color-threshold']) {
      this.container.style.removeProperty(name);
    }
    clearChromeTheme(document.documentElement, this);
    this.container.classList.remove('is-look-open');
    this.closeSettings();
    this.unbindVisualViewport();
    this._bandMoveCleanup?.();
    this._bandMoveCleanup = null;
    if (this._bandResize) {
      window.removeEventListener('resize', this._bandResize);
      this._bandResize = null;
    }
    if (this._revealMotionMedia && this._onRevealMotionChange) {
      this._revealMotionMedia.removeEventListener('change', this._onRevealMotionChange);
      this._revealMotionMedia = null;
      this._onRevealMotionChange = null;
    }
    this.deactivate();
    if (this._labOpen) this.closeVisualLab();
    // Outside the Chamber no new scoring request starts; a valid reply
    // already in flight may still land in the local cache.
    this._syncScoringActivity();
    if (this._direction) this._direction.onScoringEvent = null;
    // A reveal in flight would otherwise fire into a torn-down DOM.
    this.cancelReveal();
    // A Journey's score must not outlive its Chamber (§8.3). The
    // controllers hold no timers, so silencing is the whole of it.
    this._audioSchedule?.silence();
    this._audioSchedule = null;
    this._movementSchedule = null;
    // Abort pending fetches and release decoded audio so they cannot outlive
    // the reading.
    this.voice?.destroy();
    this.voice = null;
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    this.destroyFillField();
    this.fitMask = null;
    this._visualFieldDirector?.destroy();
    this._visualFieldDirector = null;
    if (this.attractorField) {
      this.attractorField.destroy();
      this.attractorField = null;
    }
    if (this.nightStreaks) {
      this.nightStreaks.destroy();
      this.nightStreaks = null;
    }
    if (this.kleeField) {
      this.kleeField.destroy();
      this.kleeField = null;
    }
    if (this.rosaField) {
      this.rosaField.destroy();
      this.rosaField = null;
    }
    // Page Mode: revoke any pending activation, cancel its timers, and
    // abort provider/decode work before the DOM it would write into goes.
    this._pageGeneration = (this._pageGeneration || 0) + 1;
    clearTimeout(this._pageOpenTimer);
    clearTimeout(this._autoStartTimer);
    this._pageOpenTimer = null;
    this._autoStartTimer = null;
    this._pageAbort?.abort();
    this._pageAbort = null;
    if (this.pageReader) {
      this.pageReader.destroy();
      this.pageReader = null;
    }
    this.pageModeActive = false;
    // Suspension bookkeeping dies with the Chamber; the host below is
    // released unconditionally anyway.
    this._temporalSuspended = null;
    this._galleryHost = null;
    // The Continuous Field lives in the (singleton) cortex, not the
    // Chamber; releasing the host stops it and drops its layers before the
    // Chamber DOM (and the host with it) is torn down.
    visualCortex.setContinuousFieldHost(null);
    visualCortex.setSequenceVideoHost(null);
    this.player = null;
  }
}
