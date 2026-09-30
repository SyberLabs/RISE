/**
 * The browser's speech recognition, as one press-to-talk utterance at a time.
 *
 * The utterance ends when the reader has been quiet for a moment, not when the
 * browser first decides they have: a recogniser left to itself takes the pause
 * after "Wait…" for the end of the sentence and cuts the reader off. So it is
 * run continuously, everything heard is joined in order, and a silence timer
 * (`silenceMs`, started afresh by every word) says when they are done. Pressing
 * again, the browser ending by itself, and a longest time also end it.
 *
 * Nothing here opens a microphone by itself. A listener listens only between a
 * `start()` the reader asked for and the end of one utterance (or a limit, or
 * `stop()`), and lets go of it on every path: an error, a silence, a timeout,
 * being destroyed. What it says about itself is one of a closed list of states,
 * each with a plain sentence for the reader (`describeMic`), because a
 * microphone that will not work is the commonest thing to go wrong and must
 * never be silent about it.
 *
 * PRIVACY. Speech recognition in some browsers (Chrome's, for one) sends the
 * audio to the browser maker's service to be turned into words. RISE never
 * receives audio, only the words the browser hands back; but the reader is told
 * this before they press, in the words `MIC_PRIVACY` (shown by the host).
 *
 * NOT VERIFIED WITH A REAL RECOGNISER in any browser here; the tests use a
 * fake with the events the Web Speech API documents.
 */

import { createRealClock } from '../clock.js';

/** The one line shown beside the button, before anyone presses; `MIC_PRIVACY` is the rest. */
export const MIC_PRIVACY_LEAD = 'Speaking may send your voice to your browser maker';

export const MIC_PRIVACY = 'Listening uses your browser’s speech recognition. In some browsers, such as Chrome, your voice is sent to the browser maker’s service to be turned into words. RISE never receives audio, only the words. It listens only while you have it on, and stops when you go quiet or press it again.';

/** Every state, and what to tell the reader about it. `idle` says nothing. */
const SENTENCES = Object.freeze({
    idle: '',
    starting: 'Getting the microphone…',
    listening: 'Listening… a pause is fine. Go quiet when you are done, or press the microphone again.',
    unavailable: 'Speaking to it is not available in this browser. Type instead.',
    denied: 'The microphone is blocked. Allow it for this site in the browser’s settings, or type instead.',
    'no-microphone': 'No microphone was found. Type instead.',
    'no-speech': 'Nothing was heard. Press the microphone and try again, or type.',
    network: 'The browser’s speech service could not be reached. Type instead.',
    error: 'Listening failed. Type instead.'
});

export const MIC_STATES = Object.freeze(Object.keys(SENTENCES));

export function describeMic(state) {
    return SENTENCES[state] ?? SENTENCES.error;
}

/** How long, in milliseconds: quiet that ends an utterance; nobody having spoken; the longest press; the wait for a browser asked to stop. */
export const LISTEN_LIMITS = Object.freeze({ silenceMs: 1_800, noSpeechMs: 8_000, maxMs: 30_000, stopMs: 2_000 });

const ERRORS = Object.freeze({
    'not-allowed': 'denied',
    'service-not-allowed': 'denied',
    'audio-capture': 'no-microphone',
    'no-speech': 'no-speech',
    network: 'network',
    aborted: 'idle',
    'language-not-supported': 'error',
    'bad-grammar': 'error'
});

/**
 * @param {object} options
 * @param {new () => object} [options.Recognition] SpeechRecognition (or its prefixed form); absent means unavailable
 * @param {string} [options.lang]
 * @param {number} [options.silenceMs] quiet after the last word that ends the utterance
 * @param {number} [options.noSpeechMs] how long to wait for a first word
 * @param {number} [options.maxMs] the most one press may listen for
 * @param {number} [options.stopMs] how long a browser asked to stop has to say what it heard
 * @param {(text: string) => void} [options.onInterim] everything heard so far, whenever it changes
 * @param {(text: string) => void} [options.onFinal] the utterance, once
 * @param {(state: string) => void} [options.onState]
 */
