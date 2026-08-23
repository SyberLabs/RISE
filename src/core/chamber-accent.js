/**
 * Chamber chrome accent allowlist. A token family, not a visualMode.
 * Unknown or empty ids fall back to purple.
 *
 *   purple → current --color-threshold
 *   cobalt → deep blue
 *   amber  → gold
 *   sunset → orange
 *   gecko  → green
 */

export const CHAMBER_ACCENTS = Object.freeze([
    Object.freeze({ id: 'purple', label: 'Purple' }),
    Object.freeze({ id: 'cobalt', label: 'Cobalt Blue' }),
    Object.freeze({ id: 'amber', label: 'Amber Gold' }),
    Object.freeze({ id: 'sunset', label: 'Sunset Orange' }),
    Object.freeze({ id: 'gecko', label: 'Gecko Green' })
]);

export const DEFAULT_CHAMBER_ACCENT = 'purple';

/**
 * Token set that replaces the purple chrome accent (--color-threshold / its
 * rgb triple) on Portal chrome, PREP orb marks, live-bar hover, and the
 * Settings selected underline. Reading field, words, and gallery stay on
 * the static threshold token.
 */
export const CHAMBER_ACCENT_TOKENS = Object.freeze({
    purple: Object.freeze({
        '--color-accent': '#8B7FD4',
        '--color-accent-rgb': '139, 127, 212'
    }),
    cobalt: Object.freeze({
        '--color-accent': '#3A5FA8',
        '--color-accent-rgb': '58, 95, 168'
    }),
    amber: Object.freeze({
        '--color-accent': '#C9A24A',
        '--color-accent-rgb': '201, 162, 74'
    }),
    sunset: Object.freeze({
        '--color-accent': '#D4783A',
        '--color-accent-rgb': '212, 120, 58'
    }),
    gecko: Object.freeze({
        '--color-accent': '#4F9A5C',
        '--color-accent-rgb': '79, 154, 92'
    })
});

const ALLOWED = new Set(CHAMBER_ACCENTS.map((accent) => accent.id));

/** Persist value if `id` is allowlisted, else null. */
export function persistChamberAccent(id) {
    return ALLOWED.has(id) ? id : null;
}

export function resolveChamberAccent(id) {
    return persistChamberAccent(id) || DEFAULT_CHAMBER_ACCENT;
}

/**
 * Stamp `data-accent` on the root so CSS variables swap.
 * Returns false when the stamp does not take; caller stays Purple.
 */
export function applyChamberAccent(root, id) {
    if (!root?.dataset) return false;
    const resolved = resolveChamberAccent(id);
    root.dataset.accent = resolved;
    return root.dataset.accent === resolved;
}
