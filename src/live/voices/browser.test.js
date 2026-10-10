/**
 * The browser voice, against a fake `speechSynthesis` on a clock the test owns.
 *
 * What is being held to: it reports start, word marks and end at the times
 * they happen; a hold silences the device without pausing the engine every
 * page shares, and takes no speaking time; the device speaks one thing at a time; a voice
 * that reports no boundaries still works; and nothing that was cancelled ever
 * reports again.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createFakeSpeech, createFakeSpeechEngine } from '../../test/fake-speech.js';
import { BROWSER_VOICE_LIMITS, chooseVoice, createBrowserVoice, voicesFor, whenVoicesAvailable } from './browser.js';

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
        fail: (id, reason) => log.push([clock.now(), 'fail', id, reason]),
        taken: (id, reason) => log.push([clock.now(), 'taken', id, reason]),
        restarted: (id, afterMs) => log.push([clock.now(), 'restarted', id, afterMs]),
        rateApplied: (id, rate) => log.push([clock.now(), 'rateApplied', id, rate])
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
    it('silences the device without pausing it, takes no speaking time, and says it again from the last word heard', async () => {
        const { clock, voice, log, synth } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);          // marks at 4 and 8 have been heard
        voice.hold();
        expect(synth.paused).toBe(false);
        expect(synth.speaking).toBe(false);
        expect(voice.playedMs('a')).toBe(8 * MS);
        await clock.advance(5_000);
        expect(voice.playedMs('a')).toBe(8 * MS);
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')).toEqual([[expect.any(Number), 'end', 'a', TEXT.length * MS]]);
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

describe('the speech engine, which every page in the browser shares', () => {
    function onEngine(engine, clock) {
        const synth = createFakeSpeech(clock, { msPerChar: MS, latencyMs: 30, engine });
        const voice = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock });
        const log = [];
        voice.attach({ start: id => log.push(['start', id]), end: id => log.push(['end', id]) });
        return { synth, voice, log };
    }

    it('speaks even when a page that went away left the engine paused', async () => {
        const clock = createVirtualClock();
        const engine = createFakeSpeechEngine();
        createFakeSpeech(clock, { engine }).pause();
        const { voice, log } = onEngine(engine, clock);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(log).toEqual([['start', 'a'], ['end', 'a']]);
    });

    it('never leaves the engine paused while it is held, so a page that goes away held leaves no silence behind', async () => {
        const clock = createVirtualClock();
        const engine = createFakeSpeechEngine();
        const { synth, voice } = onEngine(engine, clock);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold();
        expect(engine.paused).toBe(false);
        expect(synth.speaking).toBe(false);

        const next = onEngine(engine, clock);
        next.voice.enqueue({ id: 'b', text: 'the next page speaks' });
        await clock.runAll();
        expect(next.log).toEqual([['start', 'b'], ['end', 'b']]);
    });
});

describe('a hold, when something else is about to speak', () => {
    it('lets the other speak, then says the held one again from the last word heard', async () => {
        const { clock, voice, log, synth } = setup();
        const other = createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock });
        const otherLog = [];
        other.attach({ start: id => otherLog.push([clock.now(), 'start', id]), end: id => otherLog.push([clock.now(), 'end', id]) });

        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);          // marks at 4 and 8 have been heard
        voice.hold();
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
        voice.hold();
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')).toHaveLength(1);
    });

    it('does not start what is queued while it is held, and starts it after', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: 'first words' });
        await clock.advance(200);
        voice.hold();
        voice.enqueue({ id: 'b', text: 'second words' });
        await clock.advance(10_000);
        expect(kinds(log, 'start', 'b')).toEqual([]);
        voice.release();
        await clock.runAll();
        expect(kinds(log, 'start', 'b')).toHaveLength(1);
        expect(kinds(log, 'end', 'b')).toHaveLength(1);
    });
});

describe('a hold told where to take up again', () => {
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
                voice.hold({ resumeAt: at(14) });
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
                    voice.hold({ resumeAt: at(charIndex) });
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
        expect(await hold({ resumeAt: at(14) })).toBe(true);
        expect(await hold({ resumeAt: at(14) }, { boundaries: false })).toBe(true);
        // Not told, told about another segment, or nothing to say it again: no.
        expect(await hold()).toBe(false);
        expect(await hold({ resumeAt: at(14, 14 * MS, 'other') })).toBe(false);
        expect(await hold()).toBe(false);
        expect(await hold({ resumeAt: at(14) }, { speak: false })).toBe(false);
    });

    it('ignores it when it is about another segment, and says the last word heard again as it always did', async () => {
        const { clock, voice, synth } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold({ resumeAt: at(14, 14 * MS, 'other') });
        expect(voice.playedMs('a')).toBe(8 * MS);
        voice.release();
        expect(said.at(-1)).toBe(TEXT.slice(8));
    });

    it('counts the place it was told as the last word heard, so a second hold with no place says it from there again', async () => {
        const { clock, voice, synth } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold({ resumeAt: at(14) });
        voice.release();
        await clock.advance(30 + 3 * MS);
        voice.hold();
        expect(voice.playedMs('a')).toBe(14 * MS);
        voice.release();
        expect(said.at(-1)).toBe(TEXT.slice(14));
    });
});

describe('an utterance taken from outside', () => {
    // Any page's cancel() is the whole browser's (Chromium: SpeechSynthesisImpl::Cancel -> TtsController::Stop()), and
    // so is an extension's speech: the device stops this voice's utterance without this voice asking.
    for (const boundaries of [true, false]) {
        it(`is reported as taken, once, and holding afterwards does not cancel the device again (${boundaries ? 'word boundaries' : 'none'})`, async () => {
            const { clock, voice, log, synth } = setup({ boundaries });
            voice.enqueue({ id: 'a', text: TEXT });
            voice.enqueue({ id: 'b', text: 'never said yet' });
            await clock.advance(30 + 9 * MS);
            synth.cancel();
            await clock.advance(10);
            expect(kinds(log, 'taken')).toEqual([[expect.any(Number), 'taken', 'a', 'interrupted']]);
            // Nothing more is said, and no time passes for it, until it is taken up again.
            const played = voice.playedMs('a');
            await clock.advance(5_000);
            expect(synth.speaking).toBe(false);
            expect(voice.playedMs('a')).toBe(played);
            let cancels = 0;
            const cancel = synth.cancel.bind(synth);
            synth.cancel = () => { cancels += 1; cancel(); };
            voice.hold();
            expect(cancels).toBe(0);
            voice.release();
            await clock.runAll();
            expect(kinds(log, 'taken')).toHaveLength(1);
            expect(kinds(log, 'end').map(e => e[2])).toEqual(['a', 'b']);
            expect(kinds(log, 'end', 'a')[0][3]).toBe(TEXT.length * MS);
        });
    }

    it('is not reported when this voice cancelled it itself', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold();
        voice.release();
        await clock.advance(30 + 3 * MS);
        voice.cancel();
        await clock.runAll();
        expect(kinds(log, 'taken')).toEqual([]);
    });
});

describe('taking up again after a hold', () => {
    it('reports how long after it was let go the voice was heard again, once per release', async () => {
        const { clock, voice, log } = setup({ latencyAfterCancelMs: 2_000 });
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: 'the next one' });
        await clock.advance(30 + 9 * MS);
        expect(kinds(log, 'restarted')).toEqual([]);
        voice.hold();
        await clock.advance(5_000);
        voice.release();
        await clock.runAll();
        // Heard again 2 s after Play, as the slow engine starts; not for the first start, nor for the next utterance.
        expect(kinds(log, 'restarted').map(e => [e[2], e[3]])).toEqual([['a', 2_000]]);
    });
});

describe('a seek, when the reader moves the reading', () => {
    /** Every utterance the device was given. */
    function watchSpeech(synth) {
        const said = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { said.push(utterance); speak(utterance); };
        return said;
    }
    const B = 'the second passage';
    const C = 'and then the third';

    it('stops what it is saying, forgets the passage sent to and every one after it, and says them again from their starts', async () => {
        const { clock, voice, log, synth } = setup();
        const said = watchSpeech(synth);
        for (const [id, text] of [['a', TEXT], ['b', B], ['c', C]]) voice.enqueue({ id, text });
        await clock.advance(30 + 9 * MS);
        voice.seek('b');
        expect(synth.speaking).toBe(false);
        expect(() => voice.enqueue({ id: 'a', text: TEXT })).toThrow(/already queued/u);
        voice.enqueue({ id: 'b', text: B });
        voice.enqueue({ id: 'c', text: C });
        await clock.runAll();
        expect(said.slice(1).map(utterance => utterance.text)).toEqual([B, C]);
        expect(kinds(log, 'end', 'a')).toEqual([]);
        expect(kinds(log, 'end').map(e => [e[2], e[3]])).toEqual([['b', B.length * MS], ['c', C.length * MS]]);
        // Its own cancel is neither taken from outside nor a restart after a hold.
        expect(kinds(log, 'taken')).toEqual([]);
        expect(kinds(log, 'restarted')).toEqual([]);
    });

    it('says a passage it has finished again when sent back to it, and reports it begun and ended again', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: B });
        await clock.runAll();
        voice.seek('a');
        expect(voice.playedMs('a')).toBeUndefined();
        expect(voice.playedMs('b')).toBeUndefined();
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: B });
        await clock.runAll();
        expect(kinds(log, 'start').map(e => e[2])).toEqual(['a', 'b', 'a', 'b']);
        expect(voice.playedMs('a')).toBe(TEXT.length * MS);
    });

    it('says nothing while held, and the passage sent to from its start once released', async () => {
        const { clock, voice, log, synth } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: B });
        await clock.advance(30 + 9 * MS);
        voice.hold();
        voice.seek('b');
        voice.enqueue({ id: 'b', text: B });
        await clock.advance(5_000);
        expect(kinds(log, 'start', 'b')).toEqual([]);
        voice.release();
        await clock.runAll();
        expect(said.at(-1).text).toBe(B);
        expect(kinds(log, 'end').map(e => e[2])).toEqual(['b']);
    });

    it('stops what it is saying and forgets nothing when sent to a passage it was never given', async () => {
        const { clock, voice, synth } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.seek('z');
        expect(synth.speaking).toBe(false);
        expect(() => voice.enqueue({ id: 'a', text: TEXT })).toThrow(/already queued/u);
        expect(() => voice.enqueue({ id: 'z', text: B })).not.toThrow();
    });
});

