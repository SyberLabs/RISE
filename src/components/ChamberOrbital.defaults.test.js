/**
 * The defaults a reader meets, asserted.
 *
 * These are the values for someone who has expressed no preference, which
 * makes them the most-used configuration in the product and the least
 * likely to be exercised deliberately by a test. `presentation` moved from
 * 'full-frame' to 'continuous' with nothing in the unit suite to notice;
 * the failure surfaced as a browser test that had left the field unset,
 * inherited the change, and started asking a question it never meant to.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './ChamberOrbital.js';

describe('the configuration a reader meets having chosen nothing', () => {
    it('presents in Gallery', () => {
        // THE ONLY SURFACE THAT NEVER FLASHES AND NEVER GOES BLACK, which
        // is why it is what an unexpressed preference resolves to. Domains
        // that author their own surface still win — the Chapel asks for
        // behind-stream — and that is a different rule from this one.
        expect(createDefaultConfig().visualInterlocution.interlocution.presentation)
            .toBe('continuous');
    });

    it('renders in the native language, ASCII having been retired', () => {
        expect(createDefaultConfig().visualInterlocution.interlocution.renderLanguage)
            .toBe('native');
    });

    it('hands back a fresh object each time', () => {
        // The constructor and the Reset button both call this. A shared
        // object would let one session's edits become the next session's
        // defaults.
        const a = createDefaultConfig();
        const b = createDefaultConfig();
        expect(a).not.toBe(b);
        expect(a.visualInterlocution).not.toBe(b.visualInterlocution);
        a.visualInterlocution.interlocution.presentation = 'full-frame';
        expect(createDefaultConfig().visualInterlocution.interlocution.presentation)
            .toBe('continuous');
    });
});
