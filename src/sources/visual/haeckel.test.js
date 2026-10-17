/**
 * Haeckel's Kunstformen der Natur: one pinned public-domain plate per
 * Tafel, 1 to 100, from the Commons files the build script resolved.
 */
import { describe, expect, it } from 'vitest';
import catalog from './haeckel-catalog.generated.json';

describe('the Haeckel plate catalog', () => {
    it('holds the hundred plates once each, in order', () => {
        expect(catalog.plates.map(plate => plate.plate))
            .toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
        expect(new Set(catalog.plates.map(plate => plate.file)).size).toBe(100);
    });

    it('serves every plate from upload.wikimedia.org, public domain, with its credit', () => {
        for (const plate of catalog.plates) {
            for (const url of [plate.image, plate.original]) {
                expect(new URL(url).hostname, `${plate.plate} ${url}`).toBe('upload.wikimedia.org');
                expect(new URL(url).protocol).toBe('https:');
            }
            expect(plate.licence, `${plate.plate}`).toBe('Public domain');
            expect(plate.pdOld, `${plate.plate}`).toBe(true);
            expect(plate.sha1).toMatch(/^[0-9a-f]{40}$/u);
            expect(plate.width).toBeGreaterThan(0);
            expect(plate.height).toBeGreaterThan(0);
            expect(plate.title).toMatch(/^[A-Z][a-z]+$/u);
            expect(plate.attribution).toBe(
                `Ernst Haeckel, Kunstformen der Natur, 1904, Tafel ${plate.plate}; public domain; Wikimedia Commons, ${plate.file}`
            );
        }
    });
});

describe('the Haeckel plates provider', () => {
    it('claims the whole book, and each plate as the book followed by its number, under its namespace', async () => {
        const { hasHaeckelCollection, HAECKEL_PLATES } = await import('./haeckel.js');
        expect(HAECKEL_PLATES).toBe('haeckel:plates');
        expect(hasHaeckelCollection('haeckel:plates')).toBe(true);
        expect(hasHaeckelCollection('haeckel:plates/1')).toBe(true);
        expect(hasHaeckelCollection('haeckel:plates/100')).toBe(true);
        expect(hasHaeckelCollection('haeckel:plates/101')).toBe(false);
        expect(hasHaeckelCollection('haeckel:plates/08')).toBe(false);
        // The retired searched category was the bare id; it stays retired.
        expect(hasHaeckelCollection('haeckel')).toBe(false);
        expect(hasHaeckelCollection('sci-astronomy')).toBe(false);
    });

    it('serves the hundred plates in plate order, titled and credited', async () => {
        const { HaeckelPlatesProvider } = await import('./haeckel.js');
        const images = await new HaeckelPlatesProvider().getImagesInCategory('haeckel:plates');
        expect(images).toHaveLength(100);
        expect(images[7]).toMatchObject({
            id: 'haeckel:plates/8',
            title: 'Tafel 8 · Discomedusae',
            artist: 'Ernst Haeckel',
            date: '1904',
            license: 'PUBLIC_DOMAIN',
            sourceName: 'Wikimedia Commons',
            url: catalog.plates[7].image,
            fullUrl: catalog.plates[7].original,
            attribution: catalog.plates[7].attribution,
            sourceUrl: catalog.plates[7].sourceUrl
        });
    });

    it('serves one plate for its own collection, and nothing for an id it does not hold', async () => {
        const { HaeckelPlatesProvider } = await import('./haeckel.js');
        const provider = new HaeckelPlatesProvider();
        const single = await provider.getImagesInCategory('haeckel:plates/42');
        expect(single.map(image => image.title)).toEqual(['Tafel 42 · Ostraciontes']);
        expect(await provider.getImagesInCategory('haeckel:plates/0')).toEqual([]);
        expect(await provider.getImagesInCategory('haeckel')).toEqual([]);
    });

    it('draws through getRandom with the credit the label pathway shows', async () => {
        const { HaeckelPlatesProvider } = await import('./haeckel.js');
        const { artworkMayBeShown, normalizeArtworkLabel } = await import('../../visuals/artwork-label.js');
        const item = await new HaeckelPlatesProvider().getRandom({ category: 'haeckel:plates/3' });
        expect(item).toMatchObject({ id: 'haeckel:plates/3', type: 'image', name: 'Tafel 3 · Ciliata' });
        expect(new URL(item.data.url).hostname).toBe('upload.wikimedia.org');
        expect(item.metadata.attribution).toBe(catalog.plates[2].attribution);
        const label = normalizeArtworkLabel(item);
        expect(artworkMayBeShown(label)).toBe(true);
        expect(label.labelText).toContain('Tafel 3 · Ciliata');
    });
});
