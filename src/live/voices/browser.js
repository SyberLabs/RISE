/**
 * The browser's own voice (`speechSynthesis`) as a voice renderer.
 *
 * It says queued utterances one at a time and reports where it has got to.
 * Word boundaries become marks where the voice reports them; some voices
 * (network voices in Chrome, for one) never do, and then the reading is
 * corrected only at each segment's start and end, which is what the speech
 * clock is built to tolerate.
 *
 * Holding is the hard part. A hold never calls `pause()`: the engine behind
 * `speechSynthesis` is the whole browser's, and in Chromium its paused flag is
 * one for every page (TtsControllerImpl). It is cleared only by `resume()` from
 * a page that still has something to say, or by `cancel()`, so a page taken
 * away while paused (a closed tab, an assistant's card unmounted, which goes
 * hidden on its way out and is paused by the Player) leaves every later page
 * silent. So a held utterance is cancelled and remembered at the last word
 * boundary heard, and on release it is spoken again from that word. A voice
 * with no boundaries restarts its segment, which is the one place this can say
 * something twice, and it is a limit of the platform. The hold can be told
 * where to take up instead (`resumeAt`: the segment, a character, and the time
 * at that character), which is what the reading on screen knows and the voice
 * does not: it lets the voice begin again exactly where the phrase the reader
 * is looking at begins, whether or not it ever reported a boundary. For the
 * same reason a voice clears the engine with `cancel()` when it is made: some
 * other page may have left it paused.
 *
 * Time is `playedMs`: speaking time only, so a hold takes none of it.
 *
 * Chrome's Google voices are network voices that stop after about fourteen
 * seconds of one utterance without reporting an end, so a segment said in one
 * of them is said a sentence at a time (a long sentence is cut at a pause, or
 * else between words), and is still one utterance to whoever listens: one
 * start, one end, and a mark where each later sentence begins, which is the
 * only place such a voice says where it is. A voice on the device reports its
 * word boundaries (`capabilities.wordMarks`); a network voice may not.
 */

import { createRealClock } from '../clock.js';

export const BROWSER_VOICE_LIMITS = Object.freeze({ utteranceChars: 180 });

const GOOGLE = /^Google\b/u;

/**
 * Where an utterance begun at `from` ends: just after the sentence's closing mark
 * and the space after it; for a sentence longer than `limit`, just after the last
 * pause (a comma, semicolon or colon) within it, else the last space, else at the
 * limit itself.
 */
