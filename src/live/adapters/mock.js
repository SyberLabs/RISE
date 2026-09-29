/**
 * The deterministic provider.
 *
 * It plays a scripted answer on a clock it is given, so the same script always
 * yields the same events at the same times, offline, with no credentials. It
 * exists to be driven: it can be slow, repeat events, send them out of order,
 * send one malformed, drop its connection, fail, or be interrupted, and every
 * other adapter is held to the same conformance fixture it is.
 *
 * SPEECH. This adapter has no audio of its own. It reports a synthetic speech
 * timeline (`speech.start`, `speech.mark`, `speech.end`) as a provider that
 * supplies audio would, at a fixed number of milliseconds per character, so the
 * runtime's one clock has something exact to follow in tests.
 *
 * COMPOSING AHEAD. Text is written far faster than it is spoken, so later
 * segments, their state, their evidence and their Dives arrive while earlier
 * ones are still being said.
 */

import {
    AdapterError,
    createChannel,
    createEventWriter,
    validateOpenRequest
} from '../adapter.js';
import { createRealClock } from '../clock.js';
import { scriptFor } from '../fixtures/black-holes.js';
import { validateEvent } from '../protocol.js';

/** What a host may write into the ordered stream. Provider content it may not. */
const HOST_TYPES = Object.freeze([
    'interrupt', 'branch.open', 'branch.close', 'speech.start', 'speech.mark', 'speech.end'
]);

/** The gap left between one utterance and the next. */
const BREATH_MS = 150;

function wordStarts(text) {
    return [...text.matchAll(/\S+/gu)].map(match => match.index);
}

/** The whole answer as timed events, in the order they happen. */
function timeline(script, { chunkChars, chunkMs, latencyMs, msPerChar, faults }) {
    const items = [];
    const add = (at, type, body = {}) => items.push({ at, type, body, order: items.length });

    add(0, 'current.open', { title: script.title, origin: script.origin });
    let writing = latencyMs;
    let audioFree = 0;

    for (const segment of script.segments) {
        const began = writing;
        add(writing, 'segment.begin', { segmentId: segment.id, ...(segment.visual ? { visual: segment.visual } : {}) });
        add(writing, 'state.set', { segmentId: segment.id, state: segment.state });
        let offset = 0;
        while (offset < segment.text.length) {
            writing += chunkMs;
            add(writing, 'segment.text', { segmentId: segment.id, offset, text: segment.text.slice(offset, offset + chunkChars) });
            offset += chunkChars;
        }
        writing += 5;
        add(writing, 'segment.end', { segmentId: segment.id });
        for (const evidence of segment.evidence ?? []) add(writing + 1, 'evidence.add', { segmentId: segment.id, evidence });
        for (const dive of segment.dives ?? []) add(writing + 1, 'dive.attach', { segmentId: segment.id, dive });

        // The voice starts when it is free and there is something to say, and never sooner.
        const speakAt = Math.max(audioFree, began + chunkMs);
        const duration = segment.text.length * msPerChar;
        add(speakAt, 'speech.start', { segmentId: segment.id });
        wordStarts(segment.text).filter((_, index) => index > 0 && index % 3 === 0).forEach(charIndex => {
            add(speakAt + charIndex * msPerChar, 'speech.mark', { segmentId: segment.id, charIndex, tMs: charIndex * msPerChar });
        });
        add(speakAt + duration, 'speech.end', { segmentId: segment.id, durationMs: duration });
        audioFree = speakAt + duration + BREATH_MS;
        writing += 30;
    }
    const end = Math.max(audioFree, writing) + 10;
    add(end, 'current.complete');

    items.sort((a, b) => a.at - b.at || a.order - b.order);
    const slow = faults.slow ?? 1;
    return items.map(item => ({ ...item, at: item.at * slow }));
}

export function createMockAdapter({
    clock = createRealClock(),
    chunkChars = 24,
    chunkMs = 40,
    latencyMs = 20,
    msPerChar = 62,
    capacity = 64,
    faults = {}
} = {}) {
    let opened = 0;

    return {
        id: 'mock',
        capabilities: Object.freeze({
            speech: 'synthetic-timeline',
            providerAudio: false,
            interruption: true,
            resume: true,
            microphone: false
        }),

        async open(input) {
            const request = validateOpenRequest(input);
            const script = scriptFor(request);
            const currentId = `${request.intent === 'dive' ? 'dive' : 'answer'}-${opened}`;
            opened += 1;

            const writer = createEventWriter(currentId);
            const log = [];
            const controller = new AbortController();
            const plan = timeline(script, { chunkChars, chunkMs, latencyMs, msPerChar, faults });
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
                    if (!HOST_TYPES.includes(type)) throw new AdapterError('RECORD', `A host may not write ${type}`);
                    const candidate = { schema: 'rise.current-events.v1', currentId, seq: writer.nextSeq, type, ...body };
                    try {
                        validateEvent(candidate);
                    } catch (error) {
                        throw new AdapterError('RECORD', error.message);
                    }
                    const event = writer.next(type, body);
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
