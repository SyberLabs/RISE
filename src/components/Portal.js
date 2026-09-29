/**
 * Portal Component — RISE Home: the Oracle.
 *
 * RISE is a machine you approach. Home is one object and one key, ROLL,
 * which composes a reading by chance inside bounds (src/core/roll.js).
 * The reading rises in the object's window, and three keys follow it:
 * ENTER plays it, ROLL AGAIN draws another, ADJUST opens Reader Setup with
 * everything already set, where the Visual Navigator, Timing and Sound are.
 *
 *   Oracle proposes → Reader Setup alters → Chamber performs.
 *
 * Asking is the escape hatch, not the front door: after a first roll, "or
 * ask for something specific" turns the window into a text field and Jev
 * answers into the same three keys. What RISE cannot do for a request is
 * said before anything plays (src/core/jev-describe.js).
 *
 * The result, rolled or asked, survives navigation and reload in the tab.
 * Every other room is one Menu away; Privacy and Terms stay posted.
 */

import './Portal.css';
import { drawRiseSigil } from './atlas.js';
import { isJevSceneDemoPath, sceneSampleFromPath } from '../core/jev-demo-path.js';
import { attachJevDictation } from './jev-dictation.js';
import { OracleObject } from './oracle/OracleObject.js';

const ICON_ATTRS = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SETTINGS_PATH = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>';
const MIC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
const ORACLE_KEY = 'rise-oracle-v1';
const ASK_HELP = 'Only your request is sent, to RISE’s AI decision service. Your reading and saved work stay here. Voice input may use your browser’s speech service.';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readStored() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ORACLE_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value) {
  try {
    if (value) sessionStorage.setItem(ORACLE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ORACLE_KEY);
  } catch {
    // Private windows may refuse storage; the result still holds in memory.
  }
}

export class Portal {
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
    // idle → rolling → result; result → ask → asking → result.
    this.state = 'idle';
    // { decision, source: 'roll' | 'ask', intent, temper }
    this.result = null;
    this.rolled = false;
    this.draft = '';
    this.tools = null;

