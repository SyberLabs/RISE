/**
 * Handing a live reading's Player to the Chamber that will show it.
 *
 * A live Current is built by the runtime, which makes its Player itself and
 * plays it. The Chamber factory is the only thing that presents a reading, and
 * it makes its own Player unless it is handed one; this is where it is handed
 * one. It is a module and not part of the shell so that the shell carries none
 * of it: only what loads the factory loads this.
 */

let offered = null;
let resolveMounted = null;
let onExit = null;

/** Offer the Player for the Session about to be presented. Resolves when a Chamber exists for it. */
export function offerLivePlayer(session, player) {
    offered = { session, player };
    return new Promise(resolve => { resolveMounted = resolve; });
}

/** The factory asks once, for the Session it has been handed. */
export function takeLivePlayer(session) {
    if (!offered || offered.session !== session) return null;
    const { player } = offered;
    offered = null;
    return player;
}

/** The factory built the Chamber; its listeners are bound and the reading can begin. */
export function liveMounted() {
    resolveMounted?.();
    resolveMounted = null;
}

/** The host registers to hear that the reader left the Chamber by its own control. */
export function onLiveExit(callback) {
    onExit = callback;
    return () => { if (onExit === callback) onExit = null; };
}

export function liveExited(session) {
    onExit?.(session);
}
