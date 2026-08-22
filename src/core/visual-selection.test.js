import { describe, expect, it } from 'vitest';
import { normalizeWordFill, wordFillIsDistinct } from './visual-selection.js';

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
});
