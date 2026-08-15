/**
 * Canonical policy for Rhythmic visual presence.
 *
 * Keep every public limit and perceptual tier here so persisted settings,
 * semantic response, playback, safety, and the UI cannot drift apart.
 */

export const VISUAL_PRESENCE_MIN_MS = 150;
export const VISUAL_PRESENCE_DEFAULT_MS = 200;

// The three interlocution presentation surfaces. 'full-frame' cuts to an
// opaque overlay; 'behind-stream' flashes beneath the reading; 'continuous'
// (Gallery) is a persistent crossfading field behind the reading
// (CONTINUOUS-FIELD-SPEC). Shared here so persisted settings, the session
// compiler, the panel, and playback cannot drift apart. Any other value
// normalizes to 'full-frame'.
export const PRESENTATION_SURFACES = Object.freeze(['full-frame', 'behind-stream', 'continuous']);
export function normalizePresentation(value) {
    return PRESENTATION_SURFACES.includes(value) ? value : 'full-frame';
}

// Gallery has one temporal axis: how quickly one complete work yields to the
// next. Keep it independent from Rhythmic frequency/presence so changing
// presentation restores both surfaces exactly as the reader left them.
//
// The normalized value runs from contemplative (0) to lively (1). Dwell uses
// an exponential curve because perceived pace follows ratios more naturally
// than equal millisecond steps: the midpoint is about 15 seconds rather than
// the arithmetic midpoint of the endpoints. The dissolve follows the dwell,
// bounded so lively mode remains gentle and contemplative mode never becomes
// a five-second blur.
export const GALLERY_CADENCE_DEFAULT = 0.5;
export const GALLERY_DWELL_MIN_MS = 8_000;
export const GALLERY_DWELL_MAX_MS = 30_000;
export const GALLERY_CROSSFADE_MIN_MS = 1_200;
export const GALLERY_CROSSFADE_MAX_MS = 2_500;

export function normalizeGalleryCadence(value, fallback = GALLERY_CADENCE_DEFAULT) {
    const fallbackNumber = Number(fallback);
    const safeFallback = Number.isFinite(fallbackNumber)
        ? fallbackNumber
        : GALLERY_CADENCE_DEFAULT;
    const parsed = Number(value);
    const cadence = Number.isFinite(parsed) ? parsed : safeFallback;
    return Math.round(Math.max(0, Math.min(1, cadence)) * 100) / 100;
}

export function galleryCadenceTimings(value) {
    const cadence = normalizeGalleryCadence(value);
    const dwellMs = Math.round(
        GALLERY_DWELL_MAX_MS
        * Math.pow(GALLERY_DWELL_MIN_MS / GALLERY_DWELL_MAX_MS, cadence)
    );
    const crossfadeMs = Math.round(Math.max(
        GALLERY_CROSSFADE_MIN_MS,
        Math.min(GALLERY_CROSSFADE_MAX_MS, dwellMs * 0.18)
    ));
    return Object.freeze({ cadence, dwellMs, crossfadeMs });
}

export function galleryCadenceRole(value) {
    const cadence = normalizeGalleryCadence(value);
    if (cadence < 0.34) return 'contemplative';
    if (cadence > 0.66) return 'lively';
    return 'balanced';
}

export function formatGalleryCadence(value) {
    const { dwellMs } = galleryCadenceTimings(value);
    return `≈ ${Math.round(dwellMs / 1000)} s`;
}

export function galleryCadenceValueText(value) {
    const { dwellMs, crossfadeMs } = galleryCadenceTimings(value);
    return `${galleryCadenceRole(value)}, about ${Math.round(dwellMs / 1000)} seconds per work, `
        + `${(crossfadeMs / 1000).toFixed(1)} second dissolve`;
}

// Gallery figure-drawing: Harmonograph's pen and the plate adapter both
// finish a few seconds before the next work, so the completed figure
// can be seen still. Full-frame and behind-stream keep a finished still
// (render progress defaults to 1).
export const GALLERY_DRAW_HOLD_MS = 2_500;
export const GALLERY_DRAW_MIN_MS = 4_000;
export const HARMONOGRAPH_HOLD_MS = GALLERY_DRAW_HOLD_MS;
export const HARMONOGRAPH_DRAW_MIN_MS = GALLERY_DRAW_MIN_MS;

export function galleryDrawMs(dwellMs) {
    const dwell = Math.max(1, Number(dwellMs) || GALLERY_DWELL_MIN_MS);
    const spare = Math.min(GALLERY_DRAW_HOLD_MS, Math.max(800, dwell - GALLERY_DRAW_MIN_MS));
    return Math.max(1, dwell - spare);
}

