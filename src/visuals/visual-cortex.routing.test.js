import { describe, expect, it } from 'vitest';
import { VisualCortex } from './visual-cortex.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { SCIENCE_CATEGORIES } from '../content/science/imagery/science-pins.js';

/**
 * EVERY CHECKBOX MUST REACH A PROVIDER THAT CAN SERVE IT.
 *
 * This is the silent-black-chamber class, and it has now bitten twice.
 * The retired `microscopy` category returned nothing for its entire life
 * because the Commons category never existed. And `aic-ukiyoe` went black
 * because it is the only category with no institution but the AIC to fall
 * back on, so when the AIC refused, nothing remained.
 *
 * The shared shape of both: a reader ticks a box, the cortex resolves it
 * to a provider or to null, and a null resolves to an empty pool that
 * looks exactly like a slow one. Nothing in the running app distinguishes
 * "this category has no provider" from "the images have not arrived yet".
 *
 * So the panel's own vocabulary is walked here, not a hand-written list —
 * a list would have to learn each new category, and this must fail when
 * somebody adds one the cortex cannot route.
 */
const panelIssuedIds = () => [
    ...Object.keys(MUSEUM_CATEGORIES).map(id => `aic-${id}`),
    ...Object.keys(SCIENCE_CATEGORIES).map(id => `sci-${id}`)
];

describe('every panel category routes to a provider', () => {
    it('resolves each id the panel can emit', async () => {
        const cortex = new VisualCortex();
        const unrouted = [];
        const unusable = [];

        for (const id of panelIssuedIds()) {
            const provider = await cortex._getProviderForCategory(id);
            if (!provider) { unrouted.push(id); continue; }
            // A provider without getRandom resolves correctly and then
            // fails on the very next line, and the hydration guard
            // swallows it — indistinguishable from an empty collection.
            if (typeof provider.getRandom !== 'function') unusable.push(id);
        }

        expect(unrouted).toEqual([]);
        expect(unusable).toEqual([]);
    });

    it('sends museum ids to the museum provider and science ids to the catalog', async () => {
        const cortex = new VisualCortex();
        const museum = await cortex._getProviderForCategory('aic-oldmasters');
        const science = await cortex._getProviderForCategory('sci-astronomy');

        expect(museum).toBeTruthy();
        expect(science).toBeTruthy();
        // Two different providers — a science id falling through to the
        // museum branch would query the AIC for a nebula and quietly
        // return nothing.
        expect(science).not.toBe(museum);
        expect(science.id).toBe('science-catalog');
    });

    it('refuses an unknown science id rather than falling through to Wikimedia', async () => {
        // `sci-` claims the namespace. An id inside it that no collection
        // defines must resolve to null — falling through to the Wikimedia
        // default would search Commons for "sci-wildlife" and return
        // whatever a keyword found, which is the retired behaviour
        // curation-only exists to prevent.
        const cortex = new VisualCortex();
        expect(await cortex._getProviderForCategory('sci-wildlife')).toBeNull();
    });

    it('still refuses retired Met ids', async () => {
        const cortex = new VisualCortex();
        expect(await cortex._getProviderForCategory('met-anything')).toBeNull();
    });
});

describe('the science catalog serves what the panel offers', () => {
    it('has works behind every declared science category', async () => {
        const cortex = new VisualCortex();
        for (const id of Object.keys(SCIENCE_CATEGORIES)) {
            const provider = await cortex._getProviderForCategory(`sci-${id}`);
            const images = await provider.getImagesInCategory(`sci-${id}`);
            expect(images.length, `sci-${id} is an empty shelf`).toBeGreaterThan(0);
            // The cortex needs a URL and the chip needs a credit; a work
            // missing either is a frame the reader will not see.
            for (const image of images) {
                expect(image.url, `${image.id} has no url`).toBeTruthy();
                expect(image.attribution, `${image.id} has no credit`).toBeTruthy();
            }
        }
    });
});
