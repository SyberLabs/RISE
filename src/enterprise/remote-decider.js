/**
 * The browser side of the decision route.
 *
 * It posts the context and nothing else. It accepts only a decision with the
 * route's schema and the same request id, and hands the session the three
 * fields `sanitizeDecision` reads. Every other outcome throws, and the live
 * loop resolves the turn as a hold. There is no fallback to local rules.
 */

import { DECISION_SCHEMA } from './context.js';

const RESPONSE_KEYS = new Set([
    'schema', 'requestId', 'action', 'cardId', 'layout', 'confidence', 'model', 'provider', 'revision'
]);
const ACTIONS = new Set(['show', 'hold', 'dismiss']);

export class DecisionError extends Error {
    constructor(reason, status = null) {
        super(`Decision ${reason}`);
        this.name = 'DecisionError';
        this.reason = reason;
        this.status = status;
    }
}

function statusReason(status) {
    if (status === 504) return 'timeout';
    if (status === 429) return 'rate-limited';
    if (status === 503 || status === 404) return 'unavailable';
    return 'error';
}

function shortText(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 100;
}

function accepted(body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    if (Object.keys(body).some(key => !RESPONSE_KEYS.has(key))) return false;
    if (body.schema !== DECISION_SCHEMA || body.requestId !== context.requestId) return false;
    if (!ACTIONS.has(body.action)) return false;
    if (body.cardId != null && typeof body.cardId !== 'string') return false;
    if (body.layout != null && typeof body.layout !== 'string') return false;
    if (body.confidence != null && !(typeof body.confidence === 'number'
        && body.confidence >= 0 && body.confidence <= 1)) return false;
    return [body.model, body.provider, body.revision].every(value => value == null || shortText(value));
}

export function createRemoteDecider({ endpoint = '/api/enterprise-decision', fetch: fetcher } = {}) {
    const send = fetcher || ((...args) => globalThis.fetch(...args));
    return async function decide(context, { signal } = {}) {
        let response;
        try {
            response = await send(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(context),
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                signal
            });
        } catch {
            throw new DecisionError('unavailable');
        }
        if (!response.ok) throw new DecisionError(statusReason(response.status), response.status);
        let body;
        try {
            body = await response.json();
        } catch {
            throw new DecisionError('invalid', response.status);
        }
        if (!accepted(body, context)) throw new DecisionError('invalid', response.status);
        return {
            raw: { action: body.action, cardId: body.cardId ?? null, layout: body.layout ?? null },
            meta: {
                provider: body.provider ?? null,
                model: body.model ?? null,
                revision: body.revision ?? null,
                confidence: body.confidence ?? null
            }
        };
    };
}
