import { test, expect } from '@playwright/test';
const GATE = { code: 'rise2025', name: 'Suspend', vault: null, timestamp: Date.now() };
const SEED = { text: 'The pendulum draws the chord it hears. '.repeat(60).trim(), textSource: 'Seed', origin: null };

// A Gallery reading: the clearest temporal presenter to observe.
const PREFS = {
  visualInterlocution: {
    visualMode: 'interlocution',
    interlocution: {
      sourceFamily: 'collections', procedural: [], sourced: ['aic-landscapes'],
      presentation: 'continuous', streamGlass: true
    }
  }
};

async function boot(page, prefs = PREFS) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(g.prefs));
  }, { gate: GATE, seed: SEED, prefs });
  await page.goto('/');
  await expect(page.locator('.portal-arch-sol')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
}

test('opening the Page suspends the Gallery; leaving restores it', async ({ page }) => {
  await boot(page);
  await page.locator('#begin-btn').click();
  // The notice appears only for a flashing presentation; Gallery opens
  // straight into the reading. This test is not about the gate, so it
  // accepts one if offered and proceeds if not.
  const warn = page.locator('#photosensitivity-modal');
  await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await warn.isVisible()) await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
  await page.waitForTimeout(6000);   // let the Gallery mount + reveal

  const before = await page.evaluate(() => ({
    layers: document.querySelectorAll('#chamber-continuous-field .continuous-field-layer').length,
    hostMounted: !!document.querySelector('#chamber-continuous-field')
  }));

  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1200);
  const during = await page.evaluate(() => ({
    layers: document.querySelectorAll('#chamber-continuous-field .continuous-field-layer').length
  }));

  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeHidden();
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({
    layers: document.querySelectorAll('#chamber-continuous-field .continuous-field-layer').length
  }));

  console.log('GALLERY ' + JSON.stringify({ before, during, after }));
  expect(before.layers).toBe(2);      // Gallery was live
  expect(during.layers).toBe(0);      // suspended under the page
  expect(after.layers).toBe(2);       // restored on return
});

test('a spatial launch runs no temporal visual machinery', async ({ page }) => {
  await boot(page);
  // choose the page projection directly on the orbital config
  await page.evaluate(() => {
    const inst = window.rise.router.views.get('chamber').instance;
    inst.config.projection = 'page';
  });
  await page.locator('#begin-btn').click();
  // No interlocution consent should be requested at all.
  const warn = page.locator('#photosensitivity-modal');
  const sawWarning = await warn.isVisible({ timeout: 3000 }).catch(() => false);
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const ch = window.rise.router.views.get('chamber-session').instance;
    return {
      projection: window.rise.currentSession?.projection,
      visualMode: window.rise.currentSession?.visualConfig?.visualMode,
      suspended: window.rise.currentSession?.visualConfig?.suspendedVisualMode,
      galleryLayers: document.querySelectorAll('.continuous-field-layer').length,
      hasRhythmic: ch?.hasRhythmicVisuals,
      playerState: ch?.player?.state
    };
  });
  console.log('SPATIAL_LAUNCH ' + JSON.stringify({ sawWarning, ...state }));
  expect(state.projection).toBe('page');
  expect(state.visualMode).toBe('interlocution');    // authorial choice survives
  expect(state.suspended).toBeUndefined();           // no shadow configuration
  expect(state.galleryLayers).toBe(0);               // no Gallery clock
  expect(state.hasRhythmic).toBe(true);               // capability, not execution
  expect(sawWarning).toBe(false);                    // no consent prompt needed
});

test('a focal survives a direct Page launch and renders above the reading', async ({ page }) => {
  await boot(page, {
    visualInterlocution: {
      visualMode: 'focals',
      focals: { type: 'standard', standardGlyph: 'star' }
    }
  });
  await page.evaluate(() => {
    window.rise.router.views.get('chamber').instance.config.projection = 'page';
  });
  await page.locator('#begin-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.page-masthead .page-focal')).toHaveText('✦');

  const state = await page.evaluate(() => ({
    visualMode: window.rise.currentSession?.visualConfig?.visualMode,
    suspended: window.rise.currentSession?.visualConfig?.suspendedVisualMode,
    hiddenFocal: document.querySelectorAll('#chamber-field .chamber-focal').length
  }));
  expect(state.visualMode).toBe('focals');
  expect(state.suspended).toBeUndefined();
  expect(state.hiddenFocal).toBe(0);

  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('#chamber-page')).toBeHidden();
  await expect(page.locator('#chamber-field .chamber-focal')).toHaveCount(1);
});
