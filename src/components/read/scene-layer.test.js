/**
 * The scene layer: the canvas a generated scene draws on, behind the reading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSceneLayer } from './scene-layer.js';

function field(width = 640, height = 360) {
  const node = document.createElement('div');
  node.id = 'chamber-field';
  Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => height });
  document.body.appendChild(node);
  return node;
}

/** The canvas's own box: in a host's card it ends where the bar's room begins, short of the field's bottom. */
function canvasBox(width, height) {
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
}

const behind = (host, node) => host.prepend(node);

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the scene layer', () => {
  it('puts a canvas behind the reading and reports the canvas’s own size, not the field’s', () => {
    const host = field(640, 448);
    canvasBox(640, 360);
    const sizes = [];
    const layer = mountSceneLayer({ field: host, insertBehindReading: behind, onResize: size => sizes.push(size) });
    expect(layer.canvas.tagName).toBe('CANVAS');
    expect(layer.canvas.classList.contains('chamber-scene')).toBe(true);
    expect(layer.node).toBe(layer.canvas);
    expect(host.firstChild).toBe(layer.canvas);
    expect(layer.resize()).toEqual({ width: 640, height: 360 });
    expect(sizes).toEqual([{ width: 640, height: 360 }]);
  });

  it('follows its canvas when it can observe it, and lets go when destroyed', () => {
    const observed = [];
    let callback = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { callback = fn; }
      observe(node) { observed.push(node); }
      disconnect() { observed.length = 0; }
    });
    const host = field(640, 448);
    canvasBox(640, 360);
    const sizes = [];
    const layer = mountSceneLayer({ field: host, insertBehindReading: behind, onResize: size => sizes.push(size) });
    expect(observed).toEqual([layer.canvas]);
    callback();
    expect(sizes).toEqual([{ width: 640, height: 360 }]);
    layer.destroy();
    expect(observed).toEqual([]);
    expect(layer.canvas.isConnected).toBe(false);
  });
});

