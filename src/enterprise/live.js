/**
 * The live loop: one decision in flight per channel, bounded in time.
 *
 * Speech and the presenter's asks are separate channels. An interim
 * transcript warms the lexical tier. A final prepares a turn, cancels the
 * speech decision still in flight, and asks the decider under a timeout. An
 * ask cancels only an older ask. Neither channel cancels the other. The session resolves whatever comes back — a late, cancelled,
 * failed, or malformed answer is a hold. A decider that ignores its abort
 * signal still loses the race to the timeout.
 *
 * With an embedder, a final or an ask is embedded before it is prepared, for
 * at most EMBED_TIMEOUT_MS. A slow or failed embedding prepares the turn
 * without a vector; the room never waits on the embedder.
 */

import { viewOf } from './context.js';
import { ruleDecider } from './decision.js';

export const DECISION_TIMEOUT_MS = 3_500;
export const EMBED_TIMEOUT_MS = 300;

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
    embed = null,
    embedTimeoutMs = EMBED_TIMEOUT_MS,
    trace = null,
    now = () => performance.now()
}) {
    const inflight = { speech: null, ask: null };
    let stopped = false;

    async function vectorFor(text) {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve(embed(text)),
                new Promise((resolve) => { timer = setTimeout(() => resolve(null), embedTimeoutMs); })
            ]) ?? null;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    function emit(type, fields) {
        trace?.emit(type, fields);
    }

    async function run(turn) {
        const channel = turn.channel;
        inflight[channel]?.controller.abort('superseded');
        const controller = new AbortController();
        const entry = { controller, turn };
        inflight[channel] = entry;
        const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
        const started = now();
        emit('decision.request', {
            requestId: turn.requestId,
            channel: turn.channel,
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
            if (inflight[channel] === entry) inflight[channel] = null;
        }
    }

    // Preparing is synchronous and local; if it throws, nothing was decided
    // and nothing moved, and the caller still gets a hold it can explain.
    function prepared(make) {
        try {
            return { turn: make() };
        } catch {
            emit('decision.response', { requestId: null, outcome: 'prepare-failed', latencyMs: 0, status: null });
            return { failed: { action: 'hold', cardId: null, reason: 'error' } };
        }
    }

    return {
        /** Interim → warm. Final → the resolution. Never rejects. */
        async hear(event) {
            if (stopped) return { action: 'ignore', reason: 'stopped' };
            if (!event?.final) {
                try {
                    return { action: 'warm', ...session.warm(event) };
                } catch {
                    return { action: 'warm', tier: 'lexical', leaders: [] };
                }
            }
            // Without an embedder a final is prepared at once, as it always was.
            const vector = embed ? await vectorFor(event.text) : null;
            if (stopped) return { action: 'ignore', reason: 'stopped' };
            const { turn, failed } = prepared(() => session.prepare(vector ? { ...event, vector } : event));
            if (failed) return failed;
            if (!turn) return { action: 'ignore', reason: 'presenter' };
            return run(turn);
        },
        async reason(request) {
            if (stopped) return { action: 'ignore', reason: 'stopped' };
            const vector = embed ? await vectorFor(request.text) : null;
            if (stopped) return { action: 'ignore', reason: 'stopped' };
            const { turn, failed } = prepared(() => session.prepareReasoning(vector ? { ...request, vector } : request));
            return failed || run(turn);
        },
        pending(channel = 'speech') {
            return inflight[channel] ? inflight[channel].turn.requestId : null;
        },
        stop() {
            stopped = true;
            inflight.speech?.controller.abort('stopped');
            inflight.ask?.controller.abort('stopped');
        }
    };
}
