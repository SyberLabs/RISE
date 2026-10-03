import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hill = { id: 0, label: 'The Hill', verse: true, content: 'x' };
const anne = {
  id: 1,
  label: 'Anne Rutledge',
  verse: true,
  content: 'Out of me unworthy and unknown\nThe vibrations of deathless music;'
};
const work = {
  id: 'spoon-river-anthology',
  title: 'Spoon River Anthology',
  author: 'Edgar Lee Masters',
  editionId: 'ed',
  sourceRevision: 'rev',
  defaultWpm: 200,
  defaultCurve: 'flat',
  getDivisions: vi.fn()
};

vi.mock('../../content/archive/index.js', () => ({ releaseArchiveTexts: () => [work] }));
vi.mock('../../core/today-poem.js', async importOriginal => ({
  ...await importOriginal(),
  todayPoem: date => ({
    workId: 'spoon-river-anthology',
    entryId: 1,
    label: 'Anne Rutledge',
    seed: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    dayNumber: 1
  })
}));
vi.mock('./mandala.js', () => ({
  drawMandala: vi.fn(() => ({ caption: 'a 1 · b 2 · c 3 · d 4', cancel: vi.fn() }))
}));

import { TodayPoem } from './TodayPoem.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('TodayPoem', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });
  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('shows today\'s poem with its lines, then begins exactly that division', async () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const onBegin = vi.fn(async () => true);
    const view = new TodayPoem(container, { onBegin });
    view.activate();
    expect(container.querySelector('#today-title').textContent).toBe('Anne Rutledge');
    expect(container.querySelector('.today-byline').textContent).toBe('Edgar Lee Masters, from Spoon River Anthology');
    expect(container.querySelector('[data-begin]').disabled).toBe(true);
    await flush();
    const lines = [...container.querySelectorAll('.today-line')].map(node => node.textContent);
    expect(lines).toEqual(['Out of me unworthy and unknown', 'The vibrations of deathless music;']);
    expect(container.querySelector('[data-caption]').textContent).toMatch(/^Seed \d{4}-\d\d-\d\d · a 1 · b 2 · c 3 · d 4 · 12 folds$/);
    container.querySelector('[data-begin]').click();
    await flush();
    expect(onBegin).toHaveBeenCalledWith(expect.objectContaining({
      text: anne.content,
      textSource: 'Spoon River Anthology · Anne Rutledge',
      verseLines: true,
      origin: { view: 'today', name: 'Today\'s poem' },
      continuation: expect.objectContaining({
        kind: 'library-division',
        workId: 'spoon-river-anthology',
        editionId: 'ed',
        sourceRevision: 'rev',
        entryId: '1',
        entryIndex: 1,
        entryCount: 2
      })
    }));
    // Leaving the reading returns here; the poem can be begun again.
    expect(container.querySelector('[data-begin]').disabled).toBe(false);
    expect(container.querySelector('[data-begin]').hasAttribute('aria-busy')).toBe(false);
    view.destroy();
  });

  it('lets Begin be pressed again when the reading could not open', async () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, { onBegin: vi.fn(async () => false) });
    await flush();
    container.querySelector('[data-begin]').click();
    await flush();
    expect(container.querySelector('[data-begin]').disabled).toBe(false);
    view.destroy();
  });

  it('refuses a division whose label changed, and Try again recovers', async () => {
    work.getDivisions.mockResolvedValueOnce({ entries: [hill, { ...anne, label: 'Someone else' }] });
    const view = new TodayPoem(container, {});
    await flush();
    expect(container.querySelector('[role="alert"]').textContent).toContain('Today\'s poem could not be loaded.');
    expect(container.querySelector('[data-begin]').disabled).toBe(true);
    work.getDivisions.mockResolvedValueOnce({ entries: [hill, anne] });
    container.querySelector('[data-retry]').click();
    await flush();
    expect(container.querySelectorAll('.today-line')).toHaveLength(2);
    view.destroy();
  });

  it('returns Home from its back control', () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const onNavigate = vi.fn();
    const view = new TodayPoem(container, { onNavigate });
    container.querySelector('[data-action="back"]').click();
    expect(onNavigate).toHaveBeenCalledWith('portal');
    view.destroy();
  });

  it('turns to the next day\'s poem when opened after midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 50));
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, {});
    view.activate();
    expect(container.querySelector('[data-caption]').textContent).toContain('Seed 2026-10-03');
    view.deactivate();
    vi.setSystemTime(new Date(2026, 9, 4, 0, 10));
    view.activate();
    expect(container.querySelector('[data-caption]').textContent).toContain('Seed 2026-10-04');
    vi.useRealTimers();
    view.destroy();
  });
});
