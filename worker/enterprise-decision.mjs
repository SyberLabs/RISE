import { decisionProvider, validProviderResult, validProviderResponse } from '../server/decision-provider.mjs';
import { DECISION_SCHEMA, validateContext } from '../src/enterprise/context.js';
import { emptyRailDecision, RAIL_QUESTION, railQuestion, readRailAnswer } from '../src/enterprise/rail-question.js';

export { railQuestion };

// The on-device model workers (Kev, and the matcher's embedder) are the only
// documents allowed to fetch model hosts and compile WebAssembly. A dedicated
// worker is governed by the policy on its own script, so the pages that start
// it keep the site policy.
export const KEV_WORKER_POLICY = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; "
    + 'connect-src https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net';

export function isKevWorkerScript(path) {
    return /^\/assets\/(?:kev|embed)-worker-[\w-]+\.js$/u.test(path);
}

/** Serve a model worker script from static assets with its own policy in place of the site's. */
export async function serveKevWorkerScript(request, env) {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('Content-Security-Policy', KEV_WORKER_POLICY);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

const MAX_BYTES = 8 * 1024;
const UPSTREAM_TIMEOUT_MS = 2_500;
const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
};

function reply(status, body) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function sameOrigin(request) {
    const header = request.headers.get('origin');
    if (!header) return false;
    try {
        const supplied = new URL(header);
        return supplied.origin === header && supplied.origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

async function readCapped(request) {
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return { tooLarge: true };
    if (!request.body) return { text: '' };
    const reader = request.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
            await reader.cancel().catch(() => {});
            return { tooLarge: true };
        }
        chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(body) };
}

export async function handleEnterpriseDecision(request, env, { log = console.log } = {}) {
    const started = Date.now();
    let requestId = null;
    let candidates = null;
    let providerName = null;
    const finish = (status, outcome, body) => {
        try {
            log(JSON.stringify({
                event: 'enterprise.decision',
                requestId,
                status,
                outcome,
                latencyMs: Date.now() - started,
                candidates,
                provider: providerName
            }));
        } catch {
            // Logging never changes the answer.
        }
        return reply(status, body);
    };
    const refuse = (status, code, message) => finish(status, code, { error: { code, message } });

    if (request.method !== 'POST') return refuse(405, 'METHOD', 'Expected POST');
    if (!sameOrigin(request)) return refuse(403, 'ORIGIN', 'Expected the same origin');
    const mediaType = (request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/json') return refuse(415, 'MEDIA_TYPE', 'Expected application/json');

    let context;
    try {
        const body = await readCapped(request);
        if (body.tooLarge) return refuse(413, 'BODY', `Decision context exceeds ${MAX_BYTES} bytes`);
        context = validateContext(JSON.parse(body.text));
    } catch {
        return refuse(400, 'DECISION_SHAPE', 'Expected an enterprise decision context');
    }
    requestId = context.requestId;
    candidates = context.structure.candidates.length;

    const provider = decisionProvider(env);
    if (!provider) return refuse(503, 'DECISION_NOT_CONFIGURED', 'Decision service is unavailable.');
    providerName = provider.name;

    const { options, question, state } = railQuestion(context);
    if (!question) {
        const decision = emptyRailDecision();
        return finish(200, decision.action, {
            schema: DECISION_SCHEMA, requestId, ...decision,
            model: provider.model, provider: provider.name, revision: provider.revision
        });
    }
    let result;
    try {
        const upstream = await fetch(provider.url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${provider.key}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({ model: provider.model, state, questions: { [RAIL_QUESTION]: question } }),
            redirect: 'manual',
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)])
        });
        if (!upstream.ok) return refuse(502, 'DECISION_UPSTREAM_ERROR', 'Decision service returned an error.');
        if (!validProviderResponse(upstream, provider)) {
            return refuse(502, 'DECISION_INVALID_RESPONSE', 'Decision service returned an unexpected checkpoint.');
        }
        result = await upstream.json();
    } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            return refuse(504, 'DECISION_TIMEOUT', 'Decision service timed out.');
        }
        if (error instanceof SyntaxError) {
            return refuse(502, 'DECISION_INVALID_RESPONSE', 'Decision service returned an invalid response.');
        }
        return refuse(502, 'DECISION_UNAVAILABLE', 'Decision service could not be reached.');
    }

    const decision = readRailAnswer(result?.answers?.[RAIL_QUESTION], options, context);
    if (!validProviderResult(result, provider) || !decision) {
        return refuse(502, 'DECISION_INVALID_RESPONSE', 'Decision service returned an invalid rail decision.');
    }

    return finish(200, decision.action, {
        schema: DECISION_SCHEMA,
        requestId,
        action: decision.action,
        cardId: decision.cardId,
        layout: decision.layout,
        confidence: decision.confidence,
        model: result.model,
        provider: provider.name,
        revision: provider.revision
    });
}
