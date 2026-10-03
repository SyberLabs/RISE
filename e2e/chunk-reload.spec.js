import { test, expect } from './fixtures.js';

/**
 * A view's chunk that fails every time — blocked by the network, or gone
 * from the server — gets one reload, the cure for a tab left open across a
 * deploy, and no more. Before this, the guard was released by every start,
 * so a chunk that failed on every load reloaded the page forever.
 * The Library's chunk stands in for any lazily loaded view.
 */
const GATE = { code: 'rise2025', name: 'Chunk Harness', vault: null, timestamp: Date.now() };
const LIBRARY_CHUNK = /\/assets\/Library-[^/]+\.js$/u;
const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

async function openLibrary(page) {
  await page.goto('/');
  await page.locator('.portal-menu-toggle').click();
  await page.locator('.portal-nav [data-nav="library"]').click();
}

test('a chunk that always fails reloads the page once, not forever', async ({ page }) => {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.route(LIBRARY_CHUNK, route => route.fulfill({ status: 404, body: '' }));
  let loads = 0;
  page.on('load', () => { loads += 1; });

  await openLibrary(page);

  // Give a loop time to show itself: each turn is one load of the app.
  await page.waitForTimeout(8_000);
  expect(loads).toBeLessThanOrEqual(2);
  // The reader is left with a working app, not a blank page…
  await expect(page.locator('.portal [data-home="enter"]')).toBeVisible();
  // …and an address that names what is shown.
  await expect(page).not.toHaveURL(/\/library$/u);
});

test('a chunk missing once, as after a deploy, reloads once and opens the view', async ({ page }) => {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  let misses = 0;
  await page.route(LIBRARY_CHUNK, (route) => {
    if (misses++ === 0) return route.fulfill({ status: 404, body: '' });
    return route.continue();
  });
  let loads = 0;
  page.on('load', () => { loads += 1; });

  await openLibrary(page);

  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('library');
  expect(loads).toBe(2);
});
