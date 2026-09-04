/**
 * Helpers for paginated Page Mode (PAGE-MODE-SPEC §9).
 *
 * One page's DOM is one page; walk and accumulate when asserting about
 * the whole reading. Not named `*.spec.js` so Playwright's testDir
 * does not collect it as an empty suite.
 */

/**
 * Wait until each `.page-figure` is `is-shown` or `is-absent`.
 * Ceiling only; outcome assertions belong to the caller.
 */
async function settle(page, ceilingMs) {
    await page.waitForFunction(() => {
        const figures = document.querySelectorAll('.page-figure');
        if (!figures.length) return true;
        return [...figures].every(f =>
            f.classList.contains('is-shown') || f.classList.contains('is-absent'));
    }, null, { timeout: Math.max(4000, ceilingMs * 6) }).catch(() => {});
}

/**
 * Scroll a page's column to its end, letting each figure meet the viewport.
 *
 * Figures decode through an IntersectionObserver — correctly, so a reader is
 * never charged for imagery they have not reached. Walking by goToPage was
 * enough while the Page always opened paginated; the public Page opens as one
 * elongated composition, and in one column there is nothing to page to. The
 * walk that visits the whole reading has to travel the way the reader does.
 */
async function scrollThrough(page, ceilingMs) {
    const host = '#chamber-page';
    // Travel first and settle once. Settling at every step would spend the
    // ceiling on each of them and blow the test's own timeout; the observer
    // only needs each figure to have met the viewport, and the decodes then
    // finish together.
    let last = -1;
    for (let step = 0; step < 40; step += 1) {
        const at = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + el.clientHeight * 0.8);
            return { top: el.scrollTop, end: el.scrollHeight - el.clientHeight };
        }, host);
        if (!at) return;
        await page.waitForTimeout(120);
        if (at.top >= at.end || at.top === last) break;
        last = at.top;
    }
    await settle(page, ceilingMs);
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollTop = 0;
    }, host);
}

/**
 * Walk every page of an open Page Mode reader, accumulating counts.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 *   - settleMs: time to let figures resolve and decode on each page
 * @returns {Promise<{pages:number, texts:number, figures:number, shown:number, absent:number}>}
 */
export async function collectAcrossPages(page, options = {}) {
    const settleMs = Number.isFinite(options.settleMs) ? options.settleMs : 1200;

    const total = await page.evaluate(() => {
        const r = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
        return r?.pages?.length ?? 1;
    });

    const totals = { pages: total, texts: 0, figures: 0, shown: 0, absent: 0, distinct: 0 };
    const srcs = [];

    for (let i = 0; i < total; i++) {
        if (i > 0) {
            const turned = await page.evaluate((index) => {
                const r = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
                if (!r) return false;
                r.goToPage(index);
                return true;
            }, i);
            if (!turned) break;
        }
        // Settle page 0 as well — the walk starts there immediately.
        await settle(page, settleMs);
        // And travel the page itself, for the figures below its fold.
        await scrollThrough(page, settleMs);

        const slice = await page.evaluate(() => ({
            texts: document.querySelectorAll('.page-text').length,
            figures: document.querySelectorAll('.page-figure').length,
            shown: document.querySelectorAll('.page-figure.is-shown').length,
            absent: document.querySelectorAll('.page-figure.is-absent').length,
            // Distinct shown srcs across the whole reading, not one page.
            srcs: [...document.querySelectorAll('.page-figure.is-shown img')].map(i => i.src)
        }));

        totals.texts += slice.texts;
        totals.figures += slice.figures;
        totals.shown += slice.shown;
        totals.absent += slice.absent;
        srcs.push(...(slice.srcs || []));
    }

    totals.distinct = new Set(srcs).size;

    // Restore page 0 so callers that check place are not left on the last page.
    if (total > 1) {
        await page.evaluate(() => {
            const r = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
            r?.goToPage(0);
        });
        await settle(page, settleMs);
    }

    return totals;
}

/** How many pages the open reader cut itself into. */
export async function pageCount(page) {
    return page.evaluate(() => {
        const r = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
        return r?.pages?.length ?? 0;
    });
}
