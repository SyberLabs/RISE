import { describe, expect, it } from 'vitest';
import { unlockAudio } from './unlock.js';

/** An AudioContext under WebKit's rule (AudioContext.cpp, willBeginPlayback): it starts only on a resume() made in a gesture. */
function gestureContext() {
    let inGesture = false;
    const context = {
        state: 'suspended',
        resume() { if (inGesture) context.state = 'running'; return Promise.resolve(); }
    };
    const engine = {
        context,
        async resume() { if (context.state !== 'running') await context.resume(); }
    };
    return { engine, context, gesture(fn) { inGesture = true; try { fn(); } finally { inGesture = false; } } };
}

/** An <audio> element as the helper uses it: its source, whether it loops, and whether it plays. */
function fakeAudioClass() {
    const made = [];
    class FakeAudio {
        constructor(src) { this.src = src; this.loop = false; this.paused = true; made.push(this); }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
    }
    return { FakeAudio, made };
}

describe('the audio a reader\'s press unlocks', () => {
    it('starts the engine\'s context inside the press itself', () => {
        const { engine, context, gesture } = gestureContext();
        gesture(() => unlockAudio({ engine }));
        expect(context.state).toBe('running');
    });

    it('leaves a context suspended when it is asked later, outside the press (WebKit\'s rule, as the fake keeps it)', async () => {
        const { engine, context } = gestureContext();
        await engine.resume();
        expect(context.state).toBe('suspended');
    });

    it('where WebKit chooses the audio session from what plays, asks for playback and keeps a silent loop playing', () => {
        const { FakeAudio, made } = fakeAudioClass();
        const navigator = { audioSession: { type: 'auto' } };
        const keeper = unlockAudio({ navigator, Audio: FakeAudio, silence: 'https://rise.example/audio/silence.wav' });
        expect(navigator.audioSession.type).toBe('playback');
        expect(made).toHaveLength(1);
        expect(keeper).toBe(made[0]);
        expect(keeper).toMatchObject({ src: 'https://rise.example/audio/silence.wav', loop: true, paused: false });
    });

    it('plays the same loop again on a later press, rather than making another', () => {
        const { FakeAudio, made } = fakeAudioClass();
        const navigator = { audioSession: { type: 'auto' } };
        const keeper = unlockAudio({ navigator, Audio: FakeAudio, silence: '/audio/silence.wav' });
        keeper.pause();
        expect(unlockAudio({ navigator, Audio: FakeAudio, silence: '/audio/silence.wav', keeper })).toBe(keeper);
        expect(made).toHaveLength(1);
        expect(keeper.paused).toBe(false);
    });

    it('makes no loop in a browser without the AudioSession API, whose Web Audio no ring switch silences', () => {
        const { FakeAudio, made } = fakeAudioClass();
        expect(unlockAudio({ navigator: {}, Audio: FakeAudio, silence: '/audio/silence.wav' })).toBeNull();
        expect(made).toEqual([]);
    });

    it('is quiet where nothing can be unlocked', () => {
        expect(() => unlockAudio()).not.toThrow();
        expect(() => unlockAudio({ engine: { context: null } })).not.toThrow();
        const refusing = { audioSession: { set type(_) { throw new Error('no'); } } };
        expect(() => unlockAudio({ navigator: refusing })).not.toThrow();
    });
});
