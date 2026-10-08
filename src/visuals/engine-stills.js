/**
 * Shipped stills for engines too expensive (or unable) to draw in the
 * Navigator. The register IS the list of pictures, so an engine cannot be
 * withheld from live drawing without something to show in its place.
 *
 * Built by scripts/build-engine-stills.mjs from the engines' own output.
 */
import { siteUrl } from '../core/embed-address.js';

export const SHIPPED_STILLS = new Map([
    ['fractal', 'fractal.webp'],
    ['ostensoria', 'ostensoria.webp'],
    ['apparitio', 'apparitio.webp'],
    ['attractor', 'attractor.webp']
]);

/**
 * Absolute, because safeUrl admits no relative path, and RISE's own address
 * even inside a host's card, where the document's base is the host's (siteUrl).
 */
export function shippedStill(file) {
    if (typeof location === 'undefined') return null;
    try {
        return new URL(siteUrl(`/engine-stills/${file}`), location.origin + '/').href;
    } catch {
        return null;
    }
}

export function shippedStillUrl(type) {
    const file = SHIPPED_STILLS.get(type);
    return file ? shippedStill(file) : null;
}
