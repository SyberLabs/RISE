import { describe, it, expect } from 'vitest';
import { compileFlow, flowCollections, focalOf, BLOCK, MARK } from './flow.js';

/**
 * The Flow compiler (PAGE-MODE-SPEC §3.1). Pure: fake atoms, a fake
 * program, no DOM. The load-bearing claim under test is that the Page
 * binds image↔passage through the SAME cueForAtom the Stream uses.
 */

const atom = (content, extra = {}) => ({
    content, modality: 'text', weight: 0.5, tags: [], ...extra
});
const silence = () => ({ content: '', modality: 'text', weight: 0 });

// A two-episode Matthew 27 slice: before-pilate (1-2) imaged,
// judas (3-10) works-less (stillness), flagellation (26) imaged.
const program = {
    coordinateSpace: 'scripture',
    enabled: true,
    fallback: { kind: 'still' },
    segments: [
        {
            id: 'before-pilate',
            match: { chapter: 27, verseStart: 1, verseEnd: 2 },
            cue: { kind: 'sourced', collections: ['chapel-gospel-before-pilate'] }
        },
        {
            id: 'judas',
            match: { chapter: 27, verseStart: 3, verseEnd: 10 },
            cue: { kind: 'still' }
        },
        {
            id: 'flagellation',
            match: { chapter: 27, verseStart: 26, verseEnd: 26 },
            cue: { kind: 'sourced', collections: ['chapel-gospel-flagellation'] }
        }
    ]
};

