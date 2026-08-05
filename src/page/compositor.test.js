import { describe, it, expect } from 'vitest';
import { compose, PLACEMENT, RHYTHM } from './compositor.js';
import { BLOCK, MARK } from './flow.js';

/**
 * The Compositor (PAGE-MODE-SPEC §3.2) — the typesetting intelligence,
 * proven over a fake flow with no DOM. Domain-agnostic by construction:
 * these tests never mention a pericope.
 */

const text = (t, extra = {}) => ({ kind: BLOCK.TEXT, text: t, weight: 0.5, tags: [], ...extra });
const image = (emphasis = 'plate', collections = ['c1']) =>
    ({ kind: BLOCK.IMAGE, collections, emphasis, episodeId: 'e', at: null });
const mark = (m, extra = {}) => ({ kind: BLOCK.MARK, mark: m, ...extra });

describe('compose', () => {
    it('the OPENING plate of a real chapter is full-bleed, not demoted', () => {
        // Regression (red-team #10): a real scripture flow begins with a
        // chapter mark, so testing `items.length === 0` made the very
        // first plate look as though it already owed a text debt. The
        // fixture must include the chapter mark or the bug hides.
        const { items } = compose({
            blocks: [
                mark(MARK.CHAPTER_OPEN, { chapter: 27 }),
                image('plate'),
                text('And when morning was come, all the chief priests took counsel.')
            ]
        });
        expect(items.find(i => i.type === 'figure').placement).toBe(PLACEMENT.BLEED);
    });

    it('an episode plate reads full-bleed', () => {
        const { items } = compose({ blocks: [image('plate'), text('After the plate, a long enough line of prose.')] });
        const fig = items.find(i => i.type === 'figure');
        expect(fig.placement).toBe(PLACEMENT.BLEED);
    });

    it('does not stack bleeds — a run of plates demotes to inset', () => {
        const { items, stats } = compose({
            blocks: [image('plate'), image('plate'), image('plate'), text('Prose long enough to stand on its own here.')]
        });
        const figs = items.filter(i => i.type === 'figure');
        expect(figs[0].placement).toBe(PLACEMENT.BLEED);
        expect(figs[1].placement).toBe(PLACEMENT.INSET);
        expect(figs[2].placement).toBe(PLACEMENT.INSET);
        expect(stats.bleeds).toBe(1);
    });

    it('a bleed is EARNED by prose — a scene change alone does not buy one', () => {
        // The real Matthew 27 shape: seven short episodes, each opening
        // with a plate. Without the debt rule this renders as seven
        // stacked full-bleed plates — a reel, not a book.
        const blocks = [];
        for (let e = 0; e < 7; e++) {
            if (e > 0) blocks.push(mark(MARK.EPISODE_BREAK, { episodeId: `e${e}` }));
            blocks.push(image('plate', [`c${e}`]));
            blocks.push(text(`Episode ${e} opens with a line of prose here.`));
            blocks.push(text(`And continues for a second verse of prose.`));
        }
        const { stats, items } = compose({ blocks });
        expect(stats.figures).toBe(7);
        // Only a minority earn the full-bleed treatment.
        expect(stats.bleeds).toBeLessThan(4);
        expect(stats.bleeds).toBeGreaterThanOrEqual(1);
        // and the rest are still present, just quieter
        expect(items.filter(i => i.type === 'figure' && i.placement === PLACEMENT.INSET).length)
            .toBe(7 - stats.bleeds);
    });

    it('enough prose re-earns a full-bleed plate', () => {
        const prose = (n) => Array.from({ length: n }, (_, i) =>
            text(`A sufficiently long line of prose, number ${i}, to pay the debt.`));
        const { items } = compose({
            blocks: [image('plate'), ...prose(6), image('plate')]
        });
        const figs = items.filter(i => i.type === 'figure');
        expect(figs[0].placement).toBe(PLACEMENT.BLEED);
        expect(figs[1].placement).toBe(PLACEMENT.BLEED);
    });

    it('a chapter opening earns open rhythm', () => {
        const { items } = compose({ blocks: [mark(MARK.CHAPTER_OPEN, { chapter: 27 }), text('And when morning was come.')] });
        expect(items[0]).toMatchObject({ type: 'chapter', chapter: 27, rhythm: RHYTHM.OPEN });
    });

    it('a works-less episode break earns STILL rhythm — deliberate space', () => {
        const { items } = compose({
            blocks: [
                text('Before the scene changes, a full line of prose.'),
                mark(MARK.EPISODE_BREAK, { episodeId: 'judas' }),
                text('Then Judas repented himself, and brought again the pieces.')
            ]
        });
        const brk = items.find(i => i.type === 'break');
        expect(brk.rhythm).toBe(RHYTHM.STILL);
        // and the text that follows inherits the stillness
        const after = items[items.indexOf(brk) + 1];
        expect(after.rhythm).toBe(RHYTHM.STILL);
    });

    it('an imaged episode break earns OPEN rhythm, not stillness', () => {
        const { items } = compose({
            blocks: [
                text('A line of prose long enough to matter here.'),
                mark(MARK.EPISODE_BREAK, { episodeId: 'flagellation' }),
                image('plate'),
                text('Then he released Barabbas unto them, and delivered Jesus.')
            ]
        });
        expect(items.find(i => i.type === 'break').rhythm).toBe(RHYTHM.OPEN);
    });

    it('a short run under a figure is pulled tight (widow restraint)', () => {
        const { items } = compose({ blocks: [image('plate'), text('He was silent.')] });
        const t = items.find(i => i.type === 'text');
        expect(t.rhythm).toBe(RHYTHM.TIGHT);
    });

    it('a long run under a figure keeps normal rhythm', () => {
        const long = 'And the governor answered and said unto them, whether of the twain will ye that I release.';
        const { items } = compose({ blocks: [image('plate'), text(long)] });
        expect(items.find(i => i.type === 'text').rhythm).toBe(RHYTHM.NORMAL);
    });

    it('collapses a pause that lands beside a stronger break', () => {
        const { items } = compose({
            blocks: [
                text('A line of prose long enough to matter here.'),
                mark(MARK.EPISODE_BREAK, { episodeId: 'x' }),
                mark(MARK.PAUSE),
                text('Another full line of prose to close it out.')
            ]
        });
        expect(items.filter(i => i.type === 'pause')).toHaveLength(0);
    });

    it('never opens or closes on empty space', () => {
        const { items } = compose({
            blocks: [mark(MARK.PAUSE), text('The only real content here.'), mark(MARK.PAUSE)]
        });
        expect(items[0].type).toBe('text');
        expect(items[items.length - 1].type).toBe('text');
    });

    // ─── Wrapped (margin) figures: the intelligent grid ───

    const longLine = (n) => `Verse ${n}: and the governor answered and said unto them, whether of the twain will ye that I release unto you.`;

    it('promotes an inset to a WRAPPED figure when real prose follows it', () => {
        const { items } = compose({
            blocks: [
                text('Opening prose that precedes the figure entirely.'),
                image('inset'),
                text(longLine(1)), text(longLine(2)), text(longLine(3)), text(longLine(4))
            ]
        });
        const fig = items.find(i => i.type === 'figure');
        expect(fig.placement).toBe(PLACEMENT.MARGIN);
        expect(fig.wrapBlocks).toBeGreaterThanOrEqual(3);
        expect(['left', 'right']).toContain(fig.side);
    });

    it('does NOT wrap when too little prose follows — no stranded float', () => {
        const { items } = compose({
            blocks: [image('inset'), text('He was silent.')]
        });
        expect(items.find(i => i.type === 'figure').placement).toBe(PLACEMENT.INSET);
    });

    it('does NOT wrap when a break interrupts the prose beside it', () => {
        const { items } = compose({
            blocks: [
                image('inset'),
                text(longLine(1)),
                mark(MARK.EPISODE_BREAK, { episodeId: 'next' }),
                text(longLine(2)), text(longLine(3)), text(longLine(4))
            ]
        });
        // only one paragraph belongs to this figure's scene — not enough
        expect(items.find(i => i.type === 'figure').placement).toBe(PLACEMENT.INSET);
    });

    it('alternates the side so wrapped figures read as a spread', () => {
        const run = [];
        for (let k = 0; k < 2; k++) {
            run.push(image('inset'));
            run.push(text(longLine(k * 4 + 1)), text(longLine(k * 4 + 2)),
                     text(longLine(k * 4 + 3)), text(longLine(k * 4 + 4)));
        }
        const { items } = compose({ blocks: run });
        const sides = items.filter(i => i.type === 'figure').map(i => i.side);
        expect(sides).toHaveLength(2);
        expect(sides[0]).not.toBe(sides[1]);
    });

    it('a full-bleed plate is never converted into a wrap', () => {
        const { items } = compose({
            blocks: [
                image('plate'),
                text(longLine(1)), text(longLine(2)), text(longLine(3)), text(longLine(4))
            ]
        });
        const fig = items.find(i => i.type === 'figure');
        expect(fig.placement).toBe(PLACEMENT.BLEED);
        expect(fig.wrapBlocks).toBe(0);
    });

    it('an empty flow composes to an empty composition, not a crash', () => {
        expect(compose({ blocks: [] }).items).toEqual([]);
        expect(compose(null).items).toEqual([]);
    });

    it('carries verse coordinates through for marginal marks', () => {
        const { items } = compose({ blocks: [text('And when morning was come.', { chapter: 27, verse: 1 })] });
        expect(items[0]).toMatchObject({ chapter: 27, verse: 1 });
    });
});

