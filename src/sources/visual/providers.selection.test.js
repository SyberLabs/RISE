import { describe, expect, it, vi } from 'vitest';
import { MuseumProvider } from './museum.js';

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
});