describe('a scene that listens (docs/plans/LIVE-CURRENT.md §20)', () => {
  function mounted() {
    const host = field(640, 448);
    canvasBox(400, 300);
    const layer = mountSceneLayer({ field: host, insertBehindReading: behind });
    vi.spyOn(layer.canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 400, height: 300, right: 500, bottom: 350, x: 100, y: 50 });
    const inputs = [];
    return { host, layer, canvas: layer.canvas, inputs, onInput: event => inputs.push(event) };
  }
  const press = (node, type, clientX, clientY, extra = {}) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, buttons: 1, ...extra });
    node.dispatchEvent(event);
    return event;
  };
  const key = (node, type, name, extra = {}) => {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: name, ...extra });
    node.dispatchEvent(event);
    return event;
  };
  const NONE = { shift: false, alt: false, ctrl: false, meta: false };

  it('stays inert, hidden and unfocusable until the scene says it listens', () => {
    const { canvas, inputs } = mounted();
    press(canvas, 'pointerdown', 150, 60);
    expect(inputs).toEqual([]);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(canvas.dataset.listens).toBeUndefined();
  });

  it('listening, forwards the reader’s pointer as plain numbers in the canvas’s own CSS pixels, never the event', () => {
    const { layer, canvas, inputs, onInput } = mounted();
    layer.listen({ pointer: true, keys: true, onInput });
    expect(canvas.dataset.listens).toBe('pointer keys');
    press(canvas, 'pointerdown', 150, 60, { shiftKey: true });
    press(canvas, 'pointermove', 170, 80);
    press(canvas, 'pointerup', 170, 80, { buttons: 0 });
    expect(inputs).toEqual([
      { type: 'pointerdown', x: 50, y: 10, buttons: 1, key: null, modifiers: { ...NONE, shift: true } },
      { type: 'pointermove', x: 70, y: 30, buttons: 1, key: null, modifiers: NONE },
      { type: 'pointerup', x: 70, y: 30, buttons: 0, key: null, modifiers: NONE }
    ]);
  });

  it('drawn scaled (a room that fits the scene between its bar and its words), still forwards the canvas’s own CSS pixels', () => {
    const { layer, canvas, inputs, onInput } = mounted();
    canvas.getBoundingClientRect.mockReturnValue({ left: 100, top: 50, width: 200, height: 150, right: 300, bottom: 200, x: 100, y: 50 });
    layer.listen({ pointer: true, keys: false, onInput });
    press(canvas, 'pointerdown', 150, 80);
    expect(inputs).toEqual([{ type: 'pointerdown', x: 100, y: 60, buttons: 1, key: null, modifiers: NONE }]);
  });

  it('listening to keys, is focusable, said as an interactive scene, and takes arrows and printable keys but not the instrument’s', () => {
    const { layer, canvas, inputs, onInput } = mounted();
    layer.listen({ pointer: false, keys: true, onInput });
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.hasAttribute('aria-hidden')).toBe(false);
    expect(canvas.getAttribute('aria-label')).toMatch(/arrow keys/iu);
    expect(key(canvas, 'keydown', 'ArrowLeft').defaultPrevented).toBe(true);
    expect(key(canvas, 'keyup', 'ArrowLeft').defaultPrevented).toBe(true);
    expect(key(canvas, 'keydown', 'a').defaultPrevented).toBe(true);
    for (const name of [' ', 'r', 'f', '-', '=', '[', ']', 'Escape', 'Tab']) expect(key(canvas, 'keydown', name).defaultPrevented, name).toBe(false);
    expect(key(canvas, 'keydown', 'c', { ctrlKey: true }).defaultPrevented).toBe(false);
    press(canvas, 'pointerdown', 150, 60);
    expect(inputs).toEqual([
      { type: 'keydown', x: null, y: null, buttons: 0, key: 'ArrowLeft', modifiers: NONE },
      { type: 'keyup', x: null, y: null, buttons: 0, key: 'ArrowLeft', modifiers: NONE },
      { type: 'keydown', x: null, y: null, buttons: 0, key: 'a', modifiers: NONE }
    ]);
  });

  it('listening to the pointer only, stays out of the tab order and hidden; its widgets are still mirrored', () => {
    const { layer, canvas, onInput } = mounted();
    layer.listen({ pointer: true, keys: false, onInput });
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    layer.widgets([{ id: 'mass', kind: 'slider', label: 'Mass', value: 0.5, rect: [90, 34, 220, 32] }]);
    expect(document.querySelector('.chamber-scene-controls li').textContent).toBe('Mass, slider: 0.5');
  });

  it('mirrors its widgets in a hidden list that does not announce itself, as text', () => {
    const { layer, canvas, onInput } = mounted();
    layer.listen({ pointer: true, keys: true, onInput });
    layer.widgets([
      { id: 'w1', kind: 'slider', label: '<b>Weight</b> 1', value: 0.7, rect: [20, 20, 220, 32] },
      { id: 'input', kind: 'point', label: 'Input', value: '0.3, -0.2', rect: [180, 130, 32, 32] }
    ]);
    const list = document.querySelector('.chamber-scene-controls');
    expect(list.getAttribute('aria-live')).toBe('off');
    expect([...list.querySelectorAll('li')].map(item => item.textContent)).toEqual(['<b>Weight</b> 1, slider: 0.7', 'Input, point: 0.3, -0.2']);
    expect(list.querySelector('b')).toBeNull();
    expect(canvas.getAttribute('aria-describedby')).toBe(list.id);
    layer.widgets([{ id: 'w1', kind: 'slider', label: 'Weight 1', value: 0.8, rect: [20, 20, 220, 32] }]);
    expect([...list.querySelectorAll('li')].map(item => item.textContent)).toEqual(['Weight 1, slider: 0.8']);
  });

  it('holds touch only over the widgets: one region each, which takes a press, focuses the scene and forwards it as the canvas’s own', () => {
    const { layer, canvas, inputs, onInput } = mounted();
    layer.listen({ pointer: true, keys: true, onInput });
    layer.widgets([{ id: 'w1', kind: 'slider', label: 'Weight 1', value: 0.7, rect: [20, 20, 220, 32] }]);
    const hits = [...document.querySelectorAll('.chamber-scene-hit')];
    expect(hits).toHaveLength(1);
    expect([hits[0].style.left, hits[0].style.top, hits[0].style.width, hits[0].style.height]).toEqual(['20px', '20px', '220px', '32px']);
    hits[0].setPointerCapture = vi.fn();
    const down = press(hits[0], 'pointerdown', 220, 90);
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(canvas);
    expect(inputs).toEqual([{ type: 'pointerdown', x: 120, y: 40, buttons: 1, key: null, modifiers: NONE }]);
    layer.widgets([]);
    expect(document.querySelectorAll('.chamber-scene-hit')).toHaveLength(0);
  });

  it('takes everything it added away when destroyed', () => {
    const { layer, onInput } = mounted();
    layer.listen({ pointer: true, keys: true, onInput });
    layer.widgets([{ id: 'w1', kind: 'slider', label: 'Weight 1', value: 0.7, rect: [20, 20, 220, 32] }]);
    layer.destroy();
    expect(document.querySelector('.chamber-scene, .chamber-scene-controls, .chamber-scene-hits')).toBeNull();
  });
});
