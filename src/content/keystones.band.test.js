import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEYSTONE_MANIFESTS, keystoneManifest } from './keystones.js';
import { sessionPresentation } from '../core/session-presentation.js';
import { BAND_OFFSET_LIMIT } from '../core/band-offset.js';

/**
 * Measured in the reading on a 390x844 phone, against the real field.
 *
 * Both were centred, and centred is where the field is doing its work:
 * Metamorphoses' attractor has its luminous core at 46-59% of the
 * height, and Waldmuller's Prater Landscape puts its tree line — the
 * picture's subject — across the middle third. A centred band covers
 * exactly that in both.
 *
 * They differ in whether the monitor has the same problem. The attractor
 * is drawn into the field it is given, so a wide field makes a broad,
 * shallow form a centred band never troubled; the painting is
 * letterboxed into whatever field it gets, so its sky is its sky at any
 * width.
 */
const bySlug = slug => keystoneManifest(slug);

/** A renderer that is, or is not, a phone. */
const onScreen = (phone) => vi.stubGlobal('window', {
    matchMedia: query => ({ matches: phone && query.includes('640px') })
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('where the reading band sits in the phrase demos', () => {
    it('lifts Metamorphoses on a phone and leaves it centred on a monitor', () => {
        // The composition this piece was made in is the wide one, and a
        // centred band has always sat correctly against it.
        const declared = bySlug('metamorphoses').presentation;

        onScreen(true);
        expect(sessionPresentation({ presentation: declared })?.bandOffset).toBe(-0.75);

        onScreen(false);
        expect(sessionPresentation({ presentation: declared })?.bandOffset).toBe(0);
    });

    it('puts Tintern in the same place on both', () => {
        const declared = bySlug('tintern').presentation;

        onScreen(true);
        expect(sessionPresentation({ presentation: declared })?.bandOffset).toBe(-0.25);

        onScreen(false);
        expect(sessionPresentation({ presentation: declared })?.bandOffset).toBe(-0.25);
    });

    it('treats a renderer with no matchMedia as not a phone', () => {
        // A build tool or a test is not being held in a hand, and should
        // get the composition the wide screen gets.
        vi.stubGlobal('window', {});
        expect(sessionPresentation({
            presentation: bySlug('metamorphoses').presentation
        })?.bandOffset).toBe(0);
    });

    it('lifts the band rather than dropping it', () => {
        // Negative is up: the drag handler adds a downward pointer delta
        // to the fraction, so a band that should be higher is a smaller
        // number. Backwards would put the text under the picture.
        onScreen(true);
        for (const slug of ['metamorphoses', 'tintern']) {
            const offset = sessionPresentation({
                presentation: bySlug(slug).presentation
            }).bandOffset;
            expect(offset, slug).toBeLessThan(0);
            expect(offset, slug).toBeGreaterThan(-BAND_OFFSET_LIMIT);
        }
    });

    it('lifts Metamorphoses further than Tintern on a phone', () => {
        onScreen(true);
        const lift = slug => sessionPresentation({
            presentation: bySlug(slug).presentation
        }).bandOffset;
        expect(lift('metamorphoses')).toBeLessThan(lift('tintern'));
    });

    it('leaves every other keystone to the reader', () => {
        // A default is the reader's to set. Only the two phrase demos
        // were measured, so only they state a position.
        const stated = KEYSTONE_MANIFESTS
            .filter(k => k.presentation?.bandOffset != null)
            .map(k => k.slug)
            .sort();
        expect(stated).toEqual(['metamorphoses', 'tintern']);
    });
});

describe('a band position declared per screen', () => {
    const claim = declared => sessionPresentation({
        presentation: { bandOffset: declared }
    })?.bandOffset;

    it('accepts a bare number for every screen', () => {
        onScreen(true);
        expect(claim(-0.4)).toBe(-0.4);
        onScreen(false);
        expect(claim(-0.4)).toBe(-0.4);
    });

    it('falls to default for a screen it does not name', () => {
        onScreen(false);
        expect(claim({ phone: -0.75, default: 0 })).toBe(0);
    });

    it('claims nothing when the object names nothing usable', () => {
        onScreen(false);
        expect(claim({ phone: -0.75 })).toBeUndefined();
        expect(claim({})).toBeUndefined();
    });

    it('clamps whatever it is given', () => {
        onScreen(true);
        expect(claim({ phone: -4, default: 0 })).toBe(-BAND_OFFSET_LIMIT);
    });

    it('ignores a shape it cannot read', () => {
        onScreen(true);
        expect(claim([-0.75])).toBeUndefined();
        expect(claim('high')).toBeUndefined();
    });
});
