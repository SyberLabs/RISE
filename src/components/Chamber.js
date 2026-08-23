import {
  bandTravelPx,
  clampBandFraction,
  readBandOffsetSetting,
  writeBandOffsetSetting
} from '../core/band-offset.js';
import { visualCortex } from '../visuals/visual-cortex.js';
import { parsePageCollectionId, sampleWorkEngine } from '../visuals/work-engines.js';
import { TIME_SCALE as WORK_ENGINE_TIME_SCALE } from '../visuals/work-engine-field.js';
import { MemoryCore } from '../core/memory.js';
import { AttractorField } from '../visuals/attractor.js';
import { KleeField } from '../visuals/klee-field.js';
import { VisualFieldDirector } from '../visuals/visual-field-director.js';
import { escapeHtml } from '../core/sanitize.js';
// The reveal and its emphasis notation are pure logic — no DOM, no
// audio — so they live in core and are tested without a browser.
import {
  splitWords, stripEmphasis, sizeAtomScale, revealBudget, revealSchedule
} from '../core/recitation.js';
import { Voice } from '../audio/voice.js';
import { livingTextAppearance, scoreAtoms, planInterlocution } from '../core/conductor.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import {
  authoredVisualTransition,
  isContinuousPresentation
} from '../core/visual-presence.js';
import {
  MovementScheduleController,
  AudioScheduleController
} from '../core/journey-schedulers.js';
import {
  applyVisualViewportBottom,
  clearVisualViewportBottom
} from '../core/visual-viewport.js';
import { hasNextLibraryDivision } from '../core/reading-continuation.js';
import { READING_PACE } from '../core/reading-limits.js';
import { resolveChamberStreamFace } from '../core/chamber-stream-face.js';
import { applyChamberAccent, resolveChamberAccent } from '../core/chamber-accent.js';
import {
  estimateGlyphBox,
  fitWordAtomPx,
  isChamberWordFit,
  resolveFitMaskMode,
  resolveFontSize,
  threeStepIntent
} from '../core/chamber-type-size.js';
import { GROUNDS, maskFillFromConfig, maskGroundFromConfig } from '../core/mask-ground.js';
import { resolveSessionWordFill } from '../core/visual-selection.js';
import './Chamber.css';

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

