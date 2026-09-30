/**
 * The browser voice, against a fake `speechSynthesis` on a clock the test owns.
 *
 * What is being held to: it reports start, word marks and end at the times
 * they happen; a hold takes no speaking time, whether it is a pause or the
 * exclusive kind a Dive needs; the device speaks one thing at a time; a voice
 * that reports no boundaries still works; and nothing that was cancelled ever
 * reports again.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createFakeSpeech } from '../../test/fake-speech.js';
import { createBrowserVoice, whenVoicesAvailable } from './browser.js';

const TEXT = 'one two three four five six seven';
const MS = 50;

function setup(speechOptions = {}, voiceOptions = {}) {
    const clock = createVirtualClock();
    const synth = createFakeSpeech(clock, { msPerChar: MS, latencyMs: 30, ...speechOptions });
    const voice = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock, ...voiceOptions });
    const log = [];
    voice.attach({
        start: id => log.push([clock.now(), 'start', id]),
        mark: (id, charIndex, tMs) => log.push([clock.now(), 'mark', id, charIndex, tMs]),
        end: (id, durationMs) => log.push([clock.now(), 'end', id, durationMs]),
        fail: (id, reason) => log.push([clock.now(), 'fail', id, reason])
    });
    return { clock, synth, voice, log };
}

const kinds = (log, kind, id) => log.filter(e => e[1] === kind && (id === undefined || e[2] === id));

describe('speaking', () => {
    it('reports the start after the device’s latency, a mark at each word after the first, and the end', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(log[0]).toEqual([30, 'start', 'a']);
        const marks = kinds(log, 'mark', 'a');
        expect(marks.map(m => m[3])).toEqual([4, 8, 14, 19, 24, 28]);
        for (const [at, , , charIndex, tMs] of marks) {
            expect(tMs).toBe(charIndex * MS);
            expect(at).toBe(30 + charIndex * MS);
        }
        expect(log.at(-1)).toEqual([30 + TEXT.length * MS, 'end', 'a', TEXT.length * MS]);
    });

    it('says one utterance after another, each starting once and ending once', async () => {
        const { clock, voice, log } = setup();
        for (const id of ['a', 'b', 'c']) voice.enqueue({ id, text: TEXT });
        await clock.runAll();
        for (const id of ['a', 'b', 'c']) {
            expect(kinds(log, 'start', id)).toHaveLength(1);
            expect(kinds(log, 'end', id)).toHaveLength(1);
        }
        const order = log.filter(e => e[1] === 'start' || e[1] === 'end').map(e => `${e[1]}:${e[2]}`);
        expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
    });

    it('reports how much has been spoken, and nothing before it began', async () => {
        const { clock, voice } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        expect(voice.playedMs('a')).toBeUndefined();
        expect(voice.playedMs('nope')).toBeUndefined();
        await clock.advance(30 + 200);
        expect(voice.playedMs('a')).toBe(200);
        await clock.runAll();
        expect(voice.playedMs('a')).toBe(TEXT.length * MS);
    });

    it('works with a voice that never reports a word boundary', async () => {
        const { clock, voice, log } = setup({ boundaries: false });
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(kinds(log, 'mark')).toEqual([]);
        expect(kinds(log, 'start')).toHaveLength(1);
        expect(kinds(log, 'end')[0][3]).toBe(TEXT.length * MS);
    });

    it('refuses what it cannot say, and a name it already has', () => {
        const { voice } = setup();
        expect(() => voice.enqueue({ id: 'a', text: '  ' })).toThrow(RangeError);
        expect(() => voice.enqueue({ id: '', text: 'x' })).toThrow(RangeError);
        voice.enqueue({ id: 'a', text: 'ok' });
        expect(() => voice.enqueue({ id: 'a', text: 'again' })).toThrow(/already/u);
    });

    it('reports a voice that fails, and carries on with the next utterance', async () => {
        const { clock, voice, log, synth } = setup({ failWith: 'synthesis-failed' });
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: TEXT });
        await clock.runAll();
        expect(kinds(log, 'fail').map(e => [e[2], e[3]])).toEqual([['a', 'synthesis-failed'], ['b', 'synthesis-failed']]);
        expect(kinds(log, 'end')).toEqual([]);
        expect(synth.speaking).toBe(false);
    });

    it('does not let a throwing listener stop it', async () => {
        const clock = createVirtualClock();
        const synth = createFakeSpeech(clock);
        const voice = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock });
        const ended = [];
        voice.attach({ start() { throw new Error('closed'); }, end: id => ended.push(id) });
        voice.enqueue({ id: 'a', text: 'hello there' });
        await clock.runAll();
        expect(ended).toEqual(['a']);
    });

    it('needs a synthesiser and its utterance', () => {
        expect(() => createBrowserVoice({})).toThrow(TypeError);
        expect(() => createBrowserVoice({ speech: { synth: {} } })).toThrow(TypeError);
    });
});

describe('a hold, when the reader pauses', () => {
    it('pauses the device and takes no speaking time; later times shift by exactly the hold', async () => {
        const free = setup();
        free.voice.enqueue({ id: 'a', text: TEXT });
        await free.clock.runAll();

        const { clock, voice, log, synth } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 195);
        voice.hold();
        expect(synth.paused).toBe(true);
        expect(voice.playedMs('a')).toBe(195);
        await clock.advance(5_000);
        expect(voice.playedMs('a')).toBe(195);
        voice.release();
        expect(synth.paused).toBe(false);
        await clock.runAll();

        const shifted = free.log.map(e => (e[0] >= 30 + 195 ? [e[0] + 5_000, ...e.slice(1)] : e));
        expect(log).toEqual(shifted);
    });

    it('can be held before anything has begun, and holding twice does no harm', async () => {
        const { clock, voice, log } = setup();
        voice.hold();
        voice.hold();
        voice.enqueue({ id: 'a', text: 'hello there' });
        await clock.advance(2_000);
        expect(log).toEqual([]);
        voice.release();
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start')[0][0]).toBe(2_030);
        expect(kinds(log, 'end')).toHaveLength(1);
    });
});

describe('an exclusive hold, when something else is about to speak', () => {
    it('lets the other speak, then says the held one again from the last word heard', async () => {
        const { clock, voice, log, synth } = setup();
        const other = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock });
        const otherLog = [];
        other.attach({ start: id => otherLog.push([clock.now(), 'start', id]), end: id => otherLog.push([clock.now(), 'end', id]) });

        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);          // marks at 4 and 8 have been heard
        voice.hold({ exclusive: true });
        const before = log.length;
        expect(synth.speaking).toBe(false);
        expect(voice.playedMs('a')).toBe(8 * MS);

        other.enqueue({ id: 'side', text: 'a short aside' });
        await clock.runAll();
        expect(otherLog.map(e => e[1])).toEqual(['start', 'end']);
        expect(log.length).toBe(before);

        voice.release();
        await clock.runAll();
        const remarks = kinds(log, 'mark', 'a').map(m => m[3]);
        expect(remarks).toEqual([4, 8, 14, 19, 24, 28]);
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')[0][3]).toBe(TEXT.length * MS);
    });

    it('restarts a segment from its beginning when the voice never reported a boundary', async () => {
        const { clock, voice, log } = setup({ boundaries: false });
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 200);
        voice.hold({ exclusive: true });
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')).toHaveLength(1);
    });

    it('can upgrade a pause to an exclusive hold', async () => {
        const { clock, voice, synth } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 120);
        voice.hold();
        expect(synth.paused).toBe(true);
        voice.hold({ exclusive: true });
        expect(synth.paused).toBe(false);
        expect(synth.speaking).toBe(false);
        voice.release();
        await clock.runAll();
        expect(voice.playedMs('a')).toBe(TEXT.length * MS);
    });

    it('does not start what is queued while it is held, and starts it after', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: 'first words' });
        await clock.advance(200);
        voice.hold({ exclusive: true });
        voice.enqueue({ id: 'b', text: 'second words' });
        await clock.advance(10_000);
        expect(kinds(log, 'start', 'b')).toEqual([]);
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start', 'b')).toHaveLength(1);
        expect(kinds(log, 'end', 'b')).toHaveLength(1);
    });
});

describe('an exclusive hold told where to take up again', () => {
    /** Every utterance the device was given, so a test can say what was said again and from where. */
    function watchSpeech(synth) {
        const said = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { said.push(utterance.text); speak(utterance); };
        return said;
    }
    const at = (charIndex, tMs = charIndex * MS, segmentId = 'a') => ({ segmentId, charIndex, tMs });

    for (const boundaries of [true, false]) {
        describe(boundaries ? 'a voice that reports boundaries' : 'a voice that reports none', () => {
            it('says the segment again from the character it was told, not from its last word or its start, in the same time', async () => {
                const { clock, voice, log, synth } = setup({ boundaries });
                const said = watchSpeech(synth);
                voice.enqueue({ id: 'a', text: TEXT });
                await clock.advance(30 + 9 * MS);
                voice.hold();
                voice.hold({ exclusive: true, resumeAt: at(14) });
                expect(voice.playedMs('a')).toBe(14 * MS);
                voice.release();
                await clock.runAll();
                expect(said.at(-1)).toBe(TEXT.slice(14));
                expect(kinds(log, 'start', 'a')).toHaveLength(1);
                expect(kinds(log, 'end', 'a')).toEqual([[expect.any(Number), 'end', 'a', TEXT.length * MS]]);
                if (boundaries) expect(kinds(log, 'mark', 'a').map(m => m[3]).filter(charIndex => charIndex > 8)).toEqual([14, 19, 24, 28].filter(charIndex => charIndex > 14));
            });

            it('can take up earlier than the last word heard, and later', async () => {
                for (const charIndex of [4, 24]) {
                    const { clock, voice, synth } = setup({ boundaries });
                    const said = watchSpeech(synth);
                    voice.enqueue({ id: 'a', text: TEXT });
                    await clock.advance(30 + 9 * MS);
                    voice.hold({ exclusive: true, resumeAt: at(charIndex) });
                    voice.release();
                    await clock.runAll();
                    expect(said.at(-1), String(charIndex)).toBe(TEXT.slice(charIndex));
                }
            });
        });
    }

    it('says whether it took up the place it was told, so what shows the words can begin the same phrase again', async () => {
        const hold = async (how, { speak = true, boundaries = true } = {}) => {
            const { clock, voice } = setup({ boundaries });
            if (speak) { voice.enqueue({ id: 'a', text: TEXT }); await clock.advance(30 + 9 * MS); }
            return voice.hold(how);
        };
        expect(await hold({ exclusive: true, resumeAt: at(14) })).toBe(true);
        expect(await hold({ exclusive: true, resumeAt: at(14) }, { boundaries: false })).toBe(true);
        // Not told, told something unusable, told for a hold that only pauses, or nothing to say it again: no.
        expect(await hold({ exclusive: true })).toBe(false);
        expect(await hold({ exclusive: true, resumeAt: at(-1) })).toBe(false);
        expect(await hold({ exclusive: true, resumeAt: at(14, 14 * MS, 'other') })).toBe(false);
        expect(await hold({ resumeAt: at(14) })).toBe(false);
        expect(await hold()).toBe(false);
        expect(await hold({ exclusive: true, resumeAt: at(14) }, { speak: false })).toBe(false);
    });

    it('ignores it when it is about another segment, or names a place that is not in this one, or a time that is not a time', async () => {
        for (const hint of [at(14, 14 * MS, 'other'), at(-1), at(1.5), at(TEXT.length), at(TEXT.length + 5), at('14'), at(NaN), at(undefined),
            at(14, -5), at(14, NaN), at(14, '700'), at(14, Infinity), null, undefined, 'text', 5, {}]) {
            const { clock, voice, synth } = setup();
            const said = watchSpeech(synth);
            voice.enqueue({ id: 'a', text: TEXT });
            await clock.advance(30 + 9 * MS);
            voice.hold({ exclusive: true, resumeAt: hint });
            // As it always did: said again from the last word heard.
            expect(voice.playedMs('a'), JSON.stringify(hint)).toBe(8 * MS);
            voice.release();
            expect(said.at(-1), JSON.stringify(hint)).toBe(TEXT.slice(8));
        }
    });

    it('does nothing with it for a hold that is only a pause, and does not speak again on release', async () => {
        const { clock, voice, synth } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold({ resumeAt: at(14) });
        voice.release();
        expect(said).toEqual([TEXT]);
    });

    it('is harmless when nothing is being said', () => {
        const { voice } = setup();
        expect(() => { voice.hold({ exclusive: true, resumeAt: at(14) }); voice.release(); }).not.toThrow();
    });

    it('counts the place it was told as the last word heard, so a second hold with no place says it from there again', async () => {
        const { clock, voice, synth } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold({ exclusive: true, resumeAt: at(14) });
        voice.release();
        await clock.advance(30 + 3 * MS);
        voice.hold({ exclusive: true });
        expect(voice.playedMs('a')).toBe(14 * MS);
        voice.release();
        expect(said.at(-1)).toBe(TEXT.slice(14));
    });
});

