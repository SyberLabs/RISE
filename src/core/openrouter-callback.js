/**
 * The part of "Connect OpenRouter" that runs first on every page load, with no
 * dependencies (it is on the first paint). On the callback it lifts the one-time
 * code out of the address bar and history before anything else runs; on any
 * other load it clears a sign-in this tab started and never finished.
 * openrouter-oauth.js does the rest.
 *
 * A sign-in started from a page other than Home (RISE Live's /live) names that
 * page, and the reader's unasked question, in the pending sign-in; the callback
 * lands there instead of Home, and only that page claims it.
 */
export const CALLBACK_PATH = '/connect/openrouter';
export const PENDING_KEY = 'rise-openrouter-pkce-v1';
/** The longest question kept for the round trip: a question's own bound (src/live/adapter.js OPEN_LIMITS.prompt). */
export const DRAFT_LIMIT = 2_000;

// The one-time state rides in the callback path (/connect/openrouter/<state>),
// so it survives however the provider appends ?code= to the URL.
let captured = null;

/**
 * This tab's session storage, or null where the page may not have one. Inside a
 * host's sandboxed card (an opaque origin) the getter itself throws, and a
 * default parameter evaluates it before the function body can catch anything.
 */
export function sessionStorageOrNull() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/**
 * A page of this site to come back to, or null: a plain path of words and
 * slashes, so never another origin, a query, or the callback itself.
 */
export function returnPath(value) {
  return typeof value === 'string' && value.length <= 100 && /^(?:\/[A-Za-z0-9_-]+)+$/u.test(value)
    && !value.startsWith(CALLBACK_PATH) ? value : null;
}

export function takeOpenRouterReturn(location = globalThis.location, history = globalThis.history,
  storage = sessionStorageOrNull()) {
  captured = readReturn(location, history, storage);
  return captured;
}

/** Hand what was found on page load, once, to the page it returns to (Home unless it names another). */
export function claimOpenRouterReturn(path = '/') {
  const found = captured;
  if (!found || (found.returnTo ?? '/') !== path) return null;
  captured = null;
  return found;
}

/** The pending sign-in, read and left in place: the exchange removes it. */
function peek(storage) {
  try {
    const value = JSON.parse(storage.getItem(PENDING_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Where the sign-in comes back to, and the question it carried; nothing for Home. */
function returnOf(pending) {
  const returnTo = returnPath(pending?.returnTo);
  if (!returnTo) return {};
  const draft = typeof pending.draft === 'string' ? pending.draft.slice(0, DRAFT_LIMIT) : '';
  return { returnTo, ...(draft ? { draft } : {}) };
}

function readReturn(location, history, storage) {
  const match = /^\/connect\/openrouter(?:\/([^/]*))?\/?$/u.exec(location.pathname);
  if (match) {
    const callback = { code: new URL(location.href).searchParams.get('code'), state: match[1] || null };
    // Only this tab's own sign-in names where it comes back to.
    const pending = peek(storage);
    const back = pending?.state === callback.state ? returnOf(pending) : {};
    history.replaceState(null, '', back.returnTo ?? '/');
    return { callback, ...back };
  }
  try {
    if (storage.getItem(PENDING_KEY) === null) return null;
    const back = returnOf(peek(storage));
    storage.removeItem(PENDING_KEY);
    // Back on the page it was started from without signing in: that page has its question again.
    return { abandoned: true, ...(back.returnTo === location.pathname ? back : {}) };
  } catch {
    return null;
  }
}
