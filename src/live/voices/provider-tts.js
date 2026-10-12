/**
 * A provider's voice as a voice renderer: a sibling of the browser's (voices/browser.js) under the same
 * clock (docs/superpowers/specs/2026-10-09-rise-live-design.md §2, §8 stage 7).
 *
 * Each passage is fetched from the provider as samples with word timestamps (voices/elevenlabs.js) and
 * played through Web Audio. That gives this voice what the browser's network voices lack: a mark at the
 * start of every word, an exact hold (the sound stops where it is and takes up from the same sample), and
 * a replay that costs nothing (what was fetched is kept for the reading). The next passage is fetched
 * while this one plays, so the first word of each follows the last of the one before.
 *
 * It is RISE's clock, not the provider's: the provider only renders what RISE will say, when RISE says
 * it; Pause, seek, replay and pace are all RISE's (§2.2). A change of rate never interrupts a passage:
 * the next one is fetched at the new speed where the provider takes it (ElevenLabs: 0.7 to 1.2), and
 * the rest is made up by the playback rate, so 1.5× is 1.2 from the provider and 1.25 in playback.
 *
 * Time is `playedMs`: time spent speaking, so a hold takes none of it. A mark's time is the audio time
 * divided by the playback factor, which is when it is heard.
 *
 * A passage the provider refuses (no credit, a refused key, no network) fails as a browser passage fails:
 * the speech clock stands down and the reading goes on paced (speech-governor.js); the reason is the
 * provider's, in the reader's words (`fail(id, message)`).
 *
 * The contract, as voices/synthetic.js states it:
 *   { attach({start, mark, end, fail, rateApplied, …}), enqueue({id, text}), hold({resumeAt}), release(),
 *     seek(id), setRate(rate), setVoice(), retry(id), speakingId(), playedMs(id), cancel(), close() }
 */

import { createRealClock } from '../clock.js';

export const PROVIDER_VOICE_LIMITS = Object.freeze({
    /** Passages fetched ahead of the one playing. */
    prefetch: 1
});

