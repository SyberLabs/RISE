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

  // The corridor opens on Transformation, centred and expanded; the other
  // two readings are on the rail beside it.
  const metamorphoses = page.locator('#keystone-metamorphoses');
  await expect(metamorphoses).toBeVisible();
  await expect(metamorphoses).toHaveAttribute('aria-checked', 'true');
  await expect(metamorphoses).toHaveAttribute('data-pos', '0');
  await expect(page.locator('#keystone-meditations')).toHaveAttribute('data-pos', '-1');
  await expect(page.locator('#keystone-tintern')).toHaveAttribute('data-pos', '1');

  // A press on a side reading centres it. It does not enter it.
  await page.locator('#keystone-meditations').click();
  await expect(page.locator('#keystone-meditations')).toHaveAttribute('data-pos', '0');
  await expect(page.locator('#keystone-meditations')).toHaveClass(/is-selected/u);
  await expect(page).toHaveURL(/\/try-rise$/u);

  // Arrow keys move the centre, and the one action follows it.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#keystone-metamorphoses')).toHaveAttribute('data-pos', '0');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#keystone-meditations')).toHaveAttribute('data-pos', '0');

  const enter = page.locator('[data-enter]');
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  await expect(enter).toHaveAttribute('data-keystone', 'meditations');
  await enter.click();

  await expect(page).toHaveURL(/\/keystone\/meditations$/u);
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);

  // Leaving the reading returns to the screen it was opened from, not to
  // the orbital prep screen the Chamber otherwise falls back to.
  // The Chamber keeps its controls hidden until the reader moves.
  await page.locator('#chamber-display').hover();
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect(page).toHaveURL(/\/try-rise$/u);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getRouterState().currentView), {
    timeout: 15_000
  }).toBe('keystones');
  await expect(page.locator('#keystone-meditations')).toBeVisible({ timeout: 15_000 });

  // The closed reading is not left behind in history: Back reaches the
  // corridor entry that preceded it, and then the Portal, but never
  // /keystone/meditations again.
  await page.goBack();
  await expect(page).toHaveURL(/\/try-rise$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getRouterState().currentView), {
    timeout: 15_000
  }).toBe('portal');

  // Re-enter, so the Back-from-a-live-reading behaviour below is still
  // exercised from inside a reading.
  await page.goto('/try-rise');
  const reenter = page.locator('[data-enter]');
  await expect(reenter).toBeEnabled({ timeout: 15_000 });
  await reenter.click();
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

  // An end of the rail withdraws the step that would leave it.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#keystone-meditations')).toHaveAttribute('data-pos', '0');
  await expect(page.locator('[data-step="-1"]')).toBeHidden();
  await expect(page.locator('[data-step="1"]')).toBeVisible();

  // Leaving and returning re-seats the corridor on its default reading
  // rather than resuming wherever the last visit left it.
  await page.locator('[data-nav="portal"]').click();
  await expect(page).toHaveURL(/\/$/u);
  await page.locator('[data-nav="keystones"]').first().click();
  await expect(page).toHaveURL(/\/try-rise$/u);
  await expect(page.locator('#keystone-metamorphoses')).toHaveAttribute('data-pos', '0');

  // A route that names a reading opens with that reading centred.
  await page.goto('/keystone/tintern');
  const tintern = page.locator('#keystone-tintern');
  await expect(tintern).toBeVisible({ timeout: 15_000 });
  await expect(tintern).toHaveClass(/is-selected/u);
  await page.reload();
  await expect(page.locator('#keystone-tintern')).toHaveClass(/is-selected/u, { timeout: 15_000 });
  await expect(page.locator('[data-enter]')).toHaveAttribute('data-keystone', 'tintern');
});
