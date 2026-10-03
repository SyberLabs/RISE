/**
 * Put a live reading on screen, in the one Chamber view.
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
    // The reading is the live room's, so it keeps the room's address.
    session.publicPath = LIVE_PATH;
    const mounted = offerLivePlayer(session, player);
    // The router remounts a view only when it has none: the Chamber that was
    // showing goes first, and lets go of its Player as it does.
    const showing = router.views.get('chamber-session');
    if (showing?.instance) {
        showing.instance.destroy?.();
        showing.instance = null;
    }
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

export function leaveLive(router) {
    return router.navigate('live', { replace: true, skipStack: true });
}
