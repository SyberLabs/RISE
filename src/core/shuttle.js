/**
 * The Shuttle — lateral traversal state (LATERAL-TRAVERSAL-SPEC.md).
 *
 * There is no seeking. Traversal is CONTINUOUS: a signed velocity on
 * a discrete ladder, applied to the same reading clock everything
 * schedules against. The head passes over every atom in sequence at
 * any speed, so the monotonic-progression assumption every subsystem
 * depends on survives.
 *
 * This module is PURE STATE: no DOM, no Player, no timers. The
 * Player consumes it at exactly one seam (atom duration and
 * advancement direction); the Chamber drives it from the arrow keys.
 *
 * The ladder (spec §3): 1× is home, the only steady state.
 *   → from home climbs 2×, 4×, 8×.
 *   ← from home enters rewind at -2×, deeper to -4×, -8×.
 *   Stepping TOWARD home descends and STOPS at home — one keypress
 *   never glides through 1× into the opposite direction.
 *
 * The high-water mark (spec §6): the maximum position ever reached.
 * It never decreases; everything behind it is paid for.
 */

export const SHUTTLE_LADDER = Object.freeze([-8, -4, -2, 1, 2, 4, 8]);
const HOME_INDEX = SHUTTLE_LADDER.indexOf(1);

export class Shuttle {
    constructor() {
        this._ladderIndex = HOME_INDEX;
        this._highWaterMark = 0;
    }

    /** Signed velocity: 1 at home, 2/4/8 forward, -2/-4/-8 in rewind. */
    get velocity() {
        return SHUTTLE_LADDER[this._ladderIndex];
    }

    /** True at the one steady state (normal reading). */
    get atHome() {
        return this.velocity === 1;
    }

    /** True while traversing backward. */
    get rewinding() {
        return this.velocity < 0;
    }

    /** The maximum atom index ever reached this session. */
    get highWaterMark() {
        return this._highWaterMark;
    }

    /**
     * → : one rung toward (or past) forward speed. From rewind this
     * steps TOWARD home and stops there (spec: never through home on
     * one press).
     * @returns {number} the new velocity
     */
    stepForward() {
        if (this._ladderIndex < SHUTTLE_LADDER.length - 1) {
            this._ladderIndex += 1;
        }
        return this.velocity;
    }

    /**
     * ← : one rung toward (or past) rewind. From forward speed this
     * steps toward home and stops there.
     * @returns {number} the new velocity
     */
    stepBackward() {
        if (this._ladderIndex > 0) {
            this._ladderIndex -= 1;
        }
        return this.velocity;
    }

    /** Return to normal reading (pause, session start, atom 0 clamp). */
    reset() {
        this._ladderIndex = HOME_INDEX;
        return this.velocity;
    }

    /**
     * Record a reached position. Called wherever the atom index
     * advances; the mark only ever rises.
     */
    markPosition(index) {
        if (Number.isInteger(index) && index > this._highWaterMark) {
            this._highWaterMark = index;
        }
        return this._highWaterMark;
    }

    /**
     * The duration multiplier for the current velocity: an atom at
     * 4× displays for a quarter of its authored time (in either
     * direction — rewind replays chunks at speed, spec §5).
     */
    get durationDivisor() {
        return Math.abs(this.velocity);
    }
}
