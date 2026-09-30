/**
 * Diving: looking under the passage the reading is at.
 *
 * A dive never moves the reading. The head stays on the atom it was on and the
 * Player is held, exactly as it is when the reader pauses, so surfacing is
 * resuming and there is no seek to get wrong (LATERAL-TRAVERSAL-SPEC §1). This
 * module is only the small state a dive is in, and how a press becomes it. It
 * knows no DOM, no Player, and no clock of its own: time comes in as an
 * argument.
 *
 *   surface   the reading, as it always is
 *   glance    a press the reader is still holding; open while held
 *   anchored  a press let go quickly; stays open until pressed again
 *
 * A press opens a glance at once, so a hold shows what lies under the passage
 * without waiting to find out whether it will be held. Letting go decides it:
 * after a hold the glance ends; before one the dive is anchored.
 */

/** How long a press must last to be a glance rather than an anchor. */
export const GLANCE_HOLD_MS = 350;

/**
 * @returns {{
 *   readonly state: 'surface'|'glance'|'anchored',
 *   press(now: number): {from: string, to: string}|null,
 *   release(now: number): {from: string, to: string}|null,
 *   tap(): {from: string, to: string},
 *   surface(): {from: string, to: string}|null
 * }} each move answers the change it made, or null when it changed nothing
 */
export function createDive() {
    let state = 'surface';
    let pressedAt = null;
    // A press that arrives while anchored is a request to close, decided on
    // release, so that holding an anchored dive does not leave it half open.
    let closing = false;

    const move = to => {
        const from = state;
        state = to;
        return { from, to };
    };

    return {
        get state() { return state; },

        press(now) {
            if (pressedAt !== null) return null;
            pressedAt = now;
            if (state === 'anchored') {
                closing = true;
                return null;
            }
            return move('glance');
        },

        release(now) {
            if (pressedAt === null) return null;
            const held = now - pressedAt;
            pressedAt = null;
            if (closing) {
                closing = false;
                return move('surface');
            }
            return move(held >= GLANCE_HOLD_MS ? 'surface' : 'anchored');
        },

        tap() {
            return move(state === 'surface' ? 'anchored' : 'surface');
        },

        surface() {
            pressedAt = null;
            closing = false;
            return state === 'surface' ? null : move('surface');
        }
    };
}
