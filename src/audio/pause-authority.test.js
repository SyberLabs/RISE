/**
 * Who may lift a reader's pause.
 *
 * A pause suspends the audio context, which freezes the reading's layers
 * exactly where they stand. Every UI sound in the app resumes the context
 * before it plays, so without a rule about who may lift a suspension, a click
 * anywhere un-freezes the reading and it sounds until something stops it.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AudioEngine } from './engine.js';

function engineWithContext(state = 'running') {
    const engine = Object.create(AudioEngine.prototype);
    const calls = [];
    engine.context = {
        get state() { return this._state; },
        _state: state,
        suspend: async () => { calls.push('suspend'); engine.context._state = 'suspended'; },
        resume: async () => { calls.push('resume'); engine.context._state = 'running'; }
    };
    return { engine, calls };
}

describe('a reader\'s pause outranks a click', () => {
    let engine, calls;
    beforeEach(() => { ({ engine, calls } = engineWithContext()); });

    it('is not lifted by the generic resume every UI sound calls', async () => {
        await engine.pause();
        expect(calls).toEqual(['suspend']);

        // playHiss, playClick, playKeyPress and playAmbient all await this.
        await engine.resume();
        expect(calls).toEqual(['suspend']);
        expect(engine.context.state).toBe('suspended');
    });

    it('is lifted by the explicit unpause the reading itself calls', async () => {
        await engine.pause();
        await engine.unpause();
        expect(engine.context.state).toBe('running');

        // And afterwards a click sound may unlock a merely-suspended context
        // again, which is what it is for.
        engine.context._state = 'suspended';
        await engine.resume();
        expect(engine.context.state).toBe('running');
    });

    it('does not outlive the reading it belonged to', async () => {
        await engine.pause();
        engine._cancelPendingSessionStop = () => {};
        engine._sessionGeneration = 0;
        engine.fadeOutSession = () => {};
        void engine.stopSession({ immediate: true });

        // Leaving a paused reading must not leave the rest of the app mute.
        await engine.resume();
        expect(engine.context.state).toBe('running');
    });
});