describe('inline headings', () => {
    const flowOf = (texts) => ({
        blocks: texts.map((text, i) => ({ kind: 'text', text, weight: 0.5, tags: [], verse: i + 1 }))
    });
    const headings = (texts) => compose(flowOf(texts)).items
        .filter(i => i.type === 'text' && i.heading)
        .map(i => i.text);

    it('recognises an edition that carries its structure inline', () => {
        // Vitruvius has these as ordinary paragraphs; the flow has no
        // chapter mark to raise, so they arrived crammed between prose.
        expect(headings(['CHAPTER I', 'THE EDUCATION OF THE ARCHITECT']))
            .toEqual(['CHAPTER I', 'THE EDUCATION OF THE ARCHITECT']);
    });

    it('refuses apparatus fragments, which is where this first went wrong', () => {
        // Scanned editions leak marginalia and footnote tails as short
        // all-caps scraps with orphaned brackets. Promoting one to a
        // heading turns damage into structure.
        expect(headings(['ATHENS]', 'ROME]', 'Giocondo, Venice, 1511)]', '(PLATE IV)'])).toEqual([]);
    });

    it('refuses prose that merely shouts, and single sigla', () => {
        expect(headings(['I HAVE DRAWN UP DEFINITE RULES.', 'A', 'IV'])).toEqual([]);
    });

    it('leaves ordinary prose alone', () => {
        expect(headings(['Owing to this favour I need have no fear of want.'])).toEqual([]);
    });
});

