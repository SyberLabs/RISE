import { test, expect } from './fixtures.js';

// syberlabs.io's primary action lands here. The page is static (public/sequences/),
// so this is the only check that its list, reader, finish and feedback states work.
test('a short sequence can be chosen, read, finished and answered locally', async ({ page }) => {
  const crossOrigin = [];
  page.on('request', (request) => {
    if (!['localhost', '127.0.0.1'].includes(new URL(request.url()).hostname)) crossOrigin.push(request.url());
  });
  await page.goto('/sequences/');

  const rows = page.locator('#sequence-cards .sequence-row');
  await expect(rows).toHaveCount(3);
  await rows.first().click();

  await expect(page.locator('#read-title')).toHaveText('Begin again');
  await expect(page.locator('#step-count')).toHaveText('Part 1 of 3');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish sequence' }).click();

  await expect(page.locator('#finish-title')).toBeVisible();
  await expect(page.locator('#next-title')).toHaveText('Make room');
  const yes = page.locator('[data-worth="yes"]');
  await yes.click();
  await expect(yes).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#feedback-status')).toHaveText('Answer recorded in this session. You can change it here.');
  await expect(page.getByRole('link', { name: 'Email SyberLabs' })).toHaveAttribute('href', /^mailto:syberlabs\.software@gmail\.com/);

  await page.getByRole('button', { name: 'Read this next' }).click();
  await expect(page.locator('#read-title')).toHaveText('Make room');
  expect(crossOrigin).toEqual([]);
});