export class Chamber {
  constructor(container, options = {}) {
    this.container = container;
    this.session = options.session;
    this.player = options.player;
    this.autoStart = options.autoStart !== undefined ? options.autoStart : false;
    this.onExit = options.onExit || (() => { });
    this.onEnterStream = typeof options.onEnterStream === 'function'
      ? options.onEnterStream : async () => true;

    this.controlsTimeout = null;
    this.controlsVisible = false;
    this._settingsInstance = null;
    this._settingsFailed = false;
    this.loadSettingsClass = typeof options.loadSettingsClass === 'function'
      ? options.loadSettingsClass
      : async () => (await import('./Settings.js')).Settings;
    this.attractorField = null;
    this.kleeField = null;
    this._visualFieldDirector = null;
    this._fillMaskGeneration = 0;
    this.fillFieldHost = null;
    this.maskGroundPlate = null;
    this._scheduledVisualGeneration = 0;
    // Page Mode (PAGE-MODE-SPEC): the spatial projection, mounted lazily
    // on demand. Null until the reader opens it; nothing is paid before.
    this.pageReader = null;
    this.pageModeActive = false;
    // The reader's place in the Page, kept across a trip to the Stream.
    this._lastPageIndex = 0;

    // Voice and text arrival are separate reader choices. An instant spoken
    // reading and a silent progressive reading are both valid contracts.
    this.recitationEnabled = this.session?.recitation?.enabled === true;
    this.progressiveRevealEnabled = this.session?.revealMode === 'progressive';
    this._revealTimers = null;
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
        audioEngine: window.rise?.audioEngine || null,
        voiceId: this.session?.voiceId
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
    this._spokenIndex = null;
    this._spokenPlayback = null;
    this._spokenMs = null;
    this._spokenCompletion = null;
    // The attractor is a persistent field, so its symmetry can be
    // changed mid-reading — the first in-chamber visual control.
    this.hasAttractorField = this.session?.visualConfig?.visualMode === 'attractor';
    this.kaleidoscopeEngaged =
      this.session?.visualConfig?.attractor?.form === 'kaleido';

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
        window.rise?.audioEngine || null,
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

    console.log('[Chamber] Constructor - session:', this.session);
    console.log('[Chamber] Session atoms:', this.session?.atoms);
    console.log('[Chamber] First atom:', this.session?.atoms?.[0]);
    console.log('[Chamber] Auto-start:', this.autoStart);

    this.render();
    this.applyChamberStreamFace();
    this.applyChamberTypeSize();
    this.attachEvents();
    this.bindVisualViewport();
    this.initializeDisplay();
    this.applyChamberMask();

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
    } else if (this.autoStart) {
      // Auto-start if requested (skip pre-session screen). Tracked and
      // Page-aware: a reader who opens the Page inside this delay must
      // not have a stream start underneath them when it fires.
      this._autoStartTimer = setTimeout(() => {
        this._autoStartTimer = null;
        if (this.pageModeActive) return;
        console.log('[Chamber] Auto-starting session...');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
        if (this.player) {
          this.player.play();
          if (window.rise?.audioEngine) {
            console.log('[Chamber] Triggering atmospheric swell (auto-start)');
            window.rise.audioEngine.fadeInSession(1.2);
          }
        }
      }, 500); // Relaxed timing for engine stability
    }
  }

  render() {
    const session = this.session || {};
    const title = session.title || session.name || 'Untitled Session';
    const duration = session.totalDuration || 0;
    const sources = session.sources;

    this.container.innerHTML = `
      <div class="chamber" role="main">
        <!-- Pre-Session State -->
        <div class="chamber-pre-session" id="chamber-pre" ${this.autoStart ? 'style="display: none;"' : ''}>
          <button class="chamber-back btn-ghost" id="chamber-back">
            <span class="icon">←</span>
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
            <span class="icon">▶</span>
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
            <span class="speed-hud-label">PACE</span>
            <span id="speed-hud-value" class="speed-hud-value">300</span>
            <span class="speed-hud-unit">WPM</span>
          </div>

          <!-- Progress indicator - bottom, subtle, thin -->
          <div class="chamber-progress">
            <div class="chamber-progress-fill" id="progress-fill"></div>
          </div>

          <!-- Hidden controls - appear on mouse movement -->
          <div class="chamber-controls" id="chamber-controls" style="opacity: 0;">
            <button class="control-btn" id="play-pause-btn" aria-label="Play/Pause" title="Spacebar">
              <span class="icon play-icon" id="play-icon">▶</span>
              <span class="icon pause-icon hidden" id="pause-icon">⏸</span>
            </button>

            <button class="control-btn" id="volume-btn" aria-label="Volume">
              <span class="icon">♪</span>
            </button>

            ${this.offersVisualsToggle ? `
              <button class="control-btn rhythmic-visuals-toggle" id="visuals-toggle-btn"
                type="button" aria-pressed="true" aria-label="Disable rhythmic visuals"
                title="Disable rhythmic visuals">
                <span class="icon" aria-hidden="true">&#9670;</span>
                <span class="control-label">Visuals</span>
              </button>
            ` : ''}

            <!-- PAGE TURN, IN THE BAR THAT ALREADY EXISTS.
                 The Page Reader used to float its own pager above this
                 one. Two stacked control clusters at the foot of the
                 screen overlapped on a short frame and, even apart,
                 read as two competing objects rather than one place
                 where the controls live. There is one bar. -->
            <span class="page-turn" id="page-turn" hidden>
              <button class="control-btn" id="page-prev" type="button"
                aria-label="Previous page" title="Previous page">
                <span class="icon" aria-hidden="true">&#8592;</span>
              </button>
              <span class="page-turn-count" id="page-turn-count" aria-live="polite"></span>
              <button class="control-btn" id="page-next" type="button"
                aria-label="Next page" title="Next page">
                <span class="icon" aria-hidden="true">&#8594;</span>
              </button>
            </span>

            <!-- ELONGATE. The reading's length picks a projection; this
                 lets the reader overrule it without leaving the Page.
                 Shown only when there is genuinely a choice to make. -->
            <button class="control-btn page-elongate" id="page-elongate" type="button" hidden
              aria-pressed="false" aria-label="Elongate into one column"
              title="Elongate — read as one continuous column">
              <span class="icon" aria-hidden="true">&#8597;</span>
              <span class="control-label">Elongate</span>
            </button>

            <!-- Stream ⇄ Page: the two projections of one reading -->
            <button class="control-btn page-mode-toggle" id="page-mode-btn"
              type="button" aria-pressed="false" aria-label="Read as a page"
              title="Read as a page (the spatial projection)">
              <span class="icon" aria-hidden="true">&#9638;</span>
              <span class="control-label">Page</span>
            </button>

            ${this.hasAttractorField ? `
              <button class="control-btn kaleidoscope-toggle" id="kaleidoscope-btn"
                type="button" aria-pressed="false" aria-label="Fold the field into a kaleidoscope"
                title="Kaleidoscope (K)">
                <span class="icon" aria-hidden="true">&#10052;</span>
                <span class="control-label">Kaleidoscope</span>
              </button>
            ` : ''}

            <span class="time-display font-mono text-fog" id="time-display">
              <span id="time-current">0:00</span>
              <span class="time-separator" style="opacity: 0.3;">/</span>
              <span id="time-total" style="font-size: 0.9em; opacity: 0.6;">0:00</span>
              
            </span>

            <button class="control-btn chamber-settings-btn" id="chamber-settings-btn"
              type="button" aria-label="Settings">Settings</button>

            <button class="control-btn" id="exit-btn" aria-label="Exit" title="Escape">
              <span class="icon">✕</span>
            </button>
            <span class="chamber-settings-fail" id="chamber-settings-fail" hidden>Settings will not open.</span>
          </div>
        </div>

        <!-- Post-Session State -->
        <div class="chamber-post-session" id="chamber-post" style="display: none;">
          <!-- Choice Screen -->
          <div id="post-choice-screen" class="post-complete-screen">

            <!-- Atmospheric glow halo behind sigil -->
            <div class="post-halo"></div>

            <!-- Sigil -->
            <div class="post-sigil-wrap">
              <div class="post-sigil-ring"></div>
              <div class="post-sigil-char">◊</div>
            </div>

            <!-- Eyebrow + Title -->
            <p class="post-eyebrow">Session Closed</p>
            <h2 class="post-complete-title">Complete</h2>

            <div class="post-stats">
              <div class="post-stat">
                <span class="post-stat-value" id="post-atoms">0</span>
                <span class="post-stat-label">Atoms</span>
              </div>
            </div>

            <!-- Separator line -->
            <div class="post-separator"></div>

            <!-- Actions -->
            <div class="post-complete-actions">
              ${hasNextLibraryDivision(this.session?.continuation) ? `
              <button class="post-btn-continue" id="post-continue">
                Next ${escapeHtml(this.session.continuation.noun)}
                <span class="post-btn-icon" aria-hidden="true">→</span>
              </button>` : ''}
              <button class="post-btn-return" id="post-return-chamber">
                <span class="post-btn-icon">←</span>
                Return
              </button>
              <button class="post-btn-recursion" id="post-recursion">
                <span class="post-btn-icon-recursion">↻</span>
                Recursion
              </button>
            </div>

            <!-- Subtle bottom inscription -->
            <p class="post-inscription">The pattern persists. Begin again or carry it forward.</p>

          </div>
          
          <!-- Synthesis Phase -->
          <div id="synthesis-screen" class="synthesis-container" style="display: none; width: 100%; max-width: 800px; margin: 0 auto; text-align: left;">
            <p class="synthesis-eyebrow">Post-Session</p>
            <h2 class="synthesis-title">Synthesis</h2>
            <p class="synthesis-subtitle">Threads weave. Connections form. Understanding emerges.</p>
            <div class="synthesis-context">
              <span class="synthesis-context-label">Session Completed</span>
              <span class="synthesis-context-value">${escapeHtml(title)}</span>
            </div>
            <textarea
              id="synthesis-input"
              class="journal-input"
              placeholder="Record your insights, resonances, observations..."
            ></textarea>

            <div class="journal-actions">
              <button class="btn-ghost" id="post-close">
                Discard &amp; Return
              </button>
              <button class="btn-primary" id="post-seal">
                Seal &amp; Workshop
              </button>
            </div>
          </div>
        </div>

        <div class="chamber-settings-overlay" id="chamber-settings-overlay" hidden></div>

        <!-- Custom Exit Confirmation Overlay -->
        <div id="exit-confirm-overlay" class="exit-overlay hidden" style="display: none;">
          <div class="exit-modal">
            <div class="exit-sigil">✕</div>
            <h2 class="exit-title">Terminate?</h2>
            <p class="exit-message">
              The current sequence will be abandoned. 
              
            </p>
            <div class="exit-actions">
              <button class="btn-ghost" id="exit-cancel">Stay</button>
              <button class="btn-primary" id="exit-confirm">Terminate</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  applyChamberStreamFace() {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) return false;
    atomDisplay.dataset.chamberFace = resolveChamberStreamFace(
      globalThis.rise?.settings?.chamberFace
    );
    if (atomDisplay.classList.contains('is-mask')) {
      void this.syncFillGlyphMask();
    }
    return true;
  }

  applyChamberTypeSize() {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) return false;
    atomDisplay.dataset.fontSize = resolveFontSize(
      globalThis.rise?.settings?.fontSize
    );
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

  applyChamberAccent() {
    return applyChamberAccent(
      document.documentElement,
      globalThis.rise?.settings?.chamberAccent
    );
  }

  _reportAccentApply(requested) {
    const fail = this.container.querySelector('#chamber-accent-fail');
    if (!fail) return;
    const allowlisted = resolveChamberAccent(requested) === requested;
    fail.hidden = allowlisted && document.documentElement.dataset.accent === requested;
  }

  chamberMaskApplies() {
    const settings = globalThis.rise?.settings || {};
    const visualConfig = this.session?.visualConfig;
    const presentation = this.session?.visualConfig?.interlocution?.presentation;
    return resolveFitMaskMode({
      fontSize: settings.fontSize,
      chunkMode: this.session?.chunkMode,
      visualMode: visualConfig?.visualMode,
      presentation,
      legacyMask: settings.chamberMask === true
    });
  }

  applyChamberMask() {
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) return;
    if (this.chamberMaskApplies()) {
      atomDisplay.classList.add('is-mask');
      atomDisplay.classList.remove('glass-tile');
      this.ensureFillField();
      this.syncMaskGroundPlate();
    } else {
      atomDisplay.classList.remove('is-mask');
      atomDisplay.classList.remove('is-mask-ink');
      this.destroyFillField();
    }
  }

  _removeMaskGroundPlate() {
    if (this.maskGroundPlate) {
      this.maskGroundPlate.remove();
      this.maskGroundPlate = null;
    }
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
    const wrapper = this.fillFieldHost;
    const layerA = this.container.querySelector('#chamber-continuous-field');
    if (!this.chamberMaskApplies() || !wrapper) {
      this._removeMaskGroundPlate();
      return;
    }

    // Declared session pair wins. Missing wordFill infers the engine
    // from the session pair (Astronomy × Fractal → Fractal pick).
    // Cortex leftover (default `same`, or a prior Attractor pick) must
    // not hide cream behind Astronomy Dark.
    const sourceConfig = this._maskSourceConfig();
    const roomOpaque = Boolean(visualCortex._continuousField?.currentUrl)
      || Boolean(layerA?.querySelector('.continuous-field-artwork[src]'));
    const ground = maskGroundFromConfig({
      ...sourceConfig,
      roomOpaque
    });

    if (ground === GROUNDS.transparent) {
      this._removeMaskGroundPlate();
      return;
    }

    let plate = this.maskGroundPlate;
    if (!plate || plate.parentNode !== wrapper) {
      plate = document.createElement('div');
      plate.className = 'chamber-mask-ground-plate';
      plate.setAttribute('aria-hidden', 'true');
      this.maskGroundPlate = plate;
    }
    if (wrapper.firstChild !== plate) {
      wrapper.insertBefore(plate, wrapper.firstChild);
    }
    plate.dataset.ground = ground;
    wrapper.style.removeProperty('background');
    wrapper.style.removeProperty('background-color');
  }

  _shouldMountFill() {
    return this.chamberMaskApplies()
      && !this.pageModeActive
      && !this._temporalVisualsDeferred
      && visualCortex.hasContinuousFieldHost?.();
  }

  async _waitFontsReady() {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* A font load failure must not leave transparent empty letters. */
    }
  }

  _maskImageSupported() {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
    try {
      return CSS.supports('mask-image', 'url("#x")')
        || CSS.supports('-webkit-mask-image', 'url("#x")')
        || CSS.supports('mask-image', 'url(#x)');
    } catch {
      return false;
    }
  }

  _atomHasWordInk(atomDisplay) {
    if (!atomDisplay || atomDisplay.querySelector('.atom-seam')) return false;
    return (atomDisplay.textContent || '').trim().length > 0;
  }

  _clearFillMask() {
    if (!this.fillFieldHost) return;
    this.fillFieldHost.style.maskImage = 'none';
    this.fillFieldHost.style.webkitMaskImage = 'none';
  }

  _revertFillToOpaqueWord() {
    this._clearLivingFit();
    const atomDisplay = this.container.querySelector('#atom-display');
    atomDisplay?.classList.remove('is-mask-ink');
    if (atomDisplay?.style.color === 'transparent') {
      atomDisplay.style.removeProperty('color');
    }
    if (this.fillFieldHost) {
      this.fillFieldHost.classList.add('is-hidden');
      this._clearFillMask();
    }
  }

  ensureFillField() {
    if (!this._shouldMountFill() || !this._maskImageSupported()) {
      this.destroyFillField();
      return;
    }
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;
    if (!this.fillFieldHost) {
      const host = document.createElement('div');
      host.className = 'chamber-fill-field chamber-continuous-field';
      host.setAttribute('aria-hidden', 'true');
      host.classList.add('is-hidden');
      this._insertBehindReading(field, host);
      this.fillFieldHost = host;
    }
    visualCortex.setContinuousFieldProjectionHost(this.fillFieldHost);
    this.syncMaskGroundPlate();
    void this.syncFillGlyphMask();
  }

  async syncFillGlyphMask() {
    const generation = ++this._fillMaskGeneration;
    // Do not leave the glyph as opaque --color-light while Space Grotesk
    // 700 (display=swap) is still swapping. Ink before the font await.
    const pendingAtom = this.container.querySelector('#atom-display');
    if (
      this._shouldMountFill()
      && this._maskImageSupported()
      && this._atomHasWordInk(pendingAtom)
    ) {
      pendingAtom.classList.add('is-mask-ink');
      pendingAtom.style.color = 'transparent';
    }
    await this._waitFontsReady();
    if (generation !== this._fillMaskGeneration) return;

    if (!this._shouldMountFill()) {
      this.destroyFillField();
      return;
    }
    if (!this._maskImageSupported()) {
      this.destroyFillField();
      return;
    }

    const field = this.container.querySelector('#chamber-field');
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!field || !atomDisplay || !this.fillFieldHost) return;

    if (!this._atomHasWordInk(atomDisplay)) {
      this._revertFillToOpaqueWord();
      return;
    }

    const fieldRect = field.getBoundingClientRect();
    const atomRect = atomDisplay.getBoundingClientRect();
    const fieldWidth = field.clientWidth || fieldRect.width;
    const fieldHeight = field.clientHeight || fieldRect.height;
    if (fieldWidth < 2 || fieldHeight < 2 || atomRect.width < 1 || atomRect.height < 1) {
      this._revertFillToOpaqueWord();
      return;
    }

    const cs = getComputedStyle(atomDisplay);
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    const paddingBottom = parseFloat(cs.paddingBottom) || 0;
    const contentWidth = Math.max(0, atomRect.width - paddingLeft - paddingRight);
    const contentHeight = Math.max(0, atomRect.height - paddingTop - paddingBottom);
    const textX = (atomRect.left - fieldRect.left) + paddingLeft + (contentWidth / 2);
    const textY = (atomRect.top - fieldRect.top) + paddingTop + (contentHeight / 2);
    const text = (atomDisplay.textContent || '').trim();

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('xmlns', svgNs);
    svg.setAttribute('width', String(fieldWidth));
    svg.setAttribute('height', String(fieldHeight));
    svg.setAttribute('viewBox', `0 0 ${fieldWidth} ${fieldHeight}`);
    const textEl = document.createElementNS(svgNs, 'text');
    textEl.setAttribute('x', String(textX));
    textEl.setAttribute('y', String(textY));
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('fill', '#fff');
    textEl.setAttribute('font-family', cs.fontFamily || 'sans-serif');
    textEl.setAttribute('font-size', cs.fontSize || '96px');
    textEl.setAttribute('font-weight', cs.fontWeight || '700');
    textEl.setAttribute('font-style', cs.fontStyle || 'normal');
    if (cs.letterSpacing && cs.letterSpacing !== 'normal') {
      textEl.setAttribute('letter-spacing', cs.letterSpacing);
    }
    textEl.textContent = text;
    svg.appendChild(textEl);

    let markup = '';
    try {
      markup = new XMLSerializer().serializeToString(svg);
    } catch {
      this.destroyFillField();
      return;
    }
    if (!markup || !/<text[\s>]/i.test(markup)) {
      this.destroyFillField();
      return;
    }

    const url = `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
    this.fillFieldHost.style.maskImage = url;
    this.fillFieldHost.style.webkitMaskImage = url;
    this.fillFieldHost.style.maskMode = 'luminance';
    this.fillFieldHost.style.webkitMaskMode = 'luminance';
    this.fillFieldHost.style.maskRepeat = 'no-repeat';
    this.fillFieldHost.style.webkitMaskRepeat = 'no-repeat';
    this.fillFieldHost.style.maskSize = '100% 100%';
    this.fillFieldHost.style.webkitMaskSize = '100% 100%';
    this.fillFieldHost.style.maskPosition = '0 0';
    this.fillFieldHost.style.webkitMaskPosition = '0 0';

    visualCortex.setContinuousFieldProjectionHost(this.fillFieldHost);
    this.fillFieldHost.classList.remove('is-hidden');
    atomDisplay.classList.add('is-mask-ink');
    atomDisplay.style.color = 'transparent';
    atomDisplay.style.removeProperty('text-shadow');
    this.syncMaskGroundPlate();
  }

  destroyFillField() {
    this._clearLivingFit();
    this._fillMaskGeneration += 1;
    const atomDisplay = this.container.querySelector('#atom-display');
    atomDisplay?.classList.remove('is-mask-ink');
    if (atomDisplay?.style.color === 'transparent') {
      atomDisplay.style.removeProperty('color');
    }
    visualCortex.setContinuousFieldProjectionHost(null);
    if (this.fillFieldHost) {
      this.fillFieldHost.remove();
      this.fillFieldHost = null;
    }
    this._removeMaskGroundPlate();
  }

  attachEvents() {
    // Pre-session
    const backBtn = this.container.querySelector('#chamber-back');
    const beginBtn = this.container.querySelector('#chamber-begin');

    backBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.onExit('back');
    });
    beginBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.beginSession();
    });

    // In-session controls
    const playPauseBtn = this.container.querySelector('#play-pause-btn');
    const volumeBtn = this.container.querySelector('#volume-btn');
    const visualsToggleBtn = this.container.querySelector('#visuals-toggle-btn');
    const settingsBtn = this.container.querySelector('#chamber-settings-btn');
    const exitBtn = this.container.querySelector('#exit-btn');

    playPauseBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.togglePlayPause();
    });
    volumeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.toggleVolume();
    });
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

    const pageModeBtn = this.container.querySelector('#page-mode-btn');
    pageModeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.togglePageMode();
    });
    const kaleidoscopeBtn = this.container.querySelector('#kaleidoscope-btn');
    kaleidoscopeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.toggleKaleidoscope();
    });
    visualsToggleBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.toggleRhythmicVisuals();
    });
    settingsBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      void this.openSettings();
    });
    exitBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.exitSession();
    });

    // Post-session (Choice and Synthesis phase)
    const returnBtn = this.container.querySelector('#post-return-chamber');
    const continueBtn = this.container.querySelector('#post-continue');
    const recursionBtn = this.container.querySelector('#post-recursion');
    const sealBtn = this.container.querySelector('#post-seal');
    const closeBtn = this.container.querySelector('#post-close');

    continueBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      continueBtn.disabled = true;
      this.onExit('continue');
    });
    returnBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.onExit('close');
    });
    recursionBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.showSynthesisScreen();
    });
    sealBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.handleSynthesisSealing();
    });
    closeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.onExit('close');
    });

    const synthesisInput = this.container.querySelector('#synthesis-input');
    synthesisInput?.addEventListener('keydown', (e) => {
      if (window.rise?.audioEngine) {
        window.rise.audioEngine.playKeyPress(e.keyCode);
      }
    });

    // Exit Modal specific
    const exitCancel = this.container.querySelector('#exit-cancel');
    const exitConfirm = this.container.querySelector('#exit-confirm');

    exitCancel?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.hideExitConfirmation();
    });

    exitConfirm?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.performExit();
    });

    // Mouse movement for hidden controls
    const display = this.container.querySelector('#chamber-display');
    display?.addEventListener('mousemove', () => this.showControls());

    this.attachBandMove();

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

      this.player.on('atom', (data) => {
        // ORDER IS THE CONTRACT (JOURNEYS-SPEC §8.4): movement, then
        // visual, then audio, then recitation, then display. The
        // movement is announced before the cues it explains, and the
        // text is painted last so nothing a reader sees precedes the
        // world it belongs to.
        this._movementSchedule?.observe(data.atom);

        // The visual schedule follows the reading (PERICOPE-IMAGERY-
        // SPEC §6): each atom's coordinates drive at most one cue
        // change, which the generic scheduler sends to the cortex.
        // Chapel-agnostic — the Chamber knows nothing of pericopes.
        this._visualSchedule?.observe(data.atom);

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

      this.player.on('progress', (progress) => this.updateProgress(progress));
      this.player.on('complete', () => this.onSessionComplete());
      this.player.on('state', (state) => this.onStateChange(state));
      // Shuttle transitions the Player makes on its own (pause drops
      // home; rewind clamps home at atom 0) carry the same subsystem
      // contract and HUD as key-initiated steps
      this.player.on('shuttle', ({ velocity }) => {
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

    this.revealAtomWords(spans, revealSchedule(
      spans.length,
      budget,
      spoken && !reducedMotion ? spoken.onsets : null
    ));
  }

  handleKeyboard(e) {
    const settingsOverlay = this.container.querySelector('#chamber-settings-overlay');
    if (settingsOverlay && !settingsOverlay.hidden) return;

    // Don't let spacebar trigger play/pause while user is typing in a field
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'TEXTAREA' || tag === 'INPUT' || document.activeElement?.isContentEditable;

    // While the Page holds the reading, the keyboard belongs to the page:
    // Space scrolls (its native behaviour) instead of driving a hidden
    // stream. Only Escape still reaches the Chamber, so the reader can
    // always leave. (PAGE-MODE-SPEC §4 — page authority.)
    if (this.pageModeActive && e.code !== 'Escape') return;

    // Spacebar: play/pause (only when NOT typing)
    if (e.code === 'Space' && !isTyping) {
      e.preventDefault();
      this.togglePlayPause();
    } else if (isTyping) {
      // Trigger mechanical key sound ONLY while typing in journal/inputs
      if (window.rise?.audioEngine) {
        window.rise.audioEngine.playKeyPress(e.keyCode);
      }
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
            window.rise?.audioEngine?.playHiss();
            this.toggleKaleidoscope();
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
    try { window.rise?.audioEngine?.setShuttleSuspension?.(suspended); }
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
      if (label) label.textContent = 'PACE';
      value.textContent = String(this.currentWpm);
      if (unit) unit.textContent = 'WPM';
    } else {
      if (label) label.textContent = velocity < 0 ? '‹‹ REWIND' : 'FORWARD ››';
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
      setTimeout(() => {
        display.style.opacity = '1';
      }, 50);

      // Request fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // User declined, continue anyway
        });
      }

      if (this.player) {
        this.player.play();
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.fadeInSession(1.2); // Smooth swell at start
        }
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
  }

  /** One scheduled cue owns the complete visual presentation transition. */
  applyScheduledVisualCue(cue, meta = {}) {
    const fieldCue = cue?.kind === 'focal'
      ? { kind: 'field', renderer: 'focal', config: cue.focal || {} }
      : cue;
    const transitionMs = authoredVisualTransition(meta.durationMs, 320);
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
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false && !this.chamberMaskApplies()) {
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
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false && !this.chamberMaskApplies()) {
      atomDisplay.classList.add('glass-tile');
    }
  }

  mountVisualFieldCue(cue) {
    const field = this.container.querySelector('#chamber-field');
    if (!field || cue?.kind !== 'field') return null;
    const config = cue.config && typeof cue.config === 'object' ? cue.config : {};
    const atomDisplay = field.querySelector('#atom-display');
    let controller = null;
    let destroyed = false;
    const host = document.createElement('div');

    if (cue.renderer === 'genesis') {
      host.className = 'chamber-genesis';
      field.classList.add('chamber-field-genesis');
      if (atomDisplay && config.glass !== false && !this.chamberMaskApplies()) {
        atomDisplay.classList.add('glass-tile');
      }
      this._insertBehindReading(field, host);
      controller = new KleeField(host, { preset: config.preset || 'random' });
      this.kleeField = controller;
    } else if (cue.renderer === 'attractor') {
      host.className = 'chamber-attractor';
      this._insertBehindReading(field, host);
      controller = new AttractorField(host, {
        system: config.system || 'aizawa',
        palette: config.palette,
        form: config.form
      });
      this.attractorField = controller;
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
      destroy: () => {
        destroyed = true;
        controller?.destroy?.();
        if (this.kleeField === controller) this.kleeField = null;
        if (this.attractorField === controller) this.attractorField = null;
        if (this.rosaField === controller) this.rosaField = null;
        host.remove();
        if (!field.querySelector('.chamber-genesis')) {
          field.classList.remove('chamber-field-genesis');
          if (!field.classList.contains('chamber-field-stream')) {
            atomDisplay?.classList.remove('glass-tile');
          }
        }
      }
    };
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
      const { RosaMystica } = await import('../visuals/rosa-mystica.js');
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
      const { findChapelIcon } = await import('../content/chapel/imagery/icons.js');
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
    this._revealTimers = spans.map((span, i) => {
      const at = schedule[i] ?? 0;
      if (at <= 0) { span.removeAttribute('data-pending'); return null; }
      return setTimeout(() => span.removeAttribute('data-pending'), at);
    }).filter(Boolean);
  }

  /** Stop a reveal in flight. Idempotent. */
  cancelReveal() {
    if (this._revealTimers) {
      for (const t of this._revealTimers) clearTimeout(t);
      this._revealTimers = null;
    }
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
    const fontSize = resolveFontSize(globalThis.rise?.settings?.fontSize);
    atomDisplay.dataset.fontSize = fontSize;
    atomDisplay.style.setProperty('--font-size-intent', String(threeStepIntent(fontSize)));

    const useFit = isChamberWordFit(fontSize)
      && this.session?.chunkMode === 'word'
      && Boolean(stripEmphasis(content).trim());

    if (!useFit) {
      atomDisplay.classList.remove('is-word-fit');
      atomDisplay.style.removeProperty('--atom-fit-px');
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
      atomDisplay.style.setProperty('--atom-scale', String(sizeAtomScale(content)));
      return;
    }
    atomDisplay.classList.add('is-word-fit');
    atomDisplay.style.setProperty('--atom-fit-px', `${px}px`);
    atomDisplay.style.setProperty('--atom-scale', '1');
  }

  _wordFitBox() {
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
    return {
      width: smallestPositive(stageWidth, viewport?.width, root?.clientWidth),
      height: smallestPositive(stageHeight, viewport?.height, root?.clientHeight),
      source: 'chamber-stage'
    };
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

  applyLivingText(atomDisplay, index) {
    this._clearLivingFit();
    if (!this.semanticTrack) return;
    const sig = this.semanticTrack[index];
    if (!sig) return;

    const intensity = this.session?.visualConfig?.livingText?.intensity ?? 1;
    const appearance = livingTextAppearance(sig, intensity);
    const proceduralFit = atomDisplay?.classList.contains('is-word-fit')
      && this._shouldMountFill()
      && maskFillFromConfig(this._maskSourceConfig()).procedural;

    if (proceduralFit) {
      this._applyLivingFit(appearance);
      atomDisplay.style.color = 'transparent';
      atomDisplay.style.removeProperty('text-shadow');
      return;
    }
    if (atomDisplay?.classList.contains('is-mask-ink')) {
      atomDisplay.style.color = 'transparent';
      atomDisplay.style.removeProperty('text-shadow');
      return;
    }
    atomDisplay.style.color = appearance.color;
    const [r, g, b] = appearance.rgb;
    atomDisplay.style.textShadow = `0 0 ${appearance.glowRadius.toFixed(0)}px rgba(${r}, ${g}, ${b}, ${appearance.glowAlpha.toFixed(3)})`;
  }

  _clearLivingFit() {
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;
    field.classList.remove('is-living-fit');
    field.style.removeProperty('--living-fit-color');
    field.style.removeProperty('--living-fit-mix');
    field.style.removeProperty('--living-fit-saturation');
    field.style.removeProperty('--living-fit-brightness');
  }

  _applyLivingFit(appearance) {
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;
    field.classList.add('is-living-fit');
    field.style.setProperty('--living-fit-color', appearance.color);
    field.style.setProperty('--living-fit-mix', appearance.fitMix.toFixed(3));
    field.style.setProperty('--living-fit-saturation', appearance.fitSaturation.toFixed(3));
    field.style.setProperty('--living-fit-brightness', appearance.fitBrightness.toFixed(3));
  }

  displayAtom(atom, index, { concealed = false, spoken = null } = {}) {
    console.log('[Chamber] displayAtom called with:', atom);
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) {
      console.error('[Chamber] No atom-display element found!');
      return;
    }
    this.applyChamberMask();

    // Genesis field follows the passage's mood when Living Text has a track
    if (this.kleeField && this.semanticTrack) {
      this.kleeField.setSignal(this.semanticTrack[index] || null);
    }

    // Empty atoms (paragraph breaks, pause markers) are silence, not frames:
    // render nothing and drop opacity so no residue — like the glass tile
    // collapsing into a caret-like slab — ever pulses between tokens.
    if (!atom.content || !atom.content.trim()) {
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
          spans.length, budget, spoken && !reducedMotion ? spoken.onsets : null));
      } else {
        this.cancelReveal();
      }
    }
    void this.syncFillGlyphMask();
  }

  /**
   * Reduced motion is read live rather than cached: a reader may change
   * the system setting mid-session, and the reveal should stop being
   * animated the moment they do.
   */
  _prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
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
  }

  togglePlayPause() {
    if (!this.player) return;

    // Page authority (PAGE-MODE-SPEC §4): while Page is open, do not start Stream.
    if (this.pageModeActive) return;

    // Debounce to prevent double-click issues (hardware or accidental)
    const now = Date.now();
    if (this._lastToggleTime && now - this._lastToggleTime < 200) return;
    this._lastToggleTime = now;

    const playIcon = this.container.querySelector('#play-icon');
    const pauseIcon = this.container.querySelector('#pause-icon');

    if (this.player.state === 'playing' || this.player.state === 'interlocuting') {
      this.player.pause();
      if (window.rise?.audioEngine) {
        window.rise.audioEngine.fadeOutSession(0.4);
      }
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    } else {
      this.player.play();
      if (window.rise?.audioEngine) {
        window.rise.audioEngine.fadeInSession(0.6);
      }
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    }
  }

  _pauseLikePlay() {
    if (!this.player) return;
    if (this.player.state === 'playing' || this.player.state === 'interlocuting') {
      this.togglePlayPause();
    }
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
    this._settingsInstance = new Settings(host, {
      settings: globalThis.rise?.settings || {},
      onClose: () => this.closeSettings(),
      onNavigate: () => this.closeSettings(),
      onDataCleared: () => {
        if (typeof globalThis.rise?.handleDataCleared === 'function') {
          globalThis.rise.handleDataCleared();
          return;
        }
        if (globalThis.rise) globalThis.rise.currentSession = null;
        window.setTimeout(() => window.location.reload(), 300);
      },
      onChange: (key, value) => {
        if (typeof globalThis.rise?.handleSettingsChange === 'function') {
          globalThis.rise.handleSettingsChange(key, value);
        } else if (globalThis.rise?.settings) {
          globalThis.rise.settings[key] = key === 'chamberFace'
            ? resolveChamberStreamFace(value)
            : key === 'chamberMask'
              ? value === true
              : key === 'fontSize'
                ? resolveFontSize(value)
                : key === 'chamberAccent'
                  ? resolveChamberAccent(value)
                  : value;
        }
        if (key === 'chamberFace' || key === 'chamberMask') {
          this.applyChamberStreamFace();
          this.applyChamberMask();
        }
        if (key === 'fontSize') this.applyChamberTypeSize();
        if (key === 'chamberFace') this._reportFaceApply(value);
        if (key === 'chamberAccent') {
          this.applyChamberAccent();
          this._reportAccentApply(value);
        }
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
    this.pageModeActive = next;
    if (!next) this._syncPageTurn();

    const btn = this.container.querySelector('#page-mode-btn');
    const display = this.container.querySelector('#chamber-display');
    btn?.setAttribute('aria-pressed', String(next));
    btn?.setAttribute('aria-label', next ? 'Return to the stream' : 'Read as a page');
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
    if (this.player?.state === 'playing' || this.player?.state === 'interlocuting') {
      this.player.pause();
      window.rise?.audioEngine?.fadeOutSession(0.4);
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
        import('../page/PageReader.js'),
        import('../visuals/visual-cortex.js')
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
        session: this.session,
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
      // RETURN THE READER TO WHERE THEY WERE. Page Mode builds a fresh
      // PageReader every time it opens, so leaving for the Stream and
      // coming back landed on page one — the reading was held, and the
      // reader's PLACE in it was not.
      //
      // READ THE MEMORY BEFORE RENDERING, NOT AFTER. The first attempt
      // at this restored after render() and did nothing at all, because
      // render() lands on page 0 and reports it through onPageChange —
      // which is the same callback that RECORDS the position. The
      // render erased the memory a line before it was consulted. A
      // value read after the thing that writes it is not a memory.
      const resume = this._lastPageIndex;
      this.pageReader.render();
      if (resume > 0) this.pageReader.goToPage(resume);
    } catch (error) {
      console.warn('[Chamber] Page Mode unavailable:', error);
      if (generation !== this._pageGeneration) return this.pageModeActive;
      host.hidden = true;
      this.pageModeActive = false;
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
        this.attractorField.sampleAt(((n + 1) / wanted) * SWEEP_SECONDS), 'Attractor');
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
    if (suspended.attractor && this.attractorField?.resume) this.attractorField.resume();
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

    const button = this.container.querySelector('#visuals-toggle-btn');
    if (button) {
      const label = enabled ? 'Disable rhythmic visuals' : 'Enable rhythmic visuals';
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', label);
      button.title = label;
      button.classList.toggle('is-off', !enabled);
      const icon = button.querySelector('.icon');
      if (icon) icon.textContent = enabled ? '◆' : '◇';
    }
    this.showControls();
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
    if (!this.hasAttractorField || !this.attractorField) return false;

    const engaged = typeof forceEngaged === 'boolean'
      ? forceEngaged
      : !this.kaleidoscopeEngaged;
    if (engaged === this.kaleidoscopeEngaged) return engaged;

    // The field owns which form to restore, so unfolding returns the
    // reader to the form they were reading in, not a fixed default.
    this.kaleidoscopeEngaged = this.attractorField.toggleKaleidoscope();

    // Keep the ephemeral session honest for anything that inspects it
    if (this.session?.visualConfig?.attractor) {
      this.session.visualConfig.attractor.form = this.attractorField.form;
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

  toggleVolume() {
    const existing = this.container.querySelector('#volume-modal');
    if (existing) {
      existing.remove();
      return;
    }

    const currentVolume = window.rise?.settings?.masterVolume ?? 0.75;

    const modal = document.createElement('div');
    modal.id = 'volume-modal';
    modal.className = 'volume-modal';
    modal.innerHTML = `
      <div class="volume-modal-content">
        <div class="volume-header">
          <span class="volume-icon">♪</span>
          <span class="volume-title">Volume</span>
        </div>
        <div class="volume-slider-row">
          <input type="range" class="slider volume-slider" id="volume-slider"
            min="0" max="100" value="${Math.round(currentVolume * 100)}" />
          <span class="volume-value font-mono" id="volume-value">${Math.round(currentVolume * 100)}%</span>
        </div>
        <div class="volume-presets">
          <button class="volume-preset" data-volume="0">Mute</button>
          <button class="volume-preset" data-volume="50">50%</button>
          <button class="volume-preset" data-volume="100">Max</button>
        </div>
      </div>
    `;

    // Position near volume button
    const volumeBtn = this.container.querySelector('#volume-btn');
    const rect = volumeBtn.getBoundingClientRect();
    modal.style.position = 'fixed';
    modal.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    modal.style.left = `${rect.left}px`;

    this.container.appendChild(modal);

    const slider = modal.querySelector('#volume-slider');
    const valueDisplay = modal.querySelector('#volume-value');

    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      valueDisplay.textContent = `${value}%`;
      this.setVolume(value / 100);
    });

    modal.querySelectorAll('.volume-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.volume);
        slider.value = value;
        valueDisplay.textContent = `${value}%`;
        this.setVolume(value / 100);
      });
    });

    const closeHandler = (e) => {
      if (!modal.contains(e.target) && e.target !== volumeBtn) {
        modal.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  setVolume(volume) {
    if (window.rise?.audioEngine) {
      window.rise.audioEngine.setVolume(volume);
    }
    if (window.rise?.settings) {
      if (typeof window.rise.handleSettingsChange === 'function') {
        window.rise.handleSettingsChange('masterVolume', volume);
      } else {
        window.rise.settings.masterVolume = volume;
      }
    }
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

    this._bandOffsetFraction = readBandOffsetSetting();
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
      if (moved) writeBandOffsetSetting(this._bandOffsetFraction);
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
      this.container.removeEventListener('pointerdown', onDismiss, true);
      document.removeEventListener('keydown', onKey);
    };

    // Recomputed on resize: the fraction is stable, the pixels are not.
    this._bandResize = () => this.applyBandOffset();
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
    
    if (window.rise?.audioEngine) {
        window.rise.audioEngine.playClick();
    }
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
  _syncPageTurn(state = {}) {
    // The reader's own report, taken whole. Inferring `isPaged` and
    // `canPage` from `total` is what made Elongate a one-way door: an
    // elongated reading is ONE page and reads as "nothing to paginate".
    const { index = 0, total = 0, isPaged = false, canPage = false } = state;
    // Remembered here rather than read back on close: by the time Page
    // Mode is torn down the reader is already gone.
    if (total > 1) this._lastPageIndex = index;

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
    const settingsOverlay = this.container.querySelector('#chamber-settings-overlay');
    if (settingsOverlay && !settingsOverlay.hidden) {
      this.closeSettings();
      return true;
    }
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
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.fadeOutSession(0.3);
        }
      } else {
        this._wasPlayingOnExitPrompt = false;
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.fadeOutSession(0.3);
        }
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
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.fadeInSession(0.3);
        }
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
    const display = this.container.querySelector('#chamber-display');
    const postSession = this.container.querySelector('#chamber-post');

    // Fade out display
    display.style.transition = 'opacity 400ms var(--ease-in)';
    display.style.opacity = '0';

    if (window.rise?.audioEngine) {
      window.rise.audioEngine.fadeOutSession(1.2); // Slower fade for completion
    }

    setTimeout(() => {
      display.style.display = 'none';

      // Determine sequence length
      const atoms = this.container.querySelector('#post-atoms');

      if (atoms && this.session) {
        atoms.textContent = `${this.session.atoms?.length || 0}`;
      }

      // Reset nested screens
      const choiceScreen = this.container.querySelector('#post-choice-screen');
      const synthesisScreen = this.container.querySelector('#synthesis-screen');
      if (choiceScreen && synthesisScreen) {
        choiceScreen.style.display = 'block';
        synthesisScreen.style.display = 'none';
      }

      // Show post-session
      postSession.style.display = 'flex';
      postSession.style.opacity = '0';
      postSession.style.transition = 'opacity 400ms var(--ease-out)';
      setTimeout(() => {
        postSession.style.opacity = '1';
        
        // Restore UI audio capability by stopping the session (resets master gain volume)
        if (window.rise?.audioEngine) {
            window.rise.audioEngine.stopSession();
        }
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

    // The Genesis field breathes with the session: pausing the text
    // pauses the pen
    // A paused reading is silent. The voice speaks one atom at a time
    // and cannot be resumed mid-phrase, so pausing stops it outright —
    // the next atom speaks from its beginning. Stopping also restores
    // the ducked music, which would otherwise stay down while paused.
    if (state === 'paused' || state === 'idle') this.voice?.stop();

    if (state === 'paused') this._visualFieldDirector?.pause();
    else if (state === 'playing') this._visualFieldDirector?.resume();

    // Authored imagery is bound to the reading clock: pause holds the exact
    // Gallery frame and living-engine state. An unscored ambient Gallery is
    // deliberately independent and continues drifting while text is paused.
    if (state === 'paused' && this._visualSchedule && !this._authoredGalleryPaused) {
      this._authoredGalleryPaused = visualCortex.pauseContinuousField() === true;
    } else if (state === 'playing' && this._authoredGalleryPaused) {
      visualCortex.resumeContinuousField();
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
    document.addEventListener('keydown', this.boundKeyboardHandler);

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

  destroy() {
    this.closeSettings();
    this.unbindVisualViewport();
    this._bandMoveCleanup?.();
    this._bandMoveCleanup = null;
    if (this._bandResize) {
      window.removeEventListener('resize', this._bandResize);
      this._bandResize = null;
    }
    this.deactivate();
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
    this._removeMaskGroundPlate();
    this._visualFieldDirector?.destroy();
    this._visualFieldDirector = null;
    if (this.attractorField) {
      this.attractorField.destroy();
      this.attractorField = null;
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
  }
}
