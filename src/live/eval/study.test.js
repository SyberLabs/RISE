/**
 * The study, held to what it promises: the questions are about what the answer
 * actually says, chance cannot be gamed by position, participants are assigned
 * in balance, a record can only hold what the study asks, and the summary is
 * unable to say more than the numbers do.
 */
import { describe, expect, it } from 'vitest';
import { BLACK_HOLES } from '../fixtures/black-holes.js';
import {
    ALL_MEASURES, bootstrapDifference, COMPREHENSION, CONDITION_IDS, conditionFor, MINIMUM_PER_GROUP, MEASURES,
    newParticipantId, presentedChoices, RATINGS, RECORD_SCHEMA, scoreAnswer, scoreRecord, SECONDARY, summarize, usableForAnalysis, validateRecord
} from './study.js';

const answerText = BLACK_HOLES.segments.map(segment => segment.text).join(' ');

describe('the questions', () => {
    it('are about what the answer says: each right answer is stated in the fixed answer', () => {
        const states = {
            c1: 'point of no return', c2: 'three kilometres', c3: 'Messier 87', c4: 'gravitational waves', c5: 'faint glow', c6: 'not even light, can escape'
        };
        for (const item of COMPREHENSION) expect(answerText, item.id).toContain(states[item.id]);
        const evidence = SECONDARY.find(item => item.id === 'e1');
        const titles = BLACK_HOLES.segments.flatMap(segment => (segment.evidence ?? []).map(entry => entry.title));
        expect(titles).toContain(evidence.choices[evidence.answer]);
        const orientation = SECONDARY.find(item => item.id === 'o1');
        const next = BLACK_HOLES.segments.find(segment => segment.id === 'shadow').text;
        expect(next.startsWith(orientation.choices[orientation.answer].replace('…', ''))).toBe(true);
    });

    it('each have four distinct choices and one right answer that is among them', () => {
        for (const item of [...COMPREHENSION, ...SECONDARY]) {
            expect(item.choices, item.id).toHaveLength(4);
            expect(new Set(item.choices).size, item.id).toBe(4);
            expect(item.answer, item.id).toBeGreaterThanOrEqual(0);
            expect(item.answer, item.id).toBeLessThan(4);
        }
    });

    it('cannot be won by position: the order of choices is shuffled per participant and the right one is not always first', () => {
        const positions = new Set();
        for (let i = 0; i < 40; i += 1) {
            const shown = presentedChoices(COMPREHENSION[0], `participant-${i}`);
            expect([...shown.map(choice => choice.index)].sort()).toEqual([0, 1, 2, 3]);
            expect(shown.map(choice => choice.text).sort()).toEqual([...COMPREHENSION[0].choices].sort());
            positions.add(shown.findIndex(choice => choice.index === COMPREHENSION[0].answer));
        }
        expect(positions.size).toBe(4);
        expect(presentedChoices(COMPREHENSION[0], 'same')).toEqual(presentedChoices(COMPREHENSION[0], 'same'));
        expect(presentedChoices(COMPREHENSION[0], 'same')).not.toEqual(presentedChoices(COMPREHENSION[1], 'same').map(choice => ({ ...choice })));
    });

    it('score an unanswered question as wrong, and a right one as one', () => {
        const item = COMPREHENSION[0];
        expect(scoreAnswer(item, item.answer)).toBe(1);
        expect(scoreAnswer(item, 2)).toBe(0);
        expect(scoreAnswer(item, undefined)).toBe(0);
    });

    it('ask about the imagery only of the conditions that have any', () => {
        const informative = RATINGS.find(rating => rating.id === 'informative');
        expect(informative.appliesTo).toEqual(['spoken-visualizer', 'rise-current']);
        expect(RATINGS.find(rating => rating.id === 'coherence').appliesTo).toEqual(CONDITION_IDS);
    });
});

