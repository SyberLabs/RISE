import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Vault } from './Vault.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vault paints Library room chrome (.library, .library-nav, button.nav-item).
 * The native-button reset for those tabs lives in Library.css. If Vault
 * does not load that sheet, Windows paints the tabs as gray rectangles.
 */
describe('Vault room chrome', () => {
    it('loads the Library stylesheet its tabs already use', () => {
        const src = readFileSync(join(here, 'Vault.js'), 'utf8');
        expect(src).toMatch(/import\s+['"]\.\/Library\.css['"]/);
    });

    it('keeps the Library tab reset that strips native button chrome', () => {
        const css = readFileSync(join(here, 'Library.css'), 'utf8');
        const rule = css.match(/\.library-nav\s+\.nav-item\s*\{[^}]+\}/);
        expect(rule, '.library-nav .nav-item').toBeTruthy();
        expect(rule[0]).toMatch(/background:\s*transparent/);
        expect(rule[0]).toMatch(/border:\s*none/);
    });

    it('keeps Journeys off the Vault screen', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const vault = new Vault(container);

        expect(container.querySelector('[data-nav="journeys"]')).toBeNull();
        expect(container.querySelector('.vault-journeys-door')).toBeNull();
        expect(container.querySelector('.vault-journeys-note')).toBeNull();
        expect(container.textContent).not.toMatch(/Will return after 1\.0/);

        vault.destroy?.();
        container.remove();
    });
});
