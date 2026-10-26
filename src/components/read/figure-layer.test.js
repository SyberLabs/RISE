/**
 * The figure layer: an admitted SVG figure shown as an image behind the
 * reading, from a blob: URL it owns and lets go of.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddedFace, hexOfColor, inkFigure, mountFigureLayer, paintFigure } from './figure-layer.js';

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

describe('the words’ ink, as a figure takes it when the reading names no theme', () => {
  it('is the computed colour of the words, as hex', () => {
    expect(hexOfColor('rgb(238, 240, 255)')).toBe('#eef0ff');
    expect(hexOfColor('rgb(0, 10, 255)')).toBe('#000aff');
    expect(hexOfColor('rgba(238, 240, 255, 1)')).toBe('#eef0ff');
  });

  it('is nothing when the colour is not a solid one it can read', () => {
    expect(hexOfColor('rgba(238, 240, 255, 0.5)')).toBe(null);
    expect(hexOfColor('canvastext')).toBe(null);
    expect(hexOfColor('')).toBe(null);
    expect(hexOfColor(undefined)).toBe(null);
  });
});

describe('what else a figure is drawn with: the theme’s dark and the reading face', () => {
  const TEXTED = `<svg ${NS} viewBox="0 0 4 3"><circle class="dark" cx="2" cy="1" r="1"/><text x="0" y="3">label</text></svg>`;

  it('gives the class dark the theme’s dark and its text the reading’s face, after the root’s start tag', () => {
    const painted = paintFigure(TEXTED, { ink: '#F4EEE4', dark: '#0A0B0F', face: { css: '@font-face{font-family:"Reading face"}', family: '"Reading face", Georgia, serif' } });
    expect(painted).toBe(`<svg color="#F4EEE4" ${NS} viewBox="0 0 4 3"><style>.dark{fill:#0A0B0F}@font-face{font-family:"Reading face"}text{font-family:"Reading face", Georgia, serif}</style><circle class="dark" cx="2" cy="1" r="1"/><text x="0" y="3">label</text></svg>`);
  });

  it('adds nothing a figure does not use: no face without text, no dark without a colour', () => {
    expect(paintFigure(SVG, { ink: '#F4EEE4', face: { css: 'x', family: 'y' } })).toBe(inkFigure(SVG, '#F4EEE4'));
    expect(paintFigure(TEXTED, { ink: null, dark: 'rgba(0,0,0,0)' })).toBe(TEXTED);
  });

  it('draws a figure with text once its face is ready, and in the fallback faces if it never is', async () => {
    let ready;
    const face = new Promise(resolve => { ready = resolve; });
    const layer = mountFigureLayer({ field: field(), insertBehindReading: behind, svg: TEXTED, ink: '#F4EEE4', face });
    expect(layer.node.getAttribute('src')).toBeNull();
    ready(null);
    await vi.waitFor(() => expect(layer.node.getAttribute('src')).toBe('blob:figure/1'));
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blobs[0]); });
    expect(text).toBe(paintFigure(TEXTED, { ink: '#F4EEE4' }));
  });

  it('carries the reading’s face into the image from the page’s own @font-face rules, its files as data', async () => {
    const rule = (family, src, range) => ({ type: 5, style: { getPropertyValue: name => ({ 'font-family': family, 'font-style': 'normal', 'font-weight': '400', src, 'unicode-range': range })[name] ?? '' } });
    const doc = {
      baseURI: 'https://rise.example/live',
      styleSheets: [{ href: 'https://rise.example/assets/fonts.css', cssRules: [
        rule('"Crimson Pro"', 'url("/fonts/crimson.woff2") format("woff2")', 'U+0000-00FF'),
        rule('"Other"', 'url("/fonts/other.woff2") format("woff2")', '')
      ] }]
    };
    const fetched = [];
    vi.stubGlobal('fetch', async url => { fetched.push(String(url)); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; });
    const face = await embeddedFace(doc, '"Crimson Pro", Georgia, serif');
    expect(fetched).toEqual(['https://rise.example/fonts/crimson.woff2']);
    expect(face).toEqual({
      css: '@font-face{font-family:"RISE reading face";src:url(data:font/woff2;base64,AQID) format("woff2");unicode-range:U+0000-00FF}',
      family: '"RISE reading face", Georgia, serif'
    });
    expect(await embeddedFace(doc, '"Nowhere", Georgia, serif')).toEqual({ css: '', family: 'Georgia, serif' });
  });
});

describe('a face the figure chose', () => {
  it('is kept: the reading’s face is given only to a figure that names none', () => {
    const chosen = `<svg ${NS} viewBox="0 0 4 3" font-family="monospace"><text x="0" y="3">x = 1</text></svg>`;
    expect(paintFigure(chosen, { face: { css: 'c', family: 'f' } })).toBe(chosen);
  });
});
