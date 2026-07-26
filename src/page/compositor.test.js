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

    it('an empty flow composes to an empty composition, not a crash', () => {
        expect(compose({ blocks: [] }).items).toEqual([]);
        expect(compose(null).items).toEqual([]);
    });

    it('carries verse coordinates through for marginal marks', () => {
        const { items } = compose({ blocks: [text('And when morning was come.', { chapter: 27, verse: 1 })] });
        expect(items[0]).toMatchObject({ chapter: 27, verse: 1 });
    });
});
