import { test, expect } from '@playwright/test';

/**
 * The Scriptorium is six numbered steps tall and must scroll.
 *
 * `body` is overflow:hidden (the Chamber's design) and .view-container
 * sets no height, so a room that does not take its own height from the
 * viewport simply hides everything past the fold — the verdict included,
 * which made Examine look like it did nothing.
 */
const GATE = { code: 'rise2025', name: 'Scriptorium', vault: null, timestamp: Date.now() };

async function openRoom(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.addInitScript(g => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await expect(page.locator('.portal-arch-sol')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-nav="scriptorium"]').first().click();
    await expect(page.locator('.scriptorium')).toBeVisible({ timeout: 15_000 });
}

for (const [label, w, h] of [['a phone', 390, 844], ['a desktop', 1280, 800]]) {
    test(`the room scrolls on ${label}`, async ({ page }) => {
        await openRoom(page, w, h);
        const room = page.locator('.scriptorium');

        const box = await room.evaluate((el) => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            overflowY: getComputedStyle(el).overflowY
        }));
        console.log(`S ${label} ` + JSON.stringify(box));

        // Taller than the window it sits in, and owning its own scrollbar.
        expect(box.scrollHeight, 'nothing to scroll — the room got shorter').toBeGreaterThan(box.clientHeight);
        expect(box.overflowY).toBe('auto');

        // And it actually moves.
        await room.evaluate(el => { el.scrollTop = 9999; });
        const scrolled = await room.evaluate(el => el.scrollTop);
        console.log(`S ${label} scrolled to ${scrolled}`);
        expect(scrolled, 'the room refused to scroll').toBeGreaterThan(0);
    });
}

test('the last step is reachable', async ({ page }) => {
    // The verdict and everything after it live past the fold on a phone.
    await openRoom(page, 390, 844);
    const room = page.locator('.scriptorium');
    const last = room.locator('.scriptorium-step').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
});
