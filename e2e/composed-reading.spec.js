/**
 * A COMPOSED WORK IS ONE READING ON THE SHELF, AND STILL ALL OF ITSELF
 * WHEN IT RUNS.
 *
 * Creator Affirmations offered "16 readings" — the count of paragraphs the
 * starter registrar had split its prose into. The pieces are the
 * composition's bookkeeping; the reader meets one continuous reading.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Composed', vault: null, timestamp: Date.now() };

async function openLibrary(page) {
    await page.addInitScript((gate) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    }, GATE);
    await page.goto('/');
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card, .library-card').first())
        .toBeVisible({ timeout: 15_000 });
}

test('a composed work offers itself as one reading', async ({ page }) => {
    await openLibrary(page);

    // Composed works stand on their own shelf.
    await page.getByRole('button', { name: /^Composed$/ }).click();
    await page.waitForTimeout(1200);

    const card = page.locator('[data-id="starter-creator-affirmations"]')
        .locator('xpath=ancestor-or-self::*[contains(@class,"archive-card")][1]');
    await expect(card, 'Creator Affirmations is on the shelf').toBeVisible({ timeout: 10_000 });

    const text = (await card.innerText()).replace(/\s+/g, ' ');
    // eslint-disable-next-line no-console
    console.log('CARD ' + JSON.stringify(text));

    // The segment count is the composition's bookkeeping, never the shelf's.
    expect(text, 'the card counts readings, not segments').not.toMatch(/\b16 readings\b/);
    expect(text).toMatch(/\b1 reading\b/);
});

test('opening it begins one reading rather than a table of parts', async ({ page }) => {
    await openLibrary(page);

    await page.getByRole('button', { name: /^Composed$/ }).click();
    await page.waitForTimeout(1200);
    const open = page.locator('[data-id="starter-creator-affirmations"]');
    await expect(open).toBeVisible({ timeout: 10_000 });
    // A work with parts to browse says Open and shows its contents; a single
    // reading is loaded whole.
    await expect(open, 'one reading is loaded, not opened into parts')
        .toHaveText(/Load Text/i);

    await open.click();
    await page.waitForTimeout(1500);
    // No contents sheet stands between the reader and the reading.
    expect(await page.locator('.sb-contents, .archive-contents').count(),
        'no parts table').toBe(0);
});
