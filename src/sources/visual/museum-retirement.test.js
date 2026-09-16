import { describe, expect, it } from 'vitest';
import { MUSEUM_CATEGORIES } from './museum.js';
import { MUSEUM_CATEGORY_PINS } from './museum-pins.js';

/**
 * The Art Institute put Cloudflare bot mitigation in front of its IIIF
 * endpoint: image requests answer 403 with `Cf-Mitigated: challenge`
 * and a challenge page carrying `Cross-Origin-Resource-Policy:
 * same-origin`. An <img> cannot solve a JavaScript challenge, so every
 * Art Institute picture is unreachable — 621 of 1340 pins.
 *
 * Most categories survive on their Cleveland and Rijksmuseum pins.
 * Ukiyo-e was entirely theirs, so it is withdrawn rather than offered
 * empty.
 */
describe('a category whose pictures stopped arriving', () => {
    it('no longer offers Ukiyo-e', () => {
        expect(MUSEUM_CATEGORIES.ukiyoe).toBeUndefined();
    });

    it('keeps its pins, so restoring it is deleting a line', () => {
        // The curation was sound; only the delivery failed.
        expect(MUSEUM_CATEGORY_PINS.ukiyoe?.length).toBeGreaterThan(50);
    });

    it('leaves every offered category with pictures that can still arrive', () => {
        // The point of the withdrawal. A category that is offered must
        // have at least one pin from a source that still serves.
        const dead = [];
        for (const id of Object.keys(MUSEUM_CATEGORIES)) {
            const pins = MUSEUM_CATEGORY_PINS[id] || [];
            if (!pins.length) continue;               // corpus-backed, not pinned
            if (!pins.some(p => p.source !== 'aic')) dead.push(id);
        }
        expect(dead, 'offered but reachable only through the Art Institute').toEqual([]);
    });
});
