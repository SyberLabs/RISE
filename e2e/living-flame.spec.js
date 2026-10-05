/**
 * PASSAGE-DIRECTED VISUALS, IN A REAL BROWSER.
 *
 * Reading never waits for Jev: a released chapter read with imagery starts
 * at once under local direction, Jev's lookahead lands on a later block
 * boundary, and Hold, Off, and consent stay authoritative. Assertions are
 * tolerant of rendering differences: nonblank, structured, and moving, never
 * an exact pixel hash.
 */
import { test, expect, openHomeNav, connectTestOpenRouter } from './fixtures.js';

const EMPTY_TREATMENT = 'violet-nebula';

/** Answer visual-score requests with a fixed, valid direction. */
async function mockScoring(page, { delayMs = 0, treatmentId = EMPTY_TREATMENT, status = 200 } = {}) {
  const requests = [];
  await page.route('https://openrouter.ai/api/alpha/decisions', async route => {
    const body = route.request().postDataJSON() || {};
    requests.push(body);
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (status !== 200) {
      await route.fulfill({ status, json: { error: { message: 'Scripted failure.' } } });
      return;
    }
    const answers = Object.fromEntries(Object.keys(body.questions || {}).map(key => [key, {
      type: 'choice', choice: key.endsWith('Treatment') ? treatmentId : 'balanced'
    }]));
    await route.fulfill({
      status: 200, json: { provider: 'TypeSafe', model: 'typesafe/jev-1.13', answers }
    }).catch(() => {});
  });
  return requests;
}

/** Library → Middlemarch → first chapter → Read with imagery → Begin. */
async function beginChapter(page, { wpm = 1000, text = null, connectAI = false } = {}) {
  await page.goto('/');
  await expect(page.locator('.portal h1').first()).toBeVisible({ timeout: 15_000 });
  if (connectAI) await connectTestOpenRouter(page);
  if (text) {
    await page.evaluate(t => window.__RISE_TEST__.navigate('chamber', { text: t, source: 'Pasted' }), text);
  } else {
    await openHomeNav(page, 'library');
    await page.locator('[data-action="select-text"][data-id="middlemarch"]').first().click();
    await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30_000 });
    await page.locator('.toc-entry').first().click();
  }
  await page.waitForFunction(() => !!window.__RISE_TEST__?.getView('read')?.paneInstance('setup')?.config?.text, null, { timeout: 20_000 });
  await page.locator('[data-stance="imagery"]').first().check({ force: true });
  await page.evaluate((value) => {
    window.__RISE_TEST__.getView('read').paneInstance('setup').config.wpm = value;
  }, wpm);
  await page.locator('#begin-btn').click();
  await page.waitForFunction(() => window.__RISE_TEST__?.getView('read')?.paneInstance('chamber')?._direction,
    null, { timeout: 30_000 });
}

