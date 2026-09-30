/**
 * rise.affect-brief.v1
 *
 * The brief is what a person hands to their own model. It is not a program.
 * Phrase proposals come from the window encoder. A passage-level score is
 * attached only when the whole text matches, and it stays labeled as a
 * passage so it cannot be mistaken for a phrase.
 */

import { DIMENSIONS } from './dimensions.js';
import { contentHash } from './hash.js';
import { encodeText } from './text/encode.js';
import {
    AFFECT_PROGRAM_SCHEMA,
    PROGRAM_REFUSALS,
    affectPhrases
} from './program.js';

export const AFFECT_BRIEF_SCHEMA = 'rise.affect-brief.v1';

const DEFAULT_CHUNK = Object.freeze({ mode: 'phrase', wpm: 220, phraseFloor: true });

function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) freezeDeep(nested);
    return Object.freeze(value);
}

export function passageProposalsFor(text, catalog) {
    if (!Array.isArray(catalog)) return [];
    return catalog
        .filter(row => row && row.text === text && row.raw && typeof row.raw === 'object')
        .map(row => ({
            modelId: String(row.modelId),
            role: 'proposal',
            grain: 'passage',
            raw: {
                valence: row.raw.valence,
                arousal: row.raw.arousal,
                dominance: row.raw.dominance
            }
        }));
}

/**
 * @param {string} text
 * @param {{ chunk?: object, passageProposals?: object[] }} [options]
 */
export function buildAffectBrief(text, options = {}) {
    const chunk = {
        mode: 'phrase',
        wpm: options.chunk?.wpm ?? DEFAULT_CHUNK.wpm,
        phraseFloor: options.chunk?.phraseFloor ?? DEFAULT_CHUNK.phraseFloor
    };
    const phrases = affectPhrases(text, chunk);
    const passageProposals = passageProposalsFor(text, (options.passageProposals || []).map(row => ({
        text,
        modelId: row.modelId,
        raw: row.raw
    })));
    return freezeDeep({
        schema: AFFECT_BRIEF_SCHEMA,
        textHash: contentHash(text),
        chunk,
        phrases: phrases.map((phrase, index) => ({ index, text: phrase })),
        proposals: phrases.map((phrase, index) => ({
            index,
            modelId: 'contextual-window-v1',
            role: 'proposal',
            grain: 'phrase',
            state: encodeText(phrase)
        })),
        passageProposals
    });
}

export function affectProgramPrompt() {
    const axes = DIMENSIONS.map(dimension => `${dimension.id} (${dimension.range[0]} to ${dimension.range[1]})`).join('\n');
    const codes = PROGRAM_REFUSALS.join('\n');
    return [
        `Write one JSON object with schema ${AFFECT_PROGRAM_SCHEMA}. Return the JSON only.`,
        'Copy textHash and chunk from the brief exactly.',
        'Each span names a phrase index from the brief and copies that phrase as text.',
        'Spans may skip phrases. A skipped phrase stays absent. Do not store a missing axis as 0 or null.',
        'Set authority to proposed.',
        'A number you judge uses source inferred, prior, or derived. A number a person typed uses source authored.',
        'source measured is refused. A text program has no instrument reading.',
        'Do not copy a proposal into the program unless you mean that judgment. A passage proposal is about the whole text, not one phrase.',
        'Axes:',
        axes,
        'The gate refuses with these codes:',
        codes
    ].join('\n');
}
