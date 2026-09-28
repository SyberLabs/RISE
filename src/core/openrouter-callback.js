/**
 * The part of "Connect OpenRouter" that runs first on every page load, with no
 * dependencies (it is on the first paint). On the callback it lifts the one-time
 * code out of the address bar and history before anything else runs; on any
 * other load it clears a sign-in this tab started and never finished.
 * openrouter-oauth.js does the rest.
 */
export const CALLBACK_PATH = '/connect/openrouter';
export const PENDING_KEY = 'rise-openrouter-pkce-v1';

// The one-time state rides in the callback path (/connect/openrouter/<state>),
// so it survives however the provider appends ?code= to the URL.
export function takeOpenRouterReturn(location = globalThis.location, history = globalThis.history,
  storage = globalThis.sessionStorage) {
  const match = /^\/connect\/openrouter(?:\/([^/]*))?\/?$/u.exec(location.pathname);
  if (match) {
    const callback = { code: new URL(location.href).searchParams.get('code'), state: match[1] || null };
    history.replaceState(null, '', '/');
    return { callback };
  }
  try {
    if (storage.getItem(PENDING_KEY) === null) return null;
    storage.removeItem(PENDING_KEY);
    return { abandoned: true };
  } catch {
    return null;
  }
}
