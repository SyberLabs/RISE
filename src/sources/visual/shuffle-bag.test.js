import { describe, expect, it } from 'vitest';
import { ShuffleBag } from './shuffle-bag.js';

describe('ShuffleBag', () => {
    it('draws every unique candidate before repeating one', () => {
        const bag = new ShuffleBag(() => 0.25);
        const candidates = [
            { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'a' }
        ];

        const cycle = Array.from({ length: 4 }, () => bag.draw('collection', candidates).id);
        expect(new Set(cycle)).toEqual(new Set(['a', 'b', 'c', 'd']));
    });

    it('does not repeat at a cycle boundary when alternatives exist', () => {
        const bag = new ShuffleBag(() => 0);
        const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const draws = Array.from({ length: 4 }, () => bag.draw('collection', candidates).id);

        expect(draws[3]).not.toBe(draws[2]);
    });

    it('keeps category decks independent', () => {
        const bag = new ShuffleBag(() => 0.5);
        const candidates = [{ id: 'a' }, { id: 'b' }];

        const firstA = bag.draw('a', candidates).id;
        const firstB = bag.draw('b', candidates).id;
        expect(firstB).toBe(firstA);
    });
});
