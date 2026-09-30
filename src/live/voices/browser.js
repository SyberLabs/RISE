/**
 * The browser's own voice (`speechSynthesis`) as a voice renderer.
 *
 * It says queued utterances one at a time and reports where it has got to.
 * Word boundaries become marks where the voice reports them; some voices
 * (network voices in Chrome, for one) never do, and then the reading is
 * corrected only at each segment's start and end, which is what the speech
 * clock is built to tolerate.
 *
 * Holding is the hard part, and it has two kinds:
 *  - a hold (the reader paused): `pause()`, which keeps the utterance where it
 *    was, and `resume()` carries on from the same sample;
 *  - an exclusive hold (a Dive is about to speak): the device can only speak
 *    one thing at a time, so the held utterance is cancelled and remembered at
 *    the last word boundary heard, and on release it is spoken again from that
 *    word. A voice with no boundaries restarts its segment, which is the one
 *    place this can say something twice, and it is a limit of the platform.
 *    The hold can be told where to take up instead (`resumeAt`: the segment, a
 *    character, and the time at that character), which is what the reading on
 *    screen knows and the voice does not: it lets the voice begin again exactly
 *    where the phrase the reader is looking at begins, whether or not it ever
 *    reported a boundary.
 *
 * Time is `playedMs`: speaking time only, so a hold takes none of it.
 */

import { createRealClock } from '../clock.js';

