/**
 * Home — the night library, and the first screen.
 *
 * Every released work is a star in a sky (src/components/night-library/),
 * and a text panel sits over it. **Roll a reading** composes one by chance
 * inside bounds (src/core/roll.js); picking a star rolls for that work.
 * A result names three parts: the text and the mood (the temper, in plan
 * words), each with its own Redraw, and the passage (the opening lines the
 * reading will start on). **Start reading** plays it; **Adjust first** opens Reader
 * Setup with everything already set.
 *
 *   Home proposes → Reader Setup alters → Chamber performs.
 *
 * **Ask for one** is offered from the start. It needs the reader's own AI
 * (their OpenRouter account, or Kev on their computer); without one the panel
 * says so and rolling stays one press away. What RISE cannot do for a request
 * is said before anything plays (src/core/jev-describe.js).
 *
 * The panel never depends on the sky: the sky is loaded after Home shows, and
 * Home works without it. The result lives with Home while it is open; a fresh
 * load starts empty, so the first roll is the reader's own.
 * Every other room is one Menu away; Privacy and Terms stay posted.
 */

import './Home.css';
import './portal-home.css';
import { drawRiseSigil } from './atlas.js';
import { isJevSceneDemoPath, sceneSampleFromPath } from '../core/jev-demo-path.js';
import { attachJevDictation } from './jev-dictation.js';
import { connectionState, detectLocalKev, disconnect, isLocalRise, subscribeConnection, takeConnectionNotice } from '../core/ai-connection.js';
import { claimOpenRouterReturn } from '../core/openrouter-callback.js';
import { escapeHtml } from '../core/sanitize.js';
import { watchLocalDay } from '../core/local-day.js';

const ICON_ATTRS = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SETTINGS_PATH = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>';
const MIC_ICON = `<svg ${ICON_ATTRS}><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>`;
const REDRAW_ICON = `<svg ${ICON_ATTRS}><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path></svg>`;
const ASK_HELP = 'Only your request is sent, to your connected OpenRouter account or local Kev. Your reading and saved work stay here. Voice input may use your browser’s speech service.';
const ABOUT_CONNECTION = 'OpenRouter requests are billed to your account. The key stays in this tab’s memory and is forgotten when you disconnect, reload, or close the tab. It is never sent to SyberLabs. Browser extensions can read page memory; revoke keys in your OpenRouter settings.';
const LOCAL_RISE = 'https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md';
const CONTINUE = `<button class="portal-continue" type="button" data-action="continue" hidden>
            <span class="continue-label">Continue reading</span>
            <span class="continue-title"></span>
            <svg class="continue-go" ${ICON_ATTRS}><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
          </button>`;

const capital = text => text ? text[0].toLocaleUpperCase('en') + text.slice(1) : '';
const button = (hook, label, variant, extra = '') =>
  `<button class="btn btn-${variant}" type="${hook === 'ask' ? 'submit' : 'button'}" data-home="${hook}"${extra}>${label}</button>`;

export class Home {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.onLaunchJevReading = options.onLaunchJevReading || (async () => {});
    this.onAdjustReading = options.onAdjustReading || (async () => {});
    this.onLaunchJevSample = options.onLaunchJevSample || (async () => {});
    this.demoMode = options.demoMode === true;
    this._active = false;
    // What the panel shows: idle | result | ask.
    this.view = 'idle';
    // The data-home hook of the work in progress (roll, roll-instead, redraw-*, ask, enter, adjust), or null.
    this.busy = null;
    // { decision, source: 'roll' | 'ask', temper, note, title, author, mood, byline, meta, plan, lines }
    this.result = null;
    this.firstReadChoiceUsed = false;
    this.draft = '';
    this.tools = null;
    this.sky = null;
    this.stopConnection = subscribeConnection(() => this.renderConnection());
    if (isLocalRise()) void detectLocalKev();
    const returned = claimOpenRouterReturn();
    if (returned) {
      void import('../core/openrouter-oauth.js')
        .then(({ finishOpenRouterReturn }) => finishOpenRouterReturn(returned));
    }

