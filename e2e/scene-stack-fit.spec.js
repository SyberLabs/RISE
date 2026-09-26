import { test, expect } from '@playwright/test';

/**
 * The phone stack at the sizes and counts where it used to break: the last
 * card's controls sitting under the fixed transport bar, cards showing
 * through the title bar, and the ≡ handle doing nothing.
 *
 * Every control is hit-tested, not just measured: what a thumb at its
 * centre would actually touch must be the control itself.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

const PHONES = [
    { width: 390, height: 844 },
    { width: 360, height: 640 }
];
const COUNTS = [1, 2, 3, 5];

async function openStack(page) {
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await page.locator('[data-nav="workshop"]').first().click();
    await expect(page.locator('.scenes')).toBeVisible({ timeout: 30000 });
}

async function writeScenes(page, count) {
    for (let i = 0; i < count; i += 1) {
        if (i === 0) {
            await page.locator('[data-sa="write"]').first().tap();
        } else {
            await page.locator('.scenes-thumb [data-sa="add"]').tap();
            await page.locator('.scene-sheet [data-sa="write"]').tap();
        }
        await page.locator('[data-write-draft]').fill(`Scene ${i + 1}. Waste no more time arguing what a good man should be. Be one.`);
        await page.locator('[data-sa="write-done"]').tap();
        await expect(page.locator('.scene-card')).toHaveCount(i + 1);
    }
}

/** For each selector inside `root`, whether a tap at its centre lands on it, and where it sits. */
const hitTest = (page, root, selectors) => page.evaluate(({ root, selectors }) => {
    const scope = document.querySelector(root);
    return selectors.map((selector) => {
        const el = scope.querySelector(selector);
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { selector, hits: !!hit && el.contains(hit), top: box.top, bottom: box.bottom };
    });
}, { root, selectors });

const CARD_CONTROLS = ['[data-sa="drag"]', '[data-sa="card-more"]', '[data-sa="play-scene"]'];

for (const phone of PHONES) {
    test.describe(`${phone.width}x${phone.height}`, () => {
        test.use({ viewport: phone, hasTouch: true, isMobile: true });

        for (const count of COUNTS) {
            test(`${count} scene${count > 1 ? 's' : ''}: every control is reachable, none under a bar`, async ({ page }) => {
                test.setTimeout(120000);
                await openStack(page);
                await writeScenes(page, count);

                // Nothing runs off the side.
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                expect(overflow).toBeLessThanOrEqual(0);

                // Scrolled to the end, the last card clears the fixed transport bar.
                await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
                await page.waitForTimeout(200);
                const barTop = await page.locator('.scenes-thumb').evaluate((el) => el.getBoundingClientRect().top);
                const last = ".scene-card:last-of-type";
                for (const control of await hitTest(page, last, CARD_CONTROLS)) {
                    expect(control.hits, `${control.selector} of the last card is tappable`).toBe(true);
                    expect(control.bottom, `${control.selector} of the last card clears the bar`).toBeLessThanOrEqual(barTop);
                }
                for (const control of await hitTest(page, '.scenes-thumb', ['[data-sa="pace"]', '[data-sa="play-all"]', '[data-sa="add"]'])) {
                    expect(control.hits, `${control.selector} in the transport bar is tappable`).toBe(true);
                }

                // Scrolled to the top, the first card's controls are not under the title bar.
                await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
                await page.waitForTimeout(200);
                const barBottom = await page.locator('.scenes-bar').evaluate((el) => el.getBoundingClientRect().bottom);
                const first = await page.locator('.scene-card').first().evaluate((el) => el.getBoundingClientRect().top);
                expect(first).toBeGreaterThanOrEqual(barBottom);

                // With nothing set anywhere, every card invites, and the invite is part of the tap target.
                await expect(page.locator('.scene-card-invite')).toHaveCount(count);
                const [invite] = await hitTest(page, '.scene-card:first-of-type', ['.scene-card-invite']);
                expect(invite.hits).toBe(true);
            });
        }

        test('the ≡ handle: a tap edits, a hold drags and opens nothing', async ({ page }) => {
            test.setTimeout(120000);
            await openStack(page);
            await writeScenes(page, 2);
            const cdp = await page.context().newCDPSession(page);
            const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
                type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
            });
            const centre = async (locator) => {
                const box = await locator.boundingBox();
                return [box.x + box.width / 2, box.y + box.height / 2];
            };
            const firstWords = () => page.locator('.scene-card-text').first().textContent();

            const handle = () => page.locator('.scene-card').first().locator('[data-sa="drag"]');
            const closeScene = async () => {
                await page.locator('[data-sa="close-scene"]').tap();
                await expect(page.locator('.scene-view')).toHaveCount(0);
            };

            // A plain tap on the handle opens that scene to edit.
            await handle().tap();
            await expect(page.locator('.scene-view')).toHaveAttribute('aria-label', /^Scene 1: Scene 1./);
            await closeScene();

            // A hold, let go in place: the card lifts and settles, nothing opens,
            // and the very next tap is a tap again.
            const [hx, hy] = await centre(handle());
            await touch('touchStart', hx, hy);
            await page.waitForTimeout(500);
            await expect(page.locator('.scene-card.is-lifted')).toHaveCount(1);
            await touch('touchEnd');
            await page.waitForTimeout(300);
            await expect(page.locator('.scene-view')).toHaveCount(0);
            expect(await firstWords()).toContain('Scene 1.');
            await handle().tap();
            await expect(page.locator('.scene-view')).toHaveCount(1);
            await closeScene();

            // A hold and a drag down one card: the scenes swap, and nothing opens.
            // Last, because emulated touch in Chromium sends no click at all
            // after a moved touch on a touch-action: none element, on any page.
            // A tap straight after a drag is covered in SceneStack.test.js.
            const height = await page.locator('.scene-card').first().evaluate((el) => el.getBoundingClientRect().height);
            await touch('touchStart', hx, hy);
            await page.waitForTimeout(500);
            for (let step = 1; step <= 6; step += 1) await touch('touchMove', hx, hy + (height * step) / 6);
            await touch('touchEnd');
            await page.waitForTimeout(300);
            await expect(page.locator('.scene-view')).toHaveCount(0);
            expect(await firstWords()).toContain('Scene 2.');
        });
    });
}
