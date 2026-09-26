import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jevDecision, { config } from '../../netlify/functions/jev-decision.mjs';

const SITE = 'https://rise.example';
const VALID_INPUT = Object.freeze({
    intent: 'Help me stay with this passage.',
    feedback: 'I am losing focus.',
    excerpt: 'The reader’s attention turns toward the sea.',
    requestId: 'request-123',
    mode: 'reading',
    pace: 220
});

function upstreamResult(overrides = {}) {
    return {
        model: 'openai/gpt-4.1-mini',
        choices: [{
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify({ action: 'slower' }) }
        }],
        ...overrides
    };
}

function request(body = VALID_INPUT, options = {}) {
    const headers = new Headers({ Origin: SITE, 'Content-Type': 'application/json' });
    for (const [name, value] of Object.entries(options.headers || {})) {
        if (value === null) headers.delete(name);
        else headers.set(name, value);
    }
    return new Request(options.url || `${SITE}/api/jev-decision`, {
        method: options.method || 'POST',
        headers,
        body: options.rawBody ?? JSON.stringify(body)
    });
}

function mockFetch(result = upstreamResult(), status = 200) {
    const fetchMock = vi.fn(async () => new Response(
        typeof result === 'string' ? result : JSON.stringify(result),
        { status, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

async function json(response) {
    return response.json();
}

describe('OpenRouter decision Netlify function', () => {
    beforeEach(() => {
        vi.stubEnv('OPENROUTER_API_KEY', 'server-secret');
        vi.stubEnv('OPENROUTER_MODEL', 'openai/gpt-4.1-mini');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('keeps the same-origin POST route and per-IP rate limit', () => {
        expect(config).toEqual({
            path: '/api/jev-decision',
            method: ['POST'],
            rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: 'ip' }
        });
    });

    it('sends strict action schema and privacy routing, then returns no fabricated confidence', async () => {
        const fetchMock = mockFetch();
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        const response = await jevDecision(request());

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await json(response)).toEqual({
            requestId: 'request-123',
            action: 'slower',
            model: 'openai/gpt-4.1-mini'
        });
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({
            Authorization: 'Bearer server-secret',
            'Content-Type': 'application/json',
            Accept: 'application/json'
        });
        expect(timeout).toHaveBeenCalledWith(8000);

        const payload = JSON.parse(options.body);
        expect(payload).toMatchObject({
            model: 'openai/gpt-4.1-mini',
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'reading_decision',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: { action: { type: 'string', enum: ['continue', 'slower', 'pause'] } },
                        required: ['action'],
                        additionalProperties: false
                    }
                }
            },
            provider: { require_parameters: true, data_collection: 'deny' },
            max_tokens: 32,
            temperature: 0
        });
        expect(payload.messages).toHaveLength(2);
        expect(payload.messages[0].role).toBe('system');
        expect(payload.messages[0].content).toContain('Never rewrite, summarize, reorder, skip, or add');
        expect(JSON.parse(payload.messages[1].content)).toEqual({
            intent: VALID_INPUT.intent,
            feedback: VALID_INPUT.feedback,
            excerpt: VALID_INPUT.excerpt,
            mode: 'reading',
            pace: 220
        });
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(options.body).not.toContain('request-123');
    });

    it('uses the verified default model when no override is configured', async () => {
        vi.stubEnv('OPENROUTER_MODEL', '');
        const fetchMock = mockFetch();

        await jevDecision(request());

        expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('openai/gpt-4.1-mini');
    });

    it('accepts OpenRouter latest-alias model metadata', async () => {
        mockFetch(upstreamResult({ model: '~openai/gpt-mini-latest' }));

        const response = await jevDecision(request());

        expect(response.status).toBe(200);
        expect(await json(response)).toMatchObject({ model: '~openai/gpt-mini-latest' });
    });

    it('rejects cross-origin, non-JSON, and non-POST requests before calling OpenRouter', async () => {
        const fetchMock = mockFetch();
        const crossOrigin = await jevDecision(request(VALID_INPUT, {
            headers: { Origin: 'https://other.example' }
        }));
        expect(crossOrigin.status).toBe(403);

        const wrongType = await jevDecision(request(VALID_INPUT, {
            headers: { 'Content-Type': 'text/plain' }
        }));
        expect(wrongType.status).toBe(415);

        const wrongMethod = await jevDecision(new Request(`${SITE}/api/jev-decision`, {
            method: 'GET', headers: { Origin: SITE }
        }));
        expect(wrongMethod.status).toBe(405);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects missing origins, malformed JSON, oversized bodies, and invalid field bounds', async () => {
        const fetchMock = mockFetch();
        expect((await jevDecision(request(VALID_INPUT, { headers: { Origin: null } }))).status).toBe(403);
        expect((await jevDecision(request(null, { rawBody: '{' }))).status).toBe(400);
        expect((await jevDecision(request({ intent: 'x'.repeat(33_000) }))).status).toBe(413);
        expect((await jevDecision(request({ ...VALID_INPUT, pace: 501 }))).status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('requires the server-side OpenRouter key and hides upstream details', async () => {
        vi.stubEnv('OPENROUTER_API_KEY', '');
        const fetchMock = mockFetch();
        const missingKey = await jevDecision(request());
        expect(missingKey.status).toBe(503);
        expect(await json(missingKey)).toEqual({
            error: { code: 'DECISION_NOT_CONFIGURED', message: 'Decision service is unavailable.' }
        });
        expect(fetchMock).not.toHaveBeenCalled();

        vi.stubEnv('OPENROUTER_API_KEY', 'server-secret');
        mockFetch('provider secret response', 401);
        const failedUpstream = await jevDecision(request());
        const errorBody = await failedUpstream.text();
        expect(failedUpstream.status).toBe(502);
        expect(errorBody).not.toContain('provider secret response');
        expect(errorBody).not.toContain('server-secret');
    });

    it('returns safe errors for network outage and malformed upstream JSON', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('private connection details'); }));
        const outage = await jevDecision(request());
        expect(outage.status).toBe(502);
        expect(await outage.text()).not.toContain('private connection details');

        vi.stubGlobal('fetch', vi.fn(async () => new Response('{', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })));
        const malformedJson = await jevDecision(request());
        expect(malformedJson.status).toBe(502);
        expect(await json(malformedJson)).toMatchObject({ error: { code: 'DECISION_INVALID_RESPONSE' } });
    });

    it.each([
        ['unknown action', { action: 'rewrite' }],
        ['extra action data', { action: 'pause', explanation: 'extra data' }],
        ['malformed JSON content', '{'],
        ['refusal', { action: 'continue' }, { refusal: 'not allowed' }],
        ['tool call instead of action content', { action: 'continue' }, { tool_calls: [{ id: 'tool-1' }] }],
        ['truncation', { action: 'continue' }, null, 'length'],
        ['wrong finish reason', { action: 'continue' }, null, 'content_filter'],
        ['missing model', { action: 'continue' }, null, 'stop', 'invalid model'],
        ['choice error', { action: 'continue' }, null, 'stop', null, false, false, true],
        ['top-level error', { action: 'continue' }, null, 'stop', null, false, true],
        ['multiple choices', { action: 'continue' }, null, 'stop', null, true]
    ])('rejects provider output with %s without fallback', async (label, content, messageExtra = {}, finishReason = 'stop', modelOverride, multiple = false, topLevelError = false, choiceError = false) => {
        const baseChoice = upstreamResult().choices[0];
        const result = upstreamResult({
            model: modelOverride === 'invalid model' ? '' : 'openai/gpt-4.1-mini',
            choices: [
                {
                    ...baseChoice,
                    finish_reason: finishReason,
                    ...(choiceError ? { error: { message: 'provider error' } } : {}),
                    message: {
                        ...baseChoice.message,
                        ...messageExtra,
                        content: typeof content === 'string' ? content : JSON.stringify(content)
                    }
                },
                ...(multiple ? [baseChoice] : [])
            ],
            ...(topLevelError ? { error: { message: 'provider error' } } : {})
        });
        mockFetch(result);
        const response = await jevDecision(request());
        expect(response.status, label).toBe(502);
        expect(await json(response)).toMatchObject({ error: { code: 'DECISION_INVALID_RESPONSE' } });
    });

    it('returns a bounded timeout error and does not log provider data', async () => {
        const error = Object.assign(new Error('secret timeout details'), { name: 'TimeoutError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw error; }));
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});

        const response = await jevDecision(request());

        expect(response.status).toBe(504);
        expect(await response.text()).not.toContain('secret timeout details');
        expect(log).not.toHaveBeenCalled();
    });
});
