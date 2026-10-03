/**
 * Whether two route data objects say the same thing. Key order does not
 * count: `{ a, b }` and `{ b, a }` are one address. Missing data is `{}`.
 * Data that cannot be serialized is the same only as itself. A `session`
 * key is compared by identity, never serialized.
 */
export function sameData(a, b) {
  if (a === b) return true;
  // A reading's session is known by identity and never serialized: it can
  // run to megabytes, and two readings of one text are still two readings.
  if (a?.session !== b?.session) return false;
  try {
    if (a?.session) return stable(withoutSession(a)) === stable(withoutSession(b));
    return stable(a ?? {}) === stable(b ?? {});
  } catch {
    return false;
  }
}

function withoutSession({ session: _session, ...rest }) {
  return rest;
}

function stable(value) {
  return JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item));
}
