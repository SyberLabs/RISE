/**
 * An adapter for any provider that streams text.
 *
 * A provider is asked for passages in the plain line format
 * (segment-parser.js), and what it sends becomes protocol events through the
 * parser. Everything provider-specific is one function the caller hands in:
 *
 *   connect(request, sink) -> Promise<{ cancel(), close() }>
 *     `sink.delta(text)`   more words arrived
 *     `sink.done()`        the provider has finished
 *     `sink.error(e)`      it failed: { code, message, recoverable }
 *
 * so a second provider is a second `connect`, and the same conformance suite
 * holds both to the same behaviour. This adapter never sees a wire event.
 *
 * WHAT IT CANNOT DO, said plainly.
 *  - It carries no evidence and no Dives. A model that names sources it cannot
 *    show is not evidence, and nothing here invents any.
 *  - It cannot continue a stream a provider has dropped. A network answer that
 *    stops halfway is not replayable; `resume` replays what was already
 *    received, and then the Current ends failed, with every whole passage intact
 *    and readable. A passage that was being written when it stopped is let go,
 *    never ended: half a sentence is not read or spoken. This is the honest form of resume for a provider that cannot.
 *  - It cannot hold a provider. The provider writes as fast as it writes; the
 *    reader is protected by bounds, not by pausing it.
 */

import {
    AdapterError,
    createChannel,
    createEventWriter,
    recordHostEvent,
    validateOpenRequest
} from '../adapter.js';
import { createSegmentParser } from './segment-parser.js';

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/**
 * @param {object} options
 * @param {string} options.id the adapter's name
 * @param {string} options.provider what the Current says wrote it
 * @param {(request: object, sink: object) => Promise<{cancel: Function, close: Function}>} options.connect
 * @param {number} [options.capacity]
 */
export function createTextStreamAdapter({ id, provider, connect, capacity = 64 }) {
    if (typeof id !== 'string' || !id) throw new TypeError('A text-stream adapter has a name');
    if (typeof connect !== 'function') throw new TypeError('A text-stream adapter is given a connect function');
    let opened = 0;

    return {
        id,
        capabilities: Object.freeze({
            providerAudio: false,
            interruption: true,
            resume: 'replay',
            microphone: false,
            evidence: false,
            dives: false
        }),

        async open(input) {
            const request = validateOpenRequest(input);
            const currentId = `${request.intent === 'dive' ? 'dive' : 'answer'}-${id}-${opened}`;
            opened += 1;

            const writer = createEventWriter(currentId);
            const log = [];
            let channel = createChannel({ capacity });
            let closed = false;
            let finished = false;
            let lost = null;
            let transport = null;

            const put = event => {
                log.push(event);
                // While the connection is reported lost, what arrives is kept for the replay, not pushed.
                if (lost) return;
                if (!channel.pushNow(event)) end(new AdapterError('OVERFLOW', 'The reader fell too far behind the provider', { recoverable: false }));
            };
            const emit = (type, body) => put(writer.next(type, body));

            function end(error) {
                if (finished) return;
                finished = true;
                if (error) channel.fail(error);
                else channel.close();
            }

            /** Terminal, with a reason, the way a Current that failed is told. */
            function fail(code, message) {
                if (finished) return;
                parser.abandon();
                emit('error', { code, message: clip(message, 400), recoverable: false });
                end();
            }

            const parser = createSegmentParser((type, body) => { if (!finished) emit(type, body); });

            emit('current.open', {
                title: clip(request.prompt.replace(/\s+/gu, ' ').trim(), 120) || 'Answer',
                origin: { kind: 'model', name: `${provider} answer`, provider }
            });

            const sink = {
                delta(text) {
                    if (finished || closed) return;
                    parser.push(text);
                },
                done() {
                    if (finished || closed) return;
                    const { passages } = parser.finish();
                    if (passages === 0 || !log.some(event => event.type === 'segment.end')) {
                        fail('EMPTY_ANSWER', 'The provider finished without saying anything');
                        return;
                    }
                    emit('current.complete', {});
                    end();
                },
                error(problem) {
                    if (finished || closed) return;
                    const recoverable = problem?.recoverable === true;
                    if (recoverable) {
                        // Whole passages stay; the one being written is let go. The connection is reported
                    // lost, and can only be replayed.
                        parser.abandon();
                        lost = new AdapterError(problem.code ?? 'TRANSPORT_LOST', problem.message ?? 'The connection dropped', { recoverable: true });
                        channel.fail(lost);
                        return;
                    }
                    fail(problem?.code ?? 'PROVIDER_FAILED', problem?.message ?? 'The provider failed');
                }
            };

            try {
                transport = await connect(request, sink);
            } catch (error) {
                throw error instanceof AdapterError
                    ? error
                    : new AdapterError('CONNECT_FAILED', String(error?.message ?? error).slice(0, 300));
            }

            return {
                currentId,

                get events() { return channel; },

                record(type, body = {}) {
                    if (closed || finished) throw new AdapterError('CLOSED', 'The connection is closed');
                    const event = recordHostEvent({ currentId, writer, type, body });
                    log.push(event);
                    channel.pushNow(event);
                    return event;
                },

                async interrupt(info = {}) {
                    if (closed || finished) return;
                    try { transport?.cancel?.(); } catch { /* the reader is stopping either way */ }
                    parser.abandon();
                    emit('interrupt', { reason: 'user', ...(info.text ? { text: info.text } : {}) });
                    emit('current.cancel', { reason: 'interrupted' });
                    end();
                },

                async resume(fromSeq) {
                    if (closed) throw new AdapterError('CLOSED', 'The connection is closed');
                    if (!Number.isInteger(fromSeq) || fromSeq < 0) throw new AdapterError('RESUME', 'Expected a sequence number');
                    channel = createChannel({ capacity });
                    for (const event of log.filter(item => item.seq >= fromSeq)) channel.pushNow(event);
                    if (lost && !finished) {
                        // What was lost cannot be fetched again. Say so, once, and end.
                        lost = null;
                        fail('CONNECTION_LOST', 'The connection to the provider was lost and the answer could not be continued');
                    } else if (finished) {
                        channel.close();
                    }
                },

                async close() {
                    if (closed) return;
                    closed = true;
                    try { transport?.close?.(); } catch { /* closing must finish */ }
                    finished = true;
                    channel.close();
                }
            };
        }
    };
}
