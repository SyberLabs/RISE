import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// The options the reader actually sees in the passage-visual dropdown.
const pickerProjectOptions = (page) => page.evaluate(() => {
    const select = document.querySelector('[data-passage-asset-picker]');
    if (!select) return null;
    return [...select.options].map(o => o.value).filter(v => v.startsWith('project-image:'));
});

async function selectFirstWords(page, cdp) {
    const box = await page.locator('#visual-score-text').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 24, y: box.y + 28 }] });
    await page.evaluate(() => {
        const root = document.querySelector('#visual-score-text');
        const node = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(20, node.nodeValue.length));
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('project media survives a Library source arriving', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(g => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await page.locator('[data-nav="workshop"]').first().click();
    await expect(page.locator('.workshop-studio')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Sources', exact: true }).click();
    await page.locator('#file-import-input').setInputFiles({
        name: 'elon.txt', mimeType: 'text/plain',
        buffer: Buffer.from('Alpha beta gamma delta epsilon zeta eta theta iota kappa.')
    });
    await expect(page.locator('#visual-score-text')).toHaveCount(1, { timeout: 20_000 });

    for (const name of ['musk.png', 'ye.png']) {
        await page.locator('#image-import-input').setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
        await page.waitForTimeout(900);
    }

    const cdp = await page.context().newCDPSession(page);
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await selectFirstWords(page, cdp);
    await expect(page.locator('.studio-passage-popover')).toBeVisible({ timeout: 8_000 });
    console.log('MEDIA picker BEFORE library:', JSON.stringify(await pickerProjectOptions(page)));

    // Now bring in a Library work, exactly as the reader did.
    await page.getByRole('button', { name: 'Sources', exact: true }).click();
    await page.locator('[data-action="open-browser"]').first().click();
    await expect(page.locator('.sb-content-title')).toContainText('Curated Archive', { timeout: 20_000 });
    // Waley's *A Hundred and Seventy Chinese Poems* is withheld from the
    // launch canon. Walden is still on the shelf and has chapters to add.
    await page.getByRole('searchbox', { name: 'Search the source library' }).fill('Walden');
    await expect(page.locator('.sb-item')).toHaveCount(1, { timeout: 15_000 });
    await page.getByRole('button', { name: /Open chapters of Walden/ }).click();
    await expect(page.locator('.sb-contents')).toBeVisible({ timeout: 15_000 });
    await page.locator('.sb-chapter-add').first().click();
    await expect(page.locator('.source-browser-overlay')).toBeHidden({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await selectFirstWords(page, cdp);
    await expect(page.locator('.studio-passage-popover')).toBeVisible({ timeout: 8_000 });
    const after = await pickerProjectOptions(page);
    console.log('MEDIA picker AFTER  library:', JSON.stringify(after));
    console.log('MEDIA project cards AFTER:', await page.locator('.studio-asset-card').count());

    expect(after, 'project media vanished from the passage picker').not.toEqual([]);
});
