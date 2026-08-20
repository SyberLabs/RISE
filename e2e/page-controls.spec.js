import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'Controls', vault: null, timestamp: Date.now() };
const SEED = { text: 'The pendulum draws the chord it hears. '.repeat(60).trim(), textSource: 'Seed', origin: null };
const PREFS = {
  visualInterlocution: {
    visualMode: 'interlocution',
    interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [], presentation: 'behind-stream' }
  }
};

test('the control bar condenses in Page Mode and restores on return', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(g.prefs));
  }, { gate: GATE, seed: SEED, prefs: PREFS });
  await page.goto('/');
  await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15000 });
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  await expect(warn).toBeVisible({ timeout: 15000 });
  await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
  await page.waitForTimeout(1500);

  const shown = async () => page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    };
    return {
      play: vis('#play-pause-btn'), time: vis('#time-display'),
      visuals: vis('#visuals-toggle-btn'), music: vis('#volume-btn'),
      pageBtn: vis('#page-mode-btn'), exit: vis('#exit-btn')
    };
  });

  await page.locator('#chamber-display').hover();
  const inStream = await shown();

  await page.locator('#page-mode-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
  await page.locator('#chamber-display').hover();
  const inPage = await shown();

  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeHidden();
  await page.locator('#chamber-display').hover();
  const restored = await shown();

  console.log('BAR ' + JSON.stringify({ inStream, inPage, restored }));

  // Stream: the full transport is present.
  expect(inStream.play).toBe(true);
  expect(inStream.time).toBe(true);
  expect(inStream.visuals).toBe(true);

  // Page: only what a reader needs — page toggle, music, exit.
  expect(inPage.play).toBe(false);
  expect(inPage.time).toBe(false);
  expect(inPage.visuals).toBe(false);
  expect(inPage.music).toBe(true);
  expect(inPage.pageBtn).toBe(true);
  expect(inPage.exit).toBe(true);

  // Returning restores everything cleanly.
  expect(restored).toEqual(inStream);
});
