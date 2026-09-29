/**
 * A fixed, honest answer for the deterministic provider and for the
 * comparison harness.
 *
 * The facts are correct and each source is a real publication with its real
 * identifier. Evidence is never invented, even in a mock: a fixture that made
 * up a citation would teach every test that provenance is decoration.
 *
 * Nothing here is executable. It is data a provider adapter turns into events.
 */

/** A Dive anchor over `phrase`, found in `text`, exactly as `rise.current.v1` wants it. */
function anchorOver(text, phrase) {
    const from = text.indexOf(phrase);
    if (from < 0 || text.indexOf(phrase, from + 1) >= 0) {
        throw new Error(`The fixture phrase must occur exactly once: ${phrase}`);
    }
    return { fromCharacter: from, toCharacter: from + phrase.length, quoteStart: phrase, quoteEnd: phrase };
}

const s1 = 'A black hole is a region of space where gravity is so strong that nothing, not even light, can escape once it is inside.';
const s2 = 'Its boundary is called the event horizon. It is not a surface you could touch. It is the point of no return.';
const s3 = 'For a black hole that does not spin, the horizon lies about three kilometres from the centre for every solar mass.';
const s4 = 'In 2019, the Event Horizon Telescope collaboration published the first image of a black hole\'s shadow, in the galaxy Messier 87.';
const s5 = 'In 2015, detectors on Earth registered gravitational waves from two black holes merging, more than a billion light years away.';
const s6 = 'In 1974, Stephen Hawking showed that black holes are not perfectly black. They should emit a faint glow, now called Hawking radiation.';

export const BLACK_HOLES = Object.freeze({
    title: 'Black holes',
    origin: Object.freeze({ kind: 'model', name: 'Scripted answer', provider: 'mock' }),
    segments: Object.freeze([
        {
            id: 'what', text: s1, visual: 'attractor',
            state: { solemnity: 0.4, expansiveness: 0.5, tension: 0.3 }
        },
        {
            id: 'horizon', text: s2, visual: 'still',
            state: { tension: 0.65, solemnity: 0.6 },
            dives: [{
                id: 'horizon-note',
                text: 'Outside observers never see anything cross it. A traveller falling in notices nothing special at the moment of crossing.',
                anchor: anchorOver(s2, 'event horizon.')
            }]
        },
        {
            id: 'size', text: s3, visual: 'still',
            state: { perceptualDensity: 0.3, novelty: 0.2, uncertainty: 0.1 }
        },
        {
            id: 'shadow', text: s4, visual: 'genesis',
            state: { expansiveness: 0.8, warmth: 0.3, novelty: 0.6 },
            evidence: [{
                id: 'eht-2019', kind: 'supplied',
                title: 'First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole',
                location: 'The Astrophysical Journal Letters 875, L1 (2019)',
                uri: 'https://doi.org/10.3847/2041-8213/ab0ec7'
            }]
        },
        {
            id: 'waves', text: s5, visual: 'attractor',
            state: { motionEnergy: 0.7, arousal: 0.6, novelty: 0.5 },
            evidence: [{
                id: 'ligo-2016', kind: 'supplied',
                title: 'Observation of Gravitational Waves from a Binary Black Hole Merger',
                location: 'Physical Review Letters 116, 061102 (2016)',
                uri: 'https://doi.org/10.1103/PhysRevLett.116.061102'
            }]
        },
        {
            id: 'hawking', text: s6, visual: 'still',
            state: { warmth: 0.4, uncertainty: 0.5, intimacy: 0.3 },
            evidence: [{
                id: 'hawking-1974', kind: 'supplied',
                title: 'Black hole explosions?',
                location: 'Nature 248, 30 to 31 (1974)',
                uri: 'https://doi.org/10.1038/248030a0'
            }],
            dives: [{
                id: 'hawking-note',
                text: 'This was a theoretical prediction. Hawking radiation has not been observed from an astrophysical black hole.',
                anchor: anchorOver(s6, 'Hawking radiation.')
            }]
        }
    ])
});

/** What a Dive on the horizon says: a short Current of its own. */
export const HORIZON_DIVE = Object.freeze({
    title: 'The event horizon',
    origin: Object.freeze({ kind: 'model', name: 'Scripted answer', provider: 'mock' }),
    segments: Object.freeze([
        {
            id: 'speed', visual: 'still',
            text: 'The event horizon is where the speed needed to escape reaches the speed of light.',
            state: { tension: 0.5, solemnity: 0.5 }
        },
        {
            id: 'direction', visual: 'attractor',
            text: 'Inside it, every path through spacetime leads inward. It is less a wall than a direction.',
            state: { tension: 0.7, expansiveness: 0.3 }
        }
    ])
});

/** A Dive on something the demonstration does not know: it says so, and says nothing else. */
export const UNKNOWN_DIVE = Object.freeze({
    title: 'Not prepared',
    origin: Object.freeze({ kind: 'model', name: 'Scripted answer', provider: 'mock' }),
    segments: Object.freeze([
        {
            id: 'none', visual: 'still',
            text: 'This demonstration has no prepared answer for that.',
            state: { uncertainty: 0.8 }
        }
    ])
});

/** When the prompt asks about something else entirely. */
export const UNKNOWN_ANSWER = Object.freeze({
    title: 'Not prepared',
    origin: Object.freeze({ kind: 'model', name: 'Scripted answer', provider: 'mock' }),
    segments: Object.freeze([
        {
            id: 'none', visual: 'still',
            text: 'This demonstration can only explain black holes.',
            state: { uncertainty: 0.8 }
        }
    ])
});

/**
 * The scripted answer for a request. The question decides. The place a Dive was
 * taken from only disambiguates a question that points at it ("dive on this").
 */
export function scriptFor(request) {
    const asked = request.prompt.toLowerCase();
    const pointing = /\b(this|that|it|here|there)\b/u.test(asked);
    const said = pointing ? `${asked} ${(request.parent?.context ?? []).join(' ').toLowerCase()}` : asked;
    if (request.intent === 'dive') {
        if (/horizon/u.test(said)) return HORIZON_DIVE;
        return UNKNOWN_DIVE;
    }
    if (/black\s*holes?/u.test(said)) return BLACK_HOLES;
    return UNKNOWN_ANSWER;
}
