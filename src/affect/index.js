/**
 * Affective-semantic layer.
 *
 * Import this explicitly. The reading runtime does not. Evaluation
 * proposes and explains; it does not admit a session config.
 */

export { EXPERIENCE_STATE_VERSION, DIMENSIONS, EMOTION_LABELS, SOURCES } from './dimensions.js';
export { experienceState, validateExperienceState, unavailableState, slot } from './schema.js';
export { affectEnabled } from './flags.js';
export { encodeText, TEXT_ENCODER_MANIFEST, CONFIDENCE_CAP } from './text/encode.js';
export { encodeLexical, LEXICAL_MANIFEST } from './text/lexical.js';
export { FEATURE_NAMES, extractFeatures } from './text/features.js';
export { linearCore, READOUT, activeParameterCount } from './text/readout.js';
export { PAIR_QUESTIONS } from './preference/questions.js';
export { recordJudgment, canFitReadout, MIN_HUMAN_JUDGMENTS } from './preference/judgments.js';
export { fitBradleyTerry } from './preference/bradley-terry.js';
export { visualState, colorimetricWarmth } from './modalities/visual.js';
export { pacingState, pacingActivation } from './modalities/pacing.js';
export { typographyState } from './modalities/typography.js';
export { audioState, AUDIO_MODEL_NOTE } from './modalities/audio.js';
export { evaluateExperience, evaluateCandidate, maybeEvaluate } from './evaluate.js';
export {
    slideWindows,
    textTrajectory,
    pacingCurve,
    compareSeries,
    detectMovement
} from './temporal.js';
export { CORPUS, PROBES, REQUIRED_CASES } from './benchmark/corpus.js';
export { runBenchmark } from './benchmark/harness.js';
export { mapPert, mapReward } from './benchmark/external.js';
export { renderReport } from './benchmark/report.js';
export { hostedTeacher } from './benchmark/teacher.js';
export { runReadoutSession, onnxUnavailable } from './inference.js';