describe('assigning conditions', () => {
    it('covers all four in every block of four, whatever the seed', () => {
        for (const seed of [1, 2, 99, 20260929]) {
            for (let block = 0; block < 25; block += 1) {
                const assigned = [0, 1, 2, 3].map(offset => conditionFor(block * 4 + offset, seed));
                expect([...assigned].sort(), `seed ${seed} block ${block}`).toEqual([...CONDITION_IDS].sort());
            }
        }
    });

    it('is reproducible, varies the order between blocks, and balances a long run exactly', () => {
        expect(conditionFor(17, 5)).toBe(conditionFor(17, 5));
        const orders = new Set(Array.from({ length: 30 }, (_, block) => [0, 1, 2, 3].map(offset => conditionFor(block * 4 + offset, 3)).join()));
        expect(orders.size).toBeGreaterThan(5);
        const counts = Object.fromEntries(CONDITION_IDS.map(id => [id, 0]));
        for (let n = 0; n < 400; n += 1) counts[conditionFor(n, 3)] += 1;
        expect(Object.values(counts)).toEqual([100, 100, 100, 100]);
    });

    it('refuses a participant number that is not one', () => {
        for (const bad of [-1, 1.5, '3', null, undefined, NaN]) expect(() => conditionFor(bad)).toThrow(RangeError);
    });

    it('names a participant with a random code that names no one', () => {
        const id = newParticipantId();
        expect(id).toMatch(/^[0-9a-f]{12}$/u);
        expect(newParticipantId()).not.toBe(id);
    });
});

const good = (over = {}) => ({
    schema: RECORD_SCHEMA, participantId: 'abcdef012345', condition: 'rise-current', startedAt: '2026-09-29T10:00:00.000Z',
    answers: { c1: 0, c2: 0, c3: 1, c4: 0, c5: 2, c6: 0, e1: 0, o1: 0 },
    ratings: { coherence: 6, informative: 5, decorative: 2 },
    ...over
});

describe('a record', () => {
    it('holds what the study asks and nothing else, and is returned clean', () => {
        const record = validateRecord({ ...good(), delayed: { answeredAt: '2026-09-30T10:00:00.000Z', answers: { c1: 0, c2: 3 } }, environment: { voice: 'browser', reducedMotion: false, viewport: '1280x800' } });
        expect(record.delayed.answers).toEqual({ c1: 0, c2: 3 });
        expect(record.environment).toEqual({ voice: 'browser', reducedMotion: false, viewport: '1280x800' });
        expect(Object.keys(record).sort()).toEqual(['answers', 'condition', 'delayed', 'environment', 'participantId', 'ratings', 'schema', 'startedAt']);
    });

    it('refuses what is not part of the study, so nothing that identifies a person can be kept', () => {
        for (const bad of [
            { ...good(), name: 'A. Person' }, { ...good(), email: 'a@b.c' }, { ...good(), participantId: 'Alice Person' }, { ...good(), participantId: 'ABCDEF012345' },
            { ...good(), condition: 'other' }, { ...good(), schema: 'rise.live-study-record.v0' }, { ...good(), startedAt: 'yesterday' },
            { ...good(), answers: { c1: 4 } }, { ...good(), answers: { c1: -1 } }, { ...good(), answers: { c1: 0.5 } }, { ...good(), answers: { z9: 0 } }, { ...good(), answers: [] },
            { ...good(), ratings: { coherence: 0 } }, { ...good(), ratings: { coherence: 8 } }, { ...good(), ratings: { mood: 3 } },
            { ...good({ condition: 'text' }), ratings: { informative: 4 } },
            { ...good(), environment: { userAgent: 'x' } }, { ...good(), environment: { voice: 'x'.repeat(41) } }, { ...good(), environment: { voice: {} } },
            { ...good(), delayed: { answeredAt: 'later', answers: {} } }, { ...good(), delayed: { answeredAt: '2026-09-30T10:00:00.000Z', answers: { e1: 0 } } },
            null, 7, 'x', []
        ]) {
            expect(() => validateRecord(bad), JSON.stringify(bad)?.slice(0, 80)).toThrow(RangeError);
        }
        expect(() => validateRecord(JSON.parse('{"schema":"rise.live-study-record.v1","participantId":"abcdef012345","condition":"text","startedAt":"2026-09-29T10:00:00.000Z","__proto__":{"x":1}}'))).toThrow(RangeError);
        expect({}.x).toBeUndefined();
    });

    it('scores a record: fractions correct, ratings as given, and null for what was not asked', () => {
        const scores = scoreRecord(good());
        expect(scores).toEqual({ comprehension: 4 / 6, delayedRecall: null, evidence: 1, orientation: 1, coherence: 6, informative: 5, decorative: 2 });
        const late = scoreRecord(validateRecord({ ...good(), delayed: { answeredAt: '2026-09-30T10:00:00.000Z', answers: { c1: 0, c2: 0, c3: 0 } } }));
        expect(late.delayedRecall).toBe(3 / 6);
        expect(scoreRecord(good({ ratings: {}, answers: {} }))).toMatchObject({ comprehension: 0, evidence: 0, orientation: 0, coherence: null });
    });
});

