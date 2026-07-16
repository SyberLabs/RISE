import { describe, expect, it, vi } from 'vitest';
import { MuseumProvider } from './museum.js';
import { WikimediaProvider } from './wikimedia.js';

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

        const results = [];
        for (let index = 0; index < 3; index++) {
            results.push(await provider.getRandom({ category: 'geometry' }));
        }

        expect(new Set(results.map(result => result.id)).size).toBe(3);
        expect(results.every(result => result.metadata.categoryId === 'geometry')).toBe(true);
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
