/**
 * The public entry path of a minted sequence, and nothing else.
 *
 * Two string operations with no dependencies, for the reason
 * `keystone-paths.js` exists: anything that only needs to ask "is this a
 * program URL?" must not pull the register — and through it the Archive,
 * the compiler and the voice packs — into its bundle.
 *
 * Deciding whether a slug was actually minted stays with the register,
 * which is the only thing that knows.
 */

export const PROGRAM_ROUTE_PREFIX = '/p/';

/**
 * A SLUG BECOMES PART OF A FETCH PATH, so its shape is decided here rather
 * than trusted from the address bar. The register is an allowlist and would
 * refuse a traversal on its own; this refuses it one step earlier, while
 * the thing is still a string and before anything has been asked for.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function programPath(slug) {
    return `${PROGRAM_ROUTE_PREFIX}${String(slug || '').trim().toLowerCase()}`;
}

/**
 * The slug this path carries, if it carries one that could exist.
 *
 * Says nothing about whether it was minted — only that asking the register
 * is worth doing. A malformed percent-escape is not a slug; decodeURIComponent
 * throws on one, and a throw here would take out the whole boot path.
 */
export function programSlugShape(pathname) {
    const path = String(pathname || '').replace(/\/+$/u, '');
    if (!path.startsWith(PROGRAM_ROUTE_PREFIX)) return null;
    let slug;
    try {
        slug = decodeURIComponent(path.slice(PROGRAM_ROUTE_PREFIX.length));
    } catch {
        return null;
    }
    return SLUG.test(slug) ? slug : null;
}
