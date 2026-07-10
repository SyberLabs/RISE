import { visualCortex } from '../visuals/visual-cortex.js';
import { escapeHtml } from '../core/sanitize.js';

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

export class VoyageChamber {
  constructor(container, options = {}) {
    this.container = container;
    this.session = options.session;
    this.player = options.player;
    this.displayMode = options.displayMode || 'focal'; // focal, chamber, orbital
    this.autoStart = options.autoStart !== undefined ? options.autoStart : false;
    this.onExit = options.onExit || (() => {});

    this.controlsTimeout = null;
    this.controlsVisible = false;

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
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        if (this.player) {
          this.player.play();
        }
      }, 100);
    }
  }

  update(data = {}) {
    console.log('[VoyageChamber] Updating with new session data', data);
    
    // Clean up old player if needed
    if (this.player && this.player.state === 'playing') {
      this.player.stop();
    }
    
    this.session = data.session || data;
    this.player = data.player || this.player;

    this.render();
    this.attachEvents();
    this.initializeDisplay();

    if (this.autoStart) {
      setTimeout(() => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        if (this.player) {
          this.player.play();
        }
      }, 100);
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
              <span class="time-separator">/</span>
              <span id="time-total">0:00</span>
            </span>

            <button class="control-btn" id="exit-btn" aria-label="Exit" title="Escape">
              <span class="icon">✕</span>
            </button>
          </div>
        </div>

        <!-- Post-Session State -->
        <div class="chamber-post-session" id="chamber-post" style="display: none;">
          <div class="post-sigil sigil" style="color: var(--color-growth);">
            ◊
          </div>

          <h2 class="post-title text-light">Guided Ingestion Complete</h2>

          <div class="post-meta text-fog font-mono">
            <span id="post-duration">0:00</span>
            <span class="meta-separator">·</span>
            <span id="post-atoms">0 atoms</span>
          </div>

          <div class="post-actions" style="margin-top: 2rem;">
            <button class="btn-primary" id="post-synthesis">
              Proceed to Synthesis
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Pre-session
    const backBtn = this.container.querySelector('#chamber-back');
    const beginBtn = this.container.querySelector('#chamber-begin');

    backBtn?.addEventListener('click', () => this.onExit('back'));
    beginBtn?.addEventListener('click', () => this.beginSession());

    // In-session controls
    const playPauseBtn = this.container.querySelector('#play-pause-btn');
    const volumeBtn = this.container.querySelector('#volume-btn');
    const exitBtn = this.container.querySelector('#exit-btn');

    playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
    volumeBtn?.addEventListener('click', () => this.toggleVolume());
    exitBtn?.addEventListener('click', () => this.exitSession());

    // Post-session
    const synthesisBtn = this.container.querySelector('#post-synthesis');
    synthesisBtn?.addEventListener('click', () => this.onExit('synthesis'));

    // Mouse movement for hidden controls
    const display = this.container.querySelector('#chamber-display');
    display?.addEventListener('mousemove', () => this.showControls());

    // Keyboard
    document.addEventListener('keydown', this.handleKeyboard.bind(this));

    // Player events
    if (this.player) {
      // Register native interlocution for perfect synchronicity
      this.player.setInterlocutionHandler(async (duration) => {
        await visualCortex.flash(duration);
      });

      this.player.on('atom', (data) => this.displayAtom(data.atom, data.index));
      this.player.on('progress', (progress) => this.updateProgress(progress));
      this.player.on('complete', () => this.onSessionComplete());
      this.player.on('state', (state) => this.onStateChange(state));
    }
  }

  handleKeyboard(e) {
    // Spacebar: play/pause
    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePlayPause();
    }

    // Escape: exit with confirmation
    if (e.key === 'Escape') {
      this.exitSession();
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
      }
    }, 400);
  }

  initializeDisplay() {
    // Mode-specific initialization
    const field = this.container.querySelector('#chamber-field');
    if (!field) return;

    field.classList.add(`chamber-field-${this.displayMode}`);
  }

  displayAtom(atom, index) {
    console.log('[Chamber] displayAtom called with:', atom);
    const atomDisplay = this.container.querySelector('#atom-display');
    if (!atomDisplay) {
      console.error('[Chamber] No atom-display element found!');
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

    const playIcon = this.container.querySelector('#play-icon');
    const pauseIcon = this.container.querySelector('#pause-icon');

    if (this.player.state === 'playing') {
      this.player.pause();
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    } else {
      this.player.play();
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    }
  }

  toggleVolume() {
    // TODO: Implement volume control modal
    console.log('Volume control');
  }

  showControls() {
    const controls = this.container.querySelector('#chamber-controls');
    if (!controls) return;

    // Clear existing timeout
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }

    // Show controls
    controls.style.transition = 'opacity 200ms var(--ease-out)';
    controls.style.opacity = '1';
    this.controlsVisible = true;

    // Hide after 2s of no movement
    this.controlsTimeout = setTimeout(() => {
      controls.style.transition = 'opacity 400ms var(--ease-in)';
      controls.style.opacity = '0';
      this.controlsVisible = false;
    }, 2000);
  }

  exitSession() {
    // Confirm if session is active
    if (this.player && this.player.state === 'playing') {
      const confirm = window.confirm('Exit session? Progress will not be saved.');
      if (!confirm) return;
    }

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

    setTimeout(() => {
      display.style.display = 'none';

      // Update post-session stats
      const duration = this.container.querySelector('#post-duration');
      const atoms = this.container.querySelector('#post-atoms');

      if (duration && this.session) {
        duration.textContent = this.formatDuration(this.session.duration);
      }

      if (atoms && this.session) {
        atoms.textContent = `${this.session.atoms?.length || 0} atoms`;
      }

      // Show post-session
      postSession.style.display = 'flex';
      postSession.style.opacity = '0';
      postSession.style.transition = 'opacity 400ms var(--ease-out)';
      setTimeout(() => {
        postSession.style.opacity = '1';
      }, 50);
    }, 400);

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  onStateChange(state) {
    // Handle player state changes
    console.log('Player state:', state);
  }

  proceedSynthesis() {
    this.onExit('synthesis');
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
  }
}
