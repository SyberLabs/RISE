/**
 * PASSAGE-DIRECTED VISUALS, IN A REAL BROWSER.
 *
 * Reading never waits for Jev: a released chapter read with imagery starts
 * at once under local direction, Jev's lookahead lands on a later block
 * boundary, and Hold, Off, and consent stay authoritative. Assertions are
 * tolerant of rendering differences: nonblank, structured, and moving, never
 * an exact pixel hash.
 */
import { test, expect, openHomeNav } from './fixtures.js';

const GATE = { code: 'rise2025', name: 'Flame', vault: null, timestamp: Date.now() };
const EMPTY_TREATMENT = 'violet-nebula';

async function gate(page) {
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g));
  }, GATE);
}

/** Answer visual-score requests with a fixed, valid direction. */
async function mockScoring(page, { delayMs = 0, treatmentId = EMPTY_TREATMENT, status = 200 } = {}) {
  const requests = [];
  await page.route('**/api/jev-visual-score', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    requests.push(body);
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'application/json', body: '{"error":{"code":"X"}}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 1,
        sourceDigest: body.sourceDigest,
        sectionDigest: body.sectionDigest,
        treatmentCatalogVersion: body.treatmentCatalogVersion,
        model: 'typesafe/jev-1.13',
        choices: body.blocks.map(block => ({ blockId: block.id, treatmentId, intensityBand: 'balanced' }))
      })
    }).catch(() => {});
  });
  return requests;
}

/** Library → Middlemarch → first chapter → Read with imagery → Begin. */
async function beginChapter(page, { wpm = 1000, text = null } = {}) {
  await page.goto('/');
  await expect(page.locator('.portal .portal-title').first()).toBeVisible({ timeout: 15_000 });
  if (text) {
    await page.evaluate(t => window.__RISE_TEST__.navigate('chamber', { text: t, source: 'Pasted' }), text);
  } else {
    await openHomeNav(page, 'library');
    await page.locator('[data-action="select-text"][data-id="middlemarch"]').first().click();
    await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30_000 });
    await page.locator('.toc-entry').first().click();
  }
  await page.waitForFunction(() => !!window.__RISE_TEST__?.getView('chamber')?.config?.text, null, { timeout: 20_000 });
  await page.locator('[data-stance="imagery"]').first().check({ force: true });
  await page.evaluate((value) => {
    window.__RISE_TEST__.getView('chamber').config.wpm = value;
  }, wpm);
  await page.locator('#begin-btn').click();
  await page.waitForFunction(() => window.__RISE_TEST__?.getView('chamber-session')?._direction,
    null, { timeout: 30_000 });
}

const direction = page => page.evaluate(() => {
  const chamber = window.__RISE_TEST__.getView('chamber-session');
  const state = chamber?._direction;
  return {
    mode: state?.mode,
    catalog: state?.catalogVerified ?? null,
    currentBlock: state?.currentBlock ?? null,
    admitted: (state?.director?.blocks || []).map(block => block.admitted
      ? `${block.admitted.treatmentId}:${block.admitted.provenance}` : null),
    staged: (state?.director?.blocks || []).filter(block => block.staged).length,
    flame: !!document.querySelector('.chamber-living-flame canvas.living-flame-canvas'),
    canvases: document.querySelectorAll('canvas.living-flame-canvas').length,
    renderer: chamber?.livingFlameField?.renderer || null,
    playing: chamber?.player?.state
  };
});

/** Draw the flame canvas into a 2D canvas and measure lit pixels. */
const litFraction = page => page.evaluate(() => {
  const field = window.__RISE_TEST__.getView('chamber-session')?.livingFlameField
    || window.__RISE_TEST__.getView('visual-lab')?.field;
  const url = field?.capture?.();
  if (!url) return Promise.resolve(0);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 100;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 160, 100);
      const pixels = context.getImageData(0, 0, 160, 100).data;
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 60) lit += 1;
      }
      resolve(lit / (160 * 100));
    };
    image.onerror = () => resolve(0);
    image.src = url;
  });
});

