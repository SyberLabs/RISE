/**
 * Portal Component — RISE Home: already reading.
 *
 * Home is a reading in progress. On arrival the day's poem (the reading
 * launchToday opens) runs silently, full-screen: its own engine behind
 * (reading-backdrop.js), its opening streaming in the centre
 * (reading-stream.js), named in the bar below. **Read it with sound** opens
 * it; **Another reading** rolls a vivid one in its place (src/core/roll.js),
 * which **Adjust** opens in Reader Setup with everything already set.
 *
 *   Home proposes → Reader Setup alters → Chamber performs.
 *
 * **Ask for a reading** sits in the Menu and opens a dialog (home-ask.js).
 * What RISE cannot do for a request is said before anything plays
 * (src/core/jev-describe.js). An asked reading becomes the one Home shows.
 * Today's poem opens through the app's launchToday (the day's exact poem,
 * as /today and the Menu open it); a rolled or asked one through
 * launchJevReading.
 *
 * Every word and control is in the first paint; the poem, the engine (on the
 * shared ReadingStage) and the stream load right after it, and Home works on
 * ink if the engine cannot run. Nothing runs while another room shows. The
 * reading lives with Home while it is open; a fresh load starts on today's poem.
 * Every other room is one Menu away; Privacy and Terms stay posted.
 */

import './Portal.css';
import './portal-home.css';
import { drawRiseSigil } from './atlas.js';
import { isJevSceneDemoPath, sceneSampleFromPath } from '../core/jev-demo-path.js';
import { HomeAsk, alertMarkup, showAlert } from './home-ask.js';
import { claimOpenRouterReturn } from '../core/openrouter-callback.js';
import { localDateKey, watchLocalDay } from '../core/local-day.js';

const ICON_ATTRS = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SETTINGS_PATH = '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>';
const TODAY = 'Today’s poem';
const CONTINUE = `<button class="portal-continue" type="button" data-action="continue" hidden>
            <span class="continue-label">Continue reading</span>
            <span class="continue-title"></span>
            <svg class="continue-go" ${ICON_ATTRS}><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>
          </button>`;
const capital = text => text ? text[0].toLocaleUpperCase('en') + text.slice(1) : '';
const button = (hook, label, variant, extra = '') =>
  `<button class="btn btn-${variant}" type="button" data-home="${hook}"${extra}>${label}</button>`;
const afterPaint = next => (globalThis.requestAnimationFrame || (run => setTimeout(run, 0)))(() => setTimeout(next, 0));
const whenIdle = run => (globalThis.requestIdleCallback ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 200));

/**
 * The reading on screen, from a decision and how it came: today's poem
 * (`today`, the day's pick, with its `title` and `author`), a roll (`temper`)
 * or an ask (`intent`). All Home says about it and how it opens; `tools`
 * names the work and the plan of a rolled or asked one.
 */
function homeReading(decision, { today, title, author, temper = null, intent = '' }, tools) {
  if (today) {
    const heading = [title, author].filter(Boolean).join(', by ');
    return {
      decision, temper: decision.temper, heading, label: TODAY, spoken: `${TODAY}: ${heading}`, note: '', link: 'library',
      // The day's exact poem, as /today and the Menu open it.
      today: true
    };
  }
  const work = tools.getTextById(decision.workId);
  const heading = [work?.title || decision.workId, work?.author].filter(Boolean).join(', by ');
  // An asked reading has no temper; its mood is the reader's own words.
  const mood = temper ? capital(temper) : 'As you asked';
  const plan = tools.summarizeJevPlan(decision.config).join(', ');
  let note = '';
  if (intent) {
    const { reference, limits } = tools.readJevRequest(intent);
    const parts = [];
    if (reference) parts.push(`You referenced “${reference.name}”. RISE treated it as a style (${reference.reads}), not as a ${reference.kind} to play.`);
    if (limits.length) parts.push(`RISE can’t ${limits.join(', or ')}. It matches the mood with its own synthesized music and abstract visuals instead.`);
    note = parts.join(' ');
  }
  return {
    decision, temper, heading, note, link: 'adjust',
    label: `${mood}: ${plan}`,
    spoken: `${mood}. ${heading}. ${capital(plan)}.`,
    // A rolled reading offers the first-read preview, the first time one plays.
    firstReadPreview: !intent
  };
}

