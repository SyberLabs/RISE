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
 * A beat's cue is fired when the beat begins, on the first atom of its
 * passage the Player shows, as the running engine's commands the compiler
 * lowered it to (rise-current.js); the runtime delivers them. It is fired
 * once that atom's other listeners have run, so a beat that starts a scene
 * and cues it reaches the scene it started.
 *
 * A hold with `maxMs` belongs to the scene running under it, when there is
 * one to ask (`onHold`, the host's): the hold ends when the scene's promise
 * does (the scene runtime keeps it within ms, the scene's done and maxMs), and
 * at maxMs at the latest whatever it does. While the scene holds, the Player
 * is told the hold may last maxMs, so its own watchdog waits that long. A hold
 * with no scene to ask, or no maxMs, lasts exactly its `ms`.
 */
export function createBeatConductor({ clock, onCue = null, onHold = null }) {
    let player = null;
    let release = null;
    let stopWatching = null;
    let stopAtoms = null;
    let waiting = null;
    let lastCued = null;

    const timed = atom => atom?.hold !== undefined || atom?.beatTimed === true;

    function cancelWait() {
        if (waiting) { waiting.cancel?.(); waiting = null; }
    }

    function duration(atom) {
        if (!timed(atom)) return undefined;
        return waiting?.atom === atom && waiting.held ? atom.hold.maxMs : atom.duration;
    }

    /** The scene's promise for a hold it may end, or null when the conductor's own clock decides. */
    function sceneHold(atom) {
        if (atom.hold?.maxMs === undefined || typeof onHold !== 'function') return null;
        try {
            const held = onHold(atom);
            return typeof held?.then === 'function' ? held : null;
        } catch {
            return null;
        }
    }

    function completion(atom) {
        if (!timed(atom)) return null;
        cancelWait();
        const held = sceneHold(atom);
        const mine = { cancel: null, atom, held: held !== null };
        waiting = mine;
        return new Promise(resolve => {
            let stop = null;
            const end = () => {
                if (waiting !== mine) return;
                waiting = null;
                stop?.();
                resolve({ reason: 'ended' });
            };
            stop = clock.setTimer(end, held ? atom.hold.maxMs : atom.duration);
            mine.cancel = () => stop();
            held?.then(end, () => {});
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
            stopAtoms = player.on('atom', ({ atom }) => {
                const cue = atom?.beat?.cue;
                if (!cue || atom.sourceId === lastCued) return;
                lastCued = atom.sourceId;
                const given = { cue, sceneId: atom.scene ?? null, commands: atom.cueCommands ?? [] };
                // After the atom's other listeners: the view mounts the scene a beat starts as the atom arrives.
                queueMicrotask(() => { if (player) onCue?.(given); });
            });
        },

        dispose() {
            cancelWait();
            stopWatching?.();
            stopWatching = null;
            stopAtoms?.();
            stopAtoms = null;
            lastCued = null;
            release?.();
            release = null;
            player = null;
        }
    };
}
