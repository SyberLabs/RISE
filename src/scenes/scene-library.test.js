import { describe, expect, it } from 'vitest';
import { createSceneLibrary, EASE, LIBRARY_DEFAULTS } from './scene-library.js';

/** A context that records what was asked of it. */
function fakeContext() {
  const calls = [];
  const record = name => (...args) => calls.push([name, ...args]);
  const ctx = {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '',
    save: record('save'), restore: record('restore'), setTransform: record('setTransform'), fillRect: record('fillRect'),
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'), stroke: record('stroke'), fill: record('fill'),
    arc: record('arc'), closePath: record('closePath'), fillText: record('fillText'), setLineDash: record('setLineDash')
  };
  return ctx;
}

const setup = options => {
  const ctx = fakeContext();
  const lib = createSceneLibrary({ ctx, size: { width: 400, height: 300, dpr: 2 }, theme: { accent: '#ff0000' }, ...options });
  return { ctx, lib };
};

describe('drawing', () => {
  it('clears to the theme’s background in device pixels', () => {
    const { ctx, lib } = setup();
    lib.clear();
    expect(ctx.calls).toContainEqual(['fillRect', 0, 0, 800, 600]);
  });

  it('maps scene units to pixels on axes, with the origin where the axes cross', () => {
    const { lib } = setup();
    const frame = lib.axes({ x: [0, 4], y: [0, 3] });
    expect(frame.toX(0)).toBe(80);
    expect(frame.toX(4)).toBe(720);
    expect(frame.toY(0)).toBe(520);
    expect(frame.toY(3)).toBe(80);
    expect(frame.origin).toEqual([80, 520]);
  });

  it('draws a vector as a line and an arrowhead, scaled by t and turned by angle', () => {
    const { ctx, lib } = setup();
    const frame = lib.axes({ x: [0, 4], y: [0, 3] });
    const v = lib.vector({ x: 2, y: 0, label: 'v' });
    v.draw(frame);
    expect(ctx.calls).toContainEqual(['lineTo', 400, 520]);
    // The vector's own label; the axes label themselves only when drawn.
    expect(ctx.calls.filter(call => call[0] === 'fillText')).toHaveLength(1);
    ctx.calls.length = 0;
    v.t = 0.5;
    v.draw(frame);
    expect(ctx.calls).toContainEqual(['lineTo', 240, 520]);
    ctx.calls.length = 0;
    v.t = 1; v.angle = Math.PI / 2;
    v.draw(frame);
    const [, x, y] = ctx.calls.find(call => call[0] === 'lineTo');
    expect(Math.round(x)).toBe(80);
    expect(Math.round(y)).toBe(227);
  });

  it('plots a function to a share of its length', () => {
    const { ctx, lib } = setup();
    const frame = lib.axes({ x: [0, 1], y: [0, 1] });
    lib.plot(frame, x => x * x, { samples: 10, to: 0.5 });
    expect(ctx.calls.filter(call => call[0] === 'lineTo' || call[0] === 'moveTo')).toHaveLength(6);
  });

  it('gives theme colours by name, with an alpha', () => {
    const { lib } = setup();
    expect(lib.color('accent')).toBe('#ff0000');
    expect(lib.color('accent', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(lib.color('#123456')).toBe('#123456');
  });
});

describe('a style’s defaults', () => {
  it('set the stroke width, the label font, the grid’s alpha and the easing a call leaves out', () => {
    const { ctx, lib } = setup({ defaults: { stroke: 2.5, labelFont: '15px serif', gridAlpha: 0.1, ease: 'linear' } });
    const frame = lib.axes({ x: [0, 4], y: [0, 3] }, { labels: false });
    lib.line(frame, [0, 0], [1, 1]);
    expect(ctx.lineWidth).toBe(5);
    lib.label('x', { at: [10, 10] });
    expect(ctx.font).toBe('30px serif');
    lib.grid(frame);
    expect(ctx.globalAlpha).toBe(0.1);
    const target = { t: 0 };
    void lib.tween(target, { t: 1 }, { ms: 100 });
    lib.tick(25);
    expect(target.t).toBeCloseTo(0.25, 5);
  });

  it('leave a call’s own values alone, and ignore what the library does not read or a value of the wrong kind', () => {
    const { ctx, lib } = setup({ defaults: { stroke: 'wide', ease: 'bounce', unknown: 1 } });
    const frame = lib.axes({ x: [0, 4], y: [0, 3] }, { labels: false });
    lib.line(frame, [0, 0], [1, 1]);
    expect(ctx.lineWidth).toBe(LIBRARY_DEFAULTS.stroke * 2);
    lib.line(frame, [0, 0], [1, 1], { width: 4 });
    expect(ctx.lineWidth).toBe(8);
    const target = { t: 0 };
    void lib.tween(target, { t: 1 }, { ms: 100 });
    lib.tick(25);
    expect(target.t).toBeCloseTo(EASE[LIBRARY_DEFAULTS.ease](0.25), 5);
  });
});

describe('tweens on the host’s time', () => {
  it('move a property by the frames given, ease it, and resolve when done', async () => {
    const { lib } = setup();
    const target = { t: 0 };
    let settled = false;
    const promise = lib.tween(target, { t: 1 }, { ms: 100, ease: EASE.linear }).then(() => { settled = true; });
    lib.tick(25);
    expect(target.t).toBeCloseTo(0.25, 5);
    expect(lib.moving).toBe(1);
    lib.tick(100);
    await promise;
    expect(target.t).toBe(1);
    expect(settled).toBe(true);
    expect(lib.moving).toBe(0);
  });

  it('complete at once when instant, or when the reader prefers reduced motion', async () => {
    const { lib } = setup();
    const a = { t: 0 };
    await lib.tween(a, { t: 1 }, { ms: 500, instant: true });
    expect(a.t).toBe(1);
    const { lib: still } = setup({ reducedMotion: true });
    const b = { angle: 0 };
    await still.tween(b, { angle: 2 }, { ms: 500 });
    expect(b.angle).toBe(2);
    expect(still.moving).toBe(0);
  });

  it('do not move while no frames come, so a paused reading pauses the picture', () => {
    const { lib } = setup();
    const target = { t: 0 };
    void lib.tween(target, { t: 1 }, { ms: 100 });
    expect(target.t).toBe(0);
  });
});