describe('the difference between two groups', () => {
    it('is deterministic, brackets the true difference, and includes zero when there is none', () => {
        const a = Array.from({ length: 40 }, (_, i) => 0.7 + ((i * 7) % 10) / 100);
        const b = Array.from({ length: 40 }, (_, i) => 0.5 + ((i * 3) % 10) / 100);
        const result = bootstrapDifference(a, b);
        expect(result).toEqual(bootstrapDifference(a, b));
        expect(result.low).toBeLessThan(result.difference);
        expect(result.high).toBeGreaterThan(result.difference);
        expect(result.low).toBeGreaterThan(0);
        const same = bootstrapDifference(a, a);
        expect(same.low).toBeLessThanOrEqual(0);
        expect(same.high).toBeGreaterThanOrEqual(0);
        expect(bootstrapDifference([], a)).toBeNull();
    });
});

/** A group of n participants in one condition, scored by `pick`. */
function group(condition, n, pick) {
    return Array.from({ length: n }, (_, i) => {
        const { correct, ratings } = pick(i);
        const answers = {};
        COMPREHENSION.forEach((item, index) => { answers[item.id] = index < correct ? item.answer : (item.answer + 1) % 4; });
        answers.e1 = 0;
        answers.o1 = 0;
        return validateRecord({
            schema: RECORD_SCHEMA, participantId: `${condition.length.toString(16).padStart(2, '0')}${i.toString(16).padStart(10, '0')}`,
            condition, startedAt: '2026-09-29T10:00:00.000Z', answers, ratings, environment: { voice: 'browser' }
        });
    });
}

const ratingsFor = (condition, coherence, informative, decorative) => (['rise-current', 'spoken-visualizer'].includes(condition)
    ? { coherence, informative, decorative } : { coherence });

describe('a run that measured nothing about speech', () => {
    it('is kept but left out of the analysis: a spoken condition needs a voice that spoke', () => {
        const spoken = (voice, condition = 'spoken') => validateRecord({ ...good({ condition, ratings: { coherence: 4 } }), environment: { voice } });
        expect(usableForAnalysis(spoken('browser'))).toBe(true);
        expect(usableForAnalysis(spoken('paced'))).toBe(false);
        expect(usableForAnalysis(validateRecord(good({ condition: 'rise-current' })))).toBe(false);
        expect(usableForAnalysis(validateRecord(good({ condition: 'text', ratings: { coherence: 4 } })))).toBe(true);
        const mixed = [spoken('browser'), spoken('paced'), spoken('paced', 'rise-current')];
        const { excluded, groups } = summarize(mixed);
        expect(excluded).toBe(2);
        expect(groups.spoken.n).toBe(1);
        expect(groups['rise-current'].n).toBe(0);
    });
});

