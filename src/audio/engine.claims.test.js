/**
 * WHAT THE AUDIO ENGINE IS ALLOWED TO CLAIM.
 *
 * This module shipped `528 Hz — 'Transformation, miracles, DNA repair'`
 * in product source for six weeks, and a four-round adversarial review
 * never opened the file. It is the only unmeasured claim in RISE about
 * what the software does to a person's body.
 *
 * The frequencies are optionality and they stay. The effects were never
 * measured, so by the project's own rule — absence over false
 * substitution — they are gone. This test is the guard that keeps them
 * gone, because a comment saying so is exactly the kind of confident
 * prose this repository has already been caught mistaking for evidence.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    BRAINWAVE_BANDS,
    SOLFEGGIO_FREQUENCIES,
    CARRIER_TUNINGS,
    resolveCarrierTuning
} from './engine.js';

const SOURCE = readFileSync(resolve(__dirname, 'engine.js'), 'utf8');

/**
 * Words that assert an effect on a person. Deliberately small and
 * uncontroversial: every one of these appeared in this file, attached
 * to a frequency, with nothing beside it.
 */
const EFFECT_CLAIMS = [
    'DNA', 'healing', 'heal', 'miracle', 'cure', 'therapeutic',
    'liberating guilt', 'awakening intuition', 'spiritual order'
];

describe('a pitch is described by what it is, never by what it does', () => {
    it('states no health or transformation claim anywhere in the module', () => {
        // The prose that defines the rule quotes the claim it removed;
        // measure the code, not the doc comment that explains the ban.
        const code = SOURCE
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        for (const claim of EFFECT_CLAIMS) {
            expect(code.toLowerCase(), `"${claim}" is an unmeasured effect claim`)
                .not.toContain(claim.toLowerCase());
        }
    });

    it('carries no `description` on any frequency table', () => {
        for (const [name, entry] of Object.entries(SOLFEGGIO_FREQUENCIES)) {
            expect(Object.keys(entry), `SOLFEGGIO_FREQUENCIES.${name}`).toEqual(['freq']);
        }
        for (const [name, entry] of Object.entries(BRAINWAVE_BANDS)) {
            expect(Object.keys(entry).sort(), `BRAINWAVE_BANDS.${name}`)
                .toEqual(['default', 'max', 'min']);
        }
    });

    it('keeps every frequency a reader could already choose', () => {
        // Deleting the claim must not delete the option.
        expect(Object.values(SOLFEGGIO_FREQUENCIES).map(e => e.freq))
            .toEqual([396, 417, 528, 639, 741, 852]);
        expect(BRAINWAVE_BANDS.delta.min).toBe(0.5);
        expect(BRAINWAVE_BANDS.gamma.max).toBe(100);
        expect(new Set(Object.values(CARRIER_TUNINGS)))
            .toEqual(new Set([200, 220, 216, 432]));
    });
});

describe('renaming a tuning does not strand a saved session', () => {
    it('resolves the names this module used to ship', () => {
        expect(resolveCarrierTuning('sacred')).toBe('a432');
        expect(resolveCarrierTuning('verdi')).toBe('a432_low');
        expect(CARRIER_TUNINGS[resolveCarrierTuning('sacred')]).toBe(432);
        expect(CARRIER_TUNINGS[resolveCarrierTuning('verdi')]).toBe(216);
    });

    it('passes current names through and falls back rather than throwing', () => {
        expect(resolveCarrierTuning('a432')).toBe('a432');
        expect(resolveCarrierTuning('standard')).toBe('standard');
        expect(CARRIER_TUNINGS[resolveCarrierTuning('nonsense')]).toBe(432);
    });
});
