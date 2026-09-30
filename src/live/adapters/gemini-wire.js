/**
 * Google's streaming text generation, as text-stream events.
 *
 * This is the whole of what the Gemini adapter knows about the wire. It builds
 * the one request that asks a question, and reads the answer's frames (each a
 * GenerateContentResponse, one per server-sent event) and calls the sink. Every
 * provider-specific name is in WIRE, so a change in Google's vocabulary is one
 * table here.
 *
 * NOT VERIFIED AGAINST THE LIVE SERVICE. The names and shapes are those of
 * Google's published API description for `models/{model}:streamGenerateContent`
 * (v1beta, revision 20260928), read on 2026-09-30, written without a captured
 * session to check them against. The wire test replays a transcript in that
 * documented form; when a real session can be captured it replaces the
 * transcript and nothing else here should need to change.
 *
 * Only the words of the first candidate, a finish reason, a prompt block and an
 * error are read. Nothing else is kept, nothing is passed on, and nothing the
 * provider says is ever executed.
 *
 * WHAT THE PROVIDER SAYS ABOUT A FAILURE is shown only after the transport's
 * scrubber (which knows the reader's key) has cleaned what was decoded. The wire
 * never sees the key, so without a scrubber, or if the scrubber fails, it says
 * only that the provider reported an error, and none of the provider's words.
 */

import { promptFor, REALTIME_INSTRUCTIONS } from './openai-instructions.js';

/** Every provider-specific name, in one place. */
export const WIRE = Object.freeze({
    finish: Object.freeze({ good: ['STOP'], truncated: 'MAX_TOKENS', none: ['FINISH_REASON_UNSPECIFIED', ''] }),
    blockNone: 'BLOCK_REASON_UNSPECIFIED'
});

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';

export const GEMINI_LIMITS = Object.freeze({ message: 131_072, text: 300, maxOutputTokens: 4096 });

const MODEL = /^[a-z0-9][a-z0-9.-]{0,63}$/u;
const NAME = /^[A-Z][A-Z0-9_]{0,59}$/u;
const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** A model name, and nothing that can leave the address it is put in. */
export function isModelId(value) {
    return typeof value === 'string' && MODEL.test(value);
}

/** The request that asks a question: RISE's instructions, the reader's words, and a cap on what can be spent. */
export function buildBody(request) {
    return {
        systemInstruction: { parts: [{ text: REALTIME_INSTRUCTIONS }] },
        contents: [{ role: 'user', parts: [{ text: promptFor(request) }] }],
        generationConfig: { maxOutputTokens: GEMINI_LIMITS.maxOutputTokens }
    };
}

const PROVIDER_ERROR = 'The provider reported an error';

const object = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

/**
 * @param {object} options
 * @param {{delta: Function, done: Function, error: Function}} options.sink
 * @param {() => void} options.abort stop the request
 * @param {(text: string) => string} [options.scrub] cleans the provider's words about a failure; none means none are shown
 */
export function createGeminiWire({ sink, abort, scrub }) {
    let finished = false;
    let cancelled = false;

    /** A provider's words about a failure, cleaned; the plain sentence if they cannot be vouched for. */
    const cleaned = text => {
        try {
            const out = scrub(text);
            return typeof out === 'string' && out.trim() ? out : PROVIDER_ERROR;
        } catch {
            return PROVIDER_ERROR;
        }
    };

    const fail = (code, message) => {
        finished = true;
        sink.error({ code, message: clip(message, GEMINI_LIMITS.text), recoverable: false });
    };

    return {
        /** Stop the answer. What arrives after this is not read. */
        cancel() {
            if (finished || cancelled) return;
            cancelled = true;
            try { abort(); } catch { /* the request may already be gone */ }
        },

        /** The data of one event, as it arrived. Never throws. */
        receive(raw) {
            if (finished || cancelled) return;
            if (typeof raw !== 'string' || raw.length > GEMINI_LIMITS.message) return;
            let event;
            try { event = JSON.parse(raw); } catch { return; }
            event = object(event);
            if (!event) return;

            if (event.error !== undefined && event.error !== null) {
                const error = object(event.error);
                const status = typeof error?.status === 'string' && NAME.test(error.status) ? error.status : 'PROVIDER_ERROR';
                fail(status, typeof error?.message === 'string' && error.message ? cleaned(error.message) : PROVIDER_ERROR);
                return;
            }

            const blocked = object(event.promptFeedback)?.blockReason;
            if (typeof blocked === 'string' && blocked !== WIRE.blockNone) {
                fail('PROMPT_BLOCKED', `The request was blocked (${NAME.test(blocked) ? blocked : 'no reason given'}), so there is no answer.`);
                return;
            }

            const candidate = Array.isArray(event.candidates) ? object(event.candidates[0]) : null;
            if (!candidate) return;

            const parts = object(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
            for (const part of parts) {
                const piece = object(part);
                // Only words, and never the model's thoughts.
                if (piece && piece.thought !== true && typeof piece.text === 'string' && piece.text) sink.delta(piece.text);
            }

            const reason = candidate.finishReason;
            if (typeof reason !== 'string' || WIRE.finish.none.includes(reason)) return;
            if (WIRE.finish.good.includes(reason)) {
                finished = true;
                sink.done();
            } else if (reason === WIRE.finish.truncated) {
                // Cut off at the length limit: the passage being written is unfinished, and is not shown as though it were.
                fail(`RESPONSE_${reason}`, 'The answer reached its length limit and was cut off.');
            } else {
                const name = NAME.test(reason) ? reason : 'UNKNOWN';
                fail(`RESPONSE_${name}`, `The provider stopped the answer (${name}).`);
            }
        },

        /** The stream ended. If the answer was not over, the connection was lost. */
        closed() {
            if (finished || cancelled) return;
            finished = true;
            sink.error({ code: 'TRANSPORT_LOST', message: 'The connection to the provider dropped', recoverable: true });
        }
    };
}
