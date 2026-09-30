/**
 * Pacing contribution.
 *
 * Words per minute, chunk mode, and reveal style are authoritative
 * session fields. Mapping them onto arousal is a prior: the number is
 * measured, the psychological reading of it is not. An omitted pace is
 * not filled with the compiler default.
 */

import { READING_PACE } from '../../core/reading-limits.js';
import { experienceState, slot, unavailableState } from '../schema.js';

const CHUNK_MOTION = Object.freeze({
    word: 1,
    phrase: 0.85,
    sentence: 0.7,
    paragraph: 0.55
});

const CHUNK_AROUSAL = Object.freeze({
    word: 1,
    phrase: 0.92,
    sentence: 0.8,
    paragraph: 0.7
});

/** Logistic centered on a comfortable oral pace, not on the legal maximum. */
export function pacingActivation(wpm) {
    const x = (wpm - 220) / 80;
    return 1 / (1 + Math.exp(-x));
}

export function pacingState(input = {}) {
    const wpm = input.wpm;
    if (typeof wpm !== 'number' || !Number.isFinite(wpm)) {
        return unavailableState('pacing', 'pace-not-provided');
    }
    const chunkMode = CHUNK_MOTION[input.chunkMode] ? input.chunkMode : 'word';
    const revealMode = input.revealMode === 'progressive' ? 'progressive' : 'instant';
    const activation = pacingActivation(wpm);
    const arousal = Math.min(1, activation * CHUNK_AROUSAL[chunkMode]);
    const motionEnergy = Math.min(1, activation * CHUNK_MOTION[chunkMode]);
    const novelty = revealMode === 'progressive' ? 0.25 : 0.45;
    return experienceState({
        modality: 'pacing',
        dimensions: {
            arousal: slot(arousal, 0.45, 'prior'),
            motionEnergy: slot(motionEnergy, 0.45, 'prior'),
            novelty: slot(novelty, 0.3, 'prior')
        },
        measurements: {
            wpm,
            chunkMode,
            revealMode,
            curve: typeof input.curve === 'string' ? input.curve : 'unset',
            paceWindowMin: READING_PACE.min,
            paceWindowMax: READING_PACE.max,
            activationCenterWpm: 220
        },
        caveats: ['wpm-to-arousal-is-a-prior'],
        provenance: {
            method: 'pacing-prior-v1',
            note: 'The pace figure is measured. Its placement on arousal is a scale choice centered at 220 WPM.'
        }
    });
}
