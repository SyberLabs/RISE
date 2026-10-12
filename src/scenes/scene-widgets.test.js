/**
 * The widget set a listening scene draws with (docs/plans/LIVE-CURRENT.md §20): a slider, a draggable point and a
 * step-through, each hit-testing the reader's inputs the worker hands it, keeping its value and emitting it on change.
 */
import { describe, expect, it } from 'vitest';
import { SCENE_LIMITS } from './scene-protocol.js';
import { createWidgets } from './scene-widgets.js';
import { createSceneLibrary } from './scene-library.js';
import { fakeCanvasContext } from '../test/fake-canvas-context.js';

const PALETTE = { background: '#06051a', text: '#f4f2ff', accent: '#8ab4ff', muted: '#8b88a6', highlight: '#ffd166' };

function setup() {
  const emitted = [];
  const ctx = fakeCanvasContext();
  const widgets = createWidgets({ ctx, size: { width: 400, height: 300, dpr: 2 }, palette: PALETTE, emit: (control, value) => emitted.push([control, value]) });
  const press = (x, y) => widgets.dispatch({ type: 'pointerdown', x, y, buttons: 1, key: null });
  const move = (x, y, buttons = 1) => widgets.dispatch({ type: 'pointermove', x, y, buttons, key: null });
  const release = (x, y) => widgets.dispatch({ type: 'pointerup', x, y, buttons: 0, key: null });
  const key = name => widgets.dispatch({ type: 'keydown', x: null, y: null, buttons: 0, key: name });
  return { ctx, widgets, emitted, press, move, release, key };
}

describe('a slider', () => {
  it('takes a press on its track and a drag along it, keeps its value to its step, and emits each change once', () => {
    const { widgets, emitted, press, move, release } = setup();
    const mass = widgets.slider({ id: 'mass', x: 100, y: 50, w: 200, min: 0, max: 1, value: 0.5, step: 0.1, label: 'Mass' });
    expect(mass.value).toBe(0.5);
    press(160, 52);
    expect(mass.value).toBe(0.3);
    move(161, 60);
    move(240, 90);
    release(240, 90);
    expect(mass.value).toBe(0.7);
    expect(emitted).toEqual([['mass', 0.3], ['mass', 0.7]]);
  });

  it('ignores a press away from it, and a move with no press', () => {
    const { widgets, emitted, press, move } = setup();
    widgets.slider({ id: 'mass', x: 100, y: 50, w: 200, min: 0, max: 1, value: 0.5, label: 'Mass' });
    press(160, 120);
    move(250, 50);
    expect(emitted).toEqual([]);
  });

  it('is clamped at its ends, and a value the scene sets is not the reader’s and emits nothing', () => {
    const { widgets, emitted, press, move } = setup();
    const mass = widgets.slider({ id: 'mass', x: 100, y: 50, w: 200, min: -2, max: 2, value: 0, step: 0.5, label: 'Mass' });
    press(100, 50);
    move(-500, 50);
    expect(mass.value).toBe(-2);
    move(900, 50);
    expect(mass.value).toBe(2);
    mass.value = 0.74;
    expect(mass.value).toBe(0.5);
    expect(emitted).toEqual([['mass', -2], ['mass', 2]]);
  });

  it('steps by a hundredth of its range without a step, and emits no float noise', () => {
    const { widgets, emitted, key } = setup();
    widgets.slider({ id: 'w1', x: 0, y: 0, w: 100, min: 0, max: 0.3, value: 0.1, label: 'w1' });
    key('ArrowRight');
    key('ArrowRight');
    expect(emitted).toEqual([['w1', 0.103], ['w1', 0.106]]);
  });

  it('refuses at creation what it cannot be: a bad id, min not below max, a second widget of the same id', () => {
    const { widgets } = setup();
    expect(() => widgets.slider({ id: 'Mass!', x: 0, y: 0, w: 10, min: 0, max: 1 })).toThrow(/a-z, 0-9/u);
    expect(() => widgets.slider({ id: 'mass', x: 0, y: 0, w: 10, min: 1, max: 1 })).toThrow(/min below max/u);
    widgets.slider({ id: 'mass', x: 0, y: 0, w: 10, min: 0, max: 1 });
    expect(() => widgets.slider({ id: 'mass', x: 0, y: 0, w: 10, min: 0, max: 1 })).toThrow(/Two widgets/u);
  });

  it('draws its track, its knob and its label with its value, in device pixels', () => {
    const { ctx, widgets } = setup();
    const mass = widgets.slider({ id: 'mass', x: 100, y: 50, w: 200, min: 0, max: 1, value: 0.5, step: 0.1, label: 'Mass' });
    mass.draw();
    expect(ctx.calls).toContainEqual(['moveTo', 200, 100]);
    expect(ctx.calls).toContainEqual(['arc', 400, 100, 14, 0, Math.PI * 2]);
    expect(ctx.calls.find(call => call[0] === 'fillText')[1]).toBe('Mass  0.5');
  });
});

