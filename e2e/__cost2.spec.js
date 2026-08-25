/** TEMPORARY — the engines the first pass missed. */
import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'Cost2', vault: null, timestamp: Date.now() };
test.describe.configure({ timeout: 180_000 });

test('DIAGNOSIS: remaining engine costs', async ({ page }) => {
  await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

  const rows = await page.evaluate(async () => {
    const visualCortex = await window.rise.ensureVisualCortex();
    visualCortex.init();
    const out = [];
    for (const type of ['apparitio', 'blueprint', 'freedom', 'diagram']) {
      const t = performance.now();
      let url = null;
      try { url = (await visualCortex.renderLeafStill(type))?.url || null; } catch (e) { /* */ }
      out.push({ type, ms: Math.round(performance.now() - t), drew: !!url });
    }
    return out;
  });

  console.log('\n=========== REMAINING COSTS ===========');
  for (const r of rows) console.log(`${r.type.padEnd(12)} ${String(r.ms).padStart(6)}ms  drew=${r.drew}`);
  console.log('=======================================\n');
});
