/**
 * The reader's AI connection for this tab: none, their own OpenRouter account
 * (hosted Jev, billed to them), or Kev on their own computer (local RISE).
 *
 * The OpenRouter key lives only in this module's memory. It is never written
 * to storage, never sent to a SyberLabs server, and forgotten on reload or
 * disconnect. Page memory is not a vault: browser extensions and any script
 * running in this page could read it, which is why RISE loads no third-party
 * scripts and keeps a strict content-security policy.
 */
import { JEV, KEV } from './decision/providers.js';

export const LOCAL_STATUS_PATH = '/api/local/status';

/**
 * Local RISE marks the page it serves (local/bridge.mjs injects this meta).
 * The public site never has it, so it never probes for a local bridge.
 */
export function isLocalRise(doc = globalThis.document) {
  return doc?.querySelector?.('meta[name="rise-local"]')?.getAttribute('content') === '1';
}
const KEY_SHAPE = /^[\x21-\x7e]{20,512}$/u;

let openRouterKey = null;
let local = null; // { revision, device } once the bridge reports Kev ready
let notice = null; // one message about the last connect attempt, shown once
const listeners = new Set();

function notify() {
  const state = connectionState();
  for (const listener of listeners) {
    try { listener(state); } catch { /* a listener never breaks the connection */ }
  }
}

/** What the page may show. Never includes the key. */
export function connectionState() {
  if (local) return { kind: 'local', label: 'Kev on this computer', billing: 'none', device: local.device || null };
  if (openRouterKey) return { kind: 'openrouter', label: 'Jev through your OpenRouter account', billing: 'reader' };
  return { kind: 'none' };
}

export function subscribeConnection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Accept a key minted by OpenRouter for this reader (openrouter-oauth.js). */
export function acceptOpenRouterKey(key) {
  if (typeof key !== 'string' || !KEY_SHAPE.test(key)) return false;
  openRouterKey = key;
  notify();
  return true;
}

export function disconnect() {
  const had = openRouterKey !== null;
  openRouterKey = null;
  if (had) notify();
}

/**
 * The connection the decision contract calls, or null. OpenRouter requests
 * go only to OpenRouter's Decisions API; local requests only to the same-origin
 * bridge route. A 401 means the key was revoked or expired, so it is dropped.
 */
export function getConnection() {
  if (local) {
    return {
      provider: KEV,
      request: init => fetch(KEV.url, { ...init, credentials: 'same-origin', cache: 'no-store' })
    };
  }
  if (!openRouterKey) return null;
  const key = openRouterKey;
  return {
    provider: JEV,
    request: async init => {
      const response = await fetch(JEV.url, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${key}` },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store'
      });
      if (response.status === 401 && openRouterKey === key) disconnect();
      return response;
    }
  };
}

/**
 * Local RISE only: ask the same-origin bridge whether pinned Kev is ready.
 * On the public site this route does not exist and the answer is "no".
 */
export async function detectLocalKev({ fetcher = fetch, signal } = {}) {
  let status = null;
  try {
    const response = await fetcher(LOCAL_STATUS_PATH, { credentials: 'same-origin', cache: 'no-store', signal });
    if (response.ok && (response.headers.get('content-type') || '').startsWith('application/json')) {
      status = await response.json();
    }
  } catch {
    status = null;
  }
  const ready = status?.rise === 'local' && status.kev?.state === 'ready' && status.kev.revision === KEV.revision;
  const next = ready ? { revision: status.kev.revision, device: typeof status.kev.device === 'string' ? status.kev.device.slice(0, 80) : null } : null;
  const changed = JSON.stringify(next) !== JSON.stringify(local);
  local = next;
  if (changed) notify();
  return { local: status?.rise === 'local', kev: status?.kev ?? null, ready };
}

export function postConnectionNotice(message, tone = 'info') {
  notice = { message, tone };
  notify();
}

/** The last connect outcome, handed to the first surface that shows it. */
export function takeConnectionNotice() {
  const value = notice;
  notice = null;
  return value;
}

// On local RISE, look for Kev as soon as any AI surface loads this module.
if (isLocalRise()) void detectLocalKev();

/** Test seam: forget everything. */
export function resetConnectionForTests() {
  openRouterKey = null;
  local = null;
  notice = null;
  listeners.clear();
}
