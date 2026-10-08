/**
 * "Connect OpenRouter": OAuth PKCE (S256) so the reader's own account mints
 * a key for RISE in their browser. https://openrouter.ai/docs/guides/overview/auth/oauth
 *
 * Only the verifier and a one-time state, needed across the redirect, touch
 * storage (sessionStorage, this tab only), and they are removed the moment
 * the callback is read, whatever its outcome. OpenRouter has no state
 * parameter, so the state rides in our own callback path and must match.
 * The authorization code is stripped from the address bar before anything
 * else happens. The key goes straight to memory (ai-connection.js).
 */
import { acceptOpenRouterKey, postConnectionNotice } from './ai-connection.js';
import { CALLBACK_PATH, PENDING_KEY, sessionStorageOrNull, takeOpenRouterReturn } from './openrouter-callback.js';

export { CALLBACK_PATH, PENDING_KEY, takeOpenRouterReturn };
export const AUTH_URL = 'https://openrouter.ai/auth';
export const EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';
export const PENDING_TTL_MS = 10 * 60 * 1000;
const STATE_SHAPE = /^[A-Za-z0-9_-]{22,64}$/u;
const CODE_SHAPE = /^[A-Za-z0-9._~-]{8,512}$/u;

const OUTCOME_MESSAGES = Object.freeze({
  CONNECTED: 'OpenRouter connected. Jev requests are billed to your OpenRouter account.',
  CANCELED: 'OpenRouter was not connected. Nothing changed.',
  UNSOLICITED: 'That OpenRouter sign-in was not started from this tab, so RISE ignored it. Press Connect OpenRouter in the tab where you want to use it.',
  EXPIRED: 'That OpenRouter sign-in took too long. Connect OpenRouter again.',
  STATE_MISMATCH: 'That OpenRouter sign-in did not match this tab, so RISE ignored it.',
  INVALID_CALLBACK: 'OpenRouter returned an unexpected answer. Connect OpenRouter again.',
  EXCHANGE_FAILED: 'OpenRouter did not issue a key. Connect OpenRouter again.',
  UNAVAILABLE: 'OpenRouter could not be reached. Connect OpenRouter again.'
});

export function outcomeMessage(code) {
  return OUTCOME_MESSAGES[code] || OUTCOME_MESSAGES.INVALID_CALLBACK;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

export async function codeChallenge(verifier, cryptoImpl = globalThis.crypto) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Start the redirect. Returns the authorization URL it navigated to. */
export async function beginOpenRouterConnect({
  storage = sessionStorageOrNull(),
  origin = globalThis.location?.origin,
  navigate = url => globalThis.location.assign(url),
  cryptoImpl = globalThis.crypto,
  now = Date.now
} = {}) {
  const verifier = base64url(cryptoImpl.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoImpl.getRandomValues(new Uint8Array(24)));
  const challenge = await codeChallenge(verifier, cryptoImpl);
  // Throws in a storage-less private window; the caller shows the error.
  storage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, createdAt: now() }));
  const callback = new URL(`${CALLBACK_PATH}/${state}`, origin);
  const url = new URL(AUTH_URL);
  url.searchParams.set('callback_url', callback.href);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  navigate(url.href);
  return url.href;
}

function readPending(storage) {
  let raw = null;
  try {
    raw = storage.getItem(PENDING_KEY);
    storage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  try {
    const value = JSON.parse(raw || 'null');
    return value && typeof value.verifier === 'string' && typeof value.state === 'string'
      && Number.isFinite(value.createdAt) ? value : null;
  } catch {
    return null;
  }
}

/** Finish a callback taken by takeOpenRouterReturn. Resolves to { code }. */
export async function completeOpenRouterConnect(taken, {
  storage = sessionStorageOrNull(),
  fetcher = fetch,
  now = Date.now,
  timeoutMs = 15000
} = {}) {
  const pending = readPending(storage);
  if (!taken) return { code: 'INVALID_CALLBACK' };
  if (!pending) return { code: 'UNSOLICITED' };
  if (now() - pending.createdAt > PENDING_TTL_MS || now() < pending.createdAt) return { code: 'EXPIRED' };
  if (typeof taken.state !== 'string' || !STATE_SHAPE.test(taken.state) || taken.state !== pending.state) {
    return { code: 'STATE_MISMATCH' };
  }
  if (!taken.code) return { code: 'CANCELED' };
  if (!CODE_SHAPE.test(taken.code)) return { code: 'INVALID_CALLBACK' };
  let response;
  try {
    response = await fetcher(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: taken.code, code_verifier: pending.verifier, code_challenge_method: 'S256' }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    return { code: 'UNAVAILABLE' };
  }
  if (!response.ok) return { code: 'EXCHANGE_FAILED' };
  let body;
  try {
    body = await response.json();
  } catch {
    return { code: 'EXCHANGE_FAILED' };
  }
  return acceptOpenRouterKey(body?.key) ? { code: 'CONNECTED' } : { code: 'EXCHANGE_FAILED' };
}

/** Finish what takeOpenRouterReturn found on page load, and tell Home. */
export async function finishOpenRouterReturn(found, options) {
  const { callback, abandoned } = found || {};
  if (!callback && !abandoned) return null;
  const { code } = callback ? await completeOpenRouterConnect(callback, options) : { code: 'CANCELED' };
  postConnectionNotice(outcomeMessage(code), code === 'CONNECTED' ? 'success' : 'error');
  return code;
}
