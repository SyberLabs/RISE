/**
 * Text affect encoder v1.
 *
 * Feature extraction is contextual (negation and intensifier windows).
 * The readout is an unfitted linear prior. Confidence is capped because
 * the prior has not been estimated from human judgments. Auxiliary
 * emotion labels are cue counts, not the state.
 */

import { DIMENSIONS, EMOTION_LABELS } from '../dimensions.js';
import { contentHash } from '../hash.js';
import { experienceState, slot, unavailableState } from '../schema.js';
import { extractFeatures } from './features.js';
import { EMOTION_CUES, LEXICON } from './lexicon.js';
import {
    activeParameterCount,
    denseParameterCount,
    evidenced,
    linearCore,
    TEXT_SOURCES
} from './readout.js';

export const CONFIDENCE_CAP = 0.7;

export const TEXT_ENCODER_MANIFEST = Object.freeze({
    id: 'contextual-window-v1',
    version: 1,
    family: 'linear-readout-over-contextual-window-features',
    trained: false,
    confidenceCap: CONFIDENCE_CAP,
    activeParameters: activeParameterCount(),
    denseParameters: denseParameterCount(),
    distillation: 'not-run',
    note: 'Readout coefficients are an explicit prior. They are not a distilled transformer.'
});

function lexicalConfidence(hits, coverage) {
    return Math.min(CONFIDENCE_CAP, 0.12 + 0.08 * Math.min(hits, 5) + 0.35 * coverage);
}

function emotionAuxiliary(text) {
    const tokens = String(text).toLowerCase().replace(/[\u2019\u2018]/gu, "'").split(/[^a-z']+/u);
    const totals = {};
    let hits = 0;
    for (const label of EMOTION_LABELS) {
        const cues = new Set(EMOTION_CUES[label]);
        let count = 0;
        for (const token of tokens) {
            if (cues.has(token)) count += 1;
        }
        totals[label] = count;
        hits += count;
    }
    if (!hits) return null;
    const labels = {};
    for (const label of EMOTION_LABELS) {
        if (totals[label] > 0) labels[label] = totals[label] / hits;
    }
    return {
        role: 'auxiliary',
        source: 'inferred',
        confidence: Math.min(0.45, hits / 8),
        labels
    };
}

function confidenceFor(id, hits, coverage, tokens) {
    if (id === 'novelty') return Math.min(0.35, lexicalConfidence(hits, coverage));
    if (id === 'perceptualDensity') return tokens > 0 ? 0.45 : 0;
    return lexicalConfidence(hits, coverage);
}

export function encodeText(text) {
    if (typeof text !== 'string') throw new TypeError('encodeText expects a string');
    if (text.trim().length === 0) return unavailableState('text', 'empty-text');

    const features = extractFeatures(text, { negate: true });
    const raw = linearCore(features.values);
    const dimensions = {};
    for (const dimension of DIMENSIONS) {
        const known = evidenced(features.map, dimension.id);
        const source = TEXT_SOURCES[dimension.id];
        if (!known) {
            dimensions[dimension.id] = slot(null, 0, source);
            continue;
        }
        const [lo, hi] = dimension.range;
        const value = Math.min(hi, Math.max(lo, raw[dimension.id]));
        dimensions[dimension.id] = slot(
            value,
            confidenceFor(dimension.id, features.hits, features.map.coverage, features.tokens),
            source
        );
    }

    const caveats = ['unfitted-linear-prior', 'confidence-capped'];
    if (features.map.coverage < 0.2) caveats.push('low-lexicon-coverage');
    if (features.map.contrastRate > 0) caveats.push('contrast-marker-present');
    if (features.hits === 0) caveats.push('no-lexicon-hits');

    return experienceState({
        modality: 'text',
        dimensions,
        emotions: emotionAuxiliary(text),
        measurements: {
            lexiconHits: features.hits,
            contentWords: features.contentWords,
            coverage: features.map.coverage
        },
        caveats,
        provenance: {
            method: TEXT_ENCODER_MANIFEST.id,
            modelId: TEXT_ENCODER_MANIFEST.id,
            trained: 'false',
            contentHash: contentHash(text),
            parameters: TEXT_ENCODER_MANIFEST.activeParameters
        }
    });
}

export function knownLexiconSize() {
    return Object.keys(LEXICON).length;
}
