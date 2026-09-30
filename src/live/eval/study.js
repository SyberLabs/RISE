/**
 * The study: what is asked, how it is scored, and what may be concluded.
 *
 * The question it exists to answer is whether a live Current is materially
 * different from text chat, from ordinary AI voice, and from voice over a
 * generic audio-reactive visualizer, in whether people understand, remember and
 * find their place in an answer. It is a claim RISE has not earned and may not
 * earn. So the analysis is written to be unable to overclaim: a small group
 * cannot conclude anything, a difference that is not larger than chance is
 * reported as none, and if RISE beats the generic visualizer only in how it was
 * rated (and not in what people understood or remembered), the summary says it
 * differs in experience, which is a preference and not evidence that it helps.
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

export const STUDY_SCHEMA = 'rise.live-study.v1';
export const RECORD_SCHEMA = 'rise.live-study-record.v1';

export const CONDITIONS = Object.freeze([
    Object.freeze({ id: 'text', label: 'Text', what: 'The whole answer as text, with its sources as notes.' }),
    Object.freeze({ id: 'spoken', label: 'Spoken', what: 'The answer spoken aloud, its sources named after each passage, with nothing to look at.' }),
    Object.freeze({ id: 'spoken-visualizer', label: 'Spoken, with a generic visualizer', what: 'The same speech, with an imagery field that pulses with the words and says nothing about their content.' }),
    Object.freeze({ id: 'rise-current', label: 'A live Current', what: 'The answer as RISE presents it: words, voice, imagery that follows the passages, and a way to ask about a place in it.' })
]);

export const CONDITION_IDS = Object.freeze(CONDITIONS.map(condition => condition.id));

/** The comparison the whole study turns on. */
export const PRIMARY_CONTRAST = Object.freeze({ subject: 'rise-current', against: 'spoken-visualizer' });

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

export const MEASURES = Object.freeze({
    primary: Object.freeze(['comprehension', 'delayedRecall']),
    secondary: Object.freeze(['evidence', 'orientation']),
    exploratory: Object.freeze(['coherence', 'informative', 'decorative'])
});
export const ALL_MEASURES = Object.freeze([...MEASURES.primary, ...MEASURES.secondary, ...MEASURES.exploratory]);

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

/** Right or wrong. An unanswered question is wrong, and is not a rating. */
export function scoreAnswer(item, choice) {
    return choice === item.answer ? 1 : 0;
}

const fraction = (items, answers) => items.filter(item => answers?.[item.id] === item.answer).length / items.length;

/** A record's numbers: fractions correct from 0 to 1, ratings as given, and null for what was not asked. */
export function scoreRecord(record) {
    const answers = record.answers ?? {};
    const evidence = SECONDARY.find(item => item.id === 'e1');
    const orientation = SECONDARY.find(item => item.id === 'o1');
    return {
        comprehension: fraction(COMPREHENSION, answers),
        delayedRecall: record.delayed ? fraction(COMPREHENSION, record.delayed.answers) : null,
        evidence: scoreAnswer(evidence, answers.e1),
        orientation: scoreAnswer(orientation, answers.o1),
        coherence: record.ratings?.coherence ?? null,
        informative: record.ratings?.informative ?? null,
        decorative: record.ratings?.decorative ?? null
    };
}

// ─── analysis ──────────────────────────────────────────────────────────

/**
 * A spoken condition in which nothing was actually spoken (a silent, paced run,
 * which is what tests and devices with no voice give) measures nothing about
 * speech, and would flatter or punish the condition for no reason it can be
 * blamed for. Such a record is kept, and left out of the analysis.
 */
