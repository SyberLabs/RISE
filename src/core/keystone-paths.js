/**
 * The public entry paths of the release corridor, and nothing else.
 *
 * These are two string operations with no dependencies, and they used to
 * live in `keystones.js` — which statically imports the Archive, the
 * museum pins, the session compiler and the voice packs. Anything that
 * only needed to ask "is this a try-rise URL?" had to either pull all of
 * that into its bundle or reach for a dynamic import on a synchronous
 * path. `keystones.js` re-exports these, so nothing that already imports
 * them from there has to know they moved.
 *
 * `keystoneSlugFromPath` deliberately stayed behind: it answers only for
 * slugs that are really in the manifest, and that answer needs the
 * manifest.
 */

export const KEYSTONE_ROUTE_PREFIX = '/keystone/';
export const TRY_RISE_PATH = '/try-rise';

export function keystonePath(slug) {
    return `${KEYSTONE_ROUTE_PREFIX}${String(slug || '').trim().toLowerCase()}`;
}

export function isTryRisePath(pathname) {
    return String(pathname || '').replace(/\/+$/u, '') === TRY_RISE_PATH;
}
