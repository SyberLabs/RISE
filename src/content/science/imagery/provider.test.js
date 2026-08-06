import { describe, expect, it } from 'vitest';
import {
    ScienceCatalogProvider,
    bareCategory,
    hasScienceCollection
} from './provider.js';
import { SCIENCE_CATEGORIES } from './science-pins.js';
import {
    artworkMayBeShown,
    displayedArtworkLabel,
    normalizeArtworkLabel
} from '../../../visuals/artwork-label.js';

describe('science catalog provider', () => {
    it('claims only the collections it has', () => {
        expect(hasScienceCollection('sci-astronomy')).toBe(true);
        expect(hasScienceCollection('astronomy')).toBe(true);
        expect(hasScienceCollection('sci-wildlife')).toBe(false);
        expect(hasScienceCollection('aic-oldmasters')).toBe(false);
        expect(hasScienceCollection('')).toBe(false);
        expect(bareCategory('sci-astronomy')).toBe('astronomy');
    });

    it('serves the pinned astronomy collection', async () => {
        const provider = new ScienceCatalogProvider();
        const images = await provider.getImagesInCategory('sci-astronomy');
        expect(images.length).toBeGreaterThan(100);
        for (const image of images) {
            expect(image.url).toMatch(/^https:\/\//);
            expect(image.title).toBeTruthy();
            expect(image.sourceUrl).toMatch(/^https:\/\//);
        }
    });

    it('returns nothing for a category it does not have', async () => {
        const provider = new ScienceCatalogProvider();
        expect(await provider.getImagesInCategory('sci-wildlife')).toEqual([]);
        expect(await provider.getImagesInCategory('aic-oldmasters')).toEqual([]);
    });

    // THE CONTRACT THE CORTEX ACTUALLY CALLS. Without getRandom a
    // collection resolves to the right provider and fails on the next
    // line, and the hydration guard swallows it — which is precisely how
    // a pinned collection silently never enters the pool.
    it('exposes getRandom, and its item carries the credit', async () => {
        const provider = new ScienceCatalogProvider();
        const item = await provider.getRandom({ category: 'sci-astronomy' });
        expect(item).toBeTruthy();
        expect(item.type).toBe('image');
        expect(item.data.url).toMatch(/^https:\/\//);
        expect(item.metadata.attribution).toBeTruthy();
        expect(item.metadata.creditRequired).toBe(true);
    });

    it('does not repeat a work before the collection is exhausted', async () => {
        const provider = new ScienceCatalogProvider();
        const seen = new Set();
        for (let i = 0; i < 40; i++) {
            const item = await provider.getRandom({ category: 'sci-astronomy' });
            seen.add(item.id);
        }
        expect(seen.size).toBe(40);
    });
});

describe('every science work reaches the reader with its credit', () => {
    // THE END-TO-END PROOF, and the reason the whole rights apparatus was
    // built. `artworkMayBeShown` withholds a credit-required work that
    // cannot be credited, so if a catalog record lost its attribution
    // somewhere between harvest and provider, these works would vanish
    // from the Chamber rather than appear uncredited — a silent failure
    // that would look exactly like an empty collection.
    it('composes a displayable credit for all of them', async () => {
        const provider = new ScienceCatalogProvider();
        const images = await provider.getImagesInCategory('sci-astronomy');

        const bare = [];
        const withheld = [];
        for (const image of images) {
            const label = normalizeArtworkLabel({
                name: image.title,
                metadata: {
                    artist: image.artist,
                    license: image.license,
                    attribution: image.attribution,
                    creditRequired: image.creditRequired,
                    sourceName: image.sourceName,
                    sourceUrl: image.sourceUrl
                }
            });
            if (!artworkMayBeShown(label)) withheld.push(image.id);
            // `false` = the reader turned optional labels OFF. A required
            // credit must still show; that is the setting's whole promise.
            if (!displayedArtworkLabel(label, false)) bare.push(image.id);
        }

        expect(withheld).toEqual([]);
        expect(bare).toEqual([]);
    });

    it('names both the creator and the licence, and says neither twice', async () => {
        const provider = new ScienceCatalogProvider();
        const images = await provider.getImagesInCategory('sci-astronomy');

        const hubble = images.find(i => i.id.startsWith('esahubble:'));
        const nasa = images.find(i => i.id.startsWith('nasa:'));

        expect(hubble.attribution).toMatch(/CC BY 4\.0$/);
        expect(hubble.attribution).not.toMatch(/Creative Commons Attribution 4\.0 International/);
        // The licence appears once, not appended to a string that already
        // named it — the stutter the composition rule exists to prevent.
        expect(hubble.attribution.match(/CC BY/g)).toHaveLength(1);

        // NASA is public domain AND asks to be acknowledged; calling it
        // CC-BY would be false and calling it open would drop the ask.
        expect(nasa.attribution).toMatch(/^NASA/);
        expect(nasa.attribution).toMatch(/acknowledgement required/);
    });

    it('holds every credit to a length a chip can carry', async () => {
        const provider = new ScienceCatalogProvider();
        const images = await provider.getImagesInCategory('sci-astronomy');
        const longest = Math.max(...images.map(i => i.attribution.length));
        // One credit ran 723 characters before the roster ruling. There is
        // no truncation of a marker-less name list by design, so this is a
        // ceiling on what the DATA turned out to need, not a rule — if a
        // future harvest breaks it, that is worth looking at rather than
        // silently trimming.
        expect(longest).toBeLessThan(250);
    });

    it('every pinned id belongs to a declared category', async () => {
        const provider = new ScienceCatalogProvider();
        for (const id of Object.keys(SCIENCE_CATEGORIES)) {
            expect((await provider.getImagesInCategory(`sci-${id}`)).length)
                .toBeGreaterThan(0);
        }
    });
});