describe('compileFlow', () => {
    it('groups consecutive atoms of one verse into a single text block', () => {
        const flow = compileFlow({
            atoms: [
                atom('And when', { chapter: 27, verse: 1 }),
                atom('morning was come,', { chapter: 27, verse: 1 }),
                atom('they brought him', { chapter: 27, verse: 2 })
            ],
            visualProgram: program
        });
        const texts = flow.blocks.filter(b => b.kind === BLOCK.TEXT);
        expect(texts).toHaveLength(2);
        expect(texts[0].text).toBe('And when morning was come,');
        expect(texts[0].verse).toBe(1);
        expect(texts[1].verse).toBe(2);
    });

    it('places the episode plate at the head of its episode', () => {
        const flow = compileFlow({
            atoms: [atom('Pilate.', { chapter: 27, verse: 1 })],
            visualProgram: program
        });
        const img = flow.blocks.find(b => b.kind === BLOCK.IMAGE);
        expect(img).toBeTruthy();
        expect(img.collections).toEqual(['chapel-gospel-before-pilate']);
        expect(img.emphasis).toBe('plate');
        expect(img.at).toEqual({ chapter: 27, verse: 1 });
    });

    it('a works-less episode yields NO image — stillness, never a substitute', () => {
        const flow = compileFlow({
            atoms: [
                atom('Pilate.', { chapter: 27, verse: 1 }),
                atom('Then Judas repented.', { chapter: 27, verse: 3 })
            ],
            visualProgram: program
        });
        const imgs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        // only before-pilate placed an image; judas (still) placed none
        expect(imgs).toHaveLength(1);
        expect(imgs[0].collections).toEqual(['chapel-gospel-before-pilate']);
    });

    it('marks an episode break when the passage changes scene', () => {
        const flow = compileFlow({
            atoms: [
                atom('Pilate.', { chapter: 27, verse: 1 }),
                atom('Judas.', { chapter: 27, verse: 3 })
            ],
            visualProgram: program
        });
        const breaks = flow.blocks.filter(b => b.mark === MARK.EPISODE_BREAK);
        expect(breaks.length).toBeGreaterThanOrEqual(1);
        expect(flow.episodes).toBe(2);
    });

    it('opens a chapter with a structural mark', () => {
        const flow = compileFlow({
            atoms: [atom('And when', { chapter: 27, verse: 1 })],
            visualProgram: program
        });
        expect(flow.blocks[0]).toMatchObject({ kind: BLOCK.MARK, mark: MARK.CHAPTER_OPEN, chapter: 27 });
    });

    it('structural silence closes a run and never changes the scene', () => {
        const flow = compileFlow({
            atoms: [
                atom('Pilate.', { chapter: 27, verse: 1 }),
                silence(),
                atom('again.', { chapter: 27, verse: 1 })
            ],
            visualProgram: program
        });
        // the silence split the verse into two runs, but placed only ONE image
        expect(flow.blocks.filter(b => b.kind === BLOCK.IMAGE)).toHaveLength(1);
    });

    it('a plain reading with no program still compiles text blocks', () => {
        const flow = compileFlow({
            atoms: [atom('The pendulum draws the chord it hears.')],
            visualProgram: null
        });
        const texts = flow.blocks.filter(b => b.kind === BLOCK.TEXT);
        expect(texts).toHaveLength(1);
        expect(texts[0].text).toContain('pendulum');
        expect(flow.blocks.filter(b => b.kind === BLOCK.IMAGE)).toHaveLength(0);
        expect(flow.coordinateSpace).toBeNull();
    });

    it('an empty session compiles to an empty flow, not a crash', () => {
        expect(compileFlow({}).blocks).toEqual([]);
        expect(compileFlow(null).blocks).toEqual([]);
    });

    // ─── Content fidelity (red-team #5) ───

    it('carries an AUTHORED image atom into the page, with its own URL', () => {
        const flow = compileFlow({
            atoms: [
                atom('Before the plate.'),
                { content: 'https://x/plate.jpg', url: 'https://x/plate.jpg', modality: 'image', name: 'A Plate' },
                atom('After the plate.')
            ],
            visualProgram: null
        });
        const img = flow.blocks.find(b => b.kind === BLOCK.IMAGE);
        expect(img).toBeTruthy();
        expect(img.url).toBe('https://x/plate.jpg');
        expect(img.collections).toEqual([]);   // needs no provider
        expect(img.title).toBe('A Plate');
        // and it did not swallow the prose around it
        expect(flow.blocks.filter(b => b.kind === BLOCK.TEXT)).toHaveLength(2);
    });

    it('carries an authored SYMBOL atom into the page', () => {
        const flow = compileFlow({
            atoms: [
                atom('Before.'),
                { content: '✕', modality: 'symbol' },
                atom('After.')
            ],
            visualProgram: null
        });
        const sym = flow.blocks.find(b => b.kind === BLOCK.SYMBOL);
        expect(sym).toBeTruthy();
        expect(sym.symbol).toBe('✕');
        expect(flow.blocks.filter(b => b.kind === BLOCK.TEXT)).toHaveLength(2);
    });

    it('an audio atom is silence — there is nothing to typeset', () => {
        const flow = compileFlow({
            atoms: [atom('A.'), { content: 'x.mp3', modality: 'audio' }, atom('B.')],
            visualProgram: null
        });
        expect(flow.blocks.some(b => b.kind === BLOCK.IMAGE)).toBe(false);
        expect(flow.blocks.some(b => b.kind === BLOCK.SYMBOL)).toBe(false);
    });

    it('a reading with CHOSEN COLLECTIONS but no program still gets figures', () => {
        const atoms = [];
        for (let i = 0; i < 40; i++) {
            atoms.push(atom(`Paragraph ${i} of a reading long enough to carry imagery here.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: { interlocution: { sourced: ['aic-landscapes'] } }
        });
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs.length).toBeGreaterThan(0);
        expect(flow.derivedFigures).toBe(figs.length);
        expect(figs[0].collections).toEqual(['aic-landscapes']);
        expect(figs[0].derived).toBe(true);
        // Derived figures vary in weight (see the dedicated test below);
        // each is a placement the compositor understands.
        expect(figs.every(f => ['plate', 'inset'].includes(f.emphasis))).toBe(true);
    });

    it('an AUTHORED program is never second-guessed by derived figures', () => {
        const flow = compileFlow({
            atoms: [atom('Pilate.', { chapter: 27, verse: 1 })],
            visualProgram: program,
            visualConfig: { interlocution: { sourced: ['aic-landscapes'] } }
        });
        expect(flow.derivedFigures).toBe(0);
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs).toHaveLength(1);
        expect(figs[0].collections).toEqual(['chapel-gospel-before-pilate']);
    });

    it('too little prose earns no derived figure — restraint by default', () => {
        const flow = compileFlow({
            atoms: [atom('A short note.'), atom('And one more line.')],
            visualProgram: null,
            visualConfig: { interlocution: { sourced: ['aic-landscapes'] } }
        });
        expect(flow.derivedFigures).toBe(0);
    });

    it('a long reading is capped — a book, not a gallery wall', () => {
        // Paragraphs arrive separated by structural silence (as the
        // chunker emits them), so the body is many blocks, not one run.
        const atoms = [];
        for (let i = 0; i < 200; i++) {
            atoms.push(atom(`Paragraph ${i} of a very long reading indeed, with enough prose to matter.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: { interlocution: { sourced: ['aic-landscapes'] } }
        });
        expect(flow.derivedFigures).toBeLessThanOrEqual(14);   // MAX_DERIVED_FIGURES
        expect(flow.derivedFigures).toBeGreaterThan(1);
    });

    it('a PROCEDURAL selection is chosen imagery too', () => {
        // A fractal/Klee reading selected its visuals as deliberately as
        // one that picked a museum collection. Reading only `sourced` made
        // the Page silently blank for every procedural reader.
        const atoms = [];
        for (let i = 0; i < 40; i++) {
            atoms.push(atom(`Paragraph ${i} of a reading long enough to carry imagery here.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: { interlocution: { sourced: [], procedural: ['fractal'] } }
        });
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs.length).toBeGreaterThan(0);
        expect(figs[0].collections).toEqual(['fractal']);
    });

    // ─── Persistent fields and focals ───

    it('a GENESIS reading is itself, not whatever sits in interlocution', () => {
        const atoms = [];
        for (let i = 0; i < 40; i++) {
            atoms.push(atom(`Paragraph ${i} of a reading long enough to carry imagery here.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: {
                visualMode: 'genesis',
                genesis: { preset: 'random' },
                // a stale interlocution selection must NOT win
                interlocution: { sourced: [], procedural: ['fractal'] }
            }
        });
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs.length).toBeGreaterThan(0);
        expect(figs.every(f => f.collections[0] === 'genesis')).toBe(true);
    });

    it('an ATTRACTOR reading is itself', () => {
        const atoms = [];
        for (let i = 0; i < 40; i++) {
            atoms.push(atom(`Paragraph ${i} of a reading long enough to carry imagery here.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: {
                visualMode: 'attractor',
                attractor: { system: 'aizawa' },
                interlocution: { sourced: [], procedural: ['fractal'] }
            }
        });
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs.every(f => f.collections[0] === 'attractor')).toBe(true);
    });

    it('derived figures VARY in weight — a page is not all whispers', () => {
        const atoms = [];
        for (let i = 0; i < 120; i++) {
            atoms.push(atom(`Paragraph ${i} of a long reading with ample prose to carry plates.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: { interlocution: { sourced: ['aic-landscapes'] } }
        });
        const figs = flow.blocks.filter(b => b.kind === BLOCK.IMAGE);
        expect(figs.length).toBeGreaterThan(2);
        expect(figs.some(f => f.emphasis === 'plate')).toBe(true);
        expect(figs.some(f => f.emphasis === 'inset')).toBe(true);
    });

    it('a FOCALS reading places no figures — a focal is held, not serialized', () => {
        const atoms = [];
        for (let i = 0; i < 40; i++) {
            atoms.push(atom(`Paragraph ${i} with enough prose to have earned a figure.`));
            atoms.push(silence());
        }
        const flow = compileFlow({
            atoms,
            visualProgram: null,
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'standard', standardGlyph: 'lotus' }
            }
        });
        expect(flow.derivedFigures).toBe(0);
    });

    it('focalOf reports the held focal, and nothing when the mode is not focals', () => {
        expect(focalOf({ visualConfig: { visualMode: 'focals', focals: { type: 'standard', standardGlyph: 'star' } } }))
            .toMatchObject({ type: 'standard', glyph: 'star' });
        expect(focalOf({ visualConfig: { visualMode: 'focals', focals: { type: 'icon', iconId: 'icon-transfiguration' } } }))
            .toMatchObject({ type: 'icon', iconId: 'icon-transfiguration' });
        expect(focalOf({ visualConfig: { visualMode: 'interlocution' } })).toBeNull();
        expect(focalOf(null)).toBeNull();
    });

    it('resolves a durable personal focal for the Page without requiring a transient config URL', () => {
        expect(focalOf({
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'personal', personalAssetId: 'portrait' }
            },
            sequenceVisualAssets: [{
                id: 'portrait', kind: 'image', uri: 'blob:http://localhost/portrait'
            }]
        })).toEqual({ type: 'personal', image: 'blob:http://localhost/portrait' });
    });

    it('holds a scored fallback focal once and lowers a segment focal at its source boundary', () => {
        const session = {
            atoms: [
                atom('Before', {
                    sourceId: 'source-1', sourceCharacterStart: 0, sourceCharacterEnd: 6
                }),
                atom('Passage', {
                    sourceId: 'source-1', sourceCharacterStart: 7, sourceCharacterEnd: 14
                }),
                atom('After', {
                    sourceId: 'source-1', sourceCharacterStart: 15, sourceCharacterEnd: 20
                })
            ],
            visualConfig: { visualMode: 'interlocution' },
            visualProgram: {
                coordinateSpace: 'source', enabled: true,
                fallback: {
                    kind: 'field', renderer: 'focal',
                    config: { type: 'standard', standardGlyph: 'anchor' }
                },
                segments: [{
                    id: 'passage-focal',
                    match: { sourceIds: ['source-1'], fromCharacter: 7, toCharacter: 14 },
                    cue: {
                        kind: 'field', renderer: 'focal',
                        config: { type: 'standard', standardGlyph: 'star' }
                    }
                }]
            }
        };

        const flow = compileFlow(session);
        const focals = flow.blocks.filter(block => block.kind === BLOCK.FOCAL);
        expect(focalOf(session)).toMatchObject({ type: 'standard', glyph: 'anchor' });
        expect(focals).toHaveLength(1);
        expect(focals[0]).toMatchObject({
            episodeId: 'passage-focal',
            focal: { type: 'standard', glyph: 'star' }
        });
    });

    it('no chosen collections means no derived figures', () => {
        const atoms = [];
        for (let i = 0; i < 40; i++) { atoms.push(atom(`Paragraph ${i} here with prose.`)); atoms.push(silence()); }
        const flow = compileFlow({ atoms, visualProgram: null, visualConfig: { interlocution: { sourced: [] } } });
        expect(flow.derivedFigures).toBe(0);
    });

    it('flowCollections lists referenced collections in first-appearance order', () => {
        const flow = compileFlow({
            atoms: [
                atom('a', { chapter: 27, verse: 1 }),
                atom('b', { chapter: 27, verse: 26 })
            ],
            visualProgram: program
        });
        expect(flowCollections(flow)).toEqual([
            'chapel-gospel-before-pilate',
            'chapel-gospel-flagellation'
        ]);
    });
});

