/**
 * The saved colourway is stamped on <html> before first paint by
 * public/accent-boot.js, a same-origin classic script in <head>. It was an
 * inline script until the live policy (script-src 'self') was seen refusing
 * it on every load, so the colour arrived only when the app ran.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CHAMBER_ACCENT_TOKENS, applyChamberAccent, migrateChamberAccent } from './chamber-accent.js';

const source = readFileSync(resolve(process.cwd(), 'public/accent-boot.js'), 'utf8');

/** Run the boot script against a storage reader; return the stamped accent. */
function boot(getItem) {
    const root = { dataset: {} };
    runInNewContext(source, {
        localStorage: { getItem },
        document: { documentElement: root }
    });
    return root.dataset.accent;
}

const saved = settings => boot(key => (key === 'rise-settings' ? JSON.stringify(settings) : null));

/** What the app itself stamps for the same stored settings. */
function app(settings) {
    const root = { dataset: {} };
    applyChamberAccent(root, migrateChamberAccent(settings.chamberAccent, settings.chamberAccentNamed));
    return root.dataset.accent;
}

describe('accent boot script', () => {
    it('stamps every colourway the app stamps, from the key the app saves to', () => {
        for (const id of Object.keys(CHAMBER_ACCENT_TOKENS)) {
            const settings = { chamberAccent: id, chamberAccentNamed: true };
            expect(saved(settings), id).toBe(id);
            expect(saved(settings), id).toBe(app(settings));
        }
    });

    it('leaves the bare :root for the default, unknown ids, and pre-split slate, as the app does', () => {
        for (const settings of [
            {},
            { chamberAccent: 'default', chamberAccentNamed: true },
            { chamberAccent: 'rose', chamberAccentNamed: true },
            { chamberAccent: 'toString', chamberAccentNamed: true },
            { chamberAccent: 'slate' }
        ]) {
            expect(saved(settings), JSON.stringify(settings)).toBeUndefined();
            expect(app(settings), JSON.stringify(settings)).toBeUndefined();
        }
    });

    it('survives no settings, corrupt settings, and storage that throws', () => {
        expect(boot(() => null)).toBeUndefined();
        expect(boot(() => 'null')).toBeUndefined();
        expect(boot(() => '{not json')).toBeUndefined();
        expect(boot(() => { throw new Error('SecurityError'); })).toBeUndefined();
    });

    it('is loaded from <head> as a classic, render-blocking script', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const head = html.slice(0, html.indexOf('</head>'));
        expect(head).toContain('<script src="/accent-boot.js"></script>');
    });
});
