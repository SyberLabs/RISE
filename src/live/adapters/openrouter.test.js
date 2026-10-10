/**
 * What the conformance suite cannot say about the OpenRouter adapter.
 *
 * It asks OpenRouter exactly once, with RISE's instructions and the reader's
 * chosen model, through the reader's own connection and nothing else; a
 * refusal (401, 402, 429 and the rest) is said in words a reader can act on;
 * a line that arrives in pieces is read whole; stopping stops the request;
 * usage is handed to the reader's own accounting; and the reader's key is
 * never in anything RISE shows, writes or journals.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { acceptOpenRouterKey, connectionState, OPENROUTER_CHAT_URL, resetConnectionForTests } from '../../core/ai-connection.js';
import { AdapterError } from '../adapter.js';
import { createRealClock, createVirtualClock } from '../clock.js';
import { createLiveRuntime } from '../runtime.js';
import { createCurrentStream } from '../stream.js';
import { createSyntheticVoice } from '../voices/synthetic.js';
import { chunk, createFakeOpenRouterFetch, finishing, USAGE } from '../../test/fake-openrouter-fetch.js';
import { REALTIME_INSTRUCTIONS } from './openai-instructions.js';
import { OPENROUTER_DEFAULT_MODEL } from './openrouter-model.js';
import { createOpenRouterAdapter } from './openrouter.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes.' };
const KEY = 'sk-or-v1-fake-reader-key-for-tests-only-0000';
const ANSWER = '@passage visual=still\nLight cannot leave — not even “a little”.\n@end\n';

const chat = request => ({ request, scrub: text => String(text).split(KEY).join('[key]') });

async function read(connection) {
    const stream = createCurrentStream();
    const seen = [];
    let ended = null;
    try {
        for await (const event of connection.events) { seen.push(event); stream.apply(event); }
    } catch (error) { ended = error; }
    return { view: stream.snapshot(), seen, ended };
}

/** A Response whose body is `text`, sent `piece` bytes at a time. */
function streamed(text, { piece = Infinity, status = 200 } = {}) {
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream({
        start(controller) {
            const size = Number.isFinite(piece) ? piece : bytes.length;
            for (let at = 0; at < bytes.length; at += size) controller.enqueue(bytes.slice(at, at + size));
            controller.close();
        }
    });
    return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

const sse = (...events) => events.map(event => (event.startsWith(':') ? `${event}\n\n` : `data: ${event}\n\n`)).join('');
const WHOLE = sse(': OPENROUTER PROCESSING', chunk(ANSWER), finishing('stop'), finishing('stop', { usage: USAGE }), '[DONE]');

afterEach(() => {
    resetConnectionForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('what it is', () => {
    it('carries text only, and RISE speaks it: the clock stays RISE’s', () => {
        const adapter = createOpenRouterAdapter({ getChat: () => null });
        expect(adapter.id).toBe('openrouter-stream');
        expect(adapter.capabilities).toMatchObject({ speaks: 'host', providerAudio: false, microphone: false, evidence: false, dives: false });
    });
});

describe('what it asks', () => {
    it('sends one POST with RISE’s instructions, the reader’s words, the default model and a cap, and attribution headers only', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock });
        const controller = new AbortController();
        const connection = await createOpenRouterAdapter({ getChat: () => chat(fake.request), referer: 'https://rise.example' }).open(ASK, { signal: controller.signal });
        const reading = read(connection);
        await clock.runAll();
        expect((await reading).view.phase).toBe('complete');
        expect(fake.requests).toHaveLength(1);
        const [init] = fake.requests;
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'HTTP-Referer': 'https://rise.example', 'X-OpenRouter-Title': 'RISE' });
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(JSON.parse(init.body)).toEqual({
            model: OPENROUTER_DEFAULT_MODEL,
            messages: [{ role: 'system', content: REALTIME_INSTRUCTIONS }, { role: 'user', content: ASK.prompt }],
            stream: true,
            max_tokens: 4096
        });
    });

    it('asks the model the reader chose, at the moment of the request', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock });
        let model = 'openai/gpt-5.4-nano';
        const adapter = createOpenRouterAdapter({ getChat: () => chat(fake.request), getModel: () => model });
        const first = read(await adapter.open(ASK));
        model = 'qwen/qwen3.7-flash';
        const second = read(await adapter.open(ASK));
        await clock.runAll();
        await Promise.all([first, second]);
        expect(fake.requests.map(init => JSON.parse(init.body).model)).toEqual(['openai/gpt-5.4-nano', 'qwen/qwen3.7-flash']);
    });

    it('refuses a model name that is not one, before anything is sent', async () => {
        const fake = createFakeOpenRouterFetch({ clock: createVirtualClock() });
        const adapter = createOpenRouterAdapter({ getChat: () => chat(fake.request), getModel: () => 'gpt 5; drop' });
        await expect(adapter.open(ASK)).rejects.toMatchObject({ code: 'MODEL_INVALID' });
        expect(fake.requests).toHaveLength(0);
    });

    it('asks nothing without the reader’s connection, and says how to make one', async () => {
        const adapter = createOpenRouterAdapter({ getChat: () => null });
        const refused = adapter.open(ASK);
        await expect(refused).rejects.toBeInstanceOf(AdapterError);
        await expect(refused).rejects.toMatchObject({ code: 'KEY_REQUIRED', message: expect.stringMatching(/Connect OpenRouter/u) });
    });

    it('asks nothing when the reader stopped before it began', async () => {
        const fake = createFakeOpenRouterFetch({ clock: createVirtualClock() });
        const controller = new AbortController();
        controller.abort();
        await expect(createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK, { signal: controller.signal }))
            .rejects.toMatchObject({ code: 'ABORTED' });
        expect(fake.requests).toHaveLength(0);
    });
});

