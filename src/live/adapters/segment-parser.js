/**
 * A model's words, as they stream, into `rise.current-events.v1` events.
 *
 * A text-streaming model cannot be trusted to produce a valid Current. It can
 * be asked to write passages in a plain line format, and this reads that format
 * defensively, so that whatever it actually sends becomes events the reducer
 * will accept, or nothing:
 *
 *     @passage visual=attractor motionEnergy=0.4 solemnity=0.6
 *     The words of the passage, on as many lines as it likes.
 *     @end
 *
 * Anything the format does not name is ignored, never guessed at and never
 * passed on. Specifically:
 *   - a header may set `visual` (only from the closed catalog) and any of the
 *     ten condition dimensions (a number from 0 to 1), and `literal=yes`; every
 *     other key, and any value that is not what it should be, is dropped;
 *   - a passage that says `literal=yes` keeps its bars and bracketed words as
 *     words (nothing is neutralised) and is sent as literal text, which the whole
 *     path knows how to show without obeying; it still loses the score cut and
 *     the stand-ins that escape it, which are never text;
 *   - the playback markers the chunker reads (`|`, `[PAUSE]`, `[FLASH]`,
 *     `[HOLD]`, U+E000) are neutralised here, upstream of the strict refusal in
 *     the protocol, which is not weakened; a marker split across two deltas is
 *     caught too;
 *   - text before any header becomes one plain passage rather than being lost;
 *   - what exceeds a limit (passages, characters) is dropped, and the passage
 *     that reached it is ended where it is;
 *   - a passage is begun only when it has words, so an empty one is nothing;
 *   - an @ line longer than any header is ignored, like any other directive, and
 *     is never held waiting for its end.
 *
 * It is chunk-invariant: however the same text is cut into deltas, the reducer
 * ends with the same passages. It carries no evidence and no Dives: a model
 * that names sources it cannot show is not evidence, and nothing here invents
 * any.
 */

import { RISE_CURRENT_LIMITS, RISE_CURRENT_VISUALS } from '../../core/rise-current.js';
import { EVENT_LIMITS, EXPERIENCE_DIMENSIONS } from '../protocol.js';

/** `header`: an @ line longer than this is not a header (ten dimensions and a visual fit in far less). */
export const PARSER_LIMITS = Object.freeze({ passages: RISE_CURRENT_LIMITS.segments, header: 512 });

/** What a literal passage may never hold: the score cut and the stand-ins that escape the controls. */
export function stripForbidden(text) {
    return text.replace(/[\uE000\uE010\uE011]/gu, '');
}

