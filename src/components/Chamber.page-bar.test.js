/**
 * The Chamber bar's Page-only controls.
 *
 * Elongate lives in the one bar so it is not a second object. The
 * `hidden` attribute is the JS fence; `.control-btn { display: flex }`
 * is the CSS that would otherwise keep a hidden Elongate on the Stream
 * — the same cascade that already needed `.page-turn[hidden]`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'Chamber.css'),
    'utf8'
);

describe('Elongate belongs to the Page', () => {
    it('[hidden] actually hides it — display:flex must not win', () => {
        expect(css).toMatch(/\.page-elongate\[hidden\]\s*\{[^}]*display:\s*none/);
    });
});