describe('a refusal, in words a reader can act on', () => {
    const cases = [
        [401, 'KEY_REFUSED', /OpenRouter did not accept your key/u],
        [402, 'CREDIT_REQUIRED', /credit/u],
        [429, 'RATE_LIMITED', /limit/u],
        [403, 'REFUSED', /refused/u],
        [503, 'PROVIDER_UNAVAILABLE', /could not answer/u],
        [502, 'PROVIDER_UNAVAILABLE', /could not answer/u]
    ];
    for (const [status, code, said] of cases) {
        it(`${status} is ${code}`, async () => {
            const fake = createFakeOpenRouterFetch({ clock: createVirtualClock(), status });
            await expect(createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK))
                .rejects.toMatchObject({ code, message: expect.stringMatching(said) });
        });
    }

    it('names the model when OpenRouter has none by that name', async () => {
        const fake = createFakeOpenRouterFetch({ clock: createVirtualClock(), status: 400, errorBody: JSON.stringify({ error: { code: 400, message: 'nobody/nothing is not a valid model ID' } }) });
        const refused = createOpenRouterAdapter({ getChat: () => chat(fake.request), getModel: () => 'nobody/nothing' }).open(ASK);
        await expect(refused).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND', message: expect.stringContaining('nobody/nothing') });
    });

    it('says it could not reach OpenRouter when the network fails', async () => {
        const fake = createFakeOpenRouterFetch({ clock: createVirtualClock(), networkError: new TypeError('Failed to fetch') });
        await expect(createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK))
            .rejects.toMatchObject({ code: 'CONNECT_FAILED', message: expect.stringMatching(/Could not reach OpenRouter/u) });
    });

    it('reads no more of a refusal than it needs', async () => {
        const fake = createFakeOpenRouterFetch({ clock: createVirtualClock(), status: 429, errorBody: JSON.stringify({ error: { code: 429, message: 'x'.repeat(100_000) } }) });
        const error = await createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK).catch(caught => caught);
        expect(error.message.length).toBeLessThanOrEqual(300);
    });
});

