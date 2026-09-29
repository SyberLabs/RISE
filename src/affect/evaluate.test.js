import { describe, expect, it } from 'vitest';
import { evaluateCandidate, maybeEvaluate } from './evaluate.js';
import { detectMovement, pacingCurve, slideWindows, textTrajectory } from './temporal.js';

const LOW = 'solemn death and woe and mourning and grief';

function freezeDeep(value) {
    if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) freezeDeep(nested);
        Object.freeze(value);
    }
    return value;
}

describe('cross-modal evaluation', () => {
    it('names a fast pace against a low-arousal convergence without editing the candidate', () => {
        const candidate = freezeDeep({
            text: LOW,
            visual: {
                measured: {
                    hue: 210,
                    saturation: 0.2,
                    luminance: 0.7,
                    contrast: 0.2,
                    motionVelocity: 0.05,
                    density: 0.15,
                    entropy: 0.1,
                    flashCadence: 0,
                    scale: 0.5,
                    openness: 0.6
                }
            },
            audioFeatures: {
                tempo: 60,
                loudness: 0.2,
                spectralDensity: 0.25,
                rhythmicActivity: 0.1,
                brightness: 0.3,
                dynamics: 0.15
            },
            pacing: { wpm: 520, chunkMode: 'word', curve: 'flat', revealMode: 'instant' },
            intent: { target: { arousal: 0.2, valence: -0.3 }, trajectory: 'hold' }
        });
        const before = JSON.stringify(candidate);
        const result = evaluateCandidate(candidate);
        expect(JSON.stringify(candidate)).toBe(before);
        expect(result.composite).toBeNull();
        expect(result.explanation.interpretations.some(item =>
            item.statement.includes('520 WPM')
            && item.statement.includes('low-arousal negative affect')
        )).toBe(true);
        expect(result.explanation.observations.every(item => item.kind === 'observation')).toBe(true);
        expect(result.explanation.scores.every(item => item.kind === 'derived-score')).toBe(true);
        expect(result.explanation.recommendations[0].proposes.field).toBe('pacing.wpm');
        expect(candidate.pacing.wpm).toBe(520);
        expect(result.alignmentByModality.pacing).toBeLessThan(0.25);
        expect(result.components.alignment).toBeGreaterThan(result.alignmentByModality.pacing);
    });

    it('scores marked contrast as intentional tension', () => {
        const marked = evaluateCandidate({
            text: LOW,
            audioFeatures: { tempo: 168, loudness: 0.95, rhythmicActivity: 0.9, dynamics: 0.85 },
            intent: { intentionalContrast: true, target: { arousal: 0.2 } }
        });
        const unmarked = evaluateCandidate({
            text: LOW,
            audioFeatures: { tempo: 168, loudness: 0.95, rhythmicActivity: 0.9, dynamics: 0.85 },
            intent: { target: { arousal: 0.2 } }
        });
        expect(marked.components.contrast).toBeGreaterThan(0.3);
        expect(marked.components.conflict).toBe(0);
        expect(marked.components.intentionalTension).toBeCloseTo(marked.components.contrast);
        expect(unmarked.components.conflict).toBeCloseTo(unmarked.components.contrast);
        expect(unmarked.components.intentionalTension).toBe(0);
    });

    it('stays disabled until the flag is on, and survives a dead encoder', () => {
        expect(maybeEvaluate({ pacing: { wpm: 'nope' } }, {}).status).toBe('disabled');
        const result = evaluateCandidate(
            { text: LOW, pacing: { wpm: 180 } },
            { encodeText: () => { throw new Error('missing weights'); } }
        );
        expect(result.states.text.provenance.reason).toBe('encoder-failed');
        expect(result.states.pacing.measurements.wpm).toBe(180);
    });

    it('weights a composite only when the caller supplies weights', () => {
        const result = evaluateCandidate({
            text: LOW,
            pacing: { wpm: 180 },
            intent: { weights: { uncertainty: 1 } }
        });
        expect(result.composite).toBeGreaterThan(0);
        expect(result.composite).toBeCloseTo(result.components.uncertainty);
    });
});

describe('temporal trajectories', () => {
    it('windows a passage and reads an ascent curve as escalation', () => {
        const text = `${LOW} `.repeat(30);
        const windows = slideWindows(text, { windowWords: 12, stride: 12 });
        expect(windows.length).toBeGreaterThan(2);
        const trajectory = textTrajectory(text, { windowWords: 20, stride: 20 });
        expect(trajectory[0].state.modality).toBe('text');
        expect(trajectory[0].state.provenance.contentHash)
            .not.toBe(trajectory[trajectory.length - 1].state.provenance.contentHash);
        const curve = pacingCurve('ascent', 6);
        const movement = detectMovement(curve.map(sample => sample.motionEnergy));
        expect(movement.label).toBe('escalation');
        expect(curve[0].motionEnergy).toBeLessThan(curve[curve.length - 1].motionEnergy);
    });

    it('names a climax and a suspension from the shape alone', () => {
        expect(detectMovement([0.1, 0.3, 0.8, 0.4, 0.15]).label).toBe('climax');
        expect(detectMovement([0.4, 0.41, 0.4, 0.39, 0.4]).label).toBe('suspension');
    });
});
