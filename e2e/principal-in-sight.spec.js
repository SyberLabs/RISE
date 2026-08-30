/**
 * PRINCIPAL IN SIGHT.
 *
 * The control that commits a choice must not be something a reader has to go
 * looking for. "Bring into the room" was the last child of a 26rem scrollport
 * full of benches, so on a leaf with any depth it sat below the fold: the
 * panel offered a decision and hid the way to make it.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'In Sight', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(30).trim(), textSource: 'In Sight', origin: null };

async function openNavigator(page) {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('[data-orbit="visual"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 10_000 });
}

/** How much of an element sits inside its own scrollport. */
const shownWithin = (page, selector, paneSelector) => page.evaluate(([sel, paneSel]) => {
    const el = document.querySelector(sel);
    const pane = document.querySelector(paneSel);
    if (!el || !pane) return null;
    const e = el.getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    const covered = Math.max(0, Math.min(p.bottom, e.bottom) - Math.max(p.top, e.top));
    return +(covered / e.height).toFixed(3);
}, [selector, paneSelector]);

test('the commit stays in sight however deep the leaf', async ({ page }) => {
    await openNavigator(page);

    // A leaf with benches enough to fill the pane.
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="dynamic"]').click();
    await page.locator('.vnav-node[data-id="attractor"]').click();
    await expect(page.locator('[data-action="toggle"]')).toBeVisible();

    expect(await shownWithin(page, '.vnav-commit', '.vnav-entry'),
        'visible without going to look for it').toBe(1);

    // And it stays there when the reader reads down the benches.
    await page.locator('.vnav-entry').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200);
    expect(await shownWithin(page, '.vnav-commit', '.vnav-entry'),
        'still in sight at the bottom of the benches').toBe(1);

    await page.locator('.vnav-entry').evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(200);
    expect(await shownWithin(page, '.vnav-commit', '.vnav-entry'),
        'and at the top').toBe(1);

    // It is a control, not a picture: a press must reach it.
    await page.locator('[data-action="toggle"]').click();
    await page.waitForTimeout(300);
    expect(await page.locator('[data-action="toggle"]').getAttribute('aria-checked')).toBe('true');
});

/**
 * The Workshop's score view tabs are how a reader moves between Visual, Audio
 * and Combined. They sat at the head of a long score and scrolled away with
 * it, so reading down a sequence took the way back out of reach.
 */
test.describe('the Workshop score tabs', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('stay in sight while a sequence is read down', async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript((gate) => {
            localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        }, GATE);
        await page.goto('/');
        await page.locator('[data-nav="workshop"]').first().click();
        await expect(page.locator('.workshop-studio')).toBeVisible({ timeout: 30_000 });

        await page.getByRole('button', { name: 'Sources', exact: true }).click();
        await page.getByRole('button', { name: 'Browse' }).click();
        await page.getByRole('searchbox', { name: 'Search the source library' }).fill('Middlemarch');
        await expect(page.locator('.sb-item')).toHaveCount(1);
        await page.getByRole('button', { name: /Open chapters of Middlemarch/ }).click();
        await expect.poll(() => page.locator('.sb-chapter-item').count()).toBeGreaterThan(1);
        await page.locator('.sb-chapter-add').first().click();
        await expect(page.locator('#visual-score-text')).toBeVisible({ timeout: 20_000 });

        const tabs = page.locator('.media-score-view-tabs');
        await expect(tabs).toBeVisible();
        const before = await tabs.boundingBox();

        // Read down the score. The studio is the scroller, not the window.
        await page.locator('.workshop-studio').evaluate(el => {
            el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, 2400);
        });
        await page.waitForTimeout(500);

        const after = await tabs.boundingBox();
        const viewport = page.viewportSize();
        // eslint-disable-next-line no-console
        console.log(`TABS top ${Math.round(before.y)} -> ${Math.round(after?.y ?? -999)}`);

        expect(after, 'the tabs are still laid out').not.toBeNull();
        // Not merely on screen — held near the head of the studio, where the
        // reader left them. They were 2,041px above the viewport before this.
        expect(after.y, `the tabs sat at ${Math.round(after.y)}`).toBeGreaterThan(-1);
        expect(after.y, 'and stay in the upper reach of the view')
            .toBeLessThan(viewport.height / 3);
        // They are reachable, not merely present.
        await expect(page.getByRole('tab', { name: 'Audio' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Visual' })).toBeVisible();
    });
});
