import { describe, expect, it, vi } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createProviderVoice } from './provider-tts.js';

const SAMPLE_RATE = 22050;

/** An AudioContext whose sources end on the virtual clock, at the buffer's length over the playback rate. */
function fakeContext(clock) {
    const sources = [];
    return {
        sources,
        destination: { connected: 0 },
        createBuffer: (channels, length, sampleRate) => ({ channels, length, sampleRate, duration: length / sampleRate, copyToChannel: vi.fn() }),
        createBufferSource() {
            const source = {
                buffer: null, playbackRate: { value: 1 }, onended: null, startedAt: null, offset: 0, stopped: false,
                connect: vi.fn(),
                start(when, offset = 0) {
                    source.startedAt = clock.now();
                    source.offset = offset;
                    const remainingMs = ((source.buffer.duration - offset) / source.playbackRate.value) * 1000;
                    source.cancelEnd = clock.setTimer(() => { if (!source.stopped) source.onended?.(); }, Math.max(0, remainingMs));
                },
                stop() { source.stopped = true; source.cancelEnd?.(); }
            };
            sources.push(source);
            return source;
        }
    };
}

/** A provider that answers after `latencyMs` with `msPerChar` of audio per character and a mark per word. */
function fakeSpeech(clock, { latencyMs = 300, msPerChar = 50, speedTaken = rate => Math.min(1.2, Math.max(0.7, rate)), fail = null } = {}) {
    const calls = [];
    return {
        id: 'fake-provider',
        name: 'Fake voice',
        chars: 0,
        calls,
        speak(text, { rate = 1, signal } = {}) {
            calls.push({ text, rate });
            return new Promise((resolve, reject) => {
                const cancel = clock.setTimer(() => {
                    if (fail?.(text)) { reject(Object.assign(new Error(fail(text)), { code: 'REFUSED' })); return; }
                    this.chars += text.length;
                    const durationMs = text.length * msPerChar;
                    const marks = [...text.matchAll(/\S+/gu)].map(m => m.index).filter(i => i > 0).map(charIndex => ({ charIndex, tMs: charIndex * msPerChar }));
                    resolve({ samples: new Float32Array(Math.round((durationMs / 1000) * SAMPLE_RATE)), sampleRate: SAMPLE_RATE, marks, durationMs, speed: speedTaken(rate), chars: text.length, exact: true });
                }, latencyMs);
                signal?.addEventListener?.('abort', () => { cancel(); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
            });
        }
    };
}

function setUp(options = {}) {
    const clock = createVirtualClock(0);
    const context = fakeContext(clock);
    const speech = fakeSpeech(clock, options);
    const voice = createProviderVoice({ speech, context, clock });
    const heard = [];
    voice.attach({
        start: id => heard.push({ at: clock.now(), kind: 'start', id }),
        mark: (id, charIndex, tMs) => heard.push({ at: clock.now(), kind: 'mark', id, charIndex, tMs }),
        end: (id, durationMs) => heard.push({ at: clock.now(), kind: 'end', id, durationMs }),
        fail: (id, message) => heard.push({ at: clock.now(), kind: 'fail', id, message }),
        rateApplied: (id, rate) => heard.push({ at: clock.now(), kind: 'rate', id, rate })
    });
    return { clock, context, speech, voice, heard };
}

const tick = (clock, ms) => clock.advance(ms);

describe('the provider voice', () => {
    it('fetches a passage, begins it when the samples arrive, marks every word at its heard time, and ends it', async () => {
        const { clock, voice, heard, context } = setUp({ latencyMs: 300 });
        voice.enqueue({ id: 'p1', text: 'One two three.' });
        await tick(clock, 299);
        expect(heard).toEqual([]);
        await tick(clock, 1);
        expect(heard).toEqual([{ at: 300, kind: 'start', id: 'p1' }]);
        expect(voice.speakingId()).toBe('p1');
        expect(context.sources[0].playbackRate.value).toBe(1);
        await tick(clock, 200);
        expect(heard.at(-1)).toEqual({ at: 500, kind: 'mark', id: 'p1', charIndex: 4, tMs: 200 });
        expect(voice.playedMs('p1')).toBe(200);
        await tick(clock, 500);
        expect(heard.at(-1)).toEqual({ at: 1000, kind: 'end', id: 'p1', durationMs: 700 });
        expect(voice.playedMs('p1')).toBe(700);
        expect(voice.speakingId()).toBe(null);
        expect(voice.usage.chars).toBe(14);
    });

    it('fetches the next passage while this one plays, so the next begins as this one ends', async () => {
        const { clock, voice, heard, speech } = setUp({ latencyMs: 300 });
        voice.enqueue({ id: 'p1', text: 'First.' });
        voice.enqueue({ id: 'p2', text: 'Second.' });
        await tick(clock, 300);
        expect(speech.calls.map(call => call.text)).toEqual(['First.', 'Second.']);
        await tick(clock, 300);
        expect(heard.map(event => `${event.kind}:${event.id}`)).toEqual(['start:p1', 'end:p1', 'start:p2']);
    });

    it('holds exactly where it is and takes up from the same place; told where, it takes up there', async () => {
        const { clock, voice, heard, context } = setUp({ latencyMs: 0 });
        voice.enqueue({ id: 'p1', text: 'One two three four five.' });
        await tick(clock, 0);
        await tick(clock, 450);
        expect(voice.hold()).toBe(false);
        expect(context.sources[0].stopped).toBe(true);
        await tick(clock, 5000);
        expect(voice.playedMs('p1')).toBe(450);
        expect(heard.filter(e => e.kind === 'end')).toEqual([]);
        voice.release();
        expect(context.sources[1].offset).toBeCloseTo(0.45, 3);
        await tick(clock, 750);
        expect(heard.at(-1)).toEqual({ at: 6200, kind: 'end', id: 'p1', durationMs: 1200 });
        voice.enqueue({ id: 'p2', text: 'Six seven eight nine.' });
        await tick(clock, 0);
        await tick(clock, 300);
        expect(voice.hold({ resumeAt: { segmentId: 'p2', charIndex: 4, tMs: 200 } })).toBe(true);
        voice.release();
        expect(context.sources.at(-1).offset).toBeCloseTo(0.2, 3);
        expect(heard.filter(e => e.kind === 'start')).toHaveLength(2);
    });

    it('a seek forgets the passage and the ones after, and a replay plays from what was fetched without a second request', async () => {
        const { clock, voice, heard, speech } = setUp({ latencyMs: 100 });
        voice.enqueue({ id: 'p1', text: 'First one.' });
        voice.enqueue({ id: 'p2', text: 'Second one.' });
        await tick(clock, 100);
        await tick(clock, 200);
        voice.seek('p1');
        expect(voice.speakingId()).toBe(null);
        voice.enqueue({ id: 'p1', text: 'First one.' });
        await tick(clock, 1);
        expect(speech.calls.filter(call => call.text === 'First one.')).toHaveLength(1);
        expect(heard.filter(e => e.kind === 'start' && e.id === 'p1')).toHaveLength(2);
    });

    it('a rate set while a passage plays lands at the next, fetched at the provider speed with playback making up the rest', async () => {
        const { clock, voice, heard, speech, context } = setUp({ latencyMs: 0 });
        voice.enqueue({ id: 'p1', text: 'One two.' });
        await tick(clock, 0);
        expect(voice.setRate(1.5)).toBe(false);
        voice.enqueue({ id: 'p2', text: 'Three four.' });
        await tick(clock, 400);
        expect(speech.calls.at(-1)).toEqual({ text: 'Three four.', rate: 1.5 });
        const second = context.sources.at(-1);
        expect(second.playbackRate.value).toBeCloseTo(1.5 / 1.2, 6);
        // As the browser voice does (#590): the rate lands when nothing is said at the old one any more, at p1's end.
        expect(heard.find(e => e.kind === 'rate')).toEqual({ at: 400, kind: 'rate', id: 'p1', rate: 1.5 });
        await tick(clock, 250);
        const marks = heard.filter(e => e.kind === 'mark' && e.id === 'p2');
        expect(marks[0]).toEqual({ at: 640, kind: 'mark', id: 'p2', charIndex: 6, tMs: 240 });
    });

    it('a passage the provider refuses fails with the provider’s reason, and the next is said', async () => {
        const { clock, voice, heard } = setUp({ latencyMs: 10, fail: text => (text.startsWith('Bad') ? 'ElevenLabs refused this request for that key.' : null) });
        voice.enqueue({ id: 'p1', text: 'Bad passage.' });
        voice.enqueue({ id: 'p2', text: 'Good passage.' });
        await tick(clock, 10);
        await tick(clock, 10);
        expect(heard[0]).toEqual({ at: 10, kind: 'fail', id: 'p1', message: 'ElevenLabs refused this request for that key.' });
        expect(heard[1]).toMatchObject({ kind: 'start', id: 'p2' });
    });

    it('cancel stops the sound and aborts a fetch under way; close refuses more', async () => {
        const { clock, voice, speech, context } = setUp({ latencyMs: 500 });
        voice.enqueue({ id: 'p1', text: 'Hello there.' });
        await tick(clock, 100);
        voice.cancel();
        await tick(clock, 1000);
        expect(context.sources).toHaveLength(0);
        expect(voice.speakingId()).toBe(null);
        voice.close();
        expect(() => voice.enqueue({ id: 'p9', text: 'x' })).toThrow(RangeError);
        expect(speech.calls).toHaveLength(1);
    });

    it('claims word marks, says it is not on the device, and names the provider', () => {
        const { voice } = setUp();
        expect(voice.capabilities).toEqual({ audible: true, wordMarks: true, inSentences: false });
        expect(voice.chosen).toEqual({ name: 'Fake voice', local: false });
        expect(voice.retry('p1')).toBe(null);
        expect(voice.setVoice()).toBe(true);
    });
});
