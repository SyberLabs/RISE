/**
 * One policy for every remote image RISE loads.
 *
 * THE REFERRER IS NOT SENT. A browser's default
 * `strict-origin-when-cross-origin` attaches the reader's page origin to
 * every image request, so a museum's servers learn which RISE deployment
 * — and in development, which machine — a reader is reading on. Nothing
 * about serving a public-domain painting needs that, and the reader did
 * not ask for it to be shared.
 *
 * IT IS ALSO A CORRECTNESS FIX, and that is how it was found. The Art
 * Institute's edge rejects any request whose `Referer` is a loopback
 * address: measured 2026-08-05, `http://localhost:5173/` and
 * `http://127.0.0.1:5173/` both return **403** while no referrer,
 * `http://example.com/` and the production origin all return 200. No
 * other host in the corpus does this — Cleveland, Rijksmuseum, OCLC,
 * ESA/Hubble and NASA are all indifferent.
 *
 * The visible symptom was a black Chamber on `aic-ukiyoe`, because that
 * is the only category with no institution but the AIC to fall back on.
 * Old Masters degraded quietly instead, its 95 Rijksmuseum and 53
 * Cleveland pins carrying the pool while a third of it failed — which is
 * why the fault read as flaky rather than as a rule.
 *
 * `no-referrer` satisfies both concerns with one attribute, and it must
 * be applied in ONE place: a policy that lives at seven call sites is a
 * vocabulary in seven places, and this codebase's recurring failure is
 * exactly that shape — only one copy ever learns the new word.
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
