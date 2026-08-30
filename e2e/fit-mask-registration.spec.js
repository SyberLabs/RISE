/**
 * THE OUTLINE AND THE FILL ARE ONE WORD.
 *
 * A Fit word is drawn by two elements: the border is a -webkit-text-stroke on
 * the atom, and the imagery is a separate layer clipped by an SVG mask. They
 * line up only as well as two different centring rules agree, and
 * `dominant-baseline: central` resolves through font metrics each engine
 * chooses for itself — measured at up to 0.85px out in Chromium, ±0.34 in
 * WebKit.
 *
 * A fraction of a pixel is invisible until two composited layers snap to the
 * device grid independently and round it opposite ways. Then the outline
 * separates from the fill, which is what iOS Safari showed at DPR 3 while
 * every desktop looked clean. The runtime measures its own error now and
 * cancels it; this is the number that must stay at zero.
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

test('the mask glyph registers with the word it traces', async ({ page }) => {
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

  const rows = [];
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(650);
    const m = await page.evaluate(() => {
      const atom = document.querySelector('#atom-display');
      const svgText = document.querySelector('.chamber-fit-mask-defs text');
      if (!atom || !svgText || !atom.firstChild) return null;
      const field = document.querySelector('#chamber-field');
      const fieldRect = field.getBoundingClientRect();
      // Where the HTML glyph's ink actually is, in the field's coordinates —
      // the same space the mask is drawn in (maskUnits userSpaceOnUse).
      const range = document.createRange();
      range.selectNodeContents(atom);
      const ink = range.getBoundingClientRect();
      // Where the mask's glyph is, in that same user space.
      const box = svgText.getBBox();
      if (!ink.width || !box.width) return null;
      // WHERE THE MASK IS DRAWN vs WHERE IT IS APPLIED.
      // maskUnits=userSpaceOnUse resolves against the element wearing the
      // mask — the fill host — while paint() computes coordinates from the
      // FIELD's border box. Any gap between those origins shifts everything.
      const host = document.querySelector('.chamber-fill-field');
      const hostRect = host.getBoundingClientRect();
      const fs = getComputedStyle(field);
      return {
        word: (atom.textContent || '').trim(),
        hostDx: +(hostRect.left - fieldRect.left).toFixed(2),
        hostDy: +(hostRect.top - fieldRect.top).toFixed(2),
        fieldPad: `${fs.paddingTop}/${fs.paddingLeft}`,
        fieldBorder: `${fs.borderTopWidth}/${fs.borderLeftWidth}`,
        dx: +((box.x + box.width / 2) - (ink.left - fieldRect.left + ink.width / 2)).toFixed(2),
        dy: +((box.y + box.height / 2) - (ink.top - fieldRect.top + ink.height / 2)).toFixed(2),
        dw: +(box.width - ink.width).toFixed(2),
        dh: +(box.height - ink.height).toFixed(2)
      };
    });
    if (m && !rows.some(r => r.word === m.word)) rows.push(m);
  }
  // eslint-disable-next-line no-console
  console.log('ALIGN ' + JSON.stringify(rows));

  expect(rows.length, 'several words were measured').toBeGreaterThan(2);
  for (const row of rows) {
    // The mask glyph sits ON the word it traces, not near it. Sub-pixel is
    // exactly what gets rounded apart on a device with a fractional grid.
    expect(Math.abs(row.dx), `${row.word} horizontal drift ${row.dx}px`).toBeLessThan(0.5);
    expect(Math.abs(row.dy), `${row.word} vertical drift ${row.dy}px`).toBeLessThan(0.5);
    // And it is the same glyph, at the same size.
    expect(Math.abs(row.dw), `${row.word} width drift`).toBeLessThan(1);
    expect(Math.abs(row.dh), `${row.word} height drift`).toBeLessThan(1);
    // The two layers share an origin; a gap here shifts everything at once.
    expect(row.hostDx, 'the fill host starts where the field does').toBe(0);
    expect(row.hostDy).toBe(0);
  }
});
