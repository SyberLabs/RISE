import { afterEach, describe, expect, it, vi } from 'vitest';

const gpus = vi.hoisted(() => []);
vi.mock('./gl-flame.js', () => ({
  FlameGpuRenderer: class {
    constructor(canvas) {
      this.canvas = canvas;
      this.calls = [];
      this.particles = 0;
      this.width = 0;
      this.height = 0;
      this.contextLost = false;
      this.float = true;
      gpus.push(this);
    }
    setPalette() {}
    setParticleCount(count) { this.particles = count; this.calls.push(['particles', count]); }
    setSize(width, height) { this.width = width; this.height = height; this.calls.push(['size', width, height]); }
    reset() { this.calls.push(['reset']); }
    render(frame) { this.rendered = frame; this.calls.push(['render']); return true; }
    present(frame) { this.calls.push(['present', frame]); }
    dispose() {}
  }
}));

const { LivingFlameField, LIVING_FLAME_TIERS, nextQualityTier } = await import('./field.js');
const { flamePreset, FLAME_PRESET_IDS } = await import('./flame-presets.js');

describe('the quality policy', () => {
  it('steps down past 20 ms and makes the failed tier the ceiling', () => {
    expect(nextQualityTier({ tier: 2, ceiling: 3, p95: 24, steadyWindows: 2 }))
      .toEqual({ tier: 1, ceiling: 1, steadyWindows: 0 });
  });

  it('never steps below the lowest tier', () => {
    expect(nextQualityTier({ tier: 0, ceiling: 3, p95: 60, steadyWindows: 0 }))
      .toEqual({ tier: 0, ceiling: 3, steadyWindows: 0 });
  });

  it('steps up only after three steady windows, and never past the ceiling', () => {
    let state = { tier: 1, ceiling: 2, steadyWindows: 0 };
    state = nextQualityTier({ ...state, p95: 12 });
    state = nextQualityTier({ ...state, p95: 12 });
    expect(state).toEqual({ tier: 1, ceiling: 2, steadyWindows: 2 });
    state = nextQualityTier({ ...state, p95: 12 });
    expect(state).toEqual({ tier: 2, ceiling: 2, steadyWindows: 0 });
    expect(nextQualityTier({ ...state, p95: 12, steadyWindows: 2 })).toEqual({ tier: 2, ceiling: 2, steadyWindows: 0 });
  });

  it('holds between 18 and 20 ms and forgets its steady count', () => {
    expect(nextQualityTier({ tier: 1, ceiling: 3, p95: 19, steadyWindows: 2 }))
      .toEqual({ tier: 1, ceiling: 3, steadyWindows: 0 });
  });
});

describe('a quality step on screen', () => {
  let field = null;
  afterEach(() => {
    field?.destroy();
    field = null;
    gpus.length = 0;
    vi.unstubAllGlobals();
  });

  function mount() {
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ width: 800, height: 500 });
    document.body.appendChild(host);
    let pending = null;
    const win = {
      devicePixelRatio: 2,
      requestAnimationFrame: callback => { pending = callback; return 1; },
      cancelAnimationFrame: () => { pending = null; }
    };
    field = new LivingFlameField(host, { recipe: flamePreset(FLAME_PRESET_IDS[0]), window: win });
    let now = 10_000;
    const frame = ms => { now += ms; const callback = pending; pending = null; callback(now); };
    return { host, gpu: gpus.at(-1), frame };
  }

  it('keeps the accumulated image and redraws it before the frame is shown', () => {
    const { gpu, frame } = mount();
    const startTier = field.tier;
    const mounted = gpu.calls.length;
    for (let i = 0; i < 120 && field.tier === startTier; i += 1) frame(40);

    expect(field.tier).toBe(startTier - 1);
    const step = gpu.calls.slice(mounted);
    const changedAt = step.findIndex(([name]) => name === 'particles');
    expect(step[changedAt]).toEqual(['particles', LIVING_FLAME_TIERS[startTier - 1].particles]);
    const afterChange = step.slice(changedAt);
    expect(afterChange.some(([name]) => name === 'reset')).toBe(false);
    expect(afterChange.at(-1)).toEqual(['present', gpu.rendered]);
  });

  it('redraws the carried image when the stage is resized', () => {
    let observe = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() {}
    });
    const { host, gpu, frame } = mount();
    frame(16);
    const before = gpu.calls.length;
    host.getBoundingClientRect = () => ({ width: 1000, height: 600 });
    observe();

    const resize = gpu.calls.slice(before);
    expect(resize.some(([name]) => name === 'reset')).toBe(false);
    expect(resize.find(([name]) => name === 'size')).toBeDefined();
    expect(resize.at(-1)).toEqual(['present', gpu.rendered]);
  });
});
