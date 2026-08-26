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

    it('puts the clip mark on the first-entry gate instead of the diamond glyph', () => {
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        const mark = container.querySelector('.beta-sigil.rise-mark');
        expect(mark).toBeTruthy();
        expect(mark.textContent).not.toContain('◇');
    });

    it('locks the entry mark, title, and subtitle as one optically centered stack', () => {
        const container = document.createElement('div');
        new BetaGate(container, { onAccess: () => {} });
        const identity = container.querySelector('.beta-identity');
        expect(identity).toBeTruthy();
        expect(identity.querySelector('.beta-sigil.rise-mark')).toBeTruthy();
        expect(identity.querySelector('.beta-title')).toBeTruthy();
        expect(identity.querySelector('.beta-subtitle')).toBeTruthy();

        const css = readFileSync(join(ROOT, 'src', 'components', 'BetaGate.css'), 'utf8');
        expect(css).toMatch(/\.beta-title\s*\{[^}]*--tracking:/s);
        expect(css).toMatch(/\.beta-title\s*\{[^}]*padding-inline-start:\s*var\(--tracking\)/s);
        expect(css).toMatch(/\.beta-title\s*\{[^}]*line-height:\s*1(?:\s|;|$)/s);
        expect(css).toMatch(/\.beta-subtitle\s*\{[^}]*--tracking:/s);
        expect(css).toMatch(/\.beta-subtitle\s*\{[^}]*padding-inline-start:\s*var\(--tracking\)/s);
        expect(css).toMatch(/\.beta-identity\s*\{[^}]*align-items:\s*center/s);
        expect(css).toMatch(/\.beta-sigil\.rise-mark\s*\{[^}]*200\s*\/\s*256/s);
    });

    it('keeps the entry-gate mark still', () => {
        const css = readFileSync(join(ROOT, 'src', 'components', 'BetaGate.css'), 'utf8');
        const block = css.match(/\.beta-sigil\.rise-mark\s*\{[^}]+\}/);
        expect(block, 'the clip mark must override the float').toBeTruthy();
        expect(block[0]).toMatch(/animation:\s*none/);
        expect(css).toMatch(/\.beta-sigil\.rise-mark::before\s*\{[^}]*animation:\s*none/s);
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
