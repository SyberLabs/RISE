import { test, expect } from '@playwright/test';
import { collectAcrossPages, pageCount } from './page-helpers.js';

const GATE = { code: 'rise2025', name: 'Page Harness', vault: null, timestamp: Date.now() };

/**
 * Page Mode (PAGE-MODE-SPEC) — spatial projection in the browser:
 * real chapter typeset in space while Stream rests behind it.
 */
test('Page Mode typesets a Gospel chapter in space, and holds the stream', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript((g) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    }, { gate: GATE });

    // This test is about Page COMPOSITION, pagination, figure accounting,
    // and Stream suspension — not museum-CDN availability. Make the remote
    // artwork outcome deterministic: every off-origin image request fails
    // fast, so each figure reverently terminalizes to `is-absent` instead
    // of the paginated walk waiting on live network. (Successful network
    // resolution belongs to a dedicated imagery test.)
    await page.route('**/*', (route) => {
        const req = route.request();
        if (req.resourceType() === 'image' && !req.url().includes('127.0.0.1')) {
            return route.abort();
        }
        return route.continue();
    });

    await page.goto('/');
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });

    // Chapel → Matthew 27: seven Passion pericopes, the richest schedule
    await page.locator('[data-nav="chapel"]').first().click();
    await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('.chapel-book[data-book-id="matthew"]').click();
    await page.locator('[data-book-id="matthew"][data-chapter="27"]').click();

    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
    await page.locator('#begin-btn').click();
    // The notice appears only for a flashing presentation; Gallery opens
    // straight into the reading. This test is not about the gate, so it
    // accepts one if offered and proceeds if not.
    const warn = page.locator('#photosensitivity-modal');
    await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    if (await warn.isVisible()) await warn.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
    await page.waitForTimeout(2500);

    // Open the Page through the real control
    await page.locator('#chamber-display').hover();
    const btn = page.locator('#page-mode-btn');
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    await expect(page.locator('.page-article')).toBeVisible({ timeout: 10_000 });

    // Walk pages: assert the whole reading, not one DOM snapshot. The walk
    // settles each page's figures to a terminal state itself; a fixed wait
    // here would only pay for a primitive the helper already provides.
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
    // One figure per imaged episode (same program as Stream).
    expect(stats.figures).toBe(7);

    // Every figure reaches a terminal state — shown or absent — and none
    // is left pending/broken in the completed walk. With off-origin imagery
    // aborted above, the reverent-degradation path is the one exercised.
    expect(stats.shown + stats.absent).toBe(stats.figures);
    // THE PUBLIC PAGE OPENS AS ONE ELONGATED COMPOSITION. It had opened
    // paginated: the Chamber passes Number.POSITIVE_INFINITY to say "no
    // threshold", and the reader's guard used Number.isFinite — false for
    // Infinity — so the value was discarded for the default of 4.
    expect(stats.pages, 'one column, not pages').toBe(1);
    expect(stats.playerState).not.toBe('playing');

    // And this reading is still long enough for the two projections to
    // differ, which is what the old page-count assertion was really for.
    await page.locator('#chamber-display').hover();
    await page.locator('#page-elongate').click();
    await expect.poll(() => pageCount(page), { timeout: 10_000 }).toBeGreaterThan(1);
    await page.locator('#page-elongate').click();
    await expect.poll(() => pageCount(page), { timeout: 10_000 }).toBe(1);

    // Page holds Stream: Space/Play must not start playback underneath.
    const scrollBefore = await page.evaluate(() =>
        document.querySelector('#chamber-page').scrollTop);

    await page.keyboard.press('Space');
    await page.waitForTimeout(600);

    // Transport hidden on Page; exit remains. Stream must stay stopped.
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
            // Place held: in-page scroll/wheel must not turn pages.
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
    expect(held.pageIndexHeld, 'the Page lost the reader’s place').toBe(true);

    // Leaving Page restores Stream.
    await page.locator('#chamber-display').hover();
    await btn.click();
    await expect(page.locator('#chamber-page')).toBeHidden();
    await expect(page.locator('#atom-display')).toBeVisible();

    // Stream is drivable again after leaving Page.
    await page.locator('#chamber-display').hover();
    await page.locator('#play-pause-btn').click();
    await page.waitForTimeout(500);
    const resumed = await page.evaluate(() =>
        window.rise?.router?.views?.get('chamber-session')?.instance?.player?.state);
    expect(['playing', 'interlocuting']).toContain(resumed);
});
