/**
 * Continuous speech recognition from the browser's own recognizer.
 *
 * Interim results stream while someone speaks; a finalized result is a
 * sentence. The recognizer ends on its own after silence or a network blip,
 * so a listening session restarts it — at most three times inside ten
 * seconds. A permission refusal or a missing microphone stops it for good.
 *
 * Where the audio goes is the browser's choice unless `processLocally` is
 * set. `onDeviceStatus` asks whether on-device recognition is available; a
 * room that requires it must not start when the answer is anything else.
 * Web Speech carries no speaker label. The caller labels each result.
 */

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);
const RESTART_LIMIT = 3;
const RESTART_WINDOW_MS = 10_000;

export function speechRecognitionClass(scope = globalThis) {
    return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

/** 'available', 'downloadable', 'downloading', 'unavailable', or 'unsupported'. */
export async function onDeviceStatus(Recognition, lang) {
    if (typeof Recognition?.available !== 'function') return 'unsupported';
    try {
        const status = await Recognition.available({ langs: [lang], processLocally: true });
        return typeof status === 'string' ? status : 'unsupported';
    } catch {
        return 'unsupported';
    }
}

export function createRecognizer({
    Recognition,
    lang = 'en-US',
    processLocally = false,
    onResult,
    onState,
    now = () => performance.now()
}) {
    let wanted = false;
    let instance = null;
    let state = 'idle';
    const restarts = [];

    function setState(next, detail = null) {
        state = next;
        onState?.(next, detail);
    }

    function build() {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = lang;
        if (processLocally) recognition.processLocally = true;
        recognition.onstart = () => setState('listening');
        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const transcript = result?.[0]?.transcript ?? '';
                if (result?.isFinal) {
                    const text = transcript.trim();
                    if (text) onResult?.({ transcript: text, isFinal: true, at: now() });
                } else {
                    interim += transcript;
                }
            }
            interim = interim.trim();
            if (interim) onResult?.({ transcript: interim, isFinal: false, at: now() });
        };
        recognition.onerror = (event) => {
            const code = typeof event?.error === 'string' ? event.error : 'unknown';
            if (FATAL.has(code)) {
                wanted = false;
                setState('error', code);
            } else {
                onState?.('warning', code);
            }
        };
        recognition.onend = () => {
            instance = null;
            if (!wanted) {
                if (state !== 'error') setState('stopped');
                return;
            }
            const at = now();
            while (restarts.length && at - restarts[0] > RESTART_WINDOW_MS) restarts.shift();
            if (restarts.length >= RESTART_LIMIT) {
                wanted = false;
                setState('error', 'restart-limit');
                return;
            }
            restarts.push(at);
            begin();
        };
        return recognition;
    }

    function begin() {
        instance = build();
        try {
            instance.start();
        } catch {
            instance = null;
            wanted = false;
            setState('error', 'start-failed');
        }
    }

    return {
        start() {
            if (wanted) return;
            if (typeof Recognition !== 'function') {
                setState('error', 'unsupported');
                return;
            }
            wanted = true;
            restarts.length = 0;
            setState('starting');
            begin();
        },
        stop() {
            wanted = false;
            if (instance) instance.stop();
            else if (state !== 'error') setState('stopped');
        },
        get state() {
            return state;
        }
    };
}
