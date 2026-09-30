import { test, expect, openHomeNav } from './fixtures.js';

const GATE = { code: 'rise2025', name: 'Journeys', vault: null, timestamp: Date.now() };

test('the Portal names one act, and the Vault does not offer Journeys', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await expect(page.locator('[data-nav="chamber"]')).toBeAttached({ timeout: 20000 });

  // Home has one visible key (ROLL; Enter appears only once a reading has
  // risen). Journeys stay out of Home and the Vault.
  await expect(page.locator('.portal .oracle-key:visible')).toHaveCount(1);
  await expect(page.locator('.portal [data-nav="journeys"]')).toHaveCount(0);

  await openHomeNav(page, 'vault');
  await expect(page.locator('.library.vault')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-nav="journeys"]')).toHaveCount(0);
  await expect(page.locator('.vault-journeys-note')).toHaveCount(0);
});
