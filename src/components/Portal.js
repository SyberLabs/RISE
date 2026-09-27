/**
 * Portal Component
 * The launch screen - first encounter with RISE.
 *
 * Design principles:
 * - Darkness first, light emerges
 * - Stillness as default
 * - Navigation is ready at first paint; decorative media may wait
 * - The interface IS the first session
 */


import './Portal.css';
import { isJevSceneDemoPath } from '../core/jev-demo-path.js';
import { attachJevDictation } from './jev-dictation.js';

export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onQuickAccess = options.onQuickAccess || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.onLaunchJevReading = options.onLaunchJevReading || (async () => {});
    this.onLaunchJevSample = options.onLaunchJevSample || (async () => {});
    this.demoMode = options.demoMode === true;
    this.onLaunchFirstRead = options.onLaunchFirstRead || (async () => {});
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

    this.render();
    this.attachEvents();
    this.syncContinue();
  }


  /** Router re-entry hook — refresh the living entries on return */
  update() {
    const demoMode = isJevSceneDemoPath(window.location.pathname);
    if (demoMode !== this.demoMode) {
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
    }
    // Returning from a reading is precisely when this changes.
    this.syncContinue();
  }

  /**
   * Show the Continue strip only when there is genuinely something to
   * continue (Premium_Mobile_Chamber P6).
   *
   * The session is IN MEMORY ONLY. A cold load has none, so a first
   * visit shows no strip — which is correct, because a first visit has
   * nothing to resume, and is why the sigil sends that reader to the
   * Vault instead.
   */
  syncContinue() {
    const strip = this.container.querySelector('.portal-continue');
    if (!strip) return;

    // Session label: title || name (Chamber uses title; compiled journeys use name).
    const session = this.getCurrentSession();
    const named = session?.title || session?.name;
    const title = typeof named === 'string' ? named.trim() : '';
    if (!title) {
      strip.hidden = true;
      return;
    }

    strip.querySelector('.continue-title').textContent = title;
    strip.setAttribute('aria-label', `Continue reading — ${title}`);
    strip.hidden = false;
  }


  /**
   * On a phone the sigil is a seal (div), not a control.
   * iOS paints ▶ over unstarted video; cold loads have no session to resume.
   * Continue strip is the labelled resume when a session exists; pointer keeps the button.
   */
  prefersSealOnly() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 768px)').matches;
  }

  render() {
    this.stopJevDictation?.();
    const sealOnly = this.prefersSealOnly();
    const sigilTag = sealOnly ? 'div' : 'button';
    this.container.innerHTML = `
      <div class="portal" role="main">
        <!-- SyberLabs Premium Header -->
        <header class="sl-header">
          <div class="sl-header-brand">
            <span class="sl-wordmark">SyberLabs</span>
            <span class="sl-divider">·</span>
            <span class="sl-product">RISE</span>
          </div>
          <div class="sl-header-meta">
            <span class="sl-version">v2</span>
          </div>
        </header>

        <div class="portal-orbs-start">
          <button class="portal-orb portal-curia-door" data-nav="curia" title="The Curia" aria-label="The Curia">
            <span aria-hidden="true">▣</span>
          </button>
          <button class="portal-orb portal-scriptorium-door" data-nav="scriptorium" title="The Scriptorium"
                  aria-label="The Scriptorium">
            <span aria-hidden="true">✎</span>
          </button>
        </div>
        <button class="portal-orb portal-chapel-lamp" data-nav="chapel" title="The Chapel" aria-label="The Chapel">
          <span aria-hidden="true">✛</span>
        </button>

        <!-- The Sigil - Center of attention.
             THE STAGE (Premium_Mobile_Chamber P1) is decoration only:
             two hairline rings and four cardinal marks that give the
             vessel something to sit in. It is display:none at every
             width above the phone, so the desktop composition — where
             the vessel is flanked by marble and needs no help — never
             renders or paints it. Static by rule: the vessel's own
             loop is the only motion the Portal is allowed. -->
        <div class="portal-sigil-container">
          <span class="sigil-stage" aria-hidden="true">
            <span class="sigil-ring sigil-ring-outer"></span>
            <span class="sigil-ring sigil-ring-inner"></span>
            <span class="sigil-mark sigil-mark-n">⌐</span>
            <span class="sigil-mark sigil-mark-e">◊</span>
            <span class="sigil-mark sigil-mark-s">□</span>
            <span class="sigil-mark sigil-mark-w">✛</span>
          </span>
          <${sigilTag}
            class="portal-sigil-vessel${sealOnly ? ' is-seal' : ''}"
            ${sealOnly ? 'aria-hidden="true"' : `aria-label="Quick access to last session"
            title="Return to last session"`}
          >
            <!-- A PHONE GETS A PICTURE, NOT A PLAYER.
                 The vessel is decoration — tapping it opens the last session,
                 it was never a video control. But iOS paints a play glyph over
                 an unstarted video, and Low Power Mode declines to autoplay at
                 all, which no combination of muted/autoplay/playsinline and
                 hidden -webkit-media-controls can overrule. So on a phone the
                 element is simply an image: nothing to start, nothing to ask,
                 and the 1.7 MB the video costs is never fetched.
                 Desktop keeps the moving vessel, where it plays unasked. -->
            ${sealOnly
              ? '<img class="vessel-still" src="/rise_mobile_icon.webp" alt="" decoding="async" draggable="false">'
              : '<video class="vessel-video" loop muted autoplay playsinline preload="auto" disablePictureInPicture></video>'}
          </${sigilTag}>
        </div>

        <button class="portal-first-read" type="button">
          <span class="portal-first-read-title">Experience 30 seconds <span aria-hidden="true">→</span></span>
          <span class="portal-first-read-source">Meditations · Marcus Aurelius</span>
        </button>

        <!-- The reading request and existing rooms remain available below. -->
        <div class="portal-title-container">
          <p class="portal-jev-eyebrow">${this.demoMode ? 'JEV SCENE SAMPLE' : 'READ WITH JEV'}</p>
          <h1 class="portal-title">${this.demoMode ? 'Make the scene respond.' : 'What would you like to read?'}</h1>
          <p class="portal-subtitle text-fog">${this.demoMode
            ? 'Read a released passage from Middlemarch, then bring its next visual scene forward while the words keep moving.'
            : 'Tell Jev what you want. It will choose an existing reading and shape the experience.'}</p>
        </div>

        ${this.demoMode ? `<div class="portal-jev-form" id="portal-jev-demo">
          <p class="portal-jev-hint">This is a fixed sample preset of choices Jev may make. No live Jev request is made here.</p>
          <p class="portal-jev-hint">Source: <em>Middlemarch</em> by George Eliot ·
            <a href="https://standardebooks.org/ebooks/george-eliot/middlemarch" target="_blank" rel="noopener noreferrer">Standard Ebooks edition</a></p>
          <button class="portal-jev-submit" id="jev-scene-demo-start" type="button">Start sample reading <span aria-hidden="true">→</span></button>
          <a class="portal-jev-demo-live" href="/">Ask Jev live for a personal reading</a>
          <p class="portal-jev-hint" id="jev-scene-demo-status" role="status" aria-live="polite"></p>
        </div>` : `<form class="portal-jev-form" id="portal-jev-form">
          <label class="portal-jev-label" for="portal-jev-intent">Your reading request</label>
          <textarea id="portal-jev-intent" name="intent" rows="2" maxlength="240" required
            placeholder="I want something reflective, slow, quiet, with gentle visuals…"></textarea>
          <div class="portal-jev-voice-row">
            <button class="portal-jev-dictate" data-jev-dictate type="button" aria-label="Speak your Jev request" aria-pressed="false">🎙 Speak</button>
            <span data-jev-dictation-status role="status" aria-live="polite"></span>
          </div>
          <p class="portal-jev-voice-note">Voice input may use your browser’s speech service. Review the text before asking Jev.</p>
          <button class="portal-jev-submit" type="submit">Ask Jev and read <span aria-hidden="true">→</span></button>
          <p class="portal-jev-hint" id="portal-jev-hint" role="status" aria-live="polite">Jev chooses from the released Library and sets the Chamber in one request.</p>
        </form>`}

        <a class="portal-sequence-preview" href="/sequences/">
          <span><strong>Try short sequences</strong><small>Three original readings · feedback stays on your device</small></span>
          <span aria-hidden="true">→</span>
        </a>

        <!-- Navigation -->
        <nav
          id="main-content"
          class="portal-nav nav"
          aria-label="Main navigation"
        >
          <!-- Primary act: Chamber. Phone-only mark/verb/arrow are
               display:none above 640. Try RISE is the Keystones door. -->
          <div class="nav-primary">
            <button class="nav-item nav-act" data-nav="chamber">
              <span class="act-mark" aria-hidden="true">✦</span><span class="act-label"><span class="act-verb">Enter </span>Chamber</span><span class="act-go" aria-hidden="true">→</span>
            </button>
          </div>

          <!-- Room index. Glyph/line are display:none above 640. -->
          <div class="nav-secondary">
            <button class="nav-item" data-nav="vault">
              <span class="room-glyph" aria-hidden="true">◈</span><span class="room-name">Vault</span><span class="room-line">Sequences</span>
            </button>
            <button class="nav-item" data-nav="library">
              <span class="room-glyph" aria-hidden="true">▤</span><span class="room-name">Library</span><span class="room-line">The public-domain Archive</span>
            </button>
            <button class="nav-item" data-nav="workshop">
              <span class="room-glyph" aria-hidden="true">✚</span><span class="room-name">Workshop</span><span class="room-line">Readings you compose</span>
            </button>
            <button class="nav-try" type="button" data-nav="keystones"
                    aria-label="Try RISE: explore three canonical sample readings" title="Three canonical sample readings">
              <span class="try-mark" aria-hidden="true">✦</span><span class="try-label">Try RISE</span>
            </button>
          </div>
        </nav>

        <!-- BOTH THRESHOLDS ARE GONE. The Atrium and the Solarium each
             stood beside the sigil; the rooms went and the doors with them,
             and a Portal that offered nine ways in now offers seven. A door
             is cheap to add back when there is a room behind it. -->

        <!-- Continue: title only (no elapsed progress — session is in-memory).
             Hidden when there is nothing to resume. -->
        <button class="portal-continue" data-action="continue" hidden>
          <span class="continue-mark" aria-hidden="true">↺</span>
          <span class="continue-text">
            <span class="continue-label">Continue</span>
            <span class="continue-title"></span>
          </span>
          <span class="continue-go" aria-hidden="true">→</span>
        </button>

        <!-- Portal Footer - Heritage & Onboarding -->
        <div class="portal-footer">
          <div class="footer-left">
            <a href="/liminal_archive.html" class="portal-util-link" target="_blank" rel="noopener" title="The Oracular Archive">
              <span class="util-icon">◊</span> Archive
            </a>
            <button class="portal-util-link" data-action="guide" title="User Protocols">
              <span class="util-icon">□</span> Guide
            </button>
          </div>
          
          <div class="footer-right">
            <!-- Conspicuously posted, which is the standard CalOPPA sets and
                 the reason these sit on the Portal rather than inside a room.
                 Generated from PRIVACY.md and TERMS.md by build-legal.mjs. -->
            <a href="/privacy.html" class="portal-util-link portal-legal-link" title="Privacy Policy">Privacy</a>
            <a href="/terms.html" class="portal-util-link portal-legal-link" title="Terms of Use">Terms</a>
            <button class="portal-util-link" data-action="settings" aria-label="Settings" title="Settings">
              <span class="util-icon">⚙</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const firstRead = this.container.querySelector('.portal-first-read');
    firstRead.addEventListener('click', async () => {
      if (firstRead.disabled) return;
      firstRead.disabled = true;
      this.getAudioEngine()?.playClick();
      try {
        await this.onLaunchFirstRead();
      } finally {
        firstRead.disabled = false;
      }
    });

    const form = this.container.querySelector('#portal-jev-form');
    if (form) this.stopJevDictation = attachJevDictation(form);
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const intent = form.querySelector('#portal-jev-intent').value.trim();
      if (intent.length < 3 || intent.length > 240) {
        form.querySelector('#portal-jev-intent').focus();
        return;
      }
      const submit = form.querySelector('.portal-jev-submit');
      const hint = form.querySelector('#portal-jev-hint');
      if (submit.disabled) return;
      submit.disabled = true;
      hint.textContent = 'Jev is choosing your reading…';
      this.getAudioEngine()?.playClick();
      try {
        const response = await fetch('/api/jev-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, schemaVersion: 2 })
        });
        const decision = await response.json();
        if (!response.ok) throw new Error(decision.error?.message || 'Jev is unavailable.');
        await this.onLaunchJevReading(decision);
      } catch (error) {
        hint.textContent = error.message || 'The reading could not be prepared. Please try again.';
      } finally {
        submit.disabled = false;
      }
    });

    const sample = this.container.querySelector('#jev-scene-demo-start');
    sample?.addEventListener('click', async () => {
      if (sample.disabled) return;
      sample.disabled = true;
      const status = this.container.querySelector('#jev-scene-demo-status');
      status.textContent = 'Preparing the released reading…';
      try {
        await this.onLaunchJevSample();
      } catch (error) {
        status.textContent = error.message || 'The sample could not be prepared.';
      } finally {
        sample.disabled = false;
      }
    });

    // Navigation
    const navItems = this.container.querySelectorAll('[data-nav]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        const destination = item.dataset.nav;
        this.onNavigate(destination);
      });
    });

    // Sigil click only when it is a button (see prefersSealOnly).
    const sigil = this.container.querySelector('button.portal-sigil-vessel');
    if (sigil) {
      sigil.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.onQuickAccess();
      });
    }

    // Continue resumes the compiled reading. The sigil remains quick access
    // to the editable Chamber setup.
    const cont = this.container.querySelector('.portal-continue');
    if (cont) {
      cont.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.onNavigate('chamber-session', this.getCurrentSession());
      });
    }

    // Utility actions
    const utilLinks = this.container.querySelectorAll('[data-action]');
    utilLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        const action = link.dataset.action;
        if (action === 'guide') {
          // Trigger Guide component (will be implemented in app.js listener or here)
          const event = new CustomEvent('rise-open-guide');
          window.dispatchEvent(event);
        } else if (action === 'settings') {
          const event = new CustomEvent('rise-open-settings');
          window.dispatchEvent(event);
        }
      });
    });

  }

  handleKeyboard(e) {
    // Escape returns to Portal (this is the root, so no action)
    if (e.key === 'Escape') {
      // Already at Portal
    }
  }

  startVesselMedia() {
    this._mediaTimers = this._mediaTimers || [];
    const video = this.container.querySelector('.vessel-video');

    // The controls are ready at first paint; only decorative media waits.
    if (!video || !this._active) return;
    const startVideo = () => {
      // The idle callback may outlive cancellation. Never fetch or play
      // media after the route has become inactive or its node was removed.
      if (!this._active || !video.isConnected) return;
      // PLAY WHEN IT CAN PLAY, NOT WHEN THE SRC IS SET.
      const attempt = () => video.play().catch(() => {});
      if (!video.hasAttribute('src')) {
        video.addEventListener('canplay', attempt, { once: true });
        video.addEventListener('loadeddata', attempt, { once: true });
        video.src = '/real_icon.mp4';
        video.load();
      }
      attempt();
    };

    if ('requestIdleCallback' in window) {
      this._idleHandle = window.requestIdleCallback(() => {
        this._idleHandle = null;
        startVideo();
      }, { timeout: 1000 });
    } else {
      this._mediaTimers.push(setTimeout(startVideo, 200));
    }
  }

  activate() {
    if (this._active) return;
    this._active = true;
    if (!this.stopJevDictation) {
      const form = this.container.querySelector('#portal-jev-form');
      if (form) this.stopJevDictation = attachJevDictation(form);
    }
    document.addEventListener('keydown', this.boundKeyboardHandler);
    this.startVesselMedia();
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    this.stopJevDictation?.();
    this.stopJevDictation = null;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
    (this._mediaTimers || []).forEach(id => clearTimeout(id));
    this._mediaTimers = [];
    if (this._idleHandle != null) {
      window.cancelIdleCallback?.(this._idleHandle);
      this._idleHandle = null;
    }
    this.container.querySelector('.vessel-video')?.pause();
  }

  destroy() {
    this.stopJevDictation?.();
    this.deactivate();
  }
}
