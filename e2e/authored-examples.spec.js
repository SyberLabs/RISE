import { readFileSync } from 'node:fs';
import { test, expect, openHomeNav } from './fixtures.js';

const GATE = { code: 'rise2025', name: 'Authored examples', vault: null, timestamp: Date.now() };

async function openExamples(page) {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.goto('/');
  await expect(page.locator('.portal h1').first()).toBeVisible({ timeout: 15_000 });
  await openHomeNav(page, 'vault');
  await expect(page.locator('.vault-examples')).toBeVisible({ timeout: 15_000 });
}

async function tryExample(page, id) {
  await page.locator(`[data-portable-example="${id}"]`).getByRole('button', { name: 'Try' }).click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.locator('#atom-display').textContent(), { timeout: 30_000 }).toMatch(/\S/u);
  expect(await page.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
}

test('quiet and energetic examples play distinct scores without saving; sound can be paused and muted', async ({ page, browser }) => {
  test.setTimeout(150_000);
  await openExamples(page);
  const examples = page.locator('.vault-examples [data-portable-example]');
  await expect(examples).toHaveCount(2);
  await expect(examples.nth(0)).toContainText('Quiet');
  await expect(examples.nth(1)).toContainText('Energetic');
  await page.screenshot({ path: test.info().outputPath('authored-examples-desktop.png'), fullPage: true });
  await tryExample(page, 'quiet');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('authored-quiet-desktop.png'), fullPage: true });
  await expect.poll(() => page.evaluate(() => !!window.__RISE_TEST__?.getAudioEngine()?.sessionActive)).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.__RISE_TEST__?.getAudioEngine()?.layers?.soundscape)).toBe(true);
  await page.keyboard.press('Space');
  await expect(page.locator('#play-icon')).toBeVisible();
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await expect(page.locator('#pause-icon')).toBeVisible();
  await page.mouse.move(640, 700);
  await expect(page.locator('#chamber-controls')).toHaveCSS('opacity', '1');
  await page.locator('#chamber-settings-btn').click();
  await expect(page.locator('#master-volume')).toBeVisible();
  await page.locator('#master-volume').fill('0');
  await expect(page.locator('#volume-value')).toContainText('0%');
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__?.getAudioEngine()?.config?.masterVolume)).toBe(0);
  await page.locator('#chamber-settings-btn').click();
  await page.mouse.move(640, 700);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => page.evaluate(() => !!window.__RISE_TEST__?.getAudioEngine()?.sessionActive)).toBe(false);
  await page.goto('/');
  await openHomeNav(page, 'vault');
  await tryExample(page, 'energetic');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('authored-energetic-desktop.png'), fullPage: true });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const energetic = await phone.newPage();
  try {
    await openExamples(energetic);
    await energetic.screenshot({ path: test.info().outputPath('authored-examples-mobile.png'), fullPage: true });
    await tryExample(energetic, 'quiet');
    await energetic.waitForTimeout(1500);
    await energetic.screenshot({ path: test.info().outputPath('authored-quiet-mobile.png'), fullPage: true });
    await energetic.goto('/');
    await openHomeNav(energetic, 'vault');
    await tryExample(energetic, 'energetic');
    await energetic.waitForTimeout(1500);
    await energetic.screenshot({ path: test.info().outputPath('authored-energetic-mobile.png'), fullPage: true });
  } finally {
    await phone.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  try {
    await openExamples(reducedPage);
    await tryExample(reducedPage, 'energetic');
    await reducedPage.waitForTimeout(1500);
    expect(await reducedPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await reducedPage.screenshot({ path: test.info().outputPath('authored-energetic-reduced.png'), fullPage: true });
  } finally {
    await reduced.close();
  }
});

test('Keep reviews the exact score; a saved child exports and plays in a clean browser', async ({ page, browser }) => {
  test.setTimeout(150_000);
  await openExamples(page);
  await page.locator('[data-portable-example="energetic"]').getByRole('button', { name: 'Keep' }).click();
  await expect(page.locator('.vault-portable-review')).toContainText('At the Palace Doors');
  expect(await page.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
  await page.getByRole('button', { name: 'Keep in this browser' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rise_workshop_v1') || '[]').length)).toBe(1);
  const parent = page.locator('.sequence-card').filter({ hasText: 'At the Palace Doors' }).first();
  await expect(parent.getByRole('button', { name: 'Vary as new' })).toBeVisible();
  const parentId = await page.evaluate(() => JSON.parse(localStorage.getItem('rise_workshop_v1'))[0].provenance.portableId);
  await parent.getByRole('button', { name: 'Vary as new' }).click();
  await expect(page.locator('.workshop-studio')).toBeVisible();
  await page.locator('#session-title').fill('A Palace Variation');
  await page.locator('[data-action="focus-reading-inspector"]').click();
  // fill acts on the live slider; an evaluate can land on one the Workshop
  // has just re-rendered on activation, and that input never reaches it.
  await page.locator('#wpm-slider').fill('240');
  await page.locator('[data-action="save-draft"]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rise_workshop_v1')).length)).toBe(2);
  await page.goto('/');
  await openHomeNav(page, 'vault');
  await page.getByRole('button', { name: 'Custom' }).click();
  const child = page.locator('.sequence-card').filter({ hasText: 'A Palace Variation' }).first();
  await expect(child).toContainText(parentId);
  await expect(parent).toContainText('At the Palace Doors');
  await child.locator('[data-portable-credit]').fill('Reader');
  const [download] = await Promise.all([
    page.waitForEvent('download'), child.getByRole('button', { name: 'Export portable score' }).click()
  ]);
  const bundle = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(bundle.parent).toEqual({ id: parentId });
  expect(bundle.reading.wpm).toBe(240);
  expect(bundle.program.authority).toBe('proposed');

  const clean = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recipient = await clean.newPage();
  try {
    await openExamples(recipient);
    await recipient.getByRole('button', { name: 'Custom' }).click();
    await recipient.locator('[data-portable-file]').setInputFiles({
      name: 'palace-variation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle))
    });
    await expect(recipient.locator('.vault-portable-review')).toContainText(parentId);
    expect(await recipient.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
    await recipient.getByRole('button', { name: 'Keep in this browser' }).click();
    const carried = recipient.locator('.sequence-card').filter({ hasText: 'A Palace Variation' }).first();
    await carried.getByRole('button', { name: 'Launch' }).click();
    await expect(recipient.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => recipient.locator('#atom-display').textContent(), { timeout: 30_000 }).toMatch(/\S/u);
  } finally {
    await clean.close();
  }
});