const direction = page => page.evaluate(() => {
  const chamber = window.__RISE_TEST__.getView('read')?.paneInstance('chamber');
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
  const field = window.__RISE_TEST__.getView('read')?.paneInstance('chamber')?.livingFlameField
    || window.__RISE_TEST__.getView('make')?.tabInstance('visual-lab')?.field;
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
    const requests = await mockScoring(page, { delayMs: 1500 });
    await beginChapter(page, { connectAI: true });

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
      expect(request.state.passage_blocks.length).toBeLessThanOrEqual(8);
      expect(Object.keys(request)).toEqual(expect.arrayContaining(['model', 'state', 'questions']));
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
    await mockScoring(page, { delayMs: 4000 });
    await beginChapter(page, { connectAI: true });
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber').setVisualDirectionMode('off'));
    await page.waitForTimeout(6000);
    const state = await direction(page);
    expect(state.mode).toBe('off');
    expect(state.flame).toBe(false);
  });

  test('manual Hold outlasts block boundaries until Follow text is chosen again', async ({ page }) => {
    await mockScoring(page);
    await beginChapter(page, { connectAI: true });
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[name="vd-hue"]').evaluate((input) => {
      input.value = '120';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const held = await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber')._currentFlameConfig().recipe);
    expect(held.macros.hue).toBe(120);
    await expect(page.locator('#vd-provenance')).toHaveText(/Manual/);
    await page.waitForTimeout(15_000);
    const after = await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber')._currentFlameConfig()?.recipe);
    expect((await direction(page)).mode).toBe('hold');
    expect(after?.macros.hue).toBe(120);
    await page.locator('[name="vd-mode"][value="follow"]').check();
    expect((await direction(page)).mode).toBe('follow');
  });

  test('pasted text is never sent without consent, and revocation stops sending', async ({ page }) => {
    const requests = await mockScoring(page);
    const text = Array.from({ length: 30 }, (_, i) =>
      `Paragraph ${i + 1} of a private letter about the quiet garden and the long storm that followed it through the night.`
      + ' It continues with more ordinary sentences so that the block is long enough to matter.').join('\n\n');
    await beginChapter(page, { text, wpm: 600, connectAI: true });
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
    await mockScoring(page, { status: 503 });
    await beginChapter(page, { connectAI: true });
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(3000);
    const state = await direction(page);
    expect(state.playing).toBe('playing');
    expect(state.admitted.filter(Boolean).every(item => item.endsWith(':local'))).toBe(true);
    await expect(page.locator('.toast, [role="alert"]').filter({ hasText: /Jev/i })).toHaveCount(0);
  });

  test('Escape closes the Lab over a reading and asks nothing else', async ({ page }) => {
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
    expect(await page.evaluate(() => `${window.__RISE_TEST__.getRouterState().currentView}/${window.__RISE_TEST__.getView('read')?.activePane}`))
      .toBe('read/chamber');
  });

  test('Chamber to Lab to reading: the scene is held, saved, and still saved after reload', async ({ page }) => {
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
    const held = await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber')._currentFlameConfig()?.recipe.name);
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
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.mouse.move(640, 700);
    await page.locator('#visual-direction-btn').click();
    await page.locator('[data-vd="workshop"]').click();
    await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'make'
      && window.__RISE_TEST__.getView('make').activeTab === 'workshop', null, { timeout: 20_000 });
    // The assignment list's own button, not the inline text mark (which the
    // sticky score header can cover when scrolled to the edge).
    await page.locator('#view-make [data-pane="workshop"] button.visual-score-clip-main[data-action="select-score-assignment"]').first().click();
    const picker = page.locator('#view-make [data-pane="workshop"] [data-visual-style-setting="flame-composition"]');
    await expect(picker).toBeVisible({ timeout: 10_000 });
    await picker.selectOption('solar-bloom');
    await page.locator('#view-make [data-pane="workshop"]').getByRole('button', { name: 'Run' }).click();
    await page.waitForFunction(() => window.__RISE_TEST__.getView('read')?.paneInstance('chamber')?._direction?.eligibility?.composite,
      null, { timeout: 30_000 });
    await expect.poll(() => page.evaluate(() =>
      window.__RISE_TEST__.getView('read').paneInstance('chamber')._currentFlameConfig()?.recipe.id), { timeout: 20_000 })
      .toBe('solar-bloom');
  });

  test('reduced motion shows a still flame with no animation loop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    const loop = await page.evaluate(() => {
      const field = window.__RISE_TEST__.getView('read').paneInstance('chamber').livingFlameField;
      return { reduced: field.reducedMotion, raf: field.raf };
    });
    expect(loop).toEqual({ reduced: true, raf: null });
  });

  test('repeated scene changes never accumulate flame layers', async ({ page }) => {
    await mockScoring(page);
    await beginChapter(page);
    await expect.poll(async () => (await direction(page)).flame, { timeout: 15_000 }).toBe(true);
    await page.evaluate(async () => {
      const chamber = window.__RISE_TEST__.getView('read')?.paneInstance('chamber');
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
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab .living-flame-canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const lit = await litFraction(page);
    expect(lit).toBeGreaterThan(0.005);
    const before = await page.evaluate(() => window.__RISE_TEST__.getView('make').tabInstance('visual-lab').currentRecipe.id);
    await page.setInputFiles('[name="vl-import"]', {
      name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"nope"}')
    });
    await expect(page.locator('#vl-status')).toHaveText(/unsupported Living Flame version.*unchanged/);
    expect(await page.evaluate(() => window.__RISE_TEST__.getView('make').tabInstance('visual-lab').currentRecipe.id)).toBe(before);
    await page.locator('[data-vl="mutate"]').click();
    await expect(page.locator('[data-vl="undo"]')).toBeEnabled();
    await page.locator('[data-vl="undo"]').click();
    expect(await page.evaluate(() => window.__RISE_TEST__.getView('make').tabInstance('visual-lab').currentRecipe.id)).toBe(before);
  });

  test.describe('at pixel ratio 2, where every quality step resizes the canvas', () => {
    test.use({ deviceScaleFactor: 2 });

    test('a quality step keeps the flame on screen', async ({ page }) => {
      await page.goto('/visual-lab');
      await page.waitForFunction(() => window.__RISE_TEST__.getView('make')?.tabInstance('visual-lab')?.field?.renderer === 'webgl2',
        null, { timeout: 20_000 });
      await page.waitForTimeout(1500);
      // Each sample is the canvas as it will be composited: taken after the
      // field's whole tick, including any quality step it applied.
      await page.evaluate(() => {
        const field = window.__RISE_TEST__.getView('make').tabInstance('visual-lab').field;
        const samples = window.__flameSamples = [];
        const scratch = document.createElement('canvas');
        scratch.width = 96;
        scratch.height = 60;
        const context = scratch.getContext('2d', { willReadFrequently: true });
        const tick = field._tick.bind(field);
        field._tick = now => {
          tick(now);
          context.clearRect(0, 0, 96, 60);
          context.drawImage(field.canvas, 0, 0, 96, 60);
          const { data } = context.getImageData(19, 12, 58, 36);
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          samples.push({ tier: field.tier, luminance: sum / (data.length / 4) });
        };
      });
      for (let step = 0; step < 3; step += 1) {
        const from = await page.evaluate(() => {
          const field = window.__RISE_TEST__.getView('make').tabInstance('visual-lab').field;
          const up = field.tier === 0;
          field.framesSinceChange = 31;
          field.intervals = Array(89).fill(up ? 10 : 40);
          field.lastQualityChange = -1e9;
          field.steadyWindows = up ? 2 : 0;
          if (up) field.ceiling = 3;
          return field.tier;
        });
        await page.waitForFunction(tier => window.__RISE_TEST__.getView('make').tabInstance('visual-lab').field.tier !== tier,
          from, { timeout: 10_000 });
        await page.waitForTimeout(800);
      }
      const { steps, worst } = await page.evaluate(() => {
        const samples = window.__flameSamples;
        let changes = 0;
        let lowest = Infinity;
        for (let i = 1; i < samples.length; i += 1) {
          if (samples[i].tier === samples[i - 1].tier) continue;
          changes += 1;
          for (let k = i; k < Math.min(samples.length, i + 15); k += 1) {
            lowest = Math.min(lowest, samples[k].luminance / Math.max(1e-6, samples[k - 1].luminance));
          }
        }
        return { steps: changes, worst: lowest };
      });
      expect(steps).toBeGreaterThanOrEqual(3);
      expect(worst).toBeGreaterThanOrEqual(0.8);
    });
  });

  test('falls back to a still when WebGL2 is unavailable', async ({ page }) => {
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
    await page.goto('/visual-lab');
    await expect(page.locator('.visual-lab .living-flame-canvas')).toBeVisible({ timeout: 20_000 });
    const recovered = await page.evaluate(async () => {
      const field = window.__RISE_TEST__.getView('make').tabInstance('visual-lab').field;
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
