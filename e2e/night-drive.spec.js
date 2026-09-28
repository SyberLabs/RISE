import { test, expect } from './fixtures.js';

// The Tokyo Drift reproduction, as a public page: neon light at speed,
// light streaks, a beat, readable text, and no provider call.
test('Night Drive plays neon light, streaks and the beat without a Jev request', async ({ page }) => {
  let jevRequests = 0;
  await page.route('**/api/jev-recommend', route => {
    jevRequests += 1;
    return route.abort();
  });
  await page.goto('/night-drive');
  // The open door has no entry screen (#264); the sample is the first view.
  await expect(page.locator('#beta-enter')).toHaveCount(0);
  await expect(page.locator('#portal-jev-demo')).toContainText('no film footage or soundtrack');
  await page.locator('#jev-scene-demo-start').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });

  const painted = selector => page.evaluate(sel => [...document.querySelectorAll(sel)]
    .some(canvas => canvas.width > 0 && canvas.getContext('2d')
      ?.getImageData(0, 0, canvas.width, canvas.height).data
      .some((value, index) => index % 4 === 3 && value > 0)), selector);
  await expect.poll(() => painted('.chamber-attractor .night-streaks-canvas'), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => painted('.chamber-attractor .attractor-canvas'), { timeout: 10_000 }).toBe(true);

  const state = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__.getView('chamber-session');
    return {
      projection: chamber.session.projection,
      soundscape: chamber.session.soundscape,
      palette: chamber.attractorField?.palette,
      speed: chamber.attractorField?.speed,
      streaks: !!chamber.nightStreaks
    };
  });
  expect(state).toEqual({ projection: 'stream', soundscape: 'night-drive', palette: 'neon', speed: 2.4, streaks: true });
  await expect(page.locator('#atom-display')).toContainText(/\S/, { timeout: 10_000 });

  // Page plates carry both layers, as the Stream shows them.
  const plates = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__.getView('chamber-session');
    return {
      both: chamber._sampleAttractorPlate(6)?.length || 0,
      filament: chamber.attractorField.sampleAt(6)?.length || 0
    };
  });
  expect(plates.both).toBeGreaterThan(plates.filament);
  expect(jevRequests).toBe(0);
});