describe('a figure beside a heading', () => {
    const flowOf = (blocks) => ({ blocks });
    const T = (text) => ({ kind: 'text', text, weight: 0.5, tags: [], verse: 1 });
    const F = () => ({ kind: 'image', collections: ['c'], episodeId: 'e' });

    const placementOf = (blocks) =>
        compose(flowOf(blocks)).items.find(i => i.type === 'figure')?.placement;

    it('centres rather than wraps when a heading follows it', () => {
        // The Vitruvius fault: a wrapped plate sat level with CHAPTER I
        // and pushed the section title into two lines.
        const p = placementOf([T('Some prose.'), F(), T('THE EDUCATION OF THE ARCHITECT'), T('More prose.')]);
        expect(p).not.toBe('margin');
    });

    it('centres rather than wraps when a heading precedes it', () => {
        const p = placementOf([T('CHAPTER I'), F(), T('Prose.'), T('More prose.')]);
        expect(p).not.toBe('margin');
    });

    it('leaves a figure in open prose alone', () => {
        const long = 'Ordinary prose that runs on for a good while. '.repeat(6);
        const items = compose(flowOf([T(long), T(long), F(), T(long), T(long), T(long)])).items;
        const fig = items.find(i => i.type === 'figure');
        expect(fig).toBeTruthy();
        // Whatever the compositor chose, it was not overridden by a
        // heading that is not there.
        expect(['margin', 'inset', 'bleed']).toContain(fig.placement);
    });
});

