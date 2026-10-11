/**
 * A sealed Current, as the events a live one would have sent.
 *
 * This is how an answer that arrives whole (from a host's model, as a tool's
 * argument) enters the same reducer, runtime and Player as one that streams.
 * It is validated first, by the sealed Current's own strict validator, so a
 * hostile field, marker, anchor or oversize answer is refused before a single
 * event exists. Nothing is added: a sealed Current has no evidence and no
 * condition, and none is made up.
 *
 * A v1 Current sends its passages. A v2 Current is sent as the beat stream it
 * would have been (docs/specs/LIVE-CURRENT-EVENTS-V1.md, "Beats streamed"):
 * each scene declared, with its source, before the first beat that starts it,
 * then each beat with its fields and its words, so the reducer holds it to
 * rise.current.v2's own bounds (64 beats), not to a passage stream's (16
 * passages, rise.current.v1's), and every beat reaches the voice with all its
 * words. The whole Current still rides beside the stream to the runtime (the
 * adapter's `sealed`), which compiles it.
 */

import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../../core/rise-current.js';
import { EVENT_LIMITS } from '../protocol.js';

/** `text` as [offset, piece] of at most `size` characters; words are never cut into a blank piece. */
function pieces(text, size, { words = true } = {}) {
    const out = [];
    for (let offset = 0; offset < text.length;) {
        let end = Math.min(text.length, offset + size);
        while (words && end < text.length && !text.slice(offset, end).trim()) end += 1;
        out.push([offset, text.slice(offset, end)]);
        offset = end;
    }
    return out;
}

/** A v2 Current's scenes and beats as a beat stream: what the reducer rebuilds the same Current from. */
function beatEvents({ scenes, beats }) {
    const sceneById = new Map(scenes.map(scene => [scene.id, scene]));
    const declared = new Set();
    const events = [];
    beats.forEach((beat, index) => {
        if (beat.scene !== undefined && !declared.has(beat.scene)) {
            declared.add(beat.scene);
            const { id, engine, params, code, svg } = sceneById.get(beat.scene);
            const source = code ?? svg;
            if (source === undefined) {
                events.push({ type: 'scene.declare', body: { sceneId: id, engine, ...(params ? { params: { ...params } } : {}) } });
            } else {
                events.push({ type: 'scene.declare', body: { sceneId: id, form: code === undefined ? 'svg' : 'code' } });
                for (const [offset, text] of pieces(source, EVENT_LIMITS.sceneChunk, { words: false })) {
                    events.push({ type: 'scene.text', body: { sceneId: id, offset, text } });
                }
            }
        }
        const segmentId = `beat-${index}`;
        const { kind, say, show, ...fields } = beat;
        // A said beat's words are what it says, and it shows other words only when it was given them; a shown beat's
        // words are what it shows; a hold has none.
        const body = kind === 'say' && show !== say ? { ...fields, show } : { ...fields };
        const words = kind === 'say' ? say : kind === 'show' ? show : '';
        events.push({ type: 'segment.begin', body: { segmentId, beat: body } });
        for (const [offset, text] of pieces(words, EVENT_LIMITS.textChunk)) events.push({ type: 'segment.text', body: { segmentId, offset, text } });
        events.push({ type: 'segment.end', body: { segmentId } });
    });
    return events;
}

/**
 * @param {unknown} input a `rise.current.v1` or `rise.current.v2`, from anywhere
 * @returns {Array<{type: string, body: object}>}
 * @throws {RiseCurrentError} if it is not a valid sealed Current
 */
export function currentToEvents(input) {
    const current = validateRiseCurrent(input);
    const events = [{ type: 'current.open', body: {
        title: current.title, origin: current.origin,
        ...(current.theme ? { theme: current.theme } : {}), ...(current.look ? { look: current.look } : {})
    } }];
    if (current.schema === RISE_CURRENT_SCHEMA_V2) events.push(...beatEvents(current));
    else {
        for (const segment of current.segments) {
            const literal = segment.literal ? { literal: true } : {};
            const visual = segment.visual === undefined ? {} : { visual: segment.visual };
            events.push({ type: 'segment.begin', body: { segmentId: segment.id, ...visual, ...literal } });
            for (const [offset, text] of pieces(segment.text, EVENT_LIMITS.textChunk)) {
                events.push({ type: 'segment.text', body: { segmentId: segment.id, offset, text, ...literal } });
            }
            for (const dive of segment.dives) {
                events.push({ type: 'dive.attach', body: { segmentId: segment.id, dive: { id: dive.id, text: dive.text, anchor: { ...dive.anchor } } } });
            }
            events.push({ type: 'segment.end', body: { segmentId: segment.id } });
        }
    }
    events.push({ type: 'current.complete', body: {} });
    return events;
}
