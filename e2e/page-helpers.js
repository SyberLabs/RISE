/**
 * Helpers for a PAGINATED Page Mode.
 *
 * Page Mode used to lay the whole reading out in one column, so a single
 * DOM snapshot answered "does this reading contain imagery?". It is now
 * cut into pages (PAGE-MODE-SPEC §9, an alternate renderer over the same
 * Composition), and one page's DOM is one page's worth — which is the
 * entire point of the change and also the reason four tests that counted
 * `.page-figure` began reporting zero.
 *
 * The assertions those tests make are about THE READING, not about one
 * screenful of it, so the instrument has to cover the reading: turn every
 * page and accumulate. That is also what a reader does.
 *
 * Not named `*.spec.js` on purpose — Playwright's testDir would collect
 * it as a suite with no tests in it.
 */

/**
 * Wait for a page's figures to STOP BEING PENDING, rather than for a
 * fixed number of milliseconds.
 *
 * A blind sleep is the defect Phase 0 spent a session removing: it fails
 * when the machine is slow and wastes time when it is fast. A figure
 * resolves and decodes asynchronously, and it announces its own outcome
 * — `is-shown` or `is-absent` — so that is what to wait on. The timeout
 * is a ceiling, not the mechanism.
 *
 * Returns nothing; a page that never settles simply proceeds, because
 * the assertion about it belongs to the test, not to the helper.
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
        const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
        return r?.pages?.length ?? 1;
    });

    const totals = { pages: total, texts: 0, figures: 0, shown: 0, absent: 0, distinct: 0 };
    const srcs = [];

    for (let i = 0; i < total; i++) {
        if (i > 0) {
            const turned = await page.evaluate((index) => {
                const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
                if (!r) return false;
                r.goToPage(index);
                return true;
            }, i);
            if (!turned) break;
        }
        // Page ZERO needs settling too. It was counted the instant the
        // walk began, on the assumption the caller had already waited —
        // which is an assumption, not a wait.
        await settle(page, settleMs);

        const slice = await page.evaluate(() => ({
            texts: document.querySelectorAll('.page-text').length,
            figures: document.querySelectorAll('.page-figure').length,
            shown: document.querySelectorAll('.page-figure.is-shown').length,
            absent: document.querySelectorAll('.page-figure.is-absent').length,
            // Gathered across pages so "each sample is a different state"
            // can be asserted about the READING; a per-page Set would
            // only ever see one page's worth.
            srcs: [...document.querySelectorAll('.page-figure.is-shown img')].map(i => i.src)
        }));

        totals.texts += slice.texts;
        totals.figures += slice.figures;
        totals.shown += slice.shown;
        totals.absent += slice.absent;
        srcs.push(...(slice.srcs || []));
    }

    totals.distinct = new Set(srcs).size;

    // PUT IT BACK. A walk that leaves the reader on the last page is not
    // a measurement, it is an edit — and it silently broke the
    // page-authority assertion that checks the reader has not moved.
    if (total > 1) {
        await page.evaluate(() => {
            const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
            r?.goToPage(0);
        });
        await settle(page, settleMs);
    }

    return totals;
}

/** How many pages the open reader cut itself into. */
export async function pageCount(page) {
    return page.evaluate(() => {
        const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
        return r?.pages?.length ?? 0;
    });
}
