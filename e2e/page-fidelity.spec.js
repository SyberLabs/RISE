import { test, expect } from '@playwright/test';
import { collectAcrossPages } from './page-helpers.js';
const GATE = { code: 'rise2025', name: 'Fidelity', vault: null, timestamp: Date.now() };
const SEED = {
  text: Array.from({ length: 14 }, (_, i) =>
    `Paragraph ${i}. The pendulum draws the chord it hears, and the room answers in kind, slowly and without hurry.`).join('\n\n'),
  textSource: 'Seed', origin: null
};
const PREFS = {
  visualInterlocution: {
    visualMode: 'interlocution',
    interlocution: {
      sourceFamily: 'procedural', procedural: ['fractal'], sourced: [],
      presentation: 'behind-stream'
    }
  }
};

test('a PROCEDURAL reading with no program typesets rendered stills', async ({ page }) => {
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
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await page.waitForTimeout(2000);

  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(7000);   // resolve + decode

  // The Page is paginated now, so one DOM snapshot is one page's worth.
  // This assertion is about the READING, so it walks the reading.
  const config = await page.evaluate(() => ({
    hasProgram: !!window.__RISE_TEST__?.getCurrentSession()?.visualProgram,
    sourced: window.__RISE_TEST__?.getCurrentSession()?.visualConfig?.interlocution?.sourced,
    procedural: window.__RISE_TEST__?.getCurrentSession()?.visualConfig?.interlocution?.procedural
  }));
  const stats = { ...config, ...(await collectAcrossPages(page)) };
  console.log('FIDELITY ' + JSON.stringify(stats));

  expect(stats.hasProgram).toBe(false);            // no authored schedule
  expect(stats.procedural).toContain('fractal');
  expect(stats.texts).toBeGreaterThan(5);
  expect(stats.figures).toBeGreaterThan(0);        // …yet imagery appears
  expect(stats.shown).toBeGreaterThanOrEqual(1);   // and it resolved
});
