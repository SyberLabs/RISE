import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Shelves', vault: null, timestamp: Date.now() };

// Standing at one shelf, a reader should see its canon in reading
// order: classical, then literary, then esoteric.
test('a shelf shows its divisions in order; All stays flat', async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
  await page.goto('/');
  await page.locator('[data-nav="library"]').first().click();
  await expect(page.locator('[data-filter="western"]')).toBeVisible({ timeout: 15000 });

  // "All" is a flat grid — divisions across four canons would say nothing.
  const flat = await page.evaluate(() =>
    document.querySelectorAll('[data-division]').length);

  await page.locator('[data-filter="western"]').click();
  const western = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    names: [...document.querySelectorAll('.archive-division-name')].map(n => n.textContent.trim()),
    cards: document.querySelectorAll('.archive-card').length,
    unplaced: document.querySelectorAll('[data-division="other"]').length
  }));

  await page.locator('[data-filter="indigenous"]').click();
  const indigenous = await page.evaluate(() => ({
    divisions: [...document.querySelectorAll('[data-division]')].map(d => d.dataset.division),
    cards: document.querySelectorAll('.archive-card').length
  }));

  console.log('ALL flat divisions: ' + flat);
  console.log('WESTERN ' + JSON.stringify(western));
  console.log('INDIGENOUS ' + JSON.stringify(indigenous));

  expect(flat).toBe(0);
  expect(western.divisions).toEqual(['classical', 'literary', 'esoteric']);
  expect(western.cards).toBe(14);
  // Nothing unplaced: every work is filed within its canon.
  expect(western.unplaced).toBe(0);
  // A shelf of one division renders flat rather than labelling the obvious.
  expect(indigenous.divisions).toEqual([]);
  expect(indigenous.cards).toBe(4);
});
