import { test, expect } from './fixtures.js';

test('a reader can leave with one private, copyable next step', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/sequences/');

    await expect(page.getByRole('button', { name: /Begin again/ })).toBeVisible();
    await page.getByRole('button', { name: /Begin again/ }).click();

    await expect(page.getByText('Arrive')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose', exact: true })).toBeVisible();
    await expect(page.getByText('Begin', { exact: true })).toBeVisible();

    await page.getByLabel('My next step').fill('Walk outside for five minutes');
    await page.getByRole('button', { name: 'Keep my next step' }).click();

    await expect(page.getByText('Walk outside for five minutes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy my next step' })).toBeVisible();
    await page.getByRole('button', { name: 'Copy my next step' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('Walk outside for five minutes');
    await expect(page.getByText(/provider cost|feedback JSON|interest match/i)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 780 });
    await page.getByRole('button', { name: 'Edit it' }).click();
    await expect(page.getByLabel('My next step')).toHaveValue('Walk outside for five minutes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a returning reader can erase records saved by the old preview', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rise-sequence-preview-v1', '{"schemaVersion":1,"records":[]}'));
    await page.goto('/sequences/');

    await expect(page.getByText('An earlier preview saved reading records on this device.')).toBeVisible();
    await page.getByRole('button', { name: 'Erase old preview records' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rise-sequence-preview-v1'))).toBeNull();
});
