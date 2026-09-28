/**
 * The "Kev (local)" decider: pinned Kev running on the presenter's own
 * computer, reached through local RISE's same-origin bridge. There is no
 * hosted decision route and no SyberLabs model credential; on the public
 * site the bridge route does not exist and this decider reports unavailable.
 *
 * It sends the one rail question (opaque option keys, titles, and the
 * transcript window, never card ids or documents), accepts only the pinned
 * Kev checkpoint, and maps the choice back through readRailAnswer. Every
 * other outcome throws, and the live loop resolves the turn as a hold.
 * There is no fallback to local rules.
 */

import { validateContext } from './context.js';
import { RAIL_QUESTION, railQuestion, readRailAnswer } from './rail-question.js';

export const LOCAL_KEV_ENDPOINT = '/api/local/kev/systemone';
// Must equal src/core/decision/providers.js KEV_REVISION (enforced by test);
// the enterprise room imports only its own modules.
export const KEV_REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const KEV_MODEL = 'kev-latest';
const DEADLINE_MS = 2_500;

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
    if (status === 503 || status === 404 || status === 405) return 'unavailable';
    return 'error';
}

export function createRemoteDecider({ endpoint = LOCAL_KEV_ENDPOINT, fetch: fetcher } = {}) {
    const send = fetcher || ((...args) => globalThis.fetch(...args));
    return async function decide(context, { signal } = {}) {
        let checked;
        try {
            checked = validateContext(context);
        } catch {
            throw new DecisionError('invalid');
        }
        const { options, question, state } = railQuestion(checked);
        let deadline;
        let response;
        try {
            deadline = AbortSignal.timeout(DEADLINE_MS);
            response = await send(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ model: KEV_MODEL, state, questions: { [RAIL_QUESTION]: question } }),
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                signal: signal ? AbortSignal.any([signal, deadline]) : deadline
            });
        } catch {
            throw new DecisionError(deadline?.aborted ? 'timeout' : 'unavailable');
        }
        if (!response.ok) throw new DecisionError(statusReason(response.status), response.status);
        if (response.headers.get('x-kev-revision') !== KEV_REVISION) throw new DecisionError('invalid', response.status);
        let body;
        try {
            body = await response.json();
        } catch {
            throw new DecisionError('invalid', response.status);
        }
        if (!body || body.model !== KEV_MODEL || body.error) throw new DecisionError('invalid', response.status);
        const decision = readRailAnswer(body.answers?.[RAIL_QUESTION], options, checked);
        if (!decision) throw new DecisionError('invalid', response.status);
        return {
            raw: { action: decision.action, cardId: decision.cardId, layout: decision.layout },
            meta: { provider: 'Kev', model: KEV_MODEL, revision: KEV_REVISION, confidence: decision.confidence }
        };
    };
}

