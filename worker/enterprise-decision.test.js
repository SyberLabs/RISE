import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEV_WORKER_POLICY, handleEnterpriseDecision, isKevWorkerScript, railQuestion } from './enterprise-decision.mjs';
import worker from './index.mjs';

const ORIGIN = 'https://rise.example';
const REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const env = {
    KEV_BASE_URL: 'https://kev.example', KEV_API_KEY: 'server-kev-secret',
    KEV_MODEL: 'kev-latest', KEV_REVISION: REVISION
};
const CARD = 'card:atlas-renewal:passage:pricing:1';
const CHART = 'card:quarterly-revenue:chart:pipeline';

function context(overrides = {}) {
    return {
        schema: 'rise.enterprise-context.v1',
        requestId: 'room1:4',
        evidence: { window: 'Atlas renewal price', speaker: 'presenter', mode: 'prepared' },
        structure: {
            candidates: [
                { id: CARD, title: 'Atlas renewal', score: 0.62, layouts: ['quote'], layout: 'quote' },
                { id: CHART, title: 'Quarterly revenue', score: 0.2, layouts: ['bar', 'line', 'table'], layout: 'line' }
            ],
            rail: [{ id: 'card:x', title: 'Earlier card' }]
        },
        authority: { actions: ['show', 'hold', 'dismiss'] },
        ...overrides
    };
}

function request(body = context(), headers = {}) {
    return new Request(`${ORIGIN}/api/enterprise-decision`, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });
}

function kev(answer, { revision = REVISION, model = 'kev-latest', status = 200 } = {}) {
    return vi.fn(async () => Response.json({ model, answers: { rail_pick: answer } }, {
        status, headers: revision ? { 'x-kev-revision': revision } : {}
    }));
}

const quiet = { log: () => {} };

afterEach(() => vi.unstubAllGlobals());

