import { describe, it, expect } from 'vitest';
import { compileFlow, flowCollections, BLOCK, MARK } from './flow.js';

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
        // Derived figures are quieter than an authored episode plate.
        expect(figs.every(f => f.emphasis === 'inset')).toBe(true);
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
        expect(flow.derivedFigures).toBeLessThanOrEqual(8);
        expect(flow.derivedFigures).toBeGreaterThan(1);
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
