/**
 * The Today view: one poem per local day under a mandala drawn from the
 * date. Loads only the chosen work and checks the division's label against
 * the index, so a changed edition is an error rather than a different poem.
 */
import { resolveJevReading } from '../../app/jev-reading.js';
import { releaseArchiveTexts } from '../../content/archive/index.js';
import { summarizeJevPlan } from '../../core/jev-describe.js';
import { escapeHtml } from '../../core/sanitize.js';
import { localDateKey, watchLocalDay } from '../../core/local-day.js';
import { poemTitle, todayPoem } from '../../core/today-poem.js';
import { todayDecision } from '../../core/today-reading.js';
import { roomAlert, roomEyebrow, roomHeader } from '../room-chrome.js';
import { mountReadingBackdrop } from '../reading-backdrop.js';
import { drawMandala } from './mandala.js';
import './today-poem.css';

const FOLDS = 12;
const capital = text => (text ? text[0].toLocaleUpperCase('en') + text.slice(1) : '');
const SKELETON = '<span class="today-skeleton"></span>'.repeat(6);

export class TodayPoem {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onBegin = options.onBegin || (async () => false);
    this._ticket = 0;
    this._backdropTicket = 0;
    this.show(new Date());
  }

  show(date) {
    this._events?.abort();
    this._mark?.cancel();
    this._mark = null;
    // A new day is a new mood: the old engine goes with the page it ran behind.
    this.stopBackdrop();
    this._events = new AbortController();
    this.date = date;
    this.pick = todayPoem(date);
    this.decision = todayDecision(this.pick);
    this.work = releaseArchiveTexts().find(item => item.id === this.pick.workId) || null;
    this.entry = null;
    this.render();
    this.attachEvents();
    void this.load();
  }

  render() {
    const day = this.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const byline = this.work ? `${this.work.author}, from ${this.work.title}` : '';
    this.container.innerHTML = `<div class="today-room">
      <div class="today-backdrop" aria-hidden="true"></div>
      ${roomHeader({ back: 'Home', backLabel: 'Return to Home' })}
      <main class="today" id="main-content" aria-labelledby="today-title">
        ${roomEyebrow(`Today's poem, ${escapeHtml(day)}`, 'today-eyebrow')}
        <figure class="today-mark">
          <canvas class="today-mandala" aria-hidden="true"></canvas>
          <figcaption class="today-caption" data-caption>Seed ${escapeHtml(this.pick.seed)}</figcaption>
        </figure>
        <header class="today-head">
          <h1 class="today-title" id="today-title">${escapeHtml(poemTitle(this.pick.label))}</h1>
          <p class="today-byline">${escapeHtml(byline)}</p>
        </header>
        <div class="today-plate sy-plate"><div class="today-poem" data-poem aria-busy="true">${SKELETON}</div></div>
        <div class="today-actions">
          <p class="today-mood"><span class="today-mood-dot" aria-hidden="true"></span><span class="today-mood-name">${escapeHtml(capital(this.decision.temper))}</span></p>
          <p class="today-mood-plan">${escapeHtml(capital(summarizeJevPlan(this.decision.config).join(', ')))}</p>
          <button type="button" class="btn btn-primary" data-begin disabled>Begin this poem</button>
          <p class="today-status" data-begin-status role="status" aria-live="polite"></p>
          <p class="today-note">A new poem, a new mark and a new mood at midnight.</p>
        </div>
      </main></div>`;
  }

  attachEvents() {
    this.container.addEventListener('click', event => {
      if (event.target.closest('[data-action="back"]')) this.onNavigate('portal');
      else if (event.target.closest('[data-begin]')) void this.begin();
      else if (event.target.closest('[data-retry]')) void this.load();
    }, { signal: this._events.signal });
  }

  async load() {
    const ticket = ++this._ticket;
    const { entryId, label } = this.pick;
    this.setPoem('loading');
    try {
      if (!this.work) throw new Error('The work is not released.');
      const divisions = await this.work.getDivisions();
      const entryIndex = divisions.entries.findIndex(entry => String(entry.id) === String(entryId));
      const entry = divisions.entries[entryIndex];
      if (!entry || entry.label !== label) throw new Error('The division changed.');
      if (ticket !== this._ticket) return;
      Object.assign(this, { entry, entryIndex, divisions });
      this.setPoem('ready');
    } catch {
      if (ticket === this._ticket) this.setPoem('error');
    }
  }

  setPoem(state) {
    const poem = this.container.querySelector('[data-poem]');
    const begin = this.container.querySelector('[data-begin]');
    if (!poem || !begin) return;
    poem.setAttribute('aria-busy', String(state === 'loading'));
    begin.disabled = state !== 'ready';
    if (state === 'loading') {
      poem.innerHTML = SKELETON;
    } else if (state === 'error') {
      poem.innerHTML = roomAlert({
        title: 'Error.',
        message: 'Today\'s poem could not be loaded.',
        className: 'today-error',
        action: '<button type="button" class="btn btn-secondary" data-retry>Try again</button>'
      });
    } else {
      poem.innerHTML = this.entry.content.split('\n')
        .map(line => (line.trim() ? `<span class="today-line">${escapeHtml(line)}</span>` : '<span class="today-gap"></span>'))
        .join('');
    }
  }

  /**
   * Opens the day's exact poem in the day's look: the roll's visual, sound,
   * pace and type, through the same edition gate as Home's rolls.
   */
  async begin() {
    const button = this.container.querySelector('[data-begin]');
    const status = this.container.querySelector('[data-begin-status]');
    if (!this.entry || !button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (status) status.textContent = '';
    try {
      const reading = await resolveJevReading(this.decision, { entryId: this.pick.entryId, label: this.pick.label });
      // Busy until the reader opens (or fails to). Either way the view is
      // where the reader comes back to, so Begin is ready again after.
      await this.onBegin({
        ...reading,
        origin: { view: 'today', name: 'Today\'s poem' },
        continuation: reading.continuation && { ...reading.continuation, noun: 'poem' }
      });
    } catch {
      if (status) status.textContent = 'This poem could not be opened. Try again.';
    }
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  /** Draws the mark once the view is visible; while shown, turns to each new day's poem. */
  activate() {
    this._active = true;
    const now = new Date();
    if (localDateKey(now) !== this.pick.seed) this.show(now);
    this.drawMark();
    void this.startBackdrop();
    this._stopDay?.();
    this._stopDay = watchLocalDay(date => {
      this.show(date);
      this.drawMark();
      void this.startBackdrop();
    });
    this._activeEvents?.abort();
    this._activeEvents = new AbortController();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._backdrop?.pause();
      else this._backdrop?.resume();
    }, { signal: this._activeEvents.signal });
  }

  /** The day's engine behind the page: mounted once per day, then paused and resumed with the view. */
  async startBackdrop() {
    if (this._backdrop) {
      this._backdrop.resume();
      return;
    }
    const host = this.container.querySelector('.today-backdrop');
    if (!host) return;
    const ticket = ++this._backdropTicket;
    try {
      const backdrop = await mountReadingBackdrop(host, this.decision);
      if (ticket !== this._backdropTicket || !host.isConnected) {
        backdrop?.destroy();
        return;
      }
      this._backdrop = backdrop;
      if (!this._active) backdrop?.pause();
    } catch (error) {
      console.warn('[Today] the backdrop could not start; the page works without it.', error);
    }
  }

  stopBackdrop() {
    this._backdropTicket++;
    this._backdrop?.destroy();
    this._backdrop = null;
  }

  drawMark() {
    if (this._mark) return;
    const canvas = this.container.querySelector('.today-mandala');
    this._mark = canvas && drawMandala(canvas, this.pick.seed, { folds: FOLDS });
    const caption = this.container.querySelector('[data-caption]');
    if (this._mark && caption) caption.textContent = `Seed ${this.pick.seed} · ${this._mark.caption} · ${FOLDS} folds`;
  }

  deactivate() {
    this._active = false;
    this._stopDay?.();
    this._stopDay = null;
    this._activeEvents?.abort();
    this._backdrop?.pause();
  }

  destroy() {
    this.deactivate();
    this.stopBackdrop();
    this._ticket++;
    this._events?.abort();
    this._mark?.cancel();
    this.container.innerHTML = '';
  }
}
