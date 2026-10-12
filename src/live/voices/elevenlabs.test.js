import { describe, expect, it, vi } from 'vitest';
import { ELEVENLABS, createElevenLabsSpeech, marksFrom, pcm16ToSamples, reasonFor } from './elevenlabs.js';

const KEY = 'xi-0123456789abcdef0123456789abcdef';

/** Base64 of 16-bit little-endian samples. */
function pcm(values) {
    const bytes = new Uint8Array(values.length * 2);
    const view = new DataView(bytes.buffer);
    values.forEach((value, i) => view.setInt16(i * 2, value, true));
    return Buffer.from(bytes).toString('base64');
}

/** An alignment that spells `text`, every character 50 ms long. */
function aligned(text, msPerChar = 50) {
    const characters = [...text];
    return {
        characters,
        character_start_times_seconds: characters.map((_, i) => (i * msPerChar) / 1000),
        character_end_times_seconds: characters.map((_, i) => ((i + 1) * msPerChar) / 1000)
    };
}

function okResponse(body) {
    return { ok: true, status: 200, json: async () => body };
}

describe('pcm16ToSamples', () => {
    it('turns 16-bit little-endian PCM into samples in [-1, 1], dropping a trailing odd byte', () => {
        const samples = pcm16ToSamples(pcm([0, 32767, -32768, 16384]));
        expect([...samples].map(value => Number(value.toFixed(4)))).toEqual([0, 1, -1, 0.5]);
        expect(pcm16ToSamples(Buffer.from([0, 64, 7]).toString('base64')).length).toBe(1);
    });
});

describe('marksFrom', () => {
    it('marks the start of every word after the first, in audio milliseconds, when the alignment spells the text', () => {
        const text = 'One short line here.';
        const { marks, durationMs, exact } = marksFrom(text, aligned(text));
        expect(exact).toBe(true);
        expect(marks).toEqual([{ charIndex: 4, tMs: 200 }, { charIndex: 10, tMs: 500 }, { charIndex: 15, tMs: 750 }]);
        expect(durationMs).toBe(text.length * 50);
    });

    it('gives no marks, and no duration, when the alignment does not spell the text', () => {
        const other = aligned('One short line here!');
        expect(marksFrom('One short line here.', other)).toEqual({ marks: [], durationMs: null, exact: false });
        expect(marksFrom('Two words', null)).toEqual({ marks: [], durationMs: null, exact: false });
    });
});

describe('reasonFor', () => {
    it('names each refusal the reader can act on', () => {
        expect(reasonFor(401).code).toBe('KEY_REFUSED');
        expect(reasonFor(402).code).toBe('CREDIT_REQUIRED');
        expect(reasonFor(403, 'quota_exceeded').code).toBe('REFUSED');
        expect(reasonFor(401, '{"detail":{"status":"quota_exceeded"}}').code).toBe('CREDIT_REQUIRED');
        expect(reasonFor(400, '{"detail":{"status":"quota_exceeded"}}').code).toBe('CREDIT_REQUIRED');
        expect(reasonFor(429).code).toBe('RATE_LIMITED');
        expect(reasonFor(422).code).toBe('TEXT_REFUSED');
        expect(reasonFor(404).code).toBe('VOICE_NOT_FOUND');
        expect(reasonFor(503).code).toBe('PROVIDER_UNAVAILABLE');
    });
});

describe('createElevenLabsSpeech', () => {
    it('asks for raw PCM with timestamps, with the key in one header and the speed within what the API takes', async () => {
        const text = 'A short line.';
        const fetch = vi.fn(async () => okResponse({ audio_base64: pcm([0, 0, 0, 0]), alignment: aligned(text) }));
        const speech = createElevenLabsSpeech({ getKey: () => KEY, fetch });
        const said = await speech.speak(text, { rate: 1.5 });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS.defaultVoiceId}/with-timestamps?output_format=pcm_22050`);
        expect(init.method).toBe('POST');
        expect(init.headers['xi-api-key']).toBe(KEY);
        expect(init.credentials).toBe('omit');
        expect(init.referrerPolicy).toBe('no-referrer');
        expect(JSON.parse(init.body)).toEqual({ text, model_id: ELEVENLABS.defaultModelId, voice_settings: { speed: 1.2 } });
        expect(said.sampleRate).toBe(22050);
        expect(said.samples.length).toBe(4);
        expect(said.marks).toEqual([{ charIndex: 2, tMs: 100 }, { charIndex: 8, tMs: 400 }]);
        expect(said.durationMs).toBe(text.length * 50);
        expect(said.speed).toBe(1.2);
        expect(said.exact).toBe(true);
        expect(speech.chars).toBe(text.length);
    });

    it('refuses without a key, and refuses a passage longer than the voice takes, before any request', async () => {
        const fetch = vi.fn();
        const speech = createElevenLabsSpeech({ getKey: () => '', fetch });
        await expect(speech.speak('Hello')).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
        const keyed = createElevenLabsSpeech({ getKey: () => KEY, fetch });
        await expect(keyed.speak('x'.repeat(ELEVENLABS.maxChars + 1))).rejects.toMatchObject({ code: 'TEXT_REFUSED' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('maps a refusal to its reason and never lets the key into the message', async () => {
        const fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ detail: { message: `bad key ${KEY}` } }) }));
        const speech = createElevenLabsSpeech({ getKey: () => KEY, fetch });
        const error = await speech.speak('Hello').catch(e => e);
        expect(error.code).toBe('KEY_REFUSED');
        expect(error.message).not.toContain(KEY);
        expect(error.status).toBe(401);
    });

    it('reports a network failure, and lets an abort through untouched', async () => {
        const speech = createElevenLabsSpeech({ getKey: () => KEY, fetch: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) });
        await expect(speech.speak('Hello')).rejects.toMatchObject({ code: 'CONNECT_FAILED' });
        const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
        const aborted = createElevenLabsSpeech({ getKey: () => KEY, fetch: vi.fn(async () => { throw abort; }) });
        await expect(aborted.speak('Hello')).rejects.toBe(abort);
    });

    it('refuses an answer with no audio, and estimates the duration from the samples when the alignment is off', async () => {
        const noAudio = createElevenLabsSpeech({ getKey: () => KEY, fetch: vi.fn(async () => okResponse({ alignment: null })) });
        await expect(noAudio.speak('Hello')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
        const samples = new Array(22050).fill(0);
        const estimated = createElevenLabsSpeech({ getKey: () => KEY, fetch: vi.fn(async () => okResponse({ audio_base64: pcm(samples), alignment: aligned('Hello!') })) });
        const said = await estimated.speak('Hello');
        expect(said.marks).toEqual([]);
        expect(said.exact).toBe(false);
        expect(said.durationMs).toBe(1000);
    });
});
