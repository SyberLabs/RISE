/**
 * The part of "Connect OpenRouter" that runs first on every page load, with no
 * dependencies (it is on the first paint). On the callback it lifts the one-time
 * code out of the address bar and history before anything else runs; on any
 * other load it clears a sign-in this tab started and never finished.
 * openrouter-oauth.js does the rest.
 */
export const CALLBACK_PATH = '/connect/openrouter';
export const PENDING_KEY = 'rise-openrouter-pkce-v1';

export function takeOpenRouterReturn(location = globalThis.location, history = globalThis.history,
  storage = globalThis.sessionStorage) {
  if (/^\/connect\/openrouter\/?$/u.test(location.pathname)) {
    const params = new URL(location.href).searchParams;
    history.replaceState(null, '', '/');
    return { callback: { code: params.get('code'), state: params.get('rise_state') } };
  }
  try {
    const abandoned = storage.getItem(PENDING_KEY) !== null;
    storage.removeItem(PENDING_KEY);
    return { abandoned };
  } catch {
    return {};
  }
}
