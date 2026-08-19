/**
 * A recording resumes where it stopped.
 *
 * A pause ends the bed and a resume starts it again, because a Web Audio
 * buffer source can be started but never resumed. The engine keeps the offset
 * so the reader's own music comes back mid-song instead of at 0:00 — without
 * suspending the audio context, which is the whole application's and takes
 * the UI sounds, the lobby drones and every other room down with it.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AudioEngine } from './engine.js';

function bedEngine(duration = 240) {
    const engine = Object.create(AudioEngine.prototype);
    const starts = [];
    engine.context = {
        currentTime: 0,
        createBufferSource: () => ({
            buffer: null,
            loop: false,
            connect: () => {},
            start: (when, offset) => starts.push(offset),
            stop: () => {}
        })
    };
    engine.layerGains = { soundscape: {} };
    engine.personalPool = new Map([['kanye', { duration }]]);
    return { engine, starts };
}

describe('a personal bed keeps its place across a pause', () => {
    let engine, starts;
    beforeEach(() => { ({ engine, starts } = bedEngine()); });

    it('starts at the beginning, then from where it was stopped', () => {
        const first = engine._personalBedHandle('kanye');
        first.start();
        expect(starts).toEqual([0]);

        engine.context.currentTime = 42;
        first.stop();

        // A pause and a resume build a new handle for the same recording.
        const second = engine._personalBedHandle('kanye');
        second.start();
        expect(starts).toEqual([0, 42]);

        engine.context.currentTime = 100;
        second.stop();
        engine._personalBedHandle('kanye').start();
        expect(starts).toEqual([0, 42, 100]);
    });

    it('wraps rather than seeking past the end of a looping recording', () => {
        const handle = engine._personalBedHandle('kanye');
        handle.start();
        engine.context.currentTime = 250;
        handle.stop();

        engine._personalBedHandle('kanye').start();
        expect(starts.at(-1)).toBeCloseTo(10, 6);
    });

    it('forgets the position when the reading ends', () => {
        const handle = engine._personalBedHandle('kanye');
        handle.start();
        engine.context.currentTime = 42;
        handle.stop();

        engine._cancelPendingSessionStop = () => {};
        engine._sessionGeneration = 0;
        engine.fadeOutSession = () => {};
        void engine.stopSession({ immediate: true });
        // stopSession clears the positions at once and then schedules the layer
        // teardown. That teardown is engine.lifecycle's business, not this
        // test's, and left to fire it would reach for layers this stub has
        // never had — after the test had already finished, where a throw is an
        // unhandled rejection rather than a failure anyone can read.
        clearTimeout(engine._sessionStopTimer);

        engine.context.currentTime = 0;
        engine._personalBedHandle('kanye').start();
        expect(starts.at(-1)).toBe(0);
    });
});
