/**
 * Portal Component
 * The launch screen - first encounter with RISE.
 *
 * Design principles:
 * - Darkness first, light emerges
 * - Stillness as default
 * - Sequential fade-in (sigil → title → navigation)
 * - The interface IS the first session
 */


export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onQuickAccess = options.onQuickAccess || (() => { });
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

    this.render();
    this.attachEvents();
    this.sequentialReveal();
    this.syncContinue();
  }


  /** Router re-entry hook — refresh the living entries on return */
  update() {
    // Returning from a reading is precisely when this changes.
    this.syncContinue();
  }

  /**
   * Show the Continue strip only when there is genuinely something to
   * continue (Premium_Mobile_Chamber P6).
   *
   * Read off `window.rise` rather than plumbed through a constructor
   * option on purpose: the App already publishes itself there, and the
   * Portal asking a question it can answer for itself is cheaper than
   * a new prop every caller would have to remember to pass.
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
    const session = window.rise?.currentSession;
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

        <!-- The sanctuary lamp — a small constant light in the top-right
             corner, the only entrance to the Chapel. It does not
             advertise; it burns. Hover reveals a single name. -->
        <button class="portal-chapel-lamp" data-nav="chapel" style="opacity: 0;" title="The Chapel" aria-label="The Chapel">
          <span aria-hidden="true">✛</span>
          <span class="chapel-lamp-name" aria-hidden="true">The Chapel</span>
        </button>

        <!-- The Curia's door — bottom-left, quieter still than the lamp.
             The room where the visual canon is governed; a curator's
             entrance, harmless to stumble into. -->
        <button class="portal-curia-door" data-nav="curia" title="The Curia" aria-label="The Curia">
          <span aria-hidden="true">▣</span>
        </button>
        <button class="portal-scriptorium-door" data-nav="scriptorium" title="The Scriptorium"
                aria-label="The Scriptorium">
          <span aria-hidden="true">✎</span>
        </button>

        <!-- The Sigil - Center of attention.
             THE STAGE (Premium_Mobile_Chamber P1) is decoration only:
             two hairline rings and four cardinal marks that give the
             vessel something to sit in. It is display:none at every
             width above the phone, so the desktop composition — where
             the vessel is flanked by marble and needs no help — never
             renders or paints it. Static by rule: the vessel's own
             loop is the only motion the Portal is allowed. -->
        <div class="portal-sigil-container" style="opacity: 0;">
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
            <!-- Video src deferred. Not a player: suppress iOS ▶ overlay;
                 preload first frame for Low Power Mode. -->
            <video class="vessel-video" loop muted autoplay playsinline preload="auto" disablePictureInPicture></video>
          </${sigilTag}>
        </div>

        <!-- Title -->
        <div class="portal-title-container" style="opacity: 0;">
          <h1 class="portal-title">RISE</h1>
          <p class="portal-subtitle text-fog">
            Audiovisual Reader
          </p>
        </div>

        <!-- Navigation -->
        <nav
          id="main-content"
          class="portal-nav nav"
          style="opacity: 0;"
          aria-label="Main navigation"
        >
          <!-- Primary act: enter Chamber. Phone-only mark/verb/arrow
               are display:none above 640. -->
          <div class="nav-primary">
            <button class="nav-item nav-act" data-nav="keystones" role="link">
              <span class="act-mark" aria-hidden="true">✦</span><span class="act-label">Try RISE</span><span class="act-go" aria-hidden="true">→</span>
            </button>
            <button class="nav-item nav-act" data-nav="chamber" role="link">
              <span class="act-mark" aria-hidden="true">✦</span><span class="act-label"><span class="act-verb">Enter </span>Chamber</span><span class="act-go" aria-hidden="true">→</span>
            </button>
          </div>

          <!-- Room index. Glyph/line are display:none above 640. -->
          <div class="nav-secondary">
            <button class="nav-item" data-nav="vault" role="link">
              <span class="room-glyph" aria-hidden="true">◈</span><span class="room-name">Vault</span><span class="room-line">Journeys and archetypes</span>
            </button>
            <button class="nav-item" data-nav="library" role="link">
              <span class="room-glyph" aria-hidden="true">▤</span><span class="room-name">Library</span><span class="room-line">The public-domain Archive</span>
            </button>
            <button class="nav-item" data-nav="workshop" role="link">
              <span class="room-glyph" aria-hidden="true">✚</span><span class="room-name">Workshop</span><span class="room-line">Readings you compose</span>
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
        <div class="portal-footer" style="opacity: 0;">
          <div class="footer-left">
            <a href="/liminal_archive.html" class="portal-util-link" target="_blank" rel="noopener" title="The Oracular Archive">
              <span class="util-icon">◊</span> Archive
            </a>
            <button class="portal-util-link" data-action="guide" title="User Protocols">
              <span class="util-icon">□</span> Guide
            </button>
          </div>
          
          <div class="footer-right">
             <button class="portal-util-link" data-action="settings" title="Interface Settings">
              <span class="util-icon">⚙</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Navigation
    const navItems = this.container.querySelectorAll('[data-nav]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.playClick();
        }
        const destination = item.dataset.nav;
        this.onNavigate(destination);
      });
    });

    // Sigil click only when it is a button (see prefersSealOnly).
    const sigil = this.container.querySelector('button.portal-sigil-vessel');
    if (sigil) {
      sigil.addEventListener('click', () => {
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.playClick();
        }
        this.onQuickAccess();
      });
    }

    // The Continue strip is the sigil's hidden behaviour, made visible;
    // it must therefore do the identical thing rather than a second
    // implementation of it that can drift.
    const cont = this.container.querySelector('.portal-continue');
    if (cont) {
      cont.addEventListener('click', () => {
        window.rise?.audioEngine?.playClick();
        this.onQuickAccess();
      });
    }

    // Utility actions
    const utilLinks = this.container.querySelectorAll('[data-action]');
    utilLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.playClick();
        }
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

  sequentialReveal() {
    this._revealTimers = this._revealTimers || [];
    const revealTimeout = (fn, ms) => this._revealTimers.push(setTimeout(fn, ms));
    // Sequential fade-in: sigil → title → navigation (~1.5s total)
    const sigilContainer = this.container.querySelector('.portal-sigil-container');
    const title = this.container.querySelector('.portal-title-container');
    const nav = this.container.querySelector('.portal-nav');
    const video = this.container.querySelector('.vessel-video');

    revealTimeout(() => {
      sigilContainer.style.transition = 'opacity 400ms var(--ease-out)';
      sigilContainer.style.opacity = '1';
      
      // Defer video fetch and playback
      if (video) {
        // Use requestIdleCallback if available to avoid blocking main thread
        const startVideo = () => {
            // PLAY WHEN IT CAN PLAY, NOT WHEN THE SRC IS SET.
            //
            // iOS permits a muted, inline video to start without a
            // gesture — but not before it has data, and `play()` issued
            // the instant `src` is assigned rejects with an AbortError
            // that was being swallowed by the catch below. On desktop
            // the file is cached fast enough that the race is invisible;
            // on a phone it is the ordinary case, and the vessel simply
            // never moved.
            const attempt = () => video.play().catch(() => {});
            video.addEventListener('canplay', attempt, { once: true });
            video.addEventListener('loadeddata', attempt, { once: true });
            video.src = "/real_icon.mp4";
            video.load();
            attempt();
        };
        
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(startVideo, { timeout: 1000 });
        } else {
            revealTimeout(startVideo, 200);
        }
      }
    }, 100);

    revealTimeout(() => {
      title.style.transition = 'opacity 400ms var(--ease-out)';
      title.style.opacity = '1';
    }, 600);

    revealTimeout(() => {
      nav.style.transition = 'opacity 400ms var(--ease-out)';
      nav.style.opacity = '1';
    }, 1100);


    // The sanctuary lamp is lit last and quietly: the class hands
    // opacity over to CSS (the 8s breath, or stillness under
    // reduced-motion) once the inline reveal value is cleared.
    const chapelLamp = this.container.querySelector('.portal-chapel-lamp');
    revealTimeout(() => {
      if (chapelLamp) {
        chapelLamp.style.transition = 'opacity 900ms var(--ease-out)';
        chapelLamp.style.opacity = '0.34';
        this._revealTimers.push(setTimeout(() => {
          chapelLamp.style.removeProperty('opacity');
          chapelLamp.style.removeProperty('transition');
          chapelLamp.classList.add('lamp-lit');
        }, 950));
      }
    }, 1900);

    const footer = this.container.querySelector('.portal-footer');
    revealTimeout(() => {
      footer.style.transition = 'opacity 600ms var(--ease-out)';
      footer.style.opacity = '1';
    }, 1750);
  }

  activate() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.deactivate();
    // Reveal choreography must die with the view — surviving timers
    // fired after teardown (post-suite "window is not defined") and
    // could start media work after navigation
    (this._revealTimers || []).forEach(id => clearTimeout(id));
    this._revealTimers = [];
  }
}
