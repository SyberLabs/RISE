/**
 * The Checkout success page. Stripe sends the reader to
 * `/plus/claim?session_id=cs_…`; the id is lifted out of the address before
 * anything else (the way the OpenRouter callback is), handed to the Worker,
 * which confirms the purchase and sets the cookie, and the reader is told
 * once and returned Home. app.js names the path, beside /today.
 */
import { claimPlus } from './plus.js';

export async function enterFromPlusClaim(search, { home, notify }) {
  const sessionId = new URLSearchParams(search).get('session_id');
  window.history.replaceState({}, '', '/');
  const result = await claimPlus(sessionId);
  notify(result.ok ? 'Plus voice is on in this browser.' : result.message);
  await home();
}
