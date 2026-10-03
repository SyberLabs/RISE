import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualFieldDirector } from './visual-field-director.js';

afterEach(() => vi.useRealTimers());

function record(name, log) {
  const node = document.createElement('div');
  node.dataset.name = name;
  return {
    node,
    pause: () => log.push(`pause:${name}`),
    resume: () => log.push(`resume:${name}`),
    destroy: () => log.push(`destroy:${name}`)
  };
}

describe('VisualFieldDirector', () => {
  it('crossfades exclusive field records and does not restart an equal cue', () => {
    vi.useFakeTimers();
    const log = [];
    const director = new VisualFieldDirector({
      transitionMs: 200,
      scheduleFrame: callback => callback(),
      mount: cue => record(cue.renderer, log)
    });
    const genesis = { kind: 'field', renderer: 'genesis', config: { preset: 'harmonic' } };

    expect(director.applyCue(genesis)).toBe(true);
    const first = director.active;
    expect(first.node.classList.contains('is-active')).toBe(true);
    expect(director.applyCue({ ...genesis, config: { preset: 'harmonic' } })).toBe(true);
    expect(director.active).toBe(first);

    director.applyCue({ kind: 'field', renderer: 'attractor', config: { system: 'thomas' } });
    expect(first.node.classList.contains('is-leaving')).toBe(true);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(log).toEqual(['destroy:genesis']);
  });

  it('clears fields for non-field cues and binds pause, resume, and destroy', () => {
    vi.useFakeTimers();
    const log = [];
    const director = new VisualFieldDirector({
      transitionMs: 0,
      scheduleFrame: callback => callback(),
      mount: cue => record(cue.renderer, log)
    });
    director.applyCue({ kind: 'field', renderer: 'genesis', config: {} });
    director.pause();
    director.resume();
    expect(director.applyCue({ kind: 'sourced', collections: ['landscapes'] })).toBe(false);
    expect(log).toEqual(['pause:genesis', 'resume:genesis', 'destroy:genesis']);
    director.destroy();
    expect(log).toHaveLength(3);
  });

  it('bounds retirement to the authored cue transition', () => {
    vi.useFakeTimers();
    const log = [];
    const director = new VisualFieldDirector({
      transitionMs: 320,
      scheduleFrame: callback => callback(),
      mount: cue => record(cue.renderer, log)
    });
    director.applyCue(
      { kind: 'field', renderer: 'genesis', config: {} },
      { transitionMs: 120 }
    );
    director.applyCue(
      { kind: 'sourced', collections: ['fractal'] },
      { transitionMs: 120 }
    );
    expect(director.retiring.size).toBe(1);
    vi.advanceTimersByTime(119);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(['destroy:genesis']);
  });
});

describe('VisualFieldDirector living-flame support', () => {
  it('morphs a compatible successor in place instead of mounting a new layer', () => {
    const log = [];
    let mounts = 0;
    const director = new VisualFieldDirector({
      transitionMs: 1200,
      scheduleFrame: callback => callback(),
      mount: cue => {
        mounts += 1;
        const entry = record(`${cue.renderer}-${mounts}`, log);
        entry.renderer = cue.renderer;
        entry.morph = (next, { transitionMs }) => {
          log.push(`morph:${next.config.recipe}:${transitionMs}`);
          return next.config.recipe !== 'incompatible';
        };
        return entry;
      }
    });
    director.applyCue({ kind: 'field', renderer: 'living-flame', config: { recipe: 'a' } });
    const first = director.active;
    expect(director.applyCue({ kind: 'field', renderer: 'living-flame', config: { recipe: 'b' } })).toBe(true);
    expect(director.active).toBe(first);
    expect(mounts).toBe(1);
    expect(log).toContain('morph:b:1200');
    director.applyCue({ kind: 'field', renderer: 'living-flame', config: { recipe: 'incompatible' } });
    expect(mounts).toBe(2);
    expect(director.active).not.toBe(first);
  });

  it('never keeps more than two layers alive', () => {
    vi.useFakeTimers();
    const log = [];
    const director = new VisualFieldDirector({
      transitionMs: 1200,
      scheduleFrame: callback => callback(),
      mount: cue => record(cue.config.id, log)
    });
    for (const id of ['a', 'b', 'c', 'd']) {
      director.applyCue({ kind: 'field', renderer: 'attractor', config: { id } });
      expect(director.retiring.size + (director.active ? 1 : 0)).toBeLessThanOrEqual(2);
    }
    expect(log).toEqual(['destroy:a', 'destroy:b']);
    vi.advanceTimersByTime(1200);
    expect(log).toEqual(['destroy:a', 'destroy:b', 'destroy:c']);
  });
});

describe('VisualFieldDirector mounted visual controls', () => {
  it('discovers and controls only the connected active capable record', () => {
    const director = new VisualFieldDirector({
      transitionMs: 320,
      scheduleFrame: callback => callback(),
      mount: cue => {
        const mounted = record(cue.renderer, []);
        document.body.appendChild(mounted.node);
        if (cue.renderer === 'attractor') {
          mounted.discoverVisual = () => ({
            manifest: { surface: 'attractor' },
            current: { intensity: 0.6 },
            target: { intensity: 0.6 }
          });
          mounted.controlVisual = value => ({
            status: 'accepted', surface: value.surface, parameter: value.parameter,
            requested: value.value, effective: 0.75
          });
          mounted.cancelVisualControl = () => {};
        }
        return mounted;
      }
    });
    director.applyCue({ kind: 'field', renderer: 'attractor', config: {} });
    expect(director.discoverVisual()).toEqual({
      manifest: { surface: 'attractor' },
      current: { intensity: 0.6 },
      target: { intensity: 0.6 }
    });
    expect(director.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 8 }))
      .toMatchObject({ status: 'accepted', requested: 8, effective: 0.75 });

    const previous = director.active;
    previous.node.remove();
    expect(director.discoverVisual()).toBeNull();
    expect(director.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
    director.applyCue({ kind: 'field', renderer: 'other', config: {} });
    expect(director.discoverVisual()).toBeNull();
    director.destroy();
  });

  it('refuses malformed input and cancels local control when the same cue is admitted again', () => {
    const log = [];
    const director = new VisualFieldDirector({
      transitionMs: 0,
      scheduleFrame: callback => callback(),
      mount: cue => {
        const mounted = record(cue.renderer, log);
        document.body.appendChild(mounted.node);
        mounted.discoverVisual = () => ({ manifest: {}, current: {}, target: {} });
        mounted.controlVisual = () => ({ status: 'accepted' });
        mounted.cancelVisualControl = () => log.push('cancel-control');
        return mounted;
      }
    });
    const cue = { kind: 'field', renderer: 'attractor', config: { intensity: 0.65 } };
    director.applyCue(cue);
    expect(director.controlVisual({ surface: 'attractor', parameter: 'intensity', value: NaN }))
      .toEqual({ status: 'refused', code: 'INVALID_CONTROL' });
    director.applyCue(cue);
    expect(log).toContain('cancel-control');
    director.clear({ immediate: true });
    expect(director.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
    director.destroy();
  });
});
