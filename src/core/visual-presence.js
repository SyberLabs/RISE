/**
 * Canonical policy for Rhythmic visual presence.
 *
 * Keep every public limit and perceptual tier here so persisted settings,
 * semantic response, playback, safety, and the UI cannot drift apart.
 */

export const VISUAL_PRESENCE_MIN_MS = 150;
export const VISUAL_PRESENCE_DEFAULT_MS = 200;
// Behind-stream imagery is peripheral, not a cut: it needs dwell time
// to register beneath the text, so its default presence is a full beat
export const VISUAL_PRESENCE_BEHIND_STREAM_DEFAULT_MS = 1000;
export const VISUAL_PRESENCE_MAX_MS = 2000;
export const VISUAL_PRESENCE_STEPS_MS = Object.freeze([
    150, 200, 300, 450, 700, 1000, 1400, 2000
]);

export const VISUAL_PRESENCE_WINDOW_MS = 12_000;
export const VISUAL_PRESENCE_MAX_DUTY = 0.45;
export const VISUAL_PRESENCE_MIN_REST_MS = 250;
export const VISUAL_PRESENCE_REST_FACTOR = 1.25;

export function normalizeVisualPresence(value, fallback = VISUAL_PRESENCE_DEFAULT_MS) {
    const fallbackNumber = Number(fallback);
    const safeFallback = Number.isFinite(fallbackNumber)
        ? fallbackNumber
        : VISUAL_PRESENCE_DEFAULT_MS;
    const parsed = Number(value);
    const duration = Number.isFinite(parsed) ? parsed : safeFallback;
    return Math.round(Math.max(
        VISUAL_PRESENCE_MIN_MS,
        Math.min(VISUAL_PRESENCE_MAX_MS, duration)
    ));
}

export function nearestVisualPresenceStep(value) {
    const duration = normalizeVisualPresence(value);
    return VISUAL_PRESENCE_STEPS_MS.reduce((nearest, step) => (
        Math.abs(step - duration) < Math.abs(nearest - duration) ? step : nearest
    ), VISUAL_PRESENCE_STEPS_MS[0]);
}

export function visualPresenceStepIndex(value) {
    return VISUAL_PRESENCE_STEPS_MS.indexOf(nearestVisualPresenceStep(value));
}

export function formatVisualPresence(value) {
    const duration = normalizeVisualPresence(value);
    if (duration < 1000) return `${duration} ms`;
    return `${(duration / 1000).toFixed(1)} s`;
}

export function visualPresenceRole(value) {
    const duration = normalizeVisualPresence(value);
    if (duration < 250) return 'punctuation';
    if (duration < 500) return 'interruption';
    if (duration < 1000) return 'exposure';
    return 'tableau';
}

export function visualPresenceValueText(value) {
    const duration = normalizeVisualPresence(value);
    const amount = duration < 1000
        ? `${duration} milliseconds`
        : `${(duration / 1000).toFixed(1)} seconds`;
    return `${amount}, ${visualPresenceRole(duration)}`;
}

export function responsiveVisualPresence(value, arousal = 0) {
    const ceiling = normalizeVisualPresence(value);
    const energy = Math.max(0, Math.min(1, Number(arousal) || 0));
    return Math.max(
        VISUAL_PRESENCE_MIN_MS,
        Math.min(ceiling, Math.round(ceiling * (1 - (0.25 * energy))))
    );
}

export function visualPresenceTransition(value) {
    const duration = normalizeVisualPresence(value);
    if (duration < 250) return Object.freeze({ enterMs: 0, exitMs: 0 });
    if (duration < 700) return Object.freeze({ enterMs: 32, exitMs: 32 });
    if (duration < 1200) return Object.freeze({ enterMs: 64, exitMs: 64 });
    return Object.freeze({ enterMs: 96, exitMs: 96 });
}

export function minimumVisualPresenceRest(value) {
    const duration = normalizeVisualPresence(value);
    return Math.max(
        VISUAL_PRESENCE_MIN_REST_MS,
        Math.round(duration * VISUAL_PRESENCE_REST_FACTOR)
    );
}
