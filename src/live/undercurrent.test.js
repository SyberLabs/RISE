/**
 * The undercurrent: every Dive the reader has taken, each at one place in the
 * reading, each holding its turns. What is held: a Dive is flat and has one
 * anchor; a follow-up joins the same Dive; everything is kept after the Dive
 * is over; what is handed out cannot be used to change what is kept; and it
 * is bounded.
 */
import { describe, expect, it } from 'vitest';
import { createUndercurrent, quoteOf, UNDERCURRENT_LIMITS } from './undercurrent.js';

const ANCHOR = { segmentId: 'horizon', atCharacter: 24, quote: 'the size of the horizon' };

describe('a Dive', () => {
    it('is opened at one place, with the reader’s first question, numbered from one', () => {
        const store = createUndercurrent();
        const first = store.begin({ ...ANCHOR, question: 'what is the horizon?' });
        const second = store.begin({ ...ANCHOR, segmentId: 'later', question: 'and later?' });
        expect(first).toMatchObject({ id: 'dive-1', turn: 0 });
        expect(second.id).toBe('dive-2');
        expect(store.list()).toEqual([
            { id: 'dive-1', number: 1, anchor: ANCHOR, turns: [{ question: 'what is the horizon?', paragraphs: [], status: 'answering', error: null }] },
            { id: 'dive-2', number: 2, anchor: { ...ANCHOR, segmentId: 'later' }, turns: [{ question: 'and later?', paragraphs: [], status: 'answering', error: null }] }
        ]);
    });

    it('takes a follow-up as another turn of the same Dive, at the same anchor, never as a new Dive', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, question: 'one?' });
        expect(store.follow(id, 'two?')).toBe(1);
        expect(store.follow(id, 'three?')).toBe(2);
        expect(store.list()).toHaveLength(1);
        expect(store.list()[0].turns.map(turn => turn.question)).toEqual(['one?', 'two?', 'three?']);
        expect(store.list()[0].anchor).toEqual(ANCHOR);
    });

    it('keeps each turn’s answer as it grows, and how the turn ended', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, question: 'one?' });
        store.update(id, 0, { paragraphs: ['The horizon is'] });
        expect(store.list()[0].turns[0]).toMatchObject({ paragraphs: ['The horizon is'], status: 'answering' });
        store.update(id, 0, { paragraphs: ['The horizon is a boundary.', 'Nothing returns.'], status: 'answered' });
        store.update(id, store.follow(id, 'two?'), { status: 'failed', error: 'The provider failed' });
        store.update(id, store.follow(id, 'three?'), { status: 'cut-short', paragraphs: ['Half'] });
        expect(store.list()[0].turns.map(turn => [turn.status, turn.error, turn.paragraphs])).toEqual([
            ['answered', null, ['The horizon is a boundary.', 'Nothing returns.']],
            ['failed', 'The provider failed', []],
            ['cut-short', null, ['Half']]
        ]);
    });

    it('can be dropped, for a first question that never opened, and the others are numbered as they were', () => {
        const store = createUndercurrent();
        const a = store.begin({ ...ANCHOR, question: 'one?' });
        const b = store.begin({ ...ANCHOR, question: 'two?' });
        store.drop(b.id);
        expect(store.list().map(dive => dive.id)).toEqual([a.id]);
        expect(store.begin({ ...ANCHOR, question: 'three?' }).id).toBe('dive-3');
    });

    it('says what it does not know: an unknown Dive or turn is refused, not invented', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, question: 'one?' });
        expect(() => store.follow('dive-9', 'x')).toThrow(RangeError);
        expect(() => store.update('dive-9', 0, { status: 'answered' })).toThrow(RangeError);
        expect(() => store.update(id, 4, { status: 'answered' })).toThrow(RangeError);
        expect(() => store.update(id, 0, { status: 'made-up' })).toThrow(RangeError);
        expect(() => store.drop('dive-9')).not.toThrow();
    });
});

