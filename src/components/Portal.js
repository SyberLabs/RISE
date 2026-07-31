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
    this.startAtriumDoor();
  }

  /**
   * The Atrium doorway's living detail — today's featured sequence.
   * The corpus metadata is a separate lazy chunk (shared with the
   * Atrium view, so this also warms it); the door renders immediately
   * with static copy and deepens when the chunk arrives at idle.
   * Only launchable sequences are ever featured.
   */
  startAtriumDoor() {
    // The pavilion keeps a simple, timeless caption — "philosophy &
    // history" — rather than deepening into today's featured sequence.
    // The hook is retained (update() calls it) as a harmless no-op so the
    // caption stays constant across router re-entries.
    this._populateAtriumDoor = () => {};
  }

  /**
   * The living SOL strip — the portal's heartbeat. SOL is a *when*, not
   * a place: instead of a fourth opaque card, it introduces itself with
   * the hour, the current window, and what that window will play
   * (following the user's My Day plan when set).
   */
  updateSolStrip() {
    const strip = this.container.querySelector('.portal-arch-sol');
    if (!strip) return;

    const now = new Date();
    const window = getWindowAt(now);
    const suggestion = resolveWindowPlan(window);
    const hour = now.getHours();
    // The same 6–18 boundary the SOL orb has always used decides whether
    // the arch shows the daylit Earth or the lamplit night side.
    const isDay = hour >= 6 && hour < 18;
    const orb = isDay ? '☀' : '☾';
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    strip.querySelector('.sol-strip-orb').textContent = orb;
    strip.querySelector('.sol-strip-time').textContent = time;
    strip.querySelector('.sol-strip-window').textContent = window.name;
    strip.querySelector('.sol-strip-detail').textContent = suggestion.isCustom
      ? `from your plan · ${suggestion.title}`
      : window.name;
    strip.setAttribute('aria-label', `Enter the Solarium — ${window.name}: ${suggestion.title}`);

    // The Earth turns with the day. Swap the source only when the phase
    // actually changes, so we never restart a playing loop needlessly.
    this._syncEarthPhase(strip, isDay);
  }

  /**
   * Point the SOL arch's Earth video at the day or night source. The video
   * is lazy: it has no src until the arch is revealed, and it respects
   * reduced-motion by holding a still first frame rather than looping.
   */
  _syncEarthPhase(strip, isDay) {
    const video = strip.querySelector('.arch-earth-video');
    if (!video) return;
    // Nothing loads until the arch is armed at idle — but do not record the
    // phase yet, so the arming pass still recognises work to do.
    if (!this._earthArmed) return;
    const phase = isDay ? 'day' : 'night';
    if (video.dataset.phase === phase && video.src) return;
    video.dataset.phase = phase;
    video.src = isDay ? '/portal/earth-day.mp4' : '/portal/earth-night.mp4';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      video.removeAttribute('loop');
      // hold the first frame — a still Earth, no motion
      video.addEventListener('loadeddata', () => { try { video.pause(); } catch {} }, { once: true });
    }
    video.play?.().catch(() => { /* autoplay blocked until interaction; the still poster stands */ });
  }

  startSolStrip() {
    this.updateSolStrip();
    this._solStripInterval = setInterval(() => {
      // The router keeps hidden instances alive — skip work until visible
      if (this.container.offsetParent === null) return;
      this.updateSolStrip();
    }, 30000);
  }

  /** Router re-entry hook — refresh the living entries on return */
  update() {
    this.updateSolStrip();
    // The featured sequence rolls at midnight; module is cached by now
    this._populateAtriumDoor?.();
  }

  /**
   * A classical marble pavilion (aedicula), authored at its natural
   * 420×560 and scaled to the margin by CSS. Ported from the creator's
   * Archway.dc design: a domed roof + finial, an entablature bearing the
   * NAME, fluted columns with volute capitals framing an arched niche
   * (which holds `nicheInner` — the living window), on a stepped base.
   * `plinthInner` is the caption beneath.
   */
  _gazeboMarkup(name, nicheInner, plinthInner) {
    return `
      <span class="gazebo" aria-hidden="true">
        <span class="gazebo-stage">
          <span class="gz-shadow"></span>
          <span class="gz-finial-spire"></span>
          <span class="gz-finial-orb"></span>
          <span class="gz-dome"><span class="gz-dome-rays"></span></span>
          <span class="gz-architrave"></span>
          <span class="gz-frieze"><span class="gz-name">${name}</span></span>
          <span class="gz-cornice"></span>
          <span class="gz-niche-back"></span>
          <span class="gz-niche">${nicheInner}</span>
          <span class="gz-keystone"></span>
          <span class="gz-volutes">
            <svg viewBox="0 0 420 560" fill="none">
              <defs><linearGradient id="gzSilver" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="oklch(96% 0.004 250)"/>
                <stop offset="0.55" stop-color="oklch(72% 0.012 252)"/>
                <stop offset="1" stop-color="oklch(52% 0.016 256)"/>
              </linearGradient></defs>
              <g stroke="rgba(60,70,85,.24)" stroke-width="5" stroke-linecap="round" transform="translate(1.5,2.5)">
                <path d="M 74 150 C 74 172 90 184 108 188 C 120 191 124 202 116 209 C 108 216 96 210 99 201 C 101 195 109 195 112 200"/>
                <path d="M 346 150 C 346 172 330 184 312 188 C 300 191 296 202 304 209 C 312 216 324 210 321 201 C 319 195 311 195 308 200"/>
              </g>
              <g stroke="url(#gzSilver)" stroke-width="3.4" stroke-linecap="round">
                <path d="M 74 150 C 74 172 90 184 108 188 C 120 191 124 202 116 209 C 108 216 96 210 99 201 C 101 195 109 195 112 200"/>
                <path d="M 346 150 C 346 172 330 184 312 188 C 300 191 296 202 304 209 C 312 216 324 210 321 201 C 319 195 311 195 308 200"/>
              </g>
            </svg>
          </span>
          <span class="gz-cap gz-cap-l"></span>
          <span class="gz-cap gz-cap-r"></span>
          <span class="gz-col gz-col-l"></span>
          <span class="gz-base-block gz-base-l"></span>
          <span class="gz-col gz-col-r"></span>
          <span class="gz-base-block gz-base-r"></span>
          <span class="gz-step gz-step-1"></span>
          <span class="gz-step gz-step-2"></span>
          <span class="gz-step gz-step-3"></span>
        </span>
      </span>
      <span class="portal-arch-plinth">${plinthInner}</span>`;
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
          <!-- TWO WAYS TO READ. The Chamber is a reading you assemble;
               a Journey is one someone else argued. They belong at the
               same level because they are the same act, differently
               authored — not a feature beside a utility. -->
          <div class="nav-primary">
            <button class="nav-item" data-nav="chamber" role="link">
              Chamber
            </button>
            <button class="nav-item" data-nav="journeys" role="link">
              Journeys
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
          </div>
        </nav>

        <!-- THE TWO THRESHOLDS — classical marble pavilions (aediculae)
             flanking the centre, each a lit shrine glowing against the
             void. A domed roof and finial, an entablature bearing the
             name, fluted columns with volute capitals framing an arched
             niche, on a stepped base. The niche is the living window: a
             timeless marble (Atrium), the Earth of this hour (SOL). -->

        <!-- ATRIUM: the curated doorway — a featured sequence arrives
             lazily so the shrine is alive. -->
        <button class="portal-arch portal-arch-atrium" data-nav="atrium" style="opacity: 0;" aria-label="Enter the Atrium">
          ${this._gazeboMarkup('Atrium', `
            <span class="gz-marble"></span>
            <span class="gz-niche-shade"></span>
          `, `
            <span class="portal-arch-detail atrium-door-detail">philosophy &amp; history</span>
          `)}
        </button>

        <!-- SOLARIUM (the sundial-room): a *when*, not a place — the niche
             holds the Earth, daylit or lamplit by the real clock, in a
             field of stars. The route/view remain 'sol'; only the carved
             name pairs with ATRIUM as a matched Latin room. -->
        <button class="portal-arch portal-arch-sol" data-nav="sol" style="opacity: 0;" aria-label="Enter the Solarium">
          ${this._gazeboMarkup('Solarium', `
            <span class="gz-starfield"></span>
            <span class="gz-earth-disc">
              <video class="arch-earth-video" muted loop playsinline preload="none" disablePictureInPicture></video>
            </span>
            <span class="gz-niche-shade"></span>
          `, `
            <span class="portal-arch-detail sol-strip-detail"></span>
            <span class="sol-strip-time font-mono"></span>
            <span class="sol-strip-orb" hidden></span>
            <span class="sol-strip-window" hidden></span>
          `)}
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

    const atriumArch = this.container.querySelector('.portal-arch-atrium');
    revealTimeout(() => {
      if (atriumArch) {
        atriumArch.style.transition = 'opacity 700ms var(--ease-out)';
        atriumArch.style.opacity = '1';
      }
    }, 1300);

    const solArch = this.container.querySelector('.portal-arch-sol');
    revealTimeout(() => {
      if (solArch) {
        solArch.style.transition = 'opacity 700ms var(--ease-out)';
        solArch.style.opacity = '1';
      }
      // The arch is up: arm the Earth and load the current phase's loop
      // (deferred to idle so it never competes with first paint).
      const armEarth = () => {
        this._earthArmed = true;
        const strip = this.container.querySelector('.portal-arch-sol');
        const now = new Date();
        if (strip) this._syncEarthPhase(strip, now.getHours() >= 6 && now.getHours() < 18);
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(armEarth, { timeout: 1500 });
      } else {
        revealTimeout(armEarth, 300);
      }
    }, 1500);

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
    clearInterval(this._solStripInterval);
    // Reveal choreography must die with the view — surviving timers
    // fired after teardown (post-suite "window is not defined") and
    // could start media work after navigation
    (this._revealTimers || []).forEach(id => clearTimeout(id));
    this._revealTimers = [];
  }
}
