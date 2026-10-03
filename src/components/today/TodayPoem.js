/**
 * The Today view: one poem per local day under a mandala drawn from the
 * date. Loads only the chosen work and checks the division's label against
 * the index, so a changed edition is an error rather than a different poem.
 */
import { releaseArchiveTexts } from '../../content/archive/index.js';
import { escapeHtml } from '../../core/sanitize.js';
import { localDateKey, poemTitle, todayPoem } from '../../core/today-poem.js';
import { roomAlert, roomEyebrow, roomHeader } from '../room-chrome.js';
import { drawMandala } from './mandala.js';
import './today-poem.css';

const FOLDS = 12;
const SKELETON = '<span class="today-skeleton"></span>'.repeat(6);

export class TodayPoem {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onBegin = options.onBegin || (async () => false);
    this._ticket = 0;
    this.show(new Date());
  }

  show(date) {
    this._events?.abort();
    this._mark?.cancel();
    this._mark = null;
    this._events = new AbortController();
    this.date = date;
    this.pick = todayPoem(date);
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
          <button type="button" class="btn btn-primary" data-begin disabled>Begin this poem</button>
          <p class="today-note">A new poem, and a new mark, at midnight.</p>
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

  async begin() {
    const { work, entry, entryIndex, divisions } = this;
    const button = this.container.querySelector('[data-begin]');
    if (!entry || !button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    // Busy until the reader opens (or fails to). Either way the view is
    // where the reader comes back to, so Begin is ready again after.
    await this.onBegin({
      text: entry.content,
      textSource: `${work.title} · ${poemTitle(entry.label)}`,
      wpm: work.defaultWpm,
      curve: work.defaultCurve,
      verseLines: entry.verse === true,
      continuation: {
        kind: 'library-division',
        workId: work.id,
        editionId: work.editionId,
        sourceRevision: work.sourceRevision,
        entryId: String(entry.id),
        entryIndex,
        entryCount: divisions.entries.length,
        noun: 'poem'
      },
      origin: { view: 'today', name: 'Today\'s poem' }
    });
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  /** Draws the mark once the view is visible, and turns to a new day's poem after midnight. */
  activate() {
    const now = new Date();
    if (localDateKey(now) !== this.pick.seed) this.show(now);
    if (this._mark) return;
    const canvas = this.container.querySelector('.today-mandala');
    this._mark = canvas && drawMandala(canvas, this.pick.seed, { folds: FOLDS });
    const caption = this.container.querySelector('[data-caption]');
    if (this._mark && caption) caption.textContent = `Seed ${this.pick.seed} · ${this._mark.caption} · ${FOLDS} folds`;
  }

  deactivate() {}

  destroy() {
    this._ticket++;
    this._events?.abort();
    this._mark?.cancel();
    this.container.innerHTML = '';
  }
}
