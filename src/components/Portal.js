/**
 * Portal Component — RISE Home.
 *
 * SyberLabs design system: one request box, one primary action (Create
 * preview), one secondary text link (the Meditations starter), and a header
 * nav of plain words. The Atlas atmosphere sits behind it while it is the
 * active room, and the RISE sigil is its brand mark (and, drawing in, its
 * loading state).
 *
 * REQUEST → PREVIEW → PLAY. Jev's answer is not played on arrival. Home
 * shows how the request was read, in words derived from the exact plan
 * (src/core/jev-describe.js), says what RISE cannot do before anything
 * plays, and lets the reader change one part at a time without asking Jev
 * again. The request and the preview survive navigation and reload.
 */


import './Portal.css';
import { drawRiseSigil, mountAtmosphere } from './atlas.js';
import { isJevSceneDemoPath, sceneSampleFromPath } from '../core/jev-demo-path.js';
import { attachJevDictation } from './jev-dictation.js';

const ICON_ATTRS = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SETTINGS_PATH = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>';
const ALERT_ICON_16 = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>';
const HELP = 'RISE turns your words into a reading with visuals, pace and sound. You’ll see how it was read before anything plays. Only this request goes to the configured AI decision service; your reading and saved work stay local.';
const PREVIEW_KEY = 'rise-jev-preview-v1';
const EXAMPLES = Object.freeze([
  'Neon and fast, like a night drive',
  'Slow and quiet, something to think about',
  'An epic battle with a big sound'
]);
const ADJUST_GROUPS = Object.freeze([
  ['energy', 'Energy'], ['speed', 'Speed'], ['colors', 'Colors'], ['sound', 'Sound']
]);
const SECTION_WORDS = Object.freeze({
  first: 'opening section', middle: 'middle section', last: 'final section',
  shortest: 'shortest section', longest: 'longest section'
});
const KIND_WORDS = Object.freeze({ energy: 'Energy', speed: 'Speed', colors: 'Colors', sound: 'Sound', workId: 'Text' });

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readStoredPreview() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || 'null');
    return value && typeof value.intent === 'string' ? value : null;
  } catch {
    return null;
  }
}

function writeStoredPreview(value) {
  try {
    if (value) sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    // Private windows may refuse storage; the preview still works in memory.
  }
}

