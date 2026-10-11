/** Explicit own-text upgrade handoff. This tab only; no token or remote upload. */
const KEY = 'rise.plus.continuation';
export function savePlusContinuation(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 5000) return false;
  try { sessionStorage.setItem(KEY, JSON.stringify({ schema: 1, text, look: 'sample' })); return true; } catch { return false; }
}
export function readPlusContinuation() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY));
    return draft?.schema === 1 && draft.look === 'sample' && typeof draft.text === 'string'
      && draft.text.trim() && draft.text.length <= 5000 ? draft : null;
  } catch { return null; }
}
export function takePlusContinuation() {
  const draft = readPlusContinuation();
  try { sessionStorage.removeItem(KEY); } catch { /* The draft still remains local. */ }
  return draft;
}
