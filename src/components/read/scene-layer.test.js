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

const behind = (host, node) => host.prepend(node);

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('the scene layer', () => {
  it('puts a canvas behind the reading and reports the field’s size', () => {
    const host = field();
    const sizes = [];
    const layer = mountSceneLayer({ field: host, insertBehindReading: behind, onResize: size => sizes.push(size) });
    expect(layer.canvas.tagName).toBe('CANVAS');
    expect(layer.canvas.classList.contains('chamber-scene')).toBe(true);
    expect(layer.node).toBe(layer.canvas);
    expect(host.firstChild).toBe(layer.canvas);
    expect(layer.resize()).toEqual({ width: 640, height: 360 });
    expect(sizes).toEqual([{ width: 640, height: 360 }]);
  });

  it('follows the field when it can observe it, and lets go when destroyed', () => {
    const observed = [];
    let callback = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { callback = fn; }
      observe(node) { observed.push(node); }
      disconnect() { observed.length = 0; }
    });
    const host = field();
    const sizes = [];
    const layer = mountSceneLayer({ field: host, insertBehindReading: behind, onResize: size => sizes.push(size) });
    expect(observed).toEqual([host]);
    callback();
    expect(sizes).toEqual([{ width: 640, height: 360 }]);
    layer.destroy();
    expect(observed).toEqual([]);
    expect(layer.canvas.isConnected).toBe(false);
  });
});
