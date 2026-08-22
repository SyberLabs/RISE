/**
 * Chamber type size.
 *
 * S | M | L persist as small | medium | large — the old three steps.
 * Fit persists as fontSize: 'fit'. Only Word paint uses adaptive fit.
 * Phrase / sentence / paragraph ignore Fit and stay on the three steps.
 */

export const FONT_SIZE_CHIPS = Object.freeze([
    Object.freeze({ id: 's', fontSize: 'small', label: 'S' }),
    Object.freeze({ id: 'm', fontSize: 'medium', label: 'M' }),
    Object.freeze({ id: 'l', fontSize: 'large', label: 'L' }),
    Object.freeze({ id: 'fit', fontSize: 'fit', label: 'Fit' })
]);

export const DEFAULT_FONT_SIZE = 'medium';

/** Desktop Word at Large before Fit: 72px * sizeAtomScale(1). */
export const TODAY_WORD_LARGE_PX = 72;

/** Old Settings steps on the 72px / 96px base. Not a chamber fill. */
export const THREE_STEP_INTENT = Object.freeze({
    small: 0.82,
    medium: 1,
    large: 1.18
});

/** Fit uses this fraction of the usable chamber/band box. */
export const WORD_FIT_FILL = 0.88;

export const WORD_FIT_MIN_PX = 16;

/** Cap as a fraction of the smaller usable axis. */
export const WORD_FIT_MAX_PORTION = 0.95;

export const SIZE_HINT_FIT = 'Words fill the chamber.';
export const SIZE_HINT_WAIT = 'Fit waits for the chamber.';

const PERSIST = new Map(
    FONT_SIZE_CHIPS.flatMap((chip) => [
        [chip.id, chip.fontSize],
        [chip.fontSize, chip.fontSize]
    ])
);

/** Persist value if `id` is a chip id or an allowlisted fontSize, else null. */
export function persistFontSize(id) {
    return PERSIST.get(id) || null;
}

export function resolveFontSize(id) {
    return persistFontSize(id) || DEFAULT_FONT_SIZE;
}

export function isChamberWordFit(id) {
    return persistFontSize(id) === 'fit';
}

/** Three-step multiplier. Fit is ignored (medium). */
export function threeStepIntent(id) {
    const size = resolveFontSize(id);
    return size === 'fit' ? THREE_STEP_INTENT.medium : THREE_STEP_INTENT[size];
}

export function sizeFitHint(hasWordInk) {
    return hasWordInk ? SIZE_HINT_FIT : SIZE_HINT_WAIT;
}

/**
 * Fit a Word atom to the live chamber / atom-band box.
 * Returns null when the box or glyph cannot be measured (Fit waits).
 *
 * Box: caller passes #atom-band when it has a box, else #chamber-field.
 * Padding: subtracted from that box (atom-display padding).
 * px = measuredAt * min((usableW * 0.88) / glyphW, (usableH * 0.88) / glyphH)
 * clamp: 16px .. 0.95 * min(usableW, usableH)
 */
export function fitWordAtomPx({
    fieldWidth,
    fieldHeight,
    padX = 0,
    padY = 0,
    measuredWidth,
    measuredHeight,
    measuredAt = 100
} = {}) {
    const usableW = Number(fieldWidth) - Number(padX || 0);
    const usableH = Number(fieldHeight) - Number(padY || 0);
    const glyphW = Number(measuredWidth);
    const glyphH = Number(measuredHeight);
    const at = Number(measuredAt);

    if (!(usableW > 0) || !(usableH > 0) || !(glyphW > 0) || !(glyphH > 0) || !(at > 0)) {
        return null;
    }

    const px = at * Math.min(
        (usableW * WORD_FIT_FILL) / glyphW,
        (usableH * WORD_FIT_FILL) / glyphH
    );
    const cap = Math.min(usableW, usableH) * WORD_FIT_MAX_PORTION;
    return Math.max(WORD_FIT_MIN_PX, Math.min(px, cap));
}

/** Approximate a glyph box when canvas measureText is unavailable. */
export function estimateGlyphBox(text, atPx = 100) {
    const shown = typeof text === 'string' ? text : '';
    const at = Number(atPx) > 0 ? Number(atPx) : 100;
    return {
        width: Math.max(at * 0.35, shown.length * at * 0.6),
        height: at * 1.15
    };
}
