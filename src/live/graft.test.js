/**
 * The room's reading arranged around the reader's interjections (docs/plans/LIVE-CURRENT.md §17): the answer goes in
 * after the passage the reader was in, the rest waits aside while the answer is written, and the ending the model named
 * puts it back or withdraws it. What is lowered is always one valid rise.current.v2 in reading order.
 */
import { describe, expect, it } from 'vitest';
import { RISE_CURRENT_SCHEMA_V2, RISE_CURRENT_SCHEMA, compileRiseCurrent } from '../core/rise-current.js';
import { arrangeRoom, closeAnswer, cutAfter, growAnswer, lowerRoom, placeBase, runningScene, takenUp } from './graft.js';

const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';
const HELD = 'Its edge is the event horizon, past which nothing returns.';
const ROOM = Object.freeze({
    schema: RISE_CURRENT_SCHEMA_V2, id: 'answer-mock-0', title: 'Black holes', theme: 'ember',
    origin: { kind: 'model', name: 'RISE demo', provider: 'RISE' },
    scenes: [{ id: 'field', engine: 'attractor', params: { palette: 'purple' } }],
    beats: [
        { say: 'A black hole is a region of space.' },
        { hold: { ms: 1800 }, scene: 'field', cue: 'calm' },
        { say: HELD, place: 'caption', emphasis: ['horizon'] },
        { hold: { ms: 2400 }, cue: 'calm' },
        { say: 'The black hole itself stays dark.' }
    ]
});
const ANSWER = Object.freeze({
    schema: RISE_CURRENT_SCHEMA_V2, id: 'answer-mock-1', title: 'What is the horizon?', origin: ROOM.origin,
    beats: [{ say: 'The horizon is not a surface.' }, { say: 'Nothing there would stop you.' }]
});
const PICTURED = Object.freeze({
    ...ANSWER,
    scenes: [{ id: 'field', svg: FIGURE }],
    beats: [{ say: 'Picture the edge.', scene: 'field' }, { say: 'A circle you cannot leave.' }]
});

/** The room's own beats so far: the first `count` of ROOM's. */
const roomOf = count => ({ ...ROOM, beats: ROOM.beats.slice(0, count) });
const answerOf = (current, count) => ({ ...current, beats: current.beats.slice(0, count) });
const words = current => current.beats.map(beat => beat.say ?? (beat.show ? `[${beat.show}]` : '(hold)'));

/** The reader interrupted in beat 2 at `at` characters; the answer has written `count` beats. */
function interjected({ answer = ANSWER, count = answer.beats.length, at = 16 } = {}) {
    let room = arrangeRoom(ROOM.beats.length);
    const before = lowerRoom(room, { base: ROOM, answers: [] });
    room = cutAfter(room, { after: 2, taken: takenUp(ROOM.beats[2], at), running: runningScene(before.beats, 2) });
    room = growAnswer(room, 0, count);
    return { room, answers: [answerOf(answer, count)] };
}

describe('a room no one has interrupted', () => {
    it('lowers to its own answer, beat for beat, as the beats end', () => {
        expect(lowerRoom(arrangeRoom(5), { base: ROOM, answers: [] })).toEqual(ROOM);
        const growing = placeBase(arrangeRoom(2), 4);
        expect(lowerRoom(growing, { base: roomOf(4), answers: [] }).beats).toEqual(ROOM.beats.slice(0, 4));
    });
});