describe('stopping', () => {
    for (const cancelReports of ['error', 'end']) {
        it(`never reports again after a cancel, whether the browser reports it as ${cancelReports === 'error' ? 'an error' : 'an end'}`, async () => {
            const { clock, voice, log, synth } = setup({ cancelReports });
            voice.enqueue({ id: 'a', text: TEXT });
            voice.enqueue({ id: 'b', text: 'never said' });
            await clock.advance(30 + 100);
            const before = log.length;
            voice.cancel();
            await clock.advance(60_000);
            expect(log.length).toBe(before);
            expect(synth.speaking).toBe(false);
            expect(clock.pending()).toBe(0);
            voice.enqueue({ id: 'c', text: 'fresh start' });
            await clock.runAll();
            expect(kinds(log, 'end', 'c')).toHaveLength(1);
        });
    }

    it('closes for good, and safely twice', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(100);
        voice.close();
        voice.close();
        expect(() => voice.enqueue({ id: 'b', text: 'x' })).toThrow(/closed/u);
        const before = log.length;
        await clock.advance(60_000);
        expect(log.length).toBe(before);
        expect(clock.pending()).toBe(0);
    });

    it('cancelling while held leaves the device usable', async () => {
        const { clock, voice, synth } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(100);
        voice.hold({ exclusive: true });
        voice.cancel();
        expect(synth.paused).toBe(false);
        expect(synth.speaking).toBe(false);
    });
});

describe('waiting for the browser to have voices', () => {
    it('answers at once when there already are some', async () => {
        const clock = createVirtualClock();
        const synth = { getVoices: () => [{ name: 'a' }] };
        expect(await whenVoicesAvailable(synth, { clock })).toHaveLength(1);
    });

    it('answers when the list arrives, and gives up after the timeout when it never does', async () => {
        const clock = createVirtualClock();
        let voices = [];
        const listeners = new Set();
        const synth = {
            getVoices: () => voices,
            addEventListener: (_name, fn) => listeners.add(fn),
            removeEventListener: (_name, fn) => listeners.delete(fn)
        };
        const late = whenVoicesAvailable(synth, { clock, timeoutMs: 800 });
        voices = [{ name: 'a' }, { name: 'b' }];
        for (const fn of [...listeners]) fn();
        expect(await late).toHaveLength(2);
        expect(clock.pending()).toBe(0);

        voices = [];
        const never = whenVoicesAvailable(synth, { clock, timeoutMs: 800 });
        await clock.advance(800);
        expect(await never).toEqual([]);
        expect(listeners.size).toBe(0);
    });
});
