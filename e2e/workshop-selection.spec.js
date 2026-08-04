import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
});

async function openWorkshopWithSource(page) {
    await page.addInitScript((gate) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    }, GATE);
    await page.goto('/');
    await page.locator('[data-nav="workshop"]').first().click();
    await expect(page.locator('.workshop-studio')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Sources', exact: true }).click();
    await page.getByRole('button', { name: 'Browse' }).click();
    await expect(page.locator('.sb-content-title')).toContainText('Curated Archive · 107 works');
    await page.getByRole('searchbox', { name: 'Search the source library' }).fill('A Hundred and Seventy Chinese Poems');
    await expect(page.locator('.sb-item')).toHaveCount(1);
    await page.getByRole('button', { name: /Open chapters of A Hundred and Seventy Chinese Poems/ }).click();
    await expect(page.locator('.sb-contents')).toBeVisible();
    await expect.poll(() => page.locator('.sb-chapter-item').count()).toBeGreaterThan(1);
    await page.locator('.sb-chapter-add').first().click();
    await expect(page.locator('.source-browser-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#visual-score-text')).toBeVisible();
}

test('touch selection opens the passage palette and assigns without a synthetic mouseup', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);

    await page.getByRole('button', { name: 'Assets', exact: true }).click();
    const presentation = page.locator('#studio-visual-presentation');
    await presentation.scrollIntoViewIfNeeded();
    await expect(presentation).toBeVisible();
    await expect(presentation).toContainText('Presentation');
    await expect(page.locator('#studio-visual-inspector')).not.toContainText('Presentation');
    await page.getByRole('button', { name: 'Score', exact: true }).click();

    const text = page.locator('#visual-score-text');
    const box = await text.boundingBox();
    expect(box).not.toBeNull();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + 24, y: box.y + 28 }]
    });
    await page.evaluate(() => {
        const root = document.querySelector('#visual-score-text');
        const firstText = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(firstText, Math.min(24, firstText.nodeValue.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const palette = page.locator('.studio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await expect(palette).toContainText('Selected passage');
    await palette.locator('[data-passage-asset-picker]').selectOption('procedural:klee');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().length || 0))
        .toBeGreaterThan(0);
    await palette.getByRole('button', { name: 'Assign visual' }).click();

    await expect(page.locator('.visual-score-mark')).toHaveCount(1);
    await expect(page.locator('.studio-passage-popover.is-confirmation')).toBeVisible();
    await expect(page.locator('.visual-score-activation-notice')).toContainText('Scored visuals activated');

    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Assets', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio', exact: true }).click();
    await page.getByRole('option', { name: /Aurora, soundscape default/ }).click();
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Audio', exact: true })).toHaveAttribute('aria-selected', 'true');

    const audioText = page.locator('#visual-score-text');
    const audioBox = await audioText.boundingBox();
    expect(audioBox).not.toBeNull();
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: audioBox.x + 24, y: audioBox.y + 28 }]
    });
    await page.evaluate(() => {
        const root = document.querySelector('#visual-score-text');
        const candidate = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(candidate, 0);
        range.setEnd(candidate, Math.min(18, candidate.nodeValue.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.locator('.audio-passage-popover')).toBeVisible({ timeout: 5_000 });
    await page.locator('.audio-passage-popover').getByRole('button', { name: 'Assign audio' }).click();
    await expect(page.locator('.audio-score-mark')).toHaveCount(1);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('tab', { name: 'Combined', exact: true }).click();
    await expect(page.locator('.audio-score-lane')).toBeVisible();
    await expect(page.locator('[aria-label="Visual assignments"]')).toBeVisible();
});
