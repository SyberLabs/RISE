import { test, expect } from './fixtures.js';

/**
 * Home is the night library: a sky of works behind a text panel. Roll a
 * reading, or pick a star; a result names the text, the mood and the passage,
 * each with its own Redraw. Start reading plays it; Adjust first opens it in
 * Reader Setup with everything already set, and Begin plays exactly what was
 * rolled, look included.
 */
async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
}

async function roll(page) {
  await page.locator('[data-home="roll"]').click();
  await expect(page.locator('[data-home="enter"]')).toBeVisible({ timeout: 10_000 });
  return page.evaluate(() => window.__RISE_TEST__.getView('home').result.decision);
}

/** A star the sky drew for this work, once the sky has loaded. */
const star = (page, workId) => page.locator(`.home-sky .sky-star[data-work-id="${workId}"]`);

// Read's panes are named as `read/setup`, `read/chamber`.
const view = page => page.evaluate(() => {
  const { currentView } = window.__RISE_TEST__.getRouterState();
  return currentView === 'read' ? `read/${window.__RISE_TEST__.getView('read')?.activePane}` : currentView;
});

/** Horizontal overflow of the page, in px; no state may cause any. */
const sideways = page => page.evaluate(() =>
  Math.max(document.documentElement.scrollWidth, document.querySelector('.portal').scrollWidth) - innerWidth);

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} Roll a reading is on the first screen, and nothing scrolls sideways in any state`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(page.locator('h1')).toHaveText('Every star is a text you can read.');
    const bottom = selector => page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().bottom, selector);
    expect(await bottom('[data-home="roll"]')).toBeLessThanOrEqual(viewport.height);
    expect(await bottom('[data-home="ask-open"]')).toBeLessThanOrEqual(viewport.height);
    if (viewport.width >= 900) expect(await bottom('.portal-legal')).toBeLessThanOrEqual(viewport.height + 1);
    // Only one solid key.
    await expect(page.locator('.home .btn-primary')).toHaveCount(1);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await star(page, 'oedipus-rex').waitFor({ state: 'attached', timeout: 15_000 });
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await roll(page);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await page.locator('[data-home="ask-open"]').click();
    await expect(page.locator('h1')).toHaveText('Asking needs your own AI.');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}

test('on a phone the sky is a band above the panel; on a desk it fills the page behind it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const boxes = () => page.evaluate(() => {
    const box = sel => document.querySelector(sel).getBoundingClientRect().toJSON();
    return { sky: box('.home-sky'), panel: box('.home-panel') };
  });
  let { sky, panel } = await boxes();
  expect(sky.height).toBeGreaterThanOrEqual(220);
  expect(sky.bottom).toBeLessThanOrEqual(panel.top + 1);
  await page.setViewportSize({ width: 1280, height: 800 });
  ({ sky, panel } = await boxes());
  expect(sky.left).toBeLessThanOrEqual(panel.left);
  expect(sky.top).toBeLessThanOrEqual(panel.top);
  expect(sky.right).toBeGreaterThan(panel.right);
  expect(sky.bottom).toBeGreaterThanOrEqual(panel.bottom - 1);
});

test('a star opens its work with the three parts, the opening lines, and a Redraw for the text and the mood', async ({ page }) => {
  await openHome(page);
  await star(page, 'oedipus-rex').click({ timeout: 15_000 });
  await expect(page.locator('h1')).toHaveText('Oedipus Rex', { timeout: 10_000 });
  await expect(page.locator('.home-byline')).toContainText('Sophocles, from the');
  await expect(page.locator('.home-part-label')).toHaveText(['The text', 'The mood', 'The passage']);
  for (const part of ['text', 'mood']) {
    await expect(page.locator(`[data-home="redraw-${part}"]`)).toHaveAccessibleName(`Redraw the ${part}`);
  }
  await expect(page.locator('[data-home="redraw-passage"]')).toHaveCount(0);
  // The opening lines, in the reading face, once they load.
  const lines = page.locator('.home-lines');
  await expect(lines).not.toBeEmpty({ timeout: 15_000 });
  expect(await lines.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Crimson Pro');
  await expect(page.locator('.home .btn-primary')).toHaveText('Start reading');
  await expect(page.locator('.home-actions button')).toHaveText(['Start reading', 'Roll again', 'Adjust first']);
  await expect(page.locator('[data-home="ask-open"]')).toHaveText('Ask for something specific instead');
});

test('Redraw changes one part and keeps the other two', async ({ page }) => {
  await openHome(page);
  await star(page, 'middlemarch').click({ timeout: 15_000 });
  await expect(page.locator('h1')).toHaveText('Middlemarch', { timeout: 10_000 });
  const state = () => page.evaluate(() => {
    const { decision, temper } = window.__RISE_TEST__.getView('home').result;
    return { workId: decision.workId, temper, section: decision.config.section };
  });
  let before = await state();
  await page.locator('[data-home="redraw-mood"]').click();
  await expect.poll(async () => (await state()).temper).not.toBe(before.temper);
  let after = await state();
  expect([after.workId, after.section]).toEqual([before.workId, before.section]);
  await expect(page.locator('[data-home="redraw-mood"]')).toBeFocused();

  before = after;
  await page.locator('[data-home="redraw-text"]').click();
  await expect.poll(async () => (await state()).workId).not.toBe(before.workId);
  after = await state();
  expect([after.temper, after.section]).toEqual([before.temper, before.section]);
});

test('Home still rolls when the sky cannot load', async ({ page }) => {
  await page.route(/\/assets\/(NightSky|library-sky)-[^/]+\.js$/u, route => route.abort());
  await openHome(page);
  await page.waitForTimeout(1000);
  await expect(page.locator('.home-sky .sky-star')).toHaveCount(0);
  await roll(page);
  await expect(page.locator('.home-alert')).toBeHidden();
});

test("a reload starts with nothing chosen, so the first roll is always the reader's own", async ({ page }) => {
  await openHome(page);
  await roll(page);
  await page.reload();
  await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('h1')).toHaveText('Every star is a text you can read.');
  await expect(page.locator('[data-home="enter"]')).toHaveCount(0);
});

test('the longest titles and plans stay on a small phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openHome(page);
  for (const [work, temper, section] of [['lyrical-ballads', 'revel', 'shortest'], ['the-photo-that-knew-your-street', 'ember', 'longest'], ['spoon-river-anthology', 'signal', 'first']]) {
    await page.evaluate(async ([work, temper, section]) => {
      const portal = window.__RISE_TEST__.getView('home');
      const tools = await portal.loadTools();
      const decision = tools.composeRoll({ temper: tools.TEMPERS.find(t => t.id === temper), workId: work, section });
      portal.showResult(tools, decision, { source: 'roll', temper });
    }, [work, temper, section]);
    await expect(page.locator('[data-home="enter"]')).toBeVisible();
    expect(await sideways(page), work).toBeLessThanOrEqual(0);
    // Nothing a reader must read is under 12px.
    const smallest = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.home-panel *')]
      .filter(el => el.textContent.trim() && el.getClientRects().length)
      .map(el => parseFloat(getComputedStyle(el).fontSize))));
    expect(smallest, work).toBeGreaterThanOrEqual(12);
  }
});

test('Start reading plays the reading, and Home still holds it on return', async ({ page }) => {
  await openHome(page);
  const decision = await roll(page);
  const title = await page.locator('h1').textContent();
  await page.locator('[data-home="enter"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { wpm: s.wpm, face: s.presentation?.chamberFace, experience: s.origin?.experience };
  });
  expect(session).toEqual({ wpm: decision.config.wpm, face: decision.config.presentation.chamberFace, experience: 'jev' });

  await page.locator('#chamber-display').hover();
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
  await expect(page.locator('h1')).toHaveText(title);
});

test('Adjust first opens Reader Setup with the rolled reading set, and Begin plays it as rolled', async ({ page }) => {
  await openHome(page);
  const decision = await roll(page);
  await page.locator('[data-home="adjust"]').click();
  await expect.poll(() => view(page), { timeout: 20_000 }).toBe('read/setup');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  const setup = await page.evaluate(() => {
    const c = window.__RISE_TEST__.getView('read').paneInstance('setup').config;
    return { wpm: c.wpm, chunkMode: c.chunkMode, presentation: c.presentation, origin: c.origin?.view };
  });
  expect(setup).toEqual({
    wpm: decision.config.wpm,
    chunkMode: decision.config.chunkMode,
    presentation: decision.config.presentation,
    origin: 'home'
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

test('under reduced motion a roll is quick and the passage placeholder holds still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const started = Date.now();
  await roll(page);
  expect(Date.now() - started).toBeLessThan(2000);
  // The lines may already have arrived, so check the placeholder's own rule on a fresh one.
  const animation = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'home-passage-loading';
    probe.append(document.createElement('span'));
    document.querySelector('.home-passage').append(probe);
    const name = getComputedStyle(probe.firstChild).animationName;
    probe.remove();
    return name;
  });
  expect(animation).toBe('none');
});
