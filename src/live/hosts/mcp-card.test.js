import { describe, expect, it } from 'vitest';
import { CARD_PATH, cardCsp, cardHtml } from './mcp-card.js';

const ORIGIN = 'https://rise.syberlabs.io';
const INDEX = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>RISE</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="canonical" href="https://rise.syberlabs.io/">
  <link rel="preload" href="/fonts/sans.woff2" as="font" type="font/woff2" crossorigin>
  <script type="module" crossorigin src="/assets/main-abc123.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/chunk-789.js">
  <link rel="stylesheet" crossorigin href="/assets/main-def456.css">
</head>
<body><div id="app"></div></body>
</html>`;

describe('the self-contained card', () => {
  it('is RISE\'s own page, every address of its own made RISE\'s, opening on the card\'s route', () => {
    const html = cardHtml({ origin: ORIGIN, indexHtml: INDEX });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // No <base>: a host's sandbox refuses one (Claude's policy carries base-uri 'self').
    expect(doc.querySelectorAll('base')).toHaveLength(0);
    expect(doc.querySelector('meta[name="rise-embed"]').getAttribute('content')).toBe(CARD_PATH);
    expect(doc.querySelector('script[type="module"]').getAttribute('src')).toBe(`${ORIGIN}/assets/main-abc123.js`);
    expect(doc.querySelector('link[rel="stylesheet"]').getAttribute('href')).toBe(`${ORIGIN}/assets/main-def456.css`);
    expect(doc.querySelector('link[rel="modulepreload"]').getAttribute('href')).toBe(`${ORIGIN}/assets/chunk-789.js`);
    expect(doc.querySelector('link[rel="preload"]').getAttribute('href')).toBe(`${ORIGIN}/fonts/sans.woff2`);
    expect(doc.querySelector('link[rel="icon"]').getAttribute('href')).toBe(`${ORIGIN}/favicon.ico`);
    // An address that is already absolute is left as it is.
    expect(doc.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://rise.syberlabs.io/');
    expect(doc.querySelectorAll('iframe')).toHaveLength(0);
    expect(doc.querySelectorAll('script:not([src])')).toHaveLength(0);
  });

  it('leaves a protocol-relative address alone', () => {
    const html = cardHtml({ origin: ORIGIN, indexHtml: INDEX.replace('<title>RISE</title>', '<title>RISE</title>\n  <link rel="dns-prefetch" href="//fonts.example">') });
    expect(html).toContain('href="//fonts.example"');
  });

  it('writes the route as an attribute value', () => {
    const html = cardHtml({ origin: ORIGIN, indexHtml: INDEX, path: '/live?embed=mcp&log=host' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('meta[name="rise-embed"]').getAttribute('content')).toBe('/live?embed=mcp&log=host');
  });

  it('declares exactly RISE\'s origin and frames nothing', () => {
    expect(cardCsp(ORIGIN)).toEqual({ connectDomains: [ORIGIN], resourceDomains: [ORIGIN], frameDomains: [] });
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
