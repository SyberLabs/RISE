/**
 * Pauses inside a passage, for any voice: the passage is said in parts with a silence between, and reported as one
 * passage, so the speech governor keeps the formula on screen through its pause (docs/superpowers/specs/
 * 2026-10-26-math-both-channels-design.md §3.7). Run over the deterministic voice on a virtual clock.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createSyntheticVoice } from './synthetic.js';
import { withPauses } from './pauses.js';

const MS_PER_CHAR = 10;

function setup() {
    const clock = createVirtualClock();
    const voice = withPauses(createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 0 }), { clock });
    const events = [];
    voice.attach({
        start: id => events.push(['start', id, clock.now()]),
        mark: (id, charIndex, tMs) => events.push(['mark', id, charIndex, tMs, clock.now()]),
        end: (id, durationMs) => events.push(['end', id, durationMs, clock.now()]),
        rateApplied: (id, rate) => events.push(['rate', id, rate])
    });
    return { clock, voice, events, of: type => events.filter(event => event[0] === type) };
}

const SAID = 'Solve x equals the formula, and you are done.';
const AFTER = SAID.indexOf(' and');

describe('a passage with no pause', () => {
    it('is said as the voice says it', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: 'Plain words here.' });
        await clock.advance(10_000);
        expect(of('start')).toEqual([['start', 'p1', 0]]);
        expect(of('end')).toEqual([['end', 'p1', 17 * MS_PER_CHAR, 17 * MS_PER_CHAR]]);
    });
});

describe('a pause inside a passage', () => {
    it('is silence after the formula, and the words after it are said as one passage, later by the pause', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(10_000);
        expect(of('start')).toEqual([['start', 'p1', 0]]);
        // The voice is heard reaching the words after the pause only once the pause is over.
        const taken = of('mark').find(([, , charIndex]) => charIndex === AFTER);
        expect(taken[4]).toBe(AFTER * MS_PER_CHAR + 600);
        expect(of('mark').every(([, id]) => id === 'p1')).toBe(true);
        expect(of('end')).toEqual([['end', 'p1', SAID.length * MS_PER_CHAR + 600, SAID.length * MS_PER_CHAR + 600]]);
    });

    it('keeps the next passage waiting for it', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        voice.enqueue({ id: 'p2', text: 'Next.' });
        await clock.advance(10_000);
        expect(of('start').map(([, id, at]) => [id, at])).toEqual([['p1', 0], ['p2', SAID.length * MS_PER_CHAR + 600]]);
    });

    it('at the end of a passage, keeps what was said there before the next begins', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: 'So x.', pauses: [{ at: 5, ms: 400 }] });
        voice.enqueue({ id: 'p2', text: 'Next.' });
        await clock.advance(10_000);
        expect(of('end')[0]).toEqual(['end', 'p1', 50 + 400, 50 + 400]);
        expect(of('start')[1]).toEqual(['start', 'p2', 450]);
    });

    it('is held by a hold, and goes on for what was left of it', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(AFTER * MS_PER_CHAR + 200);
        expect(voice.hold()).toBe(false);
        await clock.advance(5_000);
        expect(of('mark').some(([, , charIndex]) => charIndex === AFTER)).toBe(false);
        voice.release();
        await clock.advance(399);
        expect(of('mark').some(([, , charIndex]) => charIndex === AFTER)).toBe(false);
        await clock.advance(1);
        expect(of('mark').some(([, , charIndex]) => charIndex === AFTER)).toBe(true);
    });

    it('is shorter at a faster pace', async () => {
        const { clock, voice, of } = setup();
        voice.setRate(2);
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(10_000);
        expect(of('mark').find(([, , charIndex]) => charIndex === AFTER)[4]).toBe(AFTER * MS_PER_CHAR / 2 + 300);
    });

    it('is played time: what has been said of the passage counts the pause as it passes', async () => {
        const { clock, voice } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(AFTER * MS_PER_CHAR + 250);
        expect(voice.playedMs('p1')).toBe(AFTER * MS_PER_CHAR + 250);
        await clock.advance(10_000);
        expect(voice.playedMs('p1')).toBe(SAID.length * MS_PER_CHAR + 600);
    });

    it('is forgotten by a seek, and the passage can be said again from its start', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(AFTER * MS_PER_CHAR + 100);
        voice.seek('p1');
        await clock.advance(5_000);
        expect(of('end')).toEqual([]);
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(10_000);
        expect(of('start').map(([, id]) => id)).toEqual(['p1', 'p1']);
        expect(of('end')).toHaveLength(1);
    });

    it('lets a cancel go: what is given next is said at once', async () => {
        const { clock, voice, of } = setup();
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(AFTER * MS_PER_CHAR + 100);
        voice.cancel();
        voice.enqueue({ id: 'p2', text: 'Next.' });
        await clock.advance(1_000);
        expect(of('end').map(([, id]) => id)).toEqual(['p2']);
    });

    it('takes up a hold where the governor says, inside the part being said', async () => {
        const clock = createVirtualClock();
        const asked = [];
        const inner = createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 0 });
        const hold = inner.hold.bind(inner);
        inner.hold = how => { asked.push(how); return hold(how); };
        const voice = withPauses(inner, { clock });
        voice.attach({});
        voice.enqueue({ id: 'p1', text: SAID, pauses: [{ at: AFTER, ms: 600 }] });
        await clock.advance(AFTER * MS_PER_CHAR + 600 + 50);
        voice.hold({ resumeAt: { segmentId: 'p1', charIndex: AFTER + 5, tMs: AFTER * MS_PER_CHAR + 600 + 50 } });
        expect(asked.at(-1).resumeAt).toEqual({ segmentId: expect.not.stringMatching(/^p1$/u), charIndex: 5, tMs: 50 });
    });
});