describe('an interjection, cut after the passage the reader was in', () => {
    it('puts the answer’s beats right after it, and holds the rest aside while the answer is written', () => {
        const { room, answers } = interjected({ count: 1 });
        expect(words(lowerRoom(room, { base: ROOM, answers }))).toEqual([ROOM.beats[0].say, '(hold)', HELD, 'The horizon is not a surface.']);
        const more = growAnswer(room, 0, 2);
        expect(words(lowerRoom(more, { base: ROOM, answers: [ANSWER] })).slice(3)).toEqual(['The horizon is not a surface.', 'Nothing there would stop you.']);
    });

    it('keeps the reading before the cut exactly as it was, so the Player keeps every atom up to the head', () => {
        const before = compileRiseCurrent(ROOM, { growing: true });
        const { room, answers } = interjected();
        const after = compileRiseCurrent(lowerRoom(room, { base: ROOM, answers }), { growing: true });
        const kept = before.atoms.filter(atom => ['beat-0', 'beat-1', 'beat-2'].includes(atom.sourceId) && !atom.seam);
        for (const atom of kept) {
            const same = after.atoms[before.atoms.indexOf(atom)];
            expect({ content: same.content, duration: same.duration, position: same.position, sourceId: same.sourceId })
                .toEqual({ content: atom.content, duration: atom.duration, position: atom.position, sourceId: atom.sourceId });
        }
    });

    it('names every beat by its place in the room, so ids stay unique across the whole run', () => {
        const { room, answers } = interjected();
        const lowered = lowerRoom(closeAnswer(room, 'resume', { sceneStarted: false }), { base: ROOM, answers });
        const ids = compileRiseCurrent(lowered, { growing: true }).atoms.map(atom => atom.sourceId).filter(Boolean);
        const order = [...new Set(ids)];
        expect(order).toEqual(lowered.beats.map((_, index) => `beat-${index}`));
    });

    it('refuses a second cut while an answer is still being written', () => {
        const { room } = interjected();
        expect(() => cutAfter(room, { after: 1, taken: null, running: null })).toThrow(RangeError);
        expect(() => cutAfter(arrangeRoom(3), { after: 3, taken: null, running: null })).toThrow(RangeError);
    });
});

describe('the ending the answer named', () => {
    it('resume: the held passage is taken up from the phrase the voice was held at, then the rest of the reading', () => {
        const { room, answers } = interjected({ at: 16 });
        const lowered = lowerRoom(closeAnswer(room, 'resume', { sceneStarted: false }), { base: ROOM, answers });
        expect(words(lowered)).toEqual([
            ROOM.beats[0].say, '(hold)', HELD, 'The horizon is not a surface.', 'Nothing there would stop you.',
            HELD.slice(16), '(hold)', 'The black hole itself stays dark.'
        ]);
        expect(lowered.beats[5]).toEqual({ say: HELD.slice(16), place: 'caption' });
    });

    it('resume after a passage heard to its end: the reading goes on at the next one, nothing said twice', () => {
        let room = arrangeRoom(5);
        room = cutAfter(room, { after: 2, taken: takenUp(ROOM.beats[2], HELD.length), running: 'field' });
        room = closeAnswer(growAnswer(room, 0, 2), 'resume', { sceneStarted: false });
        expect(words(lowerRoom(room, { base: ROOM, answers: [ANSWER] })).slice(5)).toEqual(['(hold)', 'The black hole itself stays dark.']);
    });

    it('replace and end: the rest of the reading is withdrawn, and the reading ends with the answer', () => {
        for (const ending of ['replace', 'end']) {
            const { room, answers } = interjected();
            const lowered = lowerRoom(closeAnswer(room, ending, { sceneStarted: false }), { base: ROOM, answers });
            expect(words(lowered).at(-1), ending).toBe('Nothing there would stop you.');
            expect(lowered.beats).toHaveLength(5);
        }
    });

    it('places beats the room writes while the answer is out only once it resumes, and never after a replace', () => {
        let room = arrangeRoom(3);
        room = cutAfter(room, { after: 2, taken: null, running: 'field' });
        room = growAnswer(placeBase(room, 5), 0, 2);
        expect(lowerRoom(room, { base: ROOM, answers: [ANSWER] }).beats).toHaveLength(5);
        const resumed = placeBase(closeAnswer(room, 'resume', { sceneStarted: false }), 5);
        expect(words(lowerRoom(resumed, { base: ROOM, answers: [ANSWER] })).slice(5)).toEqual(['(hold)', 'The black hole itself stays dark.']);
        const replaced = placeBase(closeAnswer(room, 'replace', { sceneStarted: false }), 5);
        expect(lowerRoom(replaced, { base: ROOM, answers: [ANSWER] }).beats).toHaveLength(5);
    });
});

