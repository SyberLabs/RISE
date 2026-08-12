/**
 * Pagination — cut one unbounded Composition into bounded, navigable pages.
 *
 * Not spread (left/right) pagination (PAGE-MODE-SPEC §6 → v4). Same
 * Composition items the Stream uses (§9); pure line-unit estimates, no DOM.
 */

/**
 * Line-unit weights. Coarse estimates: break rules matter more than exact
 * line counts.
 */
export const PAGE_DEFAULTS = Object.freeze({
    /** Line units a page may hold before it must break. */
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
    focal: 5,
    // Leave room for prose beside plates; solo-plate pages read as slides.
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
        case 'focal':
            return WEIGHT.focal;
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
 * Group items into units that may not be split.
 *
 * A margin figure and its wrapBlocks prose are one atom: a page break
 * between them unmakes the float wrap.
 */
function toUnits(items, charsPerLine) {
    const units = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // A passage focal names the prose that follows it. Treat the focal
        // and the first corresponding text block as one pagination unit so
        // a page turn cannot strand the mark/image at the foot of a page.
        if (item.type === 'focal' && items[i + 1]?.type === 'text') {
            const prose = items[++i];
            units.push({
                items: [item, prose],
                weight: weighItem(item, charsPerLine) + weighItem(prose, charsPerLine),
                lead: 'focal'
            });
            continue;
        }
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
        // Shared vertical space: group weight is the taller of figure vs prose.
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
 * Chapter marks and inline chapter-like headings open a new page.
 * Without this, an inline "CHAPTER II" can land at the foot of chapter one.
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
    // Inline headings count too — same stranding fault as a raised mark.
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

        // Chapter openings start a page (a beginning at the foot is a widow).
        if ((unit.lead === 'chapter' || opensAChapter(unit.items[0]))
            && current.items.length) {
            seal();
        }

        // Prefer no two plates without prose between them on one page.
        // Never at the cost of a proseless page: R9 yields to that invariant.
        const lastOnPage = current.items[current.items.length - 1];
        const plateOnPlate = unit.lead === 'figure'
            && lastOnPage?.type === 'figure'
            && current.items.some(i => i.type === 'text');

        const fits = current.weight + unit.weight <= linesPerPage;
        if ((!fits || plateOnPlate) && current.items.length) {
            seal();
        }

        current.items.push(...unit.items);
        current.weight += unit.weight;

        // Oversize units take a page alone rather than split or drop.
        if (current.weight >= linesPerPage) {
            seal();
        }
    }
    seal();

    // Corrective passes, in order:
    // 1. Structure ≻ balance — no page ends on a heading/chapter/break.
    // 2. Balance last, checked against (1) — thin/proseless pages borrow or merge.

    // Pass 1 — no page ends on a heading.
    for (let p = 0; p < pages.length - 1; p++) {
        const page = pages[p];
        while (page.items.length > 1 && endsOnAHeading(page)) {
            const moved = page.items.pop();
            page.weight -= weighItem(moved, charsPerLine);
            pages[p + 1].items.unshift(moved);
            pages[p + 1].weight += weighItem(moved, charsPerLine);
        }
    }

    // Pass 2 — no thin/proseless page left alone (item-level widows).
    // Prefer borrowing from the prior page; else absorb within MERGE_TOLERANCE.
    // Whole items only — paragraphs are never split across boundaries.
    const MERGE_TOLERANCE = 1.25;

    for (let p = pages.length - 1; p > 0; p--) {
        const page = pages[p];
        // Proseless pages from R9 seals merge unless a single oversize plate.
        const proseless = !page.items.some(i => i.type === 'text');
        const oversize = page.items.length === 1
            && page.weight >= linesPerPage;
        if (page.items.length !== 1 && !(proseless && !oversize)) continue;
        if (page.items.length === 1 && page.items[0].type === 'figure'
            && oversize) continue;

        // Structure first: do not bury a chapter opening.
        if (opensAChapter(page.items[0])) continue;

        const prev = pages[p - 1];
        if (prev.items.length < 2) continue;

        const borrowed = prev.items[prev.items.length - 1];
        const remaining = prev.items[prev.items.length - 2];
        // Never borrow a plate onto a lone paragraph (trades for R9).
        const plate = borrowed.type === 'figure';
        // Donor must keep ≥2 items after the loan (avoids cascade to page 0).
        const affordable = prev.items.length >= 3;
        // Never borrow out of a wrap group (unmakes the float upstairs).
        let k = prev.items.length - 2;
        while (k >= 0 && prev.items[k].type === 'text') k--;
        const opener = k >= 0 ? prev.items[k] : null;
        const wrapped = opener && opener.type === 'figure'
            && opener.placement === 'margin' && Number(opener.wrapBlocks) > 0;
        // Honour pass 1: do not leave a heading at the donor's foot.
        const strands = endsOnAHeading({ items: [remaining] });

        if (!plate && affordable && !wrapped && !strands) {
            prev.items.pop();
            const w = weighItem(borrowed, charsPerLine);
            prev.weight -= w;
            page.items.unshift(borrowed);
            page.weight += w;
            continue;
        }

        // Absorb upward within tolerance; pass 1 must survive the merge.
        if (page.weight + prev.weight > linesPerPage * MERGE_TOLERANCE) continue;
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
 * Which page an item index landed on, for restoring position across a
 * re-cut (resize changes the budget). Returns 0 when not found.
 */
export function pageOfItem(pages, item) {
    if (!item || !Array.isArray(pages)) return 0;
    for (const page of pages) {
        if (page.items.includes(item)) return page.index;
    }
    return 0;
}
