import { visualCortex } from '../visuals/visual-cortex.js';
import { parsePageCollectionId, sampleWorkEngine } from '../visuals/work-engines.js';
import { TIME_SCALE as WORK_ENGINE_TIME_SCALE } from '../visuals/work-engine-field.js';
import { MemoryCore } from '../core/memory.js';
import { AttractorField } from '../visuals/attractor.js';
import { KleeField } from '../visuals/klee-field.js';
import { escapeHtml } from '../core/sanitize.js';
// The reveal and its emphasis notation are pure logic — no DOM, no
// audio — so they live in core and are tested without a browser.
import {
  splitWords, stripEmphasis, revealBudget, revealSchedule
} from '../core/recitation.js';
import { Voice } from '../audio/voice.js';
import { scoreAtoms, planInterlocution } from '../core/conductor.js';
import { VisualScheduleController } from '../core/visual-scheduler.js';
import {
  MovementScheduleController,
  AudioScheduleController
} from '../core/journey-schedulers.js';

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

    this.controlsTimeout = null;
    this.controlsVisible = false;
    this.attractorField = null;
    this.kleeField = null;
    // Page Mode (PAGE-MODE-SPEC): the spatial projection, mounted lazily
    // on demand. Null until the reader opens it; nothing is paid before.
    this.pageReader = null;
    this.pageModeActive = false;

    // Recitation (RECITATION-SPEC): text arrives over a short duration
    // rather than appearing whole. Off unless the reading asks for it,
    // so an ordinary session pays nothing — no spans, no timers, and
    // the same textContent path the Chamber has always used.
    this.recitationEnabled = this.session?.recitation?.enabled === true;
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
    const program = this.session?.visualProgram;
    if (program && Array.isArray(program.segments) && program.segments.length) {
      this._visualSchedule = new VisualScheduleController(
        program,
        (cue, meta) => visualCortex.applyCue(cue, meta)
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
        { enabled: true }
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
    this.attachEvents();
    this.initializeDisplay();

    // A SPATIAL reading opens as a page rather than playing as a stream
    // (SPATIAL-CHAMBER-SPEC §3). The session is identical in every other
    // field; only the medium differs. The stream stays available behind
    // it — the in-session toggle returns to it at any time.
    //
    // PARKED SEAM — read before changing the visual-init path. Nothing in
    // the UI currently sets `projection` to 'page': the orbital's
    // two-choice threshold was built, then withdrawn pending the real
    // Spatial Chamber, so in production this branch never runs and every
    // session is 'stream'. The plumbing is kept deliberately (config
    // default → beginSession payload → Session model → here), normalized
    // so an unknown value is always 'stream', and it is exercised only by
    // e2e/page-suspend.spec.js. Treat that test as the contract: if you
    // change how visuals initialise, run it, because it is the only thing
    // guarding this path from silent rot.
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
            <div class="atom-display" id="atom-display"></div>
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

            ${this.hasRhythmicVisuals ? `
              <button class="control-btn rhythmic-visuals-toggle" id="visuals-toggle-btn"
                type="button" aria-pressed="true" aria-label="Disable rhythmic visuals"
                title="Disable rhythmic visuals">
                <span class="icon" aria-hidden="true">&#9670;</span>
                <span class="control-label">Visuals</span>
              </button>
            ` : ''}

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

            <button class="control-btn" id="exit-btn" aria-label="Exit" title="Escape">
              <span class="icon">✕</span>
            </button>
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
    const exitBtn = this.container.querySelector('#exit-btn');

    playPauseBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.togglePlayPause();
    });
    volumeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.toggleVolume();
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
    exitBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.exitSession();
    });

    // Post-session (Choice and Synthesis phase)
    const returnBtn = this.container.querySelector('#post-return-chamber');
    const recursionBtn = this.container.querySelector('#post-recursion');
    const sealBtn = this.container.querySelector('#post-seal');
    const closeBtn = this.container.querySelector('#post-close');

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
    // Hide pre-session, show display
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

      // Start player
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
    if (visualConfig.interlocution?.presentation !== 'continuous') return;

    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    field.classList.add('chamber-field-stream');

    const host = document.createElement('div');
    host.className = 'chamber-continuous-field';
    host.id = 'chamber-continuous-field';

    const atomDisplay = field.querySelector('#atom-display');
    if (atomDisplay) {
      field.insertBefore(host, atomDisplay);
    } else {
      field.appendChild(host);
    }

    // Glass tile on by default — the text must stay legible over imagery
    // (the field's whole reason to exist is a presence behind the reading).
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false) {
      atomDisplay.classList.add('glass-tile');
    }

    visualCortex.setContinuousFieldHost(host);
    console.log('[Chamber] Continuous Field (Gallery) host mounted');
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
    if (atomDisplay && visualConfig.interlocution?.streamGlass !== false) {
      atomDisplay.classList.add('glass-tile');
    }
  }

  /**
   * Genesis ("Motion Klee"): a Klee composition grows continuously around
   * the constant token stream — no flashes, no interruption. The text sits
   * on a glass panel (see Chamber.css) for readability over the drawing.
   */
  initializeGenesis() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'genesis') return;

    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    field.classList.add('chamber-field-genesis');

    const host = document.createElement('div');
    host.className = 'chamber-genesis';
    host.id = 'chamber-genesis';

    const atomDisplay = field.querySelector('#atom-display');
    if (atomDisplay) {
      field.insertBefore(host, atomDisplay);
    } else {
      field.appendChild(host);
    }

    // Glass tile is on by default; sparse compositions may prefer bare text
    if (atomDisplay && visualConfig.genesis?.glass !== false) {
      atomDisplay.classList.add('glass-tile');
    }

    const preset = visualConfig.genesis?.preset || 'random';
    this.kleeField = new KleeField(host, { preset });

    console.log('[Chamber] Genesis field initialized:', preset);
  }

  /**
   * Initialize persistent strange-attractor field
   * A continuous chaotic filament orbiting the centered text stream
   */
  initializeAttractor() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'attractor') return;

    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    const host = document.createElement('div');
    host.className = 'chamber-attractor';
    host.id = 'chamber-attractor';

    // Insert attractor before atom display so it sits behind the text
    const atomDisplay = field.querySelector('#atom-display');
    if (atomDisplay) {
      field.insertBefore(host, atomDisplay);
    } else {
      field.appendChild(host);
    }

    const attractor = visualConfig.attractor || {};
    const system = attractor.system || 'aizawa';
    this.attractorField = new AttractorField(host, {
      system,
      palette: attractor.palette,
      form: attractor.form
    });

    console.log('[Chamber] Attractor initialized:', system, attractor.palette || 'white');
  }

  /**
   * Initialize persistent focal point for neurosensitive-friendly viewing
   */
  initializeFocal() {
    const visualConfig = this.session?.visualConfig;
    if (!visualConfig || visualConfig.visualMode !== 'focals') return;

    const focals = visualConfig.focals || {};
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    // Create focal container
    const focalContainer = document.createElement('div');
    focalContainer.className = 'chamber-focal';
    focalContainer.id = 'chamber-focal';

    if (focals.type === 'rose') {
      // ROSA MYSTICA — the Chapel's procedural rose window, held as a
      // persistent field behind the reading (the attractor's
      // precedent). Deterministic under its seed; shimmer stills
      // under reduced-motion; a lost GL context yields stillness.
      this.initializeRoseFocal(focalContainer, focals);
    } else if (focals.type === 'icon' && focals.iconId) {
      // Chapel icon focal — a pinned, attributed sacred image rendered
      // as an icon is displayed: centered, unhurried, warm low
      // vignette. No semantic response, no motion on the image itself
      // (an icon is written, not animated). If the image fails to
      // load, the focal falls back to stillness — the container stays
      // empty rather than showing anything else.
      this.initializeIconFocal(focalContainer, focals.iconId);
    } else if (focals.type === 'personal' && focals.personalImage) {
      // Personal image focal
      focalContainer.innerHTML = `
        <div class="focal-personal">
          <img src="${focals.personalImage}" alt="Personal focal" class="focal-image" />
        </div>
      `;
    } else if (focals.standardGlyph === 'rose') {
      // ROSA MYSTICA as a standard focal — the rose left the Chapel
      // and joined the glyph grid. Outside chapel launches (which
      // carry deterministic per-book seeds) each session draws its
      // own window; the substyle (vitrum/verbum) rides on roseMode.
      this.initializeRoseFocal(focalContainer, {
        petala: focals.petala || 12,
        seed: focals.seed, // undefined → the engine seeds itself
        roseMode: focals.roseMode
      });
    } else {
      // Standard glyph focal
      const glyphData = this.getFocalGlyph(focals.standardGlyph || 'breath');
      focalContainer.innerHTML = `
        <div class="focal-glyph ${glyphData.dynamic ? 'focal-dynamic' : ''}">
          <span class="focal-icon">${glyphData.icon}</span>
        </div>
      `;
    }

    // Insert focal before atom display so it's behind the text
    const atomDisplay = field.querySelector('#atom-display');
    if (atomDisplay) {
      field.insertBefore(focalContainer, atomDisplay);
    } else {
      field.appendChild(focalContainer);
    }

    console.log('[Chamber] Focal initialized:', focals);
  }

  /**
   * Mount the ROSA MYSTICA rose window as a persistent focal field.
   * Lazy import keeps the engine out of non-Chapel graphs; any
   * failure yields stillness.
   */
  async initializeRoseFocal(focalContainer, focals) {
    try {
      const { RosaMystica } = await import('../visuals/rosa-mystica.js');
      if (!this.container.contains(focalContainer)) return;
      const host = document.createElement('div');
      host.className = 'focal-rose';
      focalContainer.appendChild(host);
      this.rosaField = new RosaMystica(host, {
        petala: focals.petala,
        seed: focals.seed,
        mode: focals.roseMode
      });
      console.log('[Chamber] Rosa Mystica initialized:', this.rosaField.petala, 'petala,',
        this.rosaField.mode, '· OPVS', this.rosaField.seed.toString(16).toUpperCase());
    } catch (e) {
      console.warn('[Chamber] Rosa Mystica unavailable:', e);
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
    const shown = stripEmphasis(content).length;
    let scale = 1;
    if (shown > 20) scale = 56 / 72;
    if (shown > 40) scale = 40 / 72;
    if (shown > 60) scale = 32 / 72;
    atomDisplay.style.removeProperty('font-size');
    atomDisplay.style.setProperty('--atom-scale', String(scale));
  }

  applyLivingText(atomDisplay, index) {
    if (!this.semanticTrack) return;
    const sig = this.semanticTrack[index];
    if (!sig) return;

    // Optional per-session intensity (0..1); default full strength
    const intensity = this.session?.visualConfig?.livingText?.intensity ?? 1;

    // Neutral matches --color-light so v=0 is indistinguishable from raw
    const NEUTRAL = [232, 232, 236];
    const WARM = [255, 208, 130];   // +1 valence — clear amber
    const COOL = [140, 172, 255];   // -1 valence — clear blue-violet

    // Smoothing compresses valence into roughly ±0.4, so apply a saturating
    // gain: tanh(2.6·|v|) puts a typical ±0.25 passage ~57% toward its pole.
    const pole = sig.valence >= 0 ? WARM : COOL;
    const t = Math.tanh(Math.abs(sig.valence) * 2.6) * intensity;
    const r = Math.round(NEUTRAL[0] + (pole[0] - NEUTRAL[0]) * t);
    const g = Math.round(NEUTRAL[1] + (pole[1] - NEUTRAL[1]) * t);
    const b = Math.round(NEUTRAL[2] + (pole[2] - NEUTRAL[2]) * t);

    atomDisplay.style.color = `rgb(${r}, ${g}, ${b})`;

    const glowRadius = 8 + sig.arousal * 40 * intensity;
    const glowAlpha = 0.15 + sig.arousal * 0.45 * intensity;
    atomDisplay.style.textShadow = `0 0 ${glowRadius.toFixed(0)}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(3)})`;
  }

  displayAtom(atom, index, { concealed = false, spoken = null } = {}) {
    console.log('[Chamber] displayAtom called with:', atom);
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) {
      console.error('[Chamber] No atom-display element found!');
      return;
    }

    // Genesis field follows the passage's mood when Living Text has a track
    if (this.kleeField && this.semanticTrack) {
      this.kleeField.setSignal(this.semanticTrack[index] || null);
    }

    // Empty atoms (paragraph breaks, pause markers) are silence, not frames:
    // render nothing and drop opacity so no residue — like the glass tile
    // collapsing into a caret-like slab — ever pulses between tokens.
    if (!atom.content || !atom.content.trim()) {
      atomDisplay.style.transition = 'opacity 150ms var(--ease-out)';
      atomDisplay.style.opacity = '0';
      atomDisplay.textContent = '';
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
      const deferReveal = concealed && this.recitationEnabled && !reducedMotion;
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
      const budget = this.recitationEnabled
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

    // PAGE AUTHORITY (PAGE-MODE-SPEC §4). While the Page is open it is
    // the reading, and the Stream must not be startable behind it — by
    // Space, by the Play button, or by anything else routed here. Without
    // this the hidden stream advances atoms, resumes audio, fires visual
    // cues over the page, and can complete the session while the reader
    // is studying. Space is the sharpest case: on a page it should
    // scroll, and it was instead starting an invisible stream.
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
      this._resumeTemporalVisuals();
      return false;
    }

    // The temporal presenters stop too. `visibility: hidden` only stops
    // PAINTING — the Gallery's cadence clock, Genesis's growth loop, and
    // the attractor's rAF keep running behind the page, contradicting the
    // Page's "no advance clock" principle and burning CPU/GPU/network for
    // imagery no one can see (red-team #4).
    this._suspendTemporalVisuals();
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
      this.pageReader.render();
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
    if (this._temporalSuspended) return;
    this._temporalSuspended = {
      gallery: false,
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

    // Get current volume from app settings or default
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

    // Attach events
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

    // Close on click outside
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

    this.currentWpm = Math.max(50, Math.min(1000, this.currentWpm + delta));
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
  handleEscape() {
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
    // Show custom confirmation modal
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
    // Stop player
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
    if (state === 'paused' || state === 'idle') this._audioSchedule?.silence();

    // The Genesis field breathes with the session: pausing the text
    // pauses the pen
    // A paused reading is silent. The voice speaks one atom at a time
    // and cannot be resumed mid-phrase, so pausing stops it outright —
    // the next atom speaks from its beginning. Stopping also restores
    // the ducked music, which would otherwise stay down while paused.
    if (state === 'paused' || state === 'idle') this.voice?.stop();

    if (this.kleeField) {
      if (state === 'paused') this.kleeField.pause();
      else if (state === 'playing') this.kleeField.resume();
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

  destroy() {
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
  }
}
