/**
 * Canonical policy for Rhythmic visual presence.
 *
 * Keep every public limit and perceptual tier here so persisted settings,
 * semantic response, playback, safety, and the UI cannot drift apart.
 */

export const VISUAL_PRESENCE_MIN_MS = 150;
export const VISUAL_PRESENCE_DEFAULT_MS = 200;

// The interlocution presentation surfaces. 'full-frame' cuts to an
// opaque overlay; 'behind-stream' flashes beneath the reading; 'continuous'
// (Gallery) is a persistent crossfading field behind the reading
// (CONTINUOUS-FIELD-SPEC). 'continuous-word' is the same field projected
// into Word ink — one clock, two mounts. Shared here so persisted
// settings, the session compiler, the panel, and playback cannot drift
// apart.
const PRESENTATION_SURFACES = Object.freeze([
    'full-frame',
    'behind-stream',
    'continuous',
    'continuous-word'
]);

/**
 * THE PRODUCTION KILL SWITCH FOR FLASHING. One boolean, one place.
 *
 * RISE renders moving light, and flashing light is the only thing in this
 * product that can physically hurt someone. The engineering around it is
 * careful — an effective ceiling of 2.5 Hz against WCAG's 3 Hz, duty capped at
 * 45% of any twelve seconds, a fail-closed consent gate — but careful is not
 * the same as absent, and a risk that cannot be taken is worth more than a
 * risk that is well managed.
 *
 * While this is false, no reachable state can put a flashing surface on the
 * screen: `normalizePresentation` refuses one whatever it is handed, including
 * a composition saved when they were offered, a hand-edited import, and any
 * value nobody has thought of. The surfaces remain in the tree and the engine
 * still knows how to draw them, so this is one edit to reverse — and
 * `flashing-disabled.test.js` states, in one place, everything that changes
 * when somebody does.
 */
export const FLASHING_ENABLED = false;

/** What a flashing surface becomes. Gallery never flashes and never blacks. */
export const SAFE_PRESENTATION = 'continuous';

/** Whether a surface shows brief high-contrast exposures between readings. */
export function presentationFlashes(value) {
    return !isContinuousPresentation(value);
}

/**
 * AN UNRECOGNISED SURFACE RESOLVES TO THE ONE THAT DOES NOT FLASH.
 *
 * This used to fall through to 'full-frame' — the surface that cuts to an
 * opaque overlay — so a typo, a corrupted setting or a renamed value became
 * the MOST flashing presentation the system has. Two things were wrong with
 * that. Safety rested entirely on the launch gate noticing and raising the
 * photosensitivity notice, with nothing standing behind it; and the retired
 * alias `gallery-in-the-word` — someone asking for Gallery, which never
 * flashes — landed on full-frame, the exact opposite of what they chose.
 *
 * Gallery is the safe resolution on both counts: it never flashes and never
 * goes black, so an unknown value can no longer become a risk the reader did
 * not ask for. The launch gate still treats an *unstated* presentation as
 * flashing, and that remains the defence for any config that never passed
 * through here.
 */
export function normalizePresentation(value) {
    const known = PRESENTATION_SURFACES.includes(value) ? value : SAFE_PRESENTATION;
    // The refusal is here rather than at each caller because this is the one
    // door every stored, imported and authored value already comes through.
    return FLASHING_ENABLED || !presentationFlashes(known) ? known : SAFE_PRESENTATION;
}

export function isContinuousPresentation(value) {
    return value === 'continuous' || value === 'continuous-word';
}

