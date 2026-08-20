/**
 * What a reading may carry of the reader's own.
 *
 * The policy used to live inside Workshop.js as a run of early returns
 * interleaved with toasts, which meant the Scriptorium could not ask the same
 * question without re-stating the answer. A vocabulary living in two places
 * where only one copy learns a new word is this project's most frequent
 * defect, so the decision moved out and the rooms both call it.
 */
import { describe, expect, it } from 'vitest';
import { describeMaterials, inspectMaterial, MATERIAL_ACCEPT } from './materials.js';
import { READING_LIMITS } from './reading-limits.js';

const file = (over = {}) => ({
    name: 'landscape.png', type: 'image/png', size: 1024, ...over
});

describe('a file the reader chose', () => {
    it('takes the kinds a reading can actually play', () => {
        for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
            expect(inspectMaterial(file({ type })), type).toMatchObject({ ok: true, kind: 'image' });
        }
        expect(inspectMaterial(file({ type: 'video/mp4', name: 'wye.mp4' })))
            .toMatchObject({ ok: true, kind: 'video' });
    });

    it('offers the file dialog exactly what it accepts', () => {
        // One string, so the dialog cannot admit what this module refuses —
        // a reader choosing a file only to be told no is the avoidable half.
        for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']) {
            expect(MATERIAL_ACCEPT).toContain(type);
        }
    });

    it('refuses an mp4 the browser did not vouch for', () => {
        // The extension is what a file is CALLED; the type is what it claims
        // to BE, and only one of those is evidence.
        const verdict = inspectMaterial(file({ name: 'clip.mp4', type: 'application/octet-stream' }));
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toMatch(/MP4/);
    });

    it('states the limit it refused on, in the reader’s units', () => {
        const big = inspectMaterial(file({ size: READING_LIMITS.maxImageFileBytes + 1 }));
        expect(big.ok).toBe(false);
        expect(big.reason).toMatch(/8 MB/);

        const huge = inspectMaterial(file({
            name: 'a.mp4', type: 'video/mp4', size: READING_LIMITS.maxVideoFileBytes + 1
        }));
        expect(huge.ok).toBe(false);
        expect(huge.reason).toMatch(/96 MB/);
    });

    it('refuses once the reading is already full', () => {
        const full = inspectMaterial(file(), { held: READING_LIMITS.maxSequenceAssets });
        expect(full.ok).toBe(false);
        expect(full.reason).toContain(String(READING_LIMITS.maxSequenceAssets));
    });

    it('refuses an empty file and a kind it cannot carry', () => {
        expect(inspectMaterial(file({ size: 0 })).ok).toBe(false);
        expect(inspectMaterial(file({ name: 'notes.pdf', type: 'application/pdf' })).ok).toBe(false);
        expect(inspectMaterial(null).ok).toBe(false);
    });

    it('says nothing about what a picture is of', () => {
        // The half no measurement settles. A description is authored or it is
        // proposed by a model and disposed of by a person; it is never
        // inferred here from a filename.
        const verdict = inspectMaterial(file({ name: 'tintern-abbey-at-dusk.png' }));
        expect(verdict).toEqual({ ok: true, kind: 'image' });
    });
});

describe('what the panel tells the reader', () => {
    it('counts in kinds rather than bytes', () => {
        expect(describeMaterials([])).toBe('Nothing added yet.');
        expect(describeMaterials([{ kind: 'image' }])).toBe('1 image');
        expect(describeMaterials([{ kind: 'image' }, { kind: 'image' }, { kind: 'video' }]))
            .toBe('2 images and 1 video');
    });
});
