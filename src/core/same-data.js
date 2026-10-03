/**
 * Whether two route data objects say the same thing. Key order does not
 * count: `{ a, b }` and `{ b, a }` are one address. Missing data is `{}`.
 * Data that cannot be serialized is the same only as itself.
 */
export function sameData(a, b) {
  if (a === b) return true;
  try {
    return stable(a ?? {}) === stable(b ?? {});
  } catch {
    return false;
  }
}

function stable(value) {
  return JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item));
}
