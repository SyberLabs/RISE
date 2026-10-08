/**
 * Shipped stills for engines too expensive (or unable) to draw in the
 * Navigator. The register IS the list of pictures, so an engine cannot be
 * withheld from live drawing without something to show in its place.
 *
 * Built by scripts/build-engine-stills.mjs from the engines' own output.
 */
export const SHIPPED_STILLS = new Map([
    ['fractal', 'fractal.webp'],
    ['ostensoria', 'ostensoria.webp'],
    ['apparitio', 'apparitio.webp'],
    ['attractor', 'attractor.webp']
]);

/**
 * Absolute, because safeUrl admits no relative path, and resolved against the
 * document's base rather than the window's origin: inside a host's card the
 * window's origin is opaque ("null") while the base is RISE's (mcp-card.js).
 */
export function shippedStill(file) {
    if (typeof document === 'undefined') return null;
    try {
        return new URL(`engine-stills/${file}`, document.baseURI).href;
    } catch {
        return null;
    }
}

export function shippedStillUrl(type) {
    const file = SHIPPED_STILLS.get(type);
    return file ? shippedStill(file) : null;
}