describe('a draggable point', () => {
  /** A frame from the library's own axes: x -1..1 over 50..350 CSS pixels, y -1..1 over 250..50, at dpr 2. */
  const plane = () => createSceneLibrary({ ctx: fakeCanvasContext(), size: { width: 400, height: 300, dpr: 2 }, theme: {} })
    .axes({ x: [-1, 1], y: [-1, 1] }, { margin: 50 });

  it('moves with a drag in its frame’s units, clamped to the frame, and emits "x, y"', () => {
    const { widgets, emitted, press, move, release } = setup();
    const input = widgets.point({ id: 'input', x: 0, y: 0, draggable: true, label: 'Input', frame: plane() });
    expect(input.value).toEqual([0, 0]);
    press(205, 145);
    move(275, 100);
    expect(input.value).toEqual([0.5, 0.5]);
    move(900, -40);
    release(900, -40);
    expect(input.value).toEqual([1, 1]);
    expect(emitted).toEqual([['input', '0.03, 0.05'], ['input', '0.5, 0.5'], ['input', '1, 1']]);
  });

  it('is pressed only near where it is, and moves by a fiftieth of its frame on each arrow', () => {
    const { widgets, emitted, press, key } = setup();
    const input = widgets.point({ id: 'input', x: 0, y: 0, draggable: true, label: 'Input', frame: plane() });
    press(240, 150);
    expect(emitted).toEqual([]);
    key('ArrowRight');
    key('ArrowUp');
    expect(input.value).toEqual([0.04, 0.04]);
    key('ArrowLeft');
    key('ArrowDown');
    key('ArrowDown');
    expect(emitted.at(-1)).toEqual(['input', '0, -0.04']);
  });

  it('without a frame is placed in CSS pixels, within the canvas', () => {
    const { widgets, press, move } = setup();
    const dot = widgets.point({ id: 'dot', x: 100, y: 100, draggable: true, label: 'Dot' });
    press(100, 100);
    move(500, 120);
    expect(dot.value).toEqual([400, 120]);
  });
});

describe('a step-through', () => {
  it('goes back and on with its prev and next targets, stops at its ends, and emits what the reader sees', () => {
    const { widgets, emitted, press } = setup();
    const stage = widgets.step({ id: 'stage', steps: ['inputs', 'weights', 'output'], index: 0, label: 'Stage', x: 200, y: 40 });
    press(100, 40);
    expect(stage.value).toBe(0);
    press(300, 40);
    press(300, 40);
    press(300, 40);
    expect(stage.value).toBe(2);
    press(200, 40);
    expect(emitted).toEqual([['stage', 'weights'], ['stage', 'output']]);
  });

  it('with a count, says "n / count"; the arrows step it', () => {
    const { widgets, emitted, key } = setup();
    widgets.step({ id: 'page', steps: 5, index: 1, label: 'Page' });
    key('ArrowRight');
    key('ArrowDown');
    key('ArrowLeft');
    expect(emitted).toEqual([['page', '3 / 5'], ['page', '2 / 5'], ['page', '1 / 5']]);
  });

  it('has 2 to 64 steps', () => {
    const { widgets } = setup();
    expect(() => widgets.step({ id: 'page', steps: 1 })).toThrow(/2 to 64 steps/u);
    expect(() => widgets.step({ id: 'page', steps: 'many' })).toThrow(/2 to 64 steps/u);
  });
});

