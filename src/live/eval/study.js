/**
 * The study: what is asked, and what a participant's record may hold.
 *
 * The question it exists to answer is whether a live Current is materially
 * different from text chat, from ordinary AI voice, and from voice over a
 * generic audio-reactive visualizer, in whether people understand, remember and
 * find their place in an answer. It is a claim RISE has not earned and may not
 * earn.
 *
 * DESIGN. Between participants: each person meets one condition, because
 * meeting the same answer four times would teach them the answer. The content is
 * the fixed answer in src/live/fixtures/black-holes.js in every condition; only
 * the way it is presented differs. Conditions are assigned in balance.
 *
 * MEASURES, in order of weight.
 *   primary      comprehension (right away) and delayed recall (later)
 *   secondary    evidence identification, orientation after an interruption
 *   exploratory  ratings of coherence, of the imagery informing, of the
 *                imagery decorating
 *
 * A participant's record holds a random code, their answers and ratings, and
 * what the device could do. Nothing that identifies a person, and nothing leaves
 * the device: the runner offers the record as a download.
 *
 * HAVING RUN IT is not something an agent can do. Running it with people needs
 * consent and whatever ethical review the organisation requires; this file and
 * its runner are the instrument, not the study.
 */

import { BLACK_HOLES, HORIZON_DIVE } from '../fixtures/black-holes.js';

export const RECORD_SCHEMA = 'rise.live-study-record.v1';

export const CONDITIONS = Object.freeze([
    Object.freeze({ id: 'text', label: 'Text', what: 'The whole answer as text, with its sources as notes.' }),
    Object.freeze({ id: 'spoken', label: 'Spoken', what: 'The answer spoken aloud, its sources named after each passage, with nothing to look at.' }),
    Object.freeze({ id: 'spoken-visualizer', label: 'Spoken, with a generic visualizer', what: 'The same speech, with an imagery field that pulses with the words and says nothing about their content.' }),
    Object.freeze({ id: 'rise-current', label: 'A live Current', what: 'The answer as RISE presents it: words, voice, imagery that follows the passages, and a way to ask about a place in it.' })
]);

export const CONDITION_IDS = Object.freeze(CONDITIONS.map(condition => condition.id));

/** Where the answer is interrupted: after this passage, a side answer is given, then it carries on. */
/** What a record may say about the device, and about what the participant did with it. */
export const ENVIRONMENT_FIELDS = Object.freeze(['voice', 'viewport', 'reducedMotion', 'touch', 'webgl2', 'dived']);

export const INTERRUPTION_AFTER = 'size';

const passage = id => BLACK_HOLES.segments.find(segment => segment.id === id);
const firstWords = (text, count = 9) => `${text.split(/\s+/u).slice(0, count).join(' ')}…`;
const evidenceTitle = id => BLACK_HOLES.segments.flatMap(segment => segment.evidence ?? []).find(item => item.id === id).title;

/** A question with a fixed right answer. `answer` is an index into `choices`. */
const question = (id, kind, prompt, choices, answer) => Object.freeze({ id, kind, prompt, choices: Object.freeze(choices), answer });

export const COMPREHENSION = Object.freeze([
    question('c1', 'comprehension', 'What is the event horizon?',
        ['The point of no return', 'A solid surface you could stand on', 'A ring of light around the black hole', 'The edge of the galaxy'], 0),
    question('c2', 'comprehension', 'For a black hole that does not spin, about how far from its centre is the horizon, for every solar mass?',
        ['About 3 kilometres', 'About 30 kilometres', 'About 300 kilometres', 'About 3 million kilometres'], 0),
    question('c3', 'comprehension', 'What did the 2019 Event Horizon Telescope image show?',
        ['A black hole’s shadow, in the galaxy Messier 87', 'Two black holes merging', 'Hawking radiation', 'A star being torn apart'], 0),
    question('c4', 'comprehension', 'What did detectors on Earth register in 2015?',
        ['Gravitational waves from two black holes merging', 'Light from a distant star', 'Neutrinos from the Sun', 'X-rays from a nearby galaxy'], 0),
    question('c5', 'comprehension', 'What did Hawking show in 1974?',
        ['That black holes should emit a faint glow', 'That black holes cannot exist', 'That black holes are perfectly black', 'That black holes spin ever faster'], 0),
    question('c6', 'comprehension', 'According to the answer, can anything that crosses the horizon come back out?',
        ['No, not even light', 'Yes, light can', 'Yes, if it moves fast enough', 'Only matter can'], 0)
]);

const EVIDENCE_CHOICES = Object.freeze([
    evidenceTitle('eht-2019'), evidenceTitle('ligo-2016'), evidenceTitle('hawking-1974'), 'None of these was named'
]);

const order = BLACK_HOLES.segments.map(segment => segment.id);
const after = order[order.indexOf(INTERRUPTION_AFTER) + 1];

export const SECONDARY = Object.freeze([
    question('e1', 'evidence', 'Which publication supports what the answer said about the first image of a black hole’s shadow?',
        EVIDENCE_CHOICES, 0),
    question('o1', 'orientation', 'The answer was interrupted for a side question about the horizon. When the main answer carried on, where did it carry on?',
        [firstWords(passage(after).text), firstWords(passage(INTERRUPTION_AFTER).text), firstWords(passage('what').text), firstWords(passage('hawking').text)], 0)
]);

