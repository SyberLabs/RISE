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
 *
 * BEATS. The same parser reads a beat stream, one beat per line, with the
 * scenes the beats start declared inline (docs/specs/LIVE-CURRENT-EVENTS-V1.md,
 * "Beats streamed", which holds the grammar and these rules):
 *
 *     @say [options] <words>                   @show hold=<ms> [options] <words>
 *     @say [options] <said> => <shown>         @hold <ms> [max=<ms>] [options]
 *     @scene <id> <engine> [param=value ...]   @scene <id> code|svg, then a ``` fence
 *
 * The first line decides which format the answer is in. A beat is read only
 * when its line is whole, so a line cut off is never a beat. What v2 would
 * refuse and the parser can know (an option out of bounds, a cue the running
 * scene does not take, a scene never declared) is dropped here, so the
 * reducer refuses nothing; whether a generated scene or a figure is admitted
 * is the reducer's to say, by the Worker's own admission.
 *
 * ENDING. An answer to an interjection ends with `@then resume|replace|end`
 * on a line of its own, in either format (docs/plans/LIVE-CURRENT.md §17).
 * It ends the answer: `finish` reports it, it is never words, nothing after
 * it is read, and the parser is `full` so a provider still writing is stopped.
 */

import { soundKind } from '../../audio/sound-ids.js';
import { BEAT_CUE_PATTERN, BEAT_LIMITS, BEAT_PLACES, BEAT_SIZES, BEAT_TYPES, SCENE_ENGINES, cueCommands, validateSceneParams } from '../../core/beats.js';
import { sceneCodeBytes } from '../../core/experience-program.js';
import { RISE_CURRENT_LIMITS, RISE_CURRENT_VISUALS } from '../../core/rise-current.js';
import { EVENT_LIMITS, EXPERIENCE_DIMENSIONS } from '../protocol.js';

/**
 * `header`: an @ line longer than this is not a header (ten dimensions and a visual fit in far less).
 * `beatLine`: a beat line longer than this is not one (its words, at most v2's 4,000, and its options).
 * `fenceLine`: a line of a scene's source longer than this is past any source's budget.
 */
export const PARSER_LIMITS = Object.freeze({
    passages: RISE_CURRENT_LIMITS.segments, header: 512,
    beats: BEAT_LIMITS.beats, beatLine: 4_600, fenceLine: Math.max(BEAT_LIMITS.code, BEAT_LIMITS.svg)
});

/** A line that begins a beat or declares a scene. */
const BEAT_DIRECTIVE = /^@(say|show|hold|scene)(?:\s|$)/iu;
/** The line an answer to an interjection ends with: how the held reading goes on (docs/plans/LIVE-CURRENT.md §17). */
const THEN = /^@then\s+(resume|replace|end)$/iu;
const OPTION = /^([a-z]+)=(\S+)$/u;
const SCENE_ID = /^[A-Za-z0-9_-]{1,40}$/u;
const CUE = new RegExp(BEAT_CUE_PATTERN, 'u');
/** The options each directive takes, before its words. */
const OPTIONS = Object.freeze({
    say: ['scene', 'cue', 'place', 'size', 'type', 'emphasis', 'sound', 'transition'],
    show: ['hold', 'scene', 'cue', 'place', 'size', 'type', 'emphasis', 'sound', 'transition'],
    hold: ['max', 'scene', 'cue', 'sound', 'transition']
});
/** A scene whose `scene=` was dropped: cues are dropped until a scene that exists starts. */
const NO_SCENE = Symbol('no scene');

const wholeMs = (value, min, max) => {
    if (!/^\d{1,6}$/u.test(value)) return null;
    const ms = Number(value);
    return ms >= min && ms <= max ? ms : null;
};

/** A parameter's value as the manifest reads it: a number when it is one, else the word. */
const paramValue = value => (/^-?\d+(\.\d+)?$/u.test(value) ? Number(value) : value);

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
    /** 'passages' or 'beats', decided by the first line that is one or the other. */
    let mode = null;
    // A beat stream: the beats sent, the scenes declared (id -> { engine } or { form }), the scene the model
    // means to be running, a `@scene … code|svg` line waiting for its fence, and the fence being read.
    let beatCount = 0;
    const scenes = new Map();
    let running = null;
    let awaitingFence = null;
    let fence = null;
    /** The ending an `@then` line named, the last one; null if none. */
    let ending = null;

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
        mode = 'passages';
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
        mode = 'passages';
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

    // ─── beats ──────────────────────────────────────────────────────────

    /** Words as a beat says or shows them: neutralised, one space between, none at the ends. */
    const words = raw => neutralise(raw).replace(/\s+/gu, ' ').trim();

    /** One beat: its begin, its words in chunks the protocol allows, its end. Dropped whole if its words do not fit. */
    function emitBeat(body, said) {
        if (beatCount >= PARSER_LIMITS.beats) return;
        const shown = body.show?.length ?? 0;
        if (said.length > BEAT_LIMITS.text || totalText + said.length + shown > BEAT_LIMITS.totalText) return;
        const segmentId = `beat-${beatCount}`;
        beatCount += 1;
        totalText += said.length + shown;
        write('segment.begin', { segmentId, beat: body });
        for (let offset = 0; offset < said.length; offset += EVENT_LIMITS.textChunk) {
            write('segment.text', { segmentId, offset, text: said.slice(offset, offset + EVENT_LIMITS.textChunk) });
        }
        write('segment.end', { segmentId });
    }

    /** The scene a beat starts and the cue it gives, kept only where the scene exists and takes the cue. */
    function sceneAndCue(body, options) {
        if (options.scene !== undefined) {
            if (scenes.has(options.scene)) {
                body.scene = options.scene;
                running = options.scene;
            } else running = NO_SCENE;
        }
        const cue = options.cue;
        if (cue === undefined || !CUE.test(cue) || cue.length > BEAT_LIMITS.cue || running === null || running === NO_SCENE) return;
        const scene = scenes.get(running);
        if (scene.form === 'svg' || (scene.engine !== undefined && cueCommands(scene.engine, cue) === null)) return;
        body.cue = cue;
    }

    /** The options a beat line gives before its words, each kept only if it is what it should be. */
    function readOptions(tokens, allowed) {
        const options = {};
        let at = 0;
        for (; at < tokens.length; at += 1) {
            const match = OPTION.exec(tokens[at]);
            if (!match || !allowed.includes(match[1])) break;
            options[match[1]] = match[2];
        }
        return { options, rest: tokens.slice(at).join(' ') };
    }

    /** What every beat may set besides its scene and cue. */
    function typography(body, options) {
        if (BEAT_PLACES.includes(options.place)) body.place = options.place;
        if (BEAT_SIZES.includes(options.size)) body.size = options.size;
        if (BEAT_TYPES.includes(options.type)) body.type = options.type;
        if (options.emphasis !== undefined) {
            const list = options.emphasis.split(',').map(word => word.trim()).filter(Boolean);
            if (list.length && list.length <= BEAT_LIMITS.emphasis && list.every(word => word.length <= BEAT_LIMITS.emphasisLength)) body.emphasis = list;
        }
    }

    function sound(body, options) {
        if (options.sound !== undefined && soundKind(options.sound) !== null) body.sound = options.sound;
        const transition = options.transition === undefined ? null : wholeMs(options.transition, 0, BEAT_LIMITS.transitionMaxMs);
        if (transition !== null) body.transition = { ms: transition };
    }

    function sayBeat(tokens) {
        const { options, rest } = readOptions(tokens, OPTIONS.say);
        const split = rest.indexOf(' => ');
        const said = words(split < 0 ? rest : rest.slice(0, split));
        const shown = split < 0 ? '' : words(rest.slice(split + 4));
        if (!said) return;
        const body = {};
        if (shown && shown !== said) body.show = shown;
        sceneAndCue(body, options);
        typography(body, options);
        sound(body, options);
        emitBeat(body, said);
    }

    function showBeat(tokens) {
        const { options, rest } = readOptions(tokens, OPTIONS.show);
        const ms = options.hold === undefined ? null : wholeMs(options.hold, BEAT_LIMITS.holdMinMs, BEAT_LIMITS.holdMaxMs);
        const shown = words(rest);
        if (ms === null || !shown) return;
        const body = { hold: { ms } };
        sceneAndCue(body, options);
        typography(body, options);
        sound(body, options);
        emitBeat(body, shown);
    }

    function holdBeat(tokens) {
        const ms = wholeMs(tokens[0] ?? '', BEAT_LIMITS.holdMinMs, BEAT_LIMITS.holdMaxMs);
        if (ms === null) return;
        const { options } = readOptions(tokens.slice(1), OPTIONS.hold);
        const max = options.max === undefined ? null : wholeMs(options.max, ms, BEAT_LIMITS.holdMaxMs);
        const body = { hold: max === null ? { ms } : { ms, maxMs: max } };
        sceneAndCue(body, options);
        sound(body, options);
        emitBeat(body, '');
    }

    /** `@scene <id> <engine> [param=value …]` declares a native scene now; `@scene <id> code|svg` waits for its fence. */
    function sceneLine(tokens) {
        const [sceneId, what = '', ...params] = tokens;
        if (!SCENE_ID.test(sceneId ?? '') || scenes.has(sceneId) || scenes.size >= BEAT_LIMITS.scenes) return;
        const form = what.toLowerCase();
        if (form === 'code' || form === 'svg') {
            awaitingFence = { id: sceneId, form };
            return;
        }
        if (!SCENE_ENGINES.includes(what)) return;
        // Only the parameters the engine's manifest admits are kept.
        const kept = {};
        for (const token of params) {
            const match = /^([A-Za-z]+)=(\S+)$/u.exec(token);
            if (!match) continue;
            const candidate = { [match[1]]: paramValue(match[2]) };
            try {
                Object.assign(kept, validateSceneParams(what, candidate, '$.params'));
            } catch {
                // Not this engine's, or out of its range: dropped.
            }
        }
        scenes.set(sceneId, { engine: what });
        write('scene.declare', { sceneId, engine: what, ...(Object.keys(kept).length ? { params: kept } : {}) });
    }

    /** A fence has closed: a source within its budget is declared and sent in pieces; one past it is dropped with its scene. */
    function closeFence() {
        const { id, form, lines, over } = fence;
        fence = null;
        const source = lines.join('\n');
        if (over || !source.trim() || scenes.has(id) || scenes.size >= BEAT_LIMITS.scenes) return;
        scenes.set(id, { form });
        write('scene.declare', { sceneId: id, form });
        for (let offset = 0; offset < source.length; offset += EVENT_LIMITS.sceneChunk) {
            write('scene.text', { sceneId: id, offset, text: source.slice(offset, offset + EVENT_LIMITS.sceneChunk) });
        }
    }

    /** A line of a scene's source, counted against its budget as it arrives. */
    function fenceLine(content) {
        if (fence.over) return;
        fence.bytes += sceneCodeBytes(content) + (fence.lines.length ? 1 : 0);
        if (content.length > PARSER_LIMITS.fenceLine || fence.bytes > (fence.form === 'code' ? BEAT_LIMITS.code : BEAT_LIMITS.svg)) {
            fence.over = true;
            fence.lines = [];
            return;
        }
        fence.lines.push(content);
    }

    function beatLine(content) {
        if (fence) {
            if (content.trim() === '```') { closeFence(); return; }
            // A fence the model left open is closed by the next line that begins a beat or a scene.
            if (!BEAT_DIRECTIVE.test(content)) { fenceLine(content); return; }
            closeFence();
        }
        if (awaitingFence) {
            if (!content.trim()) return;
            const waiting = awaitingFence;
            awaitingFence = null;
            if (content.trimStart().startsWith('```')) {
                fence = { ...waiting, lines: [], bytes: 0, over: false };
                return;
            }
            // No fence: the scene is not declared, and this line is read as itself.
        }
        if (content.length > PARSER_LIMITS.beatLine) return;
        const trimmed = content.trim();
        if (!trimmed) return;
        const tokens = trimmed.split(/\s+/u);
        const word = tokens[0].toLowerCase();
        if (word === '@say') sayBeat(tokens.slice(1));
        else if (word === '@show') showBeat(tokens.slice(1));
        else if (word === '@hold') holdBeat(tokens.slice(1));
        else if (word === '@scene') sceneLine(tokens.slice(1));
        // In a beat stream a line of words is said; any other directive, @passage and @end among them, is ignored.
        else if (!trimmed.startsWith('@')) sayBeat(tokens);
    }

    /**
     * A partial line too long to be read is skipped to its newline. It has the effect reading it whole would have:
     * past a fence's budget, the fence's source is dropped; a beat line too long is nothing, and a scene line waiting
     * for its fence has none.
     */
    function skipLine(start) {
        if (mode === null && BEAT_DIRECTIVE.test(start)) mode = 'beats';
        if (mode !== 'beats') return;
        if (fence) { fence.over = true; fence.lines = []; } else awaitingFence = null;
    }

    /** How long a partial line may grow while it waits for its newline. */
    function waitLimit(start) {
        if (mode === 'beats') return fence ? PARSER_LIMITS.fenceLine : PARSER_LIMITS.beatLine;
        return mode === null && BEAT_DIRECTIVE.test(start) ? PARSER_LIMITS.beatLine : PARSER_LIMITS.header;
    }

    function line(content) {
        // Nothing after `@then` is read: the answer has ended.
        if (ending !== null) return;
        // `@then …` names an ending in either format, on a line of its own; inside a scene's source it is source.
        const then = !fence && !midLine ? THEN.exec(content.trim()) : null;
        if (then) { ending = then[1].toLowerCase(); return; }
        if (mode === 'beats') { beatLine(content); return; }
        if (midLine) {
            text(content);
            midLine = false;
            endLine();
            return;
        }
        if (mode === null && BEAT_DIRECTIVE.test(content)) {
            mode = 'beats';
            beatLine(content);
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
            if (finished || ending !== null || typeof delta !== 'string' || !delta) return;
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
            if (ending !== null) { buffer = ''; return; }
            if (buffer) {
                // The start of a line that might be a header, and every line of a beat stream, waits for its
                // newline; anything else is words.
                if (mode === 'beats' || (!midLine && buffer.startsWith('@'))) {
                    if (buffer.length > waitLimit(buffer)) { skipLine(buffer); buffer = ''; skipping = true; }
                    return;
                }
                text(buffer);
                buffer = '';
                midLine = true;
            }
        },

        /**
         * The model has said all it will. Ends what is open; emits nothing for what never had words. `ending` is what
         * an `@then` line named, or null.
         */
        finish() {
            if (finished) return { passages: passages + beatCount, ending };
            if (buffer) {
                if (mode !== 'beats' && (midLine || !buffer.startsWith('@'))) text(buffer);
                else line(buffer);
                buffer = '';
            }
            endLine();
            closeCurrent();
            // A fence still open when the answer ends started nothing: its scene is let go.
            fence = null;
            awaitingFence = null;
            finished = true;
            return { passages: passages + beatCount, ending };
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
            fence = null;
            awaitingFence = null;
        },

        /** Passages, or beats, sent so far. */
        get passages() { return passages + beatCount; },

        /** True once a limit, or an ending named, means that nothing more the model writes can become words. */
        get full() {
            return ending !== null
                || totalText >= RISE_CURRENT_LIMITS.totalText
                || beatCount >= PARSER_LIMITS.beats
                || (passages >= PARSER_LIMITS.passages && (current === null || current.dropped === true));
        }
    };
}
