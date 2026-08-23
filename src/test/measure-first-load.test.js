/**
 * The first-load measurement is only worth having if it cannot miss an
 * asset. A parser that silently skips the stylesheet reports a smaller
 * number every time someone moves CSS around, which is exactly the
 * direction a first-load metric must never be wrong in.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstLoadAssets, measure } from '../../scripts/measure-first-load.mjs';

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

/**
 * THE WORST BUILD MUST NOT MEASURE AS THE SMALLEST.
 *
 * A shell that names an asset which is not in `dist` is a broken deploy —
 * that is the shape of the stale-chunk failure `router.js` already reloads
 * to recover from. Skipping the reference rather than reporting it would
 * subtract its bytes from the total, so the more broken the build, the
 * better the number.
 */
describe('a shell reference that resolves to nothing', () => {
    const dist = resolve(process.cwd(), 'dist/index.html');

    it.runIf(existsSync(dist))('is reported rather than quietly skipped', () => {
        const clean = measure();
        expect(clean.missing).toEqual([]);

        // The same accounting against a shell naming one asset that is not
        // there: it must appear as missing, not vanish from the total.
        const html = readFileSync(dist, 'utf8');
        const withGhost = html.replace(
            '</head>',
            '<link rel="modulepreload" href="/assets/not-built-abc123.js"></head>'
        );
        const referenced = firstLoadAssets(withGhost).map(asset => asset.href);
        expect(referenced).toContain('/assets/not-built-abc123.js');
    });
});