export function createProviderVoice({ speech, context, clock = createRealClock(), rate = 1 } = {}) {
    if (!speech || typeof speech.speak !== 'function') throw new TypeError('A provider voice needs a provider that speaks');
    if (!context || typeof context.createBufferSource !== 'function') throw new TypeError('A provider voice needs an AudioContext');

    let report = { start() {}, mark() {}, end() {}, fail() {}, taken() {}, restarted() {}, rateApplied() {}, retried() {} };
    let spokenRate = rate;
    let closed = false;
    let held = false;
    const queue = [];
    const seen = new Set();
    const finished = new Map();
    /** id -> { text, promise }: what was fetched for a passage, kept for the reading so a replay costs nothing. */
    const fetched = new Map();
    let current = null;

    const safely = (fn, ...args) => {
        try { fn?.(...args); } catch { /* a failing listener must not stop the voice */ }
    };

    const playedNow = item => item.played + (item.startedAt === null ? 0 : clock.now() - item.startedAt);

    function fetchFor(item) {
        const kept = fetched.get(item.id);
        if (kept && kept.text === item.text) return kept.promise;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        // The request goes out now, inside this call, so the first word follows Play as closely as the provider allows.
        let asked;
        try { asked = Promise.resolve(speech.speak(item.text, { rate: item.rate, signal: controller?.signal })); } catch (error) { asked = Promise.reject(error); }
        const promise = asked.then(said => ({ said }), error => ({ error }));
        fetched.set(item.id, { text: item.text, promise, controller });
        return promise;
    }

    function prefetch() {
        for (const item of queue.slice(0, PROVIDER_VOICE_LIMITS.prefetch)) fetchFor(item);
    }

    function stopSource(item) {
        const source = item.source;
        if (!source) return;
        item.source = null;
        item.played = playedNow(item);
        item.startedAt = null;
        for (const cancel of item.timers) cancel();
        item.timers = [];
        try { source.stop(); } catch { /* already ended */ }
    }

    function play(item, fromMs) {
        const { said } = item;
        if (!item.buffer) {
            item.buffer = context.createBuffer(1, said.samples.length, said.sampleRate);
            item.buffer.copyToChannel(said.samples, 0);
        }
        // Audio made at `said.speed`, played `factor` times faster than written, is heard at `item.rate`.
        const factor = item.rate / said.speed;
        const source = context.createBufferSource();
        source.buffer = item.buffer;
        source.playbackRate.value = factor;
        source.connect(context.destination);
        item.source = source;
        item.factor = factor;
        item.played = fromMs;
        item.startedAt = clock.now();
        source.onended = () => {
            if (item.source !== source) return;
            item.source = null;
            const total = Math.round(said.durationMs / factor);
            finished.set(item.id, total);
            item.played = total;
            item.startedAt = null;
            for (const cancel of item.timers) cancel();
            item.timers = [];
            if (current === item) current = null;
            safely(report.end, item.id, total);
            if (rate !== spokenRate) { spokenRate = rate; safely(report.rateApplied, item.id, rate); }
            next();
        };
        source.start(0, (fromMs / 1000) * factor);
        if (!item.started) {
            item.started = true;
            safely(report.start, item.id);
        }
        if (item.rate !== spokenRate) { spokenRate = item.rate; safely(report.rateApplied, item.id, spokenRate); }
        for (const mark of said.marks) {
            const at = Math.round(mark.tMs / factor);
            if (at <= fromMs) continue;
            item.timers.push(clock.setTimer(() => safely(report.mark, item.id, mark.charIndex, at), at - fromMs));
        }
    }

    function begin(item) {
        current = item;
        prefetch();
        fetchFor(item).then(outcome => {
            if (closed || current !== item) return;
            if (outcome.error) {
                if (outcome.error?.name === 'AbortError') return;
                current = null;
                finished.set(item.id, 0);
                safely(report.fail, item.id, outcome.error.message ?? String(outcome.error));
                next();
                return;
            }
            item.said = outcome.said;
            if (!held) play(item, item.played);
        });
    }

    function next() {
        if (closed || held || current) return;
        const item = queue.shift();
        if (!item) return;
        // The rate the passage is said at is the voice's when it begins (a change lands at the next passage).
        item.rate = rate;
        begin(item);
    }

    return {
        id: speech.id ?? 'provider',
        get capabilities() {
            return Object.freeze({ audible: true, wordMarks: current?.said ? current.said.exact : true, inSentences: false });
        },
        get chosen() {
            return Object.freeze({ name: speech.name ?? 'provider voice', local: false });
        },
        /** What the provider has been sent, which is what it bills. */
        get usage() {
            return Object.freeze({ chars: speech.chars ?? 0 });
        },

        attach(callbacks) {
            report = { start() {}, mark() {}, end() {}, fail() {}, taken() {}, restarted() {}, rateApplied() {}, retried() {}, ...callbacks };
        },

        enqueue({ id, text }) {
            if (closed) throw new RangeError('The voice is closed');
            if (typeof id !== 'string' || !id) throw new RangeError('An utterance has a name');
            if (typeof text !== 'string' || !text.trim()) throw new RangeError('An utterance has something to say');
            if (seen.has(id)) throw new RangeError(`Utterance ${id} is already queued`);
            seen.add(id);
            queue.push({ id, text, rate, said: null, buffer: null, source: null, factor: 1, played: 0, startedAt: null, started: false, timers: [] });
            if (current) prefetch();
            else next();
        },

        /**
         * Stop where it is and remember the place; the sound takes up from the same sample on release.
         * @returns {boolean} whether it will take up at the place it was told
         */
        hold({ resumeAt } = {}) {
            if (closed) return false;
            held = true;
            if (current) stopSource(current);
            if (!current || resumeAt?.segmentId !== current.id) return false;
            current.played = resumeAt.tMs;
            return true;
        },

        release() {
            if (!held || closed) return;
            held = false;
            if (current) {
                if (current.said) play(current, current.played);
            } else {
                next();
            }
        },

        /** Forget `segmentId` and every passage after it, so each can be given again; what was fetched is kept. */
        seek(segmentId) {
            if (closed) return;
            this.cancel();
            let after = false;
            for (const id of seen) {
                after ||= id === segmentId;
                if (after) { seen.delete(id); finished.delete(id); }
            }
        },

        /** @returns {boolean} whether the rate holds at once, because nothing is under way */
        setRate(next) {
            rate = next;
            if (current) return false;
            spokenRate = next;
            return true;
        },

        /** A provider voice has one voice; nothing to take up. */
        setVoice() {
            return true;
        },

        /** A passage this voice could not begin was refused by the provider; there is nothing to try again with. */
        retry() {
            return null;
        },

        speakingId() {
            return current?.started ? current.id : null;
        },

        playedMs(id) {
            if (finished.has(id)) return finished.get(id);
            if (current?.id === id && current.started) return Math.round(playedNow(current));
            return undefined;
        },

        cancel() {
            if (current) stopSource(current);
            for (const item of [current, ...queue]) {
                if (!item) continue;
                const kept = fetched.get(item.id);
                if (kept && !item.said && !kept.settled) kept.controller?.abort();
            }
            queue.length = 0;
            current = null;
        },

        close() {
            if (closed) return;
            this.cancel();
            closed = true;
        }
    };
}