export function usableForAnalysis(record) {
    return record.condition === 'text' || record.environment?.voice === 'browser';
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = values => {
    if (values.length < 2) return null;
    const m = mean(values);
    return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
};
const round = (value, places = 3) => (value === null ? null : Math.round(value * 10 ** places) / 10 ** places);

/**
 * The difference in means between two independent groups, with a 95% interval
 * from resampling each group with replacement. Deterministic for a given seed.
 */
export function bootstrapDifference(a, b, { resamples = 2000, seed = 20260929 } = {}) {
    if (a.length === 0 || b.length === 0) return null;
    const random = mulberry32(seed);
    const draw = values => { let sum = 0; for (let i = 0; i < values.length; i += 1) sum += values[Math.floor(random() * values.length)]; return sum / values.length; };
    const differences = [];
    for (let i = 0; i < resamples; i += 1) differences.push(draw(a) - draw(b));
    differences.sort((x, y) => x - y);
    return {
        difference: mean(a) - mean(b),
        low: differences[Math.floor(0.025 * resamples)],
        high: differences[Math.min(resamples - 1, Math.ceil(0.975 * resamples) - 1)]
    };
}

/** The fewest participants per group before the study will say anything but that it cannot. */
export const MINIMUM_PER_GROUP = 10;

/**
 * What the records show, and only what they can.
 *
 * @param {object[]} records validated study records
 * @returns {{groups: object, contrasts: object[], conclusion: {kind: string, text: string}}}
 */
export function summarize(allRecords) {
    const records = allRecords.filter(usableForAnalysis);
    const excluded = allRecords.length - records.length;
    const scored = records.map(record => ({ condition: record.condition, scores: scoreRecord(record) }));
    const groups = {};
    for (const condition of CONDITION_IDS) {
        const mine = scored.filter(entry => entry.condition === condition);
        const measures = {};
        for (const measure of ALL_MEASURES) {
            const values = mine.map(entry => entry.scores[measure]).filter(value => value !== null);
            measures[measure] = { n: values.length, mean: values.length ? round(mean(values)) : null, sd: round(sd(values)) };
        }
        groups[condition] = { n: mine.length, measures };
    }

    const valuesOf = (condition, measure) => scored.filter(entry => entry.condition === condition).map(entry => entry.scores[measure]).filter(value => value !== null);
    const contrasts = [];
    for (const against of CONDITION_IDS.filter(id => id !== PRIMARY_CONTRAST.subject)) {
        for (const measure of ALL_MEASURES) {
            const a = valuesOf(PRIMARY_CONTRAST.subject, measure);
            const b = valuesOf(against, measure);
            if (a.length === 0 || b.length === 0) continue;
            const result = bootstrapDifference(a, b);
            contrasts.push({
                subject: PRIMARY_CONTRAST.subject, against, measure, nSubject: a.length, nAgainst: b.length,
                difference: round(result.difference), low: round(result.low), high: round(result.high),
                tier: MEASURES.primary.includes(measure) ? 'primary' : MEASURES.secondary.includes(measure) ? 'secondary' : 'exploratory'
            });
        }
    }
    return { groups, contrasts, excluded, conclusion: conclude(groups, contrasts) };
}

/** Whether the interval excludes zero on the side that favours RISE. Ratings of "decorative" favour RISE when lower. */
const favoursRise = contrast => (contrast.measure === 'decorative' ? contrast.high < 0 : contrast.low > 0);

/** The sentence the study is allowed to say. It cannot say more than the numbers do. */
function conclude(groups, contrasts) {
    const subject = groups[PRIMARY_CONTRAST.subject];
    const against = groups[PRIMARY_CONTRAST.against];
    if (subject.n < MINIMUM_PER_GROUP || against.n < MINIMUM_PER_GROUP) {
        return {
            kind: 'insufficient',
            text: `Too few participants to conclude anything: a live Current has ${subject.n} and the generic visualizer ${against.n}, and at least ${MINIMUM_PER_GROUP} in each are needed before this study will say anything but that.`
        };
    }
    const main = contrasts.filter(contrast => contrast.against === PRIMARY_CONTRAST.against);
    const objective = main.filter(contrast => contrast.tier !== 'exploratory' && favoursRise(contrast));
    const experiential = main.filter(contrast => contrast.tier === 'exploratory' && favoursRise(contrast));
    if (objective.length === 0) {
        const felt = experiential.length
            ? ` It was rated higher on ${experiential.map(contrast => contrast.measure).join(' and ')}, which is a difference in how it was experienced, not evidence that it helped anyone understand or remember more.`
            : ' Nor was it rated differently in any way that can be told from chance.';
        return {
            kind: 'no-objective-difference',
            text: `Against a spoken answer with a generic visualizer, a live Current did not measurably improve comprehension, delayed recall, evidence identification or orientation for these participants.${felt} On this evidence it differs from a generic visualizer in aesthetics and experience, not in what people took from the answer.`
        };
    }
    const wins = objective.map(contrast => `${contrast.measure} (${contrast.difference > 0 ? '+' : ''}${contrast.difference}, 95% interval ${contrast.low} to ${contrast.high})`).join('; ');
    const primaryWin = objective.some(contrast => contrast.tier === 'primary');
    return {
        kind: primaryWin ? 'primary-advantage' : 'secondary-advantage',
        text: `Against a spoken answer with a generic visualizer, a live Current scored higher on ${wins}. ${primaryWin ? 'One of these is a primary measure.' : 'None of these is a primary measure.'} Four objective measures were compared without correction for that, so one may be chance; a result this size wants repeating before it is believed.`
    };
}
