import { test, expect } from '@playwright/test';

function deferred() {
    let resolve;
    const promise = new Promise(res => { resolve = res; });
    return { promise, resolve };
}

test('Page waits, blocks the next page, retries that page, and leaves no stale gate in Stream', async ({ page }) => {
    test.setTimeout(60_000);
    const requests = [];
    const openingPage = deferred();
    const releaseOpeningPage = deferred();
    let phase = 'stream';

    await page.route('**/api/jev-decision', async route => {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (phase === 'opening-page') {
            openingPage.resolve(body);
            await releaseOpeningPage.promise;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
                requestId: body.requestId, action: 'continue', model: 'jev-test', confidence: 1
            }) });
            return;
        }
        const action = phase === 'next-page' ? 'pause' : 'continue';
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
            requestId: body.requestId, action, model: 'jev-test', confidence: 1
        }) });
    });

    await page.addInitScript(() => {
        const paragraph = (label) => `${label} ${'The page waits for a reading decision before these words can appear. '.repeat(45)}`;
        localStorage.setItem('rise-beta-session', JSON.stringify({ code: 'open', name: 'Jev Page test', timestamp: Date.now() }));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: `${paragraph('PAGE ONE BEGIN.') }\n\n${paragraph('PAGE TWO BEGIN.')}`,
            textSource: 'Jev Page contract test', origin: null
        }));
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ soundscape: 'none', audioPreset: 'silent', visualMode: 'off' }));
    });

    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled();
    await page.locator('#begin-btn').click();
    const dialog = page.locator('.jev-session-dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Continue with Jev' }).click();
    await expect(page.locator('#chamber-display')).toBeVisible();
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.locator('#atom-display')).toContainText('PAGE');
    await page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.player?.pause());
    await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.player?.state))
        .toBe('paused');

    await page.locator('#chamber-display').hover();
    phase = 'opening-page';
    await page.locator('#page-mode-btn').click();
    await openingPage.promise;
    await expect(page.locator('#jev-status')).toContainText('Waiting for passage approval');
    await expect(page.locator('#chamber-page .page-text')).toHaveCount(0);
    releaseOpeningPage.resolve();
    await expect(page.locator('#chamber-page .page-text')).toContainText('PAGE ONE BEGIN');

    await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.pageReader?.pages?.length || 0))
        .toBeGreaterThan(1);
    const nextTextPage = await page.evaluate(() => {
        const reader = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
        return reader?.pages?.findIndex((candidate, index) => index > reader.pageIndex
            && candidate.items.some(item => item.type === 'text' && item.text?.trim())) ?? -1;
    });
    expect(nextTextPage).toBeGreaterThan(0);
    const pageOneRequestCount = requests.length;
    phase = 'next-page';
    for (let index = 1; index < nextTextPage; index += 1) {
        await page.locator('#page-next').click();
        await page.waitForFunction(target => window.__RISE_TEST__?.getView('chamber-session')?.pageReader?.pageIndex === target, index);
    }
    await page.locator('#page-next').click();
    await expect.poll(() => requests.length).toBeGreaterThan(pageOneRequestCount);
    await expect(page.locator('#jev-status')).toContainText(/pause|approval/i);
    await expect(page.locator('#chamber-page')).not.toContainText('PAGE TWO BEGIN');

    phase = 'retry-page';
    await page.locator('#jev-feedback').fill('I am ready to continue.');
    await page.locator('#jev-retry').click();
    await expect(page.locator('#chamber-page .page-text')).toContainText('PAGE TWO BEGIN');
    expect(requests.at(-1).feedback).toBe('I am ready to continue.');

    await page.locator('#chamber-display').hover();
    await page.locator('#page-mode-btn').click();
    await expect(page.locator('#chamber-page')).toBeHidden();
    await expect(page.locator('#jev-status')).toBeHidden();
    await expect(page.locator('#atom-display')).not.toContainText('PAGE TWO BEGIN');

    const beforeReopen = requests.length;
    await page.locator('#chamber-display').hover();
    await page.locator('#page-mode-btn').click();
    await expect.poll(() => requests.length).toBeGreaterThan(beforeReopen);
    await expect(page.locator('#chamber-page .page-text')).toContainText('PAGE TWO BEGIN');
    await expect(page.locator('#jev-status')).toBeHidden();
});
