/**
 * Put a live reading on screen, in Read's chamber pane.
 *
 * The Player is the one the live runtime built for this Current; the factory
 * adopts it (see live-handoff.js) instead of making another. The view replaces
 * whatever reading is showing, the way a successor division does; and a Player
 * that was held part way (a Dive that has come back) is shown its atom again,
 * because the view is new.
 */

import { offerLivePlayer } from './live-handoff.js';
import { LIVE_PATH } from '../core/route-url.js';

export async function presentLive(router, session, player) {
    session.origin = { view: 'live' };
    // The reading is the live room's, so it keeps the room's address, query and
    // all: the query is how the room was opened (an MCP embed, a provider, a
    // voice), and a reload of the frame must open the same room.
    const here = globalThis.location;
    session.publicPath = here?.pathname === LIVE_PATH ? `${LIVE_PATH}${here.search}` : LIVE_PATH;
    const mounted = offerLivePlayer(session, player);
    // The Chamber that was showing goes first, and lets go of its Player as
    // it does; the live host, Read's other pane, stays.
    router.getViewInstance('read')?.closePane('chamber');
    const navigation = router.navigate('chamber-session', {
        data: session,
        force: true,
        replace: true,
        skipStack: true
    });
    // The reading begins as soon as the Chamber exists, not when the router has finished
    // fading it in; a navigation that then fails is still reported.
    navigation.catch(error => console.error('[RISE] Live presentation failed:', error));
    await Promise.race([mounted, navigation]);
    if (player.sessionState.state === 'paused') player.replayCurrent();
}

export async function leaveLive(router) {
    const leaving = router.getViewInstance?.('read')?.paneInstance('chamber') ?? null;
    // The address already names the live room (see presentLive); keep it, query and all.
    const left = await router.navigate('live', { replace: true, skipStack: true, keepUrl: true });
    // Showing the live pane hides the chamber pane but keeps it, and a Chamber kept
    // goes on drawing its imagery unseen. It goes once it is off screen, as a
    // reading's own exit lets it go (chamber-session-factory.js).
    dismissLive(router, leaving);
    return left;
}

/** The reading is over: let go of the Chamber that showed it, unless another has taken its place. */
export function dismissLive(router, chamber = router.getViewInstance?.('read')?.paneInstance('chamber') ?? null) {
    if (!chamber) return;
    router.getViewInstance?.('read')?.closePane('chamber', chamber);
}
