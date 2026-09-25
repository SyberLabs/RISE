import { test, expect } from '@playwright/test';

/**
 * The phone navigator is a stage: the visual fills the screen, the rail sits
 * under the thumb, and nothing reaches the reading until Choose.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

// A phone's pointer is coarse; landscape relies on it to be told from a laptop.
test.use({ hasTouch: true, isMobile: true });

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 },
    { name: 'landscape', width: 844, height: 390 }
];

async function openStage(page, { width, height }) {
    await page.setViewportSize({ width, height });
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    // A divided work shows its contents first; an undivided one goes straight on.
    const toc = page.locator('.toc-entry').first();
    const stage = page.locator('.orbital-stage');
    await expect(toc.or(stage)).toBeVisible({ timeout: 30000 });
    if (await toc.isVisible()) await toc.click();
    await expect(stage).toBeVisible({ timeout: 30000 });
    await page.locator('.orbit-visual').click();
    await expect(page.locator('.vstage')).toBeVisible({ timeout: 15000 });
}

const sideways = page => page.evaluate(() => {
    let worst = null;
    for (const el of document.querySelectorAll('.vstage *')) {
        if (el.closest('.vstage-rail')) continue;
        const box = el.getBoundingClientRect();
        if (box.width && box.right > innerWidth + 1 && (!worst || box.right > worst.right)) {
            worst = { right: Math.round(box.right), cls: String(el.className).slice(0, 50) };
        }
    }
    return worst;
});

for (const phone of PHONES) {
    test(`a visual is looked at, then chosen, on ${phone.name}`, async ({ page }) => {
        test.setTimeout(120000);
        await openStage(page, phone);

        const stage = await page.locator('.vstage').boundingBox();
        expect(Math.round(stage.width)).toBe(phone.width);
        expect(Math.round(stage.height)).toBe(phone.height);
        expect(await sideways(page)).toBeNull();

        const choose = await page.locator('[data-stage="choose"]').boundingBox();
        expect(choose.height).toBeGreaterThanOrEqual(44);
        expect(choose.y + choose.height).toBeLessThanOrEqual(phone.height);
        // In the thumb's half of the screen, on the right.
        expect(choose.y).toBeGreaterThan(phone.height / 2);
        expect(choose.x).toBeGreaterThan(phone.width / 2);

        await page.locator('.vstage-tile[data-world="turrell"]').click();
        await expect(page.locator('.vstage-name')).toHaveText('Turrell Fields');
        await expect(page.locator('.orbit-visual .orbit-status')).not.toContainText('Turrell');

        await page.locator('[data-stage="choose"]').click();
        await expect(page.locator('#modal-visual')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('.orbit-visual .orbit-status')).toContainText('Turrell');
    });
}

test('closing without Choose leaves the reading as it was', async ({ page }) => {
    test.setTimeout(120000);
    await openStage(page, PHONES[0]);
    const before = await page.locator('.orbit-visual .orbit-status').textContent();
    await page.locator('.vstage-tile[data-world="fractal"]').click();
    await page.locator('[data-stage="close"]').click();
    await expect(page.locator('#modal-visual')).toBeHidden();
    expect(await page.locator('.orbit-visual .orbit-status').textContent()).toBe(before);
});

test('only the focused drawn visual moves, and only while it is on the stage', async ({ page }) => {
    test.setTimeout(120000);
    await openStage(page, PHONES[0]);
    const liveCanvases = () => page.evaluate(() => document.querySelectorAll('.vstage-live canvas').length);
    await page.locator('.vstage-tile[data-world="attractor"]').click();
    await expect.poll(liveCanvases, { timeout: 5000 }).toBe(1);
    await page.locator('.vstage-tile[data-world="turrell"]').click();
    expect(await liveCanvases()).toBe(0);
    await page.locator('.vstage-tile[data-world="attractor"]').click();
    await expect.poll(liveCanvases, { timeout: 5000 }).toBe(1);
    await page.locator('[data-stage="close"]').click();
    expect(await liveCanvases()).toBe(0);
});

test('nothing on the stage is smaller than a fingertip, or than eleven pixels', async ({ page }) => {
    test.setTimeout(120000);
    await openStage(page, PHONES[0]);
    const audit = () => page.evaluate(() => {
        const root = document.querySelector('.vstage');
        const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const controls = [...root.querySelectorAll('button, label.vnav-switch')].filter(shown)
            .map(el => ({ name: String(el.className).split(' ')[0], height: Math.round(el.getBoundingClientRect().height) }))
            .filter(c => c.height > 0);
        const text = [...root.querySelectorAll('*')]
            .filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 1 && shown(el))
            .map(el => ({ name: String(el.className).split(' ')[0], size: parseFloat(getComputedStyle(el).fontSize) }));
        return {
            short: controls.filter(c => c.height < 44 && c.name !== 'vstage-tile'),
            small: [...new Set(text.filter(t => t.size < 11).map(t => `${t.name}@${t.size}`))]
        };
    });
    for (const open of [null, 'vary', 'text']) {
        if (open === 'vary') await page.locator('.vstage-tile[data-world="klee"]').click();
        if (open) await page.locator(`[data-stage="${open}"]`).click();
        const result = await audit();
        expect(result.short, `${open || 'stage'} controls`).toEqual([]);
        expect(result.small, `${open || 'stage'} text`).toEqual([]);
        if (open) await page.locator('.vstage-sheet-done').click();
    }
});

test('Vary and Letters rise over the visual and keep their controls on the screen', async ({ page }) => {
    test.setTimeout(120000);
    await openStage(page, PHONES[1]);
    await page.locator('.vstage-tile[data-world="klee"]').click();
    await page.locator('[data-stage="vary"]').click();
    // Measured once the sheet has finished rising; mid-animation it sits 24px low.
    await expect.poll(async () => {
        const sheet = await page.locator('.vstage-sheet-vary').boundingBox();
        return Math.round(sheet.y + sheet.height);
    }).toBeLessThanOrEqual(PHONES[1].height + 1);
    await expect(page.locator('.vstage-sheet [data-stage-sub="preset"]').first()).toBeVisible();
    await page.locator('.vstage-sheet-done').click();
    await page.locator('[data-stage="text"]').click();
    await expect(page.locator('.vstage-sheet-text [data-chamber-face="thick"]')).toBeVisible();
    expect(await sideways(page)).toBeNull();
});
