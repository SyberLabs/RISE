/**
 * From the intended condition of a passage to the imagery beneath it.
 *
 * A segment may say what it is meant to be like: tense, warm, expansive, dense,
 * energetic, solemn, new, uncertain, intimate, aroused (each 0 to 1, each
 * optional). That is the passage's intended condition. It is never a claim
 * about the reader, and nothing here reads or infers one.
 *
 * The mapping is closed and trusted. It does not choose a renderer, and it does
 * not flatten two visuals into one generic animation: it adjusts one or two
 * bounded numbers on a renderer that was already chosen (by the answer's own
 * `visual`) and leaves everything that makes it that visual, its system,
 * palette and form, alone. A dimension no renderer can express honestly is not
 * mapped and not faked; it is shown to the reader as words instead.
 *
 * | dimension           | attractor             | still | genesis |
 * |---------------------|-----------------------|-------|---------|
 * | motionEnergy        | speed 0.6 to 1.6      |       |         |
 * | perceptualDensity   | brightness 0.4 to 0.75|       |         |
 * | every other         | not mapped            |       |         |
 *
 * The ranges are narrower than the renderer's own, because the words have to
 * stay legible over the brightest, fastest strand.
 */

export const ATTRACTOR_BOUNDS = Object.freeze({
    speed: Object.freeze({ min: 0.6, max: 1.6 }),
    intensity: Object.freeze({ min: 0.4, max: 0.75 })
});

const level = value => (typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null);
const between = (bounds, x) => Math.round((bounds.min + (bounds.max - bounds.min) * x) * 1000) / 1000;

/** The bounded numbers an attractor takes from a state; empty when the state says nothing it can express. */
export function attractorConfigFor(state) {
    const config = {};
    const energy = level(state?.motionEnergy);
    const density = level(state?.perceptualDensity);
    if (energy !== null) config.speed = between(ATTRACTOR_BOUNDS.speed, energy);
    if (density !== null) config.intensity = between(ATTRACTOR_BOUNDS.intensity, density);
    return config;
}

/**
 * A visual program with the attractor cues of each passage adjusted to that
 * passage's condition. The input is not touched. A cue for any other renderer,
 * a passage with no state, and a state with nothing mapped all come back as
 * they were.
 *
 * @param {object|null} program a compiled visual program (coordinateSpace 'source')
 * @param {(sourceId: string) => object|undefined} stateOf the state of the passage with this source id
 */
export function withExperientialState(program, stateOf) {
    if (!program || !Array.isArray(program.segments)) return program;
    let changed = false;
    const segments = program.segments.map(segment => {
        const cue = segment.cue;
        if (cue?.kind !== 'field' || cue.renderer !== 'attractor') return segment;
        const sourceId = segment.match?.sourceIds?.[0];
        const mapped = sourceId === undefined ? {} : attractorConfigFor(stateOf(sourceId));
        if (Object.keys(mapped).length === 0) return segment;
        changed = true;
        return { ...segment, cue: { ...cue, config: { ...(cue.config ?? {}), ...mapped } } };
    });
    return changed ? { ...program, segments } : program;
}
