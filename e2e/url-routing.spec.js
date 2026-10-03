import { test, expect, openHomeNav, openHomeRoom } from './fixtures.js';

const pathOf = page => new URL(page.url()).pathname + new URL(page.url()).search;

test('Home, Library and Chapel each have an address that survives reload and Back', async ({ page }) => {
  await page.goto('/');
  await openHomeNav(page, 'library');
  await expect(page.locator('[data-filter="received"]')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/library');

  await page.reload();
  await expect(page.locator('[data-filter="received"]')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/library');

  await page.goBack();
  await expect(page.locator('.portal-nav [data-nav="library"]')).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/');

  await openHomeRoom(page, 'chapel');
  await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/library/chapel');

  await page.goBack();
  await expect.poll(() => pathOf(page)).toBe('/');
  await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeHidden();
  await page.goForward();
  await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeVisible({ timeout: 15_000 });
});

test('a Chapel chapter address opens the Chapel at that chapter, and reload keeps it', async ({ page }) => {
  await page.goto('/library/chapel/matthew/2');
  await expect(page.locator('.chapel-chapter-last[data-chapter="2"]')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/library/chapel/matthew/2');

  await page.reload();
  await expect(page.locator('.chapel-chapter-last[data-chapter="2"]')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/library/chapel/matthew/2');
});

test('a reading address with no reading falls back to the Chamber setup', async ({ page }) => {
  await page.goto('/read/session');
  await expect(page.locator('#view-chamber')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => pathOf(page)).toBe('/read');
});

test('an unknown address opens Home', async ({ page }) => {
  await page.goto('/nothing/here');
  await expect(page.locator('.portal-nav [data-nav="library"]')).toBeAttached({ timeout: 15_000 });
});

test('a chapter chosen in the Chapel is part of its address, and survives reload and Back', async ({ page }) => {
  await page.goto('/');
  await openHomeNav(page, 'library');
  await expect.poll(() => pathOf(page)).toBe('/library');
  await page.goBack();
  await expect.poll(() => pathOf(page)).toBe('/');
  await page.waitForFunction(() => window.__RISE_TEST__
    && window.__RISE_TEST__.getRouterState().currentView === 'portal'
    && !window.__RISE_TEST__.getRouterState().transitioning);
  await openHomeRoom(page, 'chapel');
  await expect(page.locator('.chapel-book[data-book-id="matthew"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('.chapel-book[data-book-id="matthew"]').click();
  await page.locator('[data-book-id="matthew"][data-chapter="2"]').click();
  // The choice opens the Chamber setup; Back returns to the chapter chosen.
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  await expect.poll(() => pathOf(page)).toBe('/read');
  await page.goBack();
  await expect.poll(() => pathOf(page)).toBe('/library/chapel/matthew/2');
  await expect(page.locator('.chapel-chapter-last[data-chapter="2"]')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.locator('.chapel-chapter-last[data-chapter="2"]')).toBeVisible({ timeout: 15_000 });
  await page.goBack();
  await expect.poll(() => pathOf(page)).toBe('/');
  await expect(page.locator('.portal-nav [data-nav="library"]')).toBeAttached({ timeout: 15_000 });
});

test('Back never resurrects a finished reading', async ({ page }) => {
  await page.goto('/');
  await openHomeRoom(page, 'chapel');
  await page.locator('.chapel-book[data-book-id="jude"]').click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await warn.isVisible()) await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await expect.poll(() => pathOf(page)).toBe('/read/session');

  await page.locator('#chamber-display').hover();
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => pathOf(page)).not.toBe('/read/session');

  for (let i = 0; i < 2; i++) {
    await page.goBack();
    await page.waitForTimeout(1200);
    expect(pathOf(page)).not.toBe('/read/session');
  }
  await expect(page.locator('#chamber-display')).toBeHidden();
  await expect(page.locator('.chapel-book[data-book-id="matthew"], .portal-nav [data-nav="library"]').first())
    .toBeAttached({ timeout: 15_000 });
});
