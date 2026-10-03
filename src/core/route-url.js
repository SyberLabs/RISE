/**
 * Every route has a path, declared once, here.
 *
 * A table of { id, pattern, build(data), parse(match) } rows and no regex
 * library. `pathForRoute` finds the first row for an id that can build;
 * `routeFromPath` finds the first row whose pattern matches. A row with
 * `build: null` is parse-only: an extra address that resolves to the room
 * but is never written by the router (the public Keystone paths, the sample
 * scene paths).
 *
 * Pattern segments starting with `:` capture a value; a trailing `?` makes
 * the segment optional. Transient data (a live session object, a Workshop
 * project, a recipe) is deliberately NOT carried: only what must survive a
 * reload is a path segment or a query parameter.
 *
 * Pure: no DOM, nothing from components or the app. Keep it light, since the
 * router imports it on first load. It does not know which Keystone slugs
 * exist; the app asks the manifest before it trusts a slug.
 */

import { KEYSTONE_ROUTE_PREFIX, TRY_RISE_PATH } from './keystone-paths.js';

export const VISUAL_LAB_PATH = '/visual-lab';
export const VISUAL_CATALOG_PATH = '/visual-catalog';
export const LIVE_PATH = '/live';
export const EMOTIONS_PATH = '/emotions';
export const TODAY_PATH = '/today';

/**
 * Old ids stay valid forever. Each right-hand side is the id the room has
 * today; later tasks flip entries as rooms merge.
 */
export const ROUTE_ALIASES = {
    portal: 'portal',
    keystones: 'keystones',
    mint: 'mint',
    vault: 'vault',
    chamber: 'chamber',
    'chamber-session': 'chamber-session',
    library: 'library',
    journeys: 'journeys',
    workshop: 'workshop',
    settings: 'settings',
    rosarium: 'rosarium',
    curia: 'curia',
    scriptorium: 'scriptorium',
    via: 'via',
    emotions: 'emotions',
    'visual-lab': 'visual-lab',
    'visual-catalog': 'visual-catalog',
    live: 'live',
    chapel: 'chapel',
    today: 'today'
};

const enc = encodeURIComponent;

function query(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : '';
}

function decode(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

function fixed(id, path, extra = {}) {
    return { id, pattern: path, build: () => path, parse: () => ({}), ...extra };
}

const ROUTES = [
    fixed('portal', '/'),
    { id: 'portal', pattern: '/jev-scene-demo', build: null, own: true, parse: () => ({ demoMode: true }) },
    { id: 'portal', pattern: '/night-drive', build: null, own: true, parse: () => ({ demoMode: true }) },

    {
        id: 'keystones',
        pattern: TRY_RISE_PATH,
        build: () => TRY_RISE_PATH,
        parse: () => ({})
    },
    {
        id: 'keystones',
        pattern: `${KEYSTONE_ROUTE_PREFIX}:slug`,
        build: null,
        parse: ({ slug }) => (slug ? { slug } : null)
    },
    fixed('keystones', '/library/keystones', { build: null }),

    fixed('chamber', '/read'),
    {
        id: 'chamber-session',
        pattern: '/read/session',
        // A reading opened from a public address (a Keystone, a minted
        // sequence) keeps that address; every other session is /read/session.
        build: data => (typeof data?.publicPath === 'string'
            && /^\/(?!\/)/u.test(data.publicPath) ? data.publicPath : '/read/session'),
        parse: () => ({})
    },

    fixed('library', '/library'),
    {
        id: 'chapel',
        pattern: '/library/chapel/:bookId?/:chapter?',
        build: (data) => {
            const chapter = Number(data?.chapter);
            if (!data?.bookId) return '/library/chapel';
            return Number.isInteger(chapter) && data.chapter !== null && data.chapter !== ''
                ? `/library/chapel/${enc(data.bookId)}/${chapter}`
                : `/library/chapel/${enc(data.bookId)}`;
        },
        parse: ({ bookId, chapter }) => {
            const data = {};
            if (bookId) data.bookId = bookId;
            if (chapter !== undefined) {
                const number = Number(chapter);
                if (!Number.isInteger(number)) return null;
                data.chapter = number;
            }
            return data;
        }
    },
    {
        id: 'rosarium',
        pattern: '/library/rosary',
        build: data => `/library/rosary${query({ set: data?.setId, icon: data?.iconId })}`,
        parse: (_m, search) => ({
            setId: search.get('set') || undefined,
            iconId: search.get('icon') || undefined
        })
    },
    fixed('via', '/library/stations'),
    fixed('journeys', '/library/journeys'),
    fixed('mint', '/library/mint'),
    fixed('today', TODAY_PATH),
    fixed('curia', '/library/provenance'),

    fixed('workshop', '/make/workshop'),
    {
        id: 'vault',
        pattern: '/make/vault',
        build: data => `/make/vault${query({ section: data?.section })}`,
        parse: (_m, search) => (search.get('section') ? { section: search.get('section') } : {})
    },
    fixed('scriptorium', '/make/scriptorium'),

    fixed('settings', '/settings'),
    fixed('emotions', EMOTIONS_PATH),
    fixed('visual-lab', VISUAL_LAB_PATH),
    {
        id: 'visual-catalog',
        pattern: VISUAL_CATALOG_PATH,
        build: data => `${VISUAL_CATALOG_PATH}${typeof data?.search === 'string' && data.search.startsWith('?') ? data.search : ''}`,
        parse: (_m, search) => ({ search: search.toString() ? `?${search.toString()}` : '' })
    },
    fixed('live', LIVE_PATH)
];

function segments(path) {
    return path.split('/').filter(Boolean);
}

/** Match `pathname` against a pattern; returns captured params or null. */
function match(pattern, pathname) {
    const want = segments(pattern);
    const have = segments(pathname);
    const params = {};
    for (let i = 0; i < want.length; i++) {
        const part = want[i];
        if (!part.startsWith(':')) {
            if (have[i] !== part) return null;
            continue;
        }
        const optional = part.endsWith('?');
        const name = part.slice(1, optional ? -1 : undefined);
        if (have[i] === undefined) {
            if (!optional) return null;
            continue;
        }
        const value = decode(have[i]);
        if (value === null) return null;
        params[name] = value;
    }
    return have.length > want.length ? null : params;
}

/** The address for a room, or null when the id has none. */
export function pathForRoute(id, data = {}) {
    const row = ROUTES.find(item => item.id === id && item.build);
    return row ? row.build(data || {}) : null;
}

/**
 * True when the address is a parse-only alias that IS this room's own
 * threshold (the sample scene paths are the Portal), so arriving at the room
 * leaves it alone instead of rewriting it to the canonical path.
 */
export function addressIsOwnTo(id, pathname) {
    return ROUTES.some(row => row.id === id && row.own === true && match(row.pattern, String(pathname || '/')));
}

/** The room an address names, as { id, data }, or null. */
export function routeFromPath(pathname, search = '') {
    const path = String(pathname || '/');
    const params = new URLSearchParams(search || '');
    for (const row of ROUTES) {
        const found = match(row.pattern, path);
        if (!found) continue;
        const data = row.parse(found, params);
        if (!data) continue;
        for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
        return { id: row.id, data };
    }
    return null;
}
