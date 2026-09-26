const ENDPOINT = '/api/jev-decision';
const TIMEOUT_MS = 10_000;
const LIMITS = Object.freeze({ intent: 500, feedback: 500, excerpt: 2000, requestId: 100, model: 100 });
const PACE_RANGE = Object.freeze({ min: 100, max: 500 });

let requestSequence = 0;

function abortError(message = 'Jev request aborted.') {
    if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

function boundedText(value, field, maxLength) {
    if (typeof value !== 'string' || value.length > maxLength) {
        throw new TypeError(`${field} must be text no longer than ${maxLength} characters.`);
    }
    return value;
}

function requestId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    requestSequence += 1;
    return `jev-${Date.now()}-${requestSequence}`;
}

function validateDecision(value, expectedId) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The reading decision service returned an invalid response.');
    }
    if (value.requestId !== expectedId) throw new Error('The reading decision response did not match this request.');
    if (!['continue', 'slower', 'pause'].includes(value.action)) {
        throw new Error('The reading decision service returned an unsupported action.');
    }
    if (typeof value.model !== 'string' || value.model.trim().length === 0
        || value.model.length > LIMITS.model) {
        throw new Error('The reading decision service returned an invalid model identifier.');
    }
    return {
        requestId: value.requestId,
        action: value.action,
        model: value.model,
    };
}

/** A same-origin, abortable client for the required reading decision service. */
export function createJevConductor({
    intent = 'Read attentively',
    mode = 'reading',
    pace = 200,
    fetchImpl = globalThis.fetch
} = {}) {
    boundedText(intent, 'intent', LIMITS.intent);
    if (!['reading', 'devotional'].includes(mode)) throw new TypeError('mode must be reading or devotional.');
    if (typeof pace !== 'number' || !Number.isFinite(pace)
        || pace < PACE_RANGE.min || pace > PACE_RANGE.max) {
        throw new TypeError(`pace must be between ${PACE_RANGE.min} and ${PACE_RANGE.max} WPM.`);
    }
    if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');

    let active = null;
    let destroyed = false;
    let generation = 0;
    let queuedFeedback = '';
    let activePace = pace;

    function setFeedback(feedback) {
        if (destroyed) throw new Error('The reading decision session has ended.');
        queuedFeedback = boundedText(feedback, 'feedback', LIMITS.feedback);
    }

    function setPace(nextPace) {
        if (destroyed) throw new Error('The reading decision session has ended.');
        if (typeof nextPace !== 'number' || !Number.isFinite(nextPace)
            || nextPace < PACE_RANGE.min || nextPace > PACE_RANGE.max) {
            throw new TypeError(`pace must be between ${PACE_RANGE.min} and ${PACE_RANGE.max} WPM.`);
        }
        activePace = nextPace;
    }

    async function decide({ excerpt, feedback = '', signal } = {}) {
        if (destroyed) throw new Error('The reading decision session has ended.');
        boundedText(excerpt, 'excerpt', LIMITS.excerpt);
        const decisionFeedback = feedback || queuedFeedback;
        boundedText(decisionFeedback, 'feedback', LIMITS.feedback);
        queuedFeedback = '';
        if (signal?.aborted) throw abortError();

        generation += 1;
        const currentGeneration = generation;
        active?.controller.abort();

        const controller = new AbortController();
        const request = { controller, timedOut: false, externallyAborted: false };
        active = request;
        const id = requestId();
        let timer;
        let externalAbort;
        let rejectAborted;
        const aborted = new Promise((_, reject) => { rejectAborted = reject; });
        const failAsAborted = () => rejectAborted(abortError(
            request.timedOut ? 'Reading decision request timed out.' : 'Reading decision request was cancelled.'
        ));
        const onAbort = () => {
            request.externallyAborted = true;
            controller.abort();
            failAsAborted();
        };
        controller.signal.addEventListener('abort', failAsAborted, { once: true });
        if (signal) {
            externalAbort = () => onAbort();
            signal.addEventListener('abort', externalAbort, { once: true });
        }
        timer = setTimeout(() => {
            request.timedOut = true;
            controller.abort();
        }, TIMEOUT_MS);

        try {
            const body = {
                intent,
                feedback: decisionFeedback,
                excerpt,
                requestId: id,
                mode,
                pace: activePace
            };
            const responsePromise = Promise.resolve().then(() => fetchImpl(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            }));
            const response = await Promise.race([responsePromise, aborted]);
            if (!response?.ok) throw new Error('The reading decision service is unavailable.');
            const payload = await Promise.race([response.json(), aborted]);
            if (destroyed || currentGeneration !== generation || request.timedOut || request.externallyAborted) {
                throw abortError();
            }
            return validateDecision(payload, id);
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', externalAbort);
            controller.signal.removeEventListener('abort', failAsAborted);
            if (active === request) active = null;
        }
    }

    function destroy() {
        destroyed = true;
        generation += 1;
        active?.controller.abort();
        active = null;
    }

    return Object.freeze({ decide, setFeedback, setPace, destroy });
}
