/**
 * The deterministic provider.
 *
 * It plays a scripted answer on a clock it is given, so the same script always
 * yields the same events at the same times, offline, with no credentials. It
 * exists to be driven: it can be slow, repeat events, send them out of order,
 * send one malformed, drop its connection, fail, or be interrupted, and every
 * other adapter is held to the same conformance fixture it is.
 *
 * NO SPEECH. This adapter has no voice. Speech is a renderer the runtime owns,
 * because it has to be able to hold and resume (a Dive holds it) and a
 * provider's event stream cannot be held. A voice reports its progress into the
 * ordered stream through `record`, so it is still one stream, in one order.
 *
 * COMPOSING AHEAD. Text is written far faster than any voice speaks it, so
 * later segments, their state, their evidence and their Dives arrive while
 * earlier ones are still being said.
 */

import {
    AdapterError,
    createChannel,
    createEventWriter,
    recordHostEvent,
    validateOpenRequest
} from '../adapter.js';
import { createRealClock } from '../clock.js';
import { scriptFor } from '../fixtures/black-holes.js';
import { beatsTextFor } from '../fixtures/black-holes-beats.js';
import { createTextStreamAdapter } from './text-stream.js';

/** Uneven pieces, as a provider's deltas come. */
const DELTA_SIZES = Object.freeze([7, 19, 3, 31, 11, 23]);

/**
 * The venue's demo: the black holes answer written in beats (fixtures/black-holes-beats.js), in uneven deltas at
 * about the pace a model writes (some 150 characters a second), through the same text-stream adapter and parser as
 * every real provider. So holds and scenes arrive while the answer is still being written, as they would from one.
 */
export function createMockBeatsAdapter({ clock = createRealClock(), everyMs = 100 } = {}) {
    return createTextStreamAdapter({
        id: 'mock',
        provider: 'RISE demo',
        connect: async (request, sink) => {
            const text = beatsTextFor(request);
            const controller = new AbortController();
            void (async () => {
                try {
                    for (let at = 0, n = 0; at < text.length; n += 1) {
                        await clock.sleep(everyMs, { signal: controller.signal });
                        const size = DELTA_SIZES[n % DELTA_SIZES.length];
                        sink.delta(text.slice(at, at + size));
                        at += size;
                    }
                    sink.done();
                } catch (error) {
                    if (error?.name !== 'AbortError') sink.error({ code: 'PROVIDER_FAILED', message: String(error?.message ?? error), recoverable: false });
                }
            })();
            return { cancel: () => controller.abort(), close: () => controller.abort() };
        }
    });
}

/** The whole answer as timed events, in the order they happen. */
function timeline(script, { chunkChars, chunkMs, latencyMs, faults }) {
    const items = [];
    const add = (at, type, body = {}) => items.push({ at, type, body, order: items.length });

    add(0, 'current.open', { title: script.title, origin: script.origin });
    let writing = latencyMs;

    for (const segment of script.segments) {
        add(writing, 'segment.begin', { segmentId: segment.id, ...(segment.visual ? { visual: segment.visual } : {}) });
        add(writing, 'state.set', { segmentId: segment.id, state: segment.state });
        let offset = 0;
        while (offset < segment.text.length) {
            writing += chunkMs;
            add(writing, 'segment.text', { segmentId: segment.id, offset, text: segment.text.slice(offset, offset + chunkChars) });
            offset += chunkChars;
        }
        // Lowering-affecting metadata must arrive before the segment is sealed.
        // Otherwise a caller could lower a Current after segment.end and see
        // its Dive/source anchors change later.
        for (const evidence of segment.evidence ?? []) add(writing + 1, 'evidence.add', { segmentId: segment.id, evidence });
        for (const dive of segment.dives ?? []) add(writing + 1, 'dive.attach', { segmentId: segment.id, dive });
        writing += 5;
        add(writing, 'segment.end', { segmentId: segment.id });
        writing += 30;
    }
    add(writing + 10, 'current.complete');

    items.sort((a, b) => a.at - b.at || a.order - b.order);
    const slow = faults.slow ?? 1;
    return items.map(item => ({ ...item, at: item.at * slow }));
}

