/**
 * What the conformance suite cannot say about the NVIDIA adapter.
 *
 * It asks NVIDIA exactly once, from this browser, with the reader's typed key as one bearer header; a refusal is said
 * in words a reader can act on, whether NVIDIA answers in its problem document or OpenAI's error shape (a key it does
 * not know is a 403); a browser that could not send the request is told why that is likely; only the answer's words
 * are read, never `reasoning_content`; stopping stops the request; usage reaches the reader's own accounting; and the
 * key is in nothing RISE shows, writes or journals.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { createRealClock, createVirtualClock } from '../clock.js';
import { createLiveRuntime } from '../runtime.js';
import { createCurrentStream } from '../stream.js';
import { createSyntheticVoice } from '../voices/synthetic.js';
import { createFakeNvidiaFetch, fakeNvidiaKey, openaiChunk, openaiClose, openaiOpen, openaiText } from '../../test/fake-direct-fetch.js';
import { instructionsFor, promptFor } from './openai-instructions.js';
import { liveProvider } from './registry.js';
import { createNvidiaAdapter, errorOf, isNvidiaModel, NVIDIA_CHAT_URL, NVIDIA_DEFAULT_MODEL, NVIDIA_UNREACHABLE } from './nvidia.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes.' };
const KEY = fakeNvidiaKey();
const ANSWER = '@passage visual=still\nLight cannot leave — not even “a little”.\n@end\n';

async function read(connection) {
    const stream = createCurrentStream();
    const seen = [];
    let ended = null;
    try {
        for await (const event of connection.events) { seen.push(event); stream.apply(event); }
    } catch (error) { ended = error; }
    return { view: stream.snapshot(), seen, ended };
}

/** A fetch whose answer is `text`, sent `piece` bytes at a time. */
const answering = (text, { piece = Infinity } = {}) => async () => {
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream({
        start(controller) {
            const size = Number.isFinite(piece) ? piece : bytes.length;
            for (let at = 0; at < bytes.length; at += size) controller.enqueue(bytes.slice(at, at + size));
            controller.close();
        }
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
};

const WHOLE = [...openaiOpen(), openaiText(ANSWER), ...openaiClose('stop')].join('');
const adapterWith = (fetch, options = {}) => createNvidiaAdapter({ getKey: () => KEY, fetch, ...options });
const refused = (status, body, errorType = 'application/problem+json') => createFakeNvidiaFetch({ clock: createVirtualClock(), status, errorBody: body, errorType });

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('what it is', () => {
    it('carries text only, and RISE speaks it: the clock stays RISE’s', () => {
        const adapter = createNvidiaAdapter({ getKey: () => '' });
        expect(adapter.id).toBe('nvidia-stream');
        expect(adapter.capabilities).toMatchObject({ speaks: 'host', providerAudio: false, microphone: false, evidence: false, dives: false });
        expect(NVIDIA_DEFAULT_MODEL).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    });

    it('is offered on a typed key that goes to NVIDIA, with the sentence its failure would say shown before the key is typed', () => {
        expect(liveProvider('nvidia')).toMatchObject({ label: 'NVIDIA (your key)', credential: 'key', keyName: 'NVIDIA', keyGoesTo: 'NVIDIA', note: NVIDIA_UNREACHABLE });
    });
});

describe('what it asks', () => {
    it('sends one POST to NVIDIA’s chat completions with the key as one bearer header, RISE’s instructions, no thinking, and usage', async () => {
        const clock = createVirtualClock();
        const fake = createFakeNvidiaFetch({ clock });
        const reading = read(await adapterWith(fake.fetch).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('complete');
        expect(fake.calls).toHaveLength(1);
        const [{ url, init }] = fake.calls;
        expect(url).toBe(NVIDIA_CHAT_URL);
        expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
        expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', mode: 'cors', referrerPolicy: 'no-referrer', redirect: 'error' });
        expect(init.headers).toEqual({ 'content-type': 'application/json', authorization: `Bearer ${KEY}` });
        expect(JSON.parse(init.body)).toEqual({
            model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
            messages: [
                { role: 'system', content: instructionsFor({ name: 'nvidia/nemotron-3.5-lightning-30b-a3b', provider: 'NVIDIA' }) },
                { role: 'user', content: promptFor(ASK) }
            ],
            max_tokens: 4096,
            stream: true,
            stream_options: { include_usage: true },
            chat_template_kwargs: { enable_thinking: false }
        });
        const { headers, signal, ...rest } = init;
        expect(Object.values(headers).filter(value => value.includes(KEY))).toHaveLength(1);
        expect(JSON.stringify(rest) + url).not.toContain(KEY);
        expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('asks the model the reader named, at the moment of the request, and says so in the Current', async () => {
        const clock = createVirtualClock();
        const fake = createFakeNvidiaFetch({ clock });
        let model;
        const adapter = adapterWith(fake.fetch, { getModel: () => model });
        const first = read(await adapter.open(ASK));
        model = 'meta/llama-3.3-70b-instruct';
        const second = read(await adapter.open(ASK));
        await clock.runAll();
        expect((await first).view.origin).toEqual({ kind: 'model', name: 'nvidia/nemotron-3.5-lightning-30b-a3b', provider: 'NVIDIA' });
        expect((await second).view.origin).toEqual({ kind: 'model', name: 'meta/llama-3.3-70b-instruct', provider: 'NVIDIA' });
        expect(fake.calls.map(({ init }) => JSON.parse(init.body).model)).toEqual(['nvidia/nemotron-3.5-lightning-30b-a3b', 'meta/llama-3.3-70b-instruct']);
    });

    it('takes a catalog model id, and refuses anything else before anything is sent', async () => {
        for (const name of ['nvidia/nemotron-3.5-lightning-30b-a3b', 'deepseek-ai/deepseek-v3.1', 'qwen/qwen3-next-80b-a3b-instruct']) expect(isNvidiaModel(name), name).toBe(true);
        for (const name of ['nemotron', 'nvidia/Nemotron', 'nvidia/a b', 'nvidia/../x', 'a/b/c', '/x', 'nvidia/', 'https://evil.example/x', 7]) {
            expect(isNvidiaModel(name), String(name)).toBe(false);
            const fake = createFakeNvidiaFetch({ clock: createVirtualClock() });
            if (typeof name === 'string') {
                await expect(adapterWith(fake.fetch, { getModel: () => name }).open(ASK)).rejects.toMatchObject({ code: 'MODEL_INVALID' });
                expect(fake.calls).toHaveLength(0);
            }
        }
    });

    it('asks nothing without a key, and nothing when the reader stopped before it began', async () => {
        const fake = createFakeNvidiaFetch({ clock: createVirtualClock() });
        await expect(createNvidiaAdapter({ getKey: () => '  ', fetch: fake.fetch }).open(ASK)).rejects.toMatchObject({ code: 'KEY_REQUIRED', message: expect.stringMatching(/NVIDIA API key/u) });
        const controller = new AbortController();
        controller.abort();
        await expect(adapterWith(fake.fetch).open(ASK, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect(fake.calls).toHaveLength(0);
    });
});

describe('a refusal, in words a reader can act on', () => {
    const cases = [
        [401, 'KEY_REFUSED', /NVIDIA did not accept your key/u],
        // What NVIDIA answers a key it does not know.
        [403, 'KEY_REFUSED', /NVIDIA did not accept your key/u],
        [402, 'CREDIT_REQUIRED', /credits/u],
        [404, 'MODEL_NOT_FOUND', /nemotron-3\.5-lightning/u],
        [429, 'RATE_LIMITED', /limit/u],
        [500, 'PROVIDER_UNAVAILABLE', /could not answer/u],
        [503, 'PROVIDER_UNAVAILABLE', /could not answer/u],
        [422, 'BAD_REQUEST', /would not take/u]
    ];
    for (const [status, code, said] of cases) {
        it(`${status} is ${code}`, async () => {
            const fake = createFakeNvidiaFetch({ clock: createVirtualClock(), status });
            await expect(adapterWith(fake.fetch).open(ASK)).rejects.toMatchObject({ code, message: expect.stringMatching(said) });
        });
    }

    it('reads NVIDIA’s problem document and OpenAI’s error shape alike, and says the status when there are no words', async () => {
        expect(errorOf({ status: 403, title: 'Forbidden', detail: 'Authorization failed' })).toEqual({ message: 'Authorization failed', code: 'Forbidden' });
        expect(errorOf({ error: { message: 'model field is required', code: 'missing_required_field' } })).toEqual({ message: 'model field is required', code: 'missing_required_field' });
        expect(errorOf(null)).toBeNull();
        await expect(adapterWith(refused(403, JSON.stringify({ status: 403, title: 'Forbidden', detail: 'Authorization failed' })).fetch).open(ASK))
            .rejects.toMatchObject({ code: 'KEY_REFUSED', message: 'NVIDIA did not accept your key: Authorization failed' });
        await expect(adapterWith(refused(400, JSON.stringify({ error: { message: 'Function id not found for model nvidia/nope', type: 'invalid_request_error' } }), 'text/plain').fetch, { getModel: () => 'nvidia/nope' }).open(ASK))
            .rejects.toMatchObject({ code: 'MODEL_NOT_FOUND', message: expect.stringContaining('nvidia/nope') });
        await expect(adapterWith(refused(404, '404 page not found', 'text/plain').fetch).open(ASK))
            .rejects.toMatchObject({ code: 'MODEL_NOT_FOUND', message: expect.stringContaining('no reason given (HTTP 404)') });
    });

    it('says it could not reach NVIDIA, and why that is likely, when the browser could not send the request', async () => {
        const fake = createFakeNvidiaFetch({ clock: createVirtualClock(), networkError: new TypeError('Failed to fetch') });
        const error = await adapterWith(fake.fetch).open(ASK).catch(caught => caught);
        expect(error).toMatchObject({ code: 'CONNECT_FAILED' });
        expect(error.message).toBe(`Could not reach NVIDIA: Failed to fetch. ${NVIDIA_UNREACHABLE}`);
    });

    it('never repeats the key NVIDIA might echo in a refusal, and reads no more of it than it needs', async () => {
        const other = fakeNvidiaKey('another-readers-key-0000');
        const body = JSON.stringify({ status: 403, title: 'Forbidden', detail: `Authorization failed for ${KEY} and ${other}. ${'x'.repeat(100_000)}` });
        const error = await adapterWith(refused(403, body).fetch).open(ASK).catch(caught => caught);
        expect(error.code).toBe('KEY_REFUSED');
        expect(error.message.length).toBeLessThanOrEqual(300);
        expect(`${error.message} ${error.stack}`).not.toContain(KEY);
        expect(error.message).not.toContain(other);
        expect(error.message).toContain('[key]');
    });
});

describe('reading the stream', () => {
    it('reads a stream that arrives one byte at a time, or in CRLF lines, as if it were whole', async () => {
        const whole = (await read(await adapterWith(answering(WHOLE)).open(ASK))).view;
        const bytewise = (await read(await adapterWith(answering(WHOLE, { piece: 1 })).open(ASK))).view;
        const crlf = (await read(await adapterWith(answering(WHOLE.replace(/\n/gu, '\r\n'), { piece: 5 })).open(ASK))).view;
        for (const view of [whole, bytewise, crlf]) expect(view.phase).toBe('complete');
        expect(bytewise.segments.map(s => s.text)).toEqual(['Light cannot leave — not even “a little”.']);
        expect(crlf.segments.map(s => s.text)).toEqual(whole.segments.map(s => s.text));
    });

    it('reads only the answer’s words: never a model’s reasoning_content', async () => {
        const thought = openaiChunk({ content: null, reasoning_content: 'secret plan' });
        const { view } = await read(await adapterWith(answering([...openaiOpen(), thought, openaiText(ANSWER), ...openaiClose('stop')].join(''))).open(ASK));
        expect(view.phase).toBe('complete');
        expect(JSON.stringify(view)).not.toMatch(/secret/u);
    });

    it('fails an error object sent mid-stream, cleaned of the key', async () => {
        const failed = `data: ${JSON.stringify({ error: { message: `upstream echoed ${KEY}`, type: 'server_error', code: null } })}\n\n`;
        const { view, seen } = await read(await adapterWith(answering([...openaiOpen(), failed].join(''))).open(ASK));
        expect(view.phase).toBe('failed');
        expect(view.error).toMatchObject({ code: 'SERVER_ERROR', recoverable: false });
        expect(view.error.message).toContain('upstream echoed [key]');
        expect(JSON.stringify(seen)).not.toContain(KEY);
    });

    it('fails, never completes, on a length limit', async () => {
        const { view } = await read(await adapterWith(answering([...openaiOpen(), openaiText(ANSWER), ...openaiClose('length')].join(''))).open(ASK));
        expect(view.phase).toBe('failed');
        expect(view.error.code).toBe('RESPONSE_LENGTH');
    });
});

describe('stopping', () => {
    it('aborts the request when the reader interrupts part way, or closes the connection', async () => {
        for (const how of ['interrupt', 'close']) {
            const clock = createVirtualClock();
            const fake = createFakeNvidiaFetch({ clock });
            const connection = await adapterWith(fake.fetch).open(ASK);
            const reading = read(connection);
            await clock.advance(200);
            if (how === 'interrupt') await connection.interrupt({ text: 'wait' });
            else await connection.close();
            await clock.runAll();
            await reading;
            expect(fake.calls[0].init.signal.aborted, how).toBe(true);
            expect(clock.pending(), how).toBe(0);
        }
    });

    it('aborts the request when the reader stops while it is being made, and says it stopped, not that NVIDIA is unreachable', async () => {
        const controller = new AbortController();
        let seen = null;
        const fetch = (url, init) => {
            seen = init;
            return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
        };
        const opening = adapterWith(fetch).open(ASK, { signal: controller.signal });
        await Promise.resolve();
        controller.abort();
        await expect(opening).rejects.toMatchObject({ code: 'ABORTED' });
        expect(seen.signal.aborted).toBe(true);
    });
});

describe('usage, for the reader’s own accounting', () => {
    it('hands over the tokens the usage chunk reports, once, when the answer ends: tokens only, no price', async () => {
        const clock = createVirtualClock();
        const fake = createFakeNvidiaFetch({ clock });
        const onUsage = vi.fn();
        const reading = read(await adapterWith(fake.fetch, { onUsage }).open(ASK));
        await clock.runAll();
        await reading;
        expect(onUsage).toHaveBeenCalledOnce();
        expect(onUsage).toHaveBeenCalledWith({ model: 'nvidia/nemotron-3.5-lightning-30b-a3b', promptTokens: 512, completionTokens: 240, totalTokens: 752 });
    });
});

describe('the reader’s key', () => {
    function runWith(notes) {
        const clock = createRealClock();
        return createLiveRuntime({
            adapter: createNvidiaAdapter({ getKey: () => KEY }),
            clock,
            voices: { create: () => createSyntheticVoice({ clock, msPerChar: 1, breathMs: 5 }) },
            createPlayer: session => new Player(session),
            host: { present() {}, dismiss() {} },
            onNote: entry => notes.push(entry)
        });
    }

    it('goes from the page to NVIDIA in one header, and is in no address, note, journal, event or console line', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        const fake = createFakeNvidiaFetch({ clock: createRealClock(), everyMs: 5 });
        vi.stubGlobal('fetch', fake.fetch);
        const notes = [];
        const runtime = runWith(notes);
        const started = runtime.start('Explain black holes.');
        await vi.advanceTimersByTimeAsync(5_000);
        await started;
        await vi.advanceTimersByTimeAsync(60_000);
        const journal = runtime.journal();
        await runtime.stop();

        expect(fake.calls).toHaveLength(1);
        expect(fake.calls[0].url).toBe(NVIDIA_CHAT_URL);
        expect(fake.calls[0].init.headers.authorization).toBe(`Bearer ${KEY}`);
        expect(notes.some(note => note.type === 'speech.start')).toBe(true);
        for (const trace of [notes, journal, logged]) expect(JSON.stringify(trace)).not.toContain(KEY);
    });

    it('is in nothing when NVIDIA refuses it and echoes it back', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        const fake = createFakeNvidiaFetch({
            clock: createRealClock(),
            status: 401,
            errorBody: JSON.stringify({ status: 401, title: 'Unauthorized', detail: `Invalid key ${KEY}` })
        });
        vi.stubGlobal('fetch', fake.fetch);
        const notes = [];
        const runtime = runWith(notes);
        const error = await runtime.start('Explain black holes.').catch(caught => caught);
        const journal = runtime.journal();
        await runtime.stop();
        expect(error).toMatchObject({ code: 'KEY_REFUSED' });
        for (const trace of [notes, journal, logged, [String(error?.message), String(error?.stack)]]) expect(JSON.stringify(trace)).not.toContain(KEY);
    });
});
