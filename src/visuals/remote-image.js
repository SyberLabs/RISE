/**
 * One referrer policy for every remote image: no-referrer.
 * Avoids leaking the reader's origin; also required for hosts that
 * reject loopback Referer. Apply in one place before assigning src.
 */

export const REMOTE_IMAGE_REFERRER_POLICY = 'no-referrer';

/**
 * Apply the policy to an `Image` (or any element with referrerPolicy).
 * Call BEFORE assigning `src`: the attribute governs the request, and a
 * src set first may already be in flight.
 *
 * @param {HTMLImageElement} img
 * @returns {HTMLImageElement} the same element, for chaining
 */
export function asRemoteImage(img) {
    if (img) img.referrerPolicy = REMOTE_IMAGE_REFERRER_POLICY;
    return img;
}

/** A new `Image` already carrying the policy. */
export function createRemoteImage() {
    return asRemoteImage(new Image());
}

/**
 * The attribute pair for an `<img>` written into an innerHTML template.
 * Interpolated as-is; it contains no untrusted input.
 */
export const REMOTE_IMAGE_ATTRS = `referrerpolicy="${REMOTE_IMAGE_REFERRER_POLICY}"`;
