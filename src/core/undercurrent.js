/**
 * The undercurrent: what lies under a passage.
 *
 * A reading runs on its surface, the words and the image and the sound the
 * score puts against them. Under a span of those words there may be more: a
 * gloss someone wrote, an earlier passage the words echo, and the image and
 * sound the score has anchored there. `undercurrentAt` gathers what lies under
 * one atom. It reads what compilation already stamped on the atom
 * (`sourceSpanIds`) and reads the canonical program for the rest. It adds no
 * state to the Session and never moves the reading.
 *
 * EVERY THREAD SAYS WHICH KIND OF WORDS IT IS. A gloss was written, by whoever
 * authored the program, and says so. An echo was received: it holds no text of
 * its own, only where to find it, and the words shown are the edition's, read
 * from the exact source text. So a reader can always tell a text they were
 * handed from one written here, which is the promise provenance keeps.
 *
 * REVERENT DEGRADATION. An echo whose words cannot be found, or whose opening
 * words occur twice and so name no one place, is left out. Nothing is guessed
 * in its place, and the rest of the undercurrent is unaffected.
 */

import { cueForAtom } from './visual-scheduler.js';
import { locateQuoteSpan } from './source-span.js';

const EMPTY = Object.freeze({ threads: Object.freeze([]), visual: null, audio: null });

const FALLBACK_ID = '__fallback__';

/** A session's thread track and its clips by id, built once per session. */
const threadIndexes = new WeakMap();

function threadIndex(session) {
    let index = threadIndexes.get(session);
    if (!index) {
        const track = session.experienceProgram?.tracks?.find(item => item.kind === 'thread');
        index = {
            prefix: track ? `${track.id}:` : null,
            clips: new Map((track?.clips || []).map(clip => [clip.id, clip]))
        };
        threadIndexes.set(session, index);
    }
    return index;
}

/** The edition's own words for an echo, or null when they are not one place. */
function echoedWords(session, of) {
    const raw = session.sourceTexts?.get(of.sourceId);
    if (typeof raw !== 'string') return null;
    let span;
    try {
        span = locateQuoteSpan(raw, of.quoteStart, of.quoteEnd);
    } catch {
        return null;
    }
    if (!span) return null;
    const words = raw.slice(span.fromCharacter, span.toCharacter).replace(/\s+/g, ' ').trim();
    return words || null;
}

function threadFor(session, clip) {
    if (clip.cue.kind === 'gloss') {
        return {
            id: clip.id,
            kind: 'gloss',
            provenance: 'written',
            authority: session.experienceProgram.authority,
            text: clip.cue.text
        };
    }
    const text = echoedWords(session, clip.cue.of);
    if (text === null) return null;
    return {
        id: clip.id,
        kind: 'echo',
        provenance: 'received',
        source: clip.cue.of.sourceId,
        text
    };
}

/** A cue the score anchored to this atom, and not the program's fallback. */
function anchoredCue(program, atom) {
    if (!program) return null;
    const { id, cue } = cueForAtom(program, atom);
    return id === FALLBACK_ID ? null : { id, cue };
}

/**
 * What lies under one atom of a compiled reading.
 *
 * @param {object} session a compiled Session
 * @param {number} atomIndex
 * @returns {{
 *   threads: Array<object>,
 *   visual: {id: string, cue: object}|null,
 *   audio: {id: string, cue: object}|null
 * }}
 */
export function undercurrentAt(session, atomIndex) {
    const atom = session?.atoms?.[atomIndex];
    if (!atom) return EMPTY;

    const { prefix, clips } = threadIndex(session);
    const threads = [];
    for (const spanId of atom.sourceSpanIds || []) {
        if (prefix === null || !spanId.startsWith(prefix)) continue;
        const clip = clips.get(spanId.slice(prefix.length));
        const thread = clip ? threadFor(session, clip) : null;
        if (thread) threads.push(thread);
    }

    const visual = anchoredCue(session.visualProgram, atom);
    const audio = anchoredCue(session.audioProgram, atom);
    if (!threads.length && !visual && !audio) return EMPTY;
    return { threads, visual, audio };
}
