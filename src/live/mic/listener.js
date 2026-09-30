/**
 * The browser's speech recognition, as one press-to-talk utterance at a time.
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

export const MIC_PRIVACY = 'Listening uses your browser’s speech recognition. In some browsers, such as Chrome, your voice is sent to the browser maker’s service to be turned into words. RISE never receives audio, only the words. It listens only while you hold the button on, and stops after you speak.';

/** Every state, and what to tell the reader about it. `idle` says nothing. */
const SENTENCES = Object.freeze({
    idle: '',
    starting: 'Getting the microphone…',
    listening: 'Listening… say what you want, then stop.',
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
 * @param {number} [options.maxMs] the most one press may listen for
 * @param {(text: string) => void} [options.onInterim] words so far, not yet final
 * @param {(text: string) => void} [options.onFinal] the utterance, once
 * @param {(state: string) => void} [options.onState]
 */
export function createSpeechListener({
    Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition,
    lang = 'en-US',
    maxMs = 15_000,
    clock = createRealClock(),
    onInterim = () => {},
    onFinal = () => {},
    onState = () => {}
} = {}) {
    let state = Recognition ? 'idle' : 'unavailable';
    let recognition = null;
    let cancelTimer = null;
    let destroyed = false;

    const set = next => {
        if (state === next) return;
        state = next;
        try { onState(next); } catch { /* a listener may not break the microphone */ }
    };

    const release = () => {
        cancelTimer?.();
        cancelTimer = null;
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
                created.continuous = false;
                created.interimResults = true;
                created.maxAlternatives = 1;
            } catch {
                set('error');
                return false;
            }
            recognition = created;
            const mine = created;
            set('starting');

            created.onstart = () => { if (recognition === mine) set('listening'); };
            created.onresult = event => {
                if (recognition !== mine) return;
                let interim = '';
                let final = '';
                for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
                    const result = event.results[i];
                    const words = String(result?.[0]?.transcript ?? '');
                    if (result.isFinal) final += words; else interim += words;
                }
                if (final.trim()) {
                    // The utterance is over: let the microphone go before anything acts on it.
                    finish('idle');
                    onFinal(final.trim());
                } else if (interim.trim()) {
                    try { onInterim(interim.trim()); } catch { /* as above */ }
                }
            };
            created.onerror = event => {
                if (recognition !== mine) return;
                finish(ERRORS[event?.error] ?? 'error');
            };
            created.onend = () => {
                if (recognition !== mine) return;
                // A result or an error lets go first and silences this, so an end that arrives here is one with no words and no error: nobody spoke.
                finish('no-speech');
            };
            cancelTimer = clock.setTimer(() => {
                if (recognition === mine) { try { mine.stop(); } catch { finish('idle'); } }
            }, maxMs);
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
            try { mine.stop(); } catch { finish('idle'); }
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
