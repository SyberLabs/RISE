import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function makeChamber() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'Personal focal', atoms: [], totalDuration: 0, atomCount: 0,
    visualConfig: { visualMode: 'off' },
    sequenceVisualAssets: [{
      id: 'portrait', kind: 'image', uri: 'blob:http://localhost/portrait'
    }]
  };
  return {
    chamber: new Chamber(container, { session, player: null, autoStart: false }),
    container
  };
}

describe('Chamber personal focal field', () => {
  it('resolves the durable image id inside the focal frame, not the full-frame media plane', () => {
    const { chamber, container } = makeChamber();
    const mounted = chamber.mountVisualFieldCue({
      kind: 'field', renderer: 'focal',
      config: { type: 'personal', personalAssetId: 'portrait' }
    });

    expect(mounted.node.classList.contains('chamber-focal')).toBe(true);
    expect(mounted.node.querySelector('.focal-personal .focal-image')?.src)
      .toBe('blob:http://localhost/portrait');
    expect(mounted.node.querySelector('video')).toBeNull();

    mounted.destroy();
    chamber.destroy();
    container.remove();
  });

  it('resolves a project image for Page without consulting an external provider', async () => {
    const provider = { resolveCollectionWorks: () => { throw new Error('provider should not run'); } };
    const works = await Chamber.prototype._resolvePageCollection.call({
      session: {
        sequenceVisualAssets: [{
          id: 'portrait', kind: 'image', name: 'Portrait',
          uri: 'blob:http://localhost/portrait'
        }]
      }
    }, 'sequence-asset:portrait', 1, null, provider);

    expect(works).toEqual([{
      name: 'Portrait',
      data: { url: 'blob:http://localhost/portrait', title: 'Portrait' }
    }]);
  });

  it('defers direct-Page presenters without rewriting the authored visual mode', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
      title: 'Page first', atoms: [], totalDuration: 0, atomCount: 0,
      projection: 'page',
      visualConfig: {
        visualMode: 'focals', focals: { type: 'standard', standardGlyph: 'star' }
      }
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });

    expect(session.visualConfig.visualMode).toBe('focals');
    expect(chamber._temporalVisualsDeferred).toBe(true);
    expect(container.querySelector('.chamber-focal')).toBeNull();
    chamber.destroy();
    container.remove();
  });

  it('builds and pauses a direct-Page Genesis sampler without installing Stream hosts', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
      title: 'Genesis page', atoms: [], totalDuration: 0, atomCount: 0,
      projection: 'page',
      visualConfig: { visualMode: 'genesis', genesis: { preset: 'harmonic' } }
    };
    const chamber = new Chamber(container, { session, player: null, autoStart: false });

    expect(chamber._temporalVisualsDeferred).toBe(true);
    expect(chamber.kleeField).not.toBeNull();
    expect(chamber.kleeField.paused).toBe(true);
    chamber.destroy();
    container.remove();
  });
});

describe('Chamber mounted visual control', () => {
  it('admits an identical authored cue again when the successor has a new identity', () => {
    const cue = { kind: 'field', renderer: 'attractor', config: { intensity: 0.65 } };
    const delivered = [];
    const chamber = {
      _direction: {
        mode: 'follow',
        director: { program: { segments: [{ id: 'first' }, { id: 'next' }] }, holdsPrevious: () => false }
      },
      _lastDirectedCue: null,
      _lastDirectedCueId: null,
      _prefersReducedMotion: () => false,
      applyScheduledVisualCue: value => delivered.push(value)
    };

    Chamber.prototype._applyDirectedCue.call(chamber, cue, { cueId: 'first' });
    Chamber.prototype._applyDirectedCue.call(chamber, cue, { cueId: 'next' });

    expect(delivered).toEqual([cue, cue]);
  });

  it('discovers the mounted Attractor, bounds commands, and refuses after destroy', () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    window.matchMedia = () => ({ matches: false });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {},
      rotate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      fill() {}, arc() {}, drawImage() {}, createRadialGradient: () => ({ addColorStop() {} })
    });
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, {
      session: {
        title: 'Visual control', atoms: [], totalDuration: 0, atomCount: 0,
        visualConfig: { visualMode: 'attractor', attractor: { intensity: 0.65 } }
      },
      player: null, autoStart: false
    });
    const mounted = chamber.attractorField;

    expect(chamber.discoverVisual()).toMatchObject({
      manifest: { surface: 'attractor' },
      current: { intensity: 0.65 },
      target: { intensity: 0.65 }
    });
    expect(chamber.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 8 }))
      .toMatchObject({ status: 'accepted', requested: 8, effective: 0.75 });
    expect(chamber.attractorField).toBe(mounted);
    chamber._visualFieldDirector.applyCue({
      kind: 'field', renderer: 'attractor', config: { intensity: 0.65 }
    });
    expect(chamber.attractorField).toBe(mounted);
    expect(mounted.targetIntensity).toBe(0.65);

    // Hidden by the router (the reader left): nothing to discover or control.
    container.hidden = true;
    expect(chamber.discoverVisual()).toBeNull();
    expect(chamber.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
    container.hidden = false;

    chamber.destroy();
    expect(chamber.discoverVisual()).toBeNull();
    expect(chamber.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
      .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
  });
});
