/**
 * The figure layer: an admitted SVG figure shown as an image behind the
 * reading, from a blob: URL it owns and lets go of.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inkFigure, mountFigureLayer } from './figure-layer.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const SVG = `<svg ${NS} viewBox="0 0 4 3"><path d="M0,3 L4,3 z" stroke="currentColor"/></svg>`;
const blobs = [];
const revoked = [];

beforeEach(() => {
  blobs.length = 0;
  revoked.length = 0;
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: blob => { blobs.push(blob); return `blob:figure/${blobs.length}`; },
    revokeObjectURL: url => revoked.push(url)
  }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function field() {
  const node = document.createElement('div');
  node.id = 'chamber-field';
  document.body.appendChild(node);
  return node;
}

const behind = (host, node) => host.prepend(node);

describe('the figure layer', () => {
  it('shows the figure as an image of a blob: URL behind the reading, hidden from assistive technology', async () => {
    const host = field();
    const layer = mountFigureLayer({ field: host, insertBehindReading: behind, svg: SVG, ink: '#F4EEE4' });
    const img = layer.node;
    expect(img.tagName).toBe('IMG');
    expect(host.firstChild).toBe(img);
    expect(img.classList.contains('chamber-figure')).toBe(true);
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('src')).toBe('blob:figure/1');
    expect(blobs[0].type).toBe('image/svg+xml');
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blobs[0]); });
    expect(text).toBe(inkFigure(SVG, '#F4EEE4'));
  });

  it('lets go of the URL once the image has loaded, and again never', () => {
    const layer = mountFigureLayer({ field: field(), insertBehindReading: behind, svg: SVG, ink: null });
    layer.node.dispatchEvent(new Event('load'));
    expect(revoked).toEqual(['blob:figure/1']);
    layer.destroy();
    expect(revoked).toEqual(['blob:figure/1']);
    expect(layer.node.isConnected).toBe(false);
  });

  it('says when the image cannot be drawn, once, and lets go of the URL', () => {
    const onError = vi.fn();
    const layer = mountFigureLayer({ field: field(), insertBehindReading: behind, svg: SVG, ink: null, onError });
    layer.node.dispatchEvent(new Event('error'));
    layer.node.dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(revoked).toEqual(['blob:figure/1']);
  });

  it('lets go of the URL when it is taken down before the image loads, and says nothing after', () => {
    const onError = vi.fn();
    const layer = mountFigureLayer({ field: field(), insertBehindReading: behind, svg: SVG, ink: null, onError });
    layer.destroy();
    expect(revoked).toEqual(['blob:figure/1']);
    layer.node.dispatchEvent(new Event('error'));
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('the ink a figure draws in', () => {
  it('is the theme’s, given to the root as its colour, so currentColor inside the image is the theme’s ink', () => {
    expect(inkFigure(SVG, '#F4EEE4')).toBe(`<svg color="#F4EEE4" ${NS} viewBox="0 0 4 3"><path d="M0,3 L4,3 z" stroke="currentColor"/></svg>`);
    const prolog = `<?xml version="1.0"?>\n<!-- <svg> in a comment -->\n${SVG}`;
    expect(inkFigure(prolog, '#abc')).toBe(`<?xml version="1.0"?>\n<!-- <svg> in a comment -->\n<svg color="#abc" ${SVG.slice(5)}`);
  });

  it('is the figure’s own when its root sets one, and nothing when the theme gives none or no colour', () => {
    const own = `<svg ${NS} color="red" viewBox="0 0 1 1"></svg>`;
    expect(inkFigure(own, '#fff')).toBe(own);
    expect(inkFigure(SVG, null)).toBe(SVG);
    expect(inkFigure(SVG, 'red" onload="x')).toBe(SVG);
  });
});