    this.render();
    this.attachEvents();
    this.syncContinue();
  }

  /** Router re-entry hook — refresh the living entries on return */
  update() {
    const demoMode = isJevSceneDemoPath(window.location.pathname);
    if (demoMode !== this.demoMode) {
      const wasActive = this._active;
      this.deactivate();
      this.sky?.destroy();
      this.sky = null;
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
      if (wasActive) this.activate();
    }
    // Returning from a reading is precisely when this changes.
    this.syncContinue();
  }

  /**
   * Show Continue only when there is genuinely something to continue
   * (Premium_Mobile_Chamber P6). The session is in memory only, so a cold
   * load has none.
   */
  syncContinue() {
    const strip = this.container.querySelector('.portal-continue');
    if (!strip) return;
    const session = this.getCurrentSession();
    const named = session?.title || session?.name;
    const title = typeof named === 'string' ? named.trim() : '';
    strip.hidden = !title;
    if (!title) return;
    strip.querySelector('.continue-title').textContent = title;
    strip.setAttribute('aria-label', `Continue reading — ${title}`);
  }

  render() {
    this.stopDictation?.();
    this.stopDictation = null;
    this.container.innerHTML = `
      <div class="portal${this.demoMode ? '' : ' portal-home'}">
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
              <button class="portal-nav-link" type="button" data-nav="today">Today's poem</button>
              <button class="portal-nav-link" type="button" data-nav="library">Library</button>
              <button class="portal-nav-link" type="button" data-nav="vault">Sequences</button>
              <button class="portal-nav-link" type="button" data-nav="workshop">Compose</button>
              <button class="portal-nav-link" type="button" data-nav="chamber">Reader setup</button>
              <button class="portal-nav-link" type="button" data-action="guide">Guide</button>
              <button class="portal-nav-settings" type="button" data-action="settings" aria-label="Settings" title="Settings">
                <svg ${ICON_ATTRS}>${SETTINGS_PATH}</svg><span class="portal-nav-settings-label">Settings</span>
              </button>
              <p class="portal-nav-group" aria-hidden="true">Other ways in</p>
              <!-- A page of its own: another skin over the same roll (src/wormhole). -->
              <a class="portal-nav-link portal-nav-minor" href="/wormhole.html">Wormhole</a>
              <p class="portal-nav-group" aria-hidden="true">More rooms</p>
              <!-- The live Current: a reading a reader redirects in words while it runs. A minor room
                   until Stage 2 of docs/VISION.md is complete; promote it to the primary nav then. -->
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="live">Live reading</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="chapel">Chapel</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="scriptorium">Scriptorium</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="visual-lab">Visual Lab</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="emotions">Emotions</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="curia">Curia</button>
            </nav>
          </div>
        </header>

        <main class="portal-main">
          ${this.demoMode ? `${this.renderDemo()}${CONTINUE}` : this.renderHome()}
        </main>

        <footer class="portal-footer">
          ${this.demoMode ? '' : `<div class="portal-ai" id="portal-ai">${this.renderConnectionLine()}</div>`}
          <!-- Conspicuously posted, which is the standard CalOPPA sets and
               the reason these sit on Home rather than inside a room.
               Generated from PRIVACY.md and TERMS.md by build-legal.mjs. -->
          <span class="portal-legal">
            <a href="/privacy.html" class="portal-footer-link portal-legal-link">Privacy</a>
            <a href="/terms.html" class="portal-footer-link portal-legal-link">Terms</a>
          </span>
        </footer>
      </div>
    `;
    this._marksDrawn = false;
    if (this._active) this.drawMarks();
  }

  /** The panel over the sky. Every word and control is here before the sky loads. */
  renderHome() {
    return `<section class="home" aria-labelledby="home-title">
      <form class="home-panel" id="home-form" novalidate>
        <div class="home-view"></div>
        <p class="home-status" role="status" aria-live="polite"><span data-home-status></span><span data-jev-dictation-status></span></p>
        <div class="portal-alert home-alert" role="alert" hidden>
          <div class="portal-alert-body">
            <p class="portal-alert-title"></p>
            <details class="portal-alert-details">
              <summary>Details</summary>
              <p class="portal-alert-message"></p>
            </details>
          </div>
        </div>
        ${CONTINUE}
      </form>
      <div class="home-sky"></div>
    </section>`;
  }

  renderDemo() {
    const nightDrive = sceneSampleFromPath(window.location.pathname) === 'night-drive';
    return `<section class="portal-ask" aria-labelledby="portal-ask-title">
      <p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>${nightDrive ? 'Night Drive sample' : 'RISE scene sample'}</p>
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
      </div>` : `<h1 class="portal-title" id="portal-ask-title">Make the scene respond.</h1>
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
      </div>`}
    </section>`;
  }

  /** One footer line: what asking needs, or what is connected. */
  renderConnectionLine() {
    const state = connectionState();
    const line = state.kind === 'openrouter'
      ? `${escapeHtml('Jev through your OpenRouter account, billed to your OpenRouter account.')} <button class="portal-link" type="button" data-ai="disconnect">Disconnect</button>`
      : state.kind === 'local' ? escapeHtml('Kev on this computer. No hosted inference bill.')
        : `Asking for a specific reading needs your own AI: <button class="portal-link" type="button" data-ai="connect">connect OpenRouter</button> or <a class="portal-link" href="${LOCAL_RISE}" target="_blank" rel="noopener noreferrer">run RISE locally</a>.`;
    return `<p class="portal-ai-line" id="portal-ai-status">${line}</p>
      <p class="portal-ai-notice" role="status" hidden></p>`;
  }

  renderConnection() {
    const current = this.container.querySelector('.portal-ai');
    if (!current) return;
    current.innerHTML = this.renderConnectionLine();
    const notice = takeConnectionNotice();
    if (notice) this.showConnectionNotice(notice.message);
    // An open request becomes a field, or an explanation, as the connection changes.
    if (this.view === 'ask') this.renderView();
  }

  showConnectionNotice(message) {
    const node = this.container.querySelector('.portal-ai-notice');
    if (node) { node.textContent = message; node.hidden = !message; }
  }

  async connectOpenRouter() {
    try {
      const { beginOpenRouterConnect } = await import('../core/openrouter-oauth.js');
      await beginOpenRouterConnect();
    } catch {
      this.showConnectionNotice('OpenRouter could not be connected in this browser.');
    }
  }

  idleView() {
    return `<h1 class="home-title" id="home-title">Every <span class="sy-spectrum">star</span> is a text you can read.</h1>
      <p class="home-lede">Roll, and RISE picks one with a mood to read it in: its pace, imagery and sound. Or choose a star yourself.</p>
      <div class="home-actions">${button('roll', 'Roll a reading', 'primary')}${button('ask-open', 'Ask for one', 'secondary')}</div>
      <div class="home-today">${this._todayHtml || button('today', 'Read today\'s poem', 'ghost')}</div>`;
  }

  /** Today's poem card, after first paint. Until it loads, or if it cannot, the plain link stays. */
  async loadToday() {
    if (this.todayCard || this._todayLoading || this._destroyed) return;
    this._todayLoading = true;
    try {
      this.todayCard = await import('./today/today-card.js');
      this.showToday(new Date());
    } catch (error) {
      this.todayCard = null;
      console.warn('[Home] today\'s poem card could not load; the link stays.', error);
    } finally {
      this._todayLoading = false;
    }
  }

  /** Puts the day's card in the idle panel without redrawing the rest, so focus stays put. */
  showToday(date) {
    if (!this.todayCard || this._destroyed) return;
    this._todayHtml = this.todayCard.todayCardMarkup(date);
    const slot = this.container.querySelector('.home-today');
    if (!slot) return;
    const hadFocus = slot.contains(document.activeElement);
    slot.innerHTML = this._todayHtml;
    this.todayCard.drawTodayCardMark(slot);
    if (hadFocus) slot.querySelector('[data-home="today"]')?.focus({ preventScroll: true });
  }

  askView(connected) {
    if (!connected) {
      return `<h1 class="home-title" id="home-title">Asking needs your own AI.</h1>
      <p class="home-lede">Connect your OpenRouter account (billed to you) or run RISE on your computer with Kev. Rolling needs neither.</p>
      <div class="home-actions">
        <button class="btn btn-primary" type="button" data-ai="connect">Connect OpenRouter</button>
        <a class="btn btn-secondary" href="${LOCAL_RISE}" target="_blank" rel="noopener noreferrer">Run RISE locally</a>
        ${button('roll-instead', 'Roll instead', 'ghost')}
      </div>
      <details class="portal-ai-about"><summary>About your connection</summary><p class="home-help">${ABOUT_CONNECTION}</p></details>`;
    }
    return `<h1 class="home-title home-title-ask" id="home-title"><label for="home-intent">What would you like to read?</label></h1>
      <div class="home-field">
        <textarea class="input home-intent" id="home-intent" name="intent" rows="3" maxlength="240" aria-describedby="home-help"></textarea>
        <p class="home-help" id="home-help">${ASK_HELP}</p>
      </div>
      <div class="home-actions">${button('ask', 'Ask', 'primary')}${button('roll-instead', 'Roll instead', 'secondary')}
        <button class="btn btn-ghost btn-icon" type="button" data-jev-dictate="icon" aria-label="Speak your request" aria-pressed="false">${MIC_ICON}</button>
      </div>`;
  }

  resultView() {
    const { title, author, mood, byline, plan, note } = this.result;
    const part = (name, value, redraw = true) => `<li class="home-part">
        <div class="home-part-body"><p class="home-part-label">The ${name}</p>${value}</div>
        ${redraw ? `<button class="btn btn-ghost home-redraw" type="button" data-home="redraw-${name}" aria-label="Redraw the ${name}">${REDRAW_ICON}Redraw</button>` : ''}
      </li>`;
    return `<p class="home-mood"><span class="home-mood-dot" aria-hidden="true"></span>${escapeHtml(mood)}</p>
      <h1 class="home-title home-title-result" id="home-title">${escapeHtml(title)}</h1>
      <p class="home-byline">${escapeHtml(byline)}</p>
      <ul class="home-parts">
        ${part('text', `<p class="home-part-value">${escapeHtml([title, author].filter(Boolean).join(' · '))}</p>`)}
        ${part('mood', `<p class="home-part-value"><strong class="home-part-name">${escapeHtml(mood)}</strong> <span>${escapeHtml(capital(plan.join(', ')))}</span></p>`)}
        ${part('passage', '<div class="home-passage"></div>', false)}
      </ul>
      ${note ? `<p class="home-note" role="note">${escapeHtml(note)}</p>` : ''}
      <div class="home-actions">${button('enter', 'Start reading', 'primary')}${button('roll', 'Roll again', 'secondary')}${button('adjust', 'Adjust first', 'ghost')}</div>
      <button class="home-link" type="button" data-home="ask-open">Ask for something specific instead</button>`;
  }

  /** The opening lines, a placeholder while they load, or nothing if they cannot be read. */
  renderPassage() {
    const node = this.container.querySelector('.home-passage');
    if (!node || !this.result) return;
    const { lines } = this.result;
    node.innerHTML = lines === undefined
      ? '<span class="home-passage-loading" aria-hidden="true"><span></span><span></span><span></span></span>'
      : lines ? `<blockquote class="home-lines">${escapeHtml(lines)}</blockquote>` : '';
  }

  /** Draw the panel for the view. Runs only when the view, the result or the connection changes. */
  renderView() {
    const panel = this.container.querySelector('.home-panel');
    if (!panel) return;
    const connected = connectionState().kind !== 'none';
    panel.dataset.state = this.view;
    panel.querySelector('.home-view').innerHTML = this.view === 'result' ? this.resultView()
      : this.view === 'ask' ? this.askView(connected) : this.idleView();
    const field = panel.querySelector('#home-intent');
    if (field) field.value = this.draft;
    const today = panel.querySelector('.home-today');
    if (today && this.todayCard) this.todayCard.drawTodayCardMark(today);
    // The result is on the panel; the status line only speaks it.
    panel.querySelector('.home-status').classList.toggle('sr-only', this.view === 'result');
    this.renderPassage();
    this.attachDictation();
    this.renderBusy();
  }

  /**
   * Mark the work in progress without redrawing the panel: every control
   * holds, the one pressed says it is busy, and the sky quickens. The sky
   * lights the star a shown result names.
   */
  renderBusy() {
    const panel = this.container.querySelector('.home-panel');
    if (!panel) return;
    for (const control of panel.querySelectorAll('[data-home], .home-view [data-ai]')) {
      control.disabled = !!this.busy;
      if (control.dataset.home === this.busy) control.setAttribute('aria-busy', 'true');
      else control.removeAttribute('aria-busy');
    }
    const field = panel.querySelector('#home-intent');
    if (field) field.readOnly = this.busy === 'ask';
    this.sky?.setBusy(!!this.busy);
    this.sky?.flare(this.view === 'result' ? this.result.decision.workId : null);
  }

  attachDictation() {
    this.stopDictation?.();
    const form = this.container.querySelector('#home-form');
    this.stopDictation = form?.querySelector('[data-jev-dictate]') ? attachJevDictation(form) : null;
  }

  /** Lay the sky in after Home shows. If it cannot load, Home works without it. */
  async loadSky() {
    const host = this.container.querySelector('.home-sky');
    if (!host || this.sky || this._skyLoading || this._destroyed) return;
    this._skyLoading = true;
    try {
      const [{ NightSky }, { librarySky }] = await Promise.all([
        import('./night-library/NightSky.js'),
        import('../core/library-sky.js')
      ]);
      if (this._destroyed || this.container.querySelector('.home-sky') !== host) return;
      // A star the reader picks rolls for that work; picking the shown one again still changes the reading.
      this.sky = new NightSky(host, { sky: librarySky(), onPick: workId => void this.roll({ previous: this.result, workId }) });
      this.renderBusy();
      if (this._active) this.sky.start();
    } catch (error) {
      this.sky = null;
      console.warn('[Home] the sky could not load; the panel works without it.', error);
    } finally {
      this._skyLoading = false;
    }
  }

  setStatus(text) {
    const status = this.container.querySelector('[data-home-status]');
    if (status) status.textContent = text;
  }

  showError(title, details = '') {
    const alert = this.container.querySelector('.home-alert');
    if (!alert) return;
    alert.hidden = !title;
    alert.querySelector('.portal-alert-title').textContent = title;
    const more = alert.querySelector('.portal-alert-details');
    more.open = false;
    more.hidden = !details;
    alert.querySelector('.portal-alert-message').textContent = details;
  }

  /** Show a view: idle, result or ask. */
  show(view, { focus } = {}) {
    this.view = view;
    this.renderView();
    if (focus) this.focus(focus);
  }

  /** Mark the control `hook` names busy; null when nothing is in progress. */
  setBusy(hook) {
    this.busy = hook;
    this.renderBusy();
  }

  focus(selector) {
    this.container.querySelector(selector)?.focus({ preventScroll: true });
  }

  /** The roll's and the ask's code, loaded once. A load that fails is tried again next time. */
  async loadTools() {
    this.tools ||= Promise.all([
      import('../core/roll.js'),
      import('../core/jev-describe.js'),
      import('../app/jev-reading.js'),
      import('../app/invocation.js'),
      import('../content/library.js')
    ]).then(modules => Object.assign({}, ...modules)).catch(error => {
      this.tools = null;
      throw error;
    });
    return this.tools;
  }

  /** Words for a decision, all derived from the plan and the edition. */
  describe(tools, decision, { source, intent = '', temper = null }) {
    const work = tools.getTextById(decision.workId);
    let note = '';
    if (source === 'ask') {
      const { reference, limits } = tools.readJevRequest(intent);
      const parts = [];
      if (reference) parts.push(`You referenced “${reference.name}”. RISE treated it as a style (${reference.reads}), not as a ${reference.kind} to play.`);
      if (limits.length) parts.push(`RISE can’t ${limits.join(', or ')}. It matches the mood with its own synthesized music and abstract visuals instead.`);
      note = parts.join(' ');
    }
    const author = work?.author || '';
    const where = tools.SECTION_WORDS[decision.config.section];
    return {
      decision, source, temper, note,
      title: work?.title || decision.workId,
      author,
      // An asked reading has no temper; its mood is the reader's own words.
      mood: temper ? capital(temper) : 'As you asked',
      byline: capital([author, where && `from the ${where}`].filter(Boolean).join(', ')),
      // The whole description, for the status line that speaks it.
      meta: [author, where].filter(Boolean).join(' · '),
      plan: tools.summarizeJevPlan(decision.config)
    };
  }

  /** Describe a decision, show it as the result, fetch the lines it opens on, and speak it. */
  showResult(tools, decision, how) {
    const result = this.describe(tools, decision, how);
    this.result = result;
    void tools.openingLines(decision).catch(() => '').then(lines => {
      result.lines = lines;
      if (this.result === result) this.renderPassage();
    });
    this.show('result');
    const { title, meta, plan } = this.result;
    this.setStatus(how.source === 'ask' ? `Jev chose ${title}. ${plan.join(', ')}.` : `${title}. ${meta}. ${plan.join(', ')}.`);
  }

  /**
   * Roll. Any part given is kept (rollReading's contract): Roll again gives
   * only the previous result, a Redraw gives the two parts to keep, a star
   * gives its work. `from` names the control that asked, for focus after.
   */
  async roll(parts, { from = null } = {}) {
    if (this.busy) return;
    this.getAudioEngine()?.playClick();
    this.showError('');
    this.setBusy(from || 'roll');
    this.setStatus('Rolling…');
    let tools;
    let rolled;
    try {
      tools = await this.loadTools();
      rolled = tools.rollReading(parts);
    } catch (error) {
      // The roll's code did not arrive (a dropped connection), or the roll was
      // refused; whatever was showing stays and the controls are live.
      this.setBusy(null);
      this.setStatus('');
      this.showError('Couldn’t roll just now. Try again.', error?.message || '');
      return;
    }
    // Roll again and a Redraw keep the reader on the control they pressed.
    const again = this.view === 'result' && from;
    this.setBusy(null);
    this.showResult(tools, rolled.decision, { source: 'roll', temper: rolled.temper });
    this.focus(again ? `[data-home="${again}"]` : '[data-home="enter"]');
    // A small tick as the answer arrives, on phones that can give one.
    navigator.vibrate?.(10);
  }

  /** Draw one part again and keep the other two. A missing (null) temper is drawn. */
  redraw(part) {
    const previous = this.result;
    if (!previous) return;
    const { workId, config: { section } } = previous.decision;
    const keep = { text: { temper: previous.temper, section }, mood: { workId, section } }[part];
    void this.roll({ previous, ...keep }, { from: `redraw-${part}` });
  }

  openAsk() {
    if (this.busy) return;
    this.showError('');
    const connected = connectionState().kind !== 'none';
    this.show('ask', { focus: connected ? '#home-intent' : '.home-view [data-ai="connect"]' });
    this.setStatus(connected ? 'Ask for a mood, a style, a text, or all three.' : '');
  }

  async ask() {
    const field = this.container.querySelector('#home-intent');
    if (this.view !== 'ask' || this.busy || !field) return;
    this.draft = field.value;
    const intent = field.value.trim();
    if (intent.length < 3 || intent.length > 240) {
      this.setStatus(intent ? 'Keep it under 240 characters.' : 'Add a few words: a mood, a style, a text, or all three.');
      field.focus();
      return;
    }
    this.showError('');
    this.getAudioEngine()?.playClick();
    this.setBusy('ask');
    this.setStatus('Interpreting your request. This usually takes a few seconds.');
    let tools;
    let decision;
    try {
      // The one decision route every way in shares (src/app/invocation.js).
      tools = await this.loadTools();
      decision = await tools.requestComposedReading(intent, { admit: tools.validateJevRecommendation });
    } catch (error) {
      this.setBusy(null);
      this.focus('#home-intent');
      this.setStatus('');
      if (error?.code === 'NOT_CONNECTED') {
        this.showConnectionNotice('Connect OpenRouter or run RISE locally to ask for a specific reading. Rolling works without AI.');
      }
      this.showError('Couldn’t interpret that here. Your request is kept.', error?.message || '');
      return;
    }
    this.setBusy(null);
    this.showResult(tools, decision, { source: 'ask', intent });
    this.focus('[data-home="enter"]');
  }

  /** Start reading plays the reading; Adjust first opens it in Reader Setup. */
  async proceed(action) {
    if (!this.result || this.busy) return;
    this.setBusy(action);
    this.getAudioEngine()?.playClick();
    this.showError('');
    try {
      if (action === 'enter') {
        const firstReadPreview = this.result.source === 'roll' && !this.firstReadChoiceUsed;
        await this.onLaunchJevReading(this.result.decision, { firstReadPreview });
        if (firstReadPreview) this.firstReadChoiceUsed = true;
      }
      else await this.onAdjustReading(this.result.decision);
    } catch (error) {
      this.showError('That reading couldn’t be opened. Try again, or roll another.', error?.message || '');
    } finally {
      this.setBusy(null);
    }
  }

  /** The RISE sigil in the header lockup. */
  drawMarks() {
    this._marksDrawn = true;
    drawRiseSigil(this.container.querySelector('.sl-sigil'), { animate: false });
  }

  attachEvents() {
    const form = this.container.querySelector('#home-form');
    if (form) {
      this.renderView();
      form.addEventListener('submit', event => {
        event.preventDefault();
        void this.ask();
      });
      form.addEventListener('click', event => {
        const control = event.target.closest('[data-home]');
        if (!control || control.disabled) return;
        const action = control.dataset.home;
        if (action === 'roll' || action === 'roll-instead') void this.roll({ previous: this.result }, { from: action });
        else if (action.startsWith('redraw-')) this.redraw(action.slice('redraw-'.length));
        else if (action === 'ask-open') this.openAsk();
        else if (action === 'enter' || action === 'adjust') void this.proceed(action);
        else if (action === 'today') this.onNavigate('today');
      });
      form.addEventListener('input', event => {
        if (event.target.id === 'home-intent') this.draft = event.target.value;
      });
      form.addEventListener('keydown', event => {
        if (event.target.id === 'home-intent' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
    }

    if (!this._aiEventsAttached) {
      this._aiEventsAttached = true;
      this.container.addEventListener('click', event => {
        const control = event.target.closest('[data-ai]');
        if (!control || control.disabled) return;
        if (control.dataset.ai === 'connect') void this.connectOpenRouter();
        else if (control.dataset.ai === 'disconnect') {
          disconnect();
          this.showConnectionNotice('Disconnected. RISE forgot the key.');
        }
      });
    }

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

    // One Menu button opens every room as a sheet. While it is open, Tab
    // stays inside it and Escape closes it.
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
      const stops = [toggle, ...nav.querySelectorAll('button, a[href]')];
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

    this.container.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.closeMenu?.();
        this.onNavigate(item.dataset.nav);
      });
    });

    this.container.querySelector('.portal-continue')?.addEventListener('click', () => {
      this.getAudioEngine()?.playClick();
      this.onNavigate('chamber-session', this.getCurrentSession());
    });

    this.container.querySelectorAll('[data-action="guide"], [data-action="settings"]').forEach(link => {
      link.addEventListener('click', () => {
        this.getAudioEngine()?.playClick();
        this.closeMenu?.();
        window.dispatchEvent(new CustomEvent(link.dataset.action === 'guide' ? 'rise-open-guide' : 'rise-open-settings'));
      });
    });
  }

  activate() {
    if (this._active) return;
    this._active = true;
    if (!this._marksDrawn) this.drawMarks();
    if (this.sky) this.sky.start();
    else if (!this.demoMode) {
      // After first paint: the panel is already usable, and the sky is extra.
      requestAnimationFrame(() => setTimeout(() => void this.loadSky(), 0));
    }
    if (!this.demoMode) {
      if (this.todayCard) this.showToday(new Date());
      else {
        const afterPaint = globalThis.requestAnimationFrame || (next => setTimeout(next, 0));
        afterPaint(() => setTimeout(() => void this.loadToday(), 0));
      }
      this._stopDay = watchLocalDay(date => this.showToday(date));
    }
    // Leaving Home stopped dictation; an open request gets it back.
    if (this.view === 'ask') this.attachDictation();
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    // Every other room — and above all the Chamber — runs without it.
    this.sky?.stop();
    this._stopDay?.();
    this._stopDay = null;
    this.stopDictation?.();
    this.stopDictation = null;
  }

  destroy() {
    this.deactivate();
    this._destroyed = true;
    this.stopConnection?.();
    this.sky?.destroy();
    this.sky = null;
  }
}
