import { test, expect, openHomeNav } from './fixtures.js';


test('the Portal names one act, and the Vault does not offer Journeys', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-nav="chamber"]')).toBeAttached({ timeout: 20000 });

  // Home has one solid key (Roll a reading; Start reading appears only once
  // there is a reading). Journeys stay out of Home and the Vault.
  await expect(page.locator('.portal .home .btn-primary:visible')).toHaveCount(1);
  await expect(page.locator('.portal [data-nav="journeys"]')).toHaveCount(0);

  await openHomeNav(page, 'vault');
  await expect(page.locator('.library.vault')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-nav="journeys"]')).toHaveCount(0);
  await expect(page.locator('.vault-journeys-note')).toHaveCount(0);
});
