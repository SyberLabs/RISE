/**
 * SacredImage — reverent mounting for sacred works.
 *
 * The spec's rule: image failure becomes STILLNESS AND TEXT, never a
 * visibly wrong or broken image. An ordinary <img> degrades to the
 * browser's broken-image glyph; this mounting function instead:
 *
 *  - decodes the image fully BEFORE revealing it (no progressive
 *    half-paint of a crucifixion);
 *  - verifies the caller's liveness check after the decode (the
 *    devotional moment that authorized the mount must still exist);
 *  - on any failure, leaves the slot EMPTY — liturgical absence,
 *    not error chrome;
 *  - transitions in gently from a neutral state.
 *
 * @param {HTMLElement} slot - the container to mount into
 * @param {Object} work - { imageUrl, title, artist, attribution }
 * @param {Object} [options]
 *   - stillAlive: () => boolean — re-checked after the async decode;
 *     a false return abandons the mount silently
 *   - alt / title overrides
 * @returns {Promise<boolean>} true when the image was revealed
 */
export async function mountSacredImage(slot, work, options = {}) {
    if (!slot || !work?.imageUrl) return false;
    const stillAlive = typeof options.stillAlive === 'function'
        ? options.stillAlive
        : () => true;

    const img = new Image();
    img.decoding = 'async';
    img.alt = options.alt ?? work.title ?? '';
    const titleText = options.title
        ?? work.attribution
        ?? [work.title, work.artist].filter(Boolean).join(' — ');
    if (titleText) img.title = titleText;

    try {
        img.src = work.imageUrl;
        await img.decode();
    } catch {
        // Reverent degradation: the slot stays as it was — absence,
        // never a broken-image glyph
        return false;
    }

    if (!stillAlive() || !slot.isConnected) return false;

    img.style.opacity = '0';
    img.style.transition = 'opacity 400ms ease-out';
    slot.replaceChildren(img);
    // reveal on the next frame so the transition runs
    requestAnimationFrame(() => { img.style.opacity = '1'; });
    return true;
}