describe('enterprise decision route', () => {
    it('asks the provider to pick one source or none, by opaque keys, and maps the pick back', async () => {
        const fetcher = kev({ type: 'choice', choice: 'source_1', confidence: 0.71,
            probabilities: { none: 0.2, source_1: 0.7, source_2: 0.1 } });
        vi.stubGlobal('fetch', fetcher);
        const response = await handleEnterpriseDecision(request(), env, quiet);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            schema: 'rise.enterprise-decision.v1',
            requestId: 'room1:4',
            action: 'show',
            cardId: CARD,
            layout: 'quote',
            confidence: 0.71,
            model: 'kev-latest',
            provider: 'Kev',
            revision: REVISION
        });

        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe('https://kev.example/v1/systemone');
        expect(init.headers.Authorization).toBe('Bearer server-kev-secret');
        expect(init.redirect).toBe('manual');
        const sent = JSON.parse(init.body);
        expect(sent.questions.rail_pick.criteria).toEqual({
            none: 'No source clearly answers or supports it.',
            source_1: 'Atlas renewal',
            source_2: 'Quarterly revenue'
        });
        expect(sent.state).toEqual({ window: 'Atlas renewal price', speaker: 'presenter', mode: 'prepared' });
        // The provider sees titles, never card ids, documents, scores, or the rail.
        expect(init.body).not.toContain(CARD);
        expect(init.body).not.toContain('pricing');
        expect(init.body).not.toContain('Earlier card');
        expect(init.body).not.toContain('0.62');
    });

    it('asks no provider when nothing matched, and dismisses', async () => {
        const fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        const empty = context({ structure: { candidates: [], rail: [] }, authority: { actions: ['hold', 'dismiss'] } });
        expect(railQuestion(empty).question).toBeNull();
        const response = await handleEnterpriseDecision(request(empty), env, quiet);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ action: 'dismiss', cardId: null, layout: null, provider: 'Kev' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('does not call a provider that is not configured', async () => {
        const fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        expect((await handleEnterpriseDecision(request(), {}, quiet)).status).toBe(503);
        expect((await handleEnterpriseDecision(request(), { ...env, KEV_REVISION: 'main' }, quiet)).status).toBe(503);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each([
        ['a GET', () => new Request(`${ORIGIN}/api/enterprise-decision`), 405],
        ['a missing origin', () => request(context(), { Origin: '' }), 403],
        ['another origin', () => request(context(), { Origin: 'https://evil.example' }), 403],
        ['a form body', () => request(context(), { 'Content-Type': 'text/plain' }), 415],
        ['an oversized body', () => request({ ...context(), pad: 'x'.repeat(9000) }), 413],
        ['malformed JSON', () => request('{'), 400],
        ['a document field', () => request({ ...context(), documents: [{ text: '880 million' }] }), 400],
        ['a candidate body', () => request(context({ structure: {
            candidates: [{ id: CARD, title: 'A', score: 0.5, layouts: ['quote'], layout: 'quote', body: '880' }],
            rail: [] } })), 400],
        ['a promote grant', () => request(context({ authority: { actions: ['show', 'hold', 'dismiss', 'promote'] } })), 400]
    ])('refuses %s before any provider call', async (_, make, status) => {
        const fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        expect((await handleEnterpriseDecision(make(), env, quiet)).status).toBe(status);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each([
        ['an option that was not offered', { type: 'choice', choice: 'source_3' }],
        ['a raw card id', { type: 'choice', choice: CARD }],
        ['a publish verb', { type: 'choice', choice: 'promote' }],
        ['free text', { type: 'text', text: 'The acquisition price is 880 million' }],
        ['a confidence above one', { type: 'choice', choice: 'none', confidence: 4 }],
        ['a probability above one', { type: 'choice', choice: 'none', probabilities: { none: 2, source_1: 0, source_2: 0 } }],
        ['a missing probability', { type: 'choice', choice: 'none', probabilities: { none: 1, source_1: 0 } }],
        ['no answer', undefined]
    ])('fails closed on %s', async (_, answer) => {
        vi.stubGlobal('fetch', kev(answer));
        const response = await handleEnterpriseDecision(request(), env, quiet);
        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain('880');
    });

    it.each([
        ['a different checkpoint', { revision: 'b'.repeat(40) }],
        ['an unattested checkpoint', { revision: null }],
        ['a different model', { model: 'jev-latest' }]
    ])('rejects %s', async (_, options) => {
        vi.stubGlobal('fetch', kev({ type: 'choice', choice: 'none' }, options));
        expect((await handleEnterpriseDecision(request(), env, quiet)).status).toBe(502);
    });

    it('hides upstream failures and malformed JSON', async () => {
        vi.stubGlobal('fetch', async () => new Response('server-kev-secret', { status: 500 }));
        const failed = await handleEnterpriseDecision(request(), env, quiet);
        expect(failed.status).toBe(502);
        expect(await failed.text()).not.toContain('server-kev-secret');
        vi.stubGlobal('fetch', async () => new Response('{', { headers: { 'x-kev-revision': REVISION } }));
        expect((await handleEnterpriseDecision(request(), env, quiet)).status).toBe(502);
        vi.stubGlobal('fetch', async () => { throw new TypeError('connection reset'); });
        expect((await handleEnterpriseDecision(request(), env, quiet)).status).toBe(502);
    });

    it('times out without retry', async () => {
        const fetcher = vi.fn(async () => { throw new DOMException('slow', 'TimeoutError'); });
        vi.stubGlobal('fetch', fetcher);
        expect((await handleEnterpriseDecision(request(), env, quiet)).status).toBe(504);
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('logs one line per request without the transcript', async () => {
        vi.stubGlobal('fetch', kev({ type: 'choice', choice: 'none', confidence: 0.4,
            probabilities: { none: 0.9, source_1: 0.05, source_2: 0.05 } }));
        const log = vi.fn();
        await handleEnterpriseDecision(request(), env, { log });
        expect(log).toHaveBeenCalledOnce();
        const line = JSON.parse(log.mock.calls[0][0]);
        expect(line).toMatchObject({
            event: 'enterprise.decision', requestId: 'room1:4', status: 200, outcome: 'dismiss', candidates: 2, provider: 'Kev'
        });
        expect(log.mock.calls[0][0]).not.toContain('Atlas renewal price');
    });

    it('accepts the explicit Jev provider', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({
            provider: 'TypeSafe', model: 'typesafe/jev-1.13',
            answers: { rail_pick: { type: 'choice', choice: 'none', probabilities: { none: 1, source_1: 0, source_2: 0 } } }
        })));
        const response = await handleEnterpriseDecision(request(), { DECISION_PROVIDER: 'jev', OPENROUTER_API_KEY: 'k' }, quiet);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ action: 'dismiss', cardId: null, provider: 'TypeSafe', confidence: null });
    });
});

describe('Kev worker script', () => {
    it('is recognised only at its hashed asset path', () => {
        expect(isKevWorkerScript('/assets/kev-worker-B1YReAsQ.js')).toBe(true);
        expect(isKevWorkerScript('/assets/embed-worker-CVK-xa4T.js')).toBe(true);
        for (const path of ['/assets/kev-worker-x.js/../index.js', '/assets/kev-check-1.js', '/enterprise', '/assets/kev-worker-.css',
            '/assets/embedder-1.js', '/assets/embed-worker-.js']) {
            expect(isKevWorkerScript(path)).toBe(false);
        }
    });

    it('replaces the site policy with its own and keeps the asset intact', async () => {
        const site = "default-src 'self'; script-src 'self'";
        const env = { ASSETS: { fetch: vi.fn(async () => new Response('self.onmessage=()=>{}', {
            status: 200, headers: { 'Content-Security-Policy': site, 'Content-Type': 'text/javascript', 'Cache-Control': 'immutable' }
        })) } };
        const response = await worker.fetch(new Request(`${ORIGIN}/assets/kev-worker-B1YReAsQ.js`), env);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Security-Policy')).toBe(KEV_WORKER_POLICY);
        expect(response.headers.get('Cache-Control')).toBe('immutable');
        expect(await response.text()).toBe('self.onmessage=()=>{}');
        expect(KEV_WORKER_POLICY).toContain("default-src 'none'");
        expect(KEV_WORKER_POLICY).not.toContain("'unsafe-eval'");
        expect(KEV_WORKER_POLICY).not.toMatch(/script-src[^;]*https:/u);
        expect(KEV_WORKER_POLICY).toMatch(/connect-src 'self' /u);
        expect(KEV_WORKER_POLICY).not.toContain('jsdelivr');
    });
});
