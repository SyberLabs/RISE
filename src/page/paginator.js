/**
 * Pagination — an alternate renderer's view of the same Composition.
 *
 * WHICH PAGINATION THIS IS. `PAGE-MODE-SPEC` §6 excludes "spread
 * pagination (book-like left/right pages)" from v1 and places it at v4,
 * behind the grid engine and master pages. This is not that. This is the
 * other thing the same word names: cutting one unbounded column into
 * BOUNDED, NAVIGABLE PAGES, so a reading arrives in divisible chunks
 * instead of laying its entire length out at once.
 *
 * The spec's architecture is what makes it cheap. A Composition is a flat
 * array of renderer-agnostic items, and §9 says every later projection is
 * "an enrichment of the compositor or an alternate renderer over the same
 * Composition — never a fork of the flow." So this module reads a
 * Composition and returns pages of the very same items. The flow is
 * untouched, the compositor is untouched, and the Stream and the Page
 * still cannot disagree about which image belongs to which passage.
 *
 * IT IS PURE, AND THAT IS THE POINT. It never measures a DOM, because a
 * transform that needs a browser cannot be proven in one. It estimates in
 * LINE UNITS from a budget the renderer supplies, and every rule about
 * where a page may break lives here where it can be read and tested,
 * rather than in a layout pass where it can only be observed.
 */

/**
 * Line-unit weights. These are estimates, not measurements, and they are
 * deliberately coarse: a page that holds twenty-six lines instead of
 * twenty-eight is a fine page, while a page that splits a figure from its
 * caption is a broken one. The rules below matter more than the numbers.
 */
export const PAGE_DEFAULTS = Object.freeze({
    /** Line units a page may hold before it must break.
     *  Raised from 26 after reading real pages: 26 left a short column
     *  in a tall frame, and a page that could hold more text and does
     *  not is just a page turn the reader did not need. */
    linesPerPage: 34,
    /** Characters the measure fits on one line, for estimating prose. */
    charsPerLine: 66
});

const WEIGHT = Object.freeze({
    chapter: 6,      // display type plus its generous margins
    breakStill: 4,   // a works-less episode earns deliberate air
    breakOpen: 2,
    pause: 1,
    symbol: 3,
    // FIGURES COST LESS THAN THEY DID, and the reason is a real fault
    // seen in an Attractor reading: a page arrived carrying nothing but
    // one full-panel still. At the old weights two consecutive plates
    // (14 + 14) blew a 26-line budget, so the first was sealed onto a
    // page by itself — a solo plate is a slide, and this is a reader,
    // not a slideshow. At 10 against 34 they share a page with prose
    // between them, which is what the compositor's rhythm intended.
    figureBleed: 10, // a full plate
    figureInset: 7,
    figureMargin: 6  // wrapped: prose runs beside it, so it costs less
});

const RHYTHM_EXTRA = Object.freeze({ still: 2, open: 1, tight: 0, normal: 0 });

/** Estimated line units for a single composition item. */
function weighItem(item, charsPerLine) {
    if (!item) return 0;
    switch (item.type) {
        case 'chapter':
            return WEIGHT.chapter;
        case 'break':
            return item.rhythm === 'still' ? WEIGHT.breakStill : WEIGHT.breakOpen;
        case 'pause':
            return WEIGHT.pause;
        case 'symbol':
            return WEIGHT.symbol;
        case 'figure': {
            if (item.placement === 'bleed') return WEIGHT.figureBleed;
            if (item.placement === 'margin') return WEIGHT.figureMargin;
            return WEIGHT.figureInset;
        }
        case 'text': {
            const chars = String(item.text || '').length;
            const lines = Math.max(1, Math.ceil(chars / Math.max(1, charsPerLine)));
            // An inline heading carries the air the CSS gives it.
            if (item.heading) return lines + 3;
            return lines + (RHYTHM_EXTRA[item.rhythm] ?? 0);
        }
        default:
            return 1;
    }
}

