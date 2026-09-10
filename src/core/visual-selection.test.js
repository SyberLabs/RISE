import { describe, expect, it } from 'vitest';
import { LISTED_PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import {
    normalizeVisualSelection,
    normalizeFitBorder,
    normalizeWordFill,
    resolveSessionWordFill,
    wordFillIsDistinct,
    sessionImageryCollections
} from './visual-selection.js';

describe('normalizeWordFill', () => {
    // The border edges the Fit word; it does not belong to whatever fills the
    // letters. Every mode carries one, so choosing an ink never discards it.
    it('keeps Plain as explicit ordinary ink, and keeps its edge', () => {
        expect(normalizeWordFill({ mode: 'plain' })).toEqual({ mode: 'plain', border: 'cream' });
        expect(normalizeWordFill({ mode: 'plain', border: 'off' }))
            .toEqual({ mode: 'plain', border: 'off' });
    });

    it('preserves an explicit accent ink without inventing a visual playlist', () => {
        expect(normalizeWordFill({ mode: 'accent' })).toEqual({ mode: 'accent', border: 'cream' });
        expect(normalizeWordFill({ mode: 'accent', border: 'accent' }))
            .toEqual({ mode: 'accent', border: 'accent' });
        expect(wordFillIsDistinct({ mode: 'accent' })).toBe(false);
        expect(resolveSessionWordFill({ wordFill: { mode: 'accent' } }))
            .toEqual({ mode: 'accent', border: 'cream' });
    });

    it('defaults to same-as-gallery', () => {
        expect(normalizeWordFill()).toEqual({ mode: 'same' });
        expect(normalizeWordFill(null)).toEqual({ mode: 'same' });
        expect(normalizeWordFill({ mode: 'same' })).toEqual({ mode: 'same', border: 'cream' });
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
            border: 'cream',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('defaults explicit visual masks to a cream border and accepts its three border values', () => {
        expect(normalizeWordFill({ mode: 'same', border: 'accent' }))
            .toEqual({ mode: 'same', border: 'accent' });
        expect(normalizeWordFill({
            mode: 'pick', procedural: ['procedural:fractal'], border: 'off'
        })).toMatchObject({ mode: 'pick', procedural: ['fractal'], border: 'off' });
        expect(normalizeFitBorder('off')).toBe('off');
        expect(normalizeFitBorder('accent')).toBe('accent');
        expect(normalizeFitBorder('invalid', 'off')).toBe('off');
    });
});

describe('resolveSessionWordFill — cold-start pair (FM-RISE-58)', () => {
    it('undefined wordFill on Astronomy × Fractal is a Fractal pick', () => {
        expect(resolveSessionWordFill({
            sourced: ['sci-astronomy'],
            procedural: ['fractal']
        })).toEqual({
            mode: 'pick',
            border: 'cream',
            sourceFamily: 'procedural',
            procedural: ['fractal'],
            sourced: []
        });
    });

    it('undefined wordFill on Old Masters × Fractal is a Fractal pick', () => {
        expect(resolveSessionWordFill({
            sourced: ['aic-oldmasters'],
            procedural: ['fractal']
        }).procedural).toEqual(['fractal']);
    });

    it('undefined wordFill on Astronomy × Attractor is an Attractor pick', () => {
        expect(resolveSessionWordFill({
            sourced: ['sci-astronomy'],
            procedural: ['attractor']
        }).procedural).toEqual(['attractor']);
    });

    it('an explicit same is not rewritten into a pick', () => {
        expect(resolveSessionWordFill({
            sourced: ['sci-astronomy'],
            procedural: ['fractal'],
            wordFill: { mode: 'same' }
        })).toEqual({ mode: 'same', border: 'cream' });
    });

    it('an explicit pick wins over the session pair leftover', () => {
        expect(resolveSessionWordFill({
            sourced: ['sci-astronomy'],
            procedural: ['fractal'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['attractor'] }
        })).toEqual({
            mode: 'pick',
            border: 'cream',
            sourceFamily: 'procedural',
            procedural: ['attractor'],
            sourced: []
        });
    });

    it('a room-only collection stays same-as-gallery', () => {
        expect(resolveSessionWordFill({
            sourced: ['sci-astronomy'],
            procedural: []
        })).toEqual({ mode: 'same' });
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
            border: 'cream',
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

describe('the imagery a reading will ask for', () => {
    it('takes the room pool and the word-fill pool, which are often not the same', () => {
        // A fit word filled from Old Masters over a room of Astronomy
        // wants both — and the FILL is the one the mask waits on before
        // it can show anything at all.
        expect(sessionImageryCollections({
            interlocution: {
                sourced: ['astronomy'],
                wordFill: { mode: 'pick', sourced: ['oldmasters'], procedural: [] }
            }
        })).toEqual(['astronomy', 'oldmasters']);
    });

    it('finds a mask pool even when the room is procedural', () => {
        // Meditations: a fractal room, so nothing sourced is named at the
        // top level, and the only collection in the reading is the one
        // the letters are filled from.
        expect(sessionImageryCollections({
            interlocution: {
                procedural: ['fractal'],
                sourced: [],
                wordFill: { mode: 'pick', sourced: ['aic-knights'], procedural: [] }
            }
        })).toEqual(['aic-knights']);
    });

    it('names each pool once', () => {
        expect(sessionImageryCollections({
            interlocution: {
                sourced: ['aic-landscapes'],
                atriumCollections: ['aic-landscapes'],
                wordFill: { mode: 'pick', sourced: ['aic-landscapes'], procedural: [] }
            }
        })).toEqual(['aic-landscapes']);
    });

    it('has nothing to warm for a reading that generates its own pictures', () => {
        // Procedural engines do not fetch; there is nothing to warm.
        expect(sessionImageryCollections({ interlocution: { procedural: ['fractal', 'ostensoria'] } }))
            .toEqual([]);
        expect(sessionImageryCollections({})).toEqual([]);
        expect(sessionImageryCollections(null)).toEqual([]);
    });

    it('leaves a reader own uploads alone', () => {
        // Sequence assets are already local; there is no provider to warm.
        expect(sessionImageryCollections({
            interlocution: { sourced: ['sequence-asset:abc', 'aic-knights'] }
        })).toEqual(['aic-knights']);
    });
});