export function createSpeechListener({
    Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition,
    lang = 'en-US',
    silenceMs = LISTEN_LIMITS.silenceMs,
    noSpeechMs = LISTEN_LIMITS.noSpeechMs,
    maxMs = LISTEN_LIMITS.maxMs,
    stopMs = LISTEN_LIMITS.stopMs,
    clock = createRealClock(),
    onInterim = () => {},
    onFinal = () => {},
    onState = () => {}
} = {}) {
    let state = Recognition ? 'idle' : 'unavailable';
    let recognition = null;
    let timers = [];
    let silence = null;
    let heard = '';
    let destroyed = false;

    const set = next => {
        if (state === next) return;
        state = next;
        try { onState(next); } catch { /* a listener may not break the microphone */ }
    };

    const clear = timer => {
        timer?.();
        timers = timers.filter(item => item !== timer);
    };

    const release = () => {
        for (const timer of timers) timer();
        timers = [];
        silence = null;
        const done = recognition;
        recognition = null;
        if (!done) return;
        done.onstart = done.onresult = done.onerror = done.onend = null;
        try { done.abort?.(); } catch { /* already over */ }
    };

    function finish(next) {
        const was = recognition;
        release();
        if (was) set(next);
    }

    /** The utterance is over: let the microphone go before anything acts on it, then deliver what was heard, or say nothing was. */
    function conclude() {
        const text = heard;
        const was = recognition;
        release();
        if (!was) return;
        if (!text) { set('no-speech'); return; }
        set('idle');
        onFinal(text);
    }

    /** Ask the browser to finish, and take what it had if it does not. */
    function askToStop(mine) {
        try { mine.stop(); } catch { conclude(); return; }
        timers.push(clock.setTimer(() => { if (recognition === mine) conclude(); }, stopMs));
    }

    return {
        get state() { return state; },
        get listening() { return recognition !== null; },

        /** Begin one utterance. Returns whether it began. */
        start() {
            if (destroyed) return false;
            if (!Recognition) { set('unavailable'); return false; }
            if (recognition) return true;
            let created;
            try {
                created = new Recognition();
                created.lang = lang;
                created.continuous = true;
                created.interimResults = true;
                created.maxAlternatives = 1;
            } catch {
                set('error');
                return false;
            }
            recognition = created;
            const mine = created;
            heard = '';
            set('starting');

            created.onstart = () => { if (recognition === mine) set('listening'); };
            created.onresult = event => {
                if (recognition !== mine) return;
                // The results are cumulative: every one so far, each final or still being revised.
                const parts = [];
                for (const result of Array.from(event.results ?? [])) {
                    const words = String(result?.[0]?.transcript ?? '').trim();
                    if (words) parts.push(words);
                }
                const text = parts.join(' ');
                if (!text) return;
                clear(silence);
                silence = clock.setTimer(() => { if (recognition === mine) conclude(); }, silenceMs);
                timers.push(silence);
                if (text === heard) return;
                heard = text;
                try { onInterim(text); } catch { /* as above */ }
            };
            created.onerror = event => {
                if (recognition !== mine) return;
                finish(ERRORS[event?.error] ?? 'error');
            };
            created.onend = () => {
                if (recognition !== mine) return;
                // The browser ended it: take what was heard, or say nobody spoke.
                conclude();
            };
            timers.push(clock.setTimer(() => { if (recognition === mine && !heard) finish('no-speech'); }, noSpeechMs));
            timers.push(clock.setTimer(() => { if (recognition === mine) askToStop(mine); }, maxMs));
            try {
                created.start();
            } catch {
                finish('error');
                return false;
            }
            return true;
        },

        /** Stop listening and take what was said so far as the utterance, if the browser can. */
        stop() {
            const mine = recognition;
            if (!mine) return;
            clear(silence);
            silence = null;
            askToStop(mine);
        },

        /** Stop at once and take nothing. */
        cancel() {
            if (recognition) finish('idle');
        },

        destroy() {
            destroyed = true;
            release();
            state = 'idle';
        }
    };
}