export function createMockAdapter({
    clock = createRealClock(),
    chunkChars = 24,
    chunkMs = 40,
    latencyMs = 20,
    capacity = 64,
    faults = {},
    openingVisual
} = {}) {
    if (openingVisual !== undefined && !['still', 'attractor', 'genesis'].includes(openingVisual)) {
        throw new TypeError('opening visual must be still, attractor, or genesis');
    }
    let opened = 0;

    return {
        id: 'mock',
        capabilities: Object.freeze({
            providerAudio: false,
            interruption: true,
            resume: true,
            microphone: false
        }),

        async open(input) {
            const request = validateOpenRequest(input);
            const sourceScript = scriptFor(request);
            const script = openingVisual && request.intent === 'answer'
                ? {
                    ...sourceScript,
                    segments: sourceScript.segments.map((segment, index) => index === 0
                        ? { ...segment, visual: openingVisual }
                        : segment)
                }
                : sourceScript;
            const currentId = `${request.intent === 'dive' ? 'dive' : 'answer'}-${opened}`;
            opened += 1;

            const writer = createEventWriter(currentId);
            const log = [];
            const controller = new AbortController();
            const plan = timeline(script, { chunkChars, chunkMs, latencyMs, faults });
            let channel = createChannel({ capacity });
            let closed = false;
            let finished = false;
            let held = null;
            let resumed = null;

            const put = event => { log.push(event); return channel.push(event); };

            /** Emit one item, applying whatever fault is scheduled for its number. */
            async function emit(item) {
                let event = writer.next(item.type, item.body);
                if (faults.malformed?.includes(event.seq)) event = { ...event, onclick: 'alert(1)' };
                if (faults.reorder?.includes(event.seq)) { held = event; return; }
                await put(event);
                if (faults.duplicate?.includes(event.seq)) await channel.push(event);
                if (held) { const late = held; held = null; await put(late); }
                if (faults.failAfter === event.seq) {
                    await put(writer.next('error', { code: 'PROVIDER_FAILED', message: 'The provider failed.', recoverable: false }));
                    finish();
                } else if (faults.recoverableErrorAfter === event.seq) {
                    await put(writer.next('error', { code: 'PROVIDER_SLOW', message: 'The provider is slow.', recoverable: true }));
                }
                if (faults.transportLossAfter === event.seq) {
                    channel.fail(new AdapterError('TRANSPORT_LOST', 'The connection dropped.', { recoverable: true }));
                    await new Promise(resolve => { resumed = resolve; });
                }
            }

            function finish() {
                finished = true;
                channel.close();
            }

            const run = (async () => {
                const began = clock.now();
                try {
                    for (const item of plan) {
                        if (finished) return;
                        const wait = began + item.at - clock.now();
                        if (wait > 0) await clock.sleep(wait, { signal: controller.signal });
                        await emit(item);
                    }
                    finish();
                } catch (error) {
                    if (error?.name !== 'AbortError') throw error;
                }
            })();

            return {
                currentId,

                get events() { return channel; },

                /** A host event, numbered in order with everything else. */
                record(type, body = {}) {
                    if (closed || finished) throw new AdapterError('CLOSED', 'The connection is closed');
                    const event = recordHostEvent({ currentId, writer, type, body });
                    log.push(event);
                    channel.pushNow(event);
                    return event;
                },

                /** Stop what remains. The reader is told, in order, and the Current ends. */
                async interrupt(info = {}) {
                    if (closed || finished) return;
                    controller.abort();
                    await run;
                    const body = { reason: 'user', ...(info.text ? { text: info.text } : {}) };
                    log.push(writer.next('interrupt', body));
                    channel.pushNow(log.at(-1));
                    const cancel = writer.next('current.cancel', { reason: 'interrupted' });
                    log.push(cancel);
                    channel.pushNow(cancel);
                    finished = true;
                    channel.close();
                },

                /** Replay from a sequence number on a fresh channel, then carry on. */
                async resume(fromSeq) {
                    if (closed) throw new AdapterError('CLOSED', 'The connection is closed');
                    if (!Number.isInteger(fromSeq) || fromSeq < 0) throw new AdapterError('RESUME', 'Expected a sequence number');
                    channel = createChannel({ capacity });
                    for (const event of log.filter(item => item.seq >= fromSeq)) channel.pushNow(event);
                    if (finished) channel.close();
                    const release = resumed;
                    resumed = null;
                    release?.();
                },

                async close() {
                    if (closed) return;
                    closed = true;
                    controller.abort();
                    channel.close();
                    resumed?.();
                    await run.catch(() => {});
                }
            };
        }
    };
}
