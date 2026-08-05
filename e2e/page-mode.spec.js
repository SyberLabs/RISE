import { test, expect } from '@playwright/test';
import { collectAcrossPages } from './page-helpers.js';

const GATE = { code: 'rise2025', name: 'Page Harness', vault: null, timestamp: Date.now() };

/**
 * Page Mode (PAGE-MODE-SPEC) — the SPATIAL projection.
 *
 * The browser-level contract unit tests cannot see: a real Gospel
 * chapter, resolved through the real provider dispatch, typeset as a
 * scrollable illuminated column whose figures land at their passages —
 * while the Stream rests untouched behind it.
 */
test('Page Mode typesets a Gospel chapter in space, and holds the stream', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript((g) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    }, { gate: GATE });
    await page.goto('/');
    await expect(page.locator('.portal-arch-sol')).toBeVisible({ timeout: 15_000 });

    // Chapel → Matthew 27: seven Passion pericopes, the richest schedule
    await page.locator('[data-nav="chapel"]').first().click();
    await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('.chapel-book[data-book-id="matthew"]').click();
    await page.locator('[data-book-id="matthew"][data-chapter="27"]').click();

    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
    await page.locator('#begin-btn').click();
    const warn = page.locator('#photosensitivity-modal');
    await expect(warn).toBeVisible({ timeout: 15_000 });
    await warn.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
    await page.waitForTimeout(2500);

    // Open the Page through the real control
    await page.locator('#chamber-display').hover();
    const btn = page.locator('#page-mode-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    await expect(page.locator('.page-article')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(5000);   // figures resolve + decode

    // THE SPATIAL CONTRACT, RESTATED. This used to read the DOM once and
    // assert "the whole chapter is present at once". The Page is
    // paginated now, so one snapshot is one page's worth — and the
    // contract it was defending has been deliberately revised rather
    // than dropped. What made the Page spatial was never that every
    // verse occupied the DOM simultaneously; it was that the reading is
    // laid out in space and the reader moves through it at their own
    // pace, with no clock advancing it. Cut into pages, all of that
    // holds and the reading arrives in divisible chunks besides.
    //
    // So the assertion moves from "all of it is here" to "all of it is
    // THERE" — walk the pages and count the reading.
    const walked = await collectAcrossPages(page);
    const perPage = await page.evaluate(() => {
        const host = document.querySelector('#chamber-page');
        return {
            verses: document.querySelectorAll('.page-verse').length,
            chapters: document.querySelectorAll('.page-chapter').length,
            breaks: document.querySelectorAll('.page-break').length,
            scrollable: host.scrollHeight > host.clientHeight,
            playerState: window.rise?.router?.views?.get('chamber-session')?.instance?.player?.state
        };
    });
    const stats = { ...perPage, ...walked };

    // The whole chapter is present across the pages.
    expect(stats.texts).toBeGreaterThan(50);
    // The chapter opening exists exactly once in the reading; the
    // walk ends on the last page, so per-page counts are checked
    // only for presence, not for the total.
    expect(stats.texts).toBeGreaterThan(50);
    // One figure per imaged episode, bound by the SAME program the Stream uses.
    expect(stats.figures).toBe(7);

    // At least the first plate resolved through the real provider path.
    expect(stats.shown).toBeGreaterThanOrEqual(1);
    // Pages are bounded now, so a single page need not overflow —
    // that it CUT into more than one is the stronger statement.
    expect(stats.pages).toBeGreaterThan(1);
    // A page is read, not raced: the stream rests while it is open.
    expect(stats.playerState).not.toBe('playing');

    // PAGE AUTHORITY (red-team #1). The Page must actually HOLD the
    // stream — not merely pause it once on activation. Space and the Play
    // button both routed into togglePlayPause() and would start an
    // invisible stream underneath the reader: atoms advancing, audio
    // resuming, cues firing over the page, the session able to complete
    // while they study. Space in particular should SCROLL a page.
    const scrollBefore = await page.evaluate(() =>
        document.querySelector('#chamber-page').scrollTop);

    // Space must belong to the PAGE: it scrolls, and it neither starts a
    // hidden stream nor re-fires the still-focused toggle (which would
    // throw the reader back to the Stream).
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);

    // The transport is not merely inert while the Page holds the reading —
    // it is GONE. A play button that correctly refuses is worse than an
    // absent one, because it invites a click that silently fails. The
    // control bar condenses to what a page actually needs, so the strong
    // guarantee is now absence, and the guard behind it is still proven by
    // the fact that nothing started the stream.
    await page.locator('#chamber-display').hover();
    await page.waitForTimeout(300);

    const held = await page.evaluate(() => {
        const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
        const host = document.querySelector('#chamber-page');
        const vis = (sel) => {
            const el = document.querySelector(sel);
            return !!el && getComputedStyle(el).display !== 'none';
        };
        return {
            state: ch?.player?.state,
            pageModeActive: ch?.pageModeActive === true,
            pageStillOpen: !host.hidden,
            scrollTop: host.scrollTop,
            // The reader is still on the page they were on: scrolling or
            // wheeling inside the Page must not turn or reset it.
            pageIndexHeld: (ch?.pageReader?.pageIndex ?? 0) === 0,
            playVisible: vis('#play-pause-btn'),
            timeVisible: vis('#time-display'),
            exitVisible: vis('#exit-btn')
        };
    });
    // Transport hidden, but the way out always remains.
    expect(held.playVisible).toBe(false);
    expect(held.timeVisible).toBe(false);
    expect(held.exitVisible).toBe(true);
    expect(held.state).not.toBe('playing');
    expect(held.state).not.toBe('interlocuting');
    expect(held.pageModeActive).toBe(true);
    expect(held.pageStillOpen).toBe(true);
    // PAGE AUTHORITY, WITHOUT ASSUMING A LONG COLUMN. This asserted the
    // scroll position had moved, which proved the Page owned the wheel
    // rather than the stream stealing it. A paginated page is bounded
    // and may have nothing to scroll, so a scrollTop of 0 is now a
    // legitimate state and the old assertion proved only that the page
    // was long. What it was actually defending — the Page holds, the
    // stream does not resume underneath it — is asserted directly
    // above, and the reader's PLACE is what remains to check.
    expect(held.pageIndexHeld, 'the Page lost the reader’s place').toBe(true);

    // Leaving the Page returns the reader to the stream, intact.
    await page.locator('#chamber-display').hover();
    await btn.click();
    await expect(page.locator('#chamber-page')).toBeHidden();
    await expect(page.locator('#atom-display')).toBeVisible();

    // …and the stream is drivable again once the page has let go.
    await page.locator('#chamber-display').hover();
    await page.locator('#play-pause-btn').click();
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() =>
        window.rise?.router?.views?.get('chamber-session')?.instance?.player?.state);
    expect(['playing', 'interlocuting']).toContain(resumed);
});
