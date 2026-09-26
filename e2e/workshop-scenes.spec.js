import { test, expect } from '@playwright/test';

/**
 * The phone Workshop, walked with a thumb: write a scene, give it a visual,
 * add a Library chapter, reorder, play, and come back to the stack.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 }
];

const sideways = page => page.evaluate(() => {
    let worst = null;
    for (const el of document.querySelectorAll('.scene-stack-host *')) {
        const box = el.getBoundingClientRect();
        if (box.width && box.right > innerWidth + 1 && (!worst || box.right > worst.right)) {
            worst = { right: Math.round(box.right), cls: String(el.className).slice(0, 50) };
        }
    }
    return worst;
});

for (const phone of PHONES) {
    test.describe(phone.name, () => {
        test.use({ viewport: { width: phone.width, height: phone.height }, hasTouch: true, isMobile: true });

        test('idea, words, visual, a second scene, order, and Play', async ({ page }) => {
            test.setTimeout(180000);
            await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
            await page.goto('/');
            await page.locator('[data-nav="workshop"]').first().click();
            await expect(page.locator('.scenes')).toBeVisible({ timeout: 30000 });
            await expect(page.locator('.workshop-studio')).toBeHidden();
            expect(await sideways(page)).toBeNull();

            await page.getByRole('button', { name: 'Write the first scene' }).tap();
            await page.locator('[data-write-draft]').fill('Waste no more time arguing what a good man should be. Be one.');
            await page.getByRole('button', { name: 'Done' }).tap();
            await expect(page.locator('.scene-card')).toHaveCount(1);

            await page.locator('.scene-card-open').first().tap();
            await page.locator('.scene-view [data-sa="visual"]').tap();
            await expect(page.locator('.vstage')).toBeVisible();
            await page.locator('.vstage-tile[data-world="fractal"]').tap();
            await page.locator('[data-stage="choose"]').tap();
            await expect(page.locator('.vstage')).toBeHidden({ timeout: 5000 });
            await expect(page.locator('.scene-view .scene-lane').first()).toContainText('Fractal Flames');
            await page.locator('[data-sa="close-scene"]').tap();

            await page.locator('[data-sa="add"]').tap();
            await page.locator('.scene-sheet [data-sa="library"]').tap();
            await page.getByRole('searchbox', { name: 'Search the source library' }).fill('Middlemarch');
            await page.getByRole('button', { name: /Open chapters of Middlemarch/ }).tap();
            await expect.poll(() => page.locator('.sb-chapter-item').count()).toBeGreaterThan(1);
            await page.locator('.sb-chapter-add').first().tap();
            await expect(page.locator('.source-browser-overlay')).toBeHidden({ timeout: 10000 });
            await expect(page.locator('.scene-card')).toHaveCount(2);
            expect(await sideways(page)).toBeNull();

            const firstBefore = await page.locator('.scene-card').nth(0).getAttribute('data-scene-id');
            await page.locator('.scene-card').nth(1).locator('[data-sa="card-more"]').tap();
            await page.getByRole('button', { name: 'Move up' }).tap();
            await expect(page.locator('.scene-card').nth(1)).toHaveAttribute('data-scene-id', firstBefore);

            const thumb = await page.locator('[data-sa="play-all"]').boundingBox();
            expect(thumb.height).toBeGreaterThanOrEqual(56);
            expect(thumb.y + thumb.height).toBeLessThanOrEqual(phone.height);

            await page.locator('[data-sa="play-all"]').tap();
            await expect(page.locator('.chamber[role="main"]')).toBeVisible({ timeout: 30000 });
        });

        test('Full studio is one tap away, and Scenes brings the stack back', async ({ page }) => {
            test.setTimeout(120000);
            await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
            await page.goto('/');
            await page.locator('[data-nav="workshop"]').first().click();
            await expect(page.locator('.scenes')).toBeVisible({ timeout: 30000 });
            await page.locator('[data-sa="more"]').first().tap();
            await page.getByRole('button', { name: /Full studio/ }).tap();
            await expect(page.locator('.workshop-studio')).toBeVisible();
            await page.locator('[data-action="show-scenes"]').tap();
            await expect(page.locator('.scenes')).toBeVisible();
            await expect(page.locator('.workshop-studio')).toBeHidden();
        });
    });
}
