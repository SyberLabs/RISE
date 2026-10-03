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