describe('the keyboard', () => {
  it('adjusts the widget last pointed at, else the first in the focusable order; number keys choose one', () => {
    const { widgets, emitted, press, key } = setup();
    const a = widgets.slider({ id: 'a', x: 0, y: 20, w: 100, min: 0, max: 10, value: 5, step: 1, label: 'A' });
    const b = widgets.slider({ id: 'b', x: 0, y: 80, w: 100, min: 0, max: 10, value: 5, step: 1, label: 'B' });
    widgets.focusable(b, a);
    key('ArrowRight');
    expect([a.value, b.value]).toEqual([5, 6]);
    key('2');
    key('ArrowUp');
    expect(a.value).toBe(6);
    press(0, 80);
    key('ArrowLeft');
    expect(b.value).toBe(0);
    expect(emitted).toEqual([['b', 6], ['a', 6], ['b', 0]]);
  });

  it('rings the chosen widget once a key has chosen it, and not after a press', () => {
    const { ctx, widgets, key, press } = setup();
    const a = widgets.slider({ id: 'a', x: 0, y: 20, w: 100, min: 0, max: 10, value: 5, step: 1, label: 'A' });
    const arcs = () => ctx.calls.filter(call => call[0] === 'arc').length;
    a.draw();
    const plain = arcs();
    key('1');
    ctx.calls.length = 0;
    a.draw();
    expect(arcs()).toBe(plain + 1);
    press(300, 290);
    ctx.calls.length = 0;
    a.draw();
    expect(arcs()).toBe(plain);
  });
});

describe('the set', () => {
  it('is described to the host: each widget’s id, kind, label, value and hit region, the label clipped', () => {
    const { widgets } = setup();
    widgets.slider({ id: 'mass', x: 100, y: 50, w: 200, min: 0, max: 1, value: 0.5, step: 0.1, label: 'M'.repeat(60) });
    widgets.step({ id: 'page', steps: 3, x: 200, y: 260, label: 'Page' });
    expect(widgets.describe()).toEqual([
      { id: 'mass', kind: 'slider', label: 'M'.repeat(SCENE_LIMITS.labelLength), value: 0.5, rect: [90, 34, 220, 32] },
      { id: 'page', kind: 'step', label: 'Page', value: '1 / 3', rect: [80, 242, 240, 36] }
    ]);
  });

  it('holds at most emitControls widgets', () => {
    const { widgets } = setup();
    for (let i = 0; i < SCENE_LIMITS.emitControls; i += 1) widgets.slider({ id: `s${i}`, x: 0, y: 0, w: 10, min: 0, max: 1 });
    expect(() => widgets.slider({ id: 'one-more', x: 0, y: 0, w: 10, min: 0, max: 1 })).toThrow(/at most 64 widgets/u);
  });

  it('is in rise.lib: slider, step and focusable, and point({ id, … }) beside point(frame, [x, y])', () => {
    const ctx = fakeCanvasContext();
    const emitted = [];
    let set = null;
    const lib = createSceneLibrary({ ctx, size: { width: 400, height: 300, dpr: 1 }, theme: {}, widgets: kit => (set = createWidgets({ ...kit, emit: (c, v) => emitted.push([c, v]) })) });
    const frame = lib.axes({ x: [0, 4], y: [0, 3] });
    lib.point(frame, [1, 1], { label: 'dot' });
    const p = lib.point({ id: 'p', x: 1, y: 1, draggable: true, label: 'P', frame });
    const s = lib.slider({ id: 's', x: 10, y: 10, w: 100, min: 0, max: 1, label: 'S' });
    const t = lib.step({ id: 't', steps: 2, label: 'T' });
    lib.focusable(t, s, p);
    expect(set.describe().map(item => item.id)).toEqual(['p', 's', 't']);
    set.dispatch({ type: 'keydown', key: 'ArrowRight', x: null, y: null, buttons: 0 });
    expect(emitted).toEqual([['t', '2 / 2']]);
  });
});

