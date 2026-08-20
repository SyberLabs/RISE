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
    // Waley is withheld from the launch canon. Live count is 34, read
    // from the heading rather than the retired 107-work archive.
    await expect(page.locator('.source-browser-overlay')).toBeVisible();
    await expect(page.locator('.sb-content-title')).toContainText('Curated Archive');
    const heading = await page.locator('.sb-content-title').innerText();
    const liveCount = Number((heading.match(/(\d+) works?/) || [])[1]);
    expect(liveCount, 'source browser should report the live catalog').toBeGreaterThan(0);
    expect(liveCount).not.toBe(107);
    await expect(page.locator('.sb-item')).toHaveCount(liveCount);
    await page.getByRole('searchbox', { name: 'Search the source library' }).fill('Walden');
    await expect(page.locator('.sb-item')).toHaveCount(1);
    await page.getByRole('button', { name: /Open chapters of Walden/ }).click();
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
    // Presentation belongs to its own panel, not to the Inspector. The check
    // used to name #studio-visual-inspector, which the contextual Inspector
    // now renders only while a visual is selected — so the assertion was
    // passing through an element that was simply absent. The claim is about
    // markup rather than sight: on a phone the Inspector is a surface the
    // reader opens, so it is legitimately hidden here.
    await expect(page.locator('#studio-contextual-inspector')).toHaveCount(1);
    await expect(page.locator('#studio-contextual-inspector')).not.toContainText('Presentation');
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

async function selectFirstWords(page, cdp, chars = 20) {
    const box = await page.locator('#visual-score-text').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x: box.x + 24, y: box.y + 28 }]
    });
    await page.evaluate((n) => {
        const root = document.querySelector('#visual-score-text');
        const node = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(n, node.nodeValue.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, chars);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('the audio lane offers a passage picker on selection, as the visual lane does', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    await selectFirstWords(page, cdp);

    // The point: choosing what to assign is possible from the selection itself.
    // Before this, the audio popover offered only "Browse audio", so the lane
    // could not be scored without first visiting the Assets panel.
    const palette = page.locator('.audio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    const picker = palette.locator('[data-passage-audio-picker]');
    await expect(picker).toBeVisible();
    await picker.selectOption({ index: 1 });
    await palette.getByRole('button', { name: 'Assign audio' }).click();
    await expect(page.locator('.audio-score-mark')).toHaveCount(1);
});

test('choosing from the passage picker does not leave the Combined view', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await page.getByRole('tab', { name: 'Combined', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    await selectFirstWords(page, cdp);

    const palette = page.locator('.studio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await palette.locator('[data-passage-asset-picker], [data-passage-audio-picker]')
        .first().selectOption({ index: 1 });

    // Picking what to assign is not a request to change tab; it used to move
    // the reader to Visual mid-selection.
    await expect(page.getByRole('tab', { name: 'Combined', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
});
