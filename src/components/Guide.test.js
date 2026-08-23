/**
 * The Guide is documentation that ships. It told readers about the Vault and
 * SOL as "two faster doors", and about sealing a reflection in the Synthesis
 * stage — a room and a stage that were both deleted. Nothing failed when they
 * went, because no test read this file, so the copy outlived its subject and
 * described the product to a stranger in terms the product no longer had.
 *
 * What is asserted here is the correspondence itself: every room the Guide
 * names must be a room the reader can reach. A door removed in Portal.js and
 * left standing here should fail out loud.
 */
import { describe, it, expect } from 'vitest';
import { Guide } from './Guide.js';

function render() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const guide = new Guide(container);
    const text = container.textContent;
    guide.destroy();
    container.remove();
    return text;
}

describe('Guide', () => {
    it('names no room that was deleted', () => {
        const text = render();
        // SOL and its solar dial went with the Solarium; the Synthesis stage
        // and the Reflections shelf went with it. Named rather than inferred:
        // the next room to go will do this again.
        for (const gone of ['SOL', 'Solarium', 'Synthesis', 'Reflections', 'Atrium']) {
            expect(text, `the Guide still describes ${gone}`)
                .not.toMatch(new RegExp(`\\b${gone}\\b`));
        }
    });

    it('names the rooms a reader can actually reach', () => {
        const text = render();
        for (const room of ['Portal', 'Library', 'Workshop', 'Chamber', 'Vault', 'Chapel']) {
            expect(text, `the Guide never mentions the ${room}`).toContain(room);
        }
    });

    it('links only to pages that ship', async () => {
        const { readFileSync } = await import('node:fs');
        const container = document.createElement('div');
        document.body.appendChild(container);
        const guide = new Guide(container);

        for (const anchor of container.querySelectorAll('a[href^="/"]')) {
            const href = anchor.getAttribute('href');
            expect(() => readFileSync(`public${href}`),
                `the Guide links to ${href}, which does not ship`).not.toThrow();
        }

        guide.destroy();
        container.remove();
    });
});
