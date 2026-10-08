/**
 * The page's chrome in the colours of the reading on screen (FND-008, B2b).
 *
 * While a themed reading is mounted, `<html>` takes its theme's accent, so what
 * is drawn outside the Chamber (Settings opened mid-reading, anything on the
 * body) is in the reading's colours; without one, the root keeps its ground
 * state. The nine themes are the only colours a reader sees: there is no
 * accent of the reader's own.
 *
 * One reading owns the root at a time. The Chamber that was showing is torn
 * down after the next has painted, and must not take the newcomer's colours
 * with it. Every theme's accent holds the ground state's dark ink
 * (`--color-on-accent`) at 6.6:1 or better, so the ink is never painted.
 */

const TOKENS = ['--color-accent', '--color-accent-rgb', '--color-threshold'];
let owner = null;

/** Paint `accent` (#rrggbb) on `root` for `who`, which then owns it. */
export function paintChromeTheme(root, accent, who) {
    const rgb = [1, 3, 5].map(at => parseInt(accent.slice(at, at + 2), 16)).join(', ');
    owner = who;
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-accent-rgb', rgb);
    root.style.setProperty('--color-threshold', accent);
}

/** Give the root back to its ground state, if `who` is the one that painted it. */
export function clearChromeTheme(root, who) {
    if (owner !== who) return;
    owner = null;
    for (const name of TOKENS) root.style.removeProperty(name);
}
