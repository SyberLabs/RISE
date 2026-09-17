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

describe('the category that dresses a word, rather than filling a wall', () => {
    /**
     * A GALLERY SURVIVES DEAD PINS. A STENCIL DOES NOT.
     *
     * The withdrawal above kept every category that still had Cleveland
     * or Rijksmuseum pins, because a wall with fewer pictures is still a
     * wall — `resolveCollection` degrades a miss to an omission and the
     * reader sees the survivors.
     *
     * Knights is not a wall. It carries the Fit mask for the Meditations
     * keystone, where the imagery is cut into the letters of one word at
     * a time, and a work that will not resolve is not a thinner gallery
     * but a word that cannot be dressed — so the reader gets the plain
     * fallback instead, for as long as the failure takes to arrive.
     *
     * Measured in Chromium against the live API: all 50 Art Institute
     * works pinned here resolved their metadata and 0 of 50 images
     * loaded, and a cross-category sample of 35 more scored 0 of 35.
     */
    it('pins nothing to Knights that cannot reach a browser', () => {
        const aic = (MUSEUM_CATEGORY_PINS.knights || [])
            .filter(pin => pin?.source === 'aic');
        expect(aic, 'an Art Institute work cannot dress a word').toEqual([]);
    });

    it('still has enough left to dress every word of a reading', () => {
        // Removing half a category is only right if what remains is a
        // collection rather than a handful.
        expect(MUSEUM_CATEGORY_PINS.knights.length).toBeGreaterThan(50);
        expect(MUSEUM_CATEGORY_PINS.knights.every(pin => pin?.source === 'rijks')).toBe(true);
    });
});