export function galleryDrawProgress(elapsedMs, dwellMs) {
    const drawMs = galleryDrawMs(dwellMs);
    const t = Math.min(1, Math.max(0, (Number(elapsedMs) || 0) / drawMs));
    return 1 - ((1 - t) ** 1.8);
}

export function harmonographDrawMs(dwellMs) {
    return galleryDrawMs(dwellMs);
}

export function harmonographDrawProgress(elapsedMs, dwellMs) {
    return galleryDrawProgress(elapsedMs, dwellMs);
}

// CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1). Cosine is the same
// symmetry and a close enough dissolve that explicit-t frames match the
// Chamber wall without solving a unit bezier per pixel.
export function galleryEase(t) {
    const x = Math.max(0, Math.min(1, Number(t) || 0));
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/**
 * Cadence for a gallery wall of known length. A take shorter than one
 * Chamber dwell still dissolves — it only breathes faster so a second
 * work can appear before the film ends. The dissolve never drops below
 * Gallery's gentle floor.
 */
export function galleryTimingsForDuration(durationMs, count, cadence) {
    const chamber = galleryCadenceTimings(cadence);
    const n = Math.max(0, count | 0);
    const duration = Number(durationMs);
    if (n <= 1 || !Number.isFinite(duration) || duration <= 0 || duration >= chamber.dwellMs) {
        return chamber;
    }
    const holdFloorMs = 1_500;
    const minPeriod = GALLERY_CROSSFADE_MIN_MS + holdFloorMs;
    const works = Math.max(1, Math.min(n, Math.floor(duration / minPeriod)));
    if (works <= 1) return chamber;
    const dwellMs = Math.round(duration / works);
    const crossfadeMs = Math.round(Math.max(
        GALLERY_CROSSFADE_MIN_MS,
        Math.min(
            GALLERY_CROSSFADE_MAX_MS,
            dwellMs * 0.18,
            Math.max(0, dwellMs - holdFloorMs)
        )
    ));
    return Object.freeze({ cadence: chamber.cadence, dwellMs, crossfadeMs });
}

/**
 * Continuous Field at explicit presentation time: advance every dwell,
 * dissolve over crossfade with ease-in-out, never through black. The
 * first work is already present; mix is 0 at the start of a later
 * dissolve and 1 when the incoming work is fully present.
 */
export function galleryWallAt(timeMs, count, options = {}) {
    const n = Math.max(0, count | 0);
    const { dwellMs, crossfadeMs } = galleryTimingsForDuration(
        options.durationMs,
        n,
        options.cadence
    );
    if (n === 0) {
        return Object.freeze({
            outgoingIndex: null,
            incomingIndex: null,
            mix: 0,
            dwellMs,
            crossfadeMs
        });
    }
    const t = Math.max(0, Number(timeMs) || 0);
    const fade = Math.max(1, crossfadeMs);
    const period = Math.max(1, dwellMs);
    if (n === 1) {
        return Object.freeze({
            outgoingIndex: null,
            incomingIndex: 0,
            mix: 1,
            dwellMs,
            crossfadeMs
        });
    }
    const cycle = Math.floor(t / period);
    const into = t - cycle * period;
    const incomingIndex = cycle % n;
    const mix = cycle === 0 || into >= fade ? 1 : galleryEase(into / fade);
    if (cycle === 0) {
        return Object.freeze({
            outgoingIndex: null,
            incomingIndex: 0,
            mix: 1,
            dwellMs,
            crossfadeMs
        });
    }
    return Object.freeze({
        outgoingIndex: (cycle - 1) % n,
        incomingIndex,
        mix,
        dwellMs,
        crossfadeMs
    });
}

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

/** One cue must never spend most of its authored life dissolving. */
export function authoredVisualTransition(durationMs, ceilingMs = 320) {
    const ceiling = Math.max(0, Number(ceilingMs) || 0);
    const parsed = Number(durationMs);
    if (!Number.isFinite(parsed) || parsed <= 0) return Math.round(ceiling);
    const duration = Math.max(0, parsed);
    return Math.round(Math.min(ceiling, duration * 0.2));
}

export function minimumVisualPresenceRest(value) {
    const duration = normalizeVisualPresence(value);
    return Math.max(
        VISUAL_PRESENCE_MIN_REST_MS,
        Math.round(duration * VISUAL_PRESENCE_REST_FACTOR)
    );
}
