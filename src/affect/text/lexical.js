/**
 * Lexical VAD baseline.
 *
 * Bag of words. Negation is ignored on purpose: the gap between this
 * and the contextual encoder is the check that windowing does something.
 * Axes other than valence, arousal, and dominance are left unset.
 */

import { contentHash } from '../hash.js';
import { experienceState, slot, unavailableState } from '../schema.js';
import { extractFeatures } from './features.js';

export const LEXICAL_MANIFEST = Object.freeze({
    id: 'lexical-vad-v1',
    role: 'weak-baseline',
    trained: false,
    parameters: 0,
    note: 'Averages lexicon entries. Does not model negation, syntax, or irony.'
});

export function encodeLexical(text) {
    if (typeof text !== 'string') throw new TypeError('encodeLexical expects a string');
    if (text.trim().length === 0) return unavailableState('text', 'empty-text');
    const features = extractFeatures(text, { negate: false });
    const coverage = features.map.coverage;
    const confidence = features.hits
        ? Math.min(0.45, 0.1 + 0.25 * coverage)
        : 0;
    const present = features.hits > 0;
    return experienceState({
        modality: 'text',
        dimensions: {
            valence: slot(present ? features.map.valenceLex : null, confidence, 'inferred'),
            arousal: slot(present ? features.map.arousalLex : null, confidence, 'inferred'),
            dominance: slot(present ? features.map.dominanceLex : null, confidence, 'inferred')
        },
        measurements: {
            lexiconHits: features.hits,
            contentWords: features.contentWords,
            coverage
        },
        caveats: ['weak-baseline', 'negation-ignored', 'bag-of-words'],
        provenance: {
            method: LEXICAL_MANIFEST.id,
            modelId: LEXICAL_MANIFEST.id,
            trained: 'false',
            contentHash: contentHash(text)
        }
    });
}
