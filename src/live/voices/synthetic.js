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
 *   { attach({start, mark, end}), enqueue({id, text}), hold(), release(),
 *     cancel(), close(), playedMs(id) }
 */

import { createRealClock } from '../clock.js';

/** Where a person would breathe: the start of every word after the third. */
function markPoints(text) {
    return [...text.matchAll(/\S+/gu)]
        .map(match => match.index)
        .filter((_, index) => index > 0 && index % 3 === 0);
}

export function createSyntheticVoice({ clock = createRealClock(), msPerChar = 62, breathMs = 150 } = {}) {
    let report = { start() {}, mark() {}, end() {} };
    let closed = false;
    let held = false;
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
            phase.played = next.at;
            phase.since = clock.now();
            phase.index += 1;
            next.run();
            schedule();
        }, Math.max(0, next.at - phase.played));
    }

    /** Make `next` the current phase. Whoever is running the clock schedules it. */
    function begin(next) {
        if (!next) { phase = null; return; }
        const duration = next.text.length * msPerChar;
        const events = [
            { at: 0, run: () => safely(report.start, next.id) },
            ...markPoints(next.text).map(charIndex => ({
                at: charIndex * msPerChar,
                run: () => safely(report.mark, next.id, charIndex, charIndex * msPerChar)
            })),
            {
                at: duration,
                run: () => {
                    finished.set(next.id, duration);
                    safely(report.end, next.id, duration);
                    breathe();
                }
            }
        ];
        phase = { id: next.id, played: 0, since: null, cancel: null, index: 0, events, speaking: true };
    }

    /** The silence between utterances is played time too, so a hold holds it. */
    function breathe() {
        const done = phase;
        phase = {
            id: done.id, played: 0, since: null, cancel: null, index: 0, speaking: false,
            events: [{ at: breathMs, run: () => begin(queue.shift()) }]
        };
    }

    return {
        id: 'synthetic',
        capabilities: Object.freeze({ audible: false }),

        attach(callbacks) {
            report = { start() {}, mark() {}, end() {}, ...callbacks };
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

        release() {
            if (!held || closed) return;
            held = false;
            schedule();
        },

        /** What has been played of an utterance, or undefined if it has not begun. */
        playedMs(id) {
            if (finished.has(id)) return finished.get(id);
            if (phase && phase.speaking && phase.id === id) return played();
            return undefined;
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
