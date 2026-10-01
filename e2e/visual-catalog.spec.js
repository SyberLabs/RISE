import { expect, test } from './fixtures.js';

const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();

async function paintedBytes(canvas) {
  return canvas.evaluate(element => {
    const { width, height } = element;
    const context = element.getContext('2d');
    if (!context || !width || !height) return [];
    const pixels = context.getImageData(0, 0, width, height).data;
    const sampled = [];
    for (let y = 0; y < 64; y += 1) {
      const py = Math.min(height - 1, Math.floor(y * height / 64));
      for (let x = 0; x < 64; x += 1) {
        const px = Math.min(width - 1, Math.floor(x * width / 64));
        const offset = (py * width + px) * 4;
        sampled.push(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]);
      }
    }
    return sampled;
  });
}

async function openCatalogSample(page, id, rendererSelector) {
  await page.goto(`/live?catalog=${id}&voice=paced`);
  await expect(page.locator('.live-catalog-note')).toContainText(`This sample begins with ${id}.`);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#live-controls')).toBeVisible();
  await expect.poll(() => shown(page), { timeout: 15_000 }).toContain('A black hole is a region of space');

  const renderer = page.locator(rendererSelector).first();
  await expect(renderer).toBeVisible({ timeout: 15_000 });
  const initialText = await shown(page);
  const before = await paintedBytes(renderer);
  expect(before.some(byte => byte !== 0), `${id} paints nonzero bytes to its mounted canvas`).toBe(true);

  await expect.poll(() => shown(page), { timeout: 20_000 }).not.toBe(initialText);
  const after = await paintedBytes(renderer);
  expect(after.some(byte => byte !== 0), `${id} keeps painting while narration advances`).toBe(true);
  await expect(renderer).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#live-controls')).toHaveCount(0);
}

test('search loads a rendered Klee specimen with real image pixels', async ({ page }) => {
  await page.goto('/visual-catalog');
  await page.locator('#visual-catalog-search').fill('klee');
  const card = page.locator('[data-visual-id="klee"]');
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: 'Open as a live reading' })).toHaveAttribute('href', '/live?catalog=klee');
  await card.getByRole('button', { name: 'Preview specimen' }).click();

  const specimen = card.locator('.visual-catalog__preview img');
  await expect(specimen).toBeVisible({ timeout: 20_000 });
  const pixels = await specimen.evaluate(image => {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return [];
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return [...context.getImageData(0, 0, canvas.width, canvas.height).data];
  });
  expect(pixels.some(byte => byte !== 0), 'the loaded specimen contains rendered pixel data').toBe(true);
});

test('catalog query and same-path browser history restore the visible search and results', async ({ page }) => {
  await page.goto('/visual-catalog?q=klee');
  await expect(page.locator('#visual-catalog-search')).toHaveValue('klee');
  await expect(page.locator('[data-visual-id="klee"]')).toBeVisible();

  await page.evaluate(() => {
    history.pushState({}, '', '/visual-catalog?q=attractor');
    history.pushState({}, '', '/visual-catalog?q=turrell');
  });
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/visual-catalog\?q=attractor$/u);
  await expect(page.locator('#visual-catalog-search')).toHaveValue('attractor');
  await expect(page.locator('[data-visual-id="attractor"]')).toBeVisible();
  await expect(page.locator('[data-visual-id="klee"]')).toHaveCount(0);

  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/visual-catalog\?q=turrell$/u);
  await expect(page.locator('#visual-catalog-search')).toHaveValue('turrell');
  await expect(page.locator('[data-visual-id="turrell"]')).toBeVisible();
  await expect(page.locator('[data-visual-id="attractor"]')).toHaveCount(0);
});

test('the Klee catalog choice mounts its Genesis canvas while live narration advances', async ({ page }) => {
  await openCatalogSample(page, 'klee', '.chamber-genesis canvas.klee-field-canvas');
});

test('the Attractor catalog choice mounts its canvas while live narration advances', async ({ page }) => {
  await openCatalogSample(page, 'attractor', '.chamber-attractor canvas.attractor-canvas');
});

test('unknown and specimen-only catalog URLs are refused before a reading starts', async ({ page }) => {
  await page.goto('/live?catalog=unknown-visual');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not in the visual catalog');
  await expect(page.locator('#live-controls')).toHaveCount(0);

  await page.goto('/live?catalog=turrell');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('specimen only');
  await expect(page.locator('#live-controls')).toHaveCount(0);

  await page.goto('/visual-catalog');
  const specimenOnly = page.locator('[data-visual-id="turrell"]');
  await expect(specimenOnly).toContainText('Specimen only; no live opening is admitted.');
  await expect(specimenOnly.getByRole('link', { name: 'Open as a live reading' })).toHaveCount(0);
});

test('without a 2D context, an admitted sample keeps readable narration and explains stillness', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...options) {
      if (type === '2d') return null;
      return getContext.call(this, type, ...options);
    };
  });
  await page.goto('/live?catalog=attractor&voice=paced');
  await expect(page.locator('.live-catalog-note')).toContainText('Drawing is unavailable. This reading begins without imagery.');
  await expect(page.locator('.live-notes [data-capability="canvas"]')).toContainText('The words are shown without imagery.');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect.poll(() => shown(page), { timeout: 15_000 }).toContain('A black hole is a region of space');
  const firstText = await shown(page);
  await expect.poll(() => shown(page), { timeout: 20_000 }).not.toBe(firstText);
  await expect(page.locator('.live-catalog-note')).toContainText('without imagery');
});
