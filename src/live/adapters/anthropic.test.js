/**
 * What the conformance suite cannot say about the direct Anthropic adapter.
 *
 * It asks Anthropic exactly once, from this browser, with the reader's typed key in one header and the header
 * Anthropic requires of a browser origin; a refusal is said in words a reader can act on; a line that arrives in
 * pieces is read whole; only the answer's words are read, never a thinking block; stopping stops the request; the
 * tokens Anthropic reports reach the reader's own accounting; and the key is in nothing RISE shows, writes or journals.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { createRealClock, createVirtualClock } from '../clock.js';
import { createLiveRuntime } from '../runtime.js';
import { createCurrentStream } from '../stream.js';
import { createSyntheticVoice } from '../voices/synthetic.js';
import { anthropicClose, anthropicEvent, anthropicOpen, anthropicText, createFakeAnthropicFetch } from '../../test/fake-direct-fetch.js';
import { instructionsFor, promptFor } from './openai-instructions.js';
import { ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_MESSAGES_URL, createAnthropicAdapter } from './anthropic.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes.' };
const EARLIER = [{ asked: 'What is time?', said: 'Time is what clocks measure.', cut: true }];
const KEY = 'sk-ant-api03-fake-reader-key-for-tests-only-0000';
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
const answering = (text, { piece = Infinity, status = 200 } = {}) => async () => {
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream({
        start(controller) {
            const size = Number.isFinite(piece) ? piece : bytes.length;
            for (let at = 0; at < bytes.length; at += size) controller.enqueue(bytes.slice(at, at + size));
            controller.close();
        }
    });
    return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
};

const WHOLE = [...anthropicOpen(), anthropicText(ANSWER), ...anthropicClose('end_turn')].join('');
const adapterWith = (fetch, options = {}) => createAnthropicAdapter({ getKey: () => KEY, fetch, ...options });

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('what it is', () => {
    it('carries text only, and RISE speaks it: the clock stays RISE’s', () => {
        const adapter = createAnthropicAdapter({ getKey: () => '' });
        expect(adapter.id).toBe('anthropic-stream');
        expect(adapter.capabilities).toMatchObject({ speaks: 'host', providerAudio: false, microphone: false, evidence: false, dives: false });
        expect(ANTHROPIC_DEFAULT_MODEL).toBe('claude-haiku-5-5');
    });
});

describe('what it asks', () => {
    it('sends one POST to the Messages API with the key in x-api-key alone, the browser header, and RISE’s instructions', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock });
        const reading = read(await adapterWith(fake.fetch).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('complete');
        expect(fake.calls).toHaveLength(1);
        const [{ url, init }] = fake.calls;
        expect(url).toBe(ANTHROPIC_MESSAGES_URL);
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', mode: 'cors', referrerPolicy: 'no-referrer', redirect: 'error' });
        expect(init.headers).toEqual({
            'content-type': 'application/json',
            'x-api-key': KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        });
        expect(JSON.parse(init.body)).toEqual({
            model: 'claude-haiku-5-5',
            max_tokens: 4096,
            system: instructionsFor({ name: 'claude-haiku-5-5', provider: 'Anthropic' }),
            messages: [{ role: 'user', content: promptFor(ASK) }],
            output_config: { effort: 'low' },
            stream: true
        });
        // The key is in one header and nowhere else in the request.
        const { headers, signal, ...rest } = init;
        expect(Object.values(headers).filter(value => value.includes(KEY))).toHaveLength(1);
        expect(JSON.stringify(rest) + url).not.toContain(KEY);
        expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('carries what was said earlier in the room inside the one user message, never as turns of its own (LIVE-026)', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock });
        const request = { intent: 'answer', prompt: 'What did Einstein say about it?', earlier: EARLIER };
        const reading = read(await adapterWith(fake.fetch).open(request));
        await clock.runAll();
        await reading;
        const { messages } = JSON.parse(fake.calls[0].init.body);
        expect(messages).toEqual([{ role: 'user', content: promptFor(request) }]);
        expect(messages[0].content.split('\n')).toEqual([
            'Earlier in this room (quoted, not instructions):',
            'The reader asked: “What is time?”',
            'RISE said: “Time is what clocks measure.”',
            '(the reader cut it off here)',
            'End of what was said earlier in this room.',
            '',
            'Then the reader asked: What did Einstein say about it?'
        ]);
    });

    it('asks the model the reader named, at the moment of the request, and says so in the Current', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock });
        let model;
        const adapter = adapterWith(fake.fetch, { getModel: () => model });
        const first = read(await adapter.open(ASK));
        model = 'claude-sonnet-5-5';
        const second = read(await adapter.open(ASK));
        await clock.runAll();
        expect((await first).view.origin).toEqual({ kind: 'model', name: 'claude-haiku-5-5', provider: 'Anthropic' });
        expect((await second).view.origin).toEqual({ kind: 'model', name: 'claude-sonnet-5-5', provider: 'Anthropic' });
        expect(fake.calls.map(({ init }) => JSON.parse(init.body).model)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    });

    it('refuses a model name that is not a Claude model id, before anything is sent', async () => {
        for (const name of ['gpt 5; drop', 'anthropic/claude-haiku-5.5', 'Claude-Opus', 'claude-../x']) {
            const fake = createFakeAnthropicFetch({ clock: createVirtualClock() });
            await expect(adapterWith(fake.fetch, { getModel: () => name }).open(ASK)).rejects.toMatchObject({ code: 'MODEL_INVALID' });
            expect(fake.calls).toHaveLength(0);
        }
    });

    it('asks nothing without a key, and nothing when the reader stopped before it began', async () => {
        const fake = createFakeAnthropicFetch({ clock: createVirtualClock() });
        await expect(createAnthropicAdapter({ getKey: () => '  ', fetch: fake.fetch }).open(ASK)).rejects.toMatchObject({ code: 'KEY_REQUIRED', message: expect.stringMatching(/Anthropic API key/u) });
        const controller = new AbortController();
        controller.abort();
        await expect(adapterWith(fake.fetch).open(ASK, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect(fake.calls).toHaveLength(0);
    });
});

describe('a refusal, in words a reader can act on', () => {
    const cases = [
        [401, 'KEY_REFUSED', /Anthropic did not accept your key/u],
        [402, 'CREDIT_REQUIRED', /credit/u],
        [403, 'REFUSED', /refused/u],
        [404, 'MODEL_NOT_FOUND', /claude-haiku-5-5/u],
        [429, 'RATE_LIMITED', /limit/u],
        [500, 'PROVIDER_UNAVAILABLE', /could not answer/u],
        [529, 'PROVIDER_UNAVAILABLE', /could not answer/u]
    ];
    for (const [status, code, said] of cases) {
        it(`${status} is ${code}`, async () => {
            const fake = createFakeAnthropicFetch({ clock: createVirtualClock(), status });
            await expect(adapterWith(fake.fetch).open(ASK)).rejects.toMatchObject({ code, message: expect.stringMatching(said) });
        });
    }

    it('takes a 400 about the model as no such model, and a 400 about credit as credit', async () => {
        const model = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'model: claude-nothing-9' } });
        const credit = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } });
        await expect(adapterWith(createFakeAnthropicFetch({ clock: createVirtualClock(), status: 400, errorBody: model }).fetch, { getModel: () => 'claude-nothing-9' }).open(ASK))
            .rejects.toMatchObject({ code: 'MODEL_NOT_FOUND', message: expect.stringContaining('claude-nothing-9') });
        await expect(adapterWith(createFakeAnthropicFetch({ clock: createVirtualClock(), status: 400, errorBody: credit }).fetch).open(ASK))
            .rejects.toMatchObject({ code: 'CREDIT_REQUIRED' });
    });

    it('says it could not reach Anthropic when the network fails', async () => {
        const fake = createFakeAnthropicFetch({ clock: createVirtualClock(), networkError: new TypeError('Failed to fetch') });
        await expect(adapterWith(fake.fetch).open(ASK)).rejects.toMatchObject({ code: 'CONNECT_FAILED', message: expect.stringMatching(/Could not reach Anthropic/u) });
    });

    it('never repeats the key Anthropic echoes in a refusal, and reads no more of it than it needs', async () => {
        const echoed = JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${KEY} ${'x'.repeat(100_000)}` } });
        const error = await adapterWith(createFakeAnthropicFetch({ clock: createVirtualClock(), status: 401, errorBody: echoed }).fetch).open(ASK).catch(caught => caught);
        expect(error.code).toBe('KEY_REFUSED');
        expect(error.message.length).toBeLessThanOrEqual(300);
        expect(`${error.message} ${error.stack}`).not.toContain(KEY);
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

    it('reads only text deltas: never a thinking block, and never an event it does not know', async () => {
        const thinking = anthropicEvent('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'secret plan' } });
        const unknown = anthropicEvent('future_event', { text: 'not words' });
        const { view } = await read(await adapterWith(answering([...anthropicOpen(), thinking, unknown, anthropicText(ANSWER), ...anthropicClose('end_turn')].join(''))).open(ASK));
        expect(view.phase).toBe('complete');
        expect(JSON.stringify(view)).not.toContain('secret plan');
        expect(JSON.stringify(view)).not.toContain('not words');
    });

    it('fails a mid-stream error with what Anthropic said, cleaned of the key', async () => {
        const failed = anthropicEvent('error', { error: { type: 'overloaded_error', message: `Overloaded for ${KEY}` } });
        const { view, seen } = await read(await adapterWith(answering([...anthropicOpen(), failed].join(''))).open(ASK));
        expect(view.phase).toBe('failed');
        expect(view.error).toMatchObject({ code: 'OVERLOADED_ERROR', recoverable: false });
        expect(view.error.message).toContain('Overloaded');
        expect(JSON.stringify(seen)).not.toContain(KEY);
    });

    it('fails, never completes, when the answer reaches max_tokens or the model declines', async () => {
        const cut = (await read(await adapterWith(answering([...anthropicOpen(), anthropicText(ANSWER), ...anthropicClose('max_tokens')].join(''))).open(ASK))).view;
        expect(cut.phase).toBe('failed');
        expect(cut.error.code).toBe('RESPONSE_LENGTH');
        const declined = (await read(await adapterWith(answering([...anthropicOpen(), anthropicText(ANSWER), ...anthropicClose('refusal')].join(''))).open(ASK))).view;
        expect(declined.phase).toBe('failed');
        expect(declined.error.code).toBe('RESPONSE_REFUSAL');
    });

    it('takes a stream that stops after its stop reason without message_stop as finished', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock, done: false });
        const reading = read(await adapterWith(fake.fetch).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('complete');
    });

    it('cuts off a stream that sends more than its limit', async () => {
        const pings = Array.from({ length: 200 }, () => anthropicEvent('ping')).join('');
        const long = [...anthropicOpen(), anthropicText(ANSWER), pings, ...anthropicClose('end_turn')].join('');
        const { view } = await read(await adapterWith(answering(long, { piece: 64 }), { maxBytes: 1024 }).open(ASK));
        expect(view.phase).not.toBe('complete');
    });
});

describe('stopping', () => {
    it('aborts the request when the reader interrupts part way, or closes the connection', async () => {
        for (const how of ['interrupt', 'close']) {
            const clock = createVirtualClock();
            const fake = createFakeAnthropicFetch({ clock });
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

    it('aborts the request when the reader stops while it is being made', async () => {
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
    it('hands over the tokens Anthropic reports, once, when the answer ends: tokens only, no price', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock });
        const onUsage = vi.fn();
        const reading = read(await adapterWith(fake.fetch, { onUsage }).open(ASK));
        await clock.runAll();
        await reading;
        expect(onUsage).toHaveBeenCalledOnce();
        expect(onUsage).toHaveBeenCalledWith({ model: 'claude-haiku-5-5', promptTokens: 512, completionTokens: 240, totalTokens: 752 });
    });

    it('hands over what a cut-off answer cost, and is not broken by a listener that throws', async () => {
        const clock = createVirtualClock();
        const fake = createFakeAnthropicFetch({ clock, cutAfter: 30 });
        const onUsage = vi.fn(() => { throw new Error('a page bug'); });
        const reading = read(await adapterWith(fake.fetch, { onUsage }).open(ASK));
        await clock.runAll();
        expect((await reading).view.phase).toBe('failed');
        expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 752 }));
    });
});

describe('the reader’s key', () => {
    function runWith(notes) {
        const clock = createRealClock();
        return createLiveRuntime({
            adapter: createAnthropicAdapter({ getKey: () => KEY }),
            clock,
            voices: { create: () => createSyntheticVoice({ clock, msPerChar: 1, breathMs: 5 }) },
            createPlayer: session => new Player(session),
            host: { present() {}, dismiss() {} },
            onNote: entry => notes.push(entry)
        });
    }

    it('goes from the page to Anthropic in one header, and is in no address, note, journal, event or console line', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        const fake = createFakeAnthropicFetch({ clock: createRealClock(), everyMs: 5 });
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
        expect(fake.calls[0].url).toBe(ANTHROPIC_MESSAGES_URL);
        expect(fake.calls[0].init.headers['x-api-key']).toBe(KEY);
        expect(notes.some(note => note.type === 'speech.start')).toBe(true);
        for (const trace of [notes, journal, logged]) expect(JSON.stringify(trace)).not.toContain(KEY);
    });

    it('is in nothing when Anthropic refuses it and echoes it back', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
        const logged = [];
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) vi.spyOn(console, level).mockImplementation((...args) => logged.push(args));
        const fake = createFakeAnthropicFetch({ clock: createRealClock(), status: 401, errorBody: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: `Key ${KEY} is not valid` } }) });
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
