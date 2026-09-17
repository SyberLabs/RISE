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

    it('no longer keeps pins that cannot become pictures', () => {
        // THIS USED TO SAY THE OPPOSITE, and it was right at the time:
        // the pins were kept so that restoring the category would be
        // deleting one line. Measuring them ended that argument — all 100
        // were the Art Institute's and all 100 are blocked, so the line
        // would have restored a category with nothing in it.
        //
        // The curation was sound and it is in the history. Bringing
        // Ukiyo-e back now means re-pinning it from a museum that serves.
        expect(MUSEUM_CATEGORY_PINS.ukiyoe).toBeUndefined();
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

    it('keeps no Art Institute pin anywhere, in any category', () => {
        // The stronger statement, and the one worth holding: not "every
        // category has something else too" but "nothing here points at a
        // host that refuses us". Measured in Chromium over all 460 unique
        // ids that were pinned — every one resolved its metadata through
        // api.artic.edu and 0 of 460 images loaded.
        //
        // A dead pin is not free. resolveCollection degrades a miss to an
        // omission, so it costs a request, a wait, and one fewer picture
        // than the curation promised, every session, forever.
        const strays = [];
        for (const [id, pins] of Object.entries(MUSEUM_CATEGORY_PINS)) {
            for (const pin of pins) {
                if (pin?.source === 'aic') strays.push(`${id}:${pin.id}`);
            }
        }
        expect(strays, 'www.artic.edu/iiif refuses a cross-origin image').toEqual([]);
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
