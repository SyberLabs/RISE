/**
 * Where the reading band sits, as a fraction of the travel available.
 *
 * A fraction rather than pixels because the same reader meets the same
 * reading on a phone and on a monitor, and "a third of the way up"
 * survives that change where "160px" does not.
 */

/** Beyond this the band leaves the field it is centred in. */
export const BAND_OFFSET_LIMIT = 1;

export const BAND_OFFSET_SETTING = 'bandOffset';

export function clampBandFraction(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-BAND_OFFSET_LIMIT, Math.min(BAND_OFFSET_LIMIT, n));
}

/**
 * Half the room the band has inside its field, in px.
 *
 * The field centres the band, so the distance to either edge is the same
 * and equals half of what is left when the band's own height is taken
 * out. A band taller than its field has no room at all — measuring it as
 * negative would let it be dragged inside out.
 */
export function bandTravelPx(field, band) {
    const fieldHeight = field?.clientHeight ?? 0;
    const bandHeight = band?.offsetHeight ?? 0;
    return Math.max(0, (fieldHeight - bandHeight) / 2);
}

export function readBandOffsetSetting(settings = globalThis.rise?.settings) {
    return clampBandFraction(settings?.[BAND_OFFSET_SETTING] ?? 0);
}

/**
 * Persist through the app's own settings path when there is one, so the
 * value is validated and written exactly like every other preference.
 */
export function writeBandOffsetSetting(fraction, rise = globalThis.rise) {
    const value = clampBandFraction(fraction);
    if (typeof rise?.handleSettingsChange === 'function') {
        rise.handleSettingsChange(BAND_OFFSET_SETTING, value);
    } else if (rise?.settings) {
        rise.settings[BAND_OFFSET_SETTING] = value;
    }
    return value;
}