test.describe('passage-directed visuals', () => {
  test.setTimeout(120_000);

  test('a released chapter follows its text at once and adopts Jev at a later boundary', async ({ page }) => {
    await gate(page);
    const requests = await mockScoring(page, { delayMs: 1500 });
    await beginChapter(page);

    // Reading starts without waiting for Jev: local direction is on screen.
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    const first = await direction(page);
    expect(first.mode).toBe('follow');
    expect(first.playing).toBe('playing');
    expect(first.admitted[0]).toMatch(/:local$/);
    expect(await litFraction(page)).toBeGreaterThan(0.005);

    // The released text is verified and scored automatically, section by
    // section, with one request in flight.
    await expect.poll(async () => (await direction(page)).catalog, { timeout: 15_000 }).toBe(true);
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    for (const request of requests) {
      expect(request.blocks.length).toBeLessThanOrEqual(8);
      expect(Object.keys(request).sort()).toEqual(expect.arrayContaining(['blocks', 'schemaVersion', 'sectionDigest', 'sourceDigest']));
    }
    // The first block was entered before the reply and keeps its choice.
    await expect.poll(async () => (await direction(page)).staged, { timeout: 15_000 }).toBeGreaterThan(0);
    expect((await direction(page)).admitted[0]).toMatch(/:local$/);

    // At the next block boundary the staged Jev choice is adopted.
    await expect.poll(async () => (await direction(page)).admitted.filter(Boolean).length,
      { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    const later = await direction(page);
    expect(later.admitted[1]).toBe(`${EMPTY_TREATMENT}:jev`);
  });

  test('Off stays off: a pending reply never reactivates visuals', async ({ page }) => {
    await gate(page);
    await mockScoring(page, { delayMs: 4000 });
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.evaluate(() => window.__RISE_TEST__.getView('chamber-session').setVisualDirectionMode('off'));
    await page.waitForTimeout(6000);
    const state = await direction(page);
    expect(state.mode).toBe('off');
    expect(state.flame).toBe(false);
  });

  test('manual Hold outlasts block boundaries until Follow text is chosen again', async ({ page }) => {
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[name="vd-hue"]').evaluate((input) => {
      input.value = '120';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const held = await page.evaluate(() => window.__RISE_TEST__.getView('chamber-session')._currentFlameConfig().recipe);
    expect(held.macros.hue).toBe(120);
    await expect(page.locator('#vd-provenance')).toHaveText(/Manual/);
    await page.waitForTimeout(15_000);
    const after = await page.evaluate(() => window.__RISE_TEST__.getView('chamber-session')._currentFlameConfig()?.recipe);
    expect((await direction(page)).mode).toBe('hold');
    expect(after?.macros.hue).toBe(120);
    await page.locator('[name="vd-mode"][value="follow"]').check();
    expect((await direction(page)).mode).toBe('follow');
  });

  test('pasted text is never sent without consent, and revocation stops sending', async ({ page }) => {
    await gate(page);
    const requests = await mockScoring(page);
    const text = Array.from({ length: 30 }, (_, i) =>
      `Paragraph ${i + 1} of a private letter about the quiet garden and the long storm that followed it through the night.`
      + ' It continues with more ordinary sentences so that the block is long enough to matter.').join('\n\n');
    await beginChapter(page, { text, wpm: 600 });
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(4000);
    expect((await direction(page)).catalog).toBe(false);
    expect(requests).toHaveLength(0);

    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.getByRole('button', { name: 'Send this reading to Jev to direct its visuals.' }).click();
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: 'Stop sending' }).click();
    const sent = requests.length;
    await page.waitForTimeout(8000);
    expect(requests.length).toBe(sent);
  });

  test('Jev failure keeps local direction without interrupting the reader', async ({ page }) => {
    await gate(page);
    await mockScoring(page, { status: 503 });
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(3000);
    const state = await direction(page);
    expect(state.playing).toBe('playing');
    expect(state.admitted.filter(Boolean).every(item => item.endsWith(':local'))).toBe(true);
    await expect(page.locator('.toast, [role="alert"]').filter({ hasText: /Jev/i })).toHaveCount(0);
  });

  test('Escape closes the Lab over a reading and asks nothing else', async ({ page }) => {
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[data-vd="lab"]').click();
    await expect(page.locator('.visual-lab.is-overlay .living-flame-canvas')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.visual-lab')).toHaveCount(0);
    // The reading's exit confirmation must not have been opened underneath.
    await expect(page.locator('#exit-confirm-overlay')).not.toBeVisible();
    expect(await page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView))
      .toBe('chamber-session');
  });

  test('Chamber to Lab to reading: the scene is held, saved, and still saved after reload', async ({ page }) => {
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[data-vd="lab"]').click();
    await expect(page.locator('.visual-lab.is-overlay .living-flame-canvas')).toBeVisible({ timeout: 15_000 });
    expect((await direction(page)).playing).toBe('paused');
    await page.locator('[name="vl-preset"]').selectOption('prismatic-knot');
    await page.locator('[data-vl="save"]').click();
    await expect(page.locator('#vl-status')).toHaveText(/Saved/);
    await page.locator('[data-vl="use"]').click();
    await expect(page.locator('.visual-lab')).toHaveCount(0);
    const held = await page.evaluate(() => window.__RISE_TEST__.getView('chamber-session')._currentFlameConfig()?.recipe.name);
    expect(held).toMatch(/Prismatic Knot/);
    expect((await direction(page)).mode).toBe('hold');
    // Returning never resumes audio silently.
    expect((await direction(page)).playing).toBe('paused');

    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab .living-flame-canvas')).toBeVisible({ timeout: 20_000 });
    const scenes = await page.locator('[name="vl-preset"] optgroup[label="Your scenes"] option').allTextContents();
    expect(scenes.some(name => /Prismatic Knot · saved/.test(name))).toBe(true);
  });

  test('the Workshop round-trips admitted choices with full recipes', async ({ page }) => {
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[data-vd="workshop"]').click();
    await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'workshop', null, { timeout: 20_000 });
    await page.locator('#view-workshop [data-action="select-score-assignment"]').first().click();
    const picker = page.locator('#view-workshop [data-visual-style-setting="flame-composition"]');
    await expect(picker).toBeVisible({ timeout: 10_000 });
    await picker.selectOption('solar-bloom');
    await page.locator('#view-workshop').getByRole('button', { name: 'Run' }).click();
    await page.waitForFunction(() => window.__RISE_TEST__.getView('chamber-session')?._direction?.eligibility?.composite,
      null, { timeout: 30_000 });
    await expect.poll(() => page.evaluate(() =>
      window.__RISE_TEST__.getView('chamber-session')._currentFlameConfig()?.recipe.id), { timeout: 20_000 })
      .toBe('solar-bloom');
  });

  test('reduced motion shows a still flame with no animation loop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    const loop = await page.evaluate(() => {
      const field = window.__RISE_TEST__.getView('chamber-session').livingFlameField;
      return { reduced: field.reducedMotion, raf: field.raf };
    });
    expect(loop).toEqual({ reduced: true, raf: null });
  });

  test('repeated scene changes never accumulate flame layers', async ({ page }) => {
    await gate(page);
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.evaluate(async () => {
      const chamber = window.__RISE_TEST__.getView('chamber-session');
      for (let i = 0; i < 12; i += 1) {
        chamber.setVisualDirectionMode(i % 3 === 0 ? 'off' : i % 3 === 1 ? 'follow' : 'hold');
        chamber._editHeldFlame(recipe => ({ ...recipe, symmetry: 1 + (i % 8) }));
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    });
    await page.waitForTimeout(2000);
    expect((await direction(page)).canvases).toBeLessThanOrEqual(2);
  });
});

