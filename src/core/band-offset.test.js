/**
 * The band's position is a reader's preference, held as a fraction.
 */
import { describe, expect, it } from 'vitest';
import {
    BAND_OFFSET_LIMIT,
    bandTravelPx,
    clampBandFraction,
    clampFootFraction,
    footTravelPx,
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

    it('writes through an explicit settings callback', () => {
        const calls = [];
        expect(writeBandOffsetSetting(0.3, (key, value) => calls.push([key, value]))).toBe(0.3);
        expect(calls).toEqual([['bandOffset', 0.3]]);
    });

    it('never persists a value the reader could not have reached', () => {
        const calls = [];
        writeBandOffsetSetting(12, (key, value) => calls.push([key, value]));
        expect(calls).toEqual([['bandOffset', BAND_OFFSET_LIMIT]]);
    });
});

describe('a band resting at the field’s foot (a card on a phone with a picture above the words)', () => {
    it('rises from where it rests to 8 px under the field’s top edge, whatever it is lifted by now', () => {
        // Resting at 270 in a field whose top is 10: 252 px of room above it.
        expect(footTravelPx({ fieldTop: 10, wordsTop: 270, offsetPx: 0 })).toBe(252);
        // The same band already lifted 100 px is the same rest and the same room.
        expect(footTravelPx({ fieldTop: 10, wordsTop: 170, offsetPx: -100 })).toBe(252);
        // A band with no room above it has none, never a negative room.
        expect(footTravelPx({ fieldTop: 10, wordsTop: 12, offsetPx: 0 })).toBe(0);
    });

    it('moves only up: its foot is where it rests, never below', () => {
        expect(clampFootFraction(0.5)).toBe(0);
        expect(clampFootFraction(-0.4)).toBe(-0.4);
        expect(clampFootFraction(-3)).toBe(-1);
        expect(clampFootFraction('x')).toBe(0);
    });
});
