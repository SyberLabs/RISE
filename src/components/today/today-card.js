/**
 * Today's poem on Home: one button showing the day's mark (still), the date,
 * the poem's title and poet, and its first line. Reads the precomputed
 * openings, so Home never downloads a work to show it. Loaded after Home's
 * first paint; Home keeps a plain link until it arrives.
 */
import OPENINGS from '../../content/archive/today-openings.json' with { type: 'json' };
import { escapeHtml } from '../../core/sanitize.js';
import { poemTitle, todayPoem } from '../../core/today-poem.js';
import { drawMandala } from './mandala.js';

const FOLDS = 12;
const ARROW = '<svg class="home-today-go" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>';

export function todayCardMarkup(date = new Date()) {
  const pick = todayPoem(date);
  const title = poemTitle(pick.label);
  const poet = OPENINGS.works[pick.workId]?.author ?? '';
  const line = (OPENINGS.openings[pick.workId]?.[pick.entryId] ?? '').split('\n')[0];
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return `<button class="home-today-card sy-plate" type="button" data-home="today" data-seed="${escapeHtml(pick.seed)}"
      aria-label="${escapeHtml(`Read today's poem: ${title}, by ${poet}`)}">
      <canvas class="home-today-mark" aria-hidden="true"></canvas>
      <span class="home-today-body">
        <span class="home-today-eyebrow"><span>Today's poem,</span> <span>${escapeHtml(day)}</span></span>
        <span class="home-today-title">${escapeHtml(title)}</span>
        <span class="home-today-poet">${escapeHtml(poet)}</span>
        <span class="home-today-line">${escapeHtml(line)}</span>
      </span>
      ${ARROW}
    </button>`;
}

/** Draws the day's mark into a card under `root`, once and still. Home's sky is its live plate. */
export function drawTodayCardMark(root) {
  const card = root.querySelector('.home-today-card');
  const canvas = card?.querySelector('.home-today-mark');
  if (!canvas || canvas.dataset.drawn) return;
  canvas.dataset.drawn = 'true';
  drawMandala(canvas, card.dataset.seed, { folds: FOLDS, animate: false });
}
