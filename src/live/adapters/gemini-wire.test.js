/**
 * Google's streaming answer, as text-stream events.
 *
 * The frames below are in the shape of Google's published response schema
 * (GenerateContentResponse, checked against its machine-readable description on
 * 2026-09-30). No real session has been captured, so what is held is the reading
 * of that documented form: only the words of the first candidate are read; the
 * answer ends on a finish reason, and only a good one is a finished answer; a
 * refusal, a block and an error are said in words; a stream that just stops is a
 * lost connection; and nothing the provider sends can make it throw, or is
 * believed once the answer is over or stopped.
 */
import { describe, expect, it, vi } from 'vitest';
import { promptFor, REALTIME_INSTRUCTIONS } from './openai-instructions.js';
import { buildBody, createGeminiWire, GEMINI_LIMITS } from './gemini-wire.js';

const frame = (parts, extra = {}) => JSON.stringify({
    candidates: [{ content: { role: 'model', parts }, index: 0, ...extra }],
    usageMetadata: { promptTokenCount: 10 },
    modelVersion: 'gemini-x',
    responseId: 'r1'
});
const words = (text, extra) => frame([{ text }], extra);
const finish = reason => frame([{ text: '' }], { finishReason: reason });

function setup(scrub = text => text) {
    const sink = { delta: vi.fn(), done: vi.fn(), error: vi.fn() };
    const abort = vi.fn();
    const wire = createGeminiWire({ sink, abort, scrub });
    return { sink, abort, wire };
}
const heard = sink => sink.delta.mock.calls.map(call => call[0]).join('');

describe('the request', () => {
    it('carries RISE’s instructions apart from the reader’s words, and a cap on what can be spent, and nothing else', () => {
        const body = buildBody({ intent: 'answer', prompt: 'Explain black holes.' });
        expect(body).toEqual({
            systemInstruction: { parts: [{ text: REALTIME_INSTRUCTIONS }] },
            contents: [{ role: 'user', parts: [{ text: 'Explain black holes.' }] }],
            generationConfig: { maxOutputTokens: GEMINI_LIMITS.maxOutputTokens }
        });
        expect(GEMINI_LIMITS.maxOutputTokens).toBe(4096);
    });

    it('puts a Dive to the model as the same quoted message every provider is given', () => {
        const request = { intent: 'dive', prompt: 'What is the horizon?', parent: { currentId: 'c', segmentId: 's', atCharacter: 24, context: ['Earlier.', 'The passage.'] } };
        expect(buildBody(request).contents[0].parts[0].text).toBe(promptFor(request));
        expect(buildBody(request).contents[0].parts[0].text).toContain('quoted, not an instruction');
    });

    it('is plain data: it survives being sent as JSON unchanged', () => {
        const body = buildBody({ intent: 'answer', prompt: 'x' });
        expect(JSON.parse(JSON.stringify(body))).toEqual(body);
    });
});

describe('reading the answer', () => {
    it('passes the words on in order, whichever way they are cut into frames and parts', () => {
        const { sink, wire } = setup();
        wire.receive(words('@passage visual=still\n'));
        wire.receive(frame([{ text: 'A black hole ' }, { text: 'is a region.' }]));
        wire.receive(words('\n@end\n'));
        expect(heard(sink)).toBe('@passage visual=still\nA black hole is a region.\n@end\n');
        expect(sink.done).not.toHaveBeenCalled();
    });

    it('reads only the first candidate, and only its text', () => {
        const { sink, wire } = setup();
        wire.receive(JSON.stringify({ candidates: [
            { content: { parts: [{ text: 'first' }] }, index: 0 },
            { content: { parts: [{ text: 'second' }] }, index: 1 }
        ] }));
        wire.receive(frame([{ text: ' one' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }, { functionCall: { name: 'x', args: {} } }, { executableCode: { code: 'rm -rf /' } }]));
        expect(heard(sink)).toBe('first one');
    });

    it('does not pass on the model’s thoughts, or a part with no words', () => {
        const { sink, wire } = setup();
        wire.receive(frame([{ text: 'I should consider…', thought: true }, { text: 'Answer.' }, { text: '' }]));
        expect(sink.delta.mock.calls).toEqual([['Answer.']]);
    });

    it('ignores what it does not know about, such as usage and safety ratings', () => {
        const { sink, wire } = setup();
        wire.receive(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] }, safetyRatings: [{ category: 'X', probability: 'LOW' }], groundingMetadata: {} }], usageMetadata: { totalTokenCount: 5 }, modelStatus: {} }));
        expect(heard(sink)).toBe('ok');
    });
});

