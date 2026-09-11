/**
 * A spoken atom lasts as long as its utterance (RECITATION-SPEC §1).
 *
 * This is the bug that made speech sound like buzzing. The reveal was
 * built to follow the voice, but the PLAYER still advanced on
 * words-per-minute — so every clip was cut off at 19–33% of its length,
 * and short atoms played only Kokoro's ~320ms of leading silence before
 * jumping to the next. Repeated every few hundred milliseconds, that is
 * a buzz rather than a reading.
 */
import { describe, expect, it, vi } from 'vitest';
import { Player } from './player.js';
import { compileSession } from './session-compiler.js';

const session = () => compileSession({
    text: 'One phrase here.\n\nAnother phrase follows.',
    chunkMode: 'phrase', wpm: 200
});

describe('atom duration override', () => {
    it('uses the authored duration when nothing governs', () => {
        const player = new Player(session());
        const atom = player.sessionState.currentAtom;
        expect(player._atomDisplayMs(atom)).toBeCloseTo(atom.duration, 0);
    });

    it('lets a consumer govern how long an atom lasts', () => {
        // The utterance, not the timer. Without this the voice is cut
        // off mid-word by a clock that knows nothing about speech.
        const player = new Player(session());
        player.atomDurationOverride = () => 2875;
        expect(player._atomDisplayMs(player.sessionState.currentAtom)).toBe(2875);
    });

    it('falls back when the override declines', () => {
        // A starved buffer returns null: that atom is unspoken and must
        // get its authored pace rather than stalling or racing.
        const player = new Player(session());
        const atom = player.sessionState.currentAtom;
        for (const declined of [null, undefined, 0, NaN, -100]) {
            player.atomDurationOverride = () => declined;
            expect(player._atomDisplayMs(atom), `for ${declined}`)
                .toBeCloseTo(atom.duration, 0);
        }
    });

    it('still answers to the shuttle', () => {
        // Fast-forward must remain fast even while speaking, or the
        // reader loses a control the voice was never meant to take.
        const player = new Player(session());
        player.atomDurationOverride = () => 2000;
        const atHome = player._atomDisplayMs(player.sessionState.currentAtom);
        expect(atHome).toBe(2000);

        player.shuttle.stepForward();          // one rung off home
        const divisor = player.shuttle.durationDivisor;
        expect(divisor).toBeGreaterThan(1);
        expect(player._atomDisplayMs(player.sessionState.currentAtom))
            .toBe(2000 / divisor);
    });
});

describe('event-governed atom completion', () => {
    it('advances from the actual audio end instead of starting a timer', async () => {
        const player = new Player(session());
        player.sessionState.state = 'playing';
        let finish;
        const ended = new Promise(resolve => { finish = resolve; });
        player.atomCompletionOverride = () => ended;
        player.processNextNode = vi.fn();
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame');

        player.scheduleNextAtom();
        expect(raf).not.toHaveBeenCalled();
        expect(player.processNextNode).not.toHaveBeenCalled();

        finish({ reason: 'ended' });
        await Promise.resolve();
        await Promise.resolve();
        expect(player.processNextNode).toHaveBeenCalledTimes(1);
        raf.mockRestore();
    });

    it('does not wait forever for an end that never comes', () => {
        // THE THIRD WAY THIS PROMISE CAN GO WRONG. A completion that
        // resolves badly degrades to the timer, and one that rejects
        // degrades to the timer — but one that never settles at all left
        // the reading stopped on the phrase it was showing, with no timer
        // scheduled and nothing to recover it. An audio element that
        // fires neither `ended` nor `error` is not exotic: playback
        // interrupted by the OS, a context suspended on a backgrounded
        // tab, a stalled media fetch. It was reported as a reading that
        // stopped after its first phrase and needed a pause and a play.
        vi.useFakeTimers();
        const player = new Player(session());
        player.sessionState.state = 'playing';
        player.atomDurationOverride = () => 2000;
        player.atomCompletionOverride = () => new Promise(() => {});
        const onward = vi.spyOn(player, 'scheduleNextAtom');

        player.scheduleNextAtom();
        onward.mockClear();

        // Its own audio is still running: nothing must interrupt it.
        vi.advanceTimersByTime(2000);
        expect(onward).not.toHaveBeenCalled();

        // Past its length plus the grace, the reading carries on.
        vi.advanceTimersByTime(2500);
        expect(onward).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('lets a spoken atom that does end keep its own clock', () => {
        // The watchdog must never be the thing that advances a reading
        // whose audio is behaving.
        vi.useFakeTimers();
        const player = new Player(session());
        player.sessionState.state = 'playing';
        player.atomDurationOverride = () => 2000;
        let finish;
        player.atomCompletionOverride = () => new Promise(resolve => { finish = resolve; });
        player.processNextNode = vi.fn();
        const onward = vi.spyOn(player, 'scheduleNextAtom');

        player.scheduleNextAtom();
        onward.mockClear();
        finish({ reason: 'ended' });

        return Promise.resolve().then(() => Promise.resolve()).then(() => {
            vi.advanceTimersByTime(10_000);
            expect(onward).not.toHaveBeenCalled();
            expect(player.speechWatchdogId).toBeNull();
            vi.useRealTimers();
        });
    });

    it('refreshes duration after a lazy completion governor starts', () => {
        const player = new Player(session());
        player.sessionState.state = 'playing';
        let audioStarted = false;
        player.atomDurationOverride = () => audioStarted ? 2875 : null;
        player.atomCompletionOverride = () => {
            audioStarted = true;
            return new Promise(() => {});
        };

        player.scheduleNextAtom();

        expect(player.currentAtomRemainingTime).toBe(2875);
    });

    it('uses traversal timing instead of speech away from home velocity', () => {
        const player = new Player(session());
        player.sessionState.state = 'playing';
        player.shuttle.stepForward();
        player.atomCompletionOverride = vi.fn(() => Promise.resolve({ reason: 'ended' }));
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame');

        player.scheduleNextAtom();

        expect(player.atomCompletionOverride).not.toHaveBeenCalled();
        expect(raf).toHaveBeenCalled();
        raf.mockRestore();
    });
});
