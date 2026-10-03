import { describe, expect, it } from 'vitest';
import { todayCardMarkup } from './today-card.js';
import { poemTitle, todayPoem } from '../../core/today-poem.js';
import { todayDecision } from '../../core/today-reading.js';
import OPENINGS from '../../content/archive/today-openings.json' with { type: 'json' };

const engineOf = decision => (decision.config.visualConfig.visualMode === 'attractor'
  ? 'attractor' : decision.config.visualConfig.interlocution.procedural[0]);

describe('the Home card', () => {
  it('shows the day\'s engine, mood, poem and first line, as one button that begins it', () => {
    for (const day of [3, 4, 7]) {
      const date = new Date(2026, 9, day, 9);
      const pick = todayPoem(date);
      const decision = todayDecision(pick);
      const host = document.createElement('div');
      host.innerHTML = todayCardMarkup(date);
      const card = host.querySelector('[data-home="today"]');
      expect(card.tagName).toBe('BUTTON');
      expect(card.querySelector('.home-today-still').getAttribute('src')).toBe(`/engine-stills/card/${engineOf(decision)}.webp`);
      expect(card.querySelector('.home-today-eyebrow').textContent.toLowerCase()).toBe(`today's poem · ${decision.temper}`);
      expect(card.querySelector('.home-today-title').textContent).toBe(poemTitle(pick.label));
      expect(card.querySelector('.home-today-line').textContent).toBe(OPENINGS.openings[pick.workId][pick.entryId]);
      expect(card.querySelector('.home-today-go').textContent).toBe('Begin today\'s poem');
      expect(card.getAttribute('aria-label'))
        .toBe(`Begin today's poem: ${poemTitle(pick.label)}, by ${OPENINGS.works[pick.workId].author}`);
    }
  });

  it('has no second solid key: the card is a line button over the image', () => {
    const host = document.createElement('div');
    host.innerHTML = todayCardMarkup(new Date(2026, 9, 3));
    expect(host.querySelector('.btn-primary')).toBeNull();
  });
});
