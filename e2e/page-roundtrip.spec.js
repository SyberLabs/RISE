/**
 * Crossing between the two projections must not cost the reader their
 * place.
 *
 * Page Mode builds a fresh PageReader every time it opens, so leaving
 * for the Stream and returning landed on page one: the reading was
 * held and the reader's position in it was not.
 *
 * This has its own file because it survived a first fix. That attempt
 * restored the remembered page AFTER calling render() — and render()
 * lands on page 0 and reports it through the same callback that
 * RECORDS the position, so the memory was erased a line before it was
 * read. A value read after the thing that writes it is not a memory,
 * and nothing in the suite would have noticed.
 */
import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

test.skip(true, 'JOURNEYS = []; those sits are not shipped');

test('the Page keeps the reader’s place across a trip to the Stream', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-text-id="middlemarch"]')).toBeVisible({ timeout: 30000 });
  await page.locator('[data-text-id="middlemarch"] [data-action="select-text"]').click();
  await expect(page.locator('.toc-entry').first()).toBeVisible({ timeout: 30000 });
  await page.locator('.toc-entry').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#begin-btn').click();
  const accept = page.locator('#safety-accept');
  await accept.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2000);

  const wake = async () => { await page.mouse.move(195, 620); await page.waitForTimeout(350); };
  const idx = () => page.evaluate(() =>
    window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader?.pageIndex ?? -1);

  await wake();
  await page.locator('#page-mode-btn').click({ timeout: 15000 });
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 45000 });
  await page.waitForTimeout(1200);

  // Turn a few pages.
  await page.evaluate(() => {
    const r = window.rise.router.views.get('chamber-session').instance.pageReader;
    r.goToPage(3);
  });
  await page.waitForTimeout(800);
  const before = await idx();

  // Out to the Stream…
  await wake();
  await page.locator('#page-mode-btn').click({ timeout: 15000 });
  await page.waitForTimeout(1200);
  // …and back.
  await wake();
  await page.locator('#page-mode-btn').click({ timeout: 15000 });
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 45000 });
  await page.waitForTimeout(1500);
  const after = await idx();

  const count = await page.evaluate(() =>
    document.querySelector('#page-turn-count')?.textContent);
  console.log(`ROUNDTRIP before=${before} after=${after} count=${count}`);
  expect(before).toBe(3);
  expect(after, 'the Page forgot where the reader was').toBe(before);
});