describe('reading the stream', () => {
    it('reads a line that arrives one byte at a time, across every boundary, as if it were whole', async () => {
        const answer = async piece => {
            const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(WHOLE, { piece })) });
            return (await read(await adapter.open(ASK))).view;
        };
        const whole = await answer(Infinity);
        const bytewise = await answer(1);
        expect(whole.phase).toBe('complete');
        expect(bytewise.phase).toBe('complete');
        expect(bytewise.segments.map(s => s.text)).toEqual(['Light cannot leave — not even “a little”.']);
        expect(bytewise.segments.map(s => s.text)).toEqual(whole.segments.map(s => s.text));
    });

    it('reads a stream written with CRLF line endings', async () => {
        const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(WHOLE.replace(/\n/gu, '\r\n'), { piece: 5 })) });
        expect((await read(await adapter.open(ASK))).view.phase).toBe('complete');
    });

    it('shows only the answer’s words, never the model’s reasoning', async () => {
        const thinking = JSON.stringify({ ...JSON.parse(chunk('')), choices: [{ index: 0, delta: { content: '', reasoning: 'secret plan' }, finish_reason: null }] });
        const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(sse(thinking, chunk(ANSWER), finishing('stop'), '[DONE]'))) });
        const { view } = await read(await adapter.open(ASK));
        expect(view.phase).toBe('complete');
        expect(JSON.stringify(view)).not.toContain('secret plan');
    });

    it('takes a stream that stops after its finish without [DONE] as finished', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock, done: false });
        const reading = read(await createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('complete');
    });

    it('fails a 200 that carries only an error, and says what OpenRouter said, cleaned of the key', async () => {
        const failed = JSON.stringify({ ...JSON.parse(finishing('error')), error: { code: 'server_error', message: `upstream echoed Bearer ${KEY}` } });
        const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(sse(failed))) });
        const { view, seen } = await read(await adapter.open(ASK));
        expect(view.phase).toBe('failed');
        expect(view.error).toMatchObject({ recoverable: false });
        expect(view.error.message).toContain('upstream echoed');
        expect(JSON.stringify(seen)).not.toContain(KEY);
    });

    it('cleans a key-shaped string even when the connection cannot say what its key is', async () => {
        const failed = JSON.stringify({ ...JSON.parse(finishing('error')), error: { code: 'server_error', message: `bad key ${KEY}` } });
        const adapter = createOpenRouterAdapter({ getChat: () => ({ request: async () => streamed(sse(failed)) }) });
        const { seen } = await read(await adapter.open(ASK));
        expect(JSON.stringify(seen)).not.toContain(KEY);
        expect(JSON.stringify(seen)).not.toMatch(/sk-or-v1-fake/u);
    });

    it('fails, never completes, on a content filter', async () => {
        const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(sse(chunk(ANSWER), finishing('content_filter'), '[DONE]'))) });
        const { view } = await read(await adapter.open(ASK));
        expect(view.phase).toBe('failed');
        expect(view.error.code).toBe('RESPONSE_CONTENT_FILTER');
    });

    it('cuts off a stream that sends more than its limit', async () => {
        const long = sse(chunk(ANSWER), ...Array.from({ length: 200 }, () => ': OPENROUTER PROCESSING'), finishing('stop'), '[DONE]');
        const adapter = createOpenRouterAdapter({ getChat: () => chat(async () => streamed(long, { piece: 64 })), maxBytes: 1024 });
        const { view } = await read(await adapter.open(ASK));
        expect(view.phase).not.toBe('complete');
    });
});

describe('stopping', () => {
    it('aborts the request when the reader interrupts part way, and reads nothing after', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock });
        const connection = await createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK);
        const reading = read(connection);
        await clock.advance(200);
        await connection.interrupt({ text: 'wait' });
        await clock.runAll();
        const { view } = await reading;
        expect(view.phase).toBe('cancelled');
        expect(fake.requests[0].signal.aborted).toBe(true);
        expect(clock.pending()).toBe(0);
    });

    it('aborts the request when the connection is closed', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock });
        const connection = await createOpenRouterAdapter({ getChat: () => chat(fake.request) }).open(ASK);
        const reading = read(connection);
        await clock.advance(100);
        await connection.close();
        await reading;
        expect(fake.requests[0].signal.aborted).toBe(true);
        expect(clock.pending()).toBe(0);
    });

    it('aborts the request when the reader stops while it is being made', async () => {
        const controller = new AbortController();
        let seen = null;
        const request = init => {
            seen = init;
            return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
        };
        const opening = createOpenRouterAdapter({ getChat: () => chat(request) }).open(ASK, { signal: controller.signal });
        await Promise.resolve();
        controller.abort();
        await expect(opening).rejects.toMatchObject({ code: 'ABORTED' });
        expect(seen.signal.aborted).toBe(true);
    });
});