test.describe('Visual Lab', () => {
  test.setTimeout(90_000);

  test('draws, moves, mutates, and refuses a bad import without losing the scene', async ({ page }) => {
    await gate(page);
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab .living-flame-canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const lit = await litFraction(page);
    expect(lit).toBeGreaterThan(0.005);
    const before = await page.evaluate(() => window.__RISE_TEST__.getView('visual-lab').currentRecipe.id);
    await page.setInputFiles('[name="vl-import"]', {
      name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"nope"}')
    });
    await expect(page.locator('#vl-status')).toHaveText(/unsupported Living Flame version.*unchanged/);
    expect(await page.evaluate(() => window.__RISE_TEST__.getView('visual-lab').currentRecipe.id)).toBe(before);
    await page.locator('[data-vl="mutate"]').click();
    await expect(page.locator('[data-vl="undo"]')).toBeEnabled();
    await page.locator('[data-vl="undo"]').click();
    expect(await page.evaluate(() => window.__RISE_TEST__.getView('visual-lab').currentRecipe.id)).toBe(before);
  });

  test('falls back to a still when WebGL2 is unavailable', async ({ page }) => {
    await gate(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return type === 'webgl2' ? null : original.call(this, type, ...rest);
      };
    });
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab canvas.living-flame-still')).toBeAttached({ timeout: 30_000 });
    await expect(page.locator('#vl-renderer')).toHaveText(/still/, { timeout: 60_000 });
  });

  test('falls back when the flame shader fails to compile', async ({ page }) => {
    await gate(page);
    await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.getShaderParameter;
      WebGL2RenderingContext.prototype.getShaderParameter = function (shader, name) {
        return name === this.COMPILE_STATUS ? false : original.call(this, shader, name);
      };
    });
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab canvas.living-flame-still')).toBeAttached({ timeout: 30_000 });
  });

  test('recovers from a lost WebGL context', async ({ page }) => {
    await gate(page);
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab .living-flame-canvas')).toBeVisible({ timeout: 20_000 });
    const recovered = await page.evaluate(async () => {
      const field = window.__RISE_TEST__.getView('visual-lab').field;
      const loss = field.gpu.gl.getExtension('WEBGL_lose_context');
      loss.loseContext();
      await new Promise(resolve => setTimeout(resolve, 300));
      const lost = field.stats.contextLost === true;
      loss.restoreContext();
      await new Promise(resolve => setTimeout(resolve, 800));
      return { lost, renderer: field.renderer, restored: field.stats.contextLost === false };
    });
    expect(recovered).toEqual({ lost: true, renderer: 'webgl2', restored: true });
  });
});
