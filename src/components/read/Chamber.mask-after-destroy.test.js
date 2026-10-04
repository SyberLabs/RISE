/**
 * A timer must not reach a Chamber that has been torn down.
 *
 * `destroy()` sets `fitMask` to null, and the reading's opening sequence
 * calls `applyChamberMask()` from a `setTimeout`. If a reader leaves
 * before that timer fires, the callback found a null and threw a
 * TypeError with no one to catch it — in a browser an uncaught error on
 * the way out of a reading, and in CI an uncaught exception that failed
 * the run with every test passing.
 *
 * Four of the seven `fitMask` call sites already used `?.` for exactly
 * this reason. These are the three that did not.
 */
import { describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

function makeChamber() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return new Chamber(container, {
        session: {
            title: 'Mask after destroy',
            atoms: [{ content: 'Word', duration: 500 }],
            totalDuration: 500,
            atomCount: 1,
            visualConfig: { visualMode: 'off' }
        },
        player: null,
        autoStart: false,
        getSettings: () => ({})
    });
}

describe('the glyph mask after the Chamber is gone', () => {
    it('holds a fitMask while the Chamber is alive and drops it on destroy', () => {
        const chamber = makeChamber();
        expect(chamber.fitMask).toBeTruthy();
        chamber.destroy();
        expect(chamber.fitMask).toBeNull();
    });

    it('lets a late timer apply the mask without throwing', () => {
        const chamber = makeChamber();
        chamber.destroy();
        // This is the call the opening sequence makes from a setTimeout.
        expect(() => chamber.applyChamberMask()).not.toThrow();
    });

    it('lets the other deferred mask work land late too', () => {
        const chamber = makeChamber();
        chamber.destroy();
        expect(() => chamber.syncMaskGroundPlate()).not.toThrow();
        expect(() => chamber.syncFillGlyphMask()).not.toThrow();
        expect(chamber.syncFillGlyphMask()).toBeUndefined();
    });
});
