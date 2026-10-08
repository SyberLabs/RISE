/**
 * The beat conductor: each atom's clock.
 *
 * A v2 Current has atoms no voice says: a hold's one silent atom, and the
 * atoms of a beat that is shown for a while. Left to the speech governor they
 * would wait for a voice that never begins them, and the reading would stand
 * down. This governor is installed ahead of it on the Player's completion
 * seam and answers for those atoms by their own duration (rise-current.js
 * timeBeats gave them the beat's); every other atom it declines, and the
 * voice decides (speech-governor.js).
 *
 * A paused reading is waiting on nothing: the wait is cancelled, and the
 * Player times what remains of the atom itself on resume, as it does for the
 * speech governor.
 *
 * Scenes that can end a hold early (`maxMs`) are a later sub-project; here a
 * hold lasts exactly its `ms`.
 */
export function createBeatConductor({ clock }) {
    let player = null;
    let release = null;
    let stopWatching = null;
    let waiting = null;

    const timed = atom => atom?.hold !== undefined || atom?.beatTimed === true;

    function cancelWait() {
        if (waiting) { waiting.cancel?.(); waiting = null; }
    }

    function duration(atom) {
        return timed(atom) ? atom.duration : undefined;
    }

    function completion(atom) {
        if (!timed(atom)) return null;
        cancelWait();
        const mine = { cancel: null };
        waiting = mine;
        return new Promise(resolve => {
            mine.cancel = clock.setTimer(() => {
                if (waiting === mine) waiting = null;
                resolve({ reason: 'ended' });
            }, atom.duration);
        });
    }

    return {
        /** Take a place ahead of the speech governor on the Player's clock. */
        install(target) {
            if (player) return;
            player = target;
            release = player.govern({ duration, completion });
            stopWatching = player.on('state', ({ state }) => {
                if (state === 'paused' || state === 'idle' || state === 'complete') cancelWait();
            });
        },

        dispose() {
            cancelWait();
            stopWatching?.();
            stopWatching = null;
            release?.();
            release = null;
            player = null;
        }
    };
}
