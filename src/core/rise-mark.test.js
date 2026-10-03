import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BetaGate } from '../components/BetaGate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the RISE mark', () => {
    it('puts the clip mark on the loading overlay instead of the diamond glyph', () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
        const css = readFileSync(join(ROOT, 'src', 'design-system.css'), 'utf8');
        expect(html).toMatch(/class="[^"]*rise-mark[^"]*"/);
        expect(html).not.toMatch(/<div class="loading-sigil">◇<\/div>/);
        expect(css).toMatch(/syber-clip\.png/);
    });

    // Only an invited reader meets the entry screen; the open door has none.
    const invitedGate = () => {
        localStorage.removeItem('rise-beta-session');
        window.history.replaceState(null, '', '/?invite=rise2025');
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        window.history.replaceState(null, '', '/');
        return container;
    };

    it('lets a personal invite replace an automatic open session', () => {
        localStorage.setItem('rise-beta-session', JSON.stringify({ code: 'open', name: 'Reader', vault: null, timestamp: Date.now() }));
        window.history.replaceState(null, '', '/?invite=rise2025');
        const container = document.createElement('div');
        let admitted = null;
        new BetaGate(container, { onAccess: session => { admitted = session; } });
        window.history.replaceState(null, '', '/');
        expect(admitted).toBeNull();
        container.querySelector('#beta-enter').click();
        expect(admitted).toMatchObject({ code: 'rise2025', name: 'Beta Tester' });
        localStorage.removeItem('rise-beta-session');
    });

    it('opens the first-entry gate with the SyberLabs lockup, not a glyph', () => {
        const container = invitedGate();
        const lockup = container.querySelector('.beta-gate .sl-lockup');
        expect(lockup).toBeTruthy();
        expect(lockup.getAttribute('aria-label')).toBe('SyberLabs RISE');
        expect(container.querySelector('.sl-mark').getAttribute('src')).toBe('/syberlabs-mark.webp');
        expect(container.textContent).not.toContain('◇');
    });

    it('marks the gate with the RISE sigil on a plate, the clip mark holding it until drawn', () => {
        const container = invitedGate();
        const plate = container.querySelector('.beta-plate');
        expect(plate).toBeTruthy();
        expect(plate.getAttribute('aria-hidden')).toBe('true');
        expect(plate.querySelector('.beta-sigil canvas.beta-sigil-canvas')).toBeTruthy();
        expect(plate.querySelector('.beta-sigil-fallback.rise-mark')).toBeTruthy();
        // The header lockup carries the product's 16px sigil too.
        expect(container.querySelector('.sl-lockup canvas.sl-sigil')).toBeTruthy();
    });

    it('gives the gate one statement and one primary action', () => {
        const container = invitedGate();
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
});
