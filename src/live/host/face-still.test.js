/**
 * The still face: the open eye as one inline SVG, shown before the face's worker draws and as its poster.
 */
import { describe, expect, it } from 'vitest';
import { FACE_SKINS, faceStill } from './face-still.js';
import { ORACLE_SKINS } from '../../scenes/engines/oracle.js';

const parse = markup => {
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    return holder.firstElementChild;
};

describe('the still face', () => {
    it('offers the engine’s own skins', () => {
        expect(FACE_SKINS).toEqual(Object.keys(ORACLE_SKINS));
    });

    it('is the open eye: a lit disc, 36 petal strokes, the pupil, the catchlight and seven soft nodes', () => {
        const svg = parse(faceStill('sophia'));
        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.querySelectorAll('[data-part="petal"]')).toHaveLength(36);
        expect(svg.querySelectorAll('[data-part="node"]')).toHaveLength(7);
        for (const part of ['iris', 'pupil', 'catchlight']) expect(svg.querySelectorAll(`[data-part="${part}"]`), part).toHaveLength(1);
        // Small enough to inline in the venue's first paint.
        expect(faceStill('sophia').length).toBeLessThan(8000);
    });

    it('wears the skin it is given, in the engine’s colours, and Sophia for one it does not know', () => {
        expect(faceStill('ember')).toContain('rgb(240, 163, 107)');
        expect(faceStill('ember')).not.toContain('rgb(135, 206, 235)');
        expect(faceStill('gold')).toBe(faceStill('sophia'));
        expect(parse(faceStill('jade')).dataset.skin).toBe('jade');
    });
});
