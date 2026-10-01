/**
 * What can be said, in words, about the Dives the reader has taken: where they
 * are, where each was taken from, and how each question ended. Pure; the
 * controls draw it with textContent only.
 */
import { describe, expect, it } from 'vitest';
import { describeCrumb, describeDive, describeTurn, forksBySegment } from './undercurrent.js';

const turn = (question, extra = {}) => ({ question, paragraphs: [], status: 'answered', error: null, ...extra });
const dive = (number, segmentId, atCharacter, quote, turns) => ({ id: `dive-${number}`, number, anchor: { segmentId, atCharacter, quote }, turns });

const DIVES = [
    dive(1, 'horizon', 42, 'It is not a surface you could touch.', [turn('what is the horizon?'), turn('and beyond it?')]),
    dive(2, 'what', 10, 'a region of space where gravity…', [turn('why is gravity strong?')]),
    dive(3, 'horizon', 4, 'boundary is called the event horizon.', [turn('what is a boundary?')])
];

describe('the breadcrumb', () => {
    it('says where the reader is and where Surface goes back to, using the latest question', () => {
        expect(describeCrumb({ id: 'dive-1', turns: 2, opening: false }, DIVES)).toEqual({
            trail: 'Main › Dive 1: “and beyond it?”',
            returnsTo: 'Surface returns to: “It is not a surface you could touch.”'
        });
    });

    it('is nothing outside a Dive, or for a Dive that is not there', () => {
        expect(describeCrumb(null, DIVES)).toBeNull();
        expect(describeCrumb({ id: 'dive-9', turns: 1, opening: false }, DIVES)).toBeNull();
    });

    it('says nothing about a place it has no words for, rather than quoting nothing', () => {
        const bare = [dive(1, 'a', 0, '', [turn('why?')])];
        expect(describeCrumb({ id: 'dive-1', turns: 1, opening: false }, bare)).toEqual({ trail: 'Main › Dive 1: “why?”', returnsTo: 'Surface returns to where you left the reading.' });
    });

    it('clips a long question', () => {
        const long = [dive(1, 'a', 0, 'x', [turn('q'.repeat(500))])];
        expect(describeCrumb({ id: 'dive-1', turns: 1, opening: false }, long).trail.length).toBeLessThan(120);
    });
});

describe('the fork markers', () => {
    it('are grouped by the passage a Dive was taken from, in the order of the places', () => {
        const forks = forksBySegment(DIVES);
        expect([...forks.keys()].sort()).toEqual(['horizon', 'what']);
        expect(forks.get('horizon').map(fork => fork.id)).toEqual(['dive-3', 'dive-1']);
        expect(forks.get('what').map(fork => fork.id)).toEqual(['dive-2']);
    });

    it('say which Dive, and what was first asked', () => {
        expect(forksBySegment(DIVES).get('what')[0]).toEqual({ id: 'dive-2', label: 'Dive 2: “why is gravity strong?”' });
    });

    it('are none when there are no Dives', () => {
        expect(forksBySegment([]).size).toBe(0);
    });
});

describe('a Dive in the panel', () => {
    it('is named by its number, its first question and where it was taken from, with how many questions it holds', () => {
        expect(describeDive(DIVES[0])).toEqual({
            title: 'Dive 1: “what is the horizon?”',
            place: 'Taken from “It is not a surface you could touch.”',
            count: '2 questions'
        });
        expect(describeDive(DIVES[1]).count).toBe('1 question');
    });
});

describe('how a question ended', () => {
    it('is said for every ending, and a hostile message stays words', () => {
        expect(describeTurn(turn('q', { status: 'answered' }))).toBe('');
        expect(describeTurn(turn('q', { status: 'answering' }))).toBe('Being written…');
        expect(describeTurn(turn('q', { status: 'cut-short' }))).toBe('Cut short. What was written is kept.');
        expect(describeTurn(turn('q', { status: 'failed', error: 'The provider failed' }))).toBe('Could not be answered: The provider failed.');
        expect(describeTurn(turn('q', { status: 'failed', error: null }))).toBe('Could not be answered.');
        expect(describeTurn(turn('q', { status: 'made-up' }))).toBe('');
    });
});
