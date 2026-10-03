import { test, expect } from './fixtures.js';

/**
 * Today's poem: Home's quiet link and the /today address both open one poem
 * under the day's mark. Begin plays exactly the poem shown, as verse, and
 * leaving the reading comes back to the poem.
 */
const GATE = { code: 'rise2025', name: 'Today Harness', vault: null, timestamp: Date.now() };

const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

async function openToday(page, path) {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.goto(path);
}

test('Home links to today\'s poem, and the address names it', async ({ page }) => {
  await openToday(page, '/');
  await page.locator('[data-home="today"]').click();
  await expect(page.locator('.today-line').first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => view(page)).toBe('today');
  await expect(page).toHaveURL(/\/today$/u);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} /today shows the poem, Begin plays it as verse, and leaving returns to it`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openToday(page, '/today');
    await expect(page.locator('.today-line').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.today-caption')).toContainText(/^Seed \d{4}-\d\d-\d\d · a /u);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    const shown = (await page.locator('.today-line').allTextContents()).join(' ');

    const begin = page.locator('[data-begin]');
    await begin.scrollIntoViewIfNeeded();
    await begin.click();
    await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'chamber-session'
      && !window.__RISE_TEST__.getRouterState().transitioning, null, { timeout: 20_000 });
    const session = await page.evaluate(() => {
      const s = window.__RISE_TEST__.getCurrentSession();
      return { text: [...s.sourceTexts.values()].join(' '), origin: s.origin };
    });
    expect(session.origin).toEqual({ view: 'today', name: 'Today\'s poem' });
    expect(session.text.replace(/\s+/gu, ' ').trim()).toBe(shown.replace(/\s+/gu, ' ').trim());

    await page.keyboard.press('Escape');
    await page.locator('#exit-confirm-overlay').getByRole('button', { name: 'End reading' }).click();
    await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'today', null, { timeout: 10_000 });
    await expect(begin).toBeEnabled();
  });
}
