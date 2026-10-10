/**
 * The interjection's state machine (docs/plans/LIVE-CURRENT.md §17): the reader speaks while the reading plays, the
 * voice holds, the question goes up, RISE answers inside the room and names how the reading goes on.
 */
import { describe, expect, it } from 'vitest';
import { INTERJECTION_ENDINGS, endingOf, interjectionStep } from './interjection.js';

const STATES = ['none', 'held', 'asking', 'answering'];
const EVENTS = [
    { type: 'begin' }, { type: 'ask' }, { type: 'answer' }, { type: 'end', ending: 'resume' },
    { type: 'cancel' }, { type: 'fail', reason: 'EMPTY_ANSWER' }
];

/** Every transition the machine makes; every other pair leaves the state as it was. */
const MOVES = {
    none: { begin: 'held' },
    held: { ask: 'asking', cancel: 'none' },
    asking: { answer: 'answering', cancel: 'none', fail: 'none' },
    answering: { end: 'none', fail: 'none' }
};

describe('the interjection, step by step', () => {
    it('makes exactly the moves of the plan, and no other', () => {
        for (const state of STATES) {
            for (const event of EVENTS) {
                expect(interjectionStep(state, event), `${state} + ${event.type}`).toBe(MOVES[state][event.type] ?? state);
            }
        }
    });

    it('goes the whole way round: held at the boundary, asked, answered, ended', () => {
        let state = 'none';
        for (const event of [{ type: 'begin' }, { type: 'ask' }, { type: 'answer' }, { type: 'end', ending: 'replace' }]) state = interjectionStep(state, event);
        expect(state).toBe('none');
    });

    it('gives the held reading back when the reader cancels before an answer, or the request fails', () => {
        expect(interjectionStep('held', { type: 'cancel' })).toBe('none');
        expect(interjectionStep('asking', { type: 'cancel' })).toBe('none');
        expect(interjectionStep('asking', { type: 'fail', reason: 'OPEN_FAILED' })).toBe('none');
    });

    it('does not cancel an answer already playing: it is part of the reading, under the reader’s controls', () => {
        expect(interjectionStep('answering', { type: 'cancel' })).toBe('answering');
    });

    it('ignores what it does not know, and a state it does not know is none', () => {
        expect(interjectionStep('held', { type: 'shout' })).toBe('held');
        expect(interjectionStep('held', null)).toBe('held');
        expect(interjectionStep('sideways', { type: 'begin' })).toBe('held');
    });
});

describe('the ending', () => {
    it('is one of three, named by the model', () => {
        expect(INTERJECTION_ENDINGS).toEqual(['resume', 'replace', 'end']);
        for (const ending of INTERJECTION_ENDINGS) expect(endingOf(ending)).toBe(ending);
    });

    it('is resume when the model names none, or names something else', () => {
        for (const named of [null, undefined, '', 'stop', 'RESUME', 3]) expect(endingOf(named)).toBe('resume');
    });
});
