/**
 * The phone stage: looking is not choosing.
 *
 * What is guarded: that browsing and varying never reach `onChange`, that
 * Choose writes exactly one configuration through the same `configPatch` the
 * directory uses, and that the stage leaves afterwards.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';
import { stillQueue } from './visual-navigator/preview.js';
import { STAGE_HOLD_MS } from './visual-navigator/world-stage.js';
import { worldRail } from '../core/world-rail.js';
import { KLEE_PRESETS } from '../core/visual-style-definitions.js';
import { visualCortex } from '../visuals/visual-cortex.js';

let nav = null;

const mount = (visualConfig = {}, options = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const settings = { chamberFace: 'literary', fontSize: 'medium' };
  const spies = { onChange: vi.fn(), onClose: vi.fn(), onPick: vi.fn(), onSettingChange: vi.fn() };
  nav = new VisualNavigator(container, {
    presentation: 'stage',
    visualConfig,
    getSettings: () => settings,
    onSettingChange: (key, value) => { settings[key] = value; spies.onSettingChange(key, value); },
    onChange: spies.onChange,
    onClose: spies.onClose,
    onPick: spies.onPick,
    ...options
  });
  return spies;
};
const $ = selector => nav.container.querySelector(selector);
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const tile = id => $(`.vstage-tile[data-world="${id}"]`);

afterEach(() => {
  vi.useRealTimers();
  nav?.destroy();
  nav?.container.remove();
  nav = null;
  vi.restoreAllMocks();
  stillQueue._reset();
});

describe('the stage', () => {
  it('opens on the visual in the room, with every visual on the rail', () => {
    mount({ visualMode: 'attractor' });
    expect(nav.container.querySelectorAll('.vstage-rail [role="option"]').length).toBe(worldRail().length);
    expect(tile('attractor').getAttribute('aria-selected')).toBe('true');
    expect($('.vstage-name').textContent).toBe('Attractor');
    expect($('.vstage-family').textContent).toContain('In the room');
  });

  it('browsing changes the stage and never the reading', () => {
    const spies = mount({ visualMode: 'attractor' });
    click(tile('turrell'));
    expect($('.vstage-name').textContent).toBe('Turrell Fields');
    expect(tile('turrell').getAttribute('aria-selected')).toBe('true');
    expect(spies.onChange).not.toHaveBeenCalled();
  });

  it('Choose writes once, then the stage leaves after the hold', () => {
    vi.useFakeTimers();
    const spies = mount({ visualMode: 'attractor' });
    click(tile('turrell'));
    click($('[data-stage="choose"]'));
    expect(spies.onChange).toHaveBeenCalledTimes(1);
    const written = spies.onChange.mock.calls[0][0];
    expect(written.visualMode).toBe('interlocution');
    expect(written.interlocution.procedural).toEqual(['turrell']);
    expect($('.vstage').classList.contains('is-committed')).toBe(true);
    expect(spies.onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(STAGE_HOLD_MS);
    expect(spies.onClose).toHaveBeenCalledTimes(1);
  });

  it('tapping the focused tile again chooses it', () => {
    const spies = mount({});
    click(tile('attractor'));
    click(tile('attractor'));
    expect(spies.onChange).toHaveBeenCalledTimes(1);
    // Attractor is a listed procedural, not a mode of its own (visual-taxonomy.js).
    expect(spies.onChange.mock.calls[0][0].interlocution.procedural).toEqual(['attractor']);
  });

  it('closes at once under reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(query => ({ matches: query.includes('reduced-motion') }))
    });
    try {
      const spies = mount({});
      click(tile('klee'));
      click($('[data-stage="choose"]'));
      expect(spies.onClose).toHaveBeenCalledTimes(1);
    } finally {
      delete window.matchMedia;
    }
  });

  it('closing without Choose changes nothing', () => {
    const spies = mount({ visualMode: 'attractor' });
    click(tile('fractal'));
    click($('[data-stage="close"]'));
    expect(spies.onClose).toHaveBeenCalledTimes(1);
    expect(spies.onChange).not.toHaveBeenCalled();
  });

  it('offers Add to blend only when a gallery field is already in the room', () => {
    const spies = mount({ visualMode: 'interlocution', interlocution: { procedural: ['fractal'], presentation: 'continuous' } });
    click(tile('turrell'));
    expect($('[data-stage="blend"]')).toBeTruthy();
    click($('[data-stage="blend"]'));
    const written = spies.onChange.mock.calls[0][0];
    expect(written.interlocution.procedural.sort()).toEqual(['fractal', 'turrell']);
    click(tile('attractor'));
  });

  it('has no blend over a dynamic field', () => {
    mount({ visualMode: 'attractor' });
    click(tile('turrell'));
    expect($('[data-stage="blend"]')).toBeNull();
  });
});

describe('Vary', () => {
  it('stages a preset without writing, and Choose carries it', () => {
    const spies = mount({});
    click(tile('klee'));
    click($('[data-stage="vary"]'));
    const chips = nav.container.querySelectorAll('.vstage-sheet [data-stage-sub="preset"]');
    expect(chips.length).toBe(KLEE_PRESETS.length);
    const target = [...chips].find(chip => chip.getAttribute('aria-pressed') === 'false');
    click(target);
    expect(spies.onChange).not.toHaveBeenCalled();
    expect($(`[data-stage-sub="preset"][data-val="${target.dataset.val}"]`).getAttribute('aria-pressed')).toBe('true');
    click($('[data-stage="sheet-close"]'));
    click($('[data-stage="choose"]'));
    const written = spies.onChange.mock.calls[0][0];
    expect(written.visualMode).toBe('genesis');
    expect(written.genesis.preset).toBe(target.dataset.val);
  });

  it('is absent where there is nothing to vary', () => {
    mount({});
    click(tile('attractor'));
    expect($('[data-stage="vary"]')).toBeNull();
    click(tile('off'));
    expect($('[data-stage="vary"]')).toBeNull();
  });

  it('chooses a collection for a work-of-art visual', () => {
    const spies = mount({});
    click(tile('by-manner'));
    click($('[data-stage="vary"]'));
    const pools = [...nav.container.querySelectorAll('[data-stage-pool]')];
    expect(pools.length).toBeGreaterThan(1);
    click(pools[1]);
    click($('[data-stage="sheet-close"]'));
    click($('[data-stage="choose"]'));
    expect(spies.onChange.mock.calls[0][0].interlocution.sourced).toEqual([pools[1].dataset.stagePool]);
  });
});

describe('Letters', () => {
  it('writes the face at once, as the reader controls always have', () => {
    const spies = mount({ visualMode: 'attractor' });
    click($('[data-stage="text"]'));
    expect($('.vstage-sheet-text')).toBeTruthy();
    click($('.vstage-sheet [data-chamber-face="thick"]'));
    expect(spies.onSettingChange).toHaveBeenCalledWith('chamberFace', 'thick');
  });
});

describe('keys', () => {
  it('arrows walk the rail and Enter chooses', () => {
    const spies = mount({ visualMode: 'attractor' });
    const rail = $('.vstage-rail');
    rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const next = worldRail()[worldRail().findIndex(w => w.id === 'attractor') + 1].id;
    expect(tile(next).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tile(next));
    $('.vstage-rail').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(spies.onChange).toHaveBeenCalledTimes(1);
  });
});

describe('swipes', () => {
  const pointer = (type, x, y) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    $('.vstage-still').dispatchEvent(event);
  };

  it('a sideways swipe moves to the neighbour; an edge swipe belongs to the system', () => {
    mount({ visualMode: 'attractor' });
    pointer('pointerdown', 200, 300);
    pointer('pointerup', 120, 305);
    expect($('.vstage-name').textContent).toBe('Genesis');
    pointer('pointerdown', 5, 300);
    pointer('pointerup', 120, 300);
    expect($('.vstage-name').textContent).toBe('Genesis');
  });

  it('a swipe down leaves', () => {
    const spies = mount({});
    pointer('pointerdown', 200, 200);
    pointer('pointerup', 205, 320);
    expect(spies.onClose).toHaveBeenCalled();
  });
});

describe('states', () => {
  it('a missing picture is said plainly and Choose still works', async () => {
    vi.spyOn(visualCortex, 'resolveCollectionWorks').mockResolvedValue([]);
    mount({});
    click(tile('by-manner'));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect($('.vstage-missing')?.textContent).toContain('still works');
    expect($('[data-stage="choose"]').disabled).toBe(false);
  });

  it('a curated program owns the field', () => {
    const spies = mount({ visualMode: 'attractor' }, { programInfo: { episodes: 4 } });
    expect($('[data-program-lock]')).toBeTruthy();
    expect($('[data-stage="choose"]').disabled).toBe(true);
    click(tile('turrell'));
    click($('[data-stage="choose"]'));
    expect(spies.onChange).not.toHaveBeenCalled();
  });

  it('with no reading, the gate stands in the stage', () => {
    mount({}, { locked: true });
    expect($('.vnav-gate')).toBeTruthy();
    expect($('.vstage-rail')).toBeNull();
  });
});

describe('the live engine', () => {
  const counting = () => {
    const made = [];
    const factories = { attractor: async () => { const e = { destroy: vi.fn() }; made.push(e); return e; } };
    return { made, factories };
  };

  it('does not draw behind a stage nobody has opened', async () => {
    vi.useFakeTimers();
    const { made, factories } = counting();
    mount({ visualMode: 'attractor' }, { liveFactories: factories });
    await vi.advanceTimersByTimeAsync(2000);
    expect(made).toHaveLength(0);
    nav.enterStage();
    await vi.advanceTimersByTimeAsync(700);
    expect(made).toHaveLength(1);
    nav.leaveStage();
    expect(made[0].destroy).toHaveBeenCalled();
  });

  it('a picker is opened by being made', async () => {
    vi.useFakeTimers();
    const { made, factories } = counting();
    mount({}, { mode: 'pick', initialLeafId: 'attractor', liveFactories: factories });
    await vi.advanceTimersByTimeAsync(700);
    expect(made).toHaveLength(1);
  });
});

describe('pick mode', () => {
  it('returns the choice and never writes the reading', () => {
    const spies = mount({}, { mode: 'pick', pickable: new Set(['off', 'klee', 'fractal']), initialLeafId: 'fractal' });
    expect(nav.container.querySelectorAll('.vstage-tile').length).toBe(3);
    expect($('[data-stage="text"]')).toBeNull();
    click(tile('klee'));
    click($('[data-stage="choose"]'));
    expect(spies.onChange).not.toHaveBeenCalled();
    expect(spies.onPick).toHaveBeenCalledWith(expect.objectContaining({ leafId: 'klee' }));
  });
});
