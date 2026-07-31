import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'P', vault: null, timestamp: Date.now() };
test('journey page carries procedural figures', async ({ page }) => {
  test.setTimeout(600000);
  await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
  await page.goto('/');
  await page.locator('[data-nav="journeys"]').first().click();
  await expect(page.locator('.journey-credits')).toBeVisible({ timeout: 120000 });
  await page.locator('.journey-begin').click();
  const accept = page.locator('#safety-accept');
  await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await accept.isVisible()) await accept.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 120000 });
  const t0 = Date.now();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeVisible({ timeout: 120000 });
  const built = Date.now() - t0;
  await page.waitForTimeout(8000);
  const figs = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.page-figure')];
    return {
      figures: all.length,
      filled: all.filter(f => f.querySelector('img')).length,
      collections: [...new Set(all.map(f => f.dataset.collections).filter(Boolean))].slice(0, 8)
    };
  });
  console.log('PAGE ' + JSON.stringify({ buildMs: built, ...figs }));
});
