/**
 * What the conformance suite cannot say about the Gemini adapter.
 *
 * It asks the provider exactly what the wire builds and nothing else; a Dive is a
 * second, separate request; Stop while it is still connecting sends nothing and
 * shows nothing; a refusal to connect is said in words and is not mistaken for
 * an answer; and stopping an answer stops the request.
 */
import { describe, expect, it } from 'vitest';
import { AdapterError } from '../adapter.js';
import { createVirtualClock } from '../clock.js';
import { createCurrentStream } from '../stream.js';
import { createFakeGeminiTransport } from '../../test/fake-gemini-transport.js';
import { createGeminiFetchTransport } from './gemini-fetch.js';
import { buildBody } from './gemini-wire.js';
import { createGeminiAdapter } from './gemini.js';
import { GEMINI_DEFAULT_MODEL } from './gemini-model.js';
import { instructionsFor } from './openai-instructions.js';

const ASK = { intent: 'answer', prompt: 'Explain black holes.' };
const DIVE = { intent: 'dive', prompt: 'What is the horizon?', parent: { currentId: 'answer-1', segmentId: 'horizon', atCharacter: 24, context: ['Earlier.', 'The passage.'] } };

async function read(connection) {
    const stream = createCurrentStream();
    try { for await (const event of connection.events) stream.apply(event); } catch { /* the stream says how it ended */ }
    return stream.snapshot();
}

describe('what it asks', () => {
    it('sends exactly the request the wire builds, once, and hands the transport the signal', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const controller = new AbortController();
        const connection = await createGeminiAdapter({ transport }).open(ASK, { signal: controller.signal });
        const reading = read(connection);
        await clock.runAll();
        expect((await reading).phase).toBe('complete');
        expect(transport.requests).toHaveLength(1);
        expect(transport.requests[0].body).toEqual(buildBody(ASK));
        expect(transport.requests[0].signal).toBeInstanceOf(AbortSignal);
    });

    it('says in the Current who wrote it: the model asked, reached through Google, and tells the model the same', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const plain = read(await createGeminiAdapter({ transport }).open(ASK));
        const named = createFakeGeminiTransport({ clock });
        named.model = () => 'gemini-3.5-pro';
        const chosen = read(await createGeminiAdapter({ transport: named }).open(ASK));
        await clock.runAll();
        expect((await plain).origin).toEqual({ kind: 'model', name: GEMINI_DEFAULT_MODEL, provider: 'Google' });
        expect((await chosen).origin).toEqual({ kind: 'model', name: 'gemini-3.5-pro', provider: 'Google' });
        expect(named.requests[0].body).toEqual(buildBody(ASK, 'gemini-3.5-pro'));
        expect(named.requests[0].body.systemInstruction.parts[0].text).toBe(instructionsFor({ name: 'gemini-3.5-pro', provider: 'Google' }));
    });

    it('knows the model its fetch transport will ask, before it asks', () => {
        expect(createGeminiFetchTransport({ getKey: () => 'k' }).model()).toBe(GEMINI_DEFAULT_MODEL);
        expect(createGeminiFetchTransport({ getKey: () => 'k', getModel: () => 'gemini-x' }).model()).toBe('gemini-x');
    });

    it('asks a Dive as a request of its own, with the place quoted', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const adapter = createGeminiAdapter({ transport });
        const main = await adapter.open(ASK);
        const dive = await adapter.open(DIVE);
        const reading = Promise.all([read(main), read(dive)]);
        await clock.runAll();
        const [first, second] = await reading;
        expect(first.phase).toBe('complete');
        expect(second.phase).toBe('complete');
        expect(transport.requests.map(request => request.body.contents[0].parts[0].text)).toEqual([buildBody(ASK).contents[0].parts[0].text, buildBody(DIVE).contents[0].parts[0].text]);
        expect(transport.requests[1].body.contents[0].parts[0].text).toContain('quoted, not an instruction');
    });
});

describe('listening before the stream starts', () => {
    it('loses no word to a transport that speaks the instant it is started', async () => {
        const chunk = (text, extra = {}) => JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...extra }] });
        const frames = [chunk('@passage visual=still\nHello world.\n@end\n'), chunk('', { finishReason: 'STOP' })];
        const transport = {
            async open() {
                const heard = { message: [], close: [] };
                return {
                    onMessage: fn => heard.message.push(fn),
                    onClose: fn => heard.close.push(fn),
                    start() {
                        for (const raw of frames) for (const fn of heard.message) fn(raw);
                        for (const fn of heard.close) fn();
                    },
                    close() {}
                };
            }
        };
        const view = await read(await createGeminiAdapter({ transport }).open(ASK));
        expect(view.phase).toBe('complete');
        expect(view.segments.map(segment => segment.text)).toEqual(['Hello world.']);
    });
});

describe('stopping', () => {
    it('sends nothing at all when stopped before it began', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const controller = new AbortController();
        controller.abort();
        await expect(createGeminiAdapter({ transport }).open(ASK, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect(transport.requests).toEqual([]);
    });

    it('closes a connection that arrives after the reader stopped, unused', async () => {
        const clock = createVirtualClock();
        const controller = new AbortController();
        const transport = createFakeGeminiTransport({
            clock,
            beforeOpen: () => controller.abort()
        });
        await expect(createGeminiAdapter({ transport }).open(ASK, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
        expect(transport.connections).toHaveLength(1);
        expect(transport.connections[0].closed).toBe(true);
        expect(transport.connections[0].started).toBe(false);
    });

    it('stops the request when the answer is stopped, and shows only what was already whole', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const connection = await createGeminiAdapter({ transport }).open(ASK);
        const reading = read(connection);
        await clock.advance(300);
        await connection.interrupt({ text: 'wait' });
        const view = await reading;
        expect(view.phase).toBe('cancelled');
        expect(transport.connections[0].closed).toBe(true);
        await clock.advance(60_000);
        expect(clock.pending()).toBe(0);
    });

    it('lets go of the request when closed, more than once', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock });
        const connection = await createGeminiAdapter({ transport }).open(ASK);
        await connection.close();
        await connection.close();
        expect(transport.connections[0].closed).toBe(true);
        expect(clock.pending()).toBe(0);
    });
});