export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.onLaunchJevReading = options.onLaunchJevReading || (async () => {});
    this.onLaunchJevSample = options.onLaunchJevSample || (async () => {});
    this.demoMode = options.demoMode === true;
    this.onLaunchFirstRead = options.onLaunchFirstRead || (async () => {});
    this._active = false;
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);
    // The preview: Jev's admitted answer, and the reader's own changes on top.
    this.preview = null;
    this.previewTools = null;

    this.render();
    this.attachEvents();
    this.syncContinue();
    this.restorePreview();
  }


  /** Router re-entry hook — refresh the living entries on return */
  update() {
    const demoMode = isJevSceneDemoPath(window.location.pathname);
    if (demoMode !== this.demoMode) {
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
      this.restorePreview();
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
   * nothing to resume.
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


  render() {
    this.stopJevDictation?.();
    const demo = this.demoMode;
    const nightDrive = demo && sceneSampleFromPath(window.location.pathname) === 'night-drive';
    this.container.innerHTML = `
      <div class="portal">
        <header class="sl-header">
          <div class="sl-header-inner">
            <span class="sl-lockup" role="img" aria-label="SyberLabs RISE">
              <img class="sl-mark" src="/syberlabs-mark.webp" alt="" width="18" height="20" decoding="async">
              <span class="sl-wordmark" aria-hidden="true">SYBERLABS<span class="sl-divider"> / </span>RISE</span>
              <canvas class="sl-sigil" aria-hidden="true"></canvas>
            </span>
            <button class="portal-menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="main-content">
              <span class="portal-menu-label" aria-hidden="true">Menu</span>
              <svg class="icon-menu" ${ICON_ATTRS}><path d="M4 8h16"></path><path d="M4 16h16"></path></svg>
              <svg class="icon-close" ${ICON_ATTRS}><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
            </button>
            <nav id="main-content" class="portal-nav" aria-label="Primary">
              <button class="portal-nav-link portal-nav-home" type="button" data-action="home" aria-current="page">Home</button>
              <button class="portal-nav-link" type="button" data-nav="create">Create</button>
              <button class="portal-nav-link" type="button" data-nav="library">Library</button>
              <button class="portal-nav-link" type="button" data-nav="vault">Sequences</button>
              <button class="portal-nav-link" type="button" data-nav="workshop">Compose</button>
              <button class="portal-nav-settings" type="button" data-action="settings" aria-label="Settings" title="Settings">
                <svg ${ICON_ATTRS}>${SETTINGS_PATH}</svg><span class="portal-nav-settings-label">Settings</span>
              </button>
            </nav>
          </div>
        </header>

        <main class="portal-main">
          <section class="portal-ask" aria-labelledby="portal-ask-title">
            <p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>${nightDrive ? 'Night Drive sample' : demo ? 'RISE scene sample' : 'Read with RISE'}</p>
            ${nightDrive ? `<h1 class="portal-title" id="portal-ask-title">Neon, at speed.</h1>
            <div class="portal-jev-form" id="portal-jev-demo">
              <p class="portal-help">Neon light, rushing light streaks and a driving electronic beat, over Walt Whitman’s “Song of the Open Road”. About 25 seconds.</p>
              <p class="portal-help">This is the fixed look RISE chooses for night-drive, racing, drifting or neon requests. No live RISE request is made here. RISE makes its own visuals and music; it uses no film footage or soundtrack.</p>
              <p class="portal-help">Sound starts when you press Start. If your device asks for reduced motion, the scene holds one still frame.</p>
              <div class="portal-actions">
                <button class="portal-primary" id="jev-scene-demo-start" type="button">Start Night Drive</button>
                <p class="portal-status" id="jev-scene-demo-status" role="status" aria-live="polite"></p>
              </div>
              <p class="portal-alt"><a class="portal-link portal-jev-demo-live" href="/">Ask RISE live for a personal reading</a></p>
            </div>` : demo ? `<h1 class="portal-title" id="portal-ask-title">Make the scene respond.</h1>
            <div class="portal-jev-form" id="portal-jev-demo">
              <p class="portal-help">Read a released passage from Middlemarch, then bring its next visual scene forward while the words keep moving.</p>
              <p class="portal-help">This is a fixed sample preset of choices RISE may make. No live RISE request is made here.</p>
              <p class="portal-help">Source: <em>Middlemarch</em> by George Eliot ·
                <a class="portal-link" href="https://standardebooks.org/ebooks/george-eliot/middlemarch" target="_blank" rel="noopener noreferrer">Standard Ebooks edition</a></p>
              <div class="portal-actions">
                <button class="portal-primary" id="jev-scene-demo-start" type="button">Start sample reading</button>
                <p class="portal-status" id="jev-scene-demo-status" role="status" aria-live="polite"></p>
              </div>
              <p class="portal-alt"><a class="portal-link portal-jev-demo-live" href="/">Ask RISE live for a personal reading</a></p>
            </div>` : `<h1 class="portal-title"><label id="portal-ask-title" for="portal-jev-intent">What do you want to <em class="sy-spectrum">experience</em>?</label></h1>
            <form class="portal-jev-form" id="portal-jev-form" novalidate>
              <textarea id="portal-jev-intent" name="intent" rows="4" maxlength="240" required
                aria-describedby="portal-jev-help"
                placeholder="Describe a mood, a style, a text, or all three."></textarea>
              <p class="portal-help" id="portal-jev-help">${HELP}</p>
              <p class="portal-kept" id="portal-jev-kept" hidden></p>
              <div class="portal-actions">
                <button class="portal-primary portal-jev-submit" type="submit"><span class="portal-submit-label">Create preview</span><svg class="portal-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity=".25"></circle><path d="M21 12a9 9 0 0 0-9-9"></path></svg></button>
                <button class="portal-icon-btn portal-jev-dictate" data-jev-dictate="icon" type="button" aria-label="Speak your request" aria-pressed="false" aria-describedby="portal-jev-voice-note"><svg ${ICON_ATTRS}><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg></button>
                <p class="portal-status" id="portal-jev-hint" role="status" aria-live="polite"></p>
              </div>
              <p class="portal-voice" id="portal-jev-voice-note"><span data-jev-dictation-status role="status" aria-live="polite"></span><span class="portal-voice-note">Voice input may use your browser’s speech service. Review the text before creating a preview.</span></p>
              <div class="portal-examples" aria-label="Example requests">
                ${EXAMPLES.map(text => `<button class="portal-chip" type="button" data-example="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}
              </div>
              <div class="portal-alert" id="portal-jev-error" role="alert" hidden>
                <svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                <div class="portal-alert-body">
                  <p class="portal-alert-title">Couldn’t create a preview. Your request is saved.</p>
                  <details class="portal-alert-details">
                    <summary>Details<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary>
                    <p class="portal-alert-message"></p>
                  </details>
                </div>
                <button class="portal-link portal-alert-retry" type="button">Try again</button>
              </div>
            </form>`}
            ${demo ? '' : `<p class="portal-alt">Or start with
              <button class="portal-link portal-first-read" type="button">Meditations · Marcus Aurelius</button>
            </p>`}
          </section>

          <section class="portal-aside" aria-label="Your reading">
            <figure class="portal-plate" aria-hidden="true">
              <div class="portal-sigil sy-plate"><canvas class="portal-sigil-canvas"></canvas></div>
              <figcaption class="portal-plate-caption"><b>Plate · RISE</b><span class="portal-plate-params"></span></figcaption>
            </figure>
            <div class="portal-skeleton" aria-hidden="true" hidden>
              <span class="sk" style="width:96px;height:12px"></span>
              <span class="sk" style="width:280px;height:40px;margin-top:24px"></span>
              <span class="sk" style="width:140px;height:16px;margin-top:12px"></span>
              <span class="sk" style="width:100%;height:16px;margin-top:24px"></span>
              <span class="sk" style="width:72%;height:16px;margin-top:8px"></span>
              <span class="sk-row"><span class="sk" style="width:64px;height:12px"></span><span class="sk" style="width:120px;height:16px"></span></span>
              <span class="sk-row"><span class="sk" style="width:80px;height:12px"></span><span class="sk" style="width:132px;height:16px"></span></span>
              <span class="sk-row"><span class="sk" style="width:48px;height:12px"></span><span class="sk" style="width:72px;height:16px"></span></span>
            </div>
            <section class="portal-preview" id="portal-preview" hidden aria-labelledby="portal-preview-title">
              <p class="portal-eyebrow" id="portal-preview-title">Interpretation</p>
              <p class="portal-preview-lede"></p>
              <dl class="portal-rows"></dl>
              <div class="portal-read">
                <p class="portal-read-label">What you’ll read</p>
                <p class="portal-read-title"></p>
                <p class="portal-read-meta"></p>
                <p class="portal-read-why" hidden>You didn’t name a text, so RISE picked one from the readings it holds.</p>
              </div>
              <div class="portal-limit" role="note" hidden>
                <svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                <div>
                  <p class="portal-limit-title">What RISE can’t do here</p>
                  <p class="portal-limit-body"></p>
                </div>
              </div>
              <div class="portal-adjust" aria-labelledby="portal-adjust-title">
                <div class="portal-adjust-head">
                  <h2 id="portal-adjust-title">Adjust</h2>
                  <p>Changes apply instantly. Nothing is sent again.</p>
                </div>
                <div class="portal-adjust-groups"></div>
                <label class="portal-adjust-label" for="portal-adjust-text">Text</label>
                <select id="portal-adjust-text" class="portal-select" data-adjust-kind="workId"></select>
                <div class="portal-adjust-foot">
                  <p class="portal-adjust-note" role="status" aria-live="polite"></p>
                  <button class="portal-link portal-adjust-reset" type="button" hidden>Reset to interpretation</button>
                </div>
              </div>
              <div class="portal-actions portal-play-row">
                <button class="portal-primary portal-play" id="portal-play" type="button">Play with sound</button>
                <p class="portal-help">Plays here. Fullscreen only if you choose it.</p>
              </div>
              <details class="portal-details">
                <summary>Details</summary>
                <p class="portal-details-body"></p>
              </details>
            </section>

            <!-- Continue: title only (the session is in memory). Hidden when
                 there is nothing to resume. -->
            <button class="portal-continue" type="button" data-action="continue" hidden>
              <span class="continue-label">Continue reading</span>
              <span class="continue-title"></span>
              <svg class="continue-go" ${ICON_ATTRS}><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
            </button>
          </section>
        </main>

        <footer class="portal-footer">
          <button class="portal-footer-link" type="button" data-action="guide">Guide</button>
          <button class="portal-footer-link" type="button" data-nav="chamber">Reader setup</button>
          <!-- The header holds at most four destinations and the footer stays
               plain; the remaining rooms are one disclosure away, never gone. -->
          <div class="portal-more">
            <button class="portal-footer-link portal-more-toggle" type="button" aria-expanded="false" aria-controls="portal-more-list">More<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button>
            <ul class="portal-more-list" id="portal-more-list" hidden>
              <li><button class="portal-footer-link" type="button" data-nav="chapel">Chapel</button></li>
              <li><button class="portal-footer-link" type="button" data-nav="scriptorium">Scriptorium</button></li>
              <li><button class="portal-footer-link" type="button" data-nav="visual-lab">Visual Lab</button></li>
              <li><button class="portal-footer-link" type="button" data-nav="emotions">Emotions</button></li>
              <li><button class="portal-footer-link" type="button" data-nav="curia">Curia</button></li>
            </ul>
          </div>
          <!-- Conspicuously posted, which is the standard CalOPPA sets and
               the reason these sit on the Portal rather than inside a room.
               Generated from PRIVACY.md and TERMS.md by build-legal.mjs. -->
          <span class="portal-legal">
            <a href="/privacy.html" class="portal-footer-link portal-legal-link">Privacy</a>
            <a href="/terms.html" class="portal-footer-link portal-legal-link">Terms</a>
          </span>
        </footer>
      </div>
    `;
    // Drawn when the room is shown: a hidden canvas has no size to draw at.
    this._marksDrawn = false;
    if (this._active) this.drawMarks();
    if (this._atmosphere) {
      this._atmosphere.destroy();
      this._atmosphere = null;
      if (this._active) this._atmosphere = mountAtmosphere(this.container.querySelector('.portal'));
    }
  }

  /** The RISE sigil in the header lockup and on the plate beside the ask. */
  drawMarks({ animate = true } = {}) {
    this._marksDrawn = true;
    drawRiseSigil(this.container.querySelector('.sl-sigil'), { animate: false });
    this.drawPlate({ animate });
  }

  drawPlate({ animate = true } = {}) {
    this._plateDraw?.cancel?.();
    const canvas = this.container.querySelector('.portal-sigil-canvas');
    drawRiseSigil(canvas, { animate }).then(result => {
      if (!result) return;
      this._plateDraw = result;
      const params = this.container.querySelector('.portal-plate-params');
      if (params) params.textContent = result.caption;
    });
  }

  /** Loading state: busy button, disabled field, skeleton where the reading lands. */
  setJevBusy(busy) {
    const form = this.container.querySelector('#portal-jev-form');
    if (!form) return;
    const submit = form.querySelector('.portal-jev-submit');
    submit.disabled = busy;
    submit.toggleAttribute('aria-busy', busy);
    form.querySelector('#portal-jev-intent').readOnly = busy;
    const first = this.container.querySelector('.portal-first-read');
    if (first) first.disabled = busy;
    this.container.querySelector('.portal-skeleton').hidden = !busy;
    // Loading is the sigil drawing in again while Jev interprets.
    if (busy) this.drawPlate();
    this.container.querySelector('#portal-jev-hint').textContent = busy ? 'Interpreting your request. This usually takes a few seconds.' : '';
    // While asking, the old preview steps aside; if asking fails, it returns.
    const preview = this.container.querySelector('#portal-preview');
    if (preview) preview.hidden = busy || !this.preview;
  }

  showJevFieldError(show) {
    const form = this.container.querySelector('#portal-jev-form');
    const intent = form.querySelector('#portal-jev-intent');
    const help = form.querySelector('#portal-jev-help');
    intent.setAttribute('aria-invalid', String(show));
    help.classList.toggle('is-error', show);
    help.innerHTML = show ? `${ALERT_ICON_16}Add a few words: a mood, a style, a text, or all three.` : HELP;
  }

  /**
   * The alert always says the SPEC sentence. A raw cause (an API message, a
   * network error) is kept for whoever needs it, one "Details" click away.
   */
  showJevError(show, details = '') {
    const alert = this.container.querySelector('#portal-jev-error');
    if (!alert) return;
    alert.hidden = !show;
    const more = alert.querySelector('.portal-alert-details');
    more.open = false;
    more.hidden = !details;
    alert.querySelector('.portal-alert-message').textContent = details;
  }

  attachEvents() {
    const firstRead = this.container.querySelector('.portal-first-read');
    firstRead?.addEventListener('click', async () => {
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
    const intentField = form?.querySelector('#portal-jev-intent');
    intentField?.addEventListener('input', () => {
      if (intentField.getAttribute('aria-invalid') === 'true') this.showJevFieldError(false);
    });
    form?.querySelector('.portal-alert-retry').addEventListener('click', () => form.requestSubmit());
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const intent = intentField.value.trim();
      if (intent.length < 3 || intent.length > 240) {
        this.showJevFieldError(true);
        intentField.focus();
        return;
      }
      const submit = form.querySelector('.portal-jev-submit');
      if (submit.disabled) return;
      this.showJevFieldError(false);
      this.showJevError(false);
      this.setJevBusy(true);
      this.getAudioEngine()?.playClick();
      try {
        const response = await fetch('/api/jev-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, schemaVersion: 3 })
        });
        const decision = await response.json();
        if (!response.ok) throw new Error(decision.error?.message || 'RISE is unavailable.');
        // The reader's own changes survive a new request (they are theirs).
        await this.showPreview(intent, decision, this.preview?.changes || []);
      } catch (error) {
        this.showJevError(true, error?.message || '');
      } finally {
        this.setJevBusy(false);
      }
    });

    this.container.querySelectorAll('[data-example]').forEach(chip => {
      chip.addEventListener('click', () => {
        intentField.value = chip.dataset.example;
        intentField.dispatchEvent(new Event('input', { bubbles: true }));
        intentField.focus();
      });
    });
    intentField?.addEventListener('input', () => this.rememberIntent(intentField.value));

    const preview = this.container.querySelector('#portal-preview');
    preview?.addEventListener('click', event => {
      const option = event.target.closest('[data-adjust-value]');
      if (option) void this.adjust(option.dataset.adjustKind, option.dataset.adjustValue);
    });
    preview?.querySelector('#portal-adjust-text').addEventListener('change', event => {
      void this.adjust('workId', event.target.value);
    });
    preview?.querySelector('.portal-adjust-reset').addEventListener('click', () => {
      if (!this.preview) return;
      void this.showPreview(this.preview.intent, this.preview.base, [], 'Back to the original interpretation.');
    });
    preview?.querySelector('#portal-play').addEventListener('click', async () => {
      const play = preview.querySelector('#portal-play');
      if (!this.preview || play.disabled) return;
      play.disabled = true;
      this.getAudioEngine()?.playClick();
      try {
        await this.onLaunchJevReading(this.preview.decision);
      } catch (error) {
        this.showJevError(true, error?.message || '');
      } finally {
        play.disabled = false;
      }
    });

    const sample = this.container.querySelector('#jev-scene-demo-start');
    sample?.addEventListener('click', async () => {
      if (sample.disabled) return;
      sample.disabled = true;
      const status = this.container.querySelector('#jev-scene-demo-status');
      status.textContent = 'Preparing the reading…';
      try {
        await this.onLaunchJevSample();
      } catch (error) {
        status.textContent = error.message || 'The sample could not be prepared.';
      } finally {
        sample.disabled = false;
      }
    });

    // Phone header: one Menu button opens the same nav as a sheet. While it
    // is open, Tab stays inside it and Escape closes it.
    const header = this.container.querySelector('.sl-header');
    const toggle = this.container.querySelector('.portal-menu-toggle');
    const nav = header.querySelector('.portal-nav');
    const setMenu = (open, { restoreFocus = false } = {}) => {
      header.classList.toggle('is-open', open);
      this.container.querySelector('.portal').classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      if (open) nav.querySelector('button')?.focus();
      else if (restoreFocus) toggle.focus();
    };
    this.closeMenu = () => setMenu(false);
    toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open'), { restoreFocus: true }));
    header.addEventListener('keydown', event => {
      if (!header.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false, { restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;
      const stops = [toggle, ...nav.querySelectorAll('button')];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    nav.querySelector('[data-action="home"]').addEventListener('click', () => setMenu(false, { restoreFocus: true }));

    // Footer "More": the rooms without a plain everyday name, one click away.
    const more = this.container.querySelector('.portal-more');
    const moreToggle = more.querySelector('.portal-more-toggle');
    const moreList = more.querySelector('.portal-more-list');
    const setMore = open => {
      moreList.hidden = !open;
      moreToggle.setAttribute('aria-expanded', String(open));
    };
    moreToggle.addEventListener('click', () => setMore(moreList.hidden));
    more.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !moreList.hidden) {
        event.preventDefault();
        setMore(false);
        moreToggle.focus();
      }
    });
    // Tabbing away or clicking elsewhere closes it. (A null relatedTarget
    // is a click that moved no focus, as Safari does; the click handler has it.)
    more.addEventListener('focusout', event => {
      if (event.relatedTarget && !more.contains(event.relatedTarget)) setMore(false);
    });
    this.container.querySelector('.portal').addEventListener('click', event => {
      if (!more.contains(event.target)) setMore(false);
    });

    // Navigation
    const navItems = this.container.querySelectorAll('[data-nav]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.closeMenu?.();
        const destination = item.dataset.nav;
        this.onNavigate(destination);
      });
    });

    // Continue resumes the compiled reading.
    const cont = this.container.querySelector('.portal-continue');
    if (cont) {
      cont.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.onNavigate('chamber-session', this.getCurrentSession());
      });
    }

    // Utility actions
    const utilLinks = this.container.querySelectorAll('[data-action="guide"], [data-action="settings"]');
    utilLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.closeMenu?.();
        const action = link.dataset.action;
        if (action === 'guide') {
          window.dispatchEvent(new CustomEvent('rise-open-guide'));
        } else if (action === 'settings') {
          window.dispatchEvent(new CustomEvent('rise-open-settings'));
        }
      });
    });
  }

  /** Keep the request in the tab's session, so leaving Home cannot lose it. */
  rememberIntent(intent) {
    const stored = readStoredPreview();
    writeStoredPreview(stored ? { ...stored, draft: intent } : { intent: '', draft: intent });
  }

  /** Bring back the request, and the preview, after navigation or reload. */
  restorePreview() {
    const stored = readStoredPreview();
    const field = this.container.querySelector('#portal-jev-intent');
    if (!stored || !field) return;
    field.value = stored.draft ?? stored.intent;
    if (stored.base && stored.intent) {
      void this.showPreview(stored.intent, stored.base, stored.changes || []).catch(() => {
        writeStoredPreview({ intent: '', draft: field.value });
      });
    }
  }

  async loadPreviewTools() {
    this.previewTools ||= Promise.all([
      import('../core/jev-describe.js'),
      import('../app/jev-reading.js'),
      import('../content/library.js')
    ]).then(([describe, reading, library]) => ({ ...describe, ...reading, ...library }));
    return this.previewTools;
  }

  /**
   * Admit Jev's answer, re-apply the reader's own changes, and show the
   * interpretation. Nothing plays here.
   */
  async showPreview(intent, base, changes = [], note = '') {
    const tools = await this.loadPreviewTools();
    tools.validateJevRecommendation(base);
    let decision = base;
    const kept = [];
    for (const [kind, value] of changes) {
      try {
        decision = tools.adjustJevDecision(decision, kind, value);
        kept.push([kind, value]);
      } catch {
        // A change that no longer applies is dropped, not forced.
      }
    }
    tools.validateJevRecommendation(decision);
    this.preview = { intent, base, decision, changes: kept };
    const field = this.container.querySelector('#portal-jev-intent');
    writeStoredPreview({ intent, draft: field?.value ?? intent, base, changes: kept });
    this.renderPreview(tools, note);
  }

  async adjust(kind, value) {
    if (!this.preview) return;
    const changes = this.preview.changes.filter(([k]) => k !== kind);
    changes.push([kind, value]);
    const tools = await this.loadPreviewTools();
    const label = kind === 'workId'
      ? tools.getTextById(value)?.title || 'another text'
      : tools.JEV_ADJUSTMENTS[kind]?.[value]?.label || value;
    await this.showPreview(this.preview.intent, this.preview.base, changes,
      `${KIND_WORDS[kind]}: ${label}. Updated instantly, nothing sent.`);
  }

  renderPreview(tools, note) {
    const root = this.container.querySelector('#portal-preview');
    if (!root || !this.preview) return;
    const { intent, decision, changes } = this.preview;
    const config = decision.config;
    const work = tools.getTextById(decision.workId);
    const named = tools.namesWork(intent, work);
    const { reference, limits } = tools.readJevRequest(intent);
    const changed = new Set(changes.map(([kind]) => kind));
    const rowChanged = { colors: ['colors'], energy: ['energy'], speed: ['speed', 'sound'], text: [] };

    root.querySelector('.portal-preview-lede').innerHTML = reference
      ? `You referenced <strong>“${escapeHtml(reference.name)}”</strong>. RISE treated it as a style (${escapeHtml(reference.reads)}), not as a ${escapeHtml(reference.kind)} to play.`
      : named
        ? `You asked for <strong>${escapeHtml(work?.title)}</strong>. Here’s the presentation RISE chose for it. Change anything below.`
        : 'Here’s how RISE read your request. Change anything below.';

    root.querySelector('.portal-rows').innerHTML = tools.describeJevPlan(config).map(row => `
      <div class="portal-row">
        <dt>${escapeHtml(row.label)}</dt>
        <dd><span class="portal-row-value">${escapeHtml(row.value)}${rowChanged[row.key]?.some(k => changed.has(k)) ? '<span class="portal-yours">Yours</span>' : ''}</span>
        <span class="portal-row-detail">${escapeHtml(row.detail)}</span></dd>
      </div>`).join('');

    root.querySelector('.portal-read-title').innerHTML = `${escapeHtml(work?.title || decision.workId)}${changed.has('workId') ? '<span class="portal-yours">Yours</span>' : ''}`;
    root.querySelector('.portal-read-meta').textContent =
      `${work?.author || ''} · ${SECTION_WORDS[config.section] || 'a section'}`;
    root.querySelector('.portal-read-why').hidden = named || changed.has('workId');

    const limit = root.querySelector('.portal-limit');
    limit.hidden = limits.length === 0;
    root.querySelector('.portal-limit-body').textContent = limits.length
      ? `RISE can’t ${limits.join(', or ')}. It matches the mood with its own synthesized music and abstract visuals instead.`
      : '';

    root.querySelector('.portal-adjust-groups').innerHTML = ADJUST_GROUPS.map(([kind, label]) => {
      const current = tools.currentJevAdjustment(config, kind);
      return `<div class="portal-adjust-group" role="group" aria-label="${label}">
        <span class="portal-adjust-label">${label}</span>
        <div class="portal-segments">${Object.entries(tools.JEV_ADJUSTMENTS[kind]).map(([value, option]) =>
          `<button type="button" class="portal-segment" data-adjust-kind="${kind}" data-adjust-value="${value}" aria-pressed="${current === value}">${escapeHtml(option.label)}</button>`).join('')}</div>
      </div>`;
    }).join('');
    const select = root.querySelector('#portal-adjust-text');
    select.innerHTML = tools.jevReleasedWorkIds().map(id => {
      const text = tools.getTextById(id);
      return `<option value="${escapeHtml(id)}">${escapeHtml(text?.title || id)}${text?.author ? ` · ${escapeHtml(text.author)}` : ''}</option>`;
    }).join('');
    select.value = decision.workId;
    root.querySelector('.portal-adjust-note').textContent = note;
    root.querySelector('.portal-adjust-reset').hidden = changes.length === 0;

    root.querySelector('.portal-details-body').textContent =
      `Interpreted by RISE’s AI decision service. Model ${decision.model} · request ${decision.requestId}`
      + (decision.decisionCacheStatus === 'hit' ? ' · reused a recent answer' : '');

    const kept = this.container.querySelector('#portal-jev-kept');
    if (kept) {
      kept.hidden = changes.length === 0;
      kept.textContent = changes.length
        ? `Updating keeps your changes: ${changes.map(([kind]) => KIND_WORDS[kind]).join(', ')}.` : '';
    }
    const label = this.container.querySelector('.portal-submit-label');
    if (label) label.textContent = 'Update preview';
    root.hidden = false;
  }

  handleKeyboard(e) {
    // Escape returns to Portal (this is the root, so no action)
    if (e.key === 'Escape') {
      // Already at Portal
    }
  }

  activate() {
    if (this._active) return;
    this._active = true;
    this._atmosphere ||= mountAtmosphere(this.container.querySelector('.portal'));
    if (!this._marksDrawn) this.drawMarks();
    if (!this.stopJevDictation) {
      const form = this.container.querySelector('#portal-jev-form');
      if (form) this.stopJevDictation = attachJevDictation(form);
    }
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    // Every other room — and above all the Chamber — runs without it.
    this._atmosphere?.destroy();
    this._atmosphere = null;
    this.stopJevDictation?.();
    this.stopJevDictation = null;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  destroy() {
    this.stopJevDictation?.();
    this.deactivate();
    this._plateDraw?.cancel?.();
  }
}
