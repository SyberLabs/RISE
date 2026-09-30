/**
 * Canonical axes of an experience state.
 *
 * These are computational coordinates, not a taxonomy of human emotion.
 * Ranges are part of the contract: bipolar axes cross zero, unipolar axes
 * do not. `kind` is the usual way a text encoder obtains the axis. A visual
 * or pacing adapter may override it per value, because the same name can be
 * measured in one modality and only inferred in another.
 */

export const EXPERIENCE_STATE_VERSION = 1;

export const SOURCES = Object.freeze([
    'measured',
    'inferred',
    'derived',
    'prior',
    'absent',
    'authored'
]);

export const EMOTION_LABELS = Object.freeze([
    'joy',
    'sadness',
    'anger',
    'fear',
    'calm',
    'awe',
    'tenderness'
]);

export const DIMENSIONS = Object.freeze([
    Object.freeze({ id: 'valence', range: Object.freeze([-1, 1]), kind: 'inferred', bipolar: true }),
    Object.freeze({ id: 'arousal', range: Object.freeze([0, 1]), kind: 'inferred', bipolar: false }),
    Object.freeze({ id: 'dominance', range: Object.freeze([-1, 1]), kind: 'inferred', bipolar: true }),
    Object.freeze({ id: 'tension', range: Object.freeze([0, 1]), kind: 'derived', bipolar: false }),
    Object.freeze({ id: 'intimacy', range: Object.freeze([0, 1]), kind: 'inferred', bipolar: false }),
    Object.freeze({ id: 'warmth', range: Object.freeze([-1, 1]), kind: 'inferred', bipolar: true }),
    Object.freeze({ id: 'uncertainty', range: Object.freeze([0, 1]), kind: 'inferred', bipolar: false }),
    Object.freeze({ id: 'expansiveness', range: Object.freeze([0, 1]), kind: 'inferred', bipolar: false }),
    Object.freeze({ id: 'perceptualDensity', range: Object.freeze([0, 1]), kind: 'derived', bipolar: false }),
    Object.freeze({ id: 'motionEnergy', range: Object.freeze([0, 1]), kind: 'measured', bipolar: false }),
    Object.freeze({ id: 'solemnity', range: Object.freeze([0, 1]), kind: 'inferred', bipolar: false }),
    Object.freeze({ id: 'novelty', range: Object.freeze([0, 1]), kind: 'derived', bipolar: false })
]);

export const DIMENSION_BY_ID = Object.freeze(Object.fromEntries(
    DIMENSIONS.map(dimension => [dimension.id, dimension])
));

export const MODALITIES = Object.freeze([
    'text',
    'visual',
    'audio',
    'pacing',
    'typography',
    'fused'
]);
