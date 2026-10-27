import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('the Landscapes and Earth and sky collections', () => {
    afterEach(() => vi.restoreAllMocks());

    it('are claimed and served from their own catalog', async () => {
        const provider = new ScienceCatalogProvider();
        expect(hasScienceCollection('sci-landscapes')).toBe(true);
        expect(hasScienceCollection('sci-earth-and-sky')).toBe(true);
        expect(await provider.getImagesInCategory('sci-landscapes')).toHaveLength(68);
        expect(await provider.getImagesInCategory('sci-earth-and-sky')).toHaveLength(65);
    });

    it('open on one of the owner’s favourites, then shuffle the whole collection', async () => {
        const provider = new ScienceCatalogProvider();
        for (const roll of [0, 0.99]) {
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            const opening = await provider.getRandom({ category: 'sci-landscapes', opening: true });
            expect(['cleveland:144967', 'cleveland:84371']).toContain(opening.id);
            vi.restoreAllMocks();
        }
        expect((await provider.getRandom({ category: 'sci-earth-and-sky', opening: true })).id)
            .toBe('nasa:GSFC_20171208_Archive_e002131');

        const seen = new Set();
        for (let i = 0; i < 68; i++) seen.add((await provider.getRandom({ category: 'sci-landscapes' })).id);
        expect(seen.size).toBe(68);
    });

    it('list the favourites first, so a cue’s prepared first work is one of them', async () => {
        const provider = new ScienceCatalogProvider();
        const [first] = await provider.getImagesInCategory('sci-landscapes', 1);
        expect(['cleveland:144967', 'cleveland:84371']).toContain(first.id);
        expect((await provider.getImagesInCategory('sci-earth-and-sky', 1))[0].id).toBe('nasa:GSFC_20171208_Archive_e002131');
        const all = await provider.getImagesInCategory('sci-landscapes');
        expect(all.slice(0, 2).every(image => image.favourite)).toBe(true);
        expect(all.slice(2).some(image => image.favourite)).toBe(false);
    });

    it('open as usual where a collection has no favourite', async () => {
        const provider = new ScienceCatalogProvider();
        const opening = await provider.getRandom({ category: 'sci-astronomy', opening: true });
        expect(opening.data.favourite).toBe(false);
    });

    it('carry a credit for every work that owes one, and title and maker for the open ones', async () => {
        const provider = new ScienceCatalogProvider();
        for (const category of ['sci-landscapes', 'sci-earth-and-sky']) {
            for (const image of await provider.getImagesInCategory(category)) {
                const label = normalizeArtworkLabel({ name: image.title, metadata: {
                    artist: image.artist, license: image.license, attribution: image.attribution,
                    creditRequired: image.creditRequired, sourceName: image.sourceName, sourceUrl: image.sourceUrl
                } });
                expect(artworkMayBeShown(label), image.id).toBe(true);
                if (image.creditRequired) expect(displayedArtworkLabel(label, false), image.id).toBe(image.attribution);
                else expect(displayedArtworkLabel(label, true), image.id).toBe([image.title, image.artist].filter(Boolean).join(' · '));
            }
        }
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
