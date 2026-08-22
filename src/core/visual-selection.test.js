import { describe, expect, it } from 'vitest';
import { PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import {
    normalizeVisualSelection,
    normalizeWordFill,
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
