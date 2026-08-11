/**
 * The band's position is a reader's preference, held as a fraction.
 */
import { describe, expect, it } from 'vitest';
import {
    BAND_OFFSET_LIMIT,
    bandTravelPx,
    clampBandFraction,
    readBandOffsetSetting,
    writeBandOffsetSetting
} from './band-offset.js';

describe('the offset stays inside the field', () => {
    it('clamps beyond the limit rather than letting the band leave', () => {
        expect(clampBandFraction(5)).toBe(BAND_OFFSET_LIMIT);
        expect(clampBandFraction(-5)).toBe(-BAND_OFFSET_LIMIT);
        expect(clampBandFraction(0.4)).toBe(0.4);
    });

    it('treats anything unreadable as centred', () => {
        for (const bad of [undefined, null, NaN, Infinity, 'up', {}]) {
            expect(clampBandFraction(bad), String(bad)).toBe(0);
        }
    });
});

describe('travel is what the field has left over', () => {
    const el = (h, prop) => ({ [prop]: h });

    it('is half the room remaining once the band is taken out', () => {
        expect(bandTravelPx(el(800, 'clientHeight'), el(200, 'offsetHeight'))).toBe(300);
    });

    it('is zero when the band fills its field, never negative', () => {
        // A negative travel would invert the drag: pulling down would
        // send the band up.
        expect(bandTravelPx(el(300, 'clientHeight'), el(400, 'offsetHeight'))).toBe(0);
        expect(bandTravelPx(null, null)).toBe(0);
    });
});

describe('the preference is read and written like the others', () => {
    it('reads a stored fraction, clamped', () => {
        expect(readBandOffsetSetting({ bandOffset: 0.25 })).toBe(0.25);
        expect(readBandOffsetSetting({ bandOffset: 99 })).toBe(BAND_OFFSET_LIMIT);
        expect(readBandOffsetSetting({})).toBe(0);
        expect(readBandOffsetSetting(undefined)).toBe(0);
    });

    it('writes through the app settings path when there is one', () => {
        const calls = [];
        const rise = { settings: {}, handleSettingsChange: (k, v) => calls.push([k, v]) };
        expect(writeBandOffsetSetting(0.3, rise)).toBe(0.3);
        expect(calls).toEqual([['bandOffset', 0.3]]);
    });

    it('falls back to the settings object when no handler exists', () => {
        const rise = { settings: {} };
        writeBandOffsetSetting(-0.2, rise);
        expect(rise.settings.bandOffset).toBe(-0.2);
    });

    it('never persists a value the reader could not have reached', () => {
        const rise = { settings: {} };
        writeBandOffsetSetting(12, rise);
        expect(rise.settings.bandOffset).toBe(BAND_OFFSET_LIMIT);
    });
});
