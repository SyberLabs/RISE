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
    it('exposes exactly the six allowlisted ids in chip order', () => {
        expect(CHAMBER_ACCENTS.map((accent) => [accent.id, accent.label])).toEqual([
            ['ivory', 'Ivory Cream'],
            ['purple', 'Purple'],
            ['cobalt', 'Cobalt Blue'],
            ['amber', 'Amber Gold'],
            ['sunset', 'Sunset Orange'],
            ['gecko', 'Gecko Green']
        ]);
    });

    it('passes through each allowlisted id and defaults unknown to ivory', () => {
        for (const id of ['ivory', 'purple', 'cobalt', 'amber', 'sunset', 'gecko']) {
            expect(persistChamberAccent(id)).toBe(id);
            expect(resolveChamberAccent(id)).toBe(id);
        }
        expect(persistChamberAccent('violet')).toBeNull();
        for (const bad of [undefined, null, '', 'violet', 'purple ', 0, 'visualMode']) {
            expect(resolveChamberAccent(bad), String(bad)).toBe('ivory');
        }
    });

    it('round-trips persist through resolve', () => {
        expect(resolveChamberAccent(persistChamberAccent('sunset'))).toBe('sunset');
        expect(resolveChamberAccent(persistChamberAccent('nope'))).toBe('ivory');
    });

    it('stamps data-accent on the root and reports when the stamp does not take', () => {
        const root = document.documentElement;
        delete root.dataset.accent;

        expect(applyChamberAccent(root, 'cobalt')).toBe(true);
        expect(root.dataset.accent).toBe('cobalt');

        expect(applyChamberAccent(root, 'papyrus')).toBe(true);
        expect(root.dataset.accent).toBe('ivory');

        expect(applyChamberAccent(null, 'gecko')).toBe(false);
    });

    it('maps each id to the chrome token set that replaces --color-threshold', () => {
        expect(CHAMBER_ACCENT_TOKENS.ivory['--color-accent']).toBe('#E4D2AE');
        expect(CHAMBER_ACCENT_TOKENS.ivory['--color-accent-rgb']).toBe('228, 210, 174');
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

    it('keeps --color-threshold on the same hex as --color-accent for every allowlisted id', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'design-system.css'),
            'utf8'
        );
        for (const [id, tokens] of Object.entries(CHAMBER_ACCENT_TOKENS)) {
            const hex = tokens['--color-accent'];
            expect(tokens['--color-threshold'], id).toBe(hex);
            const block = css.match(new RegExp(
                `:root\\[data-accent="${id}"\\]\\s*\\{([^}]+)\\}`
            ));
            expect(block, `[data-accent="${id}"]`).toBeTruthy();
            expect(block[1]).toContain(`--color-accent: ${hex}`);
            expect(block[1]).toContain(`--color-threshold: ${hex}`);
        }
    });

    it('tints primary and Begin Session hover from the sitting accent, not leftover purple', () => {
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const system = readFileSync(join(root, 'design-system.css'), 'utf8');
        const orbital = readFileSync(join(root, 'components', 'ChamberOrbital.css'), 'utf8');
        const primaryHover = system.match(/\.btn-primary:hover:not\(:disabled\)\s*\{[^}]+\}/);
        const largeHover = orbital.match(/\.btn-large:hover\s*\{[^}]+\}/);
        expect(primaryHover, '.btn-primary:hover').toBeTruthy();
        expect(largeHover, '.btn-large:hover').toBeTruthy();
        expect(system).not.toMatch(/#9d91e0/i);
        expect(primaryHover[0]).toMatch(/--color-accent/);
        expect(largeHover[0]).toMatch(/--color-accent/);
        expect(largeHover[0]).not.toMatch(/background:\s*var\(--color-light\)/);
        expect(largeHover[0]).not.toMatch(/232,\s*232,\s*236/);
    });

    it('tints the orbital center ring a lighter accent than the satellite orbs', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'ChamberOrbital.css'),
            'utf8'
        );
        const center = css.match(/\.orbit-center\s*\{[^}]+\}/);
        const orbs = css.match(/\.orbit-node\s*\{[^}]+\}/);
        expect(center, '.orbit-center').toBeTruthy();
        expect(orbs, '.orbit-node').toBeTruthy();
        expect(orbs[0]).toMatch(/border:[^;]*var\(--color-accent\)/);
        expect(center[0]).toMatch(/border:[^;]*color-mix\(in srgb,\s*var\(--color-accent\)/);
        expect(center[0]).toMatch(/color-mix\(in srgb,\s*var\(--color-accent\)[^;]*var\(--color-light\)/);
        expect(center[0]).not.toMatch(/border:\s*3px\s+solid\s+var\(--color-light\)/);
        expect(center[0]).not.toMatch(/232,\s*232,\s*236/);
    });

    it('tints the Portal wordmark from the sitting accent', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'Portal.css'),
            'utf8'
        );
        const title = css.match(/\.portal-title\s*\{[^}]+\}/);
        expect(title, '.portal-title').toBeTruthy();
        expect(title[0]).toMatch(/color:\s*var\(--color-accent\)/);
        expect(title[0]).not.toMatch(/color:\s*var\(--color-light\)/);
    });

    it('does not leave the purple rgb triple as a chrome wash outside the purple token', () => {
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const files = [
            'design-system.css',
            'premium-additions.css',
            'components/Chamber.css',
            'components/ChamberOrbital.css',
            'components/Library.css',
            'components/Guide.css',
            'components/Keystones.css',
            'components/NamingModal.css',
            'components/NamingModal.js',
            'components/Settings.css',
            'components/VisualInterlocutionPanel.css',
            'components/BetaGate.css'
        ];
        const leftover = /rgba\(\s*139,\s*127,\s*212\s*,/g;
        for (const rel of files) {
            const text = readFileSync(join(root, rel), 'utf8');
            const hits = text.match(leftover) || [];
            expect(hits, rel).toEqual([]);
        }
    });
});