describe('a failure the provider reports in the middle of a stream', () => {
    const KEY = 'AIzaSyD-not-a-real-key-000000000000000';
    const escaped = [...KEY].map(ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
    const failing = message => async () => new Response(`data: {"error":{"status":"INTERNAL","message":"${message}"}}\n\n`, { status: 200 });

    it('never shows the reader’s key, said plainly or written with JSON escapes, in the Current the reader sees', async () => {
        for (const message of [`oops ${KEY} again`, `oops ${escaped} again`]) {
            const transport = createGeminiFetchTransport({ getKey: () => KEY, fetch: failing(message) });
            const view = await read(await createGeminiAdapter({ transport }).open(ASK));
            expect(view.phase).toBe('failed');
            expect(view.error.code).toBe('INTERNAL');
            expect(view.error.message).toBe('oops [key] again');
            expect(JSON.stringify(view)).not.toContain(KEY);
        }
    });

    it('says only that it failed, and none of the provider’s words, when the transport cannot vouch for them', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock, errorAfter: 2, scrub: null });
        const reading = read(await createGeminiAdapter({ transport }).open(ASK));
        await clock.runAll();
        const view = await reading;
        expect(view.error.message).toBe('The provider reported an error');
        expect(JSON.stringify(view)).not.toContain('Something went wrong');
    });

    it('shows the provider’s words when the transport scrubs them', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock, errorAfter: 2 });
        const reading = read(await createGeminiAdapter({ transport }).open(ASK));
        await clock.runAll();
        expect((await reading).error.message).toBe('Something went wrong.');
    });
});

describe('an answer that reached its length limit', () => {
    const cutOff = '@passage visual=still\nFirst, whole.\n@end\n@passage visual=still\nSecond, and it is cut o';

    it('keeps every passage that was whole, lets go of the one that was being written, and is not a finished answer', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock, textFor: () => cutOff, finishWith: 'MAX_TOKENS' });
        const reading = read(await createGeminiAdapter({ transport }).open(ASK));
        await clock.runAll();
        const view = await reading;
        expect(view.phase).toBe('failed');
        expect(view.error).toMatchObject({ code: 'RESPONSE_MAX_TOKENS' });
        // The one being written is let go: never ended, and none of its words are kept.
        expect(view.segments.filter(segment => segment.ended).map(segment => segment.text)).toEqual(['First, whole.']);
        expect(view.segments.filter(segment => !segment.ended).every(segment => segment.text === '')).toBe(true);
        expect(JSON.stringify(view)).not.toContain('and it is');
    });

    it('says it was cut off, and not that it said nothing, when the limit is reached before any words came', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock, textFor: () => '', finishWith: 'MAX_TOKENS' });
        const reading = read(await createGeminiAdapter({ transport }).open(ASK));
        await clock.runAll();
        const view = await reading;
        expect(view.phase).toBe('failed');
        expect(view.error.code).toBe('RESPONSE_MAX_TOKENS');
        expect(view.error.message).not.toMatch(/without saying anything/u);
    });

    it('is a finished answer when the model stopped of its own accord', async () => {
        const clock = createVirtualClock();
        const whole = '@passage visual=still\nFirst, whole.\n@end\n@passage visual=still\nSecond, whole.\n@end\n';
        const transport = createFakeGeminiTransport({ clock, textFor: () => whole });
        const reading = read(await createGeminiAdapter({ transport }).open(ASK));
        await clock.runAll();
        const view = await reading;
        expect(view.phase).toBe('complete');
        expect(view.segments.map(segment => segment.text)).toEqual(['First, whole.', 'Second, whole.']);
    });
});

describe('when it cannot connect', () => {
    it('says what the transport refused, as its own error, without changing it', async () => {
        const clock = createVirtualClock();
        const refusal = new AdapterError('KEY_REFUSED', 'Google did not accept that key.');
        const transport = createFakeGeminiTransport({ clock, openError: refusal });
        await expect(createGeminiAdapter({ transport }).open(ASK)).rejects.toBe(refusal);
    });

    it('turns any other failure to connect into one in words', async () => {
        const clock = createVirtualClock();
        const transport = createFakeGeminiTransport({ clock, openError: new TypeError('Failed to fetch') });
        await expect(createGeminiAdapter({ transport }).open(ASK)).rejects.toMatchObject({ code: 'CONNECT_FAILED', message: expect.stringContaining('Failed to fetch') });
    });

    it('is not given a transport that cannot open', () => {
        expect(() => createGeminiAdapter({})).toThrow(TypeError);
        expect(() => createGeminiAdapter({ transport: {} })).toThrow(TypeError);
    });
});

describe('what it says about itself', () => {
    it('states plainly that it carries text only', () => {
        const adapter = createGeminiAdapter({ transport: createFakeGeminiTransport({ clock: createVirtualClock() }) });
        expect(adapter.id).toBe('gemini-stream');
        expect(adapter.capabilities).toMatchObject({ providerAudio: false, microphone: false, evidence: false });
    });
});