export class Portal {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.getAudioEngine = options.getAudioEngine || (() => null);
    this.getCurrentSession = options.getCurrentSession || (() => null);
    this.onLaunchJevReading = options.onLaunchJevReading || (async () => {});
    this.onLaunchToday = options.onLaunchToday || (async () => {});
    this.onAdjustReading = options.onAdjustReading || (async () => {});
    this.onLaunchJevSample = options.onLaunchJevSample || (async () => {});
    this.demoMode = options.demoMode === true;
    this._active = false;
    // The work in progress, or null: a data-home hook (roll, ask, enter, adjust), or 'today' from the Menu.
    this.busy = null;
    // The reading Home shows (homeReading), and its opening ({ text, verse }, null while it loads).
    this.reading = null;
    this.opening = null;
    // Whether the reader chose the reading (rolled or asked); today's poem then stays out.
    this.chosen = false;
    // The day whose poem Home loaded, so it loads once a day.
    this.todayKey = null;
    this.stage = null;
    this.stream = null;
    this.firstReadChoiceUsed = false;
    this.tools = null;
    const returned = claimOpenRouterReturn();
    if (returned) {
      // The reader connected from the ask dialog; bring them back to it.
      void import('../core/openrouter-oauth.js')
        .then(({ finishOpenRouterReturn }) => finishOpenRouterReturn(returned))
        .then(() => {
          if (this._active) this.asking?.open();
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
      this.stage?.destroy();
      this.stream?.destroy();
      this.stage = this.stream = null;
      this.demoMode = demoMode;
      this.render();
      this.attachEvents();
      if (this.reading) this.present(this.reading, this.opening);
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
    this.asking?.destroy();
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
              <button class="portal-nav-link" type="button" data-action="today">Today's poem</button>
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
      </div>
    `;
    this.asking = this.demoMode ? null : new HomeAsk(this.container.querySelector('.portal'), {
      getAudioEngine: this.getAudioEngine,
      loadTools: () => this.loadTools(),
      onAnswer: (decision, intent) => this.answered(decision, intent),
      onFailure: (title, details) => this.showError(title, details),
      onBusy: pending => this.setBusy(pending ? 'ask' : null)
    });
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
      ${alertMarkup('home-alert')}
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

  /** Name the reading in the bar, speak it, and play it if Home is showing. */
  present(reading, opening = null) {
    this.reading = reading;
    this.opening = opening;
    const home = this.container.querySelector('.home');
    if (!home) return;
    home.querySelector('.home-label').textContent = reading.label;
    const title = home.querySelector('.home-title');
    title.textContent = reading.heading;
    // A desk sets the name on one line; one too long for it is whole here.
    title.title = reading.heading;
    const note = home.querySelector('.home-note');
    note.textContent = reading.note;
    note.hidden = !reading.note;
    // Today's poem points on into the Library; a rolled or asked reading can be adjusted.
    const link = home.querySelector('.home-link');
    link.dataset.home = reading.link;
    link.textContent = reading.link === 'adjust' ? 'Adjust' : 'Library';
    this.setStatus(reading.spoken);
    this.renderOpening();
    this.renderBusy();
    if (this._active) this.play();
  }

  /** The opening as text for assistive technology; the stream beside it is decoration. */
  renderOpening() {
    const node = this.container.querySelector('[data-home-opening]');
    if (node) node.textContent = this.opening?.text || '';
  }

  /** Run the shown reading: its engine behind, its opening in the stream. */
  play() {
    if (!this.reading) return;
    void this.showEngine();
    void this.playStream();
  }

  /** The reading's engine on the stage, which cross-fades it in over the last. */
  async showEngine() {
    try {
      const { ReadingStage } = await import('./reading-backdrop.js');
      if (!this._active) return;
      this.stage ||= new ReadingStage(this.container.querySelector('.home-engine'));
      void this.stage.show(this.reading.decision);
    } catch (error) {
      console.warn('[Home] the engine could not load; the reading shows on ink.', error);
    }
  }

  /**
   * Stream the opening once it is here, in the reading's own unit, pace and
   * curve, and verse a line at a time as the Chamber reads it. Until then, or
   * if it cannot stream, the stage holds still.
   */
  async playStream() {
    const { reading, opening } = this;
    const host = this.container.querySelector('.home-stream');
    if (!host) return;
    this.stream?.stop();
    this.setProgress(0);
    if (!opening?.text) {
      host.replaceChildren();
      return;
    }
    try {
      const { ReadingStream } = await import('./reading-stream.js');
      if (this.opening !== opening || !this._active) return;
      this.stream ||= new ReadingStream(host, { onProgress: fraction => this.setProgress(fraction) });
      const { chunkMode, wpm, curve } = reading.decision.config;
      this.stream.play(opening.text, { chunkMode, wpm, curve, verse: opening.verse });
      // The first word shows: fetch Another reading's code while the reader reads, so the press waits on nothing.
      // A failed fetch stays silent; loadTools forgets it and the press tries again.
      // A reader who asked to save data (Save-Data) fetches it only on the press.
      if (!this.tools && !globalThis.navigator?.connection?.saveData) whenIdle(() => { if (this._active && !this.demoMode) this.loadTools().catch(() => {}); });
    } catch (error) {
      console.warn('[Home] the stream could not run; the opening holds still.', error);
      const still = document.createElement('p');
      still.className = 'home-still';
      still.textContent = opening.text.split('\n')[0];
      host.replaceChildren(still);
    }
  }

  setProgress(fraction) {
    const fill = this.container.querySelector('.home-progress-fill');
    if (fill) fill.style.transform = `scaleX(${fraction})`;
  }

  /** Today's poem, the reading Home opens on: loaded after first paint, once a day. */
  async loadToday(date = new Date()) {
    const key = localDateKey(date);
    if (key === this.todayKey) return;
    this.todayKey = key;
    try {
      const [{ todayPoem, poemTitle }, { todayDecision }, { default: openings }] = await Promise.all([
        import('../core/today-poem.js'),
        import('../core/today-reading.js'),
        import('../content/archive/today-openings.json')
      ]);
      if (this._destroyed) return;
      const pick = todayPoem(date);
      const poem = homeReading(todayDecision(pick), {
        today: pick, title: poemTitle(pick.label), author: openings.works[pick.workId]?.author
      });
      // A reading the reader chose stays; only today's poem turns over.
      if (!this.chosen) this.present(poem, { text: openings.openings[pick.workId]?.[pick.entryId] || '', verse: true });
    } catch (error) {
      this.todayKey = null;
      console.warn('[Home] today\'s poem could not load.', error);
      if (!this.reading) this.showError('Today’s poem couldn’t load. Try another reading.', error?.message || '');
    }
  }

  setStatus(text) {
    const status = this.container.querySelector('[data-home-status]');
    if (status) status.textContent = text;
  }

  showError(title, details = '') {
    showAlert(this.container.querySelector('.home-alert'), title, details);
  }

  /** Mark the control `hook` names busy; null when nothing is in progress. */
  setBusy(hook) {
    this.busy = hook;
    this.renderBusy();
  }

  /** Every control holds while work is in progress, and the one pressed says it is busy. The dialog holds its own. */
  renderBusy() {
    for (const control of this.container.querySelectorAll('.home [data-home], .portal-nav [data-home]')) {
      control.disabled = !!this.busy || (control.dataset.home === 'enter' && !this.reading);
      if (control.dataset.home === this.busy) control.setAttribute('aria-busy', 'true');
      else control.removeAttribute('aria-busy');
    }
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

  /** Make a decision the reader chose Home's reading, then fetch the opening it streams. */
  showDecision(tools, decision, how) {
    this.chosen = true;
    const reading = homeReading(decision, how, tools);
    this.present(reading);
    void tools.openingLines(decision).catch(() => null).then(opening => {
      if (this.reading !== reading || !opening) return;
      this.opening = opening;
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
    try {
      tools = await this.loadTools();
    } catch (error) {
      // The roll's code did not arrive (a dropped connection); whatever was
      // showing stays and the controls are live.
      this.setBusy(null);
      this.showError('Couldn’t roll just now. Try again.', error?.message || '');
      return;
    }
    this.setBusy(null);
    const previous = this.reading && { temper: this.reading.temper, decision: this.reading.decision };
    const rolled = tools.rollReading({ previous, vivid: true });
    this.showDecision(tools, rolled.decision, { temper: rolled.temper });
    // Busy, the key was disabled and lost focus; the reader stays on it.
    this.focus('[data-home="roll"]');
    // A small tick as the answer arrives, on phones that can give one.
    navigator.vibrate?.(10);
  }

  /** An admitted answer from the ask dialog becomes Home's reading. */
  async answered(decision, intent) {
    this.showDecision(await this.loadTools(), decision, { intent });
    this.focus('[data-home="enter"]');
  }

  /** The Menu's Today's poem: the day's exact poem, straight into the reader. */
  async beginToday() {
    if (this.busy) return;
    this.setBusy('today');
    this.getAudioEngine()?.playClick();
    this.showError('');
    try {
      await this.onLaunchToday();
    } catch (error) {
      this.showError('Today’s poem couldn’t be opened. Try again.', error?.message || '');
    } finally {
      this.setBusy(null);
    }
  }

  /** Read it with sound opens the reading (launchToday or launchJevReading); Adjust opens it in Reader Setup. */
  async proceed(action) {
    const reading = this.reading;
    if (!reading || this.busy) return;
    this.setBusy(action);
    this.getAudioEngine()?.playClick();
    this.showError('');
    try {
      if (action === 'adjust') await this.onAdjustReading(reading.decision);
      else if (reading.today) await this.onLaunchToday();
      else {
        const preview = reading.firstReadPreview && !this.firstReadChoiceUsed;
        await this.onLaunchJevReading(reading.decision, { firstReadPreview: preview });
        if (preview) this.firstReadChoiceUsed = true;
      }
    } catch (error) {
      this.showError('That reading couldn’t be opened. Try again, or try another reading.', error?.message || '');
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
      if (!this.busy) this.asking.open();
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

    // Today's poem from the Menu begins the day's exact poem, whatever Home is showing.
    nav.querySelector('[data-action="today"]').addEventListener('click', () => {
      this.closeMenu?.();
      void this.beginToday();
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
    this.stage?.resume();
    this.play();
    afterPaint(() => void this.loadToday());
    this._stopDay = watchLocalDay(date => void this.loadToday(date));
    if (this._askOnShow) {
      this._askOnShow = false;
      this.asking.open();
    }
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    // Every other room — and above all the Chamber — runs without it.
    this.stage?.pause();
    this.stream?.stop();
    this._stopDay?.();
    this._stopDay = null;
    this.asking?.close();
  }

  destroy() {
    this.deactivate();
    this._destroyed = true;
    this.asking?.destroy();
    this.stage?.destroy();
    this.stream?.destroy();
    this.stage = this.stream = null;
  }
}
