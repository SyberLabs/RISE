import { describe, expect, it } from 'vitest';
import { LISTED_PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
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

    it('lists Attractor among the browsable procedural engines', () => {
        expect(LISTED_PROCEDURAL_PATTERNS.some(pattern => pattern.id === 'attractor'
            && pattern.name === 'Attractor')).toBe(true);
        expect(PROCEDURAL_PATTERN_IDS).not.toContain('attractor');
        expect(normalizeWordFill({
            mode: 'pick',
            procedural: ['procedural:attractor'],
            sourced: []
        })).toEqual({
            mode: 'pick',
            sourceFamily: 'procedural',
            procedural: ['attractor'],
            sourced: []
        });
    });

    it('an explicit Collections pick with leftover engines stays Collections', () => {
        expect(normalizeVisualSelection({
            sourceFamily: 'collections',
            procedural: ['klee', 'harmonograph', 'attractor'],
            sourced: []
        })).toEqual({
            sourceFamily: 'collections',
            procedural: [],
            sourced: []
        });
    });

    it('an explicit Personal pick with leftover engines stays Personal', () => {
        expect(normalizeVisualSelection({
            sourceFamily: 'personal',
            procedural: ['fractal'],
            sourced: []
        })).toEqual({
            sourceFamily: 'personal',
            procedural: [],
            sourced: []
        });
    });

    it('an explicit Blend pick is not rewritten to Procedural', () => {
        expect(normalizeVisualSelection({
            sourceFamily: 'blend',
            procedural: ['klee'],
            sourced: []
        })).toEqual({
            sourceFamily: 'blend',
            procedural: ['klee'],
            sourced: []
        });
    });

    it('empty+empty keeps the last chosen family instead of inferring procedural', () => {
        expect(normalizeVisualSelection({
            sourceFamily: 'collections',
            procedural: [],
            sourced: []
        })).toEqual({
            sourceFamily: 'collections',
            procedural: [],
            sourced: []
        });
    });

    it('a leaked engine without a family still becomes procedural', () => {
        expect(normalizeVisualSelection({
            sourced: ['procedural:fractal']
        })).toEqual({
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('keeps living procedurals Harmonograph · Iris Plate · Spectral Plate · Attractor last', () => {
        const living = LISTED_PROCEDURAL_PATTERNS
            .filter(pattern => ['harmonograph', 'ostensoria', 'apparitio', 'attractor'].includes(pattern.id));
        expect(living.map(pattern => pattern.id))
            .toEqual(['harmonograph', 'ostensoria', 'apparitio', 'attractor']);
        expect(living.at(-1)).toEqual(expect.objectContaining({ id: 'attractor', name: 'Attractor' }));
        expect(LISTED_PROCEDURAL_PATTERNS.map(pattern => pattern.name)).not.toContain('Storm of Steel');
        expect(LISTED_PROCEDURAL_PATTERNS.some(pattern => /Live/.test(pattern.name))).toBe(false);
    });
});

