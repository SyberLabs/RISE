/**
 * Where leaving a reading goes.
 *
 * A reading can be reached from several surfaces, and a reader who
 * leaves one expects the surface they came from — not the surface the
 * Chamber happens to sit in front of. The session carries where it came
 * from; this decides where it returns to.
 *
 * THE RULE IS A PURE FUNCTION because it is a table of cases and one of
 * them is easy to break by adding another. The factory that calls it
 * owns the teardown and the navigation; it owns none of the deciding.
 */

/** Marks a session launched from the try-rise screen. */
export const KEYSTONE_SESSION_ORIGIN = 'keystones';

/** The reasons that mean "the reader is leaving", as opposed to going on. */
const LEAVING = new Set(['back', 'exit', 'close']);

/**
 * @param {string} reason  what the Chamber reported on the way out
 * @param {object} session the session being left
 * @param {object|null} data payload the Chamber sent with the reason
 * @returns {{kind: string, view?: string, data?: object, replaceUrl?: boolean}|null}
 *   null when the reason carries no destination, which is not an error:
 *   teardown still happens and the reader stays where they are.
 */
export function chamberExitTarget(reason, session = {}, data = null) {
    if (reason === 'continue') return { kind: 'continue' };

    if (reason === 'workshop' && data && data.text) {
        return {
            kind: 'navigate',
            view: 'workshop',
            data: { draftIntent: 'new-recursion', text: data.text }
        };
    }

    if (!LEAVING.has(reason)) return null;

    // A preview belongs to the room that is previewing it, whatever the
    // reading itself came from. This case stays ahead of the others.
    if (session?.isPreview) return { kind: 'navigate', view: 'workshop' };

    if (session?.origin === KEYSTONE_SESSION_ORIGIN) {
        return {
            kind: 'navigate',
            view: 'keystones',
            // Replace rather than push, so the reading the reader just
            // closed is not left in history for Back to return to. Back
            // reaches whatever preceded it instead.
            replaceUrl: true
        };
    }

    return { kind: 'navigate', view: 'chamber' };
}
