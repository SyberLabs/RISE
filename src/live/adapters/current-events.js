/**
 * A sealed Current, as the events a live one would have sent.
 *
 * This is how an answer that arrives whole (from a host's model, as a tool's
 * argument) enters the same reducer, runtime and Player as one that streams.
 * It is validated first, by the sealed Current's own strict validator, so a
 * hostile field, marker, anchor or oversize answer is refused before a single
 * event exists. Nothing is added: a sealed Current has no evidence and no
 * condition, and none is made up.
 */

import { validateRiseCurrent } from '../../core/rise-current.js';
import { EVENT_LIMITS } from '../protocol.js';

/**
 * @param {unknown} input a `rise.current.v1`, from anywhere
 * @returns {Array<{type: string, body: object}>}
 * @throws {RiseCurrentError} if it is not a valid sealed Current
 */
export function currentToEvents(input) {
    const current = validateRiseCurrent(input);
    const events = [{ type: 'current.open', body: { title: current.title, origin: current.origin } }];
    for (const segment of current.segments) {
        const literal = segment.literal ? { literal: true } : {};
        events.push({ type: 'segment.begin', body: { segmentId: segment.id, visual: segment.visual, ...literal } });
        for (let offset = 0; offset < segment.text.length;) {
            // A chunk is never blank, however the whitespace in the text falls.
            let end = Math.min(segment.text.length, offset + EVENT_LIMITS.textChunk);
            while (end < segment.text.length && !segment.text.slice(offset, end).trim()) end += 1;
            events.push({ type: 'segment.text', body: { segmentId: segment.id, offset, text: segment.text.slice(offset, end), ...literal } });
            offset = end;
        }
        events.push({ type: 'segment.end', body: { segmentId: segment.id } });
        for (const dive of segment.dives) {
            events.push({ type: 'dive.attach', body: { segmentId: segment.id, dive: { id: dive.id, text: dive.text, anchor: { ...dive.anchor } } } });
        }
    }
    events.push({ type: 'current.complete', body: {} });
    return events;
}
