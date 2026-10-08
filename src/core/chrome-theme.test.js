/**
 * The page chrome in the colours of the reading on screen (FND-008, B2b): the
 * theme's accent on the root while a themed reading is mounted, the ground
 * state otherwise, and one reading owning it at a time.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JEV_PALETTES } from './jev-palette.js';
import { clearChromeTheme, paintChromeTheme } from './chrome-theme.js';

const root = document.documentElement;
const token = name => root.style.getPropertyValue(name);

afterEach(() => root.removeAttribute('style'));

describe('the page chrome in the reading’s colours', () => {
    it('takes a theme’s accent on the root, and gives the root back to its ground state', () => {
        const reading = {};
        paintChromeTheme(root, JEV_PALETTES.rose.accent, reading);
        expect(token('--color-accent')).toBe('#FF5C93');
        expect(token('--color-accent-rgb')).toBe('255, 92, 147');
        expect(token('--color-threshold')).toBe('#FF5C93');
        clearChromeTheme(root, reading);
        for (const name of ['--color-accent', '--color-accent-rgb', '--color-threshold']) expect(token(name), name).toBe('');
    });

    it('belongs to one reading at a time: the one going cannot take the next one’s colours with it', () => {
        const going = {};
        const coming = {};
        paintChromeTheme(root, JEV_PALETTES.rose.accent, going);
        paintChromeTheme(root, JEV_PALETTES.jade.accent, coming);
        clearChromeTheme(root, going);
        expect(token('--color-accent')).toBe(JEV_PALETTES.jade.accent);
        clearChromeTheme(root, coming);
        expect(token('--color-accent')).toBe('');
    });

    it('keeps the ground state’s ink legible on every theme’s accent, so the ink is never painted', () => {
        const css = readFileSync(resolve(process.cwd(), 'src/design-system.css'), 'utf8');
        const ink = /--color-on-accent:\s*(#[0-9a-f]{6})/iu.exec(css)[1];
        const channel = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const luminance = hex => {
            const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        for (const [id, palette] of Object.entries(JEV_PALETTES)) {
            expect(ratio(ink, palette.accent), id).toBeGreaterThanOrEqual(4.5);
        }
    });
});
