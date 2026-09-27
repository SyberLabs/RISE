import { test, expect } from './fixtures.js';

const GATE = { code: 'rise2025', name: 'Short sequence test', vault: null, timestamp: Date.now() };
async function authorize(page) {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
}

test('a short sequence unfolds in the Chamber and returns a private next step', async ({ page }) => {
  test.setTimeout(90000);
  await authorize(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/short-sequences/');
  await expect(page.getByRole('heading', { name: 'Find a place to start, focus, or stop.' })).toBeVisible();
  await page.getByRole('button', { name: /Make room/ }).click();
  await expect(page.getByRole('heading', { name: 'Make room' })).toBeVisible();
  await page.getByRole('button', { name: /Enter the reading/ }).click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#atom-display')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Keep this line' }).click();
  await expect(page.getByRole('button', { name: 'Continue reading' })).toBeVisible();
  await expect(page.getByText('Stay with this line as long as you like.')).toBeVisible();
  const heldTime = await page.locator('#time-current').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('#time-current')).toHaveText(heldTime);
  await page.getByRole('button', { name: 'Continue reading' }).click();
  await expect(page.getByRole('button', { name: 'Keep this line' })).toBeVisible();
  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeVisible();
  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeHidden();
  await page.locator('#chamber-display').hover();
  await page.locator('#play-pause-btn').click();
  await expect(page.locator('#post-choice-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.post-stats')).toBeHidden();
  await expect(page.locator('#post-recursion')).toBeHidden();
  await page.getByRole('button', { name: 'Choose a next step' }).click();
  await expect(page.getByRole('heading', { name: 'Carry one thing forward.' })).toBeVisible();
  await expect(page.locator('#short-kept-text')).not.toBeEmpty();
  await page.getByLabel('What will you give the next ten minutes?').fill('Open the draft and write one sentence');
  await page.getByRole('button', { name: 'Copy my next step' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Open the draft and write one sentence');
  expect(await page.evaluate(() => localStorage.getItem('rise-sequence-preview-v1'))).toBeNull();
});

test('the old URL forwards and old records can be erased', async ({ page }) => {
  await authorize(page);
  await page.addInitScript(() => localStorage.setItem('rise-sequence-preview-v1', '{"schemaVersion":1,"records":[]}'));
  await page.goto('/sequences/');
  await expect(page).toHaveURL(/\/short-sequences\/$/);
  await expect(page.getByText('An earlier preview saved reading records on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Erase old preview records' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rise-sequence-preview-v1'))).toBeNull();
  await page.setViewportSize({ width: 390, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a reader can hold and resume a line at phone width', async ({ page }) => {
  await authorize(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/short-sequences/');
  await page.getByRole('button', { name: /Enter the reading/ }).click();
  await expect(page.locator('#atom-display')).not.toBeEmpty({ timeout: 30000 });
  const keep = page.getByRole('button', { name: 'Keep this line' });
  await expect(keep).toBeInViewport();
  await keep.click();
  await expect(page.getByRole('button', { name: 'Continue reading' })).toBeInViewport();
  await expect(page.getByText('Stay with this line as long as you like.')).toBeInViewport();
  await page.getByRole('button', { name: 'Continue reading' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
