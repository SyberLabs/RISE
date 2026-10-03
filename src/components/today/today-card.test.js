import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mandala.js', () => ({ drawMandala: vi.fn(() => ({ caption: '', cancel: vi.fn() })) }));

import { drawMandala } from './mandala.js';
import { drawTodayCardMark, todayCardMarkup } from './today-card.js';
import { poemTitle, todayPoem } from '../../core/today-poem.js';
import OPENINGS from '../../content/archive/today-openings.json' with { type: 'json' };

describe('the Home card', () => {
  afterEach(() => vi.clearAllMocks());

  it('names the day\'s poem, its poet and its first line, as one button into the Today view', () => {
    const date = new Date(2026, 9, 3, 9);
    const pick = todayPoem(date);
    const host = document.createElement('div');
    host.innerHTML = todayCardMarkup(date);
    const card = host.querySelector('[data-home="today"]');
    expect(card.tagName).toBe('BUTTON');
    expect(host.querySelector('.home-today-title').textContent).toBe(poemTitle(pick.label));
    expect(host.querySelector('.home-today-poet').textContent).toBe(OPENINGS.works[pick.workId].author);
    expect(host.querySelector('.home-today-line').textContent).toBe(OPENINGS.openings[pick.workId][pick.entryId].split('\n')[0]);
    expect(host.querySelector('.home-today-eyebrow').textContent).toMatch(/^Today's poem, /u);
    expect(card.getAttribute('aria-label'))
      .toBe(`Read today's poem: ${poemTitle(pick.label)}, by ${OPENINGS.works[pick.workId].author}`);
    expect(card.dataset.seed).toBe('2026-10-03');
  });

  it('escapes what it shows', () => {
    const host = document.createElement('div');
    host.innerHTML = todayCardMarkup(new Date(2026, 9, 3));
    expect(host.querySelector('script')).toBeNull();
  });

  it('draws the day\'s mark still, once, into the card', () => {
    const host = document.createElement('div');
    host.innerHTML = todayCardMarkup(new Date(2026, 9, 3));
    drawTodayCardMark(host);
    expect(drawMandala).toHaveBeenCalledWith(host.querySelector('.home-today-mark'), '2026-10-03', { folds: 12, animate: false });
    drawTodayCardMark(document.createElement('div'));
    expect(drawMandala).toHaveBeenCalledOnce();
  });
});
