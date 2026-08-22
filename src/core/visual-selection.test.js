import { describe, expect, it } from 'vitest';
import { PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import {
    adoptWordFillWhenGalleryEmpty,
    normalizeVisualSelection,
    normalizeWordFill,
    resolveSessionVisualSelection,
    wordFillIsDistinct
} from './visual-selection.js';

describe('normalizeWordFill', () => {
    it('defaults to same-as-gallery', () => {
        expect(normalizeWordFill()).toEqual({ mode: 'same' });
        expect(normalizeWordFill(null)).toEqual({ mode: 'same' });
        expect(normalizeWordFill({ mode: 'same' })).toEqual({ mode: 'same' });
        expect(wordFillIsDistinct({ mode: 'same' })).toBe(false);
    });

    it('keeps a pick in the same shape as a sourced/procedural selection', () => {
        const fill = normalizeWordFill({
            mode: 'pick',
            sourced: ['aic-ukiyoe'],
            procedural: []
        });
        expect(fill.mode).toBe('pick');
        expect(fill.sourced).toEqual(['aic-ukiyoe']);
        expect(fill.procedural).toEqual([]);
        expect(fill.sourceFamily).toBe('collections');
        expect(wordFillIsDistinct(fill)).toBe(true);
    });

    it('an empty pick collapses to same', () => {
        expect(normalizeWordFill({ mode: 'pick', sourced: [], procedural: [] }))
            .toEqual({ mode: 'same' });
    });

    it('a procedural word-fill pick keeps the engine id, not a sourced shelf', () => {
        expect(normalizeWordFill({
            mode: 'pick',
            procedural: ['procedural:fractal'],
            sourced: []
        })).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });
});

describe('normalizeVisualSelection procedural engine ids', () => {
    it('strips a leaked procedural: prefix so Fractal Flames stays an engine', () => {
        expect(normalizeVisualSelection({
            sourceFamily: 'procedural',
            procedural: ['procedural:fractal'],
            sourced: []
        })).toEqual({
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('lifts a procedural id out of sourced so it cannot become an empty gallery shelf', () => {
        expect(normalizeVisualSelection({
            sourced: ['procedural:fractal']
        })).toEqual({
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('canonicalizes every live sibling engine and never leaves an empty sourced fallback', () => {
        for (const id of PROCEDURAL_PATTERN_IDS) {
            expect(normalizeVisualSelection({
                procedural: [`procedural:${id}`],
                sourced: []
            }), id).toEqual({
                sourceFamily: 'procedural',
                procedural: [id],
                sourced: []
            });
        }
    });
});

describe('adoptWordFillWhenGalleryEmpty', () => {
    it('lifts Word-source Fractal Flames onto an empty gallery and returns wordFill to same', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'procedural', procedural: [], sourced: [] },
            { mode: 'pick', procedural: ['procedural:fractal'], sourced: [] }
        );
        expect(adopted.selection).toEqual({
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
        expect(adopted.wordFill).toEqual({ mode: 'same' });
    });

    it('lifts every snapshot sibling the same way', () => {
        for (const id of PROCEDURAL_PATTERN_IDS) {
            const adopted = adoptWordFillWhenGalleryEmpty(
                { sourceFamily: 'procedural', procedural: [], sourced: [] },
                { mode: 'pick', procedural: [`procedural:${id}`], sourced: [] }
            );
            expect(adopted.selection.procedural, id).toEqual([id]);
            expect(adopted.selection.sourced, id).toEqual([]);
            expect(adopted.wordFill, id).toEqual({ mode: 'same' });
        }
    });

    it('adopts a Word-source collection onto an empty room so the field is not stillness', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'procedural', procedural: [], sourced: [] },
            { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] }
        );
        expect(adopted.selection).toEqual({
            sourceFamily: 'collections',
            procedural: [],
            sourced: ['aic-ukiyoe']
        });
        expect(adopted.wordFill).toEqual({ mode: 'same' });
    });

    it('adopts a Blend-family empty room the same way', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'blend', procedural: [], sourced: [] },
            { mode: 'pick', procedural: ['fractal'], sourced: [] }
        );
        expect(adopted.selection.procedural).toEqual(['fractal']);
        expect(adopted.wordFill).toEqual({ mode: 'same' });
    });

    it('does not steal a populated gallery when Word source is a distinct pick', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'procedural', procedural: ['klee'], sourced: [] },
            { mode: 'pick', procedural: ['fractal'], sourced: [] }
        );
        expect(adopted.selection).toEqual({
            sourceFamily: 'procedural',
            procedural: ['klee'],
            sourced: []
        });
        expect(adopted.wordFill).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('does not steal a populated collections room', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'collections', procedural: [], sourced: ['aic-ukiyoe'] },
            { mode: 'pick', procedural: ['fractal'], sourced: [] }
        );
        expect(adopted.selection.sourced).toEqual(['aic-ukiyoe']);
        expect(adopted.selection.procedural).toEqual([]);
        expect(adopted.wordFill.mode).toBe('pick');
        expect(adopted.wordFill.procedural).toEqual(['fractal']);
    });

    it('leaves same-as-gallery alone on an empty room', () => {
        const adopted = adoptWordFillWhenGalleryEmpty(
            { sourceFamily: 'procedural', procedural: [], sourced: [] },
            { mode: 'same' }
        );
        expect(adopted.selection.procedural).toEqual([]);
        expect(adopted.wordFill).toEqual({ mode: 'same' });
    });
});

describe('resolveSessionVisualSelection', () => {
    it('canonicalizes a stale procedural: prefix and adopts Word-source Flames onto an empty room', () => {
        const interlocution = resolveSessionVisualSelection({
            presentation: 'continuous',
            sourceFamily: 'procedural',
            procedural: [],
            sourced: [],
            streamGlass: true,
            wordFill: { mode: 'pick', procedural: ['procedural:fractal'], sourced: [] }
        });
        expect(interlocution.procedural).toEqual(['fractal']);
        expect(interlocution.sourced).toEqual([]);
        expect(interlocution.wordFill).toEqual({ mode: 'same' });
        expect(interlocution.presentation).toBe('continuous');
        expect(interlocution.streamGlass).toBe(true);
    });
});