/**
 * Group items into UNITS that may not be split.
 *
 * The only true atom larger than an item is a wrapped figure and the
 * prose the compositor assigned to flow beside it: a float only wraps
 * text that follows it in the same containing block, so a page break
 * between them does not merely look wrong — it unmakes the wrap and
 * leaves an orphaned figure above prose that no longer runs beside
 * anything. The renderer already builds them as one element for exactly
 * this reason; pagination has to know the same fact.
 */
function toUnits(items, charsPerLine) {
    const units = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isWrap = item.type === 'figure'
            && item.placement === 'margin'
            && Number(item.wrapBlocks) > 0;

        if (!isWrap) {
            units.push({ items: [item], weight: weighItem(item, charsPerLine), lead: item.type });
            continue;
        }

        const group = [item];
        let taken = 0;
        while (taken < item.wrapBlocks && i + 1 < items.length) {
            const next = items[i + 1];
            if (next.type !== 'text') break;
            group.push(items[++i]);
            taken++;
        }
        // The figure and the prose share vertical space rather than
        // stacking, so the group costs the taller of the two.
        const prose = group.slice(1).reduce((n, b) => n + weighItem(b, charsPerLine), 0);
        units.push({
            items: group,
            weight: Math.max(weighItem(item, charsPerLine), prose),
            lead: 'figure'
        });
    }
    return units;
}

/**
 * Does this item open a chapter?
 *
 * A raised chapter MARK already forces a page. An edition that carries
 * its structure inline gives the same event as a text block, and
 * without this it merely lands wherever the budget put it — which is
 * how "CHAPTER II" and the first paragraph of chapter two arrived as
 * the last lines of chapter one's page.
 */
function opensAChapter(item) {
    if (!item) return false;
    if (item.type === 'chapter') return true;
    if (item.type !== 'text' || item.heading !== true) return false;
    return /^(chapter|book|part|canto)\b/i.test(String(item.text || '').trim());
}

/** A heading with nothing under it is not a page. */
function endsOnAHeading(page) {
    const last = page.items[page.items.length - 1];
    if (!last) return false;
    // A paragraph the compositor read AS a heading is one too: an
    // edition that carries "CHAPTER I" inline should not have it
    // stranded at the foot any more than a raised chapter mark.
    return last.type === 'chapter' || last.type === 'break'
        || (last.type === 'text' && last.heading === true);
}

/**
 * Cut a Composition into pages.
 *
 * @param {{items: Array}} composition - from compose()
 * @param {Object} [options]
 *   - linesPerPage {number} the budget; the renderer derives it from the viewport
 *   - charsPerLine {number} the measure, for estimating prose
 * @returns {{pages: Array<{index:number, items:Array, weight:number}>, stats: Object}}
 */