describe('what is handed out', () => {
    it('is a frozen copy: changing it, or what it was made from, changes nothing kept', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, question: 'one?' });
        const paragraphs = ['A'];
        store.update(id, 0, { paragraphs });
        paragraphs.push('B');
        const listed = store.list();
        expect(Object.isFrozen(listed)).toBe(true);
        expect(Object.isFrozen(listed[0].turns[0])).toBe(true);
        expect(Object.isFrozen(listed[0].turns[0].paragraphs)).toBe(true);
        expect(() => { listed[0].turns[0].question = 'changed'; }).toThrow(TypeError);
        expect(store.list()[0].turns[0]).toMatchObject({ question: 'one?', paragraphs: ['A'] });
    });

    it('is serialisable plain data, so it can be saved with a reading later', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, question: 'one?' });
        store.update(id, 0, { paragraphs: ['A'], status: 'answered' });
        expect(JSON.parse(JSON.stringify(store.list()))).toEqual(store.list());
    });
});

describe('it is bounded', () => {
    it('refuses one Dive too many and one turn too many, and says so', () => {
        const store = createUndercurrent();
        for (let i = 0; i < UNDERCURRENT_LIMITS.dives; i += 1) store.begin({ ...ANCHOR, question: `q${i}` });
        expect(() => store.begin({ ...ANCHOR, question: 'one more' })).toThrow(/at most 50 Dives/u);
        const { id } = store.list()[0];
        for (let i = 1; i < UNDERCURRENT_LIMITS.turns; i += 1) store.follow(id, `f${i}`);
        expect(() => store.follow(id, 'one more')).toThrow(/at most 20 questions/u);
    });

    it('cuts what is kept to a size: a question, a quote, and an answer', () => {
        const store = createUndercurrent();
        const { id } = store.begin({ ...ANCHOR, quote: 'q'.repeat(1_000), question: 'x'.repeat(5_000) });
        store.update(id, 0, { paragraphs: ['p'.repeat(UNDERCURRENT_LIMITS.answer), 'dropped'] });
        const dive = store.list()[0];
        expect(dive.anchor.quote.length).toBeLessThanOrEqual(UNDERCURRENT_LIMITS.quote);
        expect(dive.turns[0].question.length).toBeLessThanOrEqual(UNDERCURRENT_LIMITS.question);
        const kept = dive.turns[0].paragraphs.join('').length;
        expect(kept).toBeLessThanOrEqual(UNDERCURRENT_LIMITS.answer);
        expect(dive.turns[0].paragraphs).toHaveLength(1);
    });
});

describe('the words at a place', () => {
    const TEXT = 'A black hole is a region of space where gravity is so strong that nothing, not even light, can leave it.';

    it('is the next few words from the place, cut at a word and marked where it was cut', () => {
        expect(quoteOf(TEXT, 0, 20)).toBe('A black hole is a…');
        expect(quoteOf(TEXT, 16, 30)).toBe('a region of space where…');
        expect(quoteOf(TEXT, TEXT.indexOf('can leave'), 40)).toBe('can leave it.');
    });

    it('is the last words before the place, if there is nothing after it', () => {
        expect(quoteOf(TEXT, TEXT.length, 20)).toBe('…can leave it.');
    });

    it('is nothing for no words, and never longer than asked', () => {
        expect(quoteOf('', 0, 20)).toBe('');
        expect(quoteOf('   ', 1, 20)).toBe('');
        for (let at = 0; at <= TEXT.length; at += 7) expect(quoteOf(TEXT, at, 25).length).toBeLessThanOrEqual(25);
    });

    it('does not mind a place that is not in the text', () => {
        expect(quoteOf(TEXT, -5, 20)).toBe('A black hole is a…');
        expect(quoteOf(TEXT, 9_999, 20)).toBe('…can leave it.');
    });
});