describe('usage, for the reader’s own accounting', () => {
    it('hands over the tokens and cost OpenRouter reports, once, when the answer ends', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock });
        const onUsage = vi.fn();
        const reading = read(await createOpenRouterAdapter({ getChat: () => chat(fake.request), onUsage }).open(ASK));
        await clock.runAll();
        await reading;
        expect(onUsage).toHaveBeenCalledOnce();
        expect(onUsage).toHaveBeenCalledWith({ model: OPENROUTER_DEFAULT_MODEL, promptTokens: 512, completionTokens: 240, totalTokens: 752, cost: 0.0001712 });
    });

    it('hands over what a cut-off answer cost, too', async () => {
        const clock = createVirtualClock();
        const fake = createFakeOpenRouterFetch({ clock, cutAfter: 30 });
        const onUsage = vi.fn();
        const reading = read(await createOpenRouterAdapter({ getChat: () => chat(fake.request), onUsage }).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('failed');
        expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 752 }));
    });

    it('says nothing when there is no usage, keeps only numbers, and is not broken by a listener that throws', async () => {
        const quiet = vi.fn();
        await read(await createOpenRouterAdapter({ getChat: () => chat(async () => streamed(sse(chunk(ANSWER), finishing('stop'), '[DONE]'))), onUsage: quiet }).open(ASK));
        expect(quiet).not.toHaveBeenCalled();

        const odd = sse(chunk(ANSWER), finishing('stop', { usage: { prompt_tokens: '9', completion_tokens: -1, total_tokens: 3, cost: 'free', key: KEY } }), '[DONE]');
        const seen = vi.fn(() => { throw new Error('a page bug'); });
        const { view } = await read(await createOpenRouterAdapter({ getChat: () => chat(async () => streamed(odd)), onUsage: seen }).open(ASK));
        expect(view.phase).toBe('complete');
        expect(seen).toHaveBeenCalledWith({ model: OPENROUTER_DEFAULT_MODEL, totalTokens: 3 });
    });
});

describe('the reader’s key', () => {
    function runWith(fake, notes) {
        const clock = createRealClock();
        return createLiveRuntime({
            adapter: createOpenRouterAdapter({ referer: 'https://rise.example' }),
            clock,
            voices: { create: () => createSyntheticVoice({ clock, msPerChar: 1, breathMs: 5 }) },
            createPlayer: session => new Player(session),
            host: { present() {}, dismiss() {} },
            onNote: entry => notes.push(entry)
        });
    }

    it('goes from the in-memory connection to OpenRouter in one header, and is in no address, note, journal, event or console line', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        acceptOpenRouterKey(KEY);
        const fake = createFakeOpenRouterFetch({ clock: createRealClock(), everyMs: 5 });
        const calls = [];
        vi.stubGlobal('fetch', (url, init) => { calls.push({ url, init }); return fake.request(init); });
        const notes = [];
        const runtime = runWith(fake, notes);
        const started = runtime.start('Explain black holes.');
        await vi.advanceTimersByTimeAsync(5_000);
        await started;
        await vi.advanceTimersByTimeAsync(60_000);
        const journal = runtime.journal();
        await runtime.stop();

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(OPENROUTER_CHAT_URL);
        expect(calls[0].init.headers.Authorization).toBe(`Bearer ${KEY}`);
        const { headers, ...rest } = calls[0].init;
        expect(JSON.stringify({ ...rest, headers: { ...headers, Authorization: undefined } })).not.toContain(KEY);
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.some(note => note.type === 'speech.start')).toBe(true);
        for (const trace of [notes, journal, logged]) expect(JSON.stringify(trace)).not.toContain(KEY);
    });

    it('is in nothing when OpenRouter refuses it and echoes it back, and is then forgotten', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        acceptOpenRouterKey(KEY);
        const fake = createFakeOpenRouterFetch({ clock: createRealClock(), status: 401, errorBody: JSON.stringify({ error: { code: 401, message: `Key ${KEY} is not valid` } }) });
        vi.stubGlobal('fetch', (url, init) => fake.request(init));
        const notes = [];
        const runtime = runWith(fake, notes);
        const error = await runtime.start('Explain black holes.').catch(caught => caught);
        const journal = runtime.journal();
        await runtime.stop();
        expect(error).toMatchObject({ code: 'KEY_REFUSED' });
        expect(connectionState().kind).toBe('none');
        for (const trace of [notes, journal, logged, [String(error?.message), String(error?.stack)]]) expect(JSON.stringify(trace)).not.toContain(KEY);
    });
});