describe('what the study will say', () => {
    it('says it cannot say anything, and how many more it needs, when the groups are small', () => {
        const records = [
            ...group('rise-current', MINIMUM_PER_GROUP - 1, () => ({ correct: 6, ratings: ratingsFor('rise-current', 7, 7, 1) })),
            ...group('spoken-visualizer', MINIMUM_PER_GROUP, () => ({ correct: 1, ratings: ratingsFor('spoken-visualizer', 2, 2, 6) }))
        ];
        const { conclusion } = summarize(records);
        expect(conclusion.kind).toBe('insufficient');
        expect(conclusion.text).toMatch(/Too few participants/u);
        expect(conclusion.text).toContain(String(MINIMUM_PER_GROUP - 1));
        expect(summarize([]).conclusion.kind).toBe('insufficient');
    });

    it('says a live Current differs only in experience when it was rated higher and understood no more', () => {
        const records = [
            ...group('rise-current', 20, i => ({ correct: 3 + (i % 3), ratings: ratingsFor('rise-current', 6 + (i % 2), 6, 2) })),
            ...group('spoken-visualizer', 20, i => ({ correct: 3 + (i % 3), ratings: ratingsFor('spoken-visualizer', 3 + (i % 2), 3, 5) }))
        ];
        const { conclusion, contrasts } = summarize(records);
        expect(conclusion.kind).toBe('no-objective-difference');
        expect(conclusion.text).toMatch(/did not measurably improve comprehension, delayed recall, evidence identification or orientation/u);
        expect(conclusion.text).toMatch(/rated higher on .*coherence/u);
        expect(conclusion.text).toMatch(/not evidence that it helped anyone understand or remember more/u);
        expect(conclusion.text).toMatch(/aesthetics and experience/u);
        expect(contrasts.find(c => c.against === 'spoken-visualizer' && c.measure === 'comprehension').low).toBeLessThanOrEqual(0);
    });

    it('says so, plainly, when nothing at all can be told apart', () => {
        const same = condition => group(condition, 20, i => ({ correct: 3 + (i % 3), ratings: ratingsFor(condition, 4 + (i % 2), 4, 4) }));
        const { conclusion } = summarize([...same('rise-current'), ...same('spoken-visualizer')]);
        expect(conclusion.kind).toBe('no-objective-difference');
        expect(conclusion.text).toMatch(/Nor was it rated differently/u);
    });

    it('reports an advantage when there is one, names the measure, and says it is uncorrected and wants repeating', () => {
        const records = [
            ...group('rise-current', 20, i => ({ correct: 5 + (i % 2), ratings: ratingsFor('rise-current', 6, 6, 2) })),
            ...group('spoken-visualizer', 20, i => ({ correct: 2 + (i % 2), ratings: ratingsFor('spoken-visualizer', 5, 4, 3) }))
        ];
        const { conclusion } = summarize(records);
        expect(conclusion.kind).toBe('primary-advantage');
        expect(conclusion.text).toMatch(/comprehension \(\+/u);
        expect(conclusion.text).toMatch(/95% interval/u);
        expect(conclusion.text).toMatch(/without correction/u);
        expect(conclusion.text).toMatch(/repeating/u);
    });

    it('never claims what it did not test: no "proves", "significantly" or "shows that RISE"', () => {
        const texts = [
            summarize([]).conclusion.text,
            summarize([...group('rise-current', 20, () => ({ correct: 6, ratings: ratingsFor('rise-current', 7, 7, 1) })), ...group('spoken-visualizer', 20, () => ({ correct: 1, ratings: ratingsFor('spoken-visualizer', 1, 1, 7) }))]).conclusion.text
        ];
        for (const text of texts) expect(text).not.toMatch(/\bprove|significant|shows that RISE|is better than/iu);
    });

    it('reads a lower decorative rating as favouring the live Current, not a higher one', () => {
        const records = [
            ...group('rise-current', 20, () => ({ correct: 4, ratings: ratingsFor('rise-current', 4, 4, 1) })),
            ...group('spoken-visualizer', 20, () => ({ correct: 4, ratings: ratingsFor('spoken-visualizer', 4, 4, 7) }))
        ];
        const { conclusion } = summarize(records);
        expect(conclusion.text).toMatch(/decorative/u);
        const flipped = summarize([
            ...group('rise-current', 20, () => ({ correct: 4, ratings: ratingsFor('rise-current', 4, 4, 7) })),
            ...group('spoken-visualizer', 20, () => ({ correct: 4, ratings: ratingsFor('spoken-visualizer', 4, 4, 1) }))
        ]).conclusion;
        expect(flipped.text).not.toMatch(/rated higher on .*decorative/u);
    });

    it('reports per-condition n, mean and spread for every measure, and only the contrasts it can compute', () => {
        const { groups, contrasts } = summarize([
            ...group('rise-current', 12, () => ({ correct: 4, ratings: ratingsFor('rise-current', 5, 5, 3) })),
            ...group('text', 12, () => ({ correct: 5, ratings: ratingsFor('text', 5) }))
        ]);
        expect(groups['rise-current'].n).toBe(12);
        expect(groups.text.measures.comprehension.mean).toBeCloseTo(5 / 6, 3);
        expect(groups.text.measures.informative.n).toBe(0);
        expect(groups.spoken.n).toBe(0);
        expect(contrasts.every(contrast => contrast.against === 'text')).toBe(true);
        expect(contrasts.some(contrast => contrast.measure === 'informative')).toBe(false);
        expect(ALL_MEASURES).toEqual([...MEASURES.primary, ...MEASURES.secondary, ...MEASURES.exploratory]);
    });
});
