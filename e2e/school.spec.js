import { test, expect, revealChamberControls } from './fixtures.js';

const route = page => page.evaluate(() => `${window.__RISE_TEST__?.getRouterState().currentView}/${window.__RISE_TEST__?.getView('library')?.activePane}`);

test('the Mystery School opens on the Gate, reads a text, and returns to its house', async ({ page }) => {
  await page.goto('/school');
  const lectern = page.locator('.school-lectern');
  await expect(lectern).toHaveAttribute('data-focus', 'gate', { timeout: 15_000 });
  // The address is written in place only once the router has settled on the room.
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await expect(lectern).toContainText('The Gate');
  await expect(page.locator('.school-wheel [data-record]')).toHaveCount(66);

  await page.locator('.school-wheel [data-house="sun"]').click();
  await expect(page).toHaveURL(/\/school\/sun$/u);
  await lectern.locator('[data-focus="sun.meditations"]').click();
  await expect(page).toHaveURL(/\/school\/sun\.meditations$/u);
  const read = lectern.locator('.school-action button[data-read="sun.meditations"]');
  await expect(read).toBeEnabled({ timeout: 15_000 });
  await read.click();

  await expect(page).toHaveURL(/\/read$/u);
  await page.waitForFunction(
    () => !!window.__RISE_TEST__?.getView('read')?.paneInstance('setup')?.config?.text,
    null, { timeout: 15_000 });
  const setup = await page.evaluate(() => {
    const config = window.__RISE_TEST__.getView('read').paneInstance('setup').config;
    return { source: config.textSource, origin: config.origin?.view, theme: config.presentation?.colorTheme };
  });
  expect(setup).toEqual({ source: expect.stringContaining('Meditations'), origin: 'school', theme: 'citrine' });

  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#begin-btn').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);

  await revealChamberControls(page);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect(page).toHaveURL(/\/school\/sun$/u);
  await expect.poll(() => route(page), { timeout: 15_000 }).toBe('library/school');
  await expect(lectern).toHaveAttribute('data-focus', 'sun');
});

test('a School corpus text reads from its own shelf', async ({ page }) => {
  await page.goto('/school/sun.zarathustra');
  const lectern = page.locator('.school-lectern');
  await expect(lectern).toHaveAttribute('data-focus', 'sun.zarathustra', { timeout: 15_000 });
  await expect(lectern.locator('.school-facts')).toContainText('Thomas Common, 1909, via Standard Ebooks');
  await expect(lectern.locator('button[data-entry]')).toHaveCount(81, { timeout: 15_000 });
  await lectern.locator('.school-action button[data-read="sun.zarathustra"]').click();

  await expect(page).toHaveURL(/\/read$/u);
  await page.waitForFunction(
    () => !!window.__RISE_TEST__?.getView('read')?.paneInstance('setup')?.config?.text,
    null, { timeout: 15_000 });
  const source = await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('setup').config.textSource);
  expect(source).toBe('Thus Spoke Zarathustra · Part I · Zarathustra’s Prologue');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#begin-btn').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
});

test('a picture work shows its unit\'s own plate as the reading\'s field', async ({ page }) => {
  // The plate's bytes are served here so the proof does not depend on Commons; the request is what is proved.
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  await page.route('https://upload.wikimedia.org/**', route => route.fulfill({ status: 200, contentType: 'image/gif', body: pixel }));
  await page.goto('/school/jupiter.art-forms-in-nature');
  const lectern = page.locator('.school-lectern');
  await expect(lectern).toHaveAttribute('data-focus', 'jupiter.art-forms-in-nature', { timeout: 15_000 });
  await expect(lectern).toContainText('A picture work: each unit is one plate');
  await expect(lectern.locator('button[data-entry]')).toHaveCount(100, { timeout: 15_000 });

  const plate = page.waitForRequest(request => request.url().startsWith('https://upload.wikimedia.org/')
    && request.url().includes('Haeckel_Discomedusae_8.jpg'), { timeout: 30_000 });
  await lectern.locator('button[data-entry="7"]').click();
  await expect(page).toHaveURL(/\/read$/u);
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#begin-btn').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  console.log(`HAECKEL_PLATE ${(await plate).url()}`);
});

test('a path named in the address is chosen and read in the Lectern', async ({ page }) => {
  await page.goto('/school/path-ficino');
  await expect(page.locator('.school-lectern')).toContainText('The Ficino Path', { timeout: 15_000 });
  await expect(page.locator('.school-chip[data-path="ficino"]')).toHaveAttribute('aria-pressed', 'true');
});

/** Measured, not assumed: the circle fits, the rim stays in its box, and phone points are ink only. */
for (const [width, height] of [[1440, 900], [1280, 720], [390, 844]]) {
  test(`the Wheel holds its shape at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/school');
    await expect(page.locator('.school-wheel [data-record]')).toHaveCount(66, { timeout: 15_000 });
    const m = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const wheel = box(document.querySelector('.school-wheel'));
      const houses = [...document.querySelectorAll('.school-wheel [data-house]')].map(el => ({ id: el.dataset.house, ...box(el).toJSON() }));
      const points = [...document.querySelectorAll('.school-wheel [data-record]:not([data-gate])')].map(el => {
        const r = box(el);
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      let closest = Infinity;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
        }
      }
      const point = document.querySelector('[data-record="sun.meditations"]');
      const numerals = [...document.querySelectorAll('.school-numeral')].map(el => Number.parseFloat(getComputedStyle(el).fontSize));
      return {
        viewport: innerHeight,
        wheel: wheel.toJSON(),
        moonBottom: houses.find(h => h.id === 'moon').bottom,
        housesOutside: houses.filter(h => h.left < wheel.left - 0.5 || h.right > wheel.right + 0.5
          || h.top < wheel.top - 0.5 || h.bottom > wheel.bottom + 0.5).map(h => h.id),
        closest,
        pointerEvents: getComputedStyle(point).pointerEvents,
        tabindex: point.getAttribute('tabindex'),
        gatePointer: getComputedStyle(document.querySelector('[data-gate]')).pointerEvents,
        numerals,
        overflowX: document.documentElement.scrollWidth > innerWidth
      };
    });
    console.log(`SCHOOL ${width}x${height} ${JSON.stringify(m)}`);
    expect(m.housesOutside).toEqual([]);
    expect(m.overflowX).toBe(false);
    expect(Math.min(...m.numerals)).toBeGreaterThanOrEqual(10);
    if (width > 820) {
      expect(m.moonBottom).toBeLessThanOrEqual(m.viewport);
      expect(m.pointerEvents).toBe('auto');
    }
    if (width <= 480) {
      expect(m.pointerEvents).toBe('none');
      expect(m.tabindex).toBe('-1');
      expect(m.gatePointer).toBe('auto');
    }
  });
}
