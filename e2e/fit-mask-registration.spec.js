/**
 * THE OUTLINE AND THE FILL ARE ONE GLYPH.
 *
 * The mask and contour both reference one SVG text node. This browser test
 * exercises desktop and phone geometry at DPR 3 and guards the shared-node
 * contract that prevents independent HTML/SVG font rounding from separating
 * the outline from the image-filled word.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Align', vault: null, timestamp: Date.now() };
const SEED = { text: 'At the treacherous dream descended upon the host. '.repeat(8).trim(), textSource: 'Iliad', origin: null };
const PREFS = {
  wpm: 260, chunkMode: 'word', recitation: { enabled: false },
  visualInterlocution: {
    visualMode: 'interlocution',
    interlocution: {
      sourceFamily: 'procedural', procedural: ['fractal'], sourced: [],
      presentation: 'continuous',
      wordFill: { mode: 'pick', sourceFamily: 'collections', procedural: [], sourced: ['aic-landscapes'], border: 'cream' }
    }
  }
};

async function enterChamber(page) {
  await page.addInitScript(({ g, s, p }) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(s));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(p));
    localStorage.setItem('rise-settings', JSON.stringify({ chamberFace: 'thick', fontSize: 'fit' }));
  }, { g: GATE, s: SEED, p: PREFS });
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 25_000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  if (await warn.isVisible().catch(() => false)) await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 25_000 });
}

async function sharedGlyphMetrics(page) {
  await expect(page.locator('.chamber-fit-mask-defs.is-ready')).toBeVisible({ timeout: 25_000 });
  return page.evaluate(() => {
    const atom = document.querySelector('#atom-display');
    const glyph = document.querySelector('.chamber-fit-mask-defs defs text');
    const maskUse = document.querySelector('.chamber-fit-mask-glyph');
    const contour = document.querySelector('.chamber-fit-glyph-contour');
    if (!atom || !glyph || !maskUse || !contour) return null;
    const glyphBox = glyph.getBBox();
    const maskBox = maskUse.getBBox();
    const contourBox = contour.getBBox();
    const css = getComputedStyle(atom);
    return {
      glyphId: glyph.id,
      maskHref: maskUse.getAttribute('href'),
      contourHref: contour.getAttribute('href'),
      maskDelta: [
        maskBox.x - glyphBox.x,
        maskBox.y - glyphBox.y,
        maskBox.width - glyphBox.width,
        maskBox.height - glyphBox.height
      ],
      contourDelta: [
        contourBox.x - glyphBox.x,
        contourBox.y - glyphBox.y,
        contourBox.width - glyphBox.width,
        contourBox.height - glyphBox.height
      ],
      htmlStroke: css.webkitTextStrokeWidth
    };
  });
}

function expectSharedGlyph(metrics) {
  expect(metrics).not.toBeNull();
  expect(metrics.maskHref).toBe(`#${metrics.glyphId}`);
  expect(metrics.contourHref).toBe(`#${metrics.glyphId}`);
  for (const delta of [...metrics.maskDelta, ...metrics.contourDelta]) {
    expect(Math.abs(delta)).toBeLessThan(0.01);
  }
  expect(metrics.htmlStroke).toBe('0px');
}

for (const [surface, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  test.describe(surface, () => {
    test.use({ viewport, deviceScaleFactor: 3 });
    test('FIT mask and outline share one glyph', async ({ page }) => {
      await enterChamber(page);
      expectSharedGlyph(await sharedGlyphMetrics(page));
    });
  });
}
