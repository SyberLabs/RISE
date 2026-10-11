/** Callback credentials live in memory only, never router data or browser storage. */
let pending = null;
export function capturePlusCallback() {
  const { pathname, search, hash } = window.location;
  const path = pathname.replace(/\/$/u, '');
  if (path !== '/plus/claim' && path !== '/plus/restore') return;
  pending = path.endsWith('/claim')
    ? { kind: 'claim', value: new URLSearchParams(search).get('session_id') }
    : { kind: 'restore', value: new URLSearchParams(hash.slice(1)).get('token') };
  window.history.replaceState({}, '', '/plus/');
}
export function takePlusCallback() {
  const callback = pending;
  pending = null;
  return callback;
}