export function utteranceEnd(text, from, limit = BROWSER_VOICE_LIMITS.utteranceChars) {
    const sentence = /[.!?…]["'”’)\]]*\s+/gu;
    sentence.lastIndex = from;
    const found = sentence.exec(text);
    const end = found ? found.index + found[0].length : text.length;
    if (end - from <= limit) return end;
    const window = text.slice(from, from + limit);
    const lastEnd = pattern => {
        let at = -1;
        for (const match of window.matchAll(pattern)) at = match.index + match[0].length;
        return at;
    };
    const pause = lastEnd(/[,;:]\s+/gu);
    if (pause > 0) return from + pause;
    const space = lastEnd(/\s+/gu);
    return from + (space > 0 ? space : limit);
}

export function createBrowserVoice({ speech, clock = createRealClock(), lang = 'en', rate = 1, voice = null } = {}) {
    const { synth, Utterance } = speech ?? {};
    if (!synth || typeof Utterance !== 'function') throw new TypeError('A browser voice needs speechSynthesis and its utterance');
    synth.cancel();
    const inSentences = GOOGLE.test(voice?.name ?? '');

    let report = { start() {}, mark() {}, end() {}, fail() {} };
    let closed = false;
    let held = false;
    const queue = [];
    const seen = new Set();
    const finished = new Map();
    let current = null;

    const safely = (fn, ...args) => {
        try { fn?.(...args); } catch { /* a failing listener must not stop the voice */ }
    };

    const playedNow = item => item.played + (item.startedAt === null ? 0 : clock.now() - item.startedAt);

    function speakFrom(item, offset) {
        const end = inSentences ? utteranceEnd(item.text, offset) : item.text.length;
        const utterance = new Utterance(item.text.slice(offset, end));
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
            if (end < item.text.length) {
                // A sentence of the segment is said; the next one is taken up where it begins.
                item.played = playedNow(item);
                item.startedAt = null;
                if (end > item.lastMark) {
                    item.lastMark = end;
                    item.lastMarkAt = Math.round(item.played);
                    safely(report.mark, item.id, end, item.lastMarkAt);
                }
                speakFrom(item, end);
                return;
            }
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
        if (closed || current || held) return;
        const item = queue.shift();
        if (!item) return;
        current = item;
        speakFrom(item, 0);
    }

    return {
        id: 'browser',
        capabilities: Object.freeze({ audible: true, wordMarks: voice?.localService === true }),

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
         * Silence it and remember where it was; a later hold may still say where to take up.
         * @param {{resumeAt?: {segmentId: string, charIndex: number, tMs: number}}} [how]
         *   resumeAt: where to take up again, in place of the last word heard.
         * @returns {boolean} whether it will take up at the place it was told, so that whatever shows the words
         *   can begin that phrase again too
         */
        hold({ resumeAt } = {}) {
            if (closed) return false;
            if (!held) {
                held = true;
                if (current) {
                    // Spoken again from the last word heard; time is what it was there.
                    const speaking = current.utterance;
                    current.utterance = null;
                    current.played = current.lastMarkAt;
                    current.startedAt = null;
                    if (speaking) synth.cancel();
                }
            }
            // Only a place in the segment being held is one to take up at.
            if (!current || resumeAt?.segmentId !== current.id) return false;
            current.lastMark = resumeAt.charIndex;
            current.lastMarkAt = resumeAt.tMs;
            current.played = resumeAt.tMs;
            return true;
        },

        release() {
            if (!held || closed) return;
            held = false;
            if (current) speakFrom(current, current.lastMark);
            else next();
        },

        /** The utterance it has begun and not yet ended, or null. */
        speakingId() {
            return current?.started ? current.id : null;
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
            if (speaking) synth.cancel();
        },

        close() {
            if (closed) return;
            this.cancel();
            closed = true;
        }
    };
}

/**
 * The voice to speak a page in `lang` with, from `getVoices()`, or null to leave
 * the browser its own default. Only the page's language counts: its exact locale
 * when any voice has it, else its base language. Among those, a natural voice
 * ("(Natural)" in the name, as Edge and Chrome OS name them), single-language
 * before multilingual, because Edge's multilingual voices stop at an "&"; else
 * Chrome's own Google voice; else the one voice marked default, and none when
 * several claim it, as every voice does in Safari. Edge's natural voices are
 * network voices that report no word boundaries, which the speech clock
 * tolerates. Chrome's Google voices stop after about fourteen seconds of one
 * utterance, which a voice made here never asks of them (it speaks them a
 * sentence at a time).
 */
export function chooseVoice(voices, lang) {
    const tag = value => String(value ?? '').replace(/_/gu, '-').toLowerCase();
    const wanted = tag(lang);
    const base = wanted.split('-')[0];
    const exact = voices.filter(voice => tag(voice.lang) === wanted);
    const same = exact.length > 0 ? exact : voices.filter(voice => tag(voice.lang).split('-')[0] === base);
    const natural = same.filter(voice => /\(Natural\)/u.test(voice.name));
    if (natural.length > 0) return natural.find(voice => !/Multilingual/u.test(voice.name)) ?? natural[0];
    const google = same.find(voice => GOOGLE.test(voice.name));
    if (google) return google;
    const defaults = same.filter(voice => voice.default === true);
    return defaults.length === 1 ? defaults[0] : null;
}

/**
 * Voices load late in some browsers: `getVoices()` is empty until
 * `voiceschanged`. Resolves with the voice list once there is one, or with an
 * empty list after `timeoutMs`, so a host never waits on a browser that has none.
 * A fresh frame in a host's sandbox takes well over a second to list its first
 * voice; the wait allows for that, and is paid in full only where there are none.
 */
export function whenVoicesAvailable(synth, { timeoutMs = 2500, clock = createRealClock() } = {}) {
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
