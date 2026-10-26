/**
 * The still face: the open eye as one inline SVG, shown before the face's worker draws and as its poster.
 */
import { describe, expect, it } from 'vitest';
import { FACE_SKINS, faceLight, facePalette, faceStill } from './face-still.js';
import { ORACLE_SKINS } from '../../scenes/engines/oracle.js';

const parse = markup => {
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    return holder.firstElementChild;
};

describe('the still face', () => {
    it('offers the engine’s own skins, Porcelain the one light room', () => {
        expect(FACE_SKINS).toEqual(Object.keys(ORACLE_SKINS));
        expect(FACE_SKINS.filter(faceLight)).toEqual(['porcelain']);
        expect(faceLight('gold')).toBe(false);
    });

    it('gives a light room ink for its words and its deep for its night; a dark room keeps its core', () => {
        expect(facePalette('porcelain')).toEqual({
            '--live-ground': 'rgb(244, 239, 230)', '--live-iris': 'rgb(47, 95, 179)', '--live-core': 'rgb(23, 42, 79)',
            '--live-glow': 'rgb(168, 192, 230)', '--live-deep': 'rgb(14, 27, 54)'
        });
        expect(facePalette('sophia')['--live-core']).toBe('rgb(245, 245, 220)');
        // Its still eye's nodes are beads of ink, as the engine draws them, not a pale heart in a ring.
        const node = parse(faceStill('porcelain')).querySelector('radialGradient[id$="-node"] stop');
        expect(node.getAttribute('stop-color')).toBe('rgb(47, 95, 179)');
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
