/**
 * Pagination is a pure transform, so it is proven without a browser —
 * the discipline PAGE-MODE-SPEC §8 credits for making the flow and the
 * compositor solid.
 *
 * These tests assert the RULES, not the arithmetic. The weights are
 * deliberately coarse estimates: a page holding 24 line units instead of
 * 26 is a fine page, while a page that splits a wrapped figure from the
 * prose flowing beside it is a broken one.
 */
import { describe, it, expect } from 'vitest';
import { paginate, pageOfItem, PAGE_DEFAULTS } from './paginator.js';

const text = (chars, rhythm = 'normal') =>
    ({ type: 'text', text: 'x'.repeat(chars), rhythm });
const chapter = (n) => ({ type: 'chapter', chapter: n, rhythm: 'open' });
const brk = (rhythm = 'open') => ({ type: 'break', episodeId: 'e', rhythm });
const figure = (placement, wrapBlocks = 0) =>
    ({ type: 'figure', placement, wrapBlocks, work: { id: 'w' } });

const composition = (items) => ({ items, stats: {} });
const allItems = (pages) => pages.flatMap(p => p.items);

describe('paginate', () => {
    it('returns nothing for an empty composition rather than one empty page', () => {
        const { pages, stats } = paginate(composition([]));
        expect(pages).toEqual([]);
        expect(stats.pages).toBe(0);
    });

    it('keeps a short reading on a single page', () => {
        const items = [text(100), text(100), text(100)];
        const { pages } = paginate(composition(items));
        expect(pages).toHaveLength(1);
        expect(pages[0].items).toHaveLength(3);
    });

    it('loses nothing and reorders nothing across the cut', () => {
        // The one invariant that matters more than any layout rule: a
        // reading is the same reading after it is paginated.
        const items = [];
        for (let i = 0; i < 60; i++) {
            items.push(text(200));
            if (i % 7 === 0) items.push(brk());
            if (i % 11 === 0) items.push(figure('inset'));
        }
        const { pages } = paginate(composition(items));
        expect(pages.length).toBeGreaterThan(1);
        expect(allItems(pages)).toEqual(items);
    });

    it('honours the budget it is given', () => {
        const items = Array.from({ length: 40 }, () => text(66)); // ~1 line each
        const tight = paginate(composition(items), { linesPerPage: 10 });
        const loose = paginate(composition(items), { linesPerPage: 40 });
        expect(tight.pages.length).toBeGreaterThan(loose.pages.length);
        for (const page of tight.pages) {
            // A page may reach the budget but must not sail past it, except
            // where a single oversize unit had no choice.
            if (page.items.length > 1) expect(page.weight).toBeLessThanOrEqual(10 + 14);
        }
    });

    it('starts a page at a chapter opening', () => {
        const items = [
            text(200), text(200),
            chapter('II'),
            text(200)
        ];
        const { pages } = paginate(composition(items), { linesPerPage: 40 });
        // Everything fits in one budget, but a chapter is a beginning.
        expect(pages.length).toBeGreaterThan(1);
        const withChapter = pages.find(p => p.items.some(i => i.type === 'chapter'));
        expect(withChapter.items[0].type).toBe('chapter');
    });

    it('never ends a page on a heading', () => {
        // A chapter opening or an episode break promises what follows.
        // Stranded at the foot, the promise waits for a page turn.
        const items = [];
        for (let i = 0; i < 30; i++) {
            items.push(text(400));
            items.push(brk('still'));
        }
        const { pages } = paginate(composition(items), { linesPerPage: 12 });
        expect(pages.length).toBeGreaterThan(2);
        for (const page of pages.slice(0, -1)) {
            const last = page.items[page.items.length - 1];
            expect(last.type, `page ${page.index} ends on a ${last.type}`).not.toBe('break');
            expect(last.type).not.toBe('chapter');
        }
    });

    it('keeps a wrapped figure with the prose that flows beside it', () => {
        // A float only wraps text that follows it in the same containing
        // block. Splitting the pair does not look wrong — it unmakes the
        // wrap and orphans the figure.
        const fig = figure('margin', 3);
        const a = text(300), b = text(300), c = text(300);
        const items = [text(900), text(900), fig, a, b, c, text(300)];
        const { pages } = paginate(composition(items), { linesPerPage: 16 });

        const figPage = pages.find(p => p.items.includes(fig));
        expect(figPage.items).toContain(a);
        expect(figPage.items).toContain(b);
        expect(figPage.items).toContain(c);
    });

    it('gives a genuinely oversize plate its own page rather than splitting or dropping it', () => {
        // "Oversize" means larger than the whole budget — a short frame,
        // not merely a big picture. A plate that FITS must not be
        // isolated; see the next test.
        const plate = figure('bleed');
        const items = [text(200), plate, text(200)];
        const { pages } = paginate(composition(items), { linesPerPage: 8 });
        const platePage = pages.find(p => p.items.includes(plate));
        expect(platePage.items).toHaveLength(1);
        // And it is still in the reading, in order.
        expect(allItems(pages)).toEqual(items);
    });

    it('consecutive plates share a page rather than each taking one', () => {
        // THE ATTRACTOR FAULT. A reading with several procedural stills
        // produced a page carrying nothing but one full-panel visual.
        // A solo plate is a slide, and this is a reader.
        const items = [text(400), figure('bleed'), text(400), figure('bleed'), text(400)];
        const { pages } = paginate(composition(items));
        for (const page of pages) {
            const onlyAFigure = page.items.length === 1 && page.items[0].type === 'figure';
            expect(onlyAFigure, `page ${page.index} is a lone plate`).toBe(false);
        }
    });

    it('holds a useful amount of prose on one page', () => {
        // A page that could carry more text and does not is a page turn
        // the reader did not need.
        const items = Array.from({ length: 40 }, () => text(280)); // ~5 lines each
        const { pages } = paginate(composition(items));
        expect(pages[0].items.length).toBeGreaterThanOrEqual(5);
    });

    it('a wrapped figure at the very end takes the prose that exists', () => {
        // wrapBlocks may exceed what remains; the group must not run past
        // the end of the composition or swallow a non-text item.
        const fig = figure('margin', 5);
        const tail = text(100);
        const items = [fig, tail];
        const { pages } = paginate(composition(items));
        expect(allItems(pages)).toEqual(items);
    });

    it('a wrapped figure does not swallow a chapter that follows it', () => {
        const fig = figure('margin', 4);
        const ch = chapter('III');
        const items = [fig, text(100), ch, text(100)];
        const { pages } = paginate(composition(items), { linesPerPage: 40 });
        // The chapter still opens its own page, so it was never absorbed
        // into the wrap group.
        const chPage = pages.find(p => p.items.includes(ch));
        expect(chPage.items[0]).toBe(ch);
    });

    it('R9 — never puts two plates on a page with nothing between them', () => {
        const items = [text(200), figure('bleed'), figure('bleed'), text(200)];
        const { pages } = paginate(composition(items));
        for (const page of pages) {
            const figs = page.items.filter(i => i.type === 'figure');
            if (figs.length < 2) continue;
            // If two share a page, prose stands between them.
            const first = page.items.indexOf(figs[0]);
            const second = page.items.indexOf(figs[1]);
            const between = page.items.slice(first + 1, second);
            expect(between.some(i => i.type === 'text'),
                `page ${page.index} stacks plates`).toBe(true);
        }
        expect(allItems(pages)).toEqual(items);
    });

    it('R4 — does not leave one lonely paragraph on a page of its own', () => {
        // The classic widow cannot occur — whole items move, so a
        // paragraph is never split. This is its item-level cousin: a
        // trailing block alone on a page reads as a reading that ran
        // out rather than one that was composed.
        const items = Array.from({ length: 13 }, () => text(330));
        const { pages } = paginate(composition(items), { linesPerPage: 12 });
        const last = pages[pages.length - 1];
        if (pages.length > 1) {
            expect(last.items.length, 'a page was left with one paragraph').toBeGreaterThan(1);
        }
        expect(allItems(pages)).toEqual(items);
    });

    it('R4 leaves a plate that earned its own page alone', () => {
        const plate = figure('bleed');
        const items = [text(200), plate, text(200)];
        const { pages } = paginate(composition(items), { linesPerPage: 8 });
        const platePage = pages.find(p => p.items.includes(plate));
        expect(platePage.items).toHaveLength(1);
    });

    it('reports a budget it can actually honour', () => {
        const { stats } = paginate(composition([text(100)]), { linesPerPage: 1, charsPerLine: 1 });
        // Absurd inputs are clamped rather than producing a page per word.
        expect(stats.linesPerPage).toBeGreaterThanOrEqual(6);
        expect(stats.charsPerLine).toBeGreaterThanOrEqual(20);
    });

    it('defaults are used when nothing is supplied', () => {
        const { stats } = paginate(composition([text(100)]));
        expect(stats.linesPerPage).toBe(PAGE_DEFAULTS.linesPerPage);
        expect(stats.charsPerLine).toBe(PAGE_DEFAULTS.charsPerLine);
    });

    it('indexes describe the final cut, not an intermediate one', () => {
        const items = Array.from({ length: 50 }, (_, i) => i % 6 === 0 ? brk() : text(300));
        const { pages } = paginate(composition(items), { linesPerPage: 10 });
        pages.forEach((page, i) => expect(page.index).toBe(i));
    });
});

describe('pageOfItem', () => {
    it('finds the page an item landed on, so a re-cut can restore the reader', () => {
        const marker = text(120);
        const items = [...Array.from({ length: 20 }, () => text(300)), marker,
                       ...Array.from({ length: 20 }, () => text(300))];
        const { pages } = paginate(composition(items), { linesPerPage: 12 });
        const p = pageOfItem(pages, marker);
        expect(pages[p].items).toContain(marker);
    });

    it('falls back to the first page rather than nowhere', () => {
        const { pages } = paginate(composition([text(100)]));
        expect(pageOfItem(pages, { type: 'text', text: 'absent' })).toBe(0);
        expect(pageOfItem(pages, null)).toBe(0);
        expect(pageOfItem(null, {})).toBe(0);
    });
});
