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
    /** Line units a page may hold before it must break. */
    linesPerPage: 26,
    /** Characters the measure fits on one line, for estimating prose. */
    charsPerLine: 66
});

const WEIGHT = Object.freeze({
    chapter: 6,      // display type plus its generous margins
    breakStill: 4,   // a works-less episode earns deliberate air
    breakOpen: 2,
    pause: 1,
    symbol: 3,
    figureBleed: 14, // a full plate
    figureInset: 10,
    figureMargin: 8  // wrapped: prose runs beside it, so it costs less
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

/** A heading with nothing under it is not a page. */
function endsOnAHeading(page) {
    const last = page.items[page.items.length - 1];
    return !!last && (last.type === 'chapter' || last.type === 'break');
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
        if (unit.lead === 'chapter' && current.items.length) {
            seal();
        }

        const fits = current.weight + unit.weight <= linesPerPage;
        if (!fits && current.items.length) {
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

    // NO PAGE ENDS ON A HEADING. A chapter opening or an episode break is
    // a promise about what follows; leaving it as the last thing on a
    // page breaks the promise until the reader turns. Push it forward.
    for (let p = 0; p < pages.length - 1; p++) {
        const page = pages[p];
        while (page.items.length > 1 && endsOnAHeading(page)) {
            const moved = page.items.pop();
            page.weight -= weighItem(moved, charsPerLine);
            pages[p + 1].items.unshift(moved);
            pages[p + 1].weight += weighItem(moved, charsPerLine);
        }
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