export const RATINGS = Object.freeze([
    Object.freeze({ id: 'coherence', prompt: 'The answer felt like one coherent thing, not separate pieces.', appliesTo: CONDITION_IDS }),
    Object.freeze({ id: 'informative', prompt: 'The imagery told me something about what was being said.', appliesTo: ['spoken-visualizer', 'rise-current'] }),
    Object.freeze({ id: 'decorative', prompt: 'The imagery was mostly decoration.', appliesTo: ['spoken-visualizer', 'rise-current'] })
]);
export const RATING_SCALE = Object.freeze({ min: 1, max: 7, low: 'Strongly disagree', high: 'Strongly agree' });

/** The side answer every condition gives at the interruption, in its own form. */
export const SIDE_ANSWER = HORIZON_DIVE;
export const SIDE_QUESTION = 'dive on event horizon';

// ─── assigning and validating ───────────────────────────────────────────

/** A random code for one participant. Twelve hex characters; it names no one. */
export function newParticipantId(random = () => globalThis.crypto.getRandomValues(new Uint8Array(6))) {
    return Array.from(random(), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The condition for the nth participant, in balance: the researcher counts,
 * and every run of four covers all four in a shuffled order that is fixed by
 * `seed`, so it can be reproduced and audited.
 */
export function conditionFor(participantNumber, seed = 1) {
    if (!Number.isInteger(participantNumber) || participantNumber < 0) throw new RangeError('A participant number is a whole number from 0');
    const block = Math.floor(participantNumber / CONDITION_IDS.length);
    const shuffled = shuffle([...CONDITION_IDS], mulberry32(seed * 7919 + block));
    return shuffled[participantNumber % CONDITION_IDS.length];
}

export function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

/** A number from a string, the same every time (FNV-1a). */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/**
 * A question's choices in the order this participant sees them. The right answer
 * is not always first, and the order is fixed by the participant and the
 * question, so it can be reproduced. Each keeps its original `index`, which is
 * what a record stores.
 */
export function presentedChoices(item, seed) {
    const shown = item.choices.map((text, index) => ({ index, text }));
    return shuffle(shown, mulberry32(hash(`${seed}:${item.id}`)));
}

const isChoice = (item, value) => Number.isInteger(value) && value >= 0 && value < item.choices.length;
const isRating = value => Number.isInteger(value) && value >= RATING_SCALE.min && value <= RATING_SCALE.max;
const isTime = value => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** A record as it may be stored or analysed: strict, bounded, and nothing but what the study asks. Throws otherwise. */
export function validateRecord(input) {
    const fail = message => { throw new RangeError(`Not a study record: ${message}`); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('expected an object');
    const allowed = ['schema', 'participantId', 'condition', 'startedAt', 'finishedAt', 'answers', 'ratings', 'delayed', 'environment'];
    for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(`unknown field ${key}`);
    if (input.schema !== RECORD_SCHEMA) fail('wrong schema');
    if (typeof input.participantId !== 'string' || !/^[0-9a-f]{12}$/u.test(input.participantId)) fail('participantId');
    if (!CONDITION_IDS.includes(input.condition)) fail('condition');
    if (!isTime(input.startedAt)) fail('startedAt');
    if (input.finishedAt !== undefined && !isTime(input.finishedAt)) fail('finishedAt');

    const answers = {};
    if (input.answers !== undefined) {
        if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) fail('answers');
        for (const [key, value] of Object.entries(input.answers)) {
            const item = [...COMPREHENSION, ...SECONDARY].find(candidate => candidate.id === key);
            if (!item) fail(`unknown answer ${key}`);
            if (!isChoice(item, value)) fail(`answer ${key}`);
            answers[key] = value;
        }
    }
    const ratings = {};
    if (input.ratings !== undefined) {
        if (!input.ratings || typeof input.ratings !== 'object' || Array.isArray(input.ratings)) fail('ratings');
        for (const [key, value] of Object.entries(input.ratings)) {
            const rating = RATINGS.find(candidate => candidate.id === key);
            if (!rating || !rating.appliesTo.includes(input.condition)) fail(`rating ${key} does not apply to ${input.condition}`);
            if (!isRating(value)) fail(`rating ${key}`);
            ratings[key] = value;
        }
    }
    const clean = { schema: RECORD_SCHEMA, participantId: input.participantId, condition: input.condition, startedAt: input.startedAt, answers, ratings };
    if (input.finishedAt !== undefined) clean.finishedAt = input.finishedAt;
    if (input.delayed !== undefined) {
        const delayed = input.delayed;
        if (!delayed || typeof delayed !== 'object' || Array.isArray(delayed) || !isTime(delayed.answeredAt)) fail('delayed');
        for (const key of Object.keys(delayed)) if (!['answeredAt', 'answers'].includes(key)) fail(`unknown delayed field ${key}`);
        const late = {};
        for (const [key, value] of Object.entries(delayed.answers ?? {})) {
            const item = COMPREHENSION.find(candidate => candidate.id === key);
            if (!item || !isChoice(item, value)) fail(`delayed answer ${key}`);
            late[key] = value;
        }
        clean.delayed = { answeredAt: delayed.answeredAt, answers: late };
    }
    if (input.environment !== undefined) {
        const environment = input.environment;
        if (!environment || typeof environment !== 'object' || Array.isArray(environment)) fail('environment');
        const kept = {};
        for (const [key, value] of Object.entries(environment)) {
            if (!ENVIRONMENT_FIELDS.includes(key)) fail(`unknown environment field ${key}`);
            if (typeof value === 'string' && value.length <= 40) kept[key] = value;
            else if (typeof value === 'boolean') kept[key] = value;
            else fail(`environment ${key}`);
        }
        clean.environment = kept;
    }
    return clean;
}

// ─── scoring ───────────────────────────────────────────────────────────