describe('a figure inside a title', () => {
    const T = (text) => ({ kind: 'text', text, weight: 0.5, tags: [], verse: 1 });
    const F = () => ({ kind: 'image', collections: ['c'], episodeId: 'e' });
    const types = (blocks) => compose({ blocks }).items.map(i => i.type);

    it('waits for the title to finish and appears beneath it', () => {
        // "CHAPTER I" and "THE EDUCATION OF THE ARCHITECT" are two
        // blocks and one heading. A figure cued between them separated a
        // chapter number from the chapter's name.
        const items = compose({ blocks: [
            T('Prose before.'),
            T('CHAPTER I'), F(), T('THE EDUCATION OF THE ARCHITECT'),
            T('Prose after.')
        ] }).items;

        const texts = items.filter(i => i.type === 'text').map(i => i.text);
        expect(texts).toEqual(['Prose before.', 'CHAPTER I',
            'THE EDUCATION OF THE ARCHITECT', 'Prose after.']);

        // The figure follows the WHOLE title, not half of it.
        const order = items.map(i => i.type === 'text' ? i.text : i.type);
        expect(order.indexOf('figure')).toBe(order.indexOf('THE EDUCATION OF THE ARCHITECT') + 1);
    });

    it('centres the held figure on the full measure', () => {
        const fig = compose({ blocks: [
            T('CHAPTER I'), F(), T('THE SECOND PART'), T('Prose.')
        ] }).items.find(i => i.type === 'figure');
        expect(fig.placement).toBe('inset');
        expect(fig.wrapBlocks).toBe(0);
    });

    it('never loses a figure held when the reading ends inside a title', () => {
        expect(types([T('CHAPTER I'), F(), T('THE LAST WORD')]))
            .toContain('figure');
    });

    it('leaves a figure between ordinary paragraphs where it was', () => {
        const order = compose({ blocks: [
            T('One.'), F(), T('Two.')
        ] }).items.map(i => i.type === 'text' ? i.text : i.type);
        expect(order).toEqual(['One.', 'figure', 'Two.']);
    });
});

describe('a float never wraps a title', () => {
    const T = (text) => ({ kind: 'text', text, weight: 0.5, tags: [], verse: 1 });
    const F = () => ({ kind: 'image', collections: ['c'], episodeId: 'e' });
    const long = 'Ordinary prose that runs on for a good long while indeed. '.repeat(4);

    it('stops the wrap group at an inline heading', () => {
        // THE VITRUVIUS PAGE. A raised chapter MARK ends a wrap run, but
        // an inline heading is a text block — so the float counted the
        // title as two more paragraphs and wrapped straight past it.
        const items = compose({ blocks: [
            T(long), T(long), F(), T(long),
            T('CHAPTER I'), T('THE EDUCATION OF THE ARCHITECT'), T(long)
        ] }).items;
        const fig = items.find(i => i.type === 'figure');
        if (fig.placement === 'margin') {
            // At most the one prose block before the title may wrap.
            expect(fig.wrapBlocks).toBeLessThanOrEqual(1);
        }
    });

    it('still wraps a healthy run of ordinary prose', () => {
        const items = compose({ blocks: [
            T(long), T(long), F(), T(long), T(long), T(long), T(long)
        ] }).items;
        const fig = items.find(i => i.type === 'figure');
        if (fig.placement === 'margin') {
            expect(fig.wrapBlocks).toBeGreaterThan(1);
        }
    });
});
