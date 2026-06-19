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

export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onQuickAccess = options.onQuickAccess || (() => { });

    this.render();
    this.attachEvents();
    this.sequentialReveal();
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
            <button class="nav-item" data-nav="vault" role="link">
              Vault
            </button>
            <button class="nav-item" data-nav="library" role="link">
              Library
            </button>
            <button class="nav-item" data-nav="workshop" role="link">
              Workshop
            </button>
            <button class="nav-item" data-nav="sol" role="link">
              SOL
            </button>
          </div>
        </nav>

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

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyboard.bind(this));
  }

  handleKeyboard(e) {
    // Escape returns to Portal (this is the root, so no action)
    if (e.key === 'Escape') {
      // Already at Portal
    }
  }

  sequentialReveal() {
    // Sequential fade-in: sigil → title → navigation (~1.5s total)
    const sigilContainer = this.container.querySelector('.portal-sigil-container');
    const title = this.container.querySelector('.portal-title-container');
    const nav = this.container.querySelector('.portal-nav');
    const video = this.container.querySelector('.vessel-video');

    setTimeout(() => {
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
            setTimeout(startVideo, 200);
        }
      }
    }, 100);

    setTimeout(() => {
      title.style.transition = 'opacity 400ms var(--ease-out)';
      title.style.opacity = '1';
    }, 600);

    setTimeout(() => {
      nav.style.transition = 'opacity 400ms var(--ease-out)';
      nav.style.opacity = '1';
    }, 1100);

    const footer = this.container.querySelector('.portal-footer');
    setTimeout(() => {
      footer.style.transition = 'opacity 600ms var(--ease-out)';
      footer.style.opacity = '1';
    }, 1400);
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyboard.bind(this));
  }
}