export function isGalleryInTheWord(value) {
    return value === 'continuous-word';
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
const GALLERY_DWELL_MIN_MS = 8_000;
const GALLERY_DWELL_MAX_MS = 30_000;
const GALLERY_CROSSFADE_MIN_MS = 1_200;
const GALLERY_CROSSFADE_MAX_MS = 2_500;

export function normalizeGalleryCadence(value) {
    const parsed = Number(value);
    const cadence = Number.isFinite(parsed) ? parsed : GALLERY_CADENCE_DEFAULT;
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

function galleryCadenceRole(value) {
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
const GALLERY_DRAW_HOLD_MS = 2_500;
const GALLERY_DRAW_MIN_MS = 4_000;

function galleryDrawMs(dwellMs) {
    const dwell = Math.max(1, Number(dwellMs) || GALLERY_DWELL_MIN_MS);
    const spare = Math.min(GALLERY_DRAW_HOLD_MS, Math.max(800, dwell - GALLERY_DRAW_MIN_MS));
    return Math.max(1, dwell - spare);
}

function figureEase(elapsedMs, drawMs) {
    const span = Math.max(1, Number(drawMs) || 0);
    const t = Math.min(1, Math.max(0, (Number(elapsedMs) || 0) / span));
    return 1 - ((1 - t) ** 1.8);
}

export function galleryDrawProgress(elapsedMs, dwellMs) {
    return figureEase(elapsedMs, galleryDrawMs(dwellMs));
}

export function harmonographDrawProgress(elapsedMs, dwellMs) {
    return galleryDrawProgress(elapsedMs, dwellMs);
}

/**
 * Figure-draw progress at score time. `drawMs` finishes the pen early
 * and holds; omitted keeps Gallery's dwell (the visual run).
 */
export function scoredFigureProgress(elapsedMs, runDurationMs, drawMs) {
    const draw = Number(drawMs);
    if (Number.isFinite(draw) && draw > 0) return figureEase(elapsedMs, draw);
    return galleryDrawProgress(
        elapsedMs,
        Number(runDurationMs) > 0
            ? runDurationMs
            : galleryCadenceTimings(GALLERY_CADENCE_DEFAULT).dwellMs
    );
}

/**
 * One scored figure: draw, then hold. After the hold, the next episode
 * starts at local elapsed 0 so a new seed can begin a new pen.
 */
export function figureEpisodeAt(elapsedMs, drawMs, holdMs) {
    const elapsed = Math.max(0, Number(elapsedMs) || 0);
    const draw = Number(drawMs);
    const hold = Number(holdMs);
    if (!(Number.isFinite(draw) && draw > 0) || !(Number.isFinite(hold) && hold >= 0)) {
        return Object.freeze({ index: 0, elapsedMs: elapsed });
    }
    const episodeMs = draw + hold;
    const index = Math.floor(elapsed / episodeMs);
    return Object.freeze({
        index,
        elapsedMs: elapsed - index * episodeMs
    });
}

export function figureEpisodeSeed(seed, episodeIndex) {
    const index = Math.max(0, episodeIndex | 0);
    const base = seed == null ? '' : String(seed);
    return index === 0 ? base : `${base}:figure:${index}`;
}

// CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1). Cosine is the same
// symmetry and a close enough dissolve that explicit-t frames match the
// Chamber wall without solving a unit bezier per pixel.
function galleryEase(t) {
    const x = Math.max(0, Math.min(1, Number(t) || 0));
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/**
 * Cadence for a gallery wall of known length. A take shorter than one
 * Chamber dwell still dissolves — it only breathes faster so a second
 * work can appear before the film ends. The dissolve never drops below
 * Gallery's gentle floor.
 */
function galleryTimingsForDuration(durationMs, count, cadence) {
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
    if (cycle === 0) {
        return Object.freeze({
            outgoingIndex: null,
            incomingIndex: 0,
            mix: 1,
            dwellMs,
            crossfadeMs
        });
    }
    const into = t - cycle * period;
    return Object.freeze({
        outgoingIndex: (cycle - 1) % n,
        incomingIndex: cycle % n,
        mix: into >= fade ? 1 : galleryEase(into / fade),
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
const VISUAL_PRESENCE_MIN_REST_MS = 250;
const VISUAL_PRESENCE_REST_FACTOR = 1.25;

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

function visualPresenceRole(value) {
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

/**
 * Scale the user's base flash probability by passage arousal.
 * The configured frequency is a hard ceiling (it is what the user consented
 * to in the safety flow): peak intensity (a=1) reaches exactly the base,
 * calm text (a=0) drops to 0.35× base.
 *
 * This is `responsiveVisualPresence`'s pair — one shapes how long a
 * presence holds, the other how often one lands — and it lived in
 * conductor.js next to a 39 KB sentiment lexicon it does not use. Player
 * needs these four lines and was pulling the lexicon into the main bundle
 * to get them. conductor.js still re-exports it for its own callers.
 */
export function responsiveFrequency(baseFrequency, signal) {
    if (!signal) return baseFrequency;
    const energy = Math.max(0, Math.min(1, Number(signal.arousal) || 0));
    const scaled = baseFrequency * (0.35 + 0.65 * energy);
    return Math.max(0, Math.min(baseFrequency, scaled));
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
