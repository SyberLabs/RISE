import { test, expect } from './fixtures.js';

/**
 * Home is the Oracle: one object, one key. ROLL composes a reading on the
 * device; ENTER plays it; ADJUST opens it in Reader Setup with everything
 * already set, and Begin plays exactly what was rolled, look included.
 */
const GATE = { code: 'rise2025', name: 'Oracle Harness', vault: null, timestamp: Date.now() };

async function openHome(page) {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.goto('/');
  await expect(page.locator('[data-oracle="roll"]')).toBeVisible({ timeout: 15_000 });
}

async function roll(page) {
  await page.locator('[data-oracle="roll"]').click();
  await expect(page.locator('[data-oracle="enter"]')).toBeVisible({ timeout: 10_000 });
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('rise-oracle-v1')).result.decision);
}

const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

/** Horizontal overflow of the page, in px; the 3D glass must never cause any. */
const sideways = page => page.evaluate(() =>
  Math.max(document.documentElement.scrollWidth, document.querySelector('.portal').scrollWidth) - innerWidth);

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} the whole instrument and the legal links fit on one screen`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    const fits = async () => page.evaluate(() => {
      const bottom = selector => document.querySelector(selector).getBoundingClientRect().bottom;
      return {
        keys: bottom('.oracle-keys') <= innerHeight,
        legal: bottom('.portal-legal') <= innerHeight + 1
      };
    });
    expect(await fits()).toEqual({ keys: true, legal: true });
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await roll(page);
    expect(await fits()).toEqual({ keys: true, legal: true });
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await page.locator('[data-oracle="ask-open"]').click();
    await expect(page.locator('#oracle-intent')).toBeFocused();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} ENTER leads and the other two keys sit beneath it, smaller`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await roll(page);
    await page.waitForTimeout(1200);
    const box = selector => page.locator(selector).boundingBox();
    const [enter, again, adjust] = [await box('[data-oracle="enter"]'), await box('[data-oracle="roll"]'), await box('[data-oracle="adjust"]')];
    // One lead key, above the other two, which sit side by side and are smaller in both directions.
    expect(enter.y + enter.height, 'ENTER is above the others').toBeLessThanOrEqual(Math.min(again.y, adjust.y));
    expect(enter.width).toBeGreaterThan(again.width);
    expect(enter.height).toBeGreaterThan(again.height);
    expect(Math.abs(again.y - adjust.y)).toBeLessThan(2);
    expect(again.x + again.width).toBeLessThan(adjust.x);
    // The lead key is centred, and the pair is centred beneath it.
    const centre = b => b.x + b.width / 2;
    expect(Math.abs(centre(enter) - (again.x + adjust.x + adjust.width) / 2)).toBeLessThan(2);
    // Smaller, but still a touch target.
    expect(Math.min(again.height, adjust.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(again.width, adjust.width)).toBeGreaterThanOrEqual(44);
  });
}

test('the worst results (the longest author, a two-line title, the widest plan) sit inside the window', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openHome(page);
    // The object lays out a moment after Home appears; results are sized against it.
    await expect.poll(() => page.evaluate(() => document.querySelector('.oracle-stage').style.getPropertyValue('--r'))).not.toBe('');
    for (const [work, temper, section] of [['lyrical-ballads', 'revel', 'shortest'], ['the-photo-that-knew-your-street', 'ember', 'longest'], ['spoon-river-anthology', 'signal', 'first']]) {
      const fit = await page.evaluate(async ([work, temper, section]) => {
        const portal = window.__RISE_TEST__.getView('portal');
        const tools = await portal.loadTools();
        const decision = tools.composeRoll({ temper: tools.TEMPERS.find(t => t.id === temper), workId: work, section });
        portal.result = portal.describe(tools, decision, { source: 'roll', temper });
        portal.rolled = true;
        portal.setState('result');
        await new Promise(resolve => setTimeout(resolve, 300));
        const answer = document.querySelector('.oracle-answer');
        const radius = parseFloat(document.querySelector('.oracle-stage').style.getPropertyValue('--r'));
        // Nothing may fall below a readable size, however far it was scaled.
        const smallest = Math.min(...[...answer.querySelectorAll('.oracle-answer-meta, .oracle-answer-mood')]
          .map(el => parseFloat(getComputedStyle(el).fontSize)));
        return { height: answer.offsetHeight, room: radius * 0.86, smallest };
      }, [work, temper, section]);
      expect(fit.height, `${work} at ${viewport.width}px`).toBeLessThanOrEqual(fit.room + 1);
      expect(fit.smallest, `${work} at ${viewport.width}px`).toBeGreaterThanOrEqual(10);
    }
  }
});

test('a small phone never scrolls sideways, in any state', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openHome(page);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await roll(page);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await page.locator('[data-oracle="ask-open"]').click();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
});

test('ENTER plays the rolled reading, and Home still holds it on return', async ({ page }) => {
  await openHome(page);
  const decision = await roll(page);
  const title = await page.locator('.oracle-answer-title').textContent();
  await page.locator('[data-oracle="enter"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { wpm: s.wpm, face: s.presentation?.chamberFace, experience: s.origin?.experience };
  });
  expect(session).toEqual({ wpm: decision.config.wpm, face: decision.config.presentation.chamberFace, experience: 'jev' });
  // The object draws only while Home is shown.
  expect(await page.evaluate(() => window.__RISE_TEST__.getView('portal')?.object?.running)).toBe(false);

  await page.locator('#chamber-display').hover();
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('portal');
  await expect(page.locator('.oracle-answer-title')).toHaveText(title);
});

test('ADJUST opens Reader Setup with the rolled reading set, and Begin plays it as rolled', async ({ page }) => {
  await openHome(page);
  const decision = await roll(page);
  await page.locator('[data-oracle="adjust"]').click();
  await expect.poll(() => view(page), { timeout: 20_000 }).toBe('chamber');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  const setup = await page.evaluate(() => {
    const c = window.__RISE_TEST__.getView('chamber').config;
    return { wpm: c.wpm, chunkMode: c.chunkMode, presentation: c.presentation, origin: c.origin?.view };
  });
  expect(setup).toEqual({
    wpm: decision.config.wpm,
    chunkMode: decision.config.chunkMode,
    presentation: decision.config.presentation,
    origin: 'portal'
  });
  // The back button already says Home; no chip repeats it.
  await expect(page.locator('.orbital-origin-chip')).toHaveCount(0);

  await page.locator('#begin-btn').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  const begun = await page.evaluate(() => window.__RISE_TEST__.getCurrentSession().presentation);
  expect(begun).toEqual(decision.config.presentation);
  await expect.poll(() => page.evaluate(() => document.querySelector('#atom-display')?.dataset.chamberFace))
    .toBe(decision.config.presentation.chamberFace);
});

test('under reduced motion a roll is a short fade and the object holds still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const started = Date.now();
  await roll(page);
  expect(Date.now() - started).toBeLessThan(2000);
  const still = await page.evaluate(() => {
    const object = window.__RISE_TEST__.getView('portal').object;
    return [object.pos.yaw, object.pos.pitch, object.pos.roll].every(v => v === 0);
  });
  expect(still).toBe(true);
});
