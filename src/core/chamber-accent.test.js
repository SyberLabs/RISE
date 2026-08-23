import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    CHAMBER_ACCENTS,
    CHAMBER_ACCENT_TOKENS,
    applyChamberAccent,
    persistChamberAccent,
    resolveChamberAccent
} from './chamber-accent.js';

describe('Chamber accent allowlist', () => {
    it('exposes exactly the five allowlisted ids in chip order', () => {
        expect(CHAMBER_ACCENTS.map((accent) => [accent.id, accent.label])).toEqual([
            ['purple', 'Purple'],
            ['cobalt', 'Cobalt Blue'],
            ['amber', 'Amber Gold'],
            ['sunset', 'Sunset Orange'],
            ['gecko', 'Gecko Green']
        ]);
    });

    it('passes through each allowlisted id and defaults unknown to purple', () => {
        for (const id of ['purple', 'cobalt', 'amber', 'sunset', 'gecko']) {
            expect(persistChamberAccent(id)).toBe(id);
            expect(resolveChamberAccent(id)).toBe(id);
        }
        expect(persistChamberAccent('violet')).toBeNull();
        for (const bad of [undefined, null, '', 'violet', 'purple ', 0, 'visualMode']) {
            expect(resolveChamberAccent(bad), String(bad)).toBe('purple');
        }
    });

    it('round-trips persist through resolve', () => {
        expect(resolveChamberAccent(persistChamberAccent('sunset'))).toBe('sunset');
        expect(resolveChamberAccent(persistChamberAccent('nope'))).toBe('purple');
    });

    it('stamps data-accent on the root and reports when the stamp does not take', () => {
        const root = document.documentElement;
        delete root.dataset.accent;

        expect(applyChamberAccent(root, 'cobalt')).toBe(true);
        expect(root.dataset.accent).toBe('cobalt');

        expect(applyChamberAccent(root, 'papyrus')).toBe(true);
        expect(root.dataset.accent).toBe('purple');

        expect(applyChamberAccent(null, 'gecko')).toBe(false);
    });

    it('maps each id to the chrome token set that replaces --color-threshold', () => {
        expect(CHAMBER_ACCENT_TOKENS.purple['--color-accent']).toBe('#8B7FD4');
        expect(CHAMBER_ACCENT_TOKENS.purple['--color-accent-rgb']).toBe('139, 127, 212');
        expect(CHAMBER_ACCENT_TOKENS.cobalt['--color-accent']).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(CHAMBER_ACCENT_TOKENS.amber['--color-accent']).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(CHAMBER_ACCENT_TOKENS.sunset['--color-accent']).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(CHAMBER_ACCENT_TOKENS.gecko['--color-accent']).toMatch(/^#[0-9A-Fa-f]{6}$/);

        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'design-system.css'),
            'utf8'
        );
        expect(css).toContain('--color-accent:');
        expect(css).toContain('--color-accent-rgb:');
        for (const id of Object.keys(CHAMBER_ACCENT_TOKENS)) {
            expect(css).toContain(`[data-accent="${id}"]`);
            expect(css).toContain(CHAMBER_ACCENT_TOKENS[id]['--color-accent']);
        }
        expect(css).toMatch(/\.settings \.radio input\[type="radio"\]:checked\s*\{[^}]*--color-accent/s);
    });
});
