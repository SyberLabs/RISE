/**
 * The study, held to what it promises: the questions are about what the answer
 * actually says, chance cannot be gamed by position, participants are assigned
 * in balance, and a record can only hold what the study asks.
 */
import { describe, expect, it } from 'vitest';
import { BLACK_HOLES } from '../fixtures/black-holes.js';
import {
    COMPREHENSION, CONDITION_IDS, conditionFor, newParticipantId, presentedChoices, RATINGS, RECORD_SCHEMA, SECONDARY, validateRecord
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
});
