/** One decision route and one single-use handoff for experimental invocation skins. */
const HANDOFF_KEY = 'rise:invocation-handoff:v1';
const ACTIONS = new Set(['dock', 'adjust']);

export async function requestComposedReading(intent, { fetchImpl = fetch, admit } = {}) {
  if (typeof intent !== 'string' || intent.trim().length < 3 || intent.trim().length > 240) {
    throw new TypeError('Describe a destination in 3 to 240 characters.');
  }
  const response = await fetchImpl('/api/jev-recommend', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: intent.trim(), schemaVersion: 3 })
  });
  const decision = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(decision?.error?.message || 'RISE is unavailable.');
  // The Worker produces a versioned plan. Check its envelope for presentation;
  // the app's release/selector gate runs again before either destination.
  if (admit) admit(decision);
  else if (decision?.schemaVersion !== 2 || typeof decision.workId !== 'string'
    || !decision.workId || !decision.config || typeof decision.config !== 'object') {
    throw new TypeError('RISE returned an invalid destination.');
  }
  return decision;
}

export function saveInvocationHandoff(decision, action) {
  if (!ACTIONS.has(action)) throw new TypeError('Unknown destination action.');
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ decision, action }));
}

export function takeInvocationHandoff() {
  let raw;
  try {
    raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return ACTIONS.has(value?.action) && value.decision && typeof value.decision === 'object'
      ? { action: value.action, decision: value.decision } : null;
  } catch {
    return null;
  }
}

/**
 * The app owns both destinations; a skin never compiles or starts a session.
 * `launch` plays the reading, `adjust` opens it in Reader Setup; Home's own
 * ENTER and ADJUST are the same two operations.
 */
export async function openInvocationDecision({ decision, action }, { launch, adjust }) {
  if (action === 'dock') return launch(decision);
  if (action !== 'adjust') throw new TypeError('Unknown destination action.');
  return adjust(decision);
}