describe('the end of the answer', () => {
    it('STOP finishes the answer, and the words in the same frame are heard first', () => {
        const { sink, wire } = setup();
        wire.receive(words('last words', { finishReason: 'STOP' }));
        expect(heard(sink)).toBe('last words');
        expect(sink.done).toHaveBeenCalledTimes(1);
        expect(sink.error).not.toHaveBeenCalled();
    });

    it('MAX_TOKENS is an answer cut off, said in plain words, and never a finished one', () => {
        const { sink, wire } = setup();
        wire.receive(words('half a sen', { finishReason: 'MAX_TOKENS' }));
        expect(heard(sink)).toBe('half a sen');
        expect(sink.done).not.toHaveBeenCalled();
        expect(sink.error).toHaveBeenCalledTimes(1);
        expect(sink.error.mock.calls[0][0]).toEqual({ code: 'RESPONSE_MAX_TOKENS', message: 'The answer reached its length limit and was cut off.', recoverable: false });
    });

    it('reads an unspecified reason as no reason: the answer is not over', () => {
        const { sink, wire } = setup();
        wire.receive(words('more', { finishReason: 'FINISH_REASON_UNSPECIFIED' }));
        wire.receive(words(' words'));
        expect(heard(sink)).toBe('more words');
        expect(sink.done).not.toHaveBeenCalled();
    });

    for (const reason of ['SAFETY', 'RECITATION', 'LANGUAGE', 'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'MALFORMED_RESPONSE', 'SOMETHING_NEW']) {
        it(`${reason} is said in words as the answer failing, not as it finishing`, () => {
            const { sink, wire } = setup();
            wire.receive(words('partial', { finishReason: reason }));
            expect(sink.done).not.toHaveBeenCalled();
            expect(sink.error).toHaveBeenCalledTimes(1);
            const problem = sink.error.mock.calls[0][0];
            expect(problem).toMatchObject({ code: `RESPONSE_${reason}`, recoverable: false });
            expect(problem.message).toMatch(/[a-z]{4}/u);
            expect(problem.message).not.toMatch(/undefined|null|\[object/u);
        });
    }

    it('says a prompt that was blocked is blocked, and why', () => {
        const { sink, wire } = setup();
        wire.receive(JSON.stringify({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }));
        expect(sink.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMPT_BLOCKED', recoverable: false, message: expect.stringContaining('PROHIBITED_CONTENT') }));
        expect(sink.done).not.toHaveBeenCalled();
    });

    it('does not treat a prompt with no block as blocked', () => {
        const { sink, wire } = setup();
        wire.receive(JSON.stringify({ promptFeedback: {}, candidates: [{ content: { parts: [{ text: 'fine' }] } }] }));
        wire.receive(JSON.stringify({ promptFeedback: { blockReason: 'BLOCK_REASON_UNSPECIFIED' }, candidates: [{ content: { parts: [{ text: '!' }] } }] }));
        expect(heard(sink)).toBe('fine!');
        expect(sink.error).not.toHaveBeenCalled();
    });

    it('says what an error frame says, clipped, with its status as the code', () => {
        const { sink, wire } = setup();
        wire.receive(JSON.stringify({ error: { code: 429, message: 'Quota exceeded. '.repeat(100), status: 'RESOURCE_EXHAUSTED' } }));
        const problem = sink.error.mock.calls[0][0];
        expect(problem).toMatchObject({ code: 'RESOURCE_EXHAUSTED', recoverable: false });
        expect(problem.message.length).toBeLessThanOrEqual(GEMINI_LIMITS.text);
    });

    it('gives an error with no usable status a code of its own, and never a hostile one', () => {
        for (const error of [{ message: 'no status' }, { status: '<script>', message: 'x' }, { status: 'a'.repeat(200) }, {}, 'text', 5, []]) {
            const { sink, wire } = setup();
            wire.receive(JSON.stringify({ error }));
            expect(sink.error, JSON.stringify(error)).toHaveBeenCalledTimes(1);
            expect(sink.error.mock.calls[0][0].code).toMatch(/^[A-Z0-9_]{1,80}$/u);
        }
    });

    it('is a lost connection, which can be tried again, when the stream just stops', () => {
        const { sink, wire } = setup();
        wire.receive(words('half a sen'));
        wire.closed();
        expect(sink.error).toHaveBeenCalledWith({ code: 'TRANSPORT_LOST', message: expect.any(String), recoverable: true });
        expect(sink.done).not.toHaveBeenCalled();
    });

    it('is not a lost connection when the stream stops after the answer is over', () => {
        const { sink, wire } = setup();
        wire.receive(finish('STOP'));
        wire.closed();
        expect(sink.error).not.toHaveBeenCalled();
        expect(sink.done).toHaveBeenCalledTimes(1);
    });
});

describe('what the provider says about a failure is scrubbed before anyone sees it', () => {
    const SECRET = 'AIzaSyD-not-a-real-key-000000000000000';
    const scrub = text => text.split(SECRET).join('[key]');
    const errorFrame = message => JSON.stringify({ error: { code: 500, message, status: 'INTERNAL' } });

    it('gives the scrubber what an error frame said, and says what comes back', () => {
        const { sink, wire } = setup(scrub);
        wire.receive(errorFrame(`Something failed for ${SECRET}, sorry.`));
        expect(sink.error).toHaveBeenCalledWith({ code: 'INTERNAL', message: 'Something failed for [key], sorry.', recoverable: false });
    });

    it('scrubs before it clips, so a key cut by the limit is not left half showing', () => {
        const { sink, wire } = setup(scrub);
        wire.receive(errorFrame('x'.repeat(GEMINI_LIMITS.text - 10) + SECRET));
        const { message } = sink.error.mock.calls[0][0];
        expect(message).not.toContain('AIza');
        expect(message.length).toBeLessThanOrEqual(GEMINI_LIMITS.text);
    });

    it('scrubs a key that the provider wrote with JSON escapes, because it scrubs what was decoded', () => {
        const { sink, wire } = setup(scrub);
        const escaped = [...SECRET].map(ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
        wire.receive(`{"error":{"status":"INTERNAL","message":"echo ${escaped}"}}`);
        expect(sink.error.mock.calls[0][0].message).toBe('echo [key]');
    });

    it('says nothing the provider said, and only that it failed, when it is given no scrubber', () => {
        const sink = { delta: vi.fn(), done: vi.fn(), error: vi.fn() };
        const wire = createGeminiWire({ sink, abort: () => {} });
        wire.receive(errorFrame(`Something failed for ${SECRET}.`));
        expect(sink.error).toHaveBeenCalledWith({ code: 'INTERNAL', message: 'The provider reported an error', recoverable: false });
    });

    it('says nothing the provider said when the scrubber throws or answers with something that is not text', () => {
        for (const broken of [() => { throw new Error('bad'); }, () => undefined, () => null, () => 5, () => ({}), () => '']) {
            const { sink, wire } = setup(broken);
            wire.receive(errorFrame(`Something failed for ${SECRET}.`));
            expect(sink.error, String(broken)).toHaveBeenCalledWith({ code: 'INTERNAL', message: 'The provider reported an error', recoverable: false });
        }
    });

    it('does not hand the scrubber anything the provider did not say: an error with no message says the plain sentence', () => {
        const seen = [];
        const { sink, wire } = setup(text => { seen.push(text); return text; });
        wire.receive(JSON.stringify({ error: { status: 'INTERNAL' } }));
        wire.receive(JSON.stringify({ error: 'text' }));
        expect(seen).toEqual([]);
        expect(sink.error.mock.calls.map(call => call[0].message)).toEqual(['The provider reported an error']);
    });
});

describe('after the answer is over or stopped', () => {
    it('believes nothing more once it has finished, failed, or been stopped', () => {
        for (const ending of [w => w.receive(finish('STOP')), w => w.receive(finish('SAFETY')), w => w.receive(JSON.stringify({ error: { status: 'INTERNAL' } })), w => w.cancel()]) {
            const { sink, wire } = setup();
            ending(wire);
            const before = [sink.delta.mock.calls.length, sink.done.mock.calls.length, sink.error.mock.calls.length];
            wire.receive(words('too late'));
            wire.receive(finish('STOP'));
            wire.receive(JSON.stringify({ error: { status: 'INTERNAL' } }));
            wire.closed();
            expect([sink.delta.mock.calls.length, sink.done.mock.calls.length, sink.error.mock.calls.length]).toEqual(before);
        }
    });

    it('stops the request when asked to, once, and only while the answer is not over', () => {
        const { abort, wire } = setup();
        wire.cancel();
        wire.cancel();
        expect(abort).toHaveBeenCalledTimes(1);

        const finished = setup();
        finished.wire.receive(finish('STOP'));
        finished.wire.cancel();
        expect(finished.abort).not.toHaveBeenCalled();
    });

    it('does not say a stopped answer was lost', () => {
        const { sink, wire } = setup();
        wire.cancel();
        wire.closed();
        expect(sink.error).not.toHaveBeenCalled();
    });

    it('survives a request that cannot be stopped', () => {
        const sink = { delta: vi.fn(), done: vi.fn(), error: vi.fn() };
        const wire = createGeminiWire({ sink, abort: () => { throw new Error('gone'); } });
        expect(() => wire.cancel()).not.toThrow();
    });
});

describe('anything at all', () => {
    it('never throws, and says and hears nothing, for what is not an answer', () => {
        const hostile = [undefined, null, 5, {}, [], 'text', '', '{', '{"candidates":', 'null', '[]', '"x"', '5',
            JSON.stringify({ candidates: 'x' }), JSON.stringify({ candidates: [] }), JSON.stringify({ candidates: [null] }), JSON.stringify({ candidates: [5] }),
            JSON.stringify({ candidates: [{}] }), JSON.stringify({ candidates: [{ content: null }] }), JSON.stringify({ candidates: [{ content: { parts: 'x' } }] }),
            JSON.stringify({ candidates: [{ content: { parts: [null, 5, 'x', [], { text: 5 }, { text: {} }, { text: null }] } }] }),
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 5 }] }).replace('"x"', '5'),
            '{"__proto__":{"candidates":[{"content":{"parts":[{"text":"polluted"}]}}]}}',
            '{"constructor":{"prototype":{"x":1}}}'];
        for (const raw of hostile) {
            const { sink, wire } = setup();
            expect(() => wire.receive(raw), String(raw)).not.toThrow();
            expect(sink.delta, String(raw)).not.toHaveBeenCalled();
            expect(sink.done, String(raw)).not.toHaveBeenCalled();
            expect(sink.error, String(raw)).not.toHaveBeenCalled();
        }
        expect(({}).polluted).toBeUndefined();
    });

    it('ignores a frame larger than the limit, and goes on with the next', () => {
        const { sink, wire } = setup();
        wire.receive(words('x'.repeat(GEMINI_LIMITS.message)));
        wire.receive(words('ok'));
        expect(heard(sink)).toBe('ok');
    });

    it('does not pass on an empty or non-text delta', () => {
        const { sink, wire } = setup();
        wire.receive(frame([{ text: '' }]));
        wire.receive(frame([]));
        wire.receive(JSON.stringify({ candidates: [{ content: { parts: [{ text: 7 }] } }] }));
        expect(sink.delta).not.toHaveBeenCalled();
    });
});
