/**
 * Linear prior from window features onto the experience axes.
 *
 * The coefficients are not fitted. There is no human preference set in
 * this repository large enough to estimate them, and fitting them to
 * labels invented for the fit would counterfeit a measurement. `bias`
 * is zero throughout: an all-zero feature vector must not invent affect.
 *
 * Weights are dense and aligned with FEATURE_NAMES so the same matrix
 * can be exported as a single matrix product.
 */

import { DIMENSIONS } from '../dimensions.js';
import { FEATURE_NAMES } from './features.js';

function row(partial) {
    return FEATURE_NAMES.map(name => partial[name] ?? 0);
}

export const READOUT = Object.freeze({
    valence: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ valenceLex: 0.8, warmthLex: 0.15, solemnRate: -0.35 }))
    }),
    arousal: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({
            arousalLex: 0.55,
            exclamationRate: 0.25,
            motionRate: 0.2,
            punctDensity: 0.1,
            contrastRate: 0.08
        }))
    }),
    dominance: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ dominanceLex: 0.75, firstPersonRate: 0.15, uncertaintyRate: -0.2 }))
    }),
    tension: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({
            arousalLex: 0.4,
            contrastRate: 0.3,
            solemnRate: 0.25,
            negationRate: 0.15,
            uncertaintyRate: 0.2,
            warmthLex: -0.1
        }))
    }),
    intimacy: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({
            intimacyRate: 0.5,
            firstPersonRate: 0.35,
            dialogueRate: 0.1,
            warmthLex: 0.15
        }))
    }),
    warmth: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ warmthLex: 0.75, valenceLex: 0.2, solemnRate: -0.2 }))
    }),
    uncertainty: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({
            uncertaintyRate: 0.5,
            questionRate: 0.4,
            contrastRate: 0.2,
            negationRate: 0.1
        }))
    }),
    expansiveness: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ scaleRate: 0.8, sentenceLengthNorm: 0.1 }))
    }),
    perceptualDensity: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ typeTokenRatio: 0.45, punctDensity: 0.25, coverage: 0.2 }))
    }),
    motionEnergy: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ motionRate: 0.7, exclamationRate: 0.2, arousalLex: 0.15 }))
    }),
    solemnity: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ solemnRate: 0.85, exclamationRate: -0.1 }))
    }),
    novelty: Object.freeze({
        bias: 0,
        weights: Object.freeze(row({ typeTokenRatio: 0.45, contrastRate: 0.25 }))
    })
});

const EVIDENCE = Object.freeze({
    valence: ['valenceLex', 'warmthLex', 'solemnRate'],
    arousal: ['arousalLex', 'exclamationRate', 'motionRate', 'punctDensity'],
    dominance: ['dominanceLex', 'firstPersonRate', 'uncertaintyRate'],
    tension: ['arousalLex', 'contrastRate', 'solemnRate', 'negationRate', 'uncertaintyRate'],
    intimacy: ['intimacyRate', 'firstPersonRate', 'dialogueRate', 'warmthLex'],
    warmth: ['warmthLex', 'valenceLex', 'solemnRate'],
    uncertainty: ['uncertaintyRate', 'questionRate', 'contrastRate', 'negationRate'],
    expansiveness: ['scaleRate', 'sentenceLengthNorm'],
    perceptualDensity: ['typeTokenRatio', 'punctDensity', 'coverage'],
    motionEnergy: ['motionRate', 'exclamationRate', 'arousalLex'],
    solemnity: ['solemnRate'],
    novelty: ['typeTokenRatio', 'contrastRate']
});

export const TEXT_SOURCES = Object.freeze({
    valence: 'inferred',
    arousal: 'inferred',
    dominance: 'inferred',
    tension: 'derived',
    intimacy: 'inferred',
    warmth: 'inferred',
    uncertainty: 'inferred',
    expansiveness: 'inferred',
    perceptualDensity: 'derived',
    motionEnergy: 'inferred',
    solemnity: 'inferred',
    novelty: 'derived'
});

export function activeParameterCount() {
    let count = 0;
    for (const dimension of DIMENSIONS) {
        const spec = READOUT[dimension.id];
        if (spec.bias !== 0) count += 1;
        count += spec.weights.filter(weight => weight !== 0).length;
    }
    return count;
}

export function denseParameterCount() {
    return FEATURE_NAMES.length * DIMENSIONS.length + DIMENSIONS.length;
}

function dot(weights, values) {
    let sum = 0;
    for (let index = 0; index < weights.length; index += 1) sum += weights[index] * values[index];
    return sum;
}

export function evidenced(map, dimensionId) {
    return EVIDENCE[dimensionId].some(name => Math.abs(map[name]) > 1e-8);
}

/** Unclamped matrix product. This is the function an ONNX Gemm must match. */
export function linearCore(values) {
    const out = {};
    for (const dimension of DIMENSIONS) {
        const spec = READOUT[dimension.id];
        out[dimension.id] = spec.bias + dot(spec.weights, values);
    }
    return out;
}

export function matrixColumns() {
    return DIMENSIONS.map(dimension => READOUT[dimension.id].weights);
}
