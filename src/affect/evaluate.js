/**
 * Cross-modal evaluation and the value-function surface.
 *
 * Disagreement is a measurement. It becomes "conflict" only when the
 * intent did not ask for contrast, and even then it is a component,
 * not a verdict that the experience failed. Nothing here writes back
 * into a session config.
 */

import { DIMENSION_BY_ID, DIMENSIONS } from './dimensions.js';
import { affectEnabled } from './flags.js';
import { audioState } from './modalities/audio.js';
import { pacingState } from './modalities/pacing.js';
import { typographyState } from './modalities/typography.js';
import { visualState } from './modalities/visual.js';
import { clamp, unavailableState } from './schema.js';
import { encodeText } from './text/encode.js';
import {
    compareSeries,
    detectMovement,
    pacingCurve,
    seriesFromTrajectory,
    textTrajectory
} from './temporal.js';

const COMPONENT_POLARITY = Object.freeze({
    alignment: 'higher-is-closer-to-target',
    coherence: 'higher-is-more-agreement',
    contrast: 'higher-is-more-disagreement',
    continuity: 'higher-is-smoother',
    sensoryLoad: 'higher-is-heavier',
    conflict: 'higher-is-more-unintended-opposition',
    intentionalTension: 'higher-is-more-deliberate-contrast',
    uncertainty: 'higher-is-less-sure'
});

function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function presentSlot(state, id) {
    const slot = state?.dimensions?.[id];
    if (!slot || slot.value == null || !(slot.confidence > 0)) return null;
    return slot;
}

function fuseDimension(states, id) {
    let weighted = 0;
    let weight = 0;
    const parts = [];
    for (const [modality, state] of Object.entries(states)) {
        const slot = presentSlot(state, id);
        if (!slot) continue;
        weighted += slot.value * slot.confidence;
        weight += slot.confidence;
        parts.push({ modality, value: slot.value, confidence: slot.confidence, source: slot.source });
    }
    if (weight === 0) return null;
    return { value: weighted / weight, parts };
}

