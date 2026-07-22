// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rosarium } from '../../../components/Rosarium.js';
import { ROSARY_MYSTERY_WORKS, mysteryWork } from './rosary-imagery.js';
import { ROSARY_PRAYERS, MYSTERY_SETS } from './rosary.js';

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const rosarium = new Rosarium(container, options);
  rosarium.activate();
  return { container, rosarium };
}

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

describe('The Rosarium (the Rosary’s own room)', () => {
  it('opens choosing: sets with the day’s own marked, mode, sound, pace, and one Start', () => {
    const { container } = mount({ setId: 'sorrowful' });
    expect(container.querySelectorAll('[data-set]')).toHaveLength(4);
    expect(container.querySelector('.rosarium-set-today')).not.toBeNull();
    expect(container.querySelector('[data-set="sorrowful"]').classList.contains('rosarium-set-selected')).toBe(true);
    expect(container.querySelector('[data-action="start"]')).not.toBeNull();
    expect(container.querySelector('[data-mode="plain"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-sound]')).toHaveLength(4);
  });

  it('alternates strand and prayer: Advance enters a prayer, its end returns to the strand', () => {
    vi.useFakeTimers();
    const { container, rosarium } = mount({ setId: 'joyful' });
    container.querySelector('[data-advance="manual"]').click();
    container.querySelector('[data-action="start"]').click();

    // In the between-space, the next prayer is named
    expect(rosarium.phase).toBe('strand');
    expect(container.querySelector('.rosarium-where').textContent).toContain('Sign of the Cross');

    // Advance → the first prayer, total screen
    container.querySelector('[data-action="advance"]').click();
    expect(rosarium.phase).toBe('prayer');
    expect(container.querySelector('.rosarium-prayer-text').textContent)
      .toBe(ROSARY_PRAYERS.signOfTheCross);
    // the strand is withdrawn during prayer
    expect(container.querySelector('.rosarium-stage').dataset.phase).toBe('prayer');

    // By hand: the reader says when the prayer is prayed
    container.querySelector('[data-action="prayer-done"]').click();
    expect(rosarium.phase).toBe('strand');
    expect(container.querySelector('.rosarium-where').textContent).toContain('Creed');
  });

  it('Carried mode times the prayer and breathes on the strand between', () => {
    vi.useFakeTimers();
    const { container, rosarium } = mount({ setId: 'joyful' });
    container.querySelector('[data-advance="auto"]').click();
    container.querySelector('[data-action="start"]').click();
    expect(rosarium.phase).toBe('strand');

    // the strand breath carries into the first prayer
    vi.advanceTimersByTime(2600);
    expect(rosarium.phase).toBe('prayer');
    // the Sign of the Cross holds its recitation length, then returns
    vi.advanceTimersByTime(7100);
    expect(rosarium.phase).toBe('strand');
  });

  it('the escape ladder: prayer → strand → choosing → Chapel', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    const { container, rosarium } = mount({ setId: 'joyful', onNavigate });
    container.querySelector('[data-advance="manual"]').click();
    container.querySelector('[data-action="start"]').click();
    container.querySelector('[data-action="advance"]').click();
    expect(rosarium.phase).toBe('prayer');

    expect(rosarium.handleEscape()).toBe(true);
    expect(rosarium.phase).toBe('strand');
    expect(rosarium.handleEscape()).toBe(true);
    expect(rosarium.phase).toBe('choosing');
    expect(rosarium.handleEscape()).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('chapel');
  });

  it('one art slot: the prayer screen never shows an icon AND a painting', () => {
    vi.useFakeTimers();
    const { container, rosarium } = mount({ setId: 'joyful' });
    container.querySelector('[data-advance="manual"]').click();
    container.querySelector('[data-action="start"]').click();
    container.querySelector('[data-action="advance"]').click();
    expect(container.querySelectorAll('[data-art-slot]')).toHaveLength(1);
    // the slot holds at most one image
    expect(container.querySelectorAll('.rosarium-art img').length).toBeLessThanOrEqual(1);
  });

  it('pace stretches the compiled durations honestly', () => {
    vi.useFakeTimers();
    const { container, rosarium } = mount({ setId: 'glorious' });
    const slider = container.querySelector('.rosarium-pace');
    slider.value = '1.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector('[data-action="start"]').click();
    // 1.5× pace: the Sign of the Cross (7000ms base) compiles to ~4667
    const sign = rosarium.compiled.steps[0];
    expect(sign.durationMs).toBe(Math.round(7000 / 1.5));
  });
});

describe('The Imagistic mapping (one pinned work per mystery, or honest absence)', () => {
  it('maps all four sets with exactly five slots each, works or null', () => {
    for (const [setId, works] of Object.entries(ROSARY_MYSTERY_WORKS)) {
      expect(works, setId).toHaveLength(5);
      for (const work of works) {
        if (work === null) continue;
        expect(['met', 'cleveland', 'aic', 'rijks']).toContain(work.source);
        expect(work.id).toBeTruthy();
      }
    }
    expect(mysteryWork('glorious', 3)).toBeNull();   // Pentecost — the focal holds
    expect(mysteryWork('luminous', 3)).toBeNull();   // the Proclamation — the focal holds
    expect(mysteryWork('joyful', 1)).toEqual({ source: 'aic', id: 16327 });
    expect(mysteryWork('sorrowful', 5)).toEqual({ source: 'cleveland', id: 112856 });
    expect(mysteryWork('nowhere', 1)).toBeNull();
  });

  it('the retired Chamber integration stays retired', () => {
    const chamber = readFileSync(resolve('src/components/Chamber.js'), 'utf8');
    expect(chamber).not.toContain('initializeLiturgy');
    expect(chamber).not.toContain('updateDecadeStill');
    const sets = MYSTERY_SETS; // (import used)
    expect(Object.keys(sets)).toHaveLength(4);
  });
});
