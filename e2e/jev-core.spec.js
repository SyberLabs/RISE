import { test, expect } from '@playwright/test';

// Transport simulations test browser wiring, not live provider quality/access.
async function seed(page) {
    await page.addInitScript(() => {
        localStorage.setItem('rise-beta-session', JSON.stringify({ code: 'open', name: 'Jev test', timestamp: Date.now() }));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify({
            text: 'The first passage stays hidden until a decision arrives.\n\nThe next passage also requires a decision.',
            textSource: 'Jev contract test', origin: null
        }));
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ soundscape: 'none', audioPreset: 'silent', visualMode: 'off' }));
    });
}

async function consent(page) {
    const dialog = page.locator('.jev-session-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue with reading guide' })).toBeDisabled();
    await dialog.locator('[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Continue with reading guide' }).click();
}

test('normal reading waits for consent, fails closed, and retries a real client request', async ({ page }) => {
    const requests = [];
    let unavailable = true;
    await page.route('**/api/jev-decision', async route => {
        const body = route.request().postDataJSON();
        requests.push(body);
        await route.fulfill({ status: unavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(unavailable
            ? { error: { code: 'DECISION_NOT_CONFIGURED', message: 'Reading decision unavailable.' } }
            : { requestId: body.requestId, action: 'continue', model: 'openai/gpt-4.1-mini' }) });
    });
    await seed(page);
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled();
    await page.locator('#begin-btn').click();
    await expect(page.locator('.jev-session-dialog')).toBeVisible();
    expect(requests).toHaveLength(0);
    await consent(page);
    await expect(page.locator('#jev-status')).toContainText(/failed|unavailable/i);
    await expect(page.locator('#chamber-display')).not.toContainText('The first passage');
    expect(requests[0].mode).toBe('reading');
    unavailable = false;
    await page.locator('#jev-status button').click();
    await expect(page.locator('#jev-status')).toBeHidden();
    await expect.poll(() => requests.length).toBeGreaterThan(1);
    expect(requests[1].feedback).toContain('ready');
    await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.player?.sessionState?.state)).toBe('playing');
});

test('rosary door requires consent and keeps the first prayer hidden until approval', async ({ page }) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let requestCount = 0;
    await page.route('**/api/jev-decision', async route => {
        requestCount++;
        const body = route.request().postDataJSON();
        await held;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ requestId: body.requestId, action: 'continue', model: 'openai/gpt-4.1-mini' }) });
    });
    await seed(page);
    await page.goto('/#rosary');
    await expect(page.locator('.jev-session-dialog')).toBeVisible();
    expect(requestCount).toBe(0);
    await consent(page);
    await expect.poll(() => requestCount).toBe(1);
    await expect(page.locator('.rosarium-prayer-text')).toHaveCount(0);
    release();
    await expect(page.locator('.rosarium-prayer-text')).toContainText('In the name of the Father');
});

test('declining consent exits without sending the private reading', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/jev-decision', async route => { requests++; await route.abort(); });
    await seed(page);
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await page.locator('#begin-btn').click();
    const dialog = page.locator('.jev-session-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Exit', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#begin-btn')).toBeVisible();
    expect(requests).toBe(0);
});
