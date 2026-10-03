import { test, expect } from './fixtures.js';

/**
 * Today's poem has no page: Home's card, the Menu and the /today address all
 * begin the day's exact poem in the reader, under the day's procedural visual,
 * and leaving the reading returns Home.
 */
const GATE = { code: 'rise2025', name: 'Today Harness', vault: null, timestamp: Date.now() };

const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

async function boot(page, path = '/') {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.goto(path);
}

async function reading(page) {
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'chamber-session'
    && !window.__RISE_TEST__.getRouterState().transitioning, null, { timeout: 20_000 });
  return page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return {
      text: [...s.sourceTexts.values()].join(' '),
      origin: s.origin,
      visualMode: s.visualConfig?.visualMode ?? null
    };
  });
}

async function leave(page) {
  await page.keyboard.press('Escape');
  await page.locator('#exit-confirm-overlay').getByRole('button', { name: 'End reading' }).click();
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'portal', null, { timeout: 10_000 });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} Home's card begins today's poem under its visual, and leaving returns Home`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await boot(page);
    const card = page.locator('.home-today-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const line = (await card.locator('.home-today-line').textContent()).trim();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    // With the card in, Roll is still on the first screen, and on a desk so is the footer.
    const bottom = selector => page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().bottom, selector);
    expect(await bottom('[data-home="roll"]')).toBeLessThanOrEqual(viewport.height);
    if (viewport.width >= 900) expect(await bottom('.portal-legal')).toBeLessThanOrEqual(viewport.height + 1);
    await card.click();
    const session = await reading(page);
    // The card's first line opens the poem the reader plays.
    expect(session.text.replace(/\s+/gu, ' ').trim().startsWith(line)).toBe(true);
    expect(session.origin).toMatchObject({ view: 'portal', experience: 'today' });
    // Every poem of the day is read under a procedural visual, never on plain black.
    expect(session.visualMode).toBeTruthy();
    expect(session.visualMode).not.toBe('off');
    await leave(page);
    await expect(page.locator('.home-today-card')).toBeVisible();
  });
}

test('the Menu begins today\'s poem', async ({ page }) => {
  await boot(page);
  await page.locator('.portal-menu-toggle').click();
  await page.locator('.portal-nav [data-action="today"]').click();
  const session = await reading(page);
  expect(session.origin).toMatchObject({ experience: 'today' });
});

test('the /today address opens today\'s poem, then hands the address back to Home', async ({ page }) => {
  await boot(page, '/today');
  const session = await reading(page);
  expect(session.origin).toMatchObject({ experience: 'today' });
  await expect(page).toHaveURL(/\/$/u);
  await leave(page);
  expect(await view(page)).toBe('portal');
});
