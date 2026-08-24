/**
 * Chamber chrome accent allowlist. A token family, not a visualMode.
 *
 * Slate is the ground state (bare :root, no data-accent); every other id is a
 * colourway that dresses the Portal cluster in a dark tint of its hue.
 *
 *   slate  → the neutral default (cool tiles, ivory only on the edge)
 *   ivory  → warm cream (a warm slate, not a pale button)
 *   purple → Amethyst      cobalt → deep blue      amber → gold
 *   sunset → orange        gecko  → Jade
 *   garnet → deep rose      teal → deep sea         orchid → soft magenta
 */

export const CHAMBER_ACCENTS = Object.freeze([
    Object.freeze({ id: 'slate', label: 'Slate' }),
    Object.freeze({ id: 'ivory', label: 'Ivory' }),
    Object.freeze({ id: 'purple', label: 'Amethyst' }),
    Object.freeze({ id: 'cobalt', label: 'Cobalt' }),
    Object.freeze({ id: 'amber', label: 'Amber' }),
    Object.freeze({ id: 'sunset', label: 'Sunset' }),
    Object.freeze({ id: 'gecko', label: 'Jade' }),
    Object.freeze({ id: 'garnet', label: 'Garnet' }),
    Object.freeze({ id: 'teal', label: 'Teal' }),
    Object.freeze({ id: 'orchid', label: 'Orchid' })
]);

/**
 * SLATE IS THE GROUND STATE, NOT A COLOURWAY. It is the neutral cluster the
 * Portal has always worn — cool tiles, ivory only on the hero's edge — and it
 * is the BARE :root: choosing it stamps no `data-accent`. So slate is on the
 * allowlist (a reader may pick it, and unknown ids resolve to it) but has no
 * token block below and is never written as an attribute — see
 * applyChamberAccent. The button-surface tokens for slate live in :root;
 * every other sitting's are derived under :root[data-accent].
 */
export const DEFAULT_CHAMBER_ACCENT = 'slate';

/**
 * Token set stamped on :root[data-accent]. --color-threshold follows
 * --color-accent so chrome that still names the old token does not keep a
 * retired hue; --color-on-accent is the ink that stays legible on a full
 * accent fill, chosen per family by WCAG contrast (only cobalt is dark enough
 * for light ink). Refined toward premium jewel tones; three sittings added.
 * No `slate` key — slate is the bare :root, not a stamped colourway.
 */
export const CHAMBER_ACCENT_TOKENS = Object.freeze({
    ivory: Object.freeze({
        '--color-accent': '#E4D2AE',
        '--color-accent-rgb': '228, 210, 174',
        '--color-threshold': '#E4D2AE',
        '--color-on-accent': '#0A0A0C'
    }),
    purple: Object.freeze({
        '--color-accent': '#9C86DB',
        '--color-accent-rgb': '156, 134, 219',
        '--color-threshold': '#9C86DB',
        '--color-on-accent': '#0A0A0C'
    }),
    cobalt: Object.freeze({
        '--color-accent': '#3C61AA',
        '--color-accent-rgb': '60, 97, 170',
        '--color-threshold': '#3C61AA',
        '--color-on-accent': '#E8E8EC'
    }),
    amber: Object.freeze({
        '--color-accent': '#D2A64F',
        '--color-accent-rgb': '210, 166, 79',
        '--color-threshold': '#D2A64F',
        '--color-on-accent': '#0A0A0C'
    }),
    sunset: Object.freeze({
        '--color-accent': '#D9793F',
        '--color-accent-rgb': '217, 121, 63',
        '--color-threshold': '#D9793F',
        '--color-on-accent': '#0A0A0C'
    }),
    gecko: Object.freeze({
        '--color-accent': '#57A46E',
        '--color-accent-rgb': '87, 164, 110',
        '--color-threshold': '#57A46E',
        '--color-on-accent': '#0A0A0C'
    }),
    garnet: Object.freeze({
        '--color-accent': '#C56A7B',
        '--color-accent-rgb': '197, 106, 123',
        '--color-threshold': '#C56A7B',
        '--color-on-accent': '#0A0A0C'
    }),
    teal: Object.freeze({
        '--color-accent': '#3E9C93',
        '--color-accent-rgb': '62, 156, 147',
        '--color-threshold': '#3E9C93',
        '--color-on-accent': '#0A0A0C'
    }),
    orchid: Object.freeze({
        '--color-accent': '#BE7ACB',
        '--color-accent-rgb': '190, 122, 203',
        '--color-threshold': '#BE7ACB',
        '--color-on-accent': '#0A0A0C'
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
 *
 * Slate is the absence of the attribute, not a value of it: a `data-accent`
 * of any kind triggers the full-colourway rule, so slate must clear it to
 * fall back to the neutral :root tiles. Returns whether the root ended in the
 * state the resolved id asks for.
 */
export function applyChamberAccent(root, id) {
    if (!root?.dataset) return false;
    const resolved = resolveChamberAccent(id);
    if (resolved === 'slate') {
        delete root.dataset.accent;
        return root.dataset.accent === undefined;
    }
    root.dataset.accent = resolved;
    return root.dataset.accent === resolved;
}
