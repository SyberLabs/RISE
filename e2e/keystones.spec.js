import { test, expect } from '@playwright/test';

const GATE_SESSION = {
  code: 'rise2025',
  name: 'Keystone Route Harness',
  vault: null,
  timestamp: Date.now()
};

async function authorize(page) {
  await page.addInitScript(gate => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
  }, GATE_SESSION);
}

test('Keystone corridor has durable cold, reload, launch, and Back behavior', async ({ page }) => {
  await authorize(page);
  await page.goto('/');
  await expect(page.locator('[data-nav="keystones"]')).toBeVisible({ timeout: 15_000 });

  await page.locator('[data-nav="keystones"]').click();
  await expect(page).toHaveURL(/\/try-rise$/u);
  const meditations = page.locator('#keystone-meditations');
  await expect(meditations).toBeVisible();
  const launch = meditations.locator('[data-keystone="meditations"]');
  await expect(launch).toBeEnabled({ timeout: 15_000 });
  await launch.click();

  await expect(page).toHaveURL(/\/keystone\/meditations$/u);
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);

  await page.goBack();
  await expect(page).toHaveURL(/\/try-rise$/u);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getRouterState().currentView), {
    timeout: 15_000
  }).toBe('keystones');
  await expect(page.locator('#keystone-meditations')).toBeVisible({ timeout: 15_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getRouterState().currentView), {
    timeout: 15_000
  }).toBe('portal');

  await page.goto('/try-rise');
  await expect(page.locator('#keystone-meditations')).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.locator('#keystone-tintern')).toBeVisible({ timeout: 15_000 });

  await page.goto('/keystone/tintern');
  const tintern = page.locator('#keystone-tintern');
  await expect(tintern).toBeVisible({ timeout: 15_000 });
  await expect(tintern).toHaveClass(/is-target/u);
  await page.reload();
  await expect(page.locator('#keystone-tintern')).toHaveClass(/is-target/u, { timeout: 15_000 });
});
