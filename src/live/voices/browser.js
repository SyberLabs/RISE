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
 * A voice stopped from outside (another page's `cancel()`, another speaker on
 * the device) is known by the `interrupted` or `canceled` error on an utterance
 * this voice still holds, since it lets go of one before it cancels one; that is
 * how Chromium reports it, as the specification says. An engine that reports a
 * cancelled utterance through `onend` instead cannot be told apart from one that
 * finished, here: such an end is taken as an end. The speech clock, which knows
 * how long the words should have taken, is where that case would be recognised.
 *
 * Chrome's Google voices are network voices that stop after about fourteen
 * seconds of one utterance without reporting an end, so a segment said in one
 * of them is said a sentence at a time (a long sentence is cut at a pause, or
 * else between words), and is still one utterance to whoever listens: one
 * start, one end, and a mark where each later sentence begins, which is the
 * only place such a voice says where it is. A voice on the device reports its
 * word boundaries (`capabilities.wordMarks`); a network voice may not.
 *
 * A change of rate never interrupts an utterance: cancelling one and speaking
 * it again silences or skips a network voice, sometimes for good. The rate is
 * kept for the next utterance (the next sentence of a voice that speaks in
 * sentences, `capabilities.inSentences`, else the next segment). The voice
 * reports `rateApplied` once nothing is said at the old rate any more: when
 * the segment it was saying ends, or when the next sentence, or a held
 * segment taken up again, begins at the new one. A rate set while nothing is
 * under way holds at once, and `setRate` says so.
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
    let inSentences = GOOGLE.test(voice?.name ?? '');
    /** A voice the reader chose, kept for the next utterance; undefined while there is none to take up. */
    let nextVoice;
    const takeVoice = () => {
        if (nextVoice === undefined) return;
        voice = nextVoice;
        nextVoice = undefined;
        inSentences = GOOGLE.test(voice?.name ?? '');
    };

    let report = { start() {}, mark() {}, end() {}, fail() {}, taken() {}, restarted() {}, rateApplied() {} };
    /** The rate it last reported speaking at: the one it was made with, or the last that landed. */
    let spokenRate = rate;
    let closed = false;
    let held = false;
    /** When it was last let go of, until it is heard again. */
    let releasedAt = null;
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
        // Kept here, not read back: the utterance holds its rate as a single-precision float (0.8 is not 0.8).
        const at = rate;
        utterance.lang = lang;
        utterance.rate = at;
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
            if (releasedAt !== null) {
                const afterMs = Math.round(clock.now() - releasedAt);
                releasedAt = null;
                safely(report.restarted, item.id, afterMs);
            }
            if (at !== spokenRate) {
                spokenRate = at;
                safely(report.rateApplied, item.id, spokenRate);
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
            if (rate !== spokenRate) {
                // Nothing is said at the old rate any more; the next utterance is begun at the new.
                spokenRate = rate;
                safely(report.rateApplied, item.id, rate);
            }
            next();
        };
        utterance.onerror = event => {
            if (item.utterance !== utterance) return;
            if (event?.error === 'canceled' || event?.error === 'interrupted') {
                // This voice lets go of an utterance before it cancels one, so this one was stopped from outside
                // (any page's cancel, or another speaker, is the whole device's). It is said again from the last
                // place heard once it is taken up; until then it is silent and takes no time.
                item.utterance = null;
                item.played = item.lastMarkAt;
                item.startedAt = null;
                safely(report.taken, item.id, event.error);
                return;
            }
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
        // A chosen voice begins with a passage: never part way through one, nor in a passage taken up again after a hold.
        takeVoice();
        speakFrom(item, 0);
    }

    return {
        id: 'browser',
        /** Of the voice it speaks with now, or will from its next utterance (setVoice). */
        get capabilities() {
            const now = nextVoice === undefined ? voice : nextVoice;
            return Object.freeze({ audible: true, wordMarks: now?.localService === true, inSentences: GOOGLE.test(now?.name ?? '') });
        },
        /** The installed voice it speaks with, or will from its next utterance, for the trace: null names the browser's own default. */
        get chosen() {
            const now = nextVoice === undefined ? voice : nextVoice;
            return Object.freeze({ name: now?.name ?? null, local: now ? now.localService === true : null });
        },

        attach(callbacks) {
            report = { start() {}, mark() {}, end() {}, fail() {}, taken() {}, restarted() {}, rateApplied() {}, ...callbacks };
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
            releasedAt = current || queue.length > 0 ? clock.now() : null;
            if (current) speakFrom(current, current.lastMark);
            else next();
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
         * A held voice takes it up at the new rate when released.
         * @returns {boolean} whether it holds at once, because nothing is under way; else `rateApplied` says when
         */
        setRate(next) {
            rate = next;
            if (current) return false;
            spokenRate = next;
            return true;
        },

        /**
         * Speak with `next` (an installed voice; null for the browser's default) from the next passage begun; the
         * passage under way finishes in the voice it began in, never cancelled (the same law as setRate).
         * @returns {boolean} whether it holds at once, because nothing is under way
         */
        setVoice(next) {
            nextVoice = next ?? null;
            if (current) return false;
            takeVoice();
            return true;
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
            releasedAt = null;
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

const tag = value => String(value ?? '').replace(/_/gu, '-').toLowerCase();

/** The installed voices of `lang`'s base language ("en" for "en-US"), its exact locale first: what a reader may pick from. */
export function voicesFor(voices, lang) {
    const wanted = tag(lang);
    const base = wanted.split('-')[0];
    const same = voices.filter(voice => tag(voice.lang).split('-')[0] === base);
    return [...same.filter(voice => tag(voice.lang) === wanted), ...same.filter(voice => tag(voice.lang) !== wanted)];
}

// Apple's novelty and Eloquence voices, which WebKit lists beside the real ones (and may mark default, as it marks every voice).
const APPLE_NOVELTY = /^(?:Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)(?: \(.*\))?$/u;

/**
 * How good a voice is likely to sound, from what its platform writes in its name or its `voiceURI`, case aside:
 *
 * | Rank | Signal                                                         | Where it comes from                                   |
 * |------|----------------------------------------------------------------|-------------------------------------------------------|
 * | 4    | "Natural", "Neural" ("Microsoft Ava Online (Natural) - …")     | Edge / Windows online voices; Chrome OS natural voices |
 * | 4    | "Premium" ("Ava (Premium)", com.apple.voice.premium.…)         | Apple (iOS 16+, macOS 13+) downloaded voices          |
 * | 4    | "Wavenet", "Journey", "Studio"                                 | Google Cloud voice families, where an engine names them |
 * | 3    | "Enhanced" ("Samantha (Enhanced)", com.apple.voice.enhanced.…) | Apple downloaded voices                               |
 * | 2    | a name beginning "Google" ("Google US English")                | Chrome's own network voices, desktop and Android      |
 * | 1    | any other voice ("Samantha", "Daniel")                         |                                                       |
 * | 0    | "compact" (com.apple.voice.compact.…)                          | WebKit on Apple platforms, the built-in small voices  |
 * | 0    | Apple's novelty and Eloquence voices (Albert, Fred, Eddy, …)   | WebKit on Apple platforms                             |
 * | 0    | "eSpeak"                                                       | Chromium on Linux (speech-dispatcher)                 |
 * | 0    | "Microsoft …" not Online/Natural (David, Zira, Mark)           | Windows' SAPI desktop voices in Chrome and Edge       |
 *
 * A multilingual voice ("AvaMultilingual") ranks just below the single-language voices of its rank: Edge's stop at an "&".
 */
export function voiceQuality(voice) {
    const said = `${voice?.name ?? ''} ${voice?.voiceURI ?? ''}`;
    const name = String(voice?.name ?? '');
    let rank = 1;
    if (/natural|neural|premium|wavenet|journey|studio/iu.test(said)) rank = 4;
    else if (/enhanced/iu.test(said)) rank = 3;
    else if (GOOGLE.test(name)) rank = 2;
    else if (/compact|espeak|speech\.synthesis\.voice|eloquence/iu.test(said) || /^Microsoft\b/iu.test(name) || APPLE_NOVELTY.test(name)) rank = 0;
    return /multilingual/iu.test(name) ? rank - 0.5 : rank;
}

/**
 * The voice to speak a page in `lang` with, from `getVoices()`, or null to leave the browser its own default, which
 * happens only when no voice speaks the page's language. The reader's own voice (`preferredName`) wins when it is
 * installed in the page's base language. Else, among the voices of the page's exact locale (or of its base language
 * when none has the locale; a tag is read with "_" as "-", in any case): the best by `voiceQuality`, then the one the
 * platform marks default, then the platform's order. Edge's natural voices are network voices that report no word
 * boundaries, which the speech clock tolerates. Chrome's Google voices stop after about fourteen seconds of one
 * utterance, which a voice made here never asks of them (it speaks them a sentence at a time).
 */
export function chooseVoice(voices, lang, preferredName = '') {
    const offered = voicesFor(voices, lang);
    if (preferredName) {
        const own = offered.find(voice => voice.name === preferredName);
        if (own) return own;
    }
    const wanted = tag(lang);
    const exact = offered.filter(voice => tag(voice.lang) === wanted);
    const ranked = (exact.length > 0 ? exact : offered).map((voice, index) => ({ voice, index, rank: voiceQuality(voice) }));
    ranked.sort((a, b) => b.rank - a.rank || Number(b.voice.default === true) - Number(a.voice.default === true) || a.index - b.index);
    return ranked[0]?.voice ?? null;
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
