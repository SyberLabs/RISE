import { describe, expect, it } from 'vitest';
import { KEYSTONE_MANIFESTS, keystoneManifest } from './keystones.js';
import { sessionPresentation } from '../core/session-presentation.js';
import { BAND_OFFSET_LIMIT } from '../core/band-offset.js';

/**
 * Measured on a 390x844 phone, in the reading, against the real field.
 *
 * Both were centred, and centred is where the field is doing its work:
 * Metamorphoses' attractor has its luminous core at 46-59% of the
 * height, and Waldmuller's Prater Landscape puts its tree line — the
 * picture's subject — across the middle third. A centred band covers
 * exactly that in both.
 *
 * The values differ because the pictures do. A third up clears the
 * attractor entirely; a quarter up sits inside the painting's sky, which
 * is its quietest register and the easiest ground to read against.
 * Lifting Tintern as far as Metamorphoses would take the band off the
 * top edge of the painting and leave it floating in the dark above,
 * which reads as two pictures rather than one.
 */
const bySlug = slug => keystoneManifest(slug);

describe('where the reading band sits in the phrase demos', () => {
    it.each([
        ['metamorphoses', -0.35],
        ['tintern', -0.25]
    ])('%s carries its measured offset', (slug, expected) => {
        expect(bySlug(slug)?.presentation?.bandOffset).toBe(expected);
    });

    it('lifts the band rather than dropping it', () => {
        // Negative is up: the drag handler adds a downward pointer delta
        // to the fraction, so a band that should be higher is a smaller
        // number. Getting this backwards would put the text under the
        // picture instead of above its subject.
        for (const slug of ['metamorphoses', 'tintern']) {
            const offset = bySlug(slug).presentation.bandOffset;
            expect(offset, slug).toBeLessThan(0);
            expect(offset, slug).toBeGreaterThan(-BAND_OFFSET_LIMIT);
        }
    });

    it('lifts Metamorphoses further than Tintern', () => {
        expect(bySlug('metamorphoses').presentation.bandOffset)
            .toBeLessThan(bySlug('tintern').presentation.bandOffset);
    });

    it('reaches the reading as a claimed presentation key', () => {
        // The manifest declaring it is worth nothing if the lens does not
        // claim it, and nothing else in the app would notice.
        for (const [slug, expected] of [['metamorphoses', -0.35], ['tintern', -0.25]]) {
            const claimed = sessionPresentation({ presentation: bySlug(slug).presentation });
            expect(claimed?.bandOffset, slug).toBe(expected);
        }
    });

    it('leaves every other keystone to the reader', () => {
        // A default is the reader's to set. Only the two phrase demos
        // were measured, so only they state a position.
        const stated = KEYSTONE_MANIFESTS
            .filter(k => k.presentation?.bandOffset != null)
            .map(k => k.slug)
            .sort();
        expect(stated).toEqual(['metamorphoses', 'tintern']);
    });
});
