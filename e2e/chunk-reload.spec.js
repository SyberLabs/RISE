import { test, expect } from './fixtures.js';

/**
 * A view's chunk that fails every time — blocked by the network, or gone
 * from the server — gets one reload, the cure for a tab left open across a
 * deploy, and no more. Before this, the guard was released by every start,
 * so a chunk that failed on every load reloaded the page forever.
 */
const GATE = { code: 'rise2025', name: 'Chunk Harness', vault: null, timestamp: Date.now() };

test('a chunk that always fails reloads the page once, not forever', async ({ page }) => {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.route(/\/assets\/TodayPoem-[^/]+\.js$/u, route => route.fulfill({ status: 404, body: '' }));
  let loads = 0;
  page.on('load', () => { loads += 1; });

  await page.goto('/');
  const card = page.locator('.home-today-card');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  // Give a loop time to show itself: each turn is one load of the app.
  await page.waitForTimeout(8_000);
  expect(loads).toBeLessThanOrEqual(2);
  // The reader is left with a working app, not a blank page.
  await expect(page.locator('.portal .home-title').first()).toBeVisible();
  // …and an address that names what is shown.
  await expect(page).not.toHaveURL(/\/today$/u);
});

test('a chunk missing once, as after a deploy, reloads once and opens the view', async ({ page }) => {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  let misses = 0;
  await page.route(/\/assets\/TodayPoem-[^/]+\.js$/u, (route) => {
    if (misses++ === 0) return route.fulfill({ status: 404, body: '' });
    return route.continue();
  });
  let loads = 0;
  page.on('load', () => { loads += 1; });

  await page.goto('/');
  const card = page.locator('.home-today-card');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page.locator('.today-line').first()).toBeVisible({ timeout: 15_000 });
  expect(loads).toBe(2);
});
