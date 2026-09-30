/**
 * Affect through time.
 *
 * A chapter is a series of states, not one average. Windowing is by
 * words. Movement labels describe the shape of a series; they are not
 * a claim that the reader felt a climax.
 */

import { StateCurve } from '../core/pacing.js';
import { clamp } from './schema.js';
import { encodeText } from './text/encode.js';

const CURVES = Object.freeze({
    flat: () => StateCurve.flat(),
    induction: () => StateCurve.induction(),
    ascent: () => StateCurve.ascent(),
    wave: () => StateCurve.wave(),
    climax: () => StateCurve.climax()
});

function wordsOf(text) {
    return String(text).match(/[A-Za-z0-9’']+/gu) || [];
}

export function slideWindows(text, { windowWords = 40, stride = 20 } = {}) {
    const words = wordsOf(text);
    if (words.length === 0) return [];
    const size = Math.max(1, windowWords);
    const step = Math.max(1, stride);
    const windows = [];
    if (words.length <= size) {
        windows.push({ index: 0, start: 0, end: words.length, text: words.join(' ') });
        return windows;
    }
    for (let start = 0; start < words.length; start += step) {
        const end = Math.min(words.length, start + size);
        windows.push({ index: windows.length, start, end, text: words.slice(start, end).join(' ') });
        if (end === words.length) break;
    }
    return windows;
}

export function textTrajectory(text, { windowWords = 40, stride = 20, encode = encodeText } = {}) {
    return slideWindows(text, { windowWords, stride }).map(window => ({
        index: window.index,
        start: window.start,
        end: window.end,
        state: encode(window.text)
    }));
}

export function seriesFromTrajectory(trajectory, dimensionId) {
    return trajectory.map(sample => {
        const slot = sample.state?.dimensions?.[dimensionId];
        return slot && slot.value != null ? slot.value : null;
    });
}

/**
 * Duration multipliers above 1 slow the reading, so motion energy falls
 * as the multiplier rises. The curve itself is RISE's pacing curve.
 */
export function pacingCurve(name, steps = 8) {
    const factory = CURVES[name];
    if (!factory) return null;
    const curve = factory();
    const count = Math.max(2, steps);
    const samples = [];
    for (let index = 0; index < count; index += 1) {
        const t = index / (count - 1);
        const multiplier = curve.at(t);
        samples.push({
            t,
            multiplier,
            motionEnergy: clamp(1.15 - 0.45 * multiplier, 0, 1)
        });
    }
    return samples;
}

export function compareSeries(expected, actual) {
    const count = Math.min(expected?.length || 0, actual?.length || 0);
    if (count === 0) return { samples: 0, meanAbsoluteError: null };
    let error = 0;
    let used = 0;
    for (let index = 0; index < count; index += 1) {
        if (expected[index] == null || actual[index] == null) continue;
        error += Math.abs(expected[index] - actual[index]);
        used += 1;
    }
    return {
        samples: used,
        meanAbsoluteError: used ? error / used : null
    };
}

export function detectMovement(series) {
    const values = (series || []).filter(value => typeof value === 'number' && Number.isFinite(value));
    if (values.length < 3) return { label: 'insufficient', samples: values.length };
    const first = values[0];
    const last = values[values.length - 1];
    const slope = (last - first) / (values.length - 1);
    let peakIndex = 0;
    for (let index = 1; index < values.length; index += 1) {
        if (values[index] > values[peakIndex]) peakIndex = index;
    }
    const peak = values[peakIndex];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    let turns = 0;
    for (let index = 2; index < values.length; index += 1) {
        const previous = values[index - 1] - values[index - 2];
        const current = values[index] - values[index - 1];
        if (previous * current < 0 && Math.abs(previous) > 0.02 && Math.abs(current) > 0.02) turns += 1;
    }
    let label = 'mixed';
    if (variance < 0.004) label = 'suspension';
    else if (peakIndex > 0 && peakIndex < values.length - 1 && last < peak - 0.12 && first < peak - 0.08) label = 'climax';
    else if (slope > 0.04) label = 'escalation';
    else if (slope < -0.04) label = 'release';
    else if (turns >= 2) label = 'contrast';
    return {
        label,
        samples: values.length,
        slope,
        peakIndex,
        variance,
        turns
    };
}
