import { test, expect } from './fixtures.js';

/**
 * /try/: the public one-minute sample linked from syberlabs.io, its
 * completion screen, and the visitor's own text after it.
 */

/** Move the open reading to its last phrase, so it finishes in seconds rather than a minute. */
async function skipToLastPhrase(page) {
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__.getView('read')?.paneInstance('chamber')?.player?.state))
    .toBe('playing');
  await page.evaluate(() => {
    const { player } = window.__RISE_TEST__.getView('read').paneInstance('chamber');
    player.seekTo(player.sessionState.session.atoms.length - 1);
  });
}

test('the sample reads silently to its completion screen, whose actions lead on', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/try/');
  await expect(page.locator('h1')).toHaveText('Metamorphoses');
  await expect(page.locator('[data-duration]')).toHaveText('About 1 minute');
  const begin = page.getByRole('button', { name: 'Begin reading' });
  // Begin is on the first screen of a phone, without scrolling.
  await expect(begin).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const sound = page.getByRole('switch', { name: /Sound/u });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.press('Enter');
  await expect(sound).toHaveAttribute('aria-checked', 'false');

  await begin.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/try\/$/u);
  await skipToLastPhrase(page);

  await expect(page.locator('h1')).toHaveText('Now try your words.', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/try\/$/u);
  await expect(page.locator('#chamber-display')).toHaveCount(0);
  await expect(page.getByText('Bring a short excerpt and choose how it reads.')).toBeVisible();
  const own = page.getByRole('link', { name: 'Read your own text' });
  await expect(own).toHaveAttribute('href', '/try/your-text/');
  await expect(page.getByRole('link', { name: 'Create a reading for your publication' }))
    .toHaveAttribute('href', 'https://syberlabs.io/services/');
  await expect(page.getByRole('button', { name: 'Replay sample' })).toBeVisible();

  await own.click();
  await expect(page).toHaveURL(/\/try\/your-text\/$/u);
  await expect(page.getByLabel(/Your text/u)).toBeVisible();
});

test('the visitor\'s own text reads and comes back to be read again or edited', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/try/your-text/');
  const field = page.getByLabel(/Your text/u);
  await expect(field).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin reading' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-count]')).toHaveText('0 / 5,000 characters');
  await field.fill('These are my own words.\n\nRISE reads them here.');
  await expect(page.locator('[data-count]')).toHaveText('46 / 5,000 characters');
  await page.getByRole('switch', { name: /Sound/u }).click();
  await page.getByRole('button', { name: 'Begin reading' }).click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await skipToLastPhrase(page);

  await expect(page.getByRole('button', { name: 'Read again' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Create a reading for your publication' }))
    .toHaveAttribute('href', 'https://syberlabs.io/services/');
  await page.getByRole('button', { name: 'Edit text' }).click();
  await expect(field).toHaveValue('These are my own words.\n\nRISE reads them here.');
});

test('the sample with sound on is spoken by the release voice', async ({ page }) => {
  await page.goto('/try/');
  await page.getByRole('button', { name: 'Begin reading' }).click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  expect(await page.evaluate(() => Boolean(window.__RISE_TEST__.getView('read').paneInstance('chamber').voice))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__.getAudioEngine().audible)).toBe(true);
});
