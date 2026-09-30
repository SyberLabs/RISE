// @vitest-environment node
/**
 * The browser's `fetch`, as the Gemini transport.
 *
 * `fetch` is stubbed with responses built in Google's documented form (an error
 * is `{"error": {"code", "message", "status"}}`; an answer is server-sent
 * events). What is held: the key travels in one header and nowhere else, never
 * in a URL, a log, or an error; what a reader could type as a model cannot leave
 * the address; each way Google can refuse is said in words, with the key scrubbed
 * even if Google echoes it; a stream is read in whatever pieces it arrives in;
 * a stream that never ends is cut off; and Stop, before, during or after, stops
 * the request and leaves nothing running.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiFetchTransport } from './gemini-fetch.js';

const KEY = 'AIzaSyD-not-a-real-key-000000000000000';
const URL_OK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse';
const encoder = new TextEncoder();

/** A response whose body arrives in the given pieces (text or bytes). */
function streamed(pieces, { status = 200, headers = { 'Content-Type': 'text/event-stream' } } = {}) {
    let index = 0;
    const body = new ReadableStream({
        pull(controller) {
            if (index >= pieces.length) { controller.close(); return; }
            const piece = pieces[index];
            index += 1;
            controller.enqueue(typeof piece === 'string' ? encoder.encode(piece) : piece);
        }
    });
    return new Response(body, { status, headers });
}

const errorBody = (code, status, message, extra = {}) => JSON.stringify({ error: { code, message, status, ...extra } });
const json = (status, text) => new Response(text, { status, headers: { 'Content-Type': 'application/json' } });

function setup(respond, options = {}) {
    const calls = [];
    const fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return respond(url, init); });
    const transport = createGeminiFetchTransport({ getKey: () => KEY, getModel: () => undefined, fetch, ...options });
    return { transport, fetch, calls };
}

async function collect(connection) {
    const messages = [];
    let closes = 0;
    connection.onMessage(data => messages.push(data));
    connection.onClose(() => { closes += 1; });
    connection.start();
    for (let i = 0; i < 50 && closes === 0; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
    return { messages, closes: () => closes };
}

const spies = [];
afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });
const watchConsole = () => ['log', 'info', 'warn', 'error', 'debug'].map(name => { const spy = vi.spyOn(console, name).mockImplementation(() => {}); spies.push(spy); return spy; });