describe('scenes', () => {
    it('keeps an answer’s scenes apart from the room’s, and starts the room’s again where the reading resumes', () => {
        const { room, answers } = interjected({ answer: PICTURED });
        const lowered = lowerRoom(closeAnswer(room, 'resume', { sceneStarted: true }), { base: ROOM, answers });
        expect(lowered.scenes.map(scene => scene.id)).toEqual(['field', 'i1-field']);
        expect(lowered.beats[3].scene).toBe('i1-field');
        // The tail's cue is for the room's attractor, which a figure would refuse: the taken-up passage starts it again.
        expect(lowered.beats[5]).toMatchObject({ say: HELD.slice(16), scene: 'field' });
        expect(lowered.beats[6]).toEqual({ hold: { ms: 2400 }, cue: 'calm' });
    });

    it('starts the room’s scene on the first passage of the tail when nothing is taken up', () => {
        let room = cutAfter(arrangeRoom(5), { after: 2, taken: null, running: 'field' });
        room = closeAnswer(growAnswer(room, 0, 2), 'resume', { sceneStarted: true });
        expect(lowerRoom(room, { base: ROOM, answers: [PICTURED] }).beats[5]).toEqual({ hold: { ms: 2400 }, cue: 'calm', scene: 'field' });
    });

    it('says which scene is running at a passage', () => {
        expect(runningScene(ROOM.beats, 0)).toBeNull();
        expect(runningScene(ROOM.beats, 3)).toBe('field');
    });
});

describe('a second interjection', () => {
    it('cuts the arranged reading where the reader is, and the ids are still each beat’s place', () => {
        const first = interjected();
        let room = closeAnswer(first.room, 'resume', { sceneStarted: false });
        const once = lowerRoom(room, { base: ROOM, answers: first.answers });
        room = cutAfter(room, { after: 4, taken: takenUp(once.beats[4], 0), running: runningScene(once.beats, 4) });
        const second = { ...ANSWER, beats: [{ say: 'Again: it is only a distance.' }] };
        room = closeAnswer(growAnswer(room, 1, 1), 'resume', { sceneStarted: false });
        const twice = lowerRoom(room, { base: ROOM, answers: [...first.answers, second] });
        expect(words(twice).slice(3)).toEqual([
            'The horizon is not a surface.', 'Nothing there would stop you.', 'Again: it is only a distance.',
            'Nothing there would stop you.', HELD.slice(16), '(hold)', 'The black hole itself stays dark.'
        ]);
    });
});

describe('what is taken up of the held passage', () => {
    it('is the said words from the phrase the voice was held at, with its place, size and face', () => {
        expect(takenUp(ROOM.beats[2], 0)).toEqual({ say: HELD, place: 'caption' });
        expect(takenUp({ say: 'One. Two.', size: 'larger', type: 'serif', cue: 'calm', scene: 'x', emphasis: ['One'] }, 5)).toEqual({ say: 'Two.', size: 'larger', type: 'serif' });
    });

    it('is nothing for a hold, a shown line, or a passage heard to its end', () => {
        expect(takenUp({ hold: { ms: 900 } }, 0)).toBeNull();
        expect(takenUp({ show: 'The point of no return', hold: { ms: 1600 } }, 0)).toBeNull();
        expect(takenUp({ say: 'Done.' }, 5)).toBeNull();
        expect(takenUp({ say: 'Done.' }, null)).toBeNull();
    });

    it('is the whole of a passage said one way and shown another: what is shown is not cut by what was said', () => {
        expect(takenUp({ say: 'That number is two pi.', show: '$C = 2\\pi r$' }, 8)).toEqual({ say: 'That number is two pi.', show: '$C = 2\\pi r$' });
    });
});

describe('an answer written in passages', () => {
    it('is said beat by beat, and a literal passage is left out', () => {
        const passages = {
            schema: RISE_CURRENT_SCHEMA, id: 'answer-x', title: 'x', origin: ROOM.origin,
            segments: [{ id: 'p1', text: 'In plain words.', dives: [] }, { id: 'p2', text: 'a | b', literal: true, dives: [] }]
        };
        let room = cutAfter(arrangeRoom(5), { after: 2, taken: null, running: 'field' });
        room = growAnswer(room, 0, 1);
        expect(words(lowerRoom(room, { base: ROOM, answers: [passages] })).at(-1)).toBe('In plain words.');
    });
});

describe('the bounds of one Current', () => {
    it('are the room’s too: an arrangement past them is refused, never cut silently', () => {
        const long = { ...ROOM, beats: Array.from({ length: 63 }, (_, n) => ({ say: `Passage ${n}.` })), scenes: undefined };
        delete long.scenes;
        let room = cutAfter(arrangeRoom(63), { after: 62, taken: null, running: null });
        room = growAnswer(room, 0, 2);
        expect(() => lowerRoom(room, { base: long, answers: [ANSWER] })).toThrow(expect.objectContaining({ code: 'BEAT_COUNT' }));
    });
});
