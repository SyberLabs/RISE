import { visualCortex } from '../visuals/visual-cortex.js';
import { MemoryCore } from '../core/memory.js';
import { AttractorField } from '../visuals/attractor.js';
import { KleeField } from '../visuals/klee-field.js';
import { escapeHtml } from '../core/sanitize.js';
import { scoreAtoms, planInterlocution } from '../core/conductor.js';

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
    this.baseWpm = this.session?.config?.wpm || 300;
    this.currentWpm = this.baseWpm;
    this.speedHudTimeout = null;

    console.log('[Chamber] Constructor - session:', this.session);
    console.log('[Chamber] Session atoms:', this.session?.atoms);
    console.log('[Chamber] First atom:', this.session?.atoms?.[0]);
    console.log('[Chamber] Auto-start:', this.autoStart);

    this.render();
    this.attachEvents();
    this.initializeDisplay();

    // Auto-start if requested (skip pre-session screen)
    if (this.autoStart) {
      setTimeout(() => {
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
            <div class="atom-display" id="atom-display"></div>
          </div>

          <!-- Speed HUD - briefly appears on WPM change -->
          <div id="chamber-speed-hud" class="speed-hud hidden">
            <span class="speed-hud-label">PACE</span>
            <span id="speed-hud-value" class="speed-hud-value">300</span>
            <span class="speed-hud-unit">WPM</span>
          </div>

          <!-- Progress indicator - bottom, subtle, thin -->
          <div class="chamber-progress">
            <div class="chamber-progress-fill" id="progress-fill" style="width: 0%"></div>
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
    const exitBtn = this.container.querySelector('#exit-btn');

    playPauseBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.togglePlayPause();
    });
    volumeBtn?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.toggleVolume();
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

    // Keyboard
    document.addEventListener('keydown', this.handleKeyboard.bind(this));

    // Player events
    if (this.player) {
      // Register native interlocution for perfect synchronicity.
      // When the player forwards a semantic signal (responsive mode),
      // it chooses generator, Klee preset, and flash sharpness; without
      // a signal this is the raw platform path.
      this.player.setInterlocutionHandler(async (duration, signal) => {
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
          await visualCortex.flash(plan.duration, plan.type || undefined, mood ? signal : undefined);
        } else {
          await visualCortex.flash(duration);
        }
      });

      this.player.on('atom', (data) => this.displayAtom(data.atom, data.index));
      this.player.on('progress', (progress) => this.updateProgress(progress));
      this.player.on('complete', () => this.onSessionComplete());
      this.player.on('state', (state) => this.onStateChange(state));
    }
  }

  handleKeyboard(e) {
    // Don't let spacebar trigger play/pause while user is typing in a field
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'TEXTAREA' || tag === 'INPUT' || document.activeElement?.isContentEditable;

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

    // Speed: Arrow keys (Up/Down) - only when NOT typing
    if (!isTyping) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.updateWpm(10);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.updateWpm(-10);
        }
    }
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

    const system = visualConfig.attractor?.system || 'aizawa';
    this.attractorField = new AttractorField(host, { system });

    console.log('[Chamber] Attractor initialized:', system);
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

    if (focals.type === 'personal' && focals.personalImage) {
      // Personal image focal
      focalContainer.innerHTML = `
        <div class="focal-personal">
          <img src="${focals.personalImage}" alt="Personal focal" class="focal-image" />
        </div>
      `;
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

  displayAtom(atom, index) {
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

    // If reading speed is fast (duration < 400ms), use instant transitions to avoid 
    // black frames where the text spends its entire display time fading in/out.
    if (atom.duration && atom.duration < 400) {
      atomDisplay.style.transition = 'none';
      atomDisplay.textContent = atom.content;

      let fontSize = '72px';
      if (atom.content.length > 20) fontSize = '56px';
      if (atom.content.length > 40) fontSize = '40px';
      if (atom.content.length > 60) fontSize = '32px';
      atomDisplay.style.fontSize = fontSize;

      this.applyLivingText(atomDisplay, index);
      atomDisplay.style.opacity = '1';
    } else {
      // Force instantaneous opacity wipe 
      atomDisplay.style.transition = 'none';
      atomDisplay.style.opacity = '0';

      // Inject new content
      atomDisplay.textContent = atom.content;
      console.log('[Chamber] Set atom content:', atom.content);

      let fontSize = '72px';
      if (atom.content.length > 20) fontSize = '56px';
      if (atom.content.length > 40) fontSize = '40px';
      if (atom.content.length > 60) fontSize = '32px';
      atomDisplay.style.fontSize = fontSize;

      this.applyLivingText(atomDisplay, index);

      // Force synchronous DOM layout calculation (reflow)
      void atomDisplay.offsetWidth;

      // Restore transition for smooth fade in
      atomDisplay.style.transition = 'opacity 150ms var(--ease-out)';
      atomDisplay.style.opacity = '1';
    }
  }

  updateProgress(progress) {
    const fill = this.container.querySelector('#progress-fill');
    const timeCurrent = this.container.querySelector('#time-current');
    const timeTotal = this.container.querySelector('#time-total');

    if (fill) {
      fill.style.width = `${progress.percent}%`;
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
      window.rise.settings.masterVolume = volume;
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

  onStateChange(data) {
    const state = data.state;
    console.log('[Chamber] Player state change:', state);

    // The Genesis field breathes with the session: pausing the text
    // pauses the pen
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

  destroy() {
    document.removeEventListener('keydown', this.handleKeyboard.bind(this));
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
  }
}