export function paginate(composition, options = {}) {
    const items = Array.isArray(composition?.items) ? composition.items : [];
    const linesPerPage = Math.max(6, Number(options.linesPerPage) || PAGE_DEFAULTS.linesPerPage);
    const charsPerLine = Math.max(20, Number(options.charsPerLine) || PAGE_DEFAULTS.charsPerLine);

    if (!items.length) {
        return { pages: [], stats: { pages: 0, items: 0, linesPerPage, charsPerLine } };
    }

    const units = toUnits(items, charsPerLine);
    const pages = [];
    let current = { index: 0, items: [], weight: 0 };

    const seal = () => {
        if (current.items.length) pages.push(current);
        current = { index: pages.length, items: [], weight: 0 };
    };

    for (let u = 0; u < units.length; u++) {
        const unit = units[u];

        // A CHAPTER OPENS A PAGE. It is the one item in the vocabulary
        // that is a beginning, and a beginning at the foot of a page is a
        // widow with a drop cap.
        if ((unit.lead === 'chapter' || opensAChapter(unit.items[0]))
            && current.items.length) {
            seal();
        }

        // R9 — NO TWO PLATES WITHOUT PROSE BETWEEN THEM. The compositor
        // limits consecutive bleeds in the COLUMN; a page is a second
        // frame it cannot see, and two plates arriving on one with
        // nothing between them read as a contact sheet rather than a
        // reading. (Marked in the canon as my judgement, not book
        // practice — a printed page happily carries two plates. A page
        // this small, on a phone, does not.)
        const lastOnPage = current.items[current.items.length - 1];
        // …but never at the cost of a proseless page. Three plates in a
        // row cannot satisfy R9 without stranding one alone, and a page
        // carrying only pictures is a worse fault than two plates
        // sharing one. R9 is a preference; prose on every page is not.
        const plateOnPlate = unit.lead === 'figure'
            && lastOnPage?.type === 'figure'
            && current.items.some(i => i.type === 'text');

        const fits = current.weight + unit.weight <= linesPerPage;
        if ((!fits || plateOnPlate) && current.items.length) {
            seal();
        }

        current.items.push(...unit.items);
        current.weight += unit.weight;

        // An oversize unit — a full plate on a short screen — takes the
        // page alone rather than being split, which is not possible, or
        // dropped, which would be worse.
        if (current.weight >= linesPerPage) {
            seal();
        }
    }
    seal();

    // ─────────────────────────────────────────────────────────────────
    // THE CORRECTIVE PASSES, AND THEIR PRECEDENCE.
    //
    // The fill loop above establishes the cut. Two passes then correct
    // it, and the ORDER between them is a decision, not an accident —
    // they were previously written as separate patches that each assumed
    // they ran last, and they undid one another three ways: the balance
    // pass buried a chapter opening under borrowed prose, the heading
    // pass stranded a page holding one item, and the balance pass's own
    // cascade walked a thin page from the tail of a reading all the way
    // to page one, where the reader meets it first.
    //
    // The precedence, stated once:
    //
    //   1. STRUCTURE outranks balance. A heading is a promise about what
    //      follows and a chapter is a beginning; neither is negotiable
    //      for the sake of an evenly filled page.
    //   2. BALANCE runs last, and may not violate structure. Every move
    //      it makes is checked against what pass 1 established rather
    //      than assumed to be compatible with it.
    //
    // Nothing after pass 2 re-runs pass 1, because pass 2 is constrained
    // by construction. That is the difference between an ordering and a
    // pile of patches.
    // ─────────────────────────────────────────────────────────────────

    // PASS 1 — NO PAGE ENDS ON A HEADING. A chapter opening or an
    // episode break is a promise about what follows; leaving it as the
    // last thing on a page breaks the promise until the reader turns.
    for (let p = 0; p < pages.length - 1; p++) {
        const page = pages[p];
        while (page.items.length > 1 && endsOnAHeading(page)) {
            const moved = page.items.pop();
            page.weight -= weighItem(moved, charsPerLine);
            pages[p + 1].items.unshift(moved);
            pages[p + 1].weight += weighItem(moved, charsPerLine);
        }
    }

    // PASS 2 — NO PAGE ALONE WITH ONE PARAGRAPH.
    //
    // The classic widow and orphan cannot occur here, and it is worth
    // saying why: this paginator moves WHOLE items, so a paragraph is
    // never split across a boundary and no single line is ever
    // stranded. What can happen is the item-level cousin — a page
    // carrying one short block, usually the tail of a reading, which
    // reads as a page that ran out rather than one that was composed.
    //
    // The preferred fix is the compositor's, not the cram: the thin page
    // BORROWS the block above, so both pages have something to say and
    // neither exceeds its budget — exactly what a compositor does when
    // it pushes a line back to balance a spread. But a donor that cannot
    // afford the loan must not give one, or the thin page simply moves
    // upstream. Where borrowing would only relocate the fault, the thin
    // page is absorbed instead, within a tolerance the frame already
    // allows.
    const MERGE_TOLERANCE = 1.25;

    for (let p = pages.length - 1; p > 0; p--) {
        const page = pages[p];
        // A page with no PROSE on it at all is the fault R9 can create
        // while preventing its own: sealing before a second plate can
        // leave the first — or the second — standing alone. A plate that
        // genuinely could not fit still earns its page (it is the only
        // item and it overruns the budget); a plate merely sealed away
        // from another does not.
        const proseless = !page.items.some(i => i.type === 'text');
        const oversize = page.items.length === 1
            && page.weight >= linesPerPage;
        if (page.items.length !== 1 && !(proseless && !oversize)) continue;
        if (page.items.length === 1 && page.items[0].type === 'figure'
            && oversize) continue;

        // STRUCTURE FIRST: a chapter opens a page. Prose borrowed down
        // onto it, or the page folded into the one above, both bury the
        // beginning the fill loop deliberately sealed.
        if (opensAChapter(page.items[0])) continue;

        const prev = pages[p - 1];
        if (prev.items.length < 2) continue;

        const borrowed = prev.items[prev.items.length - 1];
        const remaining = prev.items[prev.items.length - 2];
        // Never borrow a plate down onto a lone paragraph: that trades
        // this fault for R9's.
        const plate = borrowed.type === 'figure';
        // A donor of two items becomes a thin page itself, and the
        // descending walk then borrows from ITS donor, and so on — which
        // is how a stranded page at the end of a reading arrived at page
        // one instead. A loan needs a donor that can afford it.
        const affordable = prev.items.length >= 3;
        // AND NEVER OUT OF A WRAP GROUP. A margin figure and the prose
        // that flows beside it are one atom — the float only wraps text
        // that follows it in the same containing block, so borrowing a
        // paragraph out of the group unmakes the wrap upstairs to fix a
        // thin page downstairs. Walk back through the run of prose: if
        // it began at a wrapped figure, this block is spoken for.
        let k = prev.items.length - 2;
        while (k >= 0 && prev.items[k].type === 'text') k--;
        const opener = k >= 0 ? prev.items[k] : null;
        const wrapped = opener && opener.type === 'figure'
            && opener.placement === 'margin' && Number(opener.wrapBlocks) > 0;
        // PASS 1's invariant, honoured rather than re-run: taking the
        // last block off a page must not leave a heading standing at its
        // foot.
        const strands = endsOnAHeading({ items: [remaining] });

        if (!plate && affordable && !wrapped && !strands) {
            prev.items.pop();
            const w = weighItem(borrowed, charsPerLine);
            prev.weight -= w;
            page.items.unshift(borrowed);
            page.weight += w;
            continue;
        }

        // Borrowing is unavailable or would only move the fault. Absorb
        // the thin page upward instead, but only within a tolerance the
        // frame genuinely has — the renderer already budgets for an
        // overrun, and one slightly long page beats a page that ran out.
        if (page.weight + prev.weight > linesPerPage * MERGE_TOLERANCE) continue;
        // Merging puts this page's tail at the foot of the one above, so
        // pass 1's invariant has to survive it too.
        if (endsOnAHeading(page) && p < pages.length - 1) continue;
        prev.items.push(...page.items);
        prev.weight += page.weight;
        pages.splice(p, 1);
    }

    // Indexes are assigned last so they always describe the final cut.
    pages.forEach((page, i) => { page.index = i; });

    return {
        pages,
        stats: {
            pages: pages.length,
            items: items.length,
            linesPerPage,
            charsPerLine
        }
    };
}

/**
 * Which page an item index landed on, for restoring a reader's position
 * across a re-cut (a resize changes the budget and therefore the pages).
 * Returns 0 when the item is not found, because the first page is always
 * a safe place to be.
 */
export function pageOfItem(pages, item) {
    if (!item || !Array.isArray(pages)) return 0;
    for (const page of pages) {
        if (page.items.includes(item)) return page.index;
    }
    return 0;
}
