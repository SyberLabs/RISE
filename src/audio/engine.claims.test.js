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
import { BRAINWAVE_BANDS } from './engine.js';

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
        for (const [name, entry] of Object.entries(BRAINWAVE_BANDS)) {
            expect(Object.keys(entry).sort(), `BRAINWAVE_BANDS.${name}`)
                .toEqual(['default', 'max', 'min']);
        }
    });

    it('keeps every frequency a reader could already choose', () => {
        // Deleting the claim must not delete the option.
        expect(BRAINWAVE_BANDS.delta.min).toBe(0.5);
        expect(BRAINWAVE_BANDS.gamma.max).toBe(100);
    });
});
