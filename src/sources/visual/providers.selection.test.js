import { describe, expect, it, vi } from 'vitest';
import { MuseumProvider } from './museum.js';
import { WikimediaProvider, registerWikimediaCategoryResolver } from './wikimedia.js';

describe('visual provider candidate selection', () => {
    it('draws Art Institute candidates without replacement', async () => {
        const provider = new MuseumProvider();
        vi.spyOn(provider, 'getImagesInCategory').mockResolvedValue([
            { id: '1', title: 'One', url: 'one.jpg' },
            { id: '2', title: 'Two', url: 'two.jpg' },
            { id: '3', title: 'Three', url: 'three.jpg' }
        ]);

        const results = [];
        for (let index = 0; index < 3; index++) {
            results.push(await provider.getRandom({ category: 'oldmasters' }));
        }

        expect(new Set(results.map(result => result.id)).size).toBe(3);
    });

    it('draws Wikimedia candidates without replacement while retaining category identity', async () => {
        const provider = new WikimediaProvider();
        vi.spyOn(provider, 'getImagesInCategory').mockResolvedValue([
            { title: 'File:One.jpg' },
            { title: 'File:Two.jpg' },
            { title: 'File:Three.jpg' }
        ]);
        vi.spyOn(provider, 'getImageInfo').mockImplementation(async title => ({
            title,
            url: `${title}.thumb.jpg`,
            width: 1200,
            height: 900,
            license: 'Public domain'
        }));

        // The searched WIKIMEDIA_CATEGORIES are retired, but the provider
        // itself lives on to serve categories that CONTENT registers
        // (registerWikimediaCategoryResolver). Register a test-local one
        // rather than importing an Atrium module: the dependency arrow
        // runs content → source, never source → content, and a test in
        // the sources tree must not invert it.
        const CATEGORY = 'test-registered-category';
        registerWikimediaCategoryResolver(id => id === CATEGORY
            ? { name: 'Test', category: 'Category:Test', tags: [] }
            : null);
        const results = [];
        for (let index = 0; index < 3; index++) {
            results.push(await provider.getRandom({ category: CATEGORY }));
        }

        expect(new Set(results.map(result => result.id)).size).toBe(3);
        expect(results.every(result => result.metadata.categoryId === CATEGORY)).toBe(true);
    });

    it('rejects clearly undersized rasters without penalizing scalable vectors', () => {
        const provider = new WikimediaProvider();

        expect(provider._isDisplayQuality({
            width: 300, height: 300, mime: 'image/jpeg'
        })).toBe(false);
        expect(provider._isDisplayQuality({
            width: 300, height: 300, mime: 'image/svg+xml'
        })).toBe(true);
    });
});
