import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BetaGate } from '../components/BetaGate.js';
import { CHAMBER_ACCENT_TOKENS } from './chamber-accent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the RISE mark', () => {
    it('puts the clip mark on the loading overlay instead of the diamond glyph', () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
        const css = readFileSync(join(ROOT, 'src', 'design-system.css'), 'utf8');
        expect(html).toMatch(/class="[^"]*rise-mark[^"]*"/);
        expect(html).not.toMatch(/<div class="loading-sigil">◇<\/div>/);
        expect(css).toMatch(/syber-clip\.png/);
    });

    it('opens the first-entry gate with the SyberLabs lockup, not a glyph', () => {
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        const lockup = container.querySelector('.beta-gate .sl-lockup');
        expect(lockup).toBeTruthy();
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        expect(container.querySelector('.sl-mark').getAttribute('src')).toBe('/syberlabs-mark.webp');
        expect(container.textContent).not.toContain('◇');
    });

    it('marks the gate with the RISE sigil on a plate, the clip mark holding it until drawn', () => {
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        const plate = container.querySelector('.beta-plate');
        expect(plate).toBeTruthy();
        expect(plate.getAttribute('aria-hidden')).toBe('true');
        expect(plate.querySelector('.beta-sigil canvas.beta-sigil-canvas')).toBeTruthy();
        expect(plate.querySelector('.beta-sigil-fallback.rise-mark')).toBeTruthy();
        // The header lockup carries the product's 16px sigil too.
        expect(container.querySelector('.sl-lockup canvas.sl-sigil')).toBeTruthy();
    });

    it('gives the gate one statement and one primary action', () => {
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        expect(container.querySelector('h1.beta-title').textContent).toBe('Read beyond the page.');
        expect(container.querySelectorAll('button')).toHaveLength(1);
        expect(container.querySelector('#beta-enter').textContent.trim()).toBe('Enter RISE');
    });

    it('keeps the entry gate still and decorates it only through the system tokens', () => {
        const css = readFileSync(join(ROOT, 'src', 'components', 'BetaGate.css'), 'utf8');
        // v2 allows the spectrum and the primary glow, but only as tokens:
        // no private gradients, grain or glows written into the gate.
        expect(css).not.toMatch(/gradient\(/);
        for (const [, value] of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
            expect(value.trim()).toMatch(/^var\(--sy-primary-glow(?:-hover)?\)$/);
        }
        expect(css).not.toMatch(/animation:[^;]*infinite/);
    });

    it('stamps data-accent from stored settings before the module graph runs', () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
        expect(html).toMatch(/rise-settings/);
        expect(html).toMatch(/dataset\.accent/);
        expect(html).toMatch(/chamberAccent/);
        expect(html).toMatch(/ivory/);
        const allowlist = html.match(/var allowed = \{([^}]+)\}/)?.[1] || '';
        for (const id of Object.keys(CHAMBER_ACCENT_TOKENS)) {
            expect(allowlist, id).toMatch(new RegExp(`\\b${id}\\s*:`));
        }
        expect(allowlist).not.toMatch(/\bdefault\s*:/);
    });
});