describe('a change of pace', () => {
    function watchSpeech(synth) {
        const said = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { said.push(utterance); speak(utterance); };
        return said;
    }

    function countCancels(synth) {
        const counted = { n: 0 };
        const cancel = synth.cancel.bind(synth);
        synth.cancel = () => { counted.n += 1; cancel(); };
        return counted;
    }

    it('never interrupts what it is saying: that finishes at its rate, the rate lands as it ends, and the next utterance carries it', async () => {
        const { clock, voice, log, synth } = setup();
        const said = watchSpeech(synth);
        const cancels = countCancels(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: 'the next one' });
        voice.enqueue({ id: 'c', text: 'and the last' });
        await clock.advance(30 + 9 * MS);
        expect(voice.setRate(2)).toBe(false);
        expect(cancels.n).toBe(0);
        expect(synth.speaking).toBe(true);
        expect(said).toHaveLength(1);
        await clock.runAll();
        expect(said.map(utterance => [utterance.text, utterance.rate])).toEqual([[TEXT, 1], ['the next one', 2], ['and the last', 2]]);
        expect(cancels.n).toBe(0);
        // The utterance it was saying took its whole time at the old rate.
        expect(kinds(log, 'end', 'a')[0][3]).toBe(TEXT.length * MS);
        // Reported once, when nothing is said at the old rate any more: as the utterance it was saying ends.
        const aEnd = kinds(log, 'end', 'a')[0][0];
        expect(kinds(log, 'rateApplied')).toEqual([[aEnd, 'rateApplied', 'a', 2]]);
        expect(log.findIndex(e => e[1] === 'rateApplied')).toBeGreaterThan(log.findIndex(e => e[1] === 'end' && e[2] === 'a'));
        expect(log.findIndex(e => e[1] === 'rateApplied')).toBeLessThan(log.findIndex(e => e[1] === 'start' && e[2] === 'b'));
    });

    it('a voice speaking in sentences takes the new rate at its next sentence', async () => {
        const GOOGLE = { name: 'Google US English', lang: 'en-US', localService: false };
        const { clock, voice, log, synth } = setup({ boundaries: false }, { voice: GOOGLE });
        const said = watchSpeech(synth);
        const cancels = countCancels(synth);
        expect(voice.capabilities.inSentences).toBe(true);
        voice.enqueue({ id: 'a', text: 'First sentence here. Second one now.' });
        await clock.advance(30 + 5 * MS);
        voice.setRate(1.25);
        await clock.runAll();
        expect(cancels.n).toBe(0);
        expect(said.map(utterance => [utterance.text, utterance.rate])).toEqual([['First sentence here. ', 1], ['Second one now.', 1.25]]);
        expect(kinds(log, 'rateApplied').map(e => [e[2], e[3]])).toEqual([['a', 1.25]]);
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
    });

    it('says only that it speaks in sentences when it does', () => {
        expect(setup().voice.capabilities.inSentences).toBe(false);
    });

    it('stays silent when held, and takes the new rate up when released, reporting it then', async () => {
        const { clock, voice, synth, log } = setup();
        const said = watchSpeech(synth);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        voice.hold();
        const before = said.length;
        voice.setRate(0.5);
        expect(said.length).toBe(before);
        expect(synth.speaking).toBe(false);
        await clock.advance(1_000);
        expect(kinds(log, 'rateApplied')).toEqual([]);
        voice.release();
        expect(said.at(-1).rate).toBe(0.5);
        await clock.runAll();
        expect(kinds(log, 'rateApplied').map(e => [e[2], e[3]])).toEqual([['a', 0.5]]);
    });

    it('reports nothing when the rate is set back before it lands', async () => {
        const { clock, voice, log } = setup();
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: 'the next one' });
        await clock.advance(30 + 9 * MS);
        voice.setRate(1.5);
        voice.setRate(1);
        await clock.runAll();
        expect(kinds(log, 'rateApplied')).toEqual([]);
    });

    it('takes a rate at once while it is saying nothing, says so, and reports nothing later', async () => {
        const { clock, voice, log, synth } = setup();
        const said = watchSpeech(synth);
        expect(voice.setRate(1.5)).toBe(true);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(voice.setRate(2)).toBe(true);
        voice.enqueue({ id: 'b', text: 'the next one' });
        expect(voice.setRate(1)).toBe(false);
        voice.setRate(2);
        await clock.runAll();
        expect(said.map(utterance => utterance.rate)).toEqual([1.5, 2]);
        expect(kinds(log, 'rateApplied')).toEqual([]);
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
        voice.hold();
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

/** Lists shaped as each browser reports them (names, langs and flags as getVoices() gives them). */
const voice = (name, lang, { local = true, isDefault = false } = {}) => ({ name, lang, voiceURI: name, localService: local, default: isDefault });
const EDGE = [
    voice('Microsoft David - English (United States)', 'en-US', { isDefault: true }),
    voice('Microsoft Mark - English (United States)', 'en-US'),
    voice('Microsoft AvaMultilingual Online (Natural) - English (United States)', 'en-US', { local: false }),
    voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US', { local: false }),
    voice('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', { local: false }),
    voice('Microsoft Denise Online (Natural) - French (France)', 'fr-FR', { local: false })
];
// Safari says every voice is the default, and lists novelty voices beside the real ones.
const SAFARI = [
    voice('Albert', 'en-US', { isDefault: true }),
    voice('Bad News', 'en-US', { isDefault: true }),
    voice('Samantha', 'en-US', { isDefault: true }),
    voice('Daniel', 'en-GB', { isDefault: true }),
    voice('Thomas', 'fr-FR', { isDefault: true })
];
// Chrome's own Google voices are network voices that stop after 14 seconds with no callback.
const CHROME = [
    voice('Microsoft David - English (United States)', 'en-US', { isDefault: true }),
    voice('Microsoft Zira - English (United States)', 'en-US'),
    voice('Google US English', 'en-US', { local: false }),
    voice('Google UK English Female', 'en-GB', { local: false })
];
const nameOf = chosen => chosen?.name ?? null;

describe('speaking in sentences', () => {
    const GOOGLE = { name: 'Google US English', lang: 'en-US', localService: false };
    const TWO = 'First sentence here. Second one now.';

    function spoken(synth) {
        const said = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { said.push(utterance.text); speak(utterance); };
        return said;
    }

    it('says a Google voice’s segment a sentence at a time, as one utterance to whoever listens', async () => {
        const { clock, synth, voice, log } = setup({ boundaries: false }, { voice: GOOGLE });
        const said = spoken(synth);
        voice.enqueue({ id: 'a', text: TWO });
        await clock.runAll();
        expect(said).toEqual(['First sentence here. ', 'Second one now.']);
        expect(kinds(log, 'start', 'a')).toHaveLength(1);
        expect(kinds(log, 'end', 'a')).toHaveLength(1);
        // Where the second sentence begins is heard, even from a voice that reports no words.
        expect(kinds(log, 'mark', 'a').map(m => m[3])).toEqual([21]);
        expect(kinds(log, 'end', 'a')[0][3]).toBe(TWO.length * MS);
    });

    it('cuts a sentence too long for one utterance at a pause, or else between words', async () => {
        const { clock, synth, voice } = setup({ boundaries: false }, { voice: GOOGLE });
        const said = spoken(synth);
        const long = `${'word '.repeat(30)}and then, ${'more '.repeat(30)}end.`;
        voice.enqueue({ id: 'a', text: long });
        await clock.runAll();
        expect(said.join('')).toBe(long);
        for (const part of said) expect(part.length).toBeLessThanOrEqual(BROWSER_VOICE_LIMITS.utteranceChars);
        expect(said.length).toBeGreaterThan(1);
    });

    it('says a held Google voice again from the sentence it was in, not from the segment’s start', async () => {
        const { clock, synth, voice } = setup({ boundaries: false }, { voice: GOOGLE });
        const said = spoken(synth);
        voice.enqueue({ id: 'a', text: TWO });
        await clock.advance(30 + 25 * MS);
        voice.hold();
        voice.release();
        await clock.runAll();
        expect(said.at(-1)).toBe('Second one now.');
    });

    it('says any other voice’s segment whole', async () => {
        const { clock, synth, voice } = setup({}, { voice: { name: 'Microsoft David', lang: 'en-US', localService: true } });
        const said = spoken(synth);
        voice.enqueue({ id: 'a', text: TWO });
        await clock.runAll();
        expect(said).toEqual([TWO]);
    });

    it('claims to report its words only for a voice on the device, which does', () => {
        expect(setup({}, { voice: { name: 'Microsoft David', lang: 'en-US', localService: true } }).voice.capabilities.wordMarks).toBe(true);
        expect(setup({}, { voice: GOOGLE }).voice.capabilities.wordMarks).toBe(false);
        expect(setup({}, { voice: { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', localService: false } }).voice.capabilities.wordMarks).toBe(false);
        expect(setup().voice.capabilities.wordMarks).toBe(false);
    });
});

describe('choosing the voice', () => {
    it('takes a natural voice in the page’s own locale over the default, and a single-language one over a multilingual one', () => {
        expect(nameOf(chooseVoice(EDGE, 'en-US'))).toBe('Microsoft Aria Online (Natural) - English (United States)');
        expect(nameOf(chooseVoice(EDGE, 'en-GB'))).toBe('Microsoft Sonia Online (Natural) - English (United Kingdom)');
        expect(nameOf(chooseVoice(EDGE, 'fr-FR'))).toBe('Microsoft Denise Online (Natural) - French (France)');
    });

    it('takes a multilingual natural voice when it is the only natural one', () => {
        const list = EDGE.filter(v => !v.name.includes('Aria'));
        expect(nameOf(chooseVoice(list, 'en-US'))).toBe('Microsoft AvaMultilingual Online (Natural) - English (United States)');
    });

    it('falls back to the base language when no voice has the page’s locale', () => {
        expect(nameOf(chooseVoice(EDGE, 'fr-CA'))).toBe('Microsoft Denise Online (Natural) - French (France)');
        expect(nameOf(chooseVoice(EDGE, 'en'))).toBe('Microsoft Aria Online (Natural) - English (United States)');
        expect(nameOf(chooseVoice(CHROME, 'en-AU'))).toBe('Google US English');
    });

    it('reads a language written with an underscore or in another case, as Android writes it', () => {
        expect(nameOf(chooseVoice([voice('Android voice', 'en_us', { isDefault: true })], 'en-US'))).toBe('Android voice');
    });

    it('takes Chrome’s Google voice where there is no natural one, in the page’s own locale first', () => {
        expect(nameOf(chooseVoice(CHROME, 'en-US'))).toBe('Google US English');
        expect(nameOf(chooseVoice(CHROME, 'en-GB'))).toBe('Google UK English Female');
    });

    it('takes the one default voice where there is neither a natural voice nor a Google one', () => {
        expect(nameOf(chooseVoice(CHROME.filter(v => !v.name.startsWith('Google')), 'en-US'))).toBe('Microsoft David - English (United States)');
    });

    it('takes a real voice where Safari says every voice is the default, never a novelty one', () => {
        expect(nameOf(chooseVoice(SAFARI, 'en-US'))).toBe('Samantha');
        expect(chooseVoice(SAFARI, 'en-GB')).toBe(SAFARI[3]);
    });

    it('takes a voice of the page’s language even when none is marked default', () => {
        expect(nameOf(chooseVoice(CHROME.filter(v => !v.default && !v.name.startsWith('Google')), 'en-US'))).toBe('Microsoft Zira - English (United States)');
    });

    it('leaves the browser to choose when there is nothing in the page’s language, or nothing at all', () => {
        expect(chooseVoice(CHROME, 'de-DE')).toBeNull();
        expect(chooseVoice([], 'en-US')).toBeNull();
    });

    it('chooses from the list that arrives late, with voiceschanged', async () => {
        const clock = createVirtualClock();
        let voices = [];
        const listeners = new Set();
        const synth = {
            getVoices: () => voices,
            addEventListener: (_name, fn) => listeners.add(fn),
            removeEventListener: (_name, fn) => listeners.delete(fn)
        };
        const late = whenVoicesAvailable(synth, { clock });
        expect(chooseVoice(synth.getVoices(), 'en-US')).toBeNull();
        voices = EDGE;
        for (const fn of [...listeners]) fn();
        expect(nameOf(chooseVoice(await late, 'en-US'))).toBe('Microsoft Aria Online (Natural) - English (United States)');
    });
});

describe('ranking the voices by quality', () => {
    // iOS 17 with two voices downloaded in Settings, Accessibility, Spoken Content.
    const IOS = [
        voice('Samantha', 'en-US', { isDefault: true }),
        voice('Samantha (Enhanced)', 'en-US'),
        voice('Ava (Premium)', 'en-US'),
        voice('Daniel', 'en-GB')
    ];
    // Chrome on Android lists the Google engine's voices.
    const ANDROID = [voice('English United States', 'en_US', { isDefault: true }), voice('Google US English', 'en-US', { local: false })];
    // Edge on Windows: the legacy desktop voices and the online natural ones.
    const WINDOWS_EDGE = [
        voice('Microsoft David - English (United States)', 'en-US', { isDefault: true }),
        voice('Microsoft Ava Online (Natural) - English (United States)', 'en-US', { local: false })
    ];

    it('takes Premium over Enhanced over the compact default on iOS', () => {
        expect(nameOf(chooseVoice(IOS, 'en-US'))).toBe('Ava (Premium)');
        expect(nameOf(chooseVoice(IOS.filter(v => !v.name.includes('Premium')), 'en-US'))).toBe('Samantha (Enhanced)');
        expect(nameOf(chooseVoice(IOS.filter(v => v.name === 'Samantha' || v.name === 'Daniel'), 'en-US'))).toBe('Samantha');
    });

    it('reads Apple’s quality from the voice’s identifier when its name does not say it', () => {
        const apple = (name, quality) => ({ name, lang: 'en-US', localService: true, default: false, voiceURI: `com.apple.voice.${quality}.en-US.${name}` });
        expect(nameOf(chooseVoice([apple('Samantha', 'compact'), apple('Ava', 'premium'), apple('Zoe', 'enhanced')], 'en-US'))).toBe('Ava');
        expect(nameOf(chooseVoice([apple('Samantha', 'compact'), apple('Zoe', 'enhanced')], 'en-US'))).toBe('Zoe');
    });

    it('takes the Google voice on Android Chrome', () => {
        expect(nameOf(chooseVoice(ANDROID, 'en-US'))).toBe('Google US English');
    });

    it('takes the natural online voice over the legacy desktop one on Windows Edge', () => {
        expect(nameOf(chooseVoice(WINDOWS_EDGE, 'en-US'))).toBe('Microsoft Ava Online (Natural) - English (United States)');
    });

    it('takes the only voice of a browser that has one, the default', () => {
        expect(nameOf(chooseVoice([voice('Default', 'en-US', { isDefault: true })], 'en-US'))).toBe('Default');
    });

    it('ranks below plain voices the compact, eSpeak and Apple novelty voices, whatever the case', () => {
        const list = [voice('eSpeak English', 'en-US'), voice('Fred', 'en-US', { isDefault: true }), voice('Tom COMPACT', 'en-US'), voice('Nicky', 'en-US')];
        expect(nameOf(chooseVoice(list, 'en-US'))).toBe('Nicky');
        expect(nameOf(chooseVoice([voice('X', 'en-US'), voice('Y natural', 'en-US')], 'en-US'))).toBe('Y natural');
    });

    it('chooses an enhanced en-US voice on an iPhone listing 68 voices, some with underscores, never null', () => {
        const english = [
            voice('Albert', 'en-US', { isDefault: true }), voice('Bad News', 'en_US', { isDefault: true }),
            voice('Eddy (English (US))', 'en-US', { isDefault: true }), voice('Fred', 'en-US', { isDefault: true }),
            voice('Samantha', 'en-US', { isDefault: true }), voice('Samantha (Enhanced)', 'en_US', { isDefault: true }),
            voice('Nicky', 'en-US', { isDefault: true }), voice('Aaron', 'en-US', { isDefault: true }),
            voice('Daniel', 'en-GB', { isDefault: true }), voice('Arthur', 'en_GB', { isDefault: true }),
            voice('Karen', 'en-AU', { isDefault: true }), voice('Moira', 'en-IE', { isDefault: true }),
            voice('Rishi', 'en-IN', { isDefault: true }), voice('Tessa', 'en-ZA', { isDefault: true })
        ];
        const others = Array.from({ length: 68 - english.length }, (_, i) => voice(`Other ${i}`, ['fr-FR', 'de_DE', 'es-ES', 'it-IT', 'ja-JP', 'zh-CN'][i % 6], { isDefault: true }));
        const phone = [...others.slice(0, 20), ...english, ...others.slice(20)];
        expect(phone).toHaveLength(68);
        for (const lang of ['en-US', 'en_US', 'EN-us', 'en']) expect(nameOf(chooseVoice(phone, lang))).toBe('Samantha (Enhanced)');
    });

    it('honours the reader’s own voice by name, in the page’s base language, and ranks when it is not installed', () => {
        expect(nameOf(chooseVoice(IOS, 'en-US', 'Daniel'))).toBe('Daniel');
        expect(nameOf(chooseVoice(IOS, 'en-US', 'Gone voice'))).toBe('Ava (Premium)');
        expect(nameOf(chooseVoice(IOS, 'en-US', ''))).toBe('Ava (Premium)');
    });

    it('lists the voices of the page’s base language, its own locale first', () => {
        expect(voicesFor([voice('Daniel', 'en-GB'), voice('Thomas', 'fr-FR'), voice('Samantha', 'en_US')], 'en-US').map(nameOf)).toEqual(['Samantha', 'Daniel']);
        expect(voicesFor([], 'en-US')).toEqual([]);
    });
});

describe('a change of voice', () => {
    const DAVID = { name: 'Microsoft David', lang: 'en-US', localService: true };
    const ARIA = { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', localService: false };
    const GOOGLE = { name: 'Google US English', lang: 'en-US', localService: false };

    function given(synth) {
        const said = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { said.push([utterance.text, utterance.voice]); speak(utterance); };
        return said;
    }

    it('never interrupts what it is saying: the next utterance carries the new voice, and nothing is cancelled', async () => {
        const { clock, voice, synth, log } = setup({}, { voice: DAVID });
        const said = given(synth);
        let cancels = 0;
        const cancel = synth.cancel.bind(synth);
        synth.cancel = () => { cancels += 1; cancel(); };
        voice.enqueue({ id: 'a', text: TEXT });
        voice.enqueue({ id: 'b', text: 'the next one' });
        await clock.advance(30 + 9 * MS);
        expect(voice.setVoice(ARIA)).toBe(false);
        await clock.runAll();
        expect(cancels).toBe(0);
        expect(said.map(([, v]) => v)).toEqual([DAVID, ARIA]);
        expect(kinds(log, 'end', 'a')).toHaveLength(1);
        expect(voice.chosen.name).toBe(ARIA.name);
    });

    it('keeps a passage said a sentence at a time in the voice it began in', async () => {
        const { clock, voice, synth } = setup({ boundaries: false }, { voice: GOOGLE });
        const said = given(synth);
        voice.enqueue({ id: 'a', text: 'First sentence here. Second one now.' });
        voice.enqueue({ id: 'b', text: 'Then the next passage.' });
        await clock.advance(30 + 5 * MS);
        voice.setVoice(ARIA);
        await clock.runAll();
        expect(said.map(([text, v]) => [text, v.name])).toEqual([
            ['First sentence here. ', GOOGLE.name], ['Second one now.', GOOGLE.name], ['Then the next passage.', ARIA.name]
        ]);
    });

    it('holds at once while nothing is under way, and null gives the browser its default back', async () => {
        const { clock, voice, synth } = setup({}, { voice: DAVID });
        const said = given(synth);
        expect(voice.setVoice(null)).toBe(true);
        voice.enqueue({ id: 'a', text: TEXT });
        await clock.runAll();
        expect(said.map(([, v]) => v)).toEqual([null]);
        expect(voice.chosen).toEqual({ name: null, local: null });
    });

    it('speaks a Google voice chosen later a sentence at a time, and says what it can report', async () => {
        const { clock, voice, synth } = setup({ boundaries: false }, { voice: DAVID });
        const said = given(synth);
        expect(voice.capabilities.wordMarks).toBe(true);
        voice.setVoice(GOOGLE);
        expect(voice.capabilities).toMatchObject({ wordMarks: false, inSentences: true });
        voice.enqueue({ id: 'a', text: 'First sentence here. Second one now.' });
        await clock.runAll();
        expect(said.map(([text]) => text)).toEqual(['First sentence here. ', 'Second one now.']);
    });
});

describe('speaking with a chosen voice', () => {
    it('gives every utterance the voice, including one said again after a hold', async () => {
        const chosen = EDGE[3];
        const { clock, voice: speaker, synth } = setup({}, { voice: chosen });
        const given = [];
        const speak = synth.speak.bind(synth);
        synth.speak = utterance => { given.push(utterance.voice); speak(utterance); };
        speaker.enqueue({ id: 'a', text: TEXT });
        await clock.advance(30 + 9 * MS);
        speaker.hold();
        speaker.release();
        await clock.runAll();
        expect(given).toEqual([chosen, chosen]);
    });
});
