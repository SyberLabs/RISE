import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

/**
 * The offset is a fraction; what the field needs is pixels. Turning one
 * into the other needs a laid-out stage, and the conversion used to
 * happen once when the listeners were attached and then only on drag and
 * on window resize.
 *
 * Two things were wrong with that. A stage with no geometry yet reports
 * zero travel, so an authored offset became 0px and stayed there — which
 * is exactly what a keystone that states a position and opens straight
 * into a reading would get. And travel is (fieldHeight - bandHeight) / 2,
 * which moves with every phrase: one line and three lines are different
 * bands, so a figure computed for the first is already stale for the
 * second.
 */
const stage = ({ fieldHeight, bandHeight, fraction }) => {
    const setProperty = vi.fn();
    const field = { clientHeight: fieldHeight, style: { setProperty } };
    const band = { offsetHeight: bandHeight };
    return {
        setProperty,
        ctx: {
            container: {
                querySelector: sel => (sel === '#chamber-field' ? field
                    : sel === '#atom-display' ? band : null)
            },
            _bandOffsetFraction: fraction,
            _destroyed: false,
            syncFillGlyphMask: () => {},
            // The retry calls back through the instance.
            applyBandOffset: Chamber.prototype.applyBandOffset
        }
    };
};

const apply = ctx => Chamber.prototype.applyBandOffset.call(ctx);

afterEach(() => { vi.unstubAllGlobals(); });

describe('turning the band fraction into pixels', () => {
    it('lifts the band by its share of the travel available', () => {
        // Measured geometry from a 390x844 phone: an 85px band in an
        // 844px field has 379px of travel either way.
        const { ctx, setProperty } = stage({
            fieldHeight: 844, bandHeight: 85, fraction: -0.35
        });

        apply(ctx);

        expect(setProperty).toHaveBeenCalledWith('--band-offset', '-133px');
    });

    it('gives a taller band a smaller lift, so the fraction still means the same thing', () => {
        // A three-line phrase has less room to move in, and the same
        // fraction has to respect that or the band walks up the screen as
        // the phrases lengthen.
        const one = stage({ fieldHeight: 844, bandHeight: 85, fraction: -0.35 });
        const three = stage({ fieldHeight: 844, bandHeight: 175, fraction: -0.35 });

        apply(one.ctx);
        apply(three.ctx);

        const px = call => Math.abs(parseInt(call.mock.calls[0][1], 10));
        expect(px(three.setProperty)).toBeLessThan(px(one.setProperty));
    });

    it('waits for a frame rather than writing a position it cannot compute', () => {
        // NO ROOM IS NOT THE SAME FACT AS NO OFFSET. A stage that has not
        // been laid out reports zero travel, and multiplying by it writes
        // 0px — indistinguishable from a reader who wanted the band
        // centred, and permanent, because nothing recomputed it.
        const frames = [];
        vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return 1; });
        const { ctx, setProperty } = stage({
            fieldHeight: 0, bandHeight: 0, fraction: -0.35
        });

        apply(ctx);

        expect(setProperty).not.toHaveBeenCalled();
        expect(frames).toHaveLength(1);

        // And when the geometry arrives, the fraction has not gone anywhere.
        ctx.container.querySelector('#chamber-field').clientHeight = 844;
        ctx.container.querySelector('#atom-display').offsetHeight = 85;
        frames[0]();

        expect(setProperty).toHaveBeenCalledWith('--band-offset', '-133px');
    });

    it('asks for only one frame while it is waiting', () => {
        const frames = [];
        vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return 1; });
        const { ctx } = stage({ fieldHeight: 0, bandHeight: 0, fraction: -0.35 });

        apply(ctx);
        apply(ctx);
        apply(ctx);

        expect(frames).toHaveLength(1);
    });

    it('centres the band when nothing was asked for', () => {
        const { ctx, setProperty } = stage({
            fieldHeight: 844, bandHeight: 85, fraction: 0
        });

        apply(ctx);

        expect(setProperty).toHaveBeenCalledWith('--band-offset', '0px');
    });
});