    this.render();
    this.attachEvents();
    this.syncContinue();
    this.restore();
  }

  /** Router re-entry hook — refresh the living entries on return */
  update() {
    const demoMode = isJevSceneDemoPath(window.location.pathname);
    if (demoMode !== this.demoMode) {
      const wasActive = this._active;
      this.deactivate();
      this.object?.destroy();
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
      this.restore();
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
      <div class="portal${this.demoMode ? '' : ' portal-oracle'}">
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
              <button class="portal-nav-link" type="button" data-nav="chamber">Reader setup</button>
              <button class="portal-nav-link" type="button" data-action="guide">Guide</button>
              <button class="portal-nav-settings" type="button" data-action="settings" aria-label="Settings" title="Settings">
                <svg ${ICON_ATTRS}>${SETTINGS_PATH}</svg><span class="portal-nav-settings-label">Settings</span>
              </button>
              <p class="portal-nav-group" aria-hidden="true">Other ways in</p>
              <!-- A page of its own: another skin over the same roll (src/wormhole). -->
              <a class="portal-nav-link portal-nav-minor" href="/wormhole.html">Wormhole</a>
              <p class="portal-nav-group" aria-hidden="true">More rooms</p>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="chapel">Chapel</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="scriptorium">Scriptorium</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="visual-lab">Visual Lab</button>
              <button class="portal-nav-link portal-nav-minor" type="button" data-nav="curia">Curia</button>
            </nav>
          </div>
        </header>

        <main class="portal-main">
          ${this.demoMode ? this.renderDemo() : this.renderOracle()}
          <button class="portal-continue" type="button" data-action="continue" hidden>
            <span class="continue-label">Continue reading</span>
            <span class="continue-title"></span>
            <svg class="continue-go" ${ICON_ATTRS}><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
          </button>
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
      </div>
    `;
    this._marksDrawn = false;
    this.object = null;
    const stage = this.container.querySelector('.oracle-stage');
    if (stage) {
      this.object = new OracleObject(stage, { onShake: () => this.shake() });
      stage.addEventListener('oracle-layout', () => this.fitAnswer());
    }
    if (this._active) this.drawMarks();
  }

  renderOracle() {
    return `<section class="oracle-home" aria-labelledby="oracle-title">
      <h1 class="oracle-title" id="oracle-title">What will you encounter?</h1>
      <form class="oracle" id="oracle-form" novalidate>
        <div class="oracle-stage" aria-label="The Oracle. Flick it, or shake your phone, to roll.">
          <canvas class="oracle-canvas" aria-hidden="true"></canvas>
          <div class="oracle-shadow" aria-hidden="true"></div>
          <div class="oracle-space">
            <div class="oracle-glass">
              <p class="oracle-cursor" aria-hidden="true">_</p>
              <div class="oracle-answer" hidden>
                <strong class="oracle-answer-title"></strong>
                <span class="oracle-answer-meta"></span>
                <span class="oracle-answer-mood"></span>
              </div>
              <label class="oracle-label sr-only" for="oracle-intent">Ask for a reading</label>
              <textarea class="oracle-intent" id="oracle-intent" name="intent" rows="4" maxlength="240"
                spellcheck="false" placeholder="ask for a reading_" aria-describedby="oracle-help" hidden></textarea>
            </div>
            <div class="oracle-plate" aria-hidden="true"><b>RISE</b> MODEL J-82 · PHOSPHOR VOLUME</div>
          </div>
        </div>
        <div class="oracle-keys"></div>
        <p class="oracle-help" id="oracle-help" hidden>${ASK_HELP}</p>
        <p class="oracle-note" role="note" hidden></p>
        <p class="oracle-status" role="status" aria-live="polite"><span data-oracle-status></span><span data-jev-dictation-status></span></p>
        <div class="portal-alert oracle-alert" role="alert" hidden>
          <div class="portal-alert-body">
            <p class="portal-alert-title"></p>
            <details class="portal-alert-details">
              <summary>Details</summary>
              <p class="portal-alert-message"></p>
            </details>
          </div>
        </div>
        <button class="oracle-ask-link" type="button" data-oracle="ask-open" hidden>or ask for something specific</button>
      </form>
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

  /** The keys under the object, for the current state. */
  renderKeys() {
    const keys = this.container.querySelector('.oracle-keys');
    if (!keys) return;
    const busy = this.state === 'rolling' || this.state === 'asking' || this.launching;
    const key = (action, label, extra = '') =>
      `<button class="oracle-key ${extra}" type="${action === 'ask' ? 'submit' : 'button'}" data-oracle="${action}"${busy ? ' disabled' : ''}>${label}</button>`;
    // One key leads and the rest follow beneath it, smaller: the lit key keeps
    // one place (ROLL, then ENTER, then ASK) and what else can be done sits below.
    const minor = (...keysHtml) => `<div class="oracle-keys-minor">${keysHtml.join('')}</div>`;
    if (this.state === 'result') {
      keys.innerHTML = key('enter', 'Enter', 'oracle-key-primary oracle-key-roll')
        + minor(key('roll', 'Roll again', 'oracle-key-minor'), key('adjust', 'Adjust', 'oracle-key-minor'));
    } else if (this.state === 'ask' || this.state === 'asking') {
      keys.innerHTML = key('ask', 'Ask', 'oracle-key-primary oracle-key-roll')
        + minor(
          `<button class="oracle-key oracle-key-minor oracle-key-icon" type="button" data-jev-dictate="icon" aria-label="Speak your request" aria-pressed="false">${MIC_ICON}</button>`,
          key('roll', 'Roll', 'oracle-key-minor')
        );
    } else {
      keys.innerHTML = key('roll', 'Roll', 'oracle-key-primary oracle-key-roll');
    }
    if (busy) {
      const active = { rolling: 'roll', asking: 'ask' }[this.state] || this.launching;
      keys.querySelector(`[data-oracle="${active}"]`)?.setAttribute('aria-busy', 'true');
    }
    const form = this.container.querySelector('#oracle-form');
    this.stopDictation?.();
    this.stopDictation = form?.querySelector('[data-jev-dictate]') ? attachJevDictation(form) : null;
  }

  /** The window, the notes and the ask link, for the current state. */
  renderGlass() {
    const root = this.container.querySelector('#oracle-form');
    if (!root) return;
    const asking = this.state === 'ask' || this.state === 'asking';
    const showing = this.state === 'result' && this.result;
    root.querySelector('.oracle-cursor').hidden = asking || Boolean(showing);
    root.querySelector('.oracle-answer').hidden = !showing;
    const field = root.querySelector('.oracle-intent');
    field.hidden = !asking;
    field.readOnly = this.state === 'asking';
    root.querySelector('.oracle-help').hidden = !asking;
    root.querySelector('.oracle-ask-link').hidden = asking || !this.rolled;
    // The result is already in the window; the status line only speaks it.
    root.querySelector('.oracle-status').classList.toggle('sr-only', Boolean(showing));
    const note = root.querySelector('.oracle-note');
    note.hidden = !(showing && this.result.note);
    note.textContent = showing ? this.result.note || '' : '';
    if (showing) {
      root.querySelector('.oracle-answer-title').textContent = this.result.title;
      // The window says little: a name, an author, and the one word for a roll's
      // temper. Section and plan are spoken by the status line and shown in Reader
      // Setup, where the reader can change them.
      root.querySelector('.oracle-answer-meta').textContent = this.result.author;
      const mood = root.querySelector('.oracle-answer-mood');
      mood.textContent = this.result.mood;
      mood.hidden = !this.result.mood;
      this.fitAnswer();
    }
  }

  /**
   * A long result (a two-line title, a long plan) must sit inside the window,
   * not run over its bezel. Step the whole answer down until it fits; the
   * stylesheet keeps the small type from going below a readable size.
   */
  fitAnswer() {
    const stage = this.container.querySelector('.oracle-stage');
    const answer = this.container.querySelector('.oracle-answer');
    const radius = parseFloat(stage?.style.getPropertyValue('--r'));
    if (!answer || answer.hidden || !radius) return;
    const room = radius * 0.86;
    answer.style.setProperty('--fit', '1');
    for (let fit = 1; fit > 0.6 && answer.offsetHeight > room; fit -= 0.05) {
      answer.style.setProperty('--fit', fit.toFixed(2));
    }
  }

  setStatus(text) {
    const status = this.container.querySelector('[data-oracle-status]');
    if (status) status.textContent = text;
  }

  showError(title, details = '') {
    const alert = this.container.querySelector('.oracle-alert');
    if (!alert) return;
    alert.hidden = !title;
    alert.querySelector('.portal-alert-title').textContent = title;
    const more = alert.querySelector('.portal-alert-details');
    more.open = false;
    more.hidden = !details;
    alert.querySelector('.portal-alert-message').textContent = details;
  }

  setState(state, { focus } = {}) {
    this.state = state;
    this.renderKeys();
    this.renderGlass();
    if (focus) this.container.querySelector(focus)?.focus({ preventScroll: true });
  }

  async loadTools() {
    this.tools ||= Promise.all([
      import('../core/roll.js'),
      import('../core/jev-describe.js'),
      import('../app/jev-reading.js'),
      import('../app/invocation.js'),
      import('../content/library.js')
    ]).then(modules => Object.assign({}, ...modules));
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
    return {
      decision, source, intent, temper, note,
      title: work?.title || decision.workId,
      author: work?.author || '',
      mood: source === 'roll' ? temper : '',
      // The whole description, for the status line that speaks it.
      meta: [work?.author, tools.SECTION_WORDS[decision.config.section]].filter(Boolean).join(' · '),
      plan: tools.summarizeJevPlan(decision.config)
    };
  }

  keep() {
    if (!this.result) {
      writeStored({ rolled: this.rolled, draft: this.draft });
      return;
    }
    const { decision, source, intent, temper } = this.result;
    writeStored({ rolled: this.rolled, draft: this.draft, result: { decision, source, intent, temper } });
  }

  /** Bring back the result, and the reader's draft, after navigation or reload. */
  async restore() {
    const stored = readStored();
    if (!stored || this.demoMode) return;
    this.rolled = stored.rolled === true;
    this.draft = typeof stored.draft === 'string' ? stored.draft : '';
    const field = this.container.querySelector('.oracle-intent');
    if (field) field.value = this.draft;
    if (stored.result?.decision) {
      try {
        const tools = await this.loadTools();
        tools.validateJevRecommendation(stored.result.decision);
        this.result = this.describe(tools, stored.result.decision, stored.result);
        this.setState('result');
        return;
      } catch {
        this.result = null;
        this.keep();
      }
    }
    this.setState('idle');
  }

  shake() {
    if (this.state === 'ask' || this.state === 'asking') return;
    void this.roll();
  }

  async roll() {
    if (this.state === 'rolling' || this.state === 'asking' || this.launching) return;
    this.object?.requestMotion();
    this.getAudioEngine()?.playClick();
    this.showError('');
    const first = !this.rolled;
    this.setState('rolling');
    this.setStatus('Rolling…');
    this.object?.kick(1.1);
    let tools;
    try {
      [tools] = await Promise.all([this.loadTools(), this.object?.sink()]);
    } catch (error) {
      // The roll's code did not arrive (a dropped connection); whatever was
      // showing rises again and the key is live.
      this.tools = null;
      this.setState(this.result ? 'result' : 'idle');
      this.setStatus('');
      this.showError('Couldn’t roll just now. Try again.', error?.message || '');
      await this.object?.rise();
      return;
    }
    const previous = this.result?.source === 'roll' ? this.result : null;
    const { decision, temper } = tools.rollReading({ previous });
    this.result = this.describe(tools, decision, { source: 'roll', temper });
    this.rolled = true;
    this.keep();
    this.setState('result', { focus: first ? '[data-oracle="enter"]' : '[data-oracle="roll"]' });
    this.setStatus(`${this.result.title}. ${this.result.meta}. ${this.result.plan.join(', ')}.`);
    await this.object?.rise();
  }

  async openAsk() {
    this.showError('');
    if (this.result) await this.object?.sink();
    this.setState('ask', { focus: '.oracle-intent' });
    this.setStatus('Ask for a mood, a style, a text, or all three.');
    await this.object?.rise();
  }

  async ask() {
    const field = this.container.querySelector('.oracle-intent');
    const intent = field.value.trim();
    if (this.state !== 'ask') return;
    if (intent.length < 3 || intent.length > 240) {
      this.setStatus(intent ? 'Keep it under 240 characters.' : 'Add a few words: a mood, a style, a text, or all three.');
      this.object?.kick(0.25);
      field.focus();
      return;
    }
    this.showError('');
    this.getAudioEngine()?.playClick();
    this.setState('asking');
    this.object?.setBusy(true);
    this.setStatus('Interpreting your request. This usually takes a few seconds.');
    try {
      // The one decision route every way in shares (src/app/invocation.js).
      const tools = await this.loadTools();
      const decision = await tools.requestComposedReading(intent, { admit: tools.validateJevRecommendation });
      await this.object?.sink();
      this.result = this.describe(tools, decision, { source: 'ask', intent });
      this.keep();
      this.setState('result', { focus: '[data-oracle="enter"]' });
      this.setStatus(`Jev chose ${this.result.title}. ${this.result.plan.join(', ')}.`);
      await this.object?.rise();
    } catch (error) {
      this.setState('ask', { focus: '.oracle-intent' });
      this.setStatus('');
      this.showError('Couldn’t interpret that here. Your request is kept.', error?.message || '');
      this.object?.kick(0.3);
    } finally {
      this.object?.setBusy(false);
    }
  }

  /** ENTER plays the reading; ADJUST opens it in Reader Setup. */
  async proceed(action) {
    if (!this.result || this.launching) return;
    this.launching = action;
    this.renderKeys();
    this.getAudioEngine()?.playClick();
    this.showError('');
    try {
      if (action === 'enter') await this.onLaunchJevReading(this.result.decision);
      else await this.onAdjustReading(this.result.decision);
    } catch (error) {
      this.showError('That reading couldn’t be opened. Try again, or roll another.', error?.message || '');
    } finally {
      this.launching = null;
      this.renderKeys();
    }
  }

  /** The RISE sigil in the header lockup. */
  drawMarks() {
    this._marksDrawn = true;
    drawRiseSigil(this.container.querySelector('.sl-sigil'), { animate: false });
  }

  attachEvents() {
    const form = this.container.querySelector('#oracle-form');
    if (form) {
      this.renderKeys();
      this.renderGlass();
      form.addEventListener('submit', event => {
        event.preventDefault();
        void this.ask();
      });
      form.addEventListener('click', event => {
        const action = event.target.closest('[data-oracle]')?.dataset.oracle;
        if (!action || event.target.closest('button')?.disabled) return;
        if (action === 'roll') void this.roll();
        else if (action === 'ask-open') void this.openAsk();
        else if (action === 'enter' || action === 'adjust') void this.proceed(action);
      });
      const field = form.querySelector('.oracle-intent');
      field.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
      field.addEventListener('input', () => {
        this.draft = field.value;
        this.keep();
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
    this.object?.start();
    // Leaving Home stopped dictation; an open request gets it back.
    if (this.state === 'ask') this.renderKeys();
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    // Every other room — and above all the Chamber — runs without it.
    this.object?.stop();
    this.stopDictation?.();
    this.stopDictation = null;
  }

  destroy() {
    this.deactivate();
    this.object?.destroy();
  }
}