function contrastOf(states) {
    const ranges = [];
    for (const dimension of DIMENSIONS) {
        const values = [];
        for (const state of Object.values(states)) {
            const slot = presentSlot(state, dimension.id);
            if (slot) values.push(slot.value);
        }
        if (values.length < 2) continue;
        ranges.push(Math.max(...values) - Math.min(...values));
    }
    if (ranges.length === 0) return null;
    return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function meanConfidence(states) {
    let sum = 0;
    let count = 0;
    for (const state of Object.values(states)) {
        for (const slot of Object.values(state?.dimensions || {})) {
            if (slot.value == null) continue;
            sum += slot.confidence;
            count += 1;
        }
    }
    return count ? sum / count : 0;
}

function intentional(intent) {
    return intent?.intentionalContrast === true || intent?.trajectory === 'contrast';
}

function lowArousalNegative(state) {
    const arousal = presentSlot(state, 'arousal');
    const valence = presentSlot(state, 'valence');
    if (!arousal || arousal.value >= 0.45) return false;
    if (valence && valence.value >= 0.05) return false;
    return true;
}

function narrate(states, intent, wpm) {
    const text = states.text;
    const visual = states.visual;
    const audio = states.audio;
    const targetArousal = intent?.target?.arousal;
    const converged = text && visual && audio
        && lowArousalNegative(text)
        && lowArousalNegative(visual)
        && lowArousalNegative(audio);
    if (converged && wpm >= 480 && targetArousal != null && targetArousal < 0.4) {
        return `Text, audio, and visual treatment converge on low-arousal negative affect, while ${wpm} WPM introduces high activation inconsistent with the current target trajectory.`;
    }
    return null;
}

function compositeOf(components, weights) {
    if (!weights || typeof weights !== 'object') return null;
    let weighted = 0;
    let weight = 0;
    for (const [name, value] of Object.entries(weights)) {
        if (!(value > 0) || !Number.isFinite(value)) continue;
        const component = components[name];
        if (component == null || !Number.isFinite(component)) continue;
        weighted += component * value;
        weight += value;
    }
    return weight ? weighted / weight : null;
}

export function evaluateExperience({
    states,
    intent = {},
    trajectory = null,
    presentation = null
} = {}) {
    const fused = {};
    for (const dimension of DIMENSIONS) {
        const fusedDimension = fuseDimension(states, dimension.id);
        if (fusedDimension) fused[dimension.id] = fusedDimension;
    }

    const target = intent.target && typeof intent.target === 'object' ? intent.target : {};
    const axisError = (value, wanted, dimension) => {
        const span = dimension.range[1] - dimension.range[0];
        return Math.abs(value - wanted) / span;
    };
    const errors = [];
    for (const [id, wanted] of Object.entries(target)) {
        const dimension = DIMENSION_BY_ID[id];
        const actual = fused[id];
        if (!dimension || typeof wanted !== 'number' || !actual) continue;
        errors.push(axisError(actual.value, wanted, dimension));
    }
    const alignment = errors.length
        ? clamp(1 - errors.reduce((sum, value) => sum + value, 0) / errors.length, 0, 1)
        : null;
    const alignmentByModality = {};
    for (const [modality, state] of Object.entries(states)) {
        const local = [];
        for (const [id, wanted] of Object.entries(target)) {
            const dimension = DIMENSION_BY_ID[id];
            const slot = presentSlot(state, id);
            if (!dimension || typeof wanted !== 'number' || !slot) continue;
            local.push(axisError(slot.value, wanted, dimension));
        }
        if (local.length) {
            alignmentByModality[modality] = clamp(1 - local.reduce((sum, value) => sum + value, 0) / local.length, 0, 1);
        }
    }

    const contrast = contrastOf(states);
    const asked = intentional(intent);
    const coherence = contrast == null ? null : clamp(1 - contrast, 0, 1);
    const conflict = contrast == null ? null : (asked ? 0 : contrast);
    const tension = contrast == null ? null : (asked ? contrast : 0);

    const loadParts = ['perceptualDensity', 'motionEnergy', 'arousal']
        .map(id => fused[id]?.value)
        .filter(value => value != null);
    const sensoryLoad = loadParts.length
        ? loadParts.reduce((sum, value) => sum + value, 0) / loadParts.length
        : null;

    let continuity = null;
    let movement = null;
    let trajectoryError = null;
    if (trajectory && trajectory.length >= 2) {
        const series = seriesFromTrajectory(trajectory, intent.trajectoryDimension || 'arousal');
        const numbers = series.filter(value => value != null);
        movement = detectMovement(numbers);
        if (numbers.length >= 2) {
            let step = 0;
            for (let index = 1; index < numbers.length; index += 1) {
                step += Math.abs(numbers[index] - numbers[index - 1]);
            }
            continuity = clamp(1 - step / (numbers.length - 1), 0, 1);
        }
        if (presentation?.length) {
            trajectoryError = compareSeries(
                presentation.map(sample => sample.motionEnergy),
                series
            );
        }
    }

    const uncertainty = clamp(1 - meanConfidence(states), 0, 1);
    const components = {
        alignment,
        coherence,
        contrast,
        continuity,
        sensoryLoad,
        conflict,
        intentionalTension: tension,
        uncertainty
    };

    const observations = [];
    for (const [modality, state] of Object.entries(states)) {
        if (!state || state.provenance?.status === 'unavailable') {
            observations.push({
                kind: 'observation',
                modality,
                statement: `${modality} was not estimated (${state?.provenance?.reason || 'absent'}).`
            });
            continue;
        }
        const bits = Object.entries(state.dimensions)
            .filter(([, item]) => item.value != null)
            .map(([id, item]) => `${id} ${item.value.toFixed(2)} (${item.source}, confidence ${item.confidence.toFixed(2)})`);
        if (state.measurements?.wpm != null) {
            observations.push({
                kind: 'observation',
                modality,
                statement: `Reading pace is ${state.measurements.wpm} words per minute.`
            });
        }
        observations.push({
            kind: 'observation',
            modality,
            statement: bits.length ? `${modality}: ${bits.join('; ')}.` : `${modality} carried no dimension estimates.`
        });
    }

    const scores = Object.entries(components).map(([component, value]) => ({
        kind: 'derived-score',
        component,
        value,
        polarity: COMPONENT_POLARITY[component]
    }));

    const interpretations = [];
    const wpm = states.pacing?.measurements?.wpm;
    const specific = narrate(states, intent, wpm);
    if (specific) interpretations.push({ kind: 'interpretation', statement: specific });
    if (contrast != null && contrast > 0.35) {
        interpretations.push({
            kind: 'interpretation',
            statement: asked
                ? 'Contrast is scored as intentional tension, not as failure.'
                : 'Disagreement is recorded as contrast. It is treated as unintended conflict only because the intent did not mark it as deliberate.'
        });
    }

    const recommendations = [];
    if (typeof wpm === 'number' && wpm >= 480 && typeof target.arousal === 'number' && target.arousal < 0.4) {
        recommendations.push({
            kind: 'recommendation',
            statement: `A pace of ${wpm} WPM is a proposal to revisit if the target stays near ${target.arousal} arousal. The session configuration was not changed.`,
            proposes: { field: 'pacing.wpm', direction: 'decrease' }
        });
    }

    return {
        version: 1,
        components,
        alignmentByModality,
        composite: compositeOf(components, intent.weights),
        polarity: COMPONENT_POLARITY,
        fused,
        temporal: {
            movement,
            continuity,
            expectedVersusActual: trajectoryError
        },
        explanation: {
            observations,
            scores,
            interpretations,
            recommendations
        }
    };
}

function buildStates(candidate, encode) {
    const states = {};
    if (typeof candidate.text === 'string') {
        try {
            states.text = encode(candidate.text);
        } catch {
            states.text = unavailableState('text', 'encoder-failed');
        }
    }
    if (candidate.visualConfig || candidate.visual) {
        states.visual = visualState(candidate.visual || { visualConfig: candidate.visualConfig });
    }
    if (candidate.audioFeatures || candidate.audio) {
        states.audio = audioState(candidate.audioFeatures || candidate.audio);
    }
    if (candidate.pacing) states.pacing = pacingState(candidate.pacing);
    if (candidate.typography) states.typography = typographyState(candidate.typography);
    return states;
}

export function evaluateCandidate(candidate, options = {}) {
    if (!candidate || typeof candidate !== 'object') {
        throw new TypeError('evaluateCandidate expects a candidate object');
    }
    const snapshot = structuredClone(candidate);
    const encode = options.encodeText || encodeText;
    const states = buildStates(candidate, encode);

    let trajectory = null;
    const wordCount = typeof candidate.text === 'string'
        ? candidate.text.split(/\s+/u).filter(Boolean).length
        : 0;
    if (wordCount > 80) {
        try {
            trajectory = textTrajectory(candidate.text, { encode });
        } catch {
            trajectory = null;
        }
    }
    const curveName = candidate.pacing?.curve;
    const presentation = typeof curveName === 'string' ? pacingCurve(curveName, 8) : null;
    const evaluation = evaluateExperience({
        states,
        intent: candidate.intent || {},
        trajectory,
        presentation
    });
    if (!sameJson(candidate, snapshot)) {
        throw new Error('affect evaluation mutated the candidate');
    }
    return {
        ...evaluation,
        status: 'evaluated',
        states
    };
}

export function maybeEvaluate(candidate, env = {}, options = {}) {
    if (!affectEnabled(env)) return { status: 'disabled', evaluated: false };
    return evaluateCandidate(candidate, options);
}
