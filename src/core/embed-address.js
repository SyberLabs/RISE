/**
 * Where the app runs.
 *
 * On RISE's own pages that is the window's address. In a host's app card (an
 * MCP App in ChatGPT or Claude) RISE runs inside the host's sandbox: the
 * document's address, and its base, are the host's, so the card
 * names the route it opens in `<meta name="rise-embed" content="/live?...">`
 * (src/live/hosts/mcp-card.js) and the app keeps its address in memory. Writing
 * the host's history would throw (a cross-origin URL under the base) and would
 * mean nothing to the reader.
 */
const ROUTE = /^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/u;
const BASE = 'https://rise.invalid';

function declared() {
  const content = globalThis.document?.querySelector?.('meta[name="rise-embed"]')?.getAttribute('content');
  return typeof content === 'string' && ROUTE.test(content) ? content : null;
}

function memory(route) {
  const location = { pathname: '/', search: '', hash: '' };
  const go = target => {
    const url = new URL(String(target), BASE);
    location.pathname = url.pathname;
    location.search = url.search;
  };
  go(route);
  const history = {
    state: null,
    pushState(state, _title, target) { this.state = state; if (target != null) go(target); },
    replaceState(state, _title, target) { this.state = state; if (target != null) go(target); }
  };
  return { location, history };
}

const route = declared();
const card = route === null ? null : memory(route);

/** Whether RISE is running inside a host's app card. */
export const IN_HOST_CARD = card !== null;

/** The address the app reads its route from. */
export function appLocation() {
  return card?.location ?? globalThis.location;
}

/** The history the router writes the address to. */
export function appHistory() {
  return card?.history ?? globalThis.history;
}

/**
 * The address of one of RISE's own files, given root-relative. Inside a host's
 * card the document's base is the host's sandbox, which refuses a <base> of
 * RISE's (Claude's policy carries base-uri 'self'), so there the address is
 * taken from this module, which is RISE's. Elsewhere the path is the window's
 * own and is returned as given.
 */
export function siteUrl(path) {
  return IN_HOST_CARD ? new URL(path, import.meta.url).href : path;
}