export function createBrowserVoice({ speech, clock = createRealClock(), lang = 'en', rate = 1, voice = null } = {}) {
    const { synth, Utterance } = speech ?? {};
    if (!synth || typeof Utterance !== 'function') throw new TypeError('A browser voice needs speechSynthesis and its utterance');

    let report = { start() {}, mark() {}, end() {}, fail() {} };
    let closed = false;
    let held = false;
    let exclusive = false;
    const queue = [];
    const seen = new Set();
    const finished = new Map();
    let current = null;

    const safely = (fn, ...args) => {
        try { fn?.(...args); } catch { /* a failing listener must not stop the voice */ }
    };

    const playedNow = item => item.played + (item.startedAt === null ? 0 : clock.now() - item.startedAt);

    /** A place to take up again, if it is one in the segment being held; otherwise nothing. */
    const placeIn = (item, place) => {
        if (!place || typeof place !== 'object' || place.segmentId !== item.id) return null;
        const { charIndex, tMs } = place;
        if (!Number.isInteger(charIndex) || charIndex < 0 || charIndex >= item.text.length) return null;
        if (typeof tMs !== 'number' || !Number.isFinite(tMs) || tMs < 0) return null;
        return { charIndex, tMs };
    };

    function speakFrom(item, offset) {
        const utterance = new Utterance(item.text.slice(offset));
        utterance.lang = lang;
        utterance.rate = rate;
        if (voice) utterance.voice = voice;
        item.utterance = utterance;
        item.offset = offset;
        item.startedAt = null;

        utterance.onstart = () => {
            if (item.utterance !== utterance) return;
            item.startedAt = clock.now();
            if (!item.started) {
                item.started = true;
                safely(report.start, item.id);
            }
        };
        utterance.onboundary = event => {
            if (item.utterance !== utterance || (event.name && event.name !== 'word')) return;
            const charIndex = offset + event.charIndex;
            if (charIndex <= item.lastMark || charIndex >= item.text.length) return;
            item.lastMark = charIndex;
            item.lastMarkAt = playedNow(item);
            safely(report.mark, item.id, charIndex, item.lastMarkAt);
        };
        utterance.onend = () => {
            if (item.utterance !== utterance) return;
            const duration = Math.max(item.lastMarkAt, Math.round(playedNow(item)));
            item.utterance = null;
            finished.set(item.id, duration);
            current = null;
            if (item.started) safely(report.end, item.id, duration);
            next();
        };
        utterance.onerror = event => {
            if (item.utterance !== utterance) return;
            if (event?.error === 'canceled' || event?.error === 'interrupted') return;
            item.utterance = null;
            current = null;
            safely(report.fail, item.id, event?.error ?? 'error');
            next();
        };
        synth.speak(utterance);
    }

    function next() {
        if (closed || current || exclusive) return;
        const item = queue.shift();
        if (!item) return;
        current = item;
        speakFrom(item, 0);
    }

    return {
        id: 'browser',
        capabilities: Object.freeze({ audible: true }),

        attach(callbacks) {
            report = { start() {}, mark() {}, end() {}, fail() {}, ...callbacks };
        },

        enqueue({ id, text }) {
            if (closed) throw new RangeError('The voice is closed');
            if (typeof id !== 'string' || !id) throw new RangeError('An utterance has a name');
            if (typeof text !== 'string' || !text.trim()) throw new RangeError('An utterance has something to say');
            if (seen.has(id)) throw new RangeError(`Utterance ${id} is already queued`);
            seen.add(id);
            queue.push({
                id, text, offset: 0, played: 0, startedAt: null, started: false, lastMark: 0, lastMarkAt: 0, utterance: null
            });
            next();
        },

        /**
         * @param {{exclusive?: boolean, resumeAt?: {segmentId: string, charIndex: number, tMs: number}}} [how]
         *   exclusive: something else is about to speak. resumeAt: where to take up again, which an exclusive
         *   hold uses in place of the last word heard.
         * @returns {boolean} whether it will take up at the place it was told, so that whatever shows the words
         *   can begin that phrase again too
         */
        hold({ exclusive: wantsExclusive = false, resumeAt } = {}) {
            if (closed) return false;
            let tookPlace = false;
            if (!held) {
                held = true;
                if (current?.started) {
                    current.played = playedNow(current);
                    current.startedAt = null;
                }
                synth.pause();
            }
            if (wantsExclusive && !exclusive) {
                exclusive = true;
                if (current) {
                    // Spoken again from the last word heard; time is what it was there.
                    current.utterance = null;
                    const place = placeIn(current, resumeAt);
                    if (place) {
                        current.lastMark = place.charIndex;
                        current.lastMarkAt = place.tMs;
                        tookPlace = true;
                    }
                    current.played = current.lastMarkAt;
                    current.startedAt = null;
                }
                synth.cancel();
                synth.resume();
            }
            return tookPlace;
        },

        release() {
            if (!held || closed) return;
            held = false;
            if (exclusive) {
                exclusive = false;
                if (current) speakFrom(current, current.lastMark);
                else next();
                return;
            }
            if (current?.started) current.startedAt = clock.now();
            synth.resume();
        },

        /** What has been spoken of an utterance, or undefined if it has not begun. */
        playedMs(id) {
            if (finished.has(id)) return finished.get(id);
            if (current?.id === id && current.started) return Math.round(playedNow(current));
            return undefined;
        },

        cancel() {
            const speaking = current?.utterance;
            queue.length = 0;
            if (current) current.utterance = null;
            current = null;
            if (speaking || held) {
                synth.cancel();
                synth.resume();
            }
        },

        close() {
            if (closed) return;
            this.cancel();
            closed = true;
        }
    };
}

/**
 * Voices load late in some browsers: `getVoices()` is empty until
 * `voiceschanged`. Resolves with the voice list once there is one, or with an
 * empty list after `timeoutMs`, so a host never waits on a browser that has none.
 */
export function whenVoicesAvailable(synth, { timeoutMs = 800, clock = createRealClock() } = {}) {
    const now = synth.getVoices?.() ?? [];
    if (now.length > 0 || typeof synth.addEventListener !== 'function') return Promise.resolve(now);
    return new Promise(resolve => {
        let cancel = null;
        const done = () => {
            cancel?.();
            synth.removeEventListener?.('voiceschanged', done);
            resolve(synth.getVoices?.() ?? []);
        };
        synth.addEventListener('voiceschanged', done, { once: true });
        cancel = clock.setTimer(done, timeoutMs);
    });
}
