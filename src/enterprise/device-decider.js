/**
 * Kev on this device, behind the same decider contract as the server route.
 *
 * It asks the shared rail question and reads the answer the same way the
 * route does. Until the model is loaded, or after it fails, every decision
 * is refused and the live loop holds; nothing falls back to another
 * decider. The model is loaded only when asked to, because it is a large
 * one-time download.
 */

import { RAIL_QUESTION, railQuestion, readRailAnswer } from './rail-question.js';
import { DecisionError } from './remote-decider.js';
import { DEFAULT_DEVICE_MODEL, DEVICE_MODELS } from './device-model.js';

export const DEVICE_PROVIDER = 'Kev on device';

function defaultWorker() {
    return new Worker(new URL('./kev-worker.js', import.meta.url), { type: 'module', name: 'kev' });
}

export function createDeviceDecider({ model = DEFAULT_DEVICE_MODEL, createWorker = defaultWorker, onChange } = {}) {
    if (!DEVICE_MODELS[model]) throw new Error(`Unknown device model ${model}`);
    let worker = null;
    let loading = null;
    const pending = new Map();
    let nextId = 0;
    const status = { state: 'idle', phase: null, loaded: 0, total: DEVICE_MODELS[model].bytes, info: null, code: null, detail: null, adapter: null };

    function changed(patch) {
        Object.assign(status, patch);
        onChange?.({ ...status });
    }

    function failAll(reason) {
        for (const { reject } of pending.values()) reject(new DecisionError(reason));
        pending.clear();
    }

    function load() {
        if (loading) return loading;
        loading = new Promise((resolve) => {
            try {
                worker = createWorker();
            } catch {
                changed({ state: 'failed', code: 'no-worker' });
                resolve({ ...status });
                return;
            }
            worker.onmessage = ({ data }) => {
                if (data?.type === 'progress') changed({ loaded: data.loaded, total: data.total || status.total });
                else if (data?.type === 'phase') changed({ phase: data.phase, ...(data.adapter ? { adapter: data.adapter } : {}) });
                else if (data?.type === 'ready') {
                    changed({ state: 'ready', phase: 'ready', info: data.info, adapter: data.info.adapter });
                    resolve({ ...status });
                } else if (data?.type === 'failed') {
                    changed({ state: 'failed', code: data.code, detail: data.detail ?? null });
                    failAll('unavailable');
                    resolve({ ...status });
                } else if (data?.type === 'answer') {
                    const entry = pending.get(data.id);
                    if (!entry) return;
                    pending.delete(data.id);
                    if (data.error) entry.reject(new DecisionError(data.error === 'not-ready' ? 'unavailable' : 'error'));
                    else entry.resolve(data);
                }
            };
            worker.onerror = () => {
                changed({ state: 'failed', code: status.state === 'ready' ? 'crashed' : 'load-error' });
                failAll('error');
                resolve({ ...status });
            };
            changed({ state: 'loading', phase: 'start' });
            worker.postMessage({ type: 'load', model });
        });
        return loading;
    }

    async function decide(context, { signal } = {}) {
        if (status.state === 'loading') throw new DecisionError('loading');
        if (status.state !== 'ready') throw new DecisionError('unavailable');
        const { options, question, state } = railQuestion(context);
        if (!question) {
            return { raw: { action: 'dismiss', cardId: null, layout: null }, meta: { provider: DEVICE_PROVIDER, model: status.info.run, revision: status.info.revision, confidence: null, inferenceMs: 0 } };
        }
        const id = ++nextId;
        const reply = await new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            signal?.addEventListener('abort', () => {
                if (pending.delete(id)) reject(signal.reason);
            }, { once: true });
            worker.postMessage({ type: 'ask', id, request: { state, questions: { [RAIL_QUESTION]: question } } });
        });
        const answer = reply.response?.answers?.[RAIL_QUESTION];
        const decision = readRailAnswer(answer, options, context);
        if (!decision) throw new DecisionError('invalid');
        return {
            raw: { action: decision.action, cardId: decision.cardId, layout: decision.layout },
            meta: {
                provider: DEVICE_PROVIDER,
                model: status.info.run,
                revision: status.info.revision,
                confidence: decision.confidence,
                inferenceMs: reply.inferenceMs ?? null
            }
        };
    }

    return {
        model,
        load,
        decide,
        status: () => ({ ...status }),
        dispose() {
            failAll('stopped');
            worker?.terminate();
            worker = null;
            loading = null;
            changed({ state: 'idle', phase: null, info: null });
        }
    };
}
