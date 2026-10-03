/**
 * Today's poem on Home: one button over a still of the day's engine, naming
 * the mood, the poem and its first line. Pressing it begins the reading; there
 * is no page in between. Reads the precomputed openings and a 480 px card still
 * (scripts/build-card-stills.mjs), so Home never downloads a work or a full
 * still. Loaded after Home's first paint; Home keeps a plain link until then.
 */
import OPENINGS from '../../content/archive/today-openings.json' with { type: 'json' };
import { escapeHtml } from '../../core/sanitize.js';
import { poemTitle, todayPoem } from '../../core/today-poem.js';
import { todayDecision } from '../../core/today-reading.js';

const capital = text => (text ? text[0].toLocaleUpperCase('en') + text.slice(1) : '');

function engineOf(decision) {
  const visual = decision.config.visualConfig;
  return visual.visualMode === 'attractor' ? 'attractor' : visual.interlocution.procedural[0];
}

export function todayCardMarkup(date = new Date()) {
  const pick = todayPoem(date);
  const decision = todayDecision(pick);
  const title = poemTitle(pick.label);
  const poet = OPENINGS.works[pick.workId]?.author ?? '';
  const line = OPENINGS.openings[pick.workId]?.[pick.entryId] ?? '';
  return `<button class="home-today-card" type="button" data-home="today"
      aria-label="${escapeHtml(`Begin today's poem: ${title}, by ${poet}`)}">
      <img class="home-today-still" src="/engine-stills/card/${escapeHtml(engineOf(decision))}.webp" alt="" loading="lazy" decoding="async">
      <span class="home-today-body">
        <span class="home-today-eyebrow">Today's poem · ${escapeHtml(capital(decision.temper))}</span>
        <span class="home-today-title">${escapeHtml(title)}</span>
        <span class="home-today-line">${escapeHtml(line)}</span>
        <span class="home-today-go">Begin today's poem</span>
      </span>
    </button>`;
}
