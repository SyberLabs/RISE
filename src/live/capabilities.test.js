/**
 * Asking what the device can do, and telling the reader what that costs.
 *
 * Detection is a pure function of an environment it is handed, so every
 * combination below is a fake one. It must never throw on a browser that lacks
 * something, never ask for a permission, and never claim a capability it did
 * not see.
 */
import { describe, expect, it } from 'vitest';
import { describeDegradations, detectCapabilities } from './capabilities.js';

const canvasWith = ({ webgl2 = true } = {}) => ({
    createElement: () => ({ getContext: kind => (kind === 'webgl2' ? (webgl2 ? {} : null) : {}) }),
    fullscreenEnabled: true
});

const full = () => ({
    window: {
        speechSynthesis: {},
        SpeechSynthesisUtterance: function Utterance() {},
        SpeechRecognition: function Recognition() {},
        AudioContext: function Context() {},
        matchMedia: () => ({ matches: false }),
        ontouchstart: null
    },
    navigator: { mediaDevices: { getUserMedia() {} }, maxTouchPoints: 5, gpu: {} },
    document: canvasWith()
});

describe('detecting', () => {
    it('sees everything a capable browser has', () => {
        const env = full();
        env.window.self = env.window;
        env.window.top = env.window;
        expect(detectCapabilities(env)).toEqual({
            speechOutput: 'synthesis',
            microphone: true,
            speechRecognition: true,
            webAudio: true,
            canvas: true,
            webgl2: true,
            webgpu: true,
            fullscreen: true,
            touch: true,
            reducedMotion: false,
            embedded: false
        });
    });

    it('sees nothing on an empty environment, and does not throw', () => {
        const caps = detectCapabilities({ window: {}, navigator: {}, document: undefined });
        expect(caps).toMatchObject({
            speechOutput: 'none', microphone: false, speechRecognition: false, webAudio: false,
            canvas: false, webgl2: false, webgpu: false, fullscreen: false, touch: false, reducedMotion: false
        });
    });

    it('tells a canvas without WebGL2 from no canvas at all', () => {
        const env = full();
        env.document = canvasWith({ webgl2: false });
        expect(detectCapabilities(env)).toMatchObject({ canvas: true, webgl2: false });
    });

    it('survives a canvas that throws', () => {
        const env = full();
        env.document = { createElement: () => { throw new Error('no'); } };
        expect(detectCapabilities(env)).toMatchObject({ canvas: false, webgl2: false });
    });

    it('reads reduced motion from the media query, and treats a broken query as off', () => {
        const env = full();
        env.window.matchMedia = query => ({ matches: query.includes('reduce') });
        expect(detectCapabilities(env).reducedMotion).toBe(true);
        env.window.matchMedia = () => { throw new Error('no'); };
        expect(detectCapabilities(env).reducedMotion).toBe(false);
    });

    it('takes speech output only when both the synthesiser and its utterance exist', () => {
        const env = full();
        delete env.window.SpeechSynthesisUtterance;
        expect(detectCapabilities(env).speechOutput).toBe('none');
    });

    it('sees that it is embedded, and treats an unreadable parent as embedded', () => {
        const env = full();
        env.window.self = {};
        env.window.top = {};
        expect(detectCapabilities(env).embedded).toBe(true);
        Object.defineProperty(env.window, 'top', { get() { throw new Error('cross-origin'); } });
        expect(detectCapabilities(env).embedded).toBe(true);
    });

    it('is frozen, so nothing downstream can grant itself a capability', () => {
        const caps = detectCapabilities(full());
        expect(Object.isFrozen(caps)).toBe(true);
    });
});

describe('what the reader is told', () => {
    const all = { speechOutput: 'synthesis', speechRecognition: true, canvas: true, webgl2: true, reducedMotion: false };

    it('says nothing when nothing is missing', () => {
        expect(describeDegradations(all)).toEqual([]);
    });

    it('says a missing voice means silence, and why', () => {
        const none = describeDegradations({ ...all, speechOutput: 'none' }, { voice: 'paced' });
        expect(none.map(n => n.capability)).toEqual(['speechOutput']);
        expect(none[0].effect).toMatch(/cannot speak/u);
        const noVoices = describeDegradations(all, { voice: 'paced', voices: 0 });
        expect(noVoices[0].effect).toMatch(/No voice is installed/u);
        const off = describeDegradations(all, { voice: 'paced', voices: 3 });
        expect(off[0].effect).toMatch(/Speech is off/u);
    });

    it('says what a missing canvas, WebGL2, reduced motion, or no way to speak costs', () => {
        const notes = describeDegradations({ ...all, canvas: false, reducedMotion: true, speechRecognition: false });
        expect(notes.map(n => n.capability)).toEqual(['canvas', 'reducedMotion', 'speechRecognition']);
        const simpler = describeDegradations({ ...all, webgl2: false });
        expect(simpler.map(n => n.capability)).toEqual(['webgl2']);
    });

    it('never promises a substitute it does not provide', () => {
        for (const note of describeDegradations({ speechOutput: 'none', canvas: false, reducedMotion: true, speechRecognition: false }, { voice: 'paced' })) {
            expect(note.effect).not.toMatch(/fallback|instead of the real/iu);
        }
    });
});
