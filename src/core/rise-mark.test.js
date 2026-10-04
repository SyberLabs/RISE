import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the RISE mark', () => {
    it('puts the clip mark on the loading overlay instead of the diamond glyph', () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
        const css = readFileSync(join(ROOT, 'src', 'design-system.css'), 'utf8');
        expect(html).toMatch(/class="[^"]*rise-mark[^"]*"/);
        expect(html).not.toMatch(/<div class="loading-sigil">◇<\/div>/);
        expect(css).toMatch(/syber-clip\.png/);
    });
});
