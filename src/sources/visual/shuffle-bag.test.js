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

    // Non-blocking pin enrichment appends late-resolving works to a
    // live pool. Growth must merge into the current cycle, not reset it.
    describe('mid-cycle pool growth', () => {
        it('does not re-show already-drawn works when the pool grows', () => {
            const bag = new ShuffleBag(Math.random);
            const initial = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

            const shown = new Set();
            shown.add(bag.draw('cat', initial).id);
            shown.add(bag.draw('cat', initial).id);

            // pool grows mid-cycle (a pin batch lands)
            const grown = [...initial, { id: 'e' }, { id: 'f' }];
            const rest = Array.from({ length: 4 }, () => bag.draw('cat', grown).id);

            // the remaining 4 draws complete the cycle: exactly the
            // works not yet shown, no repeats of the drawn history
            expect(new Set(rest).size).toBe(4);
            for (const id of rest) expect(shown.has(id)).toBe(false);
            expect(new Set([...shown, ...rest]))
                .toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f']));
        });

        it('completes one full cycle across repeated growth (chunked batches)', () => {
            const bag = new ShuffleBag(Math.random);
            let pool = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}` }));
            const drawn = [];
            // simulate 4 batches landing between draws
            for (let batch = 0; batch < 4; batch++) {
                drawn.push(bag.draw('cat', pool).id);
                pool = [...pool, { id: `p${batch}0` }, { id: `p${batch}1` }];
            }
            // finish the deck
            const total = 5 + 8;
            while (drawn.length < total) drawn.push(bag.draw('cat', pool).id);

            // every work exactly once — the cycle survived all growth
            expect(drawn.length).toBe(total);
            expect(new Set(drawn).size).toBe(total);
        });

        it('still resets when the pool changes other than by growth', () => {
            const bag = new ShuffleBag(Math.random);
            const first = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            const seen = bag.draw('cat', first).id;

            // replacement, not growth: 'a' is gone
            const swapped = [{ id: 'b' }, { id: 'c' }, { id: 'x' }, { id: 'y' }];
            const draws = Array.from({ length: 4 }, () => bag.draw('cat', swapped).id);

            // a fresh deck over the new pool: all four works appear,
            // even one matching the previously drawn id is fair game
            expect(new Set(draws)).toEqual(new Set(['b', 'c', 'x', 'y']));
            expect(typeof seen).toBe('string');
        });
    });
});