/** Marker characters and tokens the chunker reads, made ordinary. Idempotent. */
export function neutralise(text) {
    return text
        .replace(/\|/gu, '/')
        .replace(//gu, '')
        .replace(/\[(PAUSE|FLASH|HOLD)\]/giu, '($1)');
}

const VALUE = /^[A-Za-z0-9.+-]{1,24}$/u;

/** A header's settings: only what is allowed, only in range. */
function readHeader(line) {
    const settings = { visual: 'still', state: {}, literal: false };
    for (const token of line.split(/\s+/u).slice(1)) {
        const at = token.indexOf('=');
        if (at <= 0) continue;
        const key = token.slice(0, at);
        const value = token.slice(at + 1);
        if (!VALUE.test(value)) continue;
        if (key === 'visual') {
            if (RISE_CURRENT_VISUALS.includes(value)) settings.visual = value;
        } else if (key === 'literal') {
            if (value === 'yes') settings.literal = true;
        } else if (EXPERIENCE_DIMENSIONS.includes(key)) {
            const level = Number(value);
            if (Number.isFinite(level) && level >= 0 && level <= 1) settings.state[key] = level;
        }
    }
    return settings;
}

/**
 * @param {(type: string, body: object) => void} write receives each event's type and body, in order
 */
export function createSegmentParser(write) {
    let buffer = '';
    let midLine = false;
    let skipping = false;          // inside an @ line too long to be a header, until its newline
    let held = '';                 // the start of what might be a playback marker
    let space = '';                // whitespace waiting for the words that follow it
    let current = null;
    let passages = 0;
    let totalText = 0;
    let finished = false;

    /** What a passage has gathered, as one chunk. */
    const flush = () => {
        if (!current?.pending) return;
        write('segment.text', { segmentId: current.id, offset: current.length - current.pending.length, text: current.pending, ...(current.literal ? { literal: true } : {}) });
        current.pending = '';
    };

    const closeCurrent = () => {
        flush();
        if (current?.began) write('segment.end', { segmentId: current.id });
        current = null;
        space = '';
    };

    const open = settings => {
        closeCurrent();
        if (passages >= PARSER_LIMITS.passages) { current = { dropped: true }; return; }
        passages += 1;
        current = { id: `p${passages}`, ...settings, began: false, length: 0, pending: '', dropped: false };
    };

    /**
     * Words are gathered and sent in chunks as large as the protocol allows, so a passage costs
     * a handful of events however finely the provider cuts it: only ended passages are shown,
     * and the reader's queue and the Current's event budget are not spent on single letters.
     * Never past a limit.
     */
    function send(words) {
        if (current === null) open({ visual: 'still', state: {} });
        if (current.dropped) return;
        const room = Math.min(RISE_CURRENT_LIMITS.segmentText - current.length, RISE_CURRENT_LIMITS.totalText - totalText);
        // What does not fit is dropped with the space before it: the protocol refuses a blank chunk.
        const fits = words.length <= room;
        let rest = fits ? words : words.slice(0, Math.max(0, room)).trimEnd();
        if (rest && !current.began) {
            current.began = true;
            write('segment.begin', { segmentId: current.id, visual: current.visual, ...(current.literal ? { literal: true } : {}) });
            if (Object.keys(current.state).length) write('state.set', { segmentId: current.id, state: current.state });
        }
        while (rest) {
            const piece = rest.slice(0, EVENT_LIMITS.textChunk - current.pending.length);
            rest = rest.slice(piece.length);
            current.pending += piece;
            current.length += piece.length;
            totalText += piece.length;
            if (current.pending.length >= EVENT_LIMITS.textChunk) flush();
        }
        if (!fits) {
            // A limit was reached: this passage ends where it is, and the rest of it is dropped.
            closeCurrent();
            current = { dropped: true };
        }
    }

    /** Words in: neutralised, whitespace kept out of the ends of what is sent. */
    function text(raw) {
        if (!raw) return;
        if (current?.dropped) return;
        const literal = current?.literal === true;
        let joined = held + raw;
        held = '';
        // The start of "[PAUSE]" at the very end may become one with the next delta. A literal
        // passage has nothing to hold back: its markers are words.
        const partial = literal ? null : /\[[A-Za-z]{0,5}$/u.exec(joined);
        if (partial) { held = partial[0]; joined = joined.slice(0, partial.index); }
        // Whitespace is one space, and belongs between words: it is sent with the words after it,
        // never on its own (the protocol refuses a blank chunk) and never at either end.
        const body = (literal ? stripForbidden(joined) : neutralise(joined)).replace(/\s+/gu, ' ');
        const core = body.trim();
        const started = current?.began === true;
        if (!core) {
            if (started) space = ' ';
            return;
        }
        const prefix = started ? (space || (body.startsWith(' ') ? ' ' : '')) : '';
        send(prefix + core);
        space = body.endsWith(' ') ? ' ' : '';
    }

    /** A line has ended. A marker cannot continue past it, so what was held back is words of this line. */
    function endLine() {
        if (held) {
            const rest = held;
            held = '';
            if (!current?.dropped) send((current?.began ? space : '') + rest);
        }
        if (current?.began) space = ' ';
    }

    function line(content) {
        if (midLine) {
            text(content);
            midLine = false;
            endLine();
            return;
        }
        if (content.startsWith('@')) {
            const word = content.split(/\s+/u, 1)[0].toLowerCase();
            if (content.length > PARSER_LIMITS.header) return;
            if (word === '@passage') open(readHeader(content));
            else if (word === '@end') closeCurrent();
            // Any other directive is not part of the format and is ignored.
            return;
        }
        text(content);
        endLine();
    }

    return {
        /** More of the model's words. */
        push(delta) {
            if (finished || typeof delta !== 'string' || !delta) return;
            buffer += delta.replace(/\r/gu, '');
            if (skipping) {
                const newline = buffer.indexOf('\n');
                if (newline < 0) { buffer = ''; return; }
                buffer = buffer.slice(newline + 1);
                skipping = false;
            }
            for (;;) {
                const newline = buffer.indexOf('\n');
                if (newline < 0) break;
                const complete = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 1);
                line(complete);
            }
            if (buffer) {
                // The start of a line that might be a header waits for its newline; anything else is words.
                if (!midLine && buffer.startsWith('@')) {
                    if (buffer.length > PARSER_LIMITS.header) { buffer = ''; skipping = true; }
                    return;
                }
                text(buffer);
                buffer = '';
                midLine = true;
            }
        },

        /** The model has said all it will. Ends what is open; emits nothing for what never had words. */
        finish() {
            if (finished) return { passages };
            if (buffer) {
                if (midLine || !buffer.startsWith('@')) text(buffer);
                else line(buffer);
                buffer = '';
            }
            endLine();
            closeCurrent();
            finished = true;
            return { passages };
        },

        /**
         * Stop, and let go of a passage that was not finished. It is left open, never ended: only
         * whole passages are ever read or spoken, so half a sentence is not, and an answer that was
         * cut off, interrupted or lost ends at the last passage that was complete.
         */
        abandon() {
            finished = true;
            buffer = '';
            skipping = false;
            held = '';
            space = '';
            current = null;
        },

        get passages() { return passages; }
    };
}
