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
    it('exposes exactly the ten allowlisted ids in chip order', () => {
        expect(CHAMBER_ACCENTS.map((accent) => [accent.id, accent.label])).toEqual([
            ['slate', 'Slate'],
            ['ivory', 'Ivory'],
            ['purple', 'Amethyst'],
            ['cobalt', 'Cobalt'],
            ['amber', 'Amber'],
            ['sunset', 'Sunset'],
            ['gecko', 'Jade'],
            ['garnet', 'Garnet'],
            ['teal', 'Teal'],
            ['orchid', 'Orchid']
        ]);
    });

    it('passes through each allowlisted id and defaults unknown to slate', () => {
        for (const id of ['slate', 'ivory', 'purple', 'cobalt', 'amber', 'sunset', 'gecko', 'garnet', 'teal', 'orchid']) {
            expect(persistChamberAccent(id)).toBe(id);
            expect(resolveChamberAccent(id)).toBe(id);
        }
        expect(persistChamberAccent('violet')).toBeNull();
        for (const bad of [undefined, null, '', 'violet', 'purple ', 0, 'visualMode']) {
            expect(resolveChamberAccent(bad), String(bad)).toBe('slate');
        }
    });

    it('round-trips persist through resolve', () => {
        expect(resolveChamberAccent(persistChamberAccent('sunset'))).toBe('sunset');
        expect(resolveChamberAccent(persistChamberAccent('nope'))).toBe('slate');
    });

    it('stamps a colourway but CLEARS the attribute for Slate', () => {
        const root = document.documentElement;
        delete root.dataset.accent;

        expect(applyChamberAccent(root, 'cobalt')).toBe(true);
        expect(root.dataset.accent).toBe('cobalt');

        // Slate is the bare :root — choosing it removes the attribute, so the
        // full-colourway rule (:root[data-accent]) no longer matches.
        expect(applyChamberAccent(root, 'slate')).toBe(true);
        expect(root.dataset.accent).toBeUndefined();

        // An unknown id resolves to Slate, and so also clears the attribute.
        root.dataset.accent = 'cobalt';
        expect(applyChamberAccent(root, 'papyrus')).toBe(true);
        expect(root.dataset.accent).toBeUndefined();

        expect(applyChamberAccent(null, 'gecko')).toBe(false);
    });

    it('has no token block for slate — it is the bare :root', () => {
        expect(CHAMBER_ACCENT_TOKENS.slate).toBeUndefined();
    });

    it('maps each id to the chrome token set that replaces --color-threshold', () => {
        expect(CHAMBER_ACCENT_TOKENS.ivory['--color-accent']).toBe('#E4D2AE');
        expect(CHAMBER_ACCENT_TOKENS.ivory['--color-accent-rgb']).toBe('228, 210, 174');
        expect(CHAMBER_ACCENT_TOKENS.purple['--color-accent']).toBe('#9C86DB');
        expect(CHAMBER_ACCENT_TOKENS.purple['--color-accent-rgb']).toBe('156, 134, 219');
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
            'components/VisualNavigator.css',
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

describe('the accent carries a legible ink for full fills', () => {
    // WCAG relative luminance and contrast, computed here rather than restated,
    // so a future accent whose --color-on-accent fails is caught by the math —
    // not by a number someone remembered to update. The panel's own guard.
    const channel = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
    };
    const contrast = (a, b) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    };

    it('gives every family an --color-on-accent that clears AA (4.5:1)', () => {
        for (const [id, tokens] of Object.entries(CHAMBER_ACCENT_TOKENS)) {
            const ink = tokens['--color-on-accent'];
            expect(ink, `${id} declares an ink`).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(contrast(ink, tokens['--color-accent']),
                `${id}: ${ink} on ${tokens['--color-accent']}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('chose the ink that actually wins — void or light, whichever reads better', () => {
        for (const [id, tokens] of Object.entries(CHAMBER_ACCENT_TOKENS)) {
            const accent = tokens['--color-accent'];
            const better = contrast('#0A0A0C', accent) >= contrast('#E8E8EC', accent) ? '#0A0A0C' : '#E8E8EC';
            expect(tokens['--color-on-accent'], `${id} takes the higher-contrast ink`).toBe(better);
        }
    });

    it('the filled primary button inks with --color-on-accent, not glow', () => {
        // .btn-primary fills with --color-threshold (the sitting). White
        // (--color-glow) on ivory cream is about 1.4:1. --color-on-accent
        // exists for exactly this pairing.
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'design-system.css'), 'utf8');
        const filled = [...css.matchAll(/\.btn-primary\s*\{[^}]+\}/g)]
            .map(match => match[0])
            .find(block => /background:\s*var\(--color-threshold\)/.test(block));
        expect(filled, 'the threshold-filled .btn-primary block').toBeTruthy();
        expect(filled).toMatch(/color:\s*var\(--color-on-accent\)/);
        expect(filled).not.toMatch(/color:\s*var\(--color-glow\)/);
    });

    it('every sitting clears AA on that filled button', () => {
        // Slate is the bare :root, not a stamped colourway. Its fill is the
        // :root threshold; every other sitting is in CHAMBER_ACCENT_TOKENS.
        const sittings = {
            slate: { '--color-threshold': '#E4D2AE', '--color-on-accent': '#0A0A0C' },
            ...CHAMBER_ACCENT_TOKENS
        };
        for (const [id, tokens] of Object.entries(sittings)) {
            expect(contrast(tokens['--color-on-accent'], tokens['--color-threshold']),
                `${id}: ${tokens['--color-on-accent']} on ${tokens['--color-threshold']}`)
                .toBeGreaterThanOrEqual(4.5);
        }
    });

    it('writes the ink into every design-system block', () => {
        const css = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'design-system.css'), 'utf8');
        for (const [id, tokens] of Object.entries(CHAMBER_ACCENT_TOKENS)) {
            const block = css.match(new RegExp(`:root\\[data-accent="${id}"\\]\\s*\\{([^}]+)\\}`));
            expect(block, id).toBeTruthy();
            expect(block[1]).toContain(`--color-on-accent: ${tokens['--color-on-accent']}`);
        }
        // The bare :root default and the derived washes are declared once.
        expect(css).toMatch(/:root\s*\{[\s\S]*--color-on-accent:\s*#0A0A0C/);
        expect(css).toContain('--accent-wash: rgba(var(--color-accent-rgb)');
    });

    it('the Portal hero bevel travels with the accent, not a frozen purple', () => {
        const portal = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'Portal.css'), 'utf8');
        const hero = portal.match(/\.portal-nav \.nav-primary \.nav-item\s*\{[^}]+\}/);
        expect(hero, '.nav-primary .nav-item').toBeTruthy();
        expect(hero[0]).toMatch(/var\(--color-accent-rgb\)/);
        // No lavender literal survives anywhere in the Portal's chrome.
        expect(portal).not.toMatch(/1(?:39|60|40|20),\s*(?:127|145|125|110),\s*(?:180|200|160)/);
    });
});

describe('the colourway dresses the whole cluster', () => {
  const read = rel => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', rel), 'utf8');

  it('Slate defines neutral button tokens on the bare :root', () => {
    const css = read('design-system.css');
    const root = css.match(/:root\s*\{[\s\S]*?\n\}/)[0];
    // The ground state: a neutral slate surface and the accent only on glow.
    expect(root).toMatch(/--btn-top:\s*rgba\(42, 42, 48/);
    expect(root).toMatch(/--btn-ink:\s*var\(--color-fog\)/);
    expect(root).toMatch(/--hero-top:/);
  });

  it('a chosen sitting derives its button surfaces from the accent, not a literal', () => {
    const css = read('design-system.css');
    const block = css.match(/:root\[data-accent\]\s*\{([^}]+)\}/);
    expect(block, ':root[data-accent]').toBeTruthy();
    // Derived — mixed from --color-accent — so a new sitting themes itself.
    expect(block[1]).toMatch(/--btn-top:\s*color-mix\(in srgb,\s*var\(--color-accent\)/);
    expect(block[1]).toMatch(/--hero-top:\s*color-mix\(in srgb,\s*var\(--color-accent\)/);
    expect(block[1]).toMatch(/--btn-ink:\s*color-mix\(in srgb,\s*var\(--color-light\)/);
  });

  it('every non-slate sitting has its own [data-accent] block', () => {
    const css = read('design-system.css');
    for (const id of Object.keys(CHAMBER_ACCENT_TOKENS)) {
      expect(css, id).toContain(`:root[data-accent="${id}"]`);
    }
  });

  it('the Portal buttons read from the surface tokens, not frozen slate', () => {
    const portal = read('components/Portal.css');
    const tile = portal.match(/\.portal-nav \.nav-item\s*\{[^}]+\}/)[0];
    expect(tile).toMatch(/background:\s*\n?\s*linear-gradient\(180deg,\s*\n?\s*var\(--btn-top\)/);
    expect(tile).toMatch(/color:\s*var\(--btn-ink\)/);
    // The old frozen slate gradient is gone from the tile.
    expect(tile).not.toMatch(/rgba\(42, 42, 48/);
  });

  it('the actual Try RISE seal carries the sitting accent and a legible ink', () => {
    // The seal is LIT BY the accent, not filled with it. It was a solid
    // --color-accent disc, which is why its ink was --color-on-accent: the
    // dark ink that token exists to guarantee against a light accent fill.
    // The seal's body is now slate and the accent enters as rim, glow, and
    // gradient — so that same dark ink would sink into it, and the ink is
    // light instead. The invariant the old spelling protected is unchanged
    // and still asserted here: the circle tracks the sitting, and its ink is
    // legible on it.
    //
    // Legibility is no longer INFERRED from a token name. The seal renders
    // in all ten sittings in e2e/portal-hit-test.spec.js, where the real
    // composited contrast is measured against the lightest pixel under the
    // label (worst case 5.91:1; AA is 4.5). That is a measurement, where
    // this can only ever be a spelling check.
    const portal = read('components/Portal.css');
    const circle = portal.match(/\.portal-nav \.nav-secondary \.nav-try\s*\{[^}]+\}/)[0];
    // Lit by the sitting: illumination, rim, and halo all read the accent.
    expect(circle).toMatch(/background:[^;]*rgba\(var\(--color-accent-rgb\)/s);
    expect(circle).toMatch(/border:[^;]*rgba\(var\(--color-accent-rgb\)/s);
    expect(circle).toMatch(/box-shadow:[^;]*rgba\(var\(--color-accent-rgb\)/s);
    // Light ink, over a body that really is slate-dominant.
    expect(circle).toMatch(/color:\s*var\(--color-light\)/);
    expect(circle).toMatch(/linear-gradient\([^;]*rgba\(20, 25, 30/s);
    // The mark still carries the sitting rather than a frozen colour.
    expect(portal).toMatch(/\.nav-try \.try-mark\s*\{[^}]*var\(--color-accent\)/s);
    expect(portal).not.toMatch(/\.nav-try\s*\{[^}]*rgba\(48, 48, 56/s);
  });

  it('the new sittings clear WCAG AA for their chosen ink', () => {
    const chan = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * chan(n >> 16 & 255) + 0.7152 * chan(n >> 8 & 255) + 0.0722 * chan(n & 255); };
    const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    for (const id of ['garnet', 'teal', 'orchid']) {
      const t = CHAMBER_ACCENT_TOKENS[id];
      expect(contrast(t['--color-on-accent'], t['--color-accent']), id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
