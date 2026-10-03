/**
 * Portal Component — RISE Home: already reading.
 *
 * Home is a reading in progress. On arrival the day's poem (the reading the
 * Today page plays) runs silently, full-screen: its own engine behind
 * (reading-backdrop.js), its opening streaming in the centre
 * (reading-stream.js), named in the bar below. **Read it with sound** opens
 * it; **Another reading** rolls a vivid one in its place (src/core/roll.js),
 * which **Adjust** opens in Reader Setup with everything already set.
 *
 *   Home proposes → Reader Setup alters → Chamber performs.
 *
 * **Ask for a reading** sits in the Menu and opens a dialog. It needs the
 * reader's own AI (their OpenRouter account, or Kev on their computer);
 * without one the dialog says so. What RISE cannot do for a request is said
 * before anything plays (src/core/jev-describe.js). An asked reading becomes
 * the one Home shows.
 *
 * Every word and control is in the first paint; the poem, the engine and the
 * stream load right after it, and Home works on ink if the engine cannot run.
 * Nothing runs while another room shows. The reading lives with Home while it
 * is open; a fresh load starts on today's poem.
 * Every other room is one Menu away; Privacy and Terms stay posted.
 */

import './Portal.css';
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
const ASK_HELP = 'Only your request is sent, to your connected OpenRouter account or local Kev. Your reading and saved work stay here. Voice input may use your browser’s speech service.';
const ABOUT_CONNECTION = 'OpenRouter requests are billed to your account. The key stays in this tab’s memory and is forgotten when you disconnect, reload, or close the tab. It is never sent to SyberLabs. Browser extensions can read page memory; revoke keys in your OpenRouter settings.';
const LOCAL_RISE = 'https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md';
const TODAY = 'Today’s poem';
// How long the old engine stays while the new one fades in over it (portal-home.css).
const CROSSFADE_MS = 900;
const CONTINUE = `<button class="portal-continue" type="button" data-action="continue" hidden>
            <span class="continue-label">Continue reading</span>
            <span class="continue-title"></span>
            <svg class="continue-go" ${ICON_ATTRS}><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
          </button>`;
const alert = className => `<div class="portal-alert ${className}" role="alert" hidden>
          <div class="portal-alert-body">
            <p class="portal-alert-title"></p>
            <details class="portal-alert-details">
              <summary>Details</summary>
              <p class="portal-alert-message"></p>
            </details>
          </div>
        </div>`;

const capital = text => text ? text[0].toLocaleUpperCase('en') + text.slice(1) : '';
const button = (hook, label, variant, extra = '') =>
  `<button class="btn btn-${variant}" type="${hook === 'ask' ? 'submit' : 'button'}" data-home="${hook}"${extra}>${label}</button>`;
const afterPaint = next => (globalThis.requestAnimationFrame || (run => setTimeout(run, 0)))(() => setTimeout(next, 0));

