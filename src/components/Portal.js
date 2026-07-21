/**
 * Portal Component
 * The launch screen - first encounter with R.I.S.E.
 *
 * Design principles:
 * - Darkness first, light emerges
 * - Stillness as default
 * - Sequential fade-in (sigil → title → navigation)
 * - The interface IS the first session
 */

import { getWindowAt, resolveWindowPlan } from './Sol.js';

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
    this.startSolStrip();
  }

  /**
   * The living SOL strip — the portal's heartbeat. SOL is a *when*, not
   * a place: instead of a fourth opaque card, it introduces itself with
   * the hour, the current window, and what that window will play
   * (following the user's My Day plan when set).
   */
  updateSolStrip() {
    const strip = this.container.querySelector('.portal-sol-strip');
    if (!strip) return;

    const now = new Date();
    const window = getWindowAt(now);
    const suggestion = resolveWindowPlan(window);
    const hour = now.getHours();
    const orb = hour >= 6 && hour < 18 ? '☀' : '☾';
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    strip.querySelector('.sol-strip-orb').textContent = orb;
    strip.querySelector('.sol-strip-time').textContent = time;
    strip.querySelector('.sol-strip-window').textContent = window.name;
    strip.querySelector('.sol-strip-detail').textContent = suggestion.isCustom
      ? `from your plan · ${suggestion.title}`
      : `“${window.context}”`;
    strip.setAttribute('aria-label', `Enter SOL — ${window.name}: ${suggestion.title}`);
  }

  startSolStrip() {
    this.updateSolStrip();
    this._solStripInterval = setInterval(() => {
      // The router keeps hidden instances alive — skip work until visible
      if (this.container.offsetParent === null) return;
      this.updateSolStrip();
    }, 30000);
  }

  /** Router re-entry hook — refresh the strip when the portal returns */
  update() {
    this.updateSolStrip();
  }

  render() {
    this.container.innerHTML = `
      <div class="portal" role="main">
        <!-- SyberLabs Premium Header -->
        <header class="sl-header">
          <div class="sl-header-brand">
            <span class="sl-wordmark">SyberLabs</span>
            <span class="sl-divider">·</span>
            <span class="sl-product">R.I.S.E.</span>
          </div>
          <div class="sl-header-meta">
            <span class="sl-version">v2</span>
          </div>
        </header>

        <!-- The Sigil - Center of attention -->
        <div class="portal-sigil-container" style="opacity: 0;">
          <button
            class="portal-sigil-vessel"
            aria-label="Quick access to last session"
            title="Return to last session"
          >
            <!-- Video src is deferred to prevent blocking initial render thread -->
            <video class="vessel-video" loop muted playsinline preload="metadata" disablePictureInPicture></video>
          </button>
        </div>

        <!-- Title -->
        <div class="portal-title-container" style="opacity: 0;">
          <h1 class="portal-title">R.I.S.E.</h1>
          <p class="portal-subtitle text-fog">
            Recursive Installation of Symbolic Experience
          </p>
        </div>

        <!-- Navigation -->
        <nav
          id="main-content"
          class="portal-nav nav"
          style="opacity: 0;"
          aria-label="Main navigation"
        >
          <div class="nav-primary">
            <button class="nav-item" data-nav="chamber" role="link">
              Chamber
            </button>
          </div>

          <div class="nav-secondary">
            <button class="nav-item" data-nav="atrium" role="link">
              Atrium
            </button>
            <button class="nav-item" data-nav="vault" role="link">
              Vault
            </button>
            <button class="nav-item" data-nav="library" role="link">
              Library
            </button>
            <button class="nav-item" data-nav="workshop" role="link">
              Workshop
            </button>
          </div>
        </nav>

        <!-- SOL: the portal's living strip — the hour introduces itself -->
        <button class="portal-sol-strip" data-nav="sol" style="opacity: 0;" aria-label="Enter SOL">
          <span class="sol-strip-orb" aria-hidden="true">☀</span>
          <span class="sol-strip-time font-mono"></span>
          <span class="sol-strip-body">
            <span class="sol-strip-window"></span>
            <span class="sol-strip-detail"></span>
          </span>
          <span class="sol-strip-enter" aria-hidden="true">enter ›</span>
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

    // Quick access via sigil
    const sigil = this.container.querySelector('.portal-sigil-vessel');
    if (sigil) {
      sigil.addEventListener('click', () => {
        if (window.rise?.audioEngine) {
          window.rise.audioEngine.playClick();
        }
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
            video.src = "/real_icon.mp4";
            video.play().catch(e => console.warn('Portal video playback prevented', e));
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

    const solStrip = this.container.querySelector('.portal-sol-strip');
    revealTimeout(() => {
      if (solStrip) {
        solStrip.style.transition = 'opacity 500ms var(--ease-out)';
        solStrip.style.opacity = '1';
      }
    }, 1350);

    const footer = this.container.querySelector('.portal-footer');
    revealTimeout(() => {
      footer.style.transition = 'opacity 600ms var(--ease-out)';
      footer.style.opacity = '1';
    }, 1600);
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
    clearInterval(this._solStripInterval);
    // Reveal choreography must die with the view — surviving timers
    // fired after teardown (post-suite "window is not defined") and
    // could start media work after navigation
    (this._revealTimers || []).forEach(id => clearTimeout(id));
    this._revealTimers = [];
  }
}