describe('a Journey has its authored imagery reach the page at all', () => {
    // Two faults, and only the second is deferred.
    //
    // compileFlow consulted the visual program only for atoms carrying
    // chapter AND verse — the scripture space. A Journey's atoms carry a
    // sourceId, so cueForAtom was never called and NO authored cue of
    // any kind was read. With `program` set, the unscheduled fallback is
    // deliberately skipped too, so a Journey's page came out as bare
    // text while an ordinary session's was illustrated.
    //
    // That is fixed here. Procedural figures are a separate question and
    // are held until the Page paginates (PAGE-MODE-SPEC v4).
    const atoms = (n, sourceId) => Array.from({ length: n }, (_, i) => ({
        content: `Line ${i} of the passage with enough words to make a real block of prose here.`,
        sourceId,
        sourceProgress: i / n,
        tags: []
    }));

    const programWith = (cue) => ({
        coordinateSpace: 'source',
        segments: [{ id: 'seg', match: { sourceIds: ['p1'] }, cue }],
        fallback: { kind: 'still' }
    });

    it('places the works of a sourced cue without chapter and verse', () => {
        // The Homeric movement is museum imagery on the ordinary path,
        // and it was invisible for the same reason as everything else.
        const flow = compileFlow({
            atoms: atoms(40, 'p1'),
            visualProgram: programWith({
                kind: 'sourced', collections: ['atr-attic-vases']
            })
        });
        const images = flow.blocks.filter(b => b.collections?.length);
        expect(images.length).toBeGreaterThan(0);
        expect(images[0].collections).toEqual(['atr-attic-vases']);
    });

    it('reads the program at all in the source coordinate space', () => {
        // The episode boundary itself was never detected, so a Journey
        // page had no episode structure either.
        const flow = compileFlow({
            atoms: [...atoms(20, 'p1'), ...atoms(20, 'p2')],
            visualProgram: {
                coordinateSpace: 'source',
                segments: [
                    { id: 'a', match: { sourceIds: ['p1'] },
                      cue: { kind: 'sourced', collections: ['one'] } },
                    { id: 'b', match: { sourceIds: ['p2'] },
                      cue: { kind: 'sourced', collections: ['two'] } }
                ],
                fallback: { kind: 'still' }
            }
        });
        const seen = flow.blocks.filter(b => b.collections?.length)
            .map(b => b.collections[0]);
        expect(seen).toContain('one');
        expect(seen).toContain('two');
    });

    it('illustrates a procedural cue with the engines its author named', () => {
        // Held back until the Page paginated, on the grounds that a
        // 23,000-word Journey was one continuous column and could not
        // afford a sampled still at every figure. It paginates now, so
        // the deferral is spent and the figures arrive.
        const flow = compileFlow({
            atoms: atoms(40, 'p1'),
            visualProgram: programWith({
                kind: 'procedural',
                collections: ['paradise-lost'],
                engines: ['flaming_sword']
            })
        });
        const placed = flow.blocks.filter(b => b.collections?.length);
        expect(placed.length).toBeGreaterThan(0);
        // A figure names its own engine, so the resolver can sample the
        // right one. The id format belongs to work-engines.js.
        expect(placed[0].collections[0]).toMatch(/flaming_sword/);
    });

    it('names the family alone when a procedural cue names no engine', () => {
        const flow = compileFlow({
            atoms: atoms(40, 'p1'),
            visualProgram: programWith({
                kind: 'procedural',
                collections: ['paradise-lost'],
                engines: []
            })
        });
        const placed = flow.blocks.filter(b => b.collections?.length);
        expect(placed.length).toBeGreaterThan(0);
        expect(placed[0].collections[0]).toContain('paradise-lost');
    });

    it('still places nothing for a still cue', () => {
        // §5: a works-less episode is sanctioned stillness, not a gap to
        // be filled.
        const flow = compileFlow({
            atoms: atoms(40, 'p1'),
            visualProgram: programWith({ kind: 'still' })
        });
        expect(flow.blocks.filter(b => b.collections?.length)).toHaveLength(0);
    });
});
