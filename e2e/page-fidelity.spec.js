import { test, expect } from '@playwright/test';
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
      sourceFamily: 'collections', procedural: [], sourced: ['aic-landscapes'],
      presentation: 'behind-stream'
    }
  }
};

test('a sourced reading with NO program still typesets figures', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(g.prefs));
  }, { gate: GATE, seed: SEED, prefs: PREFS });
  await page.goto('/');
  await expect(page.locator('.portal-arch-sol')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  await expect(warn).toBeVisible({ timeout: 15000 });
  await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
  await page.waitForTimeout(2000);

  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(7000);   // resolve + decode

  const stats = await page.evaluate(() => ({
    hasProgram: !!window.rise?.currentSession?.visualProgram,
    sourced: window.rise?.currentSession?.visualConfig?.interlocution?.sourced,
    texts: document.querySelectorAll('.page-text').length,
    figures: document.querySelectorAll('.page-figure').length,
    shown: document.querySelectorAll('.page-figure.is-shown').length
  }));
  console.log('FIDELITY ' + JSON.stringify(stats));
  expect(stats.hasProgram).toBe(false);            // no authored schedule
  expect(stats.sourced).toContain('aic-landscapes');
  expect(stats.texts).toBeGreaterThan(5);
  expect(stats.figures).toBeGreaterThan(0);        // …yet imagery appears
  expect(stats.shown).toBeGreaterThanOrEqual(1);   // and it resolved
});
