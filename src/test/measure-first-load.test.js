/**
 * The first-load measurement is only worth having if it cannot miss an
 * asset. A parser that silently skips the stylesheet reports a smaller
 * number every time someone moves CSS around, which is exactly the
 * direction a first-load metric must never be wrong in.
 */

import { describe, it, expect } from 'vitest';
import { firstLoadAssets } from '../../scripts/measure-first-load.mjs';

const SHELL = `<!DOCTYPE html><html><head>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <script type="module" crossorigin src="/assets/index-abc.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/audio-def.js">
  <link rel="stylesheet" crossorigin href="/assets/index-ghi.css">
  <link rel="manifest" href="/site.webmanifest">
</head><body></body></html>`;

describe('firstLoadAssets', () => {
    it('collects the entry script, every modulepreload, and every stylesheet', () => {
        expect(firstLoadAssets(SHELL)).toEqual([
            { kind: 'script', href: '/assets/index-abc.js' },
            { kind: 'modulepreload', href: '/assets/audio-def.js' },
            { kind: 'stylesheet', href: '/assets/index-ghi.css' }
        ]);
    });

    it('ignores icons and the web manifest, which are not on the paint path', () => {
        const hrefs = firstLoadAssets(SHELL).map(asset => asset.href);
        expect(hrefs).not.toContain('/favicon.ico');
        expect(hrefs).not.toContain('/site.webmanifest');
    });

    it('ignores absolute third-party URLs, which are not ours to count', () => {
        const html = '<link rel="stylesheet" href="https://fonts.example/x.css">';
        expect(firstLoadAssets(html)).toEqual([]);
    });
});