export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.onLaunchJevReading = options.onLaunchJevReading || (async () => {});
    this.onAdjustReading = options.onAdjustReading || (async () => {});
    this.onBeginSession = options.onBeginSession || (async () => false);
    this.onLaunchJevSample = options.onLaunchJevSample || (async () => {});
    this.demoMode = options.demoMode === true;
    this._active = false;
    // The data-home hook of the work in progress (roll, ask, enter, adjust), or null.
    this.busy = null;
    /**
     * The reading Home shows: { source: 'today' | 'roll' | 'ask', decision,
     * temper, label, heading, spoken, note, text, chunkMode, wpm, curve, verse,
     * pick }. `text` is the opening, undefined while it loads.
     */
    this.reading = null;
    // { decision, backdrop, layer }: the engine behind the reading.
    this.engine = null;
    this._engineTicket = 0;
    this.stream = null;
    this.firstReadChoiceUsed = false;
    this.draft = '';
    this.tools = null;
    this.stopConnection = subscribeConnection(() => this.renderConnection());
    if (isLocalRise()) void detectLocalKev();
    const returned = claimOpenRouterReturn();
    if (returned) {
      // The reader connected from the ask dialog; bring them back to it.
      void import('../core/openrouter-oauth.js')
        .then(({ finishOpenRouterReturn }) => finishOpenRouterReturn(returned))
        .then(() => {
          if (this._active) this.openAsk();
          else this._askOnShow = true;
        });
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
      this.stopEngine();
      this.stream?.destroy();
      this.stream = null;
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
      if (this.reading) this.present(this.reading);
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
        ${this.demoMode ? '' : `<div class="home-engine" aria-hidden="true"></div>
        <div class="home-scrim" aria-hidden="true"></div>`}
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
              ${this.demoMode ? '' : '<button class="portal-nav-link" type="button" data-home="ask-open">Ask for a reading</button>'}
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
          <!-- Conspicuously posted, which is the standard CalOPPA sets and
               the reason these sit on the Portal rather than inside a room.
               Generated from PRIVACY.md and TERMS.md by build-legal.mjs. -->
          <span class="portal-legal">
            <a href="/privacy.html" class="portal-footer-link portal-legal-link">Privacy</a>
            <a href="/terms.html" class="portal-footer-link portal-legal-link">Terms</a>
          </span>
        </footer>
        ${this.demoMode ? '' : this.renderAskDialog()}
      </div>
    `;
    this._marksDrawn = false;
    if (this._active) this.drawMarks();
  }

  /**
   * The reading under way: the stream in the centre, the bar that names it
   * below. Every word and control is here before the poem loads. Continue is
   * after the bar in focus order and drawn above it.
   */
  renderHome() {
    return `<section class="home" aria-labelledby="home-title">
      <div class="home-stage">
        <div class="home-stream" aria-hidden="true"></div>
        <p class="sr-only" data-home-opening></p>
      </div>
      ${alert('home-alert')}
      <div class="home-bar">
        <div class="home-caption">
          <p class="home-label">${TODAY}</p>
          <h1 class="home-title" id="home-title"></h1>
          <p class="home-note" role="note" hidden></p>
        </div>
        <div class="home-actions">
          ${button('enter', 'Read it with sound', 'primary', ' disabled')}
          ${button('roll', 'Another reading', 'secondary')}
          <button class="home-link" type="button" data-home="library">Library</button>
        </div>
      </div>
      ${CONTINUE}
      <div class="home-progress" aria-hidden="true"><span class="home-progress-fill"></span></div>
      <p class="sr-only" role="status" aria-live="polite"><span data-home-status></span></p>
    </section>`;
  }

  /** Asking, in a native dialog the Menu opens. Its view is drawn as it opens. */
  renderAskDialog() {
    return `<dialog class="home-ask" aria-labelledby="home-ask-title">
      <form class="home-ask-form" id="home-form" novalidate>
        <div class="home-view"></div>
        <p class="home-ask-status" role="status" aria-live="polite"><span data-ask-status></span><span data-jev-dictation-status></span></p>
        ${alert('home-ask-alert')}
        <div class="portal-ai" id="portal-ai">${this.renderConnectionLine()}</div>
      </form>
    </dialog>`;
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

  /** What is connected, in the ask dialog. Not connected, the dialog's own words say what asking needs. */
  renderConnectionLine() {
    const state = connectionState();
    const line = state.kind === 'openrouter'
      ? `${escapeHtml('Jev through your OpenRouter account, billed to your OpenRouter account.')} <button class="portal-link" type="button" data-ai="disconnect">Disconnect</button>`
      : state.kind === 'local' ? escapeHtml('Kev on this computer. No hosted inference bill.') : '';
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
    if (this.askDialog()?.open) this.renderAsk();
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

  askView(connected) {
    if (!connected) {
      return `<h2 class="home-ask-title" id="home-ask-title">Asking needs your own AI.</h2>
      <p class="home-lede">Connect your OpenRouter account (billed to you) or run RISE on your computer with Kev. Another reading needs neither.</p>
      <div class="home-ask-actions">
        <button class="btn btn-primary" type="button" data-ai="connect">Connect OpenRouter</button>
        <a class="btn btn-secondary" href="${LOCAL_RISE}" target="_blank" rel="noopener noreferrer">Run RISE locally</a>
        ${button('ask-cancel', 'Cancel', 'ghost')}
      </div>
      <details class="portal-ai-about"><summary>About your connection</summary><p class="home-help">${ABOUT_CONNECTION}</p></details>`;
    }
    return `<h2 class="home-ask-title" id="home-ask-title"><label for="home-intent">What would you like to read?</label></h2>
      <div class="home-field">
        <textarea class="input home-intent" id="home-intent" name="intent" rows="3" maxlength="240" aria-describedby="home-help"></textarea>
        <p class="home-help" id="home-help">${ASK_HELP}</p>
      </div>
      <div class="home-ask-actions">${button('ask', 'Ask', 'primary')}
        <button class="btn btn-ghost btn-icon" type="button" data-jev-dictate="icon" aria-label="Speak your request" aria-pressed="false">${MIC_ICON}</button>
        ${button('ask-cancel', 'Cancel', 'ghost')}
      </div>`;
  }

  askDialog() {
    return this.container.querySelector('dialog.home-ask');
  }

  /** Draw the dialog's view for the connection, keeping what was typed. */
  renderAsk() {
    const dialog = this.askDialog();
    const connected = connectionState().kind !== 'none';
    dialog.querySelector('.home-view').innerHTML = this.askView(connected);
    const field = dialog.querySelector('#home-intent');
    if (field) field.value = this.draft;
    this.attachDictation();
    this.renderBusy();
  }

  /** Name the reading in the bar, speak it, and play it if Home is showing. */
  present(reading) {
    this.reading = reading;
    const home = this.container.querySelector('.home');
    if (!home) return;
    home.querySelector('.home-label').textContent = reading.label;
    home.querySelector('.home-title').textContent = reading.heading;
    const note = home.querySelector('.home-note');
    note.textContent = reading.note || '';
    note.hidden = !reading.note;
    // Today's poem points on into the Library; a rolled or asked reading can be adjusted.
    const link = home.querySelector('.home-link');
    const adjust = reading.source !== 'today';
    link.dataset.home = adjust ? 'adjust' : 'library';
    link.textContent = adjust ? 'Adjust' : 'Library';
    this.setStatus(reading.spoken);
    this.renderOpening();
    this.renderBusy();
    if (this._active) this.play();
  }

  /** The opening as text for assistive technology; the stream beside it is decoration. */
  renderOpening() {
    const node = this.container.querySelector('[data-home-opening]');
    if (node) node.textContent = this.reading?.text || '';
  }

  /** Run the shown reading: its engine behind, its opening in the stream. */
  play() {
    if (!this.reading) return;
    void this.showEngine(this.reading.decision);
    void this.playStream();
  }

  /**
   * Mount the decision's engine in a new layer over the old one, fade it in,
   * then destroy the old. A reading without an engine (or a device that
   * cannot run one) fades to ink.
   */
  async showEngine(decision) {
    if (this.engine?.decision === decision) {
      this.engine.backdrop?.resume();
      return;
    }
    const host = this.container.querySelector('.home-engine');
    if (!host) return;
    const ticket = ++this._engineTicket;
    const layer = document.createElement('div');
    layer.className = 'home-engine-layer';
    host.append(layer);
    let backdrop = null;
    try {
      const { mountReadingBackdrop } = await import('./reading-backdrop.js');
      if (ticket === this._engineTicket) backdrop = await mountReadingBackdrop(layer, decision);
    } catch (error) {
      console.warn('[Home] the engine could not start; the reading shows on ink.', error);
    }
    if (ticket !== this._engineTicket || !layer.isConnected) {
      backdrop?.destroy();
      layer.remove();
      return;
    }
    const old = this.engine;
    this.engine = { decision, backdrop, layer };
    if (!this._active) backdrop?.pause();
    afterPaint(() => layer.classList.add('is-shown'));
    if (old) {
      old.layer.classList.remove('is-shown');
      setTimeout(() => {
        old.backdrop?.destroy();
        old.layer.remove();
      }, CROSSFADE_MS);
    }
  }

  stopEngine() {
    this._engineTicket++;
    this.engine?.backdrop?.destroy();
    this.engine?.layer.remove();
    this.engine = null;
  }

  /** Stream the opening once it is here. Until then, or if it cannot stream, the stage holds still. */
  async playStream() {
    const reading = this.reading;
    const host = this.container.querySelector('.home-stream');
    if (!host) return;
    this.stream?.stop();
    this.setProgress(0);
    if (!reading.text) {
      host.replaceChildren();
      return;
    }
    try {
      const { ReadingStream } = await import('./reading-stream.js');
      if (this.reading !== reading || !this._active) return;
      this.stream ||= new ReadingStream(host, { onProgress: fraction => this.setProgress(fraction) });
      this.stream.play(reading.text, { chunkMode: reading.chunkMode, wpm: reading.wpm, curve: reading.curve, verse: reading.verse });
    } catch (error) {
      console.warn('[Home] the stream could not run; the opening holds still.', error);
      const still = document.createElement('p');
      still.className = 'home-still';
      still.textContent = reading.text.split('\n')[0];
      host.replaceChildren(still);
    }
  }

  setProgress(fraction) {
    const fill = this.container.querySelector('.home-progress-fill');
    if (fill) fill.style.transform = `scaleX(${fraction})`;
  }

  /** Today's poem, the reading Home opens on. Loaded after first paint. */
  async loadToday(date = new Date()) {
    try {
      const [{ todayPoem, poemTitle }, { todayDecision }, { default: openings }] = await Promise.all([
        import('../core/today-poem.js'),
        import('../core/today-reading.js'),
        import('../content/archive/today-openings.json')
      ]);
      if (this._destroyed) return;
      const pick = todayPoem(date);
      const decision = todayDecision(pick);
      const author = openings.works[pick.workId]?.author;
      const heading = [poemTitle(pick.label), author].filter(Boolean).join(', by ');
      const { wpm, curve } = decision.config;
      const poem = {
        source: 'today', pick, decision, temper: decision.temper,
        label: TODAY, heading, spoken: `${TODAY}: ${heading}`, note: '',
        text: openings.openings[pick.workId]?.[pick.entryId] || '',
        chunkMode: 'phrase', wpm, curve, verse: true
      };
      // A reading the reader chose stays; only today's poem turns over.
      if (!this.reading || this.reading.source === 'today') this.present(poem);
    } catch (error) {
      console.warn('[Home] today\'s poem could not load.', error);
      if (!this.reading) this.showError('Today’s poem couldn’t load. Try another reading.', error?.message || '');
    }
  }

  setStatus(text) {
    const status = this.container.querySelector('[data-home-status]');
    if (status) status.textContent = text;
  }

  setAskStatus(text) {
    const status = this.container.querySelector('[data-ask-status]');
    if (status) status.textContent = text;
  }

  /** An alert on Home, or in the ask dialog (`where`). */
  showError(title, details = '', where = '.home-alert') {
    const alert = this.container.querySelector(where);
    if (!alert) return;
    alert.hidden = !title;
    alert.querySelector('.portal-alert-title').textContent = title;
    const more = alert.querySelector('.portal-alert-details');
    more.open = false;
    more.hidden = !details;
    alert.querySelector('.portal-alert-message').textContent = details;
  }

  showAskError(title, details = '') {
    this.showError(title, details, '.home-ask-alert');
  }

  /** Mark the control `hook` names busy; null when nothing is in progress. */
  setBusy(hook) {
    this.busy = hook;
    this.renderBusy();
  }

  /** Every control holds while work is in progress, and the one pressed says it is busy. */
  renderBusy() {
    for (const control of this.container.querySelectorAll('[data-home], .home-ask [data-ai]')) {
      control.disabled = !!this.busy || (control.dataset.home === 'enter' && !this.reading);
      if (control.dataset.home === this.busy) control.setAttribute('aria-busy', 'true');
      else control.removeAttribute('aria-busy');
    }
    const field = this.container.querySelector('#home-intent');
    if (field) field.readOnly = this.busy === 'ask';
  }

  attachDictation() {
    this.stopDictation?.();
    const form = this.container.querySelector('#home-form');
    this.stopDictation = form?.querySelector('[data-jev-dictate]') ? attachJevDictation(form) : null;
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
    const heading = [work?.title || decision.workId, work?.author].filter(Boolean).join(', by ');
    // An asked reading has no temper; its mood is the reader's own words.
    const mood = temper ? capital(temper) : 'As you asked';
    const plan = tools.summarizeJevPlan(decision.config).join(', ');
    const { chunkMode, wpm, curve } = decision.config;
    return {
      source, decision, temper, note, heading,
      label: `${mood}: ${plan}`,
      spoken: `${mood}. ${heading}. ${capital(plan)}.`,
      chunkMode, wpm, curve, verse: false
    };
  }

  /** Make a decision Home's reading, then fetch the opening it streams. */
  showDecision(tools, decision, how) {
    const reading = this.describe(tools, decision, how);
    this.present(reading);
    void tools.openingLines(decision).catch(() => '').then(text => {
      reading.text = text;
      if (this.reading !== reading) return;
      this.renderOpening();
      if (this._active) void this.playStream();
    });
  }

  /** Another reading: a vivid roll, never the one showing. */
  async roll() {
    if (this.busy) return;
    this.getAudioEngine()?.playClick();
    this.showError('');
    this.setBusy('roll');
    let tools;
    let rolled;
    try {
      tools = await this.loadTools();
      rolled = tools.rollReading({ previous: this.reading, vivid: true });
    } catch (error) {
      // The roll's code did not arrive (a dropped connection), or the roll was
      // refused; whatever was showing stays and the controls are live.
      this.setBusy(null);
      this.showError('Couldn’t roll just now. Try again.', error?.message || '');
      return;
    }
    this.setBusy(null);
    this.showDecision(tools, rolled.decision, { source: 'roll', temper: rolled.temper });
    // Busy, the key was disabled and lost focus; the reader stays on it.
    this.focus('[data-home="roll"]');
    // A small tick as the answer arrives, on phones that can give one.
    navigator.vibrate?.(10);
  }

  openAsk() {
    const dialog = this.askDialog();
    if (!dialog || this.busy) return;
    this.showAskError('');
    this.renderAsk();
    if (!dialog.open) dialog.showModal();
    const connected = connectionState().kind !== 'none';
    this.focus(connected ? '#home-intent' : '.home-ask [data-ai="connect"]');
    this.setAskStatus(connected ? 'Ask for a mood, a style, a text, or all three.' : '');
  }

  async ask() {
    const field = this.container.querySelector('#home-intent');
    if (this.busy || !field) return;
    this.draft = field.value;
    const intent = field.value.trim();
    if (intent.length < 3 || intent.length > 240) {
      this.setAskStatus(intent ? 'Keep it under 240 characters.' : 'Add a few words: a mood, a style, a text, or all three.');
      field.focus();
      return;
    }
    this.showAskError('');
    this.getAudioEngine()?.playClick();
    this.setBusy('ask');
    this.setAskStatus('Interpreting your request. This usually takes a few seconds.');
    let tools;
    let decision;
    try {
      // The one decision route every way in shares (src/app/invocation.js).
      tools = await this.loadTools();
      decision = await tools.requestComposedReading(intent, { admit: tools.validateJevRecommendation });
    } catch (error) {
      this.setBusy(null);
      this.focus('#home-intent');
      this.setAskStatus('');
      if (error?.code === 'NOT_CONNECTED') {
        this.showConnectionNotice('Connect OpenRouter or run RISE locally to ask for a specific reading. Another reading works without AI.');
      }
      this.showAskError('Couldn’t interpret that here. Your request is kept.', error?.message || '');
      return;
    }
    this.setBusy(null);
    this.setAskStatus('');
    this.askDialog().close();
    this.showDecision(tools, decision, { source: 'ask', intent });
    this.focus('[data-home="enter"]');
  }

  /** Read it with sound plays the reading; Adjust opens it in Reader Setup. */
  async proceed(action) {
    const reading = this.reading;
    if (!reading || this.busy) return;
    this.setBusy(action);
    this.getAudioEngine()?.playClick();
    this.showError('');
    try {
      if (action === 'adjust') await this.onAdjustReading(reading.decision);
      else if (reading.source === 'today') await this.beginToday(reading);
      else {
        const firstReadPreview = reading.source === 'roll' && !this.firstReadChoiceUsed;
        await this.onLaunchJevReading(reading.decision, { firstReadPreview });
        if (firstReadPreview) this.firstReadChoiceUsed = true;
      }
    } catch (error) {
      this.showError('That reading couldn’t be opened. Try again, or try another reading.', error?.message || '');
    } finally {
      this.setBusy(null);
    }
  }

  /**
   * Today's poem opens as the Today page's Begin opens it: the day's exact
   * division, in the day's look, as a poem. Its origin is Home's, so leaving
   * the reading comes back here.
   */
  async beginToday({ decision, pick }) {
    const { resolveJevReading } = await import('../app/jev-reading.js');
    const reading = await resolveJevReading(decision, { entryId: pick.entryId, label: pick.label });
    const opened = await this.onBeginSession({
      ...reading,
      continuation: reading.continuation && { ...reading.continuation, noun: 'poem' }
    });
    if (opened === false) throw new Error('The poem could not be opened.');
  }

  /** The RISE sigil in the header lockup. */
  drawMarks() {
    this._marksDrawn = true;
    drawRiseSigil(this.container.querySelector('.sl-sigil'), { animate: false });
  }

  attachEvents() {
    const home = this.container.querySelector('.home');
    home?.addEventListener('click', event => {
      const control = event.target.closest('[data-home]');
      if (!control || control.disabled) return;
      const action = control.dataset.home;
      if (action === 'roll') void this.roll();
      else if (action === 'enter' || action === 'adjust') void this.proceed(action);
      else if (action === 'library') {
        this.getAudioEngine()?.playClick();
        this.onNavigate('library');
      }
    });

    const form = this.container.querySelector('#home-form');
    if (form) {
      form.addEventListener('submit', event => {
        event.preventDefault();
        void this.ask();
      });
      form.addEventListener('click', event => {
        if (event.target.closest('[data-home="ask-cancel"]')) this.askDialog().close();
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
      this.askDialog().addEventListener('close', () => {
        this.stopDictation?.();
        this.stopDictation = null;
      });
      // A dialog cannot be dismissed while its request is in flight.
      this.askDialog().addEventListener('cancel', event => {
        if (this.busy === 'ask') event.preventDefault();
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
    // Closing the dialog returns focus to the Menu button, where asking began.
    nav.querySelector('[data-home="ask-open"]')?.addEventListener('click', () => {
      this.getAudioEngine()?.playClick();
      setMenu(false, { restoreFocus: true });
      this.openAsk();
    });

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
    if (this.demoMode) return;
    // After first paint: the bar is already there; the poem, engine and stream follow.
    if (this.reading) this.play();
    else afterPaint(() => void this.loadToday());
    this._stopDay = watchLocalDay(date => void this.loadToday(date));
    this._visibility = new AbortController();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.engine?.backdrop?.pause();
      else this.engine?.backdrop?.resume();
    }, { signal: this._visibility.signal });
    if (this._askOnShow) {
      this._askOnShow = false;
      this.openAsk();
    }
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    // Every other room — and above all the Chamber — runs without it.
    this.engine?.backdrop?.pause();
    this.stream?.stop();
    this._stopDay?.();
    this._stopDay = null;
    this._visibility?.abort();
    this.stopDictation?.();
    this.stopDictation = null;
    if (this.askDialog()?.open) this.askDialog().close();
  }

  destroy() {
    this.deactivate();
    this._destroyed = true;
    this.stopConnection?.();
    this.stopEngine();
    this.stream?.destroy();
    this.stream = null;
  }
}
