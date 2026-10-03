/**
 * What this device and browser can do, asked once.
 *
 * A Current never assumes a capability. It reads this record, and where one is
 * missing it gives up the thing that needed it and says so: silence or
 * stillness, never a broken substitute presented as if it were the real thing.
 * The transcript, the Dive and the evidence stay reachable without audio or
 * visuals.
 *
 * Detection reads an environment it is handed (`window`, `navigator`) so the
 * same code runs in a browser and in a test with a fake one. It never asks for
 * a permission: whether a microphone is *allowed* is only learnt by trying,
 * which the host does when the reader asks to speak.
 */

const yes = value => value === true;

function probeCanvas(document) {
    try {
        const drawingCanvas = document?.createElement?.('canvas');
        const webglCanvas = document?.createElement?.('canvas');
        return {
            canvas: Boolean(drawingCanvas?.getContext?.('2d')),
            webgl2: Boolean(webglCanvas?.getContext?.('webgl2'))
        };
    } catch {
        return { canvas: false, webgl2: false };
    }
}

function media(win, query) {
    try {
        return yes(win?.matchMedia?.(query)?.matches);
    } catch {
        return false;
    }
}

/**
 * @param {{window?: object, navigator?: object, document?: object}} env
 */
export function detectCapabilities(env = globalThis) {
    const win = env.window ?? env;
    const nav = env.navigator ?? win.navigator ?? {};
    const doc = env.document ?? win.document;
    const { canvas, webgl2 } = probeCanvas(doc);
    const speech = Boolean(win.speechSynthesis && win.SpeechSynthesisUtterance);
    return Object.freeze({
        speechOutput: speech ? 'synthesis' : 'none',
        microphone: Boolean(nav.mediaDevices?.getUserMedia),
        speechRecognition: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition),
        webAudio: Boolean(win.AudioContext || win.webkitAudioContext),
        canvas,
        webgl2,
        webgpu: Boolean(nav.gpu),
        fullscreen: Boolean(doc?.fullscreenEnabled),
        touch: Boolean(nav.maxTouchPoints > 0 || 'ontouchstart' in win),
        reducedMotion: media(win, '(prefers-reduced-motion: reduce)'),
        embedded: (() => {
            try { return win.self !== win.top; } catch { return true; }
        })()
    });
}

/**
 * What the reader is told, in plain words, about what is missing and what that
 * costs. Empty when everything a Current wants is present.
 *
 * @param {ReturnType<typeof detectCapabilities>} caps
 * @param {{voice?: 'browser'|'paced'|'off', voices?: number|null, pacingShown?: boolean}} chosen what was actually
 *   selected; `voices` is how many the browser offered, when it was asked; `pacingShown` where the screen already
 *   says the reading is paced (the live controls' status line), so a note says only why it is silent
 */
export function describeDegradations(caps, { voice = 'browser', voices = 1, pacingShown = false } = {}) {
    const notes = [];
    const paced = pacingShown ? '' : ' The reading is paced as if it were spoken, in silence.';
    if (voice === 'paced' && caps.speechOutput === 'none') {
        notes.push({ capability: 'speechOutput', effect: `This browser cannot speak.${paced}` });
    } else if (voice === 'paced' && voices === 0) {
        notes.push({ capability: 'speechOutput', effect: `No voice is installed for this browser.${paced}` });
    } else if (voice === 'paced' && !pacingShown) {
        notes.push({ capability: 'speechOutput', effect: `Speech is off.${paced}` });
    }
    if (!caps.canvas) {
        notes.push({ capability: 'canvas', effect: 'Drawing is unavailable. The words are shown without imagery.' });
    } else if (!caps.webgl2) {
        notes.push({ capability: 'webgl2', effect: 'Hardware graphics are unavailable. Imagery is drawn more simply.' });
    }
    if (caps.reducedMotion) {
        notes.push({ capability: 'reducedMotion', effect: 'Reduced motion is on. Imagery stays still.' });
    }
    if (!caps.speechRecognition) {
        notes.push({ capability: 'speechRecognition', effect: 'Speaking to interrupt is unavailable here. Type instead.' });
    }
    return Object.freeze(notes);
}
