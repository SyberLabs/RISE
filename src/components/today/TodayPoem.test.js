import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
// The engine behind the page is the shared stage's (reading-backdrop.test.js);
// the view is held to what it asks of it.
const stages = vi.hoisted(() => []);
vi.mock('../reading-backdrop.js', () => ({
  ReadingStage: class {
    constructor(host) {
      Object.assign(this, { host, show: vi.fn(async () => {}), pause: vi.fn(), resume: vi.fn(), destroy: vi.fn() });
      stages.push(this);
    }
  }
}));

import { TodayPoem } from './TodayPoem.js';
import { todayDecision } from '../../core/today-reading.js';

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

  it('shows today\'s poem and its mood, then begins exactly that division in the day\'s look', async () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const onLaunchJevReading = vi.fn(async () => {});
    const view = new TodayPoem(container, { onLaunchJevReading });
    view.activate();
    expect(container.querySelector('#today-title').textContent).toBe('Anne Rutledge');
    expect(container.querySelector('.today-byline').textContent).toBe('Edgar Lee Masters, from Spoon River Anthology');
    expect(container.querySelector('[data-begin]').disabled).toBe(true);
    // The day's mood, named before anything plays.
    const decision = todayDecision(view.pick);
    expect(container.querySelector('.today-mood-name').textContent.toLowerCase()).toBe(decision.temper);
    expect(container.querySelector('.today-mood-plan').textContent).toBeTruthy();
    await flush();
    const lines = [...container.querySelectorAll('.today-line')].map(node => node.textContent);
    expect(lines).toEqual(['Out of me unworthy and unknown', 'The vibrations of deathless music;']);
    expect(container.querySelector('[data-caption]').textContent).toMatch(/^Seed \d{4}-\d\d-\d\d · a 1 · b 2 · c 3 · d 4 · 12 folds$/);
    container.querySelector('[data-begin]').click();
    await flush();
    // The app's one launch: the day's exact division, as a poem, returning here.
    expect(onLaunchJevReading).toHaveBeenCalledWith(view.decision, {
      exact: { entryId: 1, label: 'Anne Rutledge' },
      noun: 'poem',
      origin: { view: 'today', name: 'Today\'s poem' }
    });
    expect(view.decision).toMatchObject({ workId: 'spoon-river-anthology', temper: decision.temper });
    // Leaving the reading returns here; the poem can be begun again.
    expect(container.querySelector('[data-begin]').disabled).toBe(false);
    expect(container.querySelector('[data-begin]').hasAttribute('aria-busy')).toBe(false);
    view.destroy();
  });

  it('runs the day\'s engine behind the page only while the page is shown, on the shared stage', async () => {
    stages.length = 0;
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, {});
    expect(stages).toHaveLength(1);
    const [stage] = stages;
    expect(stage.host).toBe(container.querySelector('.today-backdrop'));
    expect(stage.show).not.toHaveBeenCalled();
    view.activate();
    expect(stage.show).toHaveBeenCalledWith(view.decision);
    view.deactivate();
    expect(stage.pause).toHaveBeenCalledOnce();
    view.activate();
    expect(stage.resume).toHaveBeenCalledTimes(2);
    expect(stages).toHaveLength(1);
    view.destroy();
    expect(stage.destroy).toHaveBeenCalledOnce();
  });

  it('ends the old day\'s engine with its page, and shows the new day\'s', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
    stages.length = 0;
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, {});
    view.activate();
    vi.advanceTimersByTime(60_000);
    expect(stages).toHaveLength(2);
    expect(stages[0].destroy).toHaveBeenCalledOnce();
    expect(stages[1].show).toHaveBeenCalledWith(view.decision);
    vi.useRealTimers();
    view.destroy();
  });

  it('stills the mark, so the engine behind it is the one thing that moves', () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'today-poem.css'), 'utf8');
    expect(css).not.toMatch(/\.today-mandala\s*\{[^}]*animation/u);
  });

  it('says so when the poem cannot open (the edition gate refused it), keeps it on screen, and Begin can be pressed again', async () => {
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, { onLaunchJevReading: vi.fn(async () => { throw new TypeError('The division changed.'); }) });
    await flush();
    container.querySelector('[data-begin]').click();
    await flush();
    expect(container.querySelector('[data-begin-status]').textContent).toBe('This poem could not be opened. Try again.');
    expect(container.querySelectorAll('.today-line')).toHaveLength(2);
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

  it('turns over by itself at midnight while it is shown, and stops watching when hidden', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
    work.getDivisions.mockResolvedValue({ entries: [hill, anne] });
    const view = new TodayPoem(container, {});
    view.activate();
    vi.advanceTimersByTime(60_000);
    expect(container.querySelector('[data-caption]').textContent).toContain('Seed 2026-10-04');
    view.deactivate();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(container.querySelector('[data-caption]').textContent).toContain('Seed 2026-10-04');
    vi.useRealTimers();
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
