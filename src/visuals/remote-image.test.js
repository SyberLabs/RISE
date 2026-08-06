import { describe, expect, it } from 'vitest';
import {
    REMOTE_IMAGE_ATTRS,
    REMOTE_IMAGE_REFERRER_POLICY,
    asRemoteImage,
    createRemoteImage
} from './remote-image.js';

describe('remote image policy', () => {
    it('sends no referrer', () => {
        // Measured 2026-08-05: the Art Institute's edge returns 403 to any
        // request whose Referer is a loopback address, and 200 to none.
        // No host in the corpus REQUIRES a referrer — Cleveland, Met,
        // Wikimedia, OCLC, Princeton, ESA/Hubble, ESO, NASA and
        // Smithsonian were all checked with the header absent.
        expect(REMOTE_IMAGE_REFERRER_POLICY).toBe('no-referrer');
        expect(createRemoteImage().referrerPolicy).toBe('no-referrer');
    });

    it('applies to an element without disturbing anything else', () => {
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        expect(asRemoteImage(img)).toBe(img);
        expect(img.referrerPolicy).toBe('no-referrer');
        // The policy governs one request; it is not a CORS or decode setting.
        expect(img.decoding).toBe('async');
        expect(img.crossOrigin).toBe('anonymous');
    });

    it('survives a null element rather than throwing into a render', () => {
        expect(asRemoteImage(null)).toBeNull();
    });

    it('offers the same policy to innerHTML templates', () => {
        // A policy that lives at every call site is a vocabulary in every
        // call site, and only one copy ever learns a new word.
        expect(REMOTE_IMAGE_ATTRS).toBe('referrerpolicy="no-referrer"');
    });
});
