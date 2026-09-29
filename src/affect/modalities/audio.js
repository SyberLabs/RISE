/**
 * Audio contribution from measured DSP features.
 *
 * Tempo, loudness, spectral density, rhythmic activity, brightness, and
 * dynamics are accepted when the caller already measured them. No music
 * emotion network is loaded. Brightness is kept as a measurement and is
 * not copied onto valence or warmth.
 */

import { clamp, experienceState, slot, unavailableState } from '../schema.js';

export const AUDIO_MODEL_NOTE = Object.freeze({
    id: 'audio-dsp-prior-v1',
    musicEmotionModel: 'not-run',
    reason: 'No music-emotion checkpoint was benchmarked on RISE material. Interpretable DSP features are the v1 path.'
});

export function audioState(input = {}) {
    const features = input.features || input;
    const tempo = Number.isFinite(features.tempo) ? features.tempo : null;
    const loudness = Number.isFinite(features.loudness) ? clamp(features.loudness, 0, 1) : null;
    const spectralDensity = Number.isFinite(features.spectralDensity) ? clamp(features.spectralDensity, 0, 1) : null;
    const rhythmicActivity = Number.isFinite(features.rhythmicActivity) ? clamp(features.rhythmicActivity, 0, 1) : null;
    const dynamics = Number.isFinite(features.dynamics) ? clamp(features.dynamics, 0, 1) : null;
    const brightness = Number.isFinite(features.brightness) ? clamp(features.brightness, 0, 1) : null;
    if (tempo == null && loudness == null && rhythmicActivity == null && spectralDensity == null) {
        return unavailableState('audio', 'audio-features-absent');
    }

    const dimensions = {};
    if (tempo != null || rhythmicActivity != null) {
        const tempoNorm = tempo == null ? 0 : clamp(tempo / 180, 0, 1);
        const motion = clamp(tempoNorm * 0.7 + (rhythmicActivity ?? 0) * 0.3, 0, 1);
        dimensions.motionEnergy = slot(motion, 0.4, 'prior');
    }
    if (loudness != null || dynamics != null || tempo != null) {
        const tempoNorm = tempo == null ? 0 : clamp(tempo / 180, 0, 1);
        dimensions.arousal = slot(
            clamp((loudness ?? 0) * 0.45 + (dynamics ?? 0) * 0.3 + tempoNorm * 0.25, 0, 1),
            0.4,
            'prior'
        );
    }
    if (spectralDensity != null) {
        dimensions.perceptualDensity = slot(spectralDensity, 0.45, 'measured');
    }

    return experienceState({
        modality: 'audio',
        dimensions,
        measurements: {
            tempo: tempo ?? undefined,
            loudness: loudness ?? undefined,
            spectralDensity: spectralDensity ?? undefined,
            rhythmicActivity: rhythmicActivity ?? undefined,
            brightness: brightness ?? undefined,
            dynamics: dynamics ?? undefined
        },
        caveats: ['dsp-prior', 'brightness-is-not-valence', AUDIO_MODEL_NOTE.reason],
        provenance: {
            method: AUDIO_MODEL_NOTE.id,
            note: AUDIO_MODEL_NOTE.reason
        }
    });
}
