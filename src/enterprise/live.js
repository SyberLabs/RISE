/**
 * The live loop: one decision in flight, bounded in time.
 *
 * An interim transcript warms the lexical tier. A final prepares a turn,
 * cancels the decision still in flight, and asks the decider under a
 * timeout. The session resolves whatever comes back — a late, cancelled,
 * failed, or malformed answer is a hold. A decider that ignores its abort
 * signal still loses the race to the timeout.
 */

import { viewOf } from './context.js';
import { ruleDecider } from './decision.js';

export const DECISION_TIMEOUT_MS = 3_500;

/** Explicit local mode: the rule decider behind the async contract. */
export async function localDecider(context) {
    return { raw: ruleDecider(viewOf(context)), meta: { provider: 'local' } };
}

function whenAborted(signal) {
    return new Promise((_, reject) => {
        const fire = () => reject(signal.reason);
        if (signal.aborted) fire();
        else signal.addEventListener('abort', fire, { once: true });
    });
}

export function createLiveLoop({
    session,
    decide = localDecider,
    timeoutMs = DECISION_TIMEOUT_MS,
    trace = null,
    now = () => performance.now()
}) {
    let inflight = null;
    let stopped = false;

    function emit(type, fields) {
        trace?.emit(type, fields);
    }

    async function run(turn) {
        inflight?.controller.abort('superseded');
        const controller = new AbortController();
        const entry = { controller, turn };
        inflight = entry;
        const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
        const started = now();
        emit('decision.request', {
            requestId: turn.requestId,
            tier: turn.tier,
            speaker: turn.speaker,
            candidates: turn.context.structure.candidates.length
        });
        try {
            const answer = await Promise.race([
                decide(turn.context, { signal: controller.signal }),
                whenAborted(controller.signal)
            ]);
            const meta = answer?.meta || {};
            emit('decision.response', {
                requestId: turn.requestId,
                outcome: 'answered',
                latencyMs: Math.round(now() - started),
                action: typeof answer?.raw?.action === 'string' ? answer.raw.action : null,
                provider: meta.provider ?? null,
                model: meta.model ?? null,
                revision: meta.revision ?? null,
                confidence: meta.confidence ?? null
            });
            return session.resolve(turn, answer?.raw, { provider: meta.provider ?? null });
        } catch (error) {
            const reason = controller.signal.aborted
                ? String(controller.signal.reason)
                : (typeof error?.reason === 'string' ? error.reason : 'error');
            emit('decision.response', {
                requestId: turn.requestId,
                outcome: reason,
                latencyMs: Math.round(now() - started),
                status: error?.status ?? null
            });
            return session.resolve(turn, null, { reason });
        } finally {
            clearTimeout(timer);
            if (inflight === entry) inflight = null;
        }
    }

    return {
        /** Interim → warm (synchronous result). Final → a promise of the resolution. */
        hear(event) {
            if (stopped) return Promise.resolve({ action: 'ignore', reason: 'stopped' });
            if (!event?.final) return Promise.resolve({ action: 'warm', ...session.warm(event) });
            const turn = session.prepare(event);
            if (!turn) return Promise.resolve({ action: 'ignore', reason: 'presenter' });
            return run(turn);
        },
        reason(request) {
            if (stopped) return Promise.resolve({ action: 'ignore', reason: 'stopped' });
            return run(session.prepareReasoning(request));
        },
        pending() {
            return inflight ? inflight.turn.requestId : null;
        },
        stop() {
            stopped = true;
            inflight?.controller.abort('stopped');
        }
    };
}
