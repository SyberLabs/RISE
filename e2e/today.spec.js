import { test, expect } from './fixtures.js';

/**
 * Today's poem has no page: Home opens on it, already playing, and Read it
 * with sound begins the day's exact poem in the reader under the day's
 * procedural visual (the app's launchToday, as /today does). Leaving the
 * reading returns Home.
 */
const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

async function boot(page, path = '/') {
  await page.goto(path);
}

async function reading(page) {
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'read'
    && window.__RISE_TEST__.getView('read')?.activePane === 'chamber'
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
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'home', null, { timeout: 10_000 });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} Home's Read it with sound begins today's poem under its visual, and leaving returns Home`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await boot(page);
    const enter = page.locator('[data-home="enter"]');
    await expect(enter).toBeEnabled({ timeout: 15_000 });
    const opening = page.locator('[data-home-opening]');
    await expect(opening).not.toBeEmpty({ timeout: 15_000 });
    const first = (await opening.textContent()).trim().split('\n')[0].trim();
    await enter.click();
    const session = await reading(page);
    // Home's opening is the poem the reader plays.
    expect(session.text.replace(/\s+/gu, ' ').trim().startsWith(first.replace(/\s+/gu, ' '))).toBe(true);
    expect(session.origin).toMatchObject({ view: 'home', experience: 'today' });
    // Every poem of the day is read under a procedural visual, never on plain black.
    expect(session.visualMode).toBeTruthy();
    expect(session.visualMode).not.toBe('off');
    await leave(page);
    await expect(page.locator('[data-home="enter"]')).toBeVisible();
  });
}

test('the /today address opens today\'s poem, then hands the address back to Home', async ({ page }) => {
  await boot(page, '/today');
  const session = await reading(page);
  expect(session.origin).toMatchObject({ experience: 'today' });
  await expect(page).toHaveURL(/\/$/u);
  await leave(page);
  expect(await view(page)).toBe('home');
});
