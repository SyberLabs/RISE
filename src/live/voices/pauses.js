/**
 * Pauses inside a passage, for any voice (docs/superpowers/specs/2026-10-26-math-both-channels-design.md §3.7).
 *
 * No voice can be silent in the middle of what it is given, so a passage with
 * pauses (`enqueue({ id, text, pauses: [{ at, ms }] })`, `at` a place in the
 * text) is given to the voice in parts, cut at each pause, all at once so a
 * voice that fetches ahead still does. When a part ends, the voice is held for
 * the pause on the clock, then let go; the next part, or the next passage,
 * begins after it. A pause at the very end keeps the passage, and what is on
 * screen with it, before the next passage begins.
 *
 * Whoever attached hears one passage: its start, its marks at places in the
 * whole text with the time played into the whole (pauses counted), its end
 * with the whole duration. The voice's own hold is the reader's; while a pause
 * is held, the pause stands still and goes on for what was left of it on
 * release. A pause is the pace's too: at twice the pace it is half as long.
 */

import { createRealClock } from '../clock.js';

export function withPauses(voice, { clock = createRealClock() } = {}) {
    let report = {};
    let rate = 1;
    /** The reader's hold, apart from the voice being held for a pause. */
    let held = false;
    /** Each passage given, by its id: its parts, the part under way, and the time played before it. */
    const passages = new Map();
    /** Each part, by the id the voice was given it under. */
    const parts = new Map();
    /** The pause under way: the passage, how long is left, since when it has run, and what follows it. */
    let pause = null;

    const tell = (name, ...args) => report[name]?.(...args);
    const partOf = innerId => parts.get(innerId) ?? null;

    function finish(passage) {
        passage.done = true;
        tell('end', passage.id, passage.playedBefore);
    }

    function runPause() {
        pause.since = clock.now();
        pause.cancel = clock.setTimer(() => {
            const done = pause;
            pause = null;
            done.passage.playedBefore += done.length;
            done.then();
            if (!held) voice.release();
        }, Math.max(0, pause.left));
    }

    function stopPause() {
        if (!pause?.cancel) return;
        pause.cancel();
        pause.cancel = null;
        pause.left -= clock.now() - pause.since;
        pause.since = null;
    }

    /** Forget the pause under way; the voice, held only for it, is let go. */
    function dropPause() {
        if (!pause) return;
        pause.cancel?.();
        pause = null;
        if (!held) voice.release();
    }

    function startPause(passage, ms, then) {
        voice.hold();
        const length = ms / rate;
        pause = { passage, length, left: length, since: null, cancel: null, then };
        if (!held) runPause();
    }

    const callbacks = {
        start(innerId, how) {
            const part = partOf(innerId);
            if (!part) return tell('start', innerId, how);
            part.passage.index = part.index;
            if (part.index === 0) tell('start', part.passage.id, how);
            else tell('mark', part.passage.id, part.offset, part.passage.playedBefore);
        },
        mark(innerId, charIndex, tMs) {
            const part = partOf(innerId);
            if (!part) return tell('mark', innerId, charIndex, tMs);
            tell('mark', part.passage.id, part.offset + charIndex, part.passage.playedBefore + tMs);
        },
        end(innerId, durationMs) {
            const part = partOf(innerId);
            if (!part) return tell('end', innerId, durationMs);
            const { passage } = part;
            passage.playedBefore += durationMs;
            const last = part.index === passage.parts.length - 1;
            const then = last ? () => finish(passage) : () => {};
            if (part.pauseMs > 0) startPause(passage, part.pauseMs, then);
            else then();
        }
    };
    for (const name of ['fail', 'taken', 'restarted', 'retried', 'rateApplied']) {
        callbacks[name] = (innerId, ...rest) => tell(name, partOf(innerId)?.passage.id ?? innerId, ...rest);
    }

    const wrapped = {
        get id() { return voice.id; },
        get capabilities() { return voice.capabilities; },
        get chosen() { return voice.chosen; },
        get usage() { return voice.usage; },

        attach(next) {
            report = { ...next };
            voice.attach(callbacks);
        },

        enqueue({ id, text, pauses = [] }) {
            const cuts = pauses
                .filter(cut => Number.isFinite(cut?.at) && Number.isFinite(cut?.ms) && cut.ms > 0 && cut.at > 0 && cut.at <= text.length)
                .sort((a, b) => a.at - b.at);
            const pieces = [];
            let from = 0;
            let trailing = 0;
            for (const { at, ms } of cuts) {
                if (at === text.length) trailing = ms;
                else if (at > from && text.slice(from, at).trim() && text.slice(at).trim()) {
                    pieces.push({ offset: from, text: text.slice(from, at), pauseMs: ms });
                    from = at;
                }
            }
            pieces.push({ offset: from, text: text.slice(from), pauseMs: trailing });
            const passage = { id, index: 0, playedBefore: 0, done: false, parts: [] };
            passage.parts = pieces.map((piece, index) => ({ ...piece, index, passage, innerId: index === 0 ? id : `${id}⁣${index}` }));
            passages.set(id, passage);
            for (const part of passage.parts) {
                parts.set(part.innerId, part);
                voice.enqueue({ id: part.innerId, text: part.text });
            }
        },

        /** The reader's hold: a pause under way stands still; a resume place is taken inside the part it falls in. */
        hold({ resumeAt } = {}) {
            if (held) return false;
            held = true;
            if (pause) { stopPause(); return false; }
            const passage = resumeAt ? passages.get(resumeAt.segmentId) : null;
            const part = passage?.parts[passage.index];
            const within = part && resumeAt.charIndex >= part.offset && resumeAt.charIndex < part.offset + part.text.length;
            if (!within) return voice.hold(resumeAt && !passage ? { resumeAt } : undefined);
            return voice.hold({ resumeAt: { segmentId: part.innerId, charIndex: resumeAt.charIndex - part.offset, tMs: Math.max(0, resumeAt.tMs - passage.playedBefore) } });
        },

        release() {
            if (!held) return;
            held = false;
            if (pause) runPause();
            else voice.release();
        },

        /** What has been said of a passage, its pauses counted, or undefined if it has not begun. */
        playedMs(id) {
            const passage = passages.get(id);
            if (!passage || passage.parts.length === 1 && passage.parts[0].pauseMs === 0) return voice.playedMs(id);
            if (passage.done) return passage.playedBefore;
            if (pause?.passage === passage) return Math.round(passage.playedBefore + pause.length - pause.left + (pause.since === null ? 0 : clock.now() - pause.since));
            const under = voice.playedMs(passage.parts[passage.index].innerId);
            if (under === undefined) return passage.index === 0 ? undefined : passage.playedBefore;
            return passage.playedBefore + under;
        },

        /** The voice forgets first, so letting go of a pause's hold begins nothing it was about to say. */
        seek(segmentId) {
            let after = false;
            for (const [id, passage] of passages) {
                after ||= id === segmentId;
                if (!after) continue;
                passages.delete(id);
                for (const part of passage.parts) parts.delete(part.innerId);
            }
            voice.seek(segmentId);
            dropPause();
        },

        setRate(next) {
            if (pause && next > 0 && next !== rate) {
                const running = pause.cancel !== null;
                stopPause();
                const scale = rate / next;
                pause.left *= scale;
                pause.length *= scale;
                if (running) runPause();
            }
            rate = next;
            return voice.setRate(next);
        },

        cancel() {
            voice.cancel();
            dropPause();
        },

        close() {
            pause?.cancel?.();
            pause = null;
            voice.close();
        }
    };

    // Whatever else the voice offers (its own choice of voice, a retry, the passage it is saying) is the voice's,
    // with its parts named as the passage they belong to.
    for (const name of Object.keys(voice)) {
        if (name in wrapped || typeof voice[name] !== 'function') continue;
        wrapped[name] = (...args) => voice[name](...args);
    }
    if (typeof voice.speakingId === 'function') {
        wrapped.speakingId = () => (pause ? pause.passage.id : (partOf(voice.speakingId())?.passage.id ?? voice.speakingId()));
    }
    if (typeof voice.retry === 'function') {
        wrapped.retry = id => voice.retry(passages.get(id)?.parts[passages.get(id).index]?.innerId ?? id);
    }
    return wrapped;
}
