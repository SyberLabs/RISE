import { notePlusClaimed } from './plus.js';

const CLOSED = Object.freeze({ checkoutAvailable: false, recoveryAvailable: false, offer: null });
async function request(path, body, { fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      fetchImpl(`/api/plus/${path}`, body === undefined ? { signal: controller.signal } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal
      }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

/** Do not infer a saleable offer from an old payment link or partial configuration. */
export async function fetchPlusOffer(options = {}) {
  try {
    const response = await request('config', undefined, { timeoutMs: 3000, ...options });
    if (!response.ok) return { ...CLOSED };
    const body = await response.json();
    const offer = body?.offer;
    const valid = Number.isSafeInteger(offer?.amount) && offer.amount > 0
      && offer.currency === 'usd' && offer.interval === 'month'
      && Number.isSafeInteger(offer.characterLimit) && offer.characterLimit > 0;
    return { checkoutAvailable: body?.checkoutAvailable === true && valid,
      recoveryAvailable: body?.recoveryAvailable === true, offer: valid ? offer : null };
  } catch { return { ...CLOSED }; }
}

async function action(path, body, successStatus, options, redirectHost) {
  try {
    const response = await request(path, body, options);
    if (response.status !== successStatus) {
      const data = await response.json().catch(() => null);
      return { ok: false, message: typeof data?.error?.message === 'string' ? data.error.message : 'This request could not be completed. Please try again.' };
    }
    if (!redirectHost) return { ok: true };
    const { url } = await response.json();
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.hostname !== redirectHost || target.username || target.password || target.port) throw new Error('Invalid redirect');
    return { ok: true, url: target.href };
  } catch { return { ok: false, message: 'RISE could not be reached. Please try again. Free reading is still available.' }; }
}
export const startPlusCheckout = (requestId, options = {}) => action('checkout', { request_id: requestId }, 200, options, 'checkout.stripe.com');
export const openPlusBilling = (options = {}) => action('portal', {}, 200, options, 'billing.stripe.com');
export const recoverPlus = (email, options = {}) => action('recover', { email }, 202, options);
export async function restorePlus(token, options = {}) {
  const result = await action('restore', { token }, 204, options);
  if (result.ok) notePlusClaimed();
  return result;
}

export async function confirmPlusPurchase(sessionId, options = {}) {
  const result = await action('claim', { session_id: sessionId }, 204, options);
  if (result.ok) notePlusClaimed();
  return result;
}
