import { describe, expect, it } from 'vitest';
import { CARD_PATH, cardCsp, cardHtml } from './mcp-card.js';

const ORIGIN = 'https://rise.syberlabs.io';
const INDEX = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>RISE</title>
  <script type="module" crossorigin src="/assets/main-abc123.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/main-def456.css">
</head>
<body><div id="app"></div></body>
</html>`;

describe('the self-contained card', () => {
  it('is RISE\'s own page, its addresses resolved at RISE, opening on the card\'s route', () => {
    const html = cardHtml({ origin: ORIGIN, indexHtml: INDEX });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('base').getAttribute('href')).toBe(`${ORIGIN}/`);
    expect(doc.querySelector('meta[name="rise-embed"]').getAttribute('content')).toBe(CARD_PATH);
    // Before anything that resolves an address.
    expect(doc.head.firstElementChild.tagName).toBe('BASE');
    expect(doc.querySelector('script[type="module"]').getAttribute('src')).toBe('/assets/main-abc123.js');
    expect(doc.querySelectorAll('iframe')).toHaveLength(0);
    expect(doc.querySelectorAll('script:not([src])')).toHaveLength(0);
  });

  it('declares exactly RISE\'s origin and frames nothing', () => {
    expect(cardCsp(ORIGIN)).toEqual({
      connectDomains: [ORIGIN], resourceDomains: [ORIGIN], baseUriDomains: [ORIGIN], frameDomains: []
    });
  });

  it('refuses anything but an origin, a plain path and a page with one head and no base of its own', () => {
    for (const bad of ['rise.syberlabs.io', 'https://rise.syberlabs.io/', 'javascript:alert(1)']) {
      expect(() => cardHtml({ origin: bad, indexHtml: INDEX }), bad).toThrow('origin');
    }
    expect(() => cardHtml({ origin: ORIGIN, indexHtml: INDEX, path: '/live"><x' })).toThrow('plain path');
    expect(() => cardHtml({ origin: ORIGIN, indexHtml: '<html><body></body></html>' })).toThrow('head');
    expect(() => cardHtml({ origin: ORIGIN, indexHtml: INDEX.replace('<head>', '<head><base href="/x/">') })).toThrow('base');
  });
});
