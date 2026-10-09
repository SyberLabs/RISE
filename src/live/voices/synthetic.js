/**
 * The deterministic voice.
 *
 * A voice renderer owns speech time. It says queued utterances in order and
 * reports where it has got to (start, marks at word boundaries, end) through
 * the callbacks it is attached to; the runtime writes those into the ordered
 * stream, so speech is one more thing that happens in one order.
 *
 * This one makes no sound. It speaks at a fixed number of milliseconds per
 * character on the clock it is given, which is what lets a test say exactly
 * when each word was "said". Its one job beyond that is to be HELD: a Dive
 * holds the voice, and everything after the hold has to be later by exactly the
 * hold. So the only time it keeps is PLAYED time, which stops while it is held.
 *
 * A voice, of any kind, is
 *   { attach({start, mark, end, rateApplied}), enqueue({id, text}), hold(), release(),
 *     seek(id), setRate(rate), cancel(), close(), playedMs(id) }
 *
 * A change of rate never interrupts an utterance (voices/browser.js says why):
 * the next utterance begun, or the one held when it is released, takes it.
 * `rateApplied(id, rate)` is reported once nothing is said at the old rate any
 * more: as the utterance under way ends, or as a held one goes on. One set
 * while nothing is under way holds at once, and `setRate` says so.
 */

import { createRealClock } from '../clock.js';

/** Where a person would breathe: the start of every word after the third. */
function markPoints(text) {
    return [...text.matchAll(/\S+/gu)]
        .map(match => match.index)
        .filter((_, index) => index > 0 && index % 3 === 0);
}

export function createSyntheticVoice({ clock = createRealClock(), msPerChar = 62, breathMs = 150 } = {}) {
    let report = { start() {}, mark() {}, end() {}, rateApplied() {} };
    let closed = false;
    let held = false;
    let rate = 1;
    /** The rate it last reported speaking at: the one it began with, or the last that landed. */
    let spokenRate = rate;
    const queue = [];
    const seen = new Set();
    const finished = new Map();
    /** `phase` is the utterance being said or the breath after it; `played` is time into that phase. */
    let phase = null;

    const safely = (fn, ...args) => {
        try { fn(...args); } catch { /* a failing listener must not stop the voice */ }
    };

    const played = () => (phase.since === null ? phase.played : phase.played + (clock.now() - phase.since));

    function schedule() {
        if (!phase || held || closed) return;
        const next = phase.events[phase.index];
        if (!next) return;
        phase.since = clock.now();
        phase.cancel = clock.setTimer(() => {
            phase.cancel = null;
            // Played time is what the clock says it is, not what this event was due at: a timer
            // that fires late must not make every later event late by the same amount again.
            phase.played = played();
            phase.since = clock.now();
            phase.index += 1;
            next.run();
            schedule();
        }, Math.max(0, next.at - phase.played));
    }

    /** Make `next` the current phase. Whoever is running the clock schedules it. */
    /** Each event reports the played time it falls due at, which a change of pace moves. */
    function begin(next) {
        if (!next) { phase = null; return; }
        const at = rate;
        const perChar = msPerChar / at;
        const events = [
            {
                at: 0,
                run: () => {
                    const own = phase;
                    safely(report.start, next.id);
                    if (own.rate !== spokenRate) { spokenRate = own.rate; safely(report.rateApplied, next.id, spokenRate); }
                }
            },
            ...markPoints(next.text).map(charIndex => ({
                at: charIndex * perChar,
                run() { safely(report.mark, next.id, charIndex, this.at); }
            })),
            {
                at: next.text.length * perChar,
                run() {
                    finished.set(next.id, this.at);
                    safely(report.end, next.id, this.at);
                    if (rate !== spokenRate) { spokenRate = rate; safely(report.rateApplied, next.id, rate); }
                    breathe();
                }
            }
        ];
        phase = { id: next.id, played: 0, since: null, cancel: null, index: 0, events, speaking: true, rate: at };
    }

    /** The silence between utterances is played time too, so a hold holds it. */
    function breathe() {
        const done = phase;
        phase = {
            id: done.id, played: 0, since: null, cancel: null, index: 0, speaking: false,
            events: [{ at: breathMs / rate, run: () => begin(queue.shift()) }]
        };
    }

    return {
        id: 'synthetic',
        capabilities: Object.freeze({ audible: false }),

        attach(callbacks) {
            report = { start() {}, mark() {}, end() {}, rateApplied() {}, ...callbacks };
        },

        enqueue({ id, text }) {
            if (closed) throw new RangeError('The voice is closed');
            if (typeof id !== 'string' || !id) throw new RangeError('An utterance has a name');
            if (typeof text !== 'string' || !text.trim()) throw new RangeError('An utterance has something to say');
            if (seen.has(id)) throw new RangeError(`Utterance ${id} is already queued`);
            seen.add(id);
            const utterance = { id, text };
            if (phase) {
                queue.push(utterance);
            } else {
                begin(utterance);
                schedule();
            }
        },

        hold() {
            if (held || closed) return;
            held = true;
            if (phase) {
                phase.played = played();
                phase.since = null;
                phase.cancel?.();
                phase.cancel = null;
            }
        },

        /** Take up again; an utterance under way when a new rate was set goes on at it from here. */
        release() {
            if (!held || closed) return;
            held = false;
            if (phase?.speaking && phase.rate !== rate) {
                const ratio = phase.rate / rate;
                phase.rate = rate;
                for (const event of phase.events.slice(phase.index)) event.at = phase.played + (event.at - phase.played) * ratio;
                // One not yet begun reports it as it begins.
                if (phase.index > 0 && rate !== spokenRate) { spokenRate = rate; safely(report.rateApplied, phase.id, rate); }
            }
            schedule();
        },

        /** What has been played of an utterance, or undefined if it has not begun. */
        playedMs(id) {
            if (finished.has(id)) return finished.get(id);
            if (phase && phase.speaking && phase.id === id) return played();
            return undefined;
        },

        /**
         * The reader moved the reading: stop, and forget `segmentId` and every utterance given after it, so each can
         * be given again and is said from its start. One never given forgets nothing. A held voice stays held.
         */
        seek(segmentId) {
            if (closed) return;
            this.cancel();
            let after = false;
            for (const id of seen) {
                after ||= id === segmentId;
                if (after) { seen.delete(id); finished.delete(id); }
            }
        },

        /**
         * Say at `next` times the normal rate from the next utterance begun; what it is saying finishes at its own.
         * @returns {boolean} whether it holds at once, because nothing is under way; else `rateApplied` says when
         */
        setRate(next) {
            rate = next;
            if (phase?.speaking) return false;
            spokenRate = next;
            return true;
        },

        /** Stop, forget what was queued, and take nothing more that was already said as still to come. */
        cancel() {
            phase?.cancel?.();
            phase = null;
            queue.length = 0;
        },

        close() {
            if (closed) return;
            this.cancel();
            closed = true;
        }
    };
}
