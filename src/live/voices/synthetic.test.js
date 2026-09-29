/**
 * The deterministic voice.
 *
 * It says queued utterances one after another at a fixed rate, on a clock the
 * test owns, and reports where it has got to: start, marks at word boundaries,
 * end. Above all it can be HELD. A Dive holds the voice, and everything after
 * the hold must be later by exactly the hold and no more: played time is the
 * only time the voice knows.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createSyntheticVoice } from './synthetic.js';

function setup(options = {}) {
    const clock = createVirtualClock();
    const log = [];
    const voice = createSyntheticVoice({ clock, msPerChar: 10, breathMs: 100, ...options });
    voice.attach({
        start: id => log.push([clock.now(), 'start', id]),
        mark: (id, charIndex, tMs) => log.push([clock.now(), 'mark', id, charIndex, tMs]),
        end: (id, durationMs) => log.push([clock.now(), 'end', id, durationMs])
    });
    return { clock, voice, log };
}

const TEXT = 'one two three four five six seven';

describe('speaking', () => {
    it('reports the start, the marks at word boundaries, and the end, at the times they happen', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(log[0]).toEqual([0, 'start', 'a']);
        const marks = log.filter(entry => entry[1] === 'mark');
        expect(marks.length).toBeGreaterThan(1);
        for (const [at, , , charIndex, tMs] of marks) {
            expect(tMs).toBe(charIndex * 10);
            expect(at).toBe(tMs);
            expect(TEXT[charIndex - 1]).toBe(' ');
        }
        expect(log.at(-1)).toEqual([TEXT.length * 10, 'end', 'a', TEXT.length * 10]);
    });

    it('never marks past the words, or at the very start', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        for (const entry of log.filter(e => e[1] === 'mark')) {
            expect(entry[3]).toBeGreaterThan(0);
            expect(entry[3]).toBeLessThan(TEXT.length);
        }
    });

    it('says queued utterances in order, with a breath between them', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: 'first words' });
        voice.enqueue({ id: 'b', text: 'second words' });
        await clock.runAll();
        const at = (kind, id) => log.find(e => e[1] === kind && e[2] === id)[0];
        expect(at('start', 'a')).toBe(0);
        expect(at('end', 'a')).toBe(110);
        expect(at('start', 'b')).toBe(210);
        expect(at('end', 'b')).toBe(210 + 120);
    });

    it('starts at once when something is queued while it is idle, and later ones follow', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: 'short' });
        await clock.runAll();
        await clock.advance(5_000);
        const idleUntil = clock.now();
        voice.enqueue({ id: 'b', text: 'later' });
        await clock.runAll();
        expect(log.find(e => e[1] === 'start' && e[2] === 'b')[0]).toBe(idleUntil);
    });

    it('reports how much of an utterance has been played', async () => {
        const { clock, voice } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        expect(voice.playedMs('a')).toBe(0);
        expect(voice.playedMs('nope')).toBeUndefined();
        await clock.advance(120);
        expect(voice.playedMs('a')).toBe(120);
        await clock.runAll();
        expect(voice.playedMs('a')).toBe(TEXT.length * 10);
    });

    it('refuses an utterance with nothing to say, or with no name', () => {
        const { voice } = setup();
        expect(() => voice.enqueue({ id: 'a', text: '   ' })).toThrow(RangeError);
        expect(() => voice.enqueue({ id: '', text: 'x' })).toThrow(RangeError);
        expect(() => voice.enqueue({ id: 'a', text: 'ok' })).not.toThrow();
        expect(() => voice.enqueue({ id: 'a', text: 'again' })).toThrow(/already/u);
    });

    it('is the same every time', async () => {
        const run = async () => {
            const { clock, voice, log } = setup();
            voice.enqueue({ id: 'a', text: TEXT });
            voice.enqueue({ id: 'b', text: 'and more' });
            await clock.runAll();
            return log;
        };
        expect(await run()).toEqual(await run());
    });
});

describe('being held', () => {
    it('stops played time, and everything after is later by exactly the hold', async () => {
        const free = setup();
        free.voice.enqueue({ id: 'a', text: TEXT });
        await free.clock.runAll();

        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(95);
        voice.hold();
        expect(voice.playedMs('a')).toBe(95);
        await clock.advance(5_000);
        expect(voice.playedMs('a')).toBe(95);
        voice.release();
        await clock.runAll();

        const shifted = free.log.map(entry => (entry[0] >= 95 ? [entry[0] + 5_000, ...entry.slice(1)] : entry));
        expect(log).toEqual(shifted);
    });

    it('reports nothing while it is held', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(10);
        voice.hold();
        const before = log.length;
        await clock.advance(60_000);
        expect(log.length).toBe(before);
        expect(clock.pending()).toBe(0);
    });

    it('can be held again, and again, and loses nothing', async () => {
        const free = setup();
        free.voice.enqueue({ id: 'a', text: TEXT });
        await free.clock.runAll();
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(50);
        voice.hold(); await clock.advance(1_000); voice.release();
        await clock.advance(50);
        voice.hold(); await clock.advance(2_000); voice.release();
        await clock.runAll();
        expect(log.filter(e => e[1] === 'mark').map(e => e[4])).toEqual(free.log.filter(e => e[1] === 'mark').map(e => e[4]));
        expect(log.at(-1)[0]).toBe(free.log.at(-1)[0] + 3_000);
    });

    it('can be held before it has begun, and holds the breath between utterances too', async () => {
        const { clock, voice, log } = setup();
        voice.hold();
        voice.enqueue({ id: 'a', text: 'hello there' });
        await clock.advance(1_000);
        expect(log).toEqual([]);
        voice.release();
        await clock.runAll();
        expect(log[0]).toEqual([1_000, 'start', 'a']);

        const breath = setup();
        breath.voice.enqueue({ id: 'a', text: 'ab' });
        breath.voice.enqueue({ id: 'b', text: 'cd' });
        await breath.clock.advance(50);          // a ended at 20; in the breath
        breath.voice.hold();
        await breath.clock.advance(1_000);
        breath.voice.release();
        await breath.clock.runAll();
        expect(breath.log.find(e => e[1] === 'start' && e[2] === 'b')[0]).toBe(1_120); // 50 in, 70 of the breath left, plus the 1,000 held
    });

    it('holding or releasing twice does no harm', async () => {
        const { clock, voice } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        voice.hold(); voice.hold();
        await clock.advance(100);
        voice.release(); voice.release();
        await clock.runAll();
        expect(voice.playedMs('a')).toBe(TEXT.length * 10);
    });
});

describe('stopping', () => {
    it('cancels what remains: no more reports, no timers, and a fresh queue afterwards', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: 'never said' });
        await clock.advance(55);
        voice.cancel();
        const before = log.length;
        await clock.advance(60_000);
        expect(log.length).toBe(before);
        expect(clock.pending()).toBe(0);
        voice.enqueue({ id: 'c', text: 'fresh start' });
        await clock.runAll();
        expect(log.some(e => e[2] === 'c' && e[1] === 'end')).toBe(true);
        expect(log.some(e => e[2] === 'b')).toBe(false);
    });

    it('closes for good', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(20);
        voice.close();
        voice.close();
        expect(() => voice.enqueue({ id: 'b', text: 'x' })).toThrow(/closed/u);
        const before = log.length;
        await clock.advance(60_000);
        expect(log.length).toBe(before);
        expect(clock.pending()).toBe(0);
    });

    it('is not broken by a report that throws', async () => {
        const clock = createVirtualClock();
        const voice = createSyntheticVoice({ clock, msPerChar: 10, breathMs: 100 });
        const seen = [];
        voice.attach({
            start: () => { throw new Error('the connection closed'); },
            mark: () => {},
            end: id => seen.push(id)
        });
        voice.enqueue({ id: 'a', text: 'hello' });
        await clock.runAll();
        expect(seen).toEqual(['a']);
    });
});
