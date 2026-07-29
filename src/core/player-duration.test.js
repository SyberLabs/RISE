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
import { describe, expect, it } from 'vitest';
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