describe('the request', () => {
    it('is one POST to Google, with the key in one header and nowhere else', async () => {
        const { transport, calls } = setup(() => streamed(['data: {}\n\n']));
        await transport.open({ body: { contents: [], generationConfig: {} }, signal: undefined });
        expect(calls).toHaveLength(1);
        const { url, init } = calls[0];
        expect(url).toBe(URL_OK);
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': KEY });
        expect(url).not.toContain(KEY);
        expect(JSON.stringify(init.body)).not.toContain(KEY);
        expect(init.body).toBe(JSON.stringify({ contents: [], generationConfig: {} }));
    });

    it('sends no cookies, asks for nothing to be cached, and leaves the referrer to the browser', async () => {
        const { transport, calls } = setup(() => streamed([]));
        await transport.open({ body: {} });
        expect(calls[0].init).toMatchObject({ credentials: 'omit', cache: 'no-store', mode: 'cors' });
        // Google checks a key that was restricted to a site against the Referer header, so omitting it would
        // fail exactly the keys that are restricted as they should be, and hides nothing Origin does not already say.
        expect(calls[0].init).not.toHaveProperty('referrerPolicy');
    });

    it('uses the model it is told, in the address, and the default when it is told none', async () => {
        const named = setup(() => streamed([]), { getModel: () => 'gemini-2.0-pro' });
        await named.transport.open({ body: {} });
        expect(named.calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:streamGenerateContent?alt=sse');
        for (const empty of [undefined, '', null]) {
            const { transport, calls } = setup(() => streamed([]), { getModel: () => empty });
            await transport.open({ body: {} });
            expect(calls[0].url, String(empty)).toBe(URL_OK);
        }
    });

    it('refuses a model that could leave the address, before anything is sent', async () => {
        for (const model of ['../../evil', 'a/b', 'a?b=c', 'a#b', 'a:generateContent', 'A B', 'a'.repeat(65), '%2e%2e']) {
            const { transport, fetch } = setup(() => streamed([]), { getModel: () => model });
            await expect(transport.open({ body: {} }), model).rejects.toMatchObject({ code: 'MODEL_INVALID' });
            expect(fetch, model).not.toHaveBeenCalled();
        }
    });

    it('needs a key, and sends nothing without one', async () => {
        for (const key of ['', '   ', undefined, null, 5, {}]) {
            const { fetch } = setup(() => streamed([]));
            const transport = createGeminiFetchTransport({ getKey: () => key, fetch });
            await expect(transport.open({ body: {} }), String(key)).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
            expect(fetch).not.toHaveBeenCalled();
        }
    });

    it('asks for the key at every request, so a key that has been forgotten is not used again', async () => {
        let key = KEY;
        const fetch = vi.fn(async () => streamed([]));
        const transport = createGeminiFetchTransport({ getKey: () => key, fetch });
        await transport.open({ body: {} });
        expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe(KEY);
        key = 'a-second-key-0000000000000000';
        await transport.open({ body: {} });
        expect(fetch.mock.calls[1][1].headers['x-goog-api-key']).toBe('a-second-key-0000000000000000');
        key = '';
        await expect(transport.open({ body: {} })).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('asks for the key when it opens, not before, so a key that is forgotten is not used', async () => {
        let key = KEY;
        const fetch = vi.fn(async () => streamed([]));
        const transport = createGeminiFetchTransport({ getKey: () => key, fetch });
        key = '';
        await expect(transport.open({ body: {} })).rejects.toMatchObject({ code: 'KEY_REQUIRED' });
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('the answer', () => {
    it('hears each event, in whatever pieces the bytes arrive, even a character split across two', async () => {
        const text = 'data: {"t":"café 世界"}\r\n\r\ndata: {"t":2}\r\n\r\n';
        const bytes = encoder.encode(text);
        for (const pieces of [[text], [...text], Array.from(bytes, byte => new Uint8Array([byte])), [bytes.slice(0, 17), bytes.slice(17, 30), bytes.slice(30)]]) {
            const { transport } = setup(() => streamed(pieces));
            const seen = await collect(await transport.open({ body: {} }));
            expect(seen.messages).toEqual(['{"t":"café 世界"}', '{"t":2}']);
            expect(seen.closes()).toBe(1);
        }
    });

    it('reads nothing until it is started, so a handler is always in place first', async () => {
        const { transport } = setup(() => streamed(['data: a\n\n']));
        const connection = await transport.open({ body: {} });
        const messages = [];
        connection.onMessage(data => messages.push(data));
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(messages).toEqual([]);
        connection.start();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(messages).toEqual(['a']);
    });

    it('hands over the last event even when the server forgets its final blank line', async () => {
        const { transport } = setup(() => streamed(['data: a\n\ndata: b\n']));
        expect((await collect(await transport.open({ body: {} }))).messages).toEqual(['a', 'b']);
    });

    it('starts once, and does nothing when started again or after it is closed', async () => {
        const { transport, fetch } = setup(() => streamed(['data: a\n\n']));
        const connection = await transport.open({ body: {} });
        const messages = [];
        connection.onMessage(data => messages.push(data));
        connection.start();
        connection.start();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(messages).toEqual(['a']);
        expect(fetch).toHaveBeenCalledTimes(1);

        const closed = setup(() => streamed(['data: a\n\n']));
        const second = await closed.transport.open({ body: {} });
        const heard = [];
        second.onMessage(data => heard.push(data));
        second.close();
        second.start();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(heard).toEqual([]);
    });

    it('says the stream ended once, even if it is closed as well', async () => {
        const { transport } = setup(() => streamed(['data: a\n\n']));
        const connection = await transport.open({ body: {} });
        let closes = 0;
        connection.onClose(() => { closes += 1; });
        connection.onMessage(() => {});
        connection.start();
        await new Promise(resolve => setTimeout(resolve, 20));
        connection.close();
        connection.close();
        expect(closes).toBe(1);
    });

    it('says the stream ended when the network drops in the middle of it, and does not throw', async () => {
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: a\n\n'));
                queueMicrotask(() => controller.error(new TypeError('network error')));
            }
        });
        const { transport } = setup(() => new Response(body, { status: 200 }));
        const seen = await collect(await transport.open({ body: {} }));
        expect(seen.closes()).toBe(1);
        expect(seen.messages.length).toBeLessThanOrEqual(1);
    });

    it('never believes an event that was cut off by the network dropping', async () => {
        let reads = 0;
        const body = new ReadableStream({
            pull(controller) {
                reads += 1;
                if (reads === 1) controller.enqueue(encoder.encode('data: whole\n\ndata: {"part'));
                else controller.error(new TypeError('network error'));
            }
        });
        const { transport } = setup(() => new Response(body, { status: 200 }));
        const seen = await collect(await transport.open({ body: {} }));
        expect(seen.closes()).toBe(1);
        expect(seen.messages).toEqual(['whole']);
    });

    it('cuts off a stream that never ends, once it has sent more than an answer could be', async () => {
        const forever = new ReadableStream({ pull(controller) { controller.enqueue(encoder.encode(`data: ${'x'.repeat(1_000)}\n\n`)); } });
        const { transport, calls } = setup(() => new Response(forever, { status: 200 }));
        const seen = await collect(await transport.open({ body: {} }));
        expect(seen.closes()).toBe(1);
        expect(calls[0].init.signal.aborted).toBe(true);
    });
});

describe('when Google refuses', () => {
    const CASES = [
        [400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.', { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] }, 'KEY_REFUSED'],
        [400, 'INVALID_ARGUMENT', 'API key expired. Please renew the API key.', {}, 'KEY_REFUSED'],
        [401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.', {}, 'KEY_REFUSED'],
        [403, 'PERMISSION_DENIED', 'Method doesn’t allow unregistered callers.', {}, 'KEY_REFUSED'],
        [404, 'NOT_FOUND', 'models/nope is not found for API version v1beta.', {}, 'MODEL_NOT_FOUND'],
        [429, 'RESOURCE_EXHAUSTED', 'You exceeded your current quota.', {}, 'RATE_LIMITED'],
        [400, 'INVALID_ARGUMENT', 'Request contains an invalid argument.', {}, 'BAD_REQUEST'],
        [500, 'INTERNAL', 'An internal error has occurred.', {}, 'PROVIDER_UNAVAILABLE'],
        [503, 'UNAVAILABLE', 'The model is overloaded.', {}, 'PROVIDER_UNAVAILABLE']
    ];
    for (const [status, name, message, extra, code] of CASES) {
        it(`${status} ${name} is said as ${code}, in Google's words`, async () => {
            const { transport } = setup(() => json(status, errorBody(status, name, message, extra)));
            const error = await transport.open({ body: {} }).catch(problem => problem);
            expect(error.code).toBe(code);
            expect(error.message).toContain(message.slice(0, 40));
            expect(error.message).not.toContain(KEY);
        });
    }

    it('says something plain when the answer is not Google’s own kind of error', async () => {
        for (const [status, text] of [[502, '<html><body>Bad gateway</body></html>'], [500, ''], [418, 'not json'], [400, '{"error":'], [403, 'null'], [400, '[]']]) {
            const { transport } = setup(() => new Response(text, { status }));
            const error = await transport.open({ body: {} }).catch(problem => problem);
            expect(error.code, `${status} ${text}`).toMatch(/^[A-Z_]+$/u);
            expect(error.message).toMatch(/[a-z]{4}/u);
            expect(error.message).not.toMatch(/<html|undefined|\[object/u);
        }
    });

    it('never says the key, even when Google says it back, and clips what it says', async () => {
        const echoed = errorBody(400, 'INVALID_ARGUMENT', `API key not valid: ${KEY}. ${'long '.repeat(500)}`);
        const { transport } = setup(() => json(400, echoed));
        const error = await transport.open({ body: {} }).catch(problem => problem);
        expect(error.message).not.toContain(KEY);
        expect(error.message).not.toContain(KEY.slice(0, 12));
        expect(error.message.length).toBeLessThanOrEqual(400);
    });

    it('scrubs the reader’s own key when it is not shaped like a Google key, and a Google-shaped key that is not theirs', async () => {
        const odd = 'not-shaped-like-anything-1234567890';
        const other = 'AIzaSyOTHERKEYOTHERKEYOTHERKEYOTHERKEY1';
        const fetch = async () => json(400, errorBody(400, 'INVALID_ARGUMENT', `bad ${odd} and ${other} here`));
        const transport = createGeminiFetchTransport({ getKey: () => odd, fetch });
        const error = await transport.open({ body: {} }).catch(problem => problem);
        expect(error.message).not.toContain(odd);
        expect(error.message).not.toContain(other);
        expect(error.message).toContain('[key]');
    });

    it('reads no more of an error than an error could be', async () => {
        let read = 0;
        const endless = new ReadableStream({ pull(controller) { read += 1; controller.enqueue(encoder.encode('x'.repeat(10_000))); } });
        const { transport } = setup(() => new Response(endless, { status: 500 }));
        await transport.open({ body: {} }).catch(() => {});
        expect(read).toBeLessThan(20);
    });

    it('says what went wrong, without the key, when the network cannot reach Google at all', async () => {
        const { transport } = setup(() => { throw new TypeError(`Failed to fetch (${KEY})`); });
        const error = await transport.open({ body: {} }).catch(problem => problem);
        expect(error.code).toBe('CONNECT_FAILED');
        expect(error.message).toContain('Failed to fetch');
        expect(error.message).not.toContain(KEY);
    });

    it('says there is no answer to read when Google answers with no body', async () => {
        const { transport } = setup(() => ({ ok: true, status: 200, body: null, headers: new Headers() }));
        await expect(transport.open({ body: {} })).rejects.toMatchObject({ code: 'CONNECT_FAILED' });
    });
});

describe('what the connection lets the adapter scrub with', () => {
    it('scrubs the reader’s own key, and any Google-shaped key, from whatever it is given', async () => {
        const { transport } = setup(() => streamed([]));
        const connection = await transport.open({ body: {} });
        expect(connection.scrub(`a ${KEY} b AIzaSyOTHERKEYOTHERKEYOTHERKEYOTHERKEY1 c`)).toBe('a [key] b [key] c');
        expect(connection.scrub('nothing to hide')).toBe('nothing to hide');
    });

    it('knows the key the request was made with, and not another', async () => {
        const first = setup(() => streamed([]));
        const second = createGeminiFetchTransport({ getKey: () => 'a-second-key-0000000000000000', fetch: async () => streamed([]) });
        const a = await first.transport.open({ body: {} });
        const b = await second.open({ body: {} });
        expect(a.scrub(KEY)).toBe('[key]');
        expect(a.scrub('a-second-key-0000000000000000')).toBe('a-second-key-0000000000000000');
        expect(b.scrub('a-second-key-0000000000000000')).toBe('[key]');
    });
});

describe('Stop after Google has refused', () => {
    /** A refusal whose body never finishes. `reacts` says whether the body notices the request being stopped, as a real one does. */
    function stalled({ reacts }) {
        return (url, init) => new Response(new ReadableStream({
            start(controller) {
                if (reacts) init.signal.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
            },
            pull: () => new Promise(() => {})
        }), { status: 503 });
    }

    for (const reacts of [false, true]) {
        it(`lets go of a stalled refusal when stopped, whether or not the body notices (${reacts ? 'it does' : 'it does not'}), and says it was stopped`, async () => {
            const controller = new AbortController();
            const { transport, calls } = setup(stalled({ reacts }));
            const opening = transport.open({ body: {}, signal: controller.signal });
            let settled = null;
            opening.then(() => { settled = 'resolved'; }, error => { settled = error.code; });
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(settled).toBeNull();
            controller.abort();
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(settled).toBe('ABORTED');
            expect(calls[0].init.signal.aborted).toBe(true);
        });
    }

    it('still says why Google refused when nothing stops it, and does not keep listening afterwards', async () => {
        const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const { transport } = setup(() => json(503, errorBody(503, 'UNAVAILABLE', 'The model is overloaded.')));
        const error = await transport.open({ body: {}, signal }).catch(problem => problem);
        expect(error.code).toBe('PROVIDER_UNAVAILABLE');
        expect(signal.addEventListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
        expect(signal.removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('keeps listening for Stop until the refusal has been read, and not a moment less', async () => {
        const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        let finish;
        const body = new ReadableStream({
            start(controller) { finish = () => { controller.enqueue(encoder.encode(errorBody(503, 'UNAVAILABLE', 'Overloaded.'))); controller.close(); }; }
        });
        const { transport } = setup(() => new Response(body, { status: 503 }));
        const opening = transport.open({ body: {}, signal }).catch(problem => problem);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(signal.removeEventListener).not.toHaveBeenCalled();
        finish();
        expect((await opening).code).toBe('PROVIDER_UNAVAILABLE');
        expect(signal.removeEventListener).toHaveBeenCalledTimes(1);
    });
});

describe('the key is never written anywhere', () => {
    it('is not logged, whatever happens', async () => {
        const console_ = watchConsole();
        for (const respond of [() => streamed(['data: a\n\n']), () => json(400, errorBody(400, 'INVALID_ARGUMENT', `bad ${KEY}`)), () => { throw new TypeError(KEY); }]) {
            const { transport } = setup(respond);
            try { await collect(await transport.open({ body: {} })); } catch { /* said in words */ }
        }
        for (const spy of console_) expect(spy).not.toHaveBeenCalled();
    });
});

describe('Stop', () => {
    it('sends nothing when it was stopped before', async () => {
        const { transport, fetch } = setup(() => streamed([]));
        const controller = new AbortController();
        controller.abort();
        await expect(transport.open({ body: {}, signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('stops the request while it is still being made, and says it was stopped, not that it failed', async () => {
        const controller = new AbortController();
        const { transport } = setup((url, init) => new Promise((resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })));
        }));
        const opening = transport.open({ body: {}, signal: controller.signal });
        controller.abort();
        await expect(opening).rejects.toMatchObject({ code: 'ABORTED' });
    });

    it('stops the request, the reading, and the stream when the connection is closed', async () => {
        let cancelled = false;
        const body = new ReadableStream({ pull: () => new Promise(() => {}), cancel() { cancelled = true; } });
        const { transport, calls } = setup(() => new Response(body, { status: 200 }));
        const connection = await transport.open({ body: {} });
        let closes = 0;
        connection.onClose(() => { closes += 1; });
        connection.onMessage(() => {});
        connection.start();
        await new Promise(resolve => setTimeout(resolve, 10));
        connection.close();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(calls[0].init.signal.aborted).toBe(true);
        expect(cancelled).toBe(true);
        expect(closes).toBe(1);
    });

    it('stops the request when the runtime’s signal aborts after it is open', async () => {
        const controller = new AbortController();
        const body = new ReadableStream({ pull: () => new Promise(() => {}) });
        const { transport, calls } = setup(() => new Response(body, { status: 200 }));
        const connection = await transport.open({ body: {}, signal: controller.signal });
        connection.onMessage(() => {});
        connection.onClose(() => {});
        connection.start();
        controller.abort();
        expect(calls[0].init.signal.aborted).toBe(true);
    });

    it('does not keep listening to a signal it no longer needs', async () => {
        const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const { transport } = setup(() => streamed(['data: a\n\n']));
        const connection = await transport.open({ body: {}, signal });
        const seen = await collect(connection);
        connection.close();
        expect(seen.closes()).toBe(1);
        expect(signal.removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
    });
});
