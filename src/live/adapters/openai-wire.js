/**
 * OpenAI Realtime's events, as text-stream events.
 *
 * This is the whole of what this adapter knows about the wire. It reads server
 * events and calls the sink; it writes the two client events that ask a
 * question and the one that stops an answer. Every name a wire event has is in
 * WIRE below, so a change in the provider's vocabulary is one line here.
 *
 * NOT VERIFIED AGAINST THE LIVE SERVICE. The names and shapes are those of
 * OpenAI's published Realtime documentation (text output over the data channel),
 * written without a captured session to check them against. The wire test
 * replays a hand-written transcript in that documented form; when a real
 * session can be captured, it replaces the transcript and nothing else here
 * should need to change.
 *
 * Whatever the provider sends, only text deltas for the response RISE asked
 * for, and a small number of status fields, are read. Nothing else is kept,
 * nothing is passed on, and nothing the provider says is ever executed.
 */

import { promptFor } from './openai-instructions.js';

/** Every provider-specific name, in one place. */
export const WIRE = Object.freeze({
    server: Object.freeze({
        delta: ['response.output_text.delta', 'response.text.delta'],
        created: 'response.created',
        done: 'response.done',
        error: 'error'
    }),
    client: Object.freeze({
        item: 'conversation.item.create',
        respond: 'response.create',
        cancel: 'response.cancel'
    })
});

export const WIRE_LIMITS = Object.freeze({ message: 65_536, code: 80, text: 300 });

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);
const code = value => (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/u.test(value) ? value : null);

/**
 * @param {object} options
 * @param {(event: object) => void} options.send write one client event to the provider
 * @param {{delta: Function, done: Function, error: Function}} options.sink
 */
export function createOpenAIWire({ send, sink }) {
    let responseId = null;
    let finished = false;
    let cancelled = false;

    const finish = () => { finished = true; };

    return {
        /** Ask. One message from the reader, then one request for the answer, as text only. */
        start(request) {
            send({
                type: WIRE.client.item,
                item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: promptFor(request) }] }
            });
            send({ type: WIRE.client.respond, response: { output_modalities: ['text'] } });
        },

        /** Stop the answer. What arrives after this is not read. */
        cancel() {
            if (finished) return;
            cancelled = true;
            try { send({ type: WIRE.client.cancel }); } catch { /* the transport may already be gone */ }
        },

        /** One message from the provider, as it arrived. Never throws. */
        receive(raw) {
            if (finished || cancelled) return;
            if (typeof raw !== 'string' || raw.length > WIRE_LIMITS.message) return;
            let event;
            try { event = JSON.parse(raw); } catch { return; }
            if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') return;

            if (event.type === WIRE.server.created) {
                if (responseId === null && typeof event.response?.id === 'string') responseId = event.response.id;
                return;
            }
            if (WIRE.server.delta.includes(event.type)) {
                // Only the response RISE asked for, and only its words.
                if (responseId !== null && event.response_id !== undefined && event.response_id !== responseId) return;
                if (typeof event.delta === 'string' && event.delta) sink.delta(event.delta);
                return;
            }
            if (event.type === WIRE.server.done) {
                const status = event.response?.status;
                if (responseId !== null && typeof event.response?.id === 'string' && event.response.id !== responseId) return;
                finish();
                if (status === 'completed') sink.done();
                else if (status === 'cancelled') sink.done();
                else {
                    const detail = event.response?.status_details?.error ?? event.response?.status_details;
                    sink.error({
                        code: `RESPONSE_${String(status ?? 'ENDED').toUpperCase().replace(/[^A-Z0-9_]/gu, '_').slice(0, 40)}`,
                        message: clip(typeof detail?.message === 'string' ? detail.message : `The response ended: ${String(status ?? 'unknown').slice(0, 40)}`, WIRE_LIMITS.text),
                        recoverable: false
                    });
                }
                return;
            }
            if (event.type === WIRE.server.error) {
                finish();
                sink.error({
                    code: code(event.error?.code) ?? 'PROVIDER_ERROR',
                    message: clip(typeof event.error?.message === 'string' ? event.error.message : 'The provider reported an error', WIRE_LIMITS.text),
                    recoverable: false
                });
            }
            // Everything else (session, rate limits, output items, audio) is not read.
        },

        /** The transport closed. If the answer was not over, the connection was lost. */
        closed() {
            if (finished || cancelled) return;
            finish();
            sink.error({ code: 'TRANSPORT_LOST', message: 'The connection to the provider dropped', recoverable: true });
        }
    };
}
