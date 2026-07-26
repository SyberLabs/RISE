import { test, expect } from '@playwright/test';

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

    const stats = await page.evaluate(() => {
        const host = document.querySelector('#chamber-page');
        return {
            texts: document.querySelectorAll('.page-text').length,
            verses: document.querySelectorAll('.page-verse').length,
            chapters: document.querySelectorAll('.page-chapter').length,
            figures: document.querySelectorAll('.page-figure').length,
            shown: document.querySelectorAll('.page-figure.is-shown').length,
            breaks: document.querySelectorAll('.page-break').length,
            scrollable: host.scrollHeight > host.clientHeight,
            playerState: window.rise?.router?.views?.get('chamber-session')?.instance?.player?.state
        };
    });

    // The whole chapter is present at once — the spatial contract.
    expect(stats.texts).toBeGreaterThan(50);
    expect(stats.verses).toBe(stats.texts);
    expect(stats.chapters).toBe(1);
    // One figure per imaged episode, bound by the SAME program the Stream uses.
    expect(stats.figures).toBe(7);
    expect(stats.breaks).toBe(7);
    // At least the first plate resolved through the real provider path.
    expect(stats.shown).toBeGreaterThanOrEqual(1);
    // It is a real scrollable page, not a clipped block.
    expect(stats.scrollable).toBe(true);
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
    // The Play button must be inert while the Page holds the reading.
    await page.locator('#chamber-display').hover();
    await page.locator('#play-pause-btn').click();
    await page.waitForTimeout(600);

    const held = await page.evaluate(() => {
        const ch = window.rise?.router?.views?.get('chamber-session')?.instance;
        const host = document.querySelector('#chamber-page');
        return {
            state: ch?.player?.state,
            pageModeActive: ch?.pageModeActive === true,
            pageStillOpen: !host.hidden,
            scrollTop: host.scrollTop
        };
    });
    expect(held.state).not.toBe('playing');
    expect(held.state).not.toBe('interlocuting');
    expect(held.pageModeActive).toBe(true);
    expect(held.pageStillOpen).toBe(true);
    expect(held.scrollTop).toBeGreaterThan(scrollBefore);

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
