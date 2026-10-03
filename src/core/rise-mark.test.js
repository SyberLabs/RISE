import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
