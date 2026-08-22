/**
 * Gallery snapshot engines — living canvas, not a ContinuousField still.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GalleryEngineField } from './gallery-engine-field.js';
import { SNAPSHOT_PROCEDURAL_IDS } from '../core/visual-registry.js';

let host;
let paints;

beforeEach(() => {
    paints = [];
    host = document.createElement('div');
    document.body.appendChild(host);
});

afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function paint(type, canvas) {
    paints.push({ type, canvas });
    const ctx = canvas.getContext?.('2d');
    ctx?.fillRect?.(0, 0, 1, 1);
    return true;
}

describe('GalleryEngineField', () => {
    it('mounts visible engine planes and paints the selected family', () => {
        const field = new GalleryEngineField(host, {
            families: ['fractal'],
            paint
        });
        field.start();
        expect(field.running).toBe(true);
        expect(host.querySelectorAll('.gallery-engine-plane')).toHaveLength(2);
        expect(paints.some(entry => entry.type === 'fractal')).toBe(true);
        field.destroy();
    });

    it('each snapshot sibling is an engine family, not a stills shelf', () => {
        for (const id of SNAPSHOT_PROCEDURAL_IDS) {
            paints.length = 0;
            const field = new GalleryEngineField(host, {
                families: [id],
                paint
            });
            field.start();
            expect(field.running, id).toBe(true);
            expect(paints.some(entry => entry.type === id), id).toBe(true);
            field.destroy();
        }
    });

    it('reduced motion paints once and starts no clock', () => {
        const raf = vi.fn();
        vi.stubGlobal('requestAnimationFrame', raf);
        const field = new GalleryEngineField(host, {
            families: ['fractal'],
            paint,
            reducedMotion: true
        });
        field.start();
        expect(paints).toHaveLength(1);
        expect(raf).not.toHaveBeenCalled();
        field.destroy();
    });
});
