import { test, expect } from '@playwright/test';

const GATE = {
  code: 'rise2025',
  name: 'Fit Mask',
  vault: null,
  timestamp: Date.now()
};

const SEED = {
  text: 'Light enters form and returns through measure. '.repeat(80).trim(),
  textSource: 'Fit Mask Seed',
  origin: null
};

const PREFS = {
  wpm: 360,
  chunkMode: 'phrase',
  recitation: { enabled: true },
  visualInterlocution: {
    visualMode: 'interlocution',
    livingText: { enabled: true, intensity: 0.8 },
    interlocution: {
      sourceFamily: 'procedural',
      procedural: ['turrell'],
      sourced: [],
      presentation: 'full-frame',
      streamGlass: false,
      wordFill: {
        mode: 'pick',
        sourceFamily: 'procedural',
        procedural: ['fractal'],
        sourced: []
      }
    }
  }
};

test.describe.configure({ timeout: 90_000 });

async function openPrep(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ gate, seed, prefs }) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(prefs));
  }, { gate: GATE, seed: SEED, prefs: PREFS });
  await page.goto('/');
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('[data-orbit="visual"]').click();
  await expect(page.locator('.vnav')).toBeVisible();
  const size = page.locator('.vnav-node[data-id="size"]');
  for (let depth = 0; depth < 4 && !(await size.isVisible()); depth += 1) {
    const back = page.locator('[data-action="navigator-back"]');
    await expect(back).toBeVisible();
    await back.click();
  }
  await size.click();
  await expect(page.locator('[data-font-size="fit"]')).toBeVisible();
}

async function chooseFit(page) {
  await page.locator('[data-font-size="fit"]').click();
  await expect.poll(() => page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}');
    const settings = JSON.parse(localStorage.getItem('rise-settings') || '{}');
    return {
      chunkMode: prefs.chunkMode,
      fontSize: settings.fontSize,
      visualMode: prefs.visualInterlocution?.visualMode,
      presentation: prefs.visualInterlocution?.interlocution?.presentation,
      procedural: prefs.visualInterlocution?.interlocution?.procedural,
      wordFill: prefs.visualInterlocution?.interlocution?.wordFill?.procedural
    };
  })).toEqual({
    chunkMode: 'word',
    fontSize: 'fit',
    visualMode: 'interlocution',
    presentation: 'continuous',
    procedural: ['turrell'],
    wordFill: ['fractal']
  });
}

async function begin(page) {
  const closeVisual = page.locator('#modal-visual [data-close="visual"]');
  if (await closeVisual.isVisible()) await closeVisual.click();
  await page.locator('#begin-btn').click();
  await expect(page.locator('#photosensitivity-modal')).toBeHidden();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
}

async function sampleFittedWords(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const stage = document.querySelector('#chamber-display');
    const atom = document.querySelector('#atom-display');
    if (!stage || !atom) {
      reject(new Error('Chamber stage is missing'));
      return;
    }
    const baseline = stage.getBoundingClientRect();
    let last = '';
    let samples = 0;
    let stageHeightDrift = 0;
    let maxAtomOverflow = 0;
    let maxCentreDrift = 0;
    const timer = setInterval(() => {
      const text = atom.textContent.trim();
      if (!text || text === last || !atom.classList.contains('is-word-fit')) return;
      last = text;
      samples += 1;
      const s = stage.getBoundingClientRect();
      const a = atom.getBoundingClientRect();
      stageHeightDrift = Math.max(stageHeightDrift, Math.abs(s.height - baseline.height));
      maxAtomOverflow = Math.max(maxAtomOverflow,
        s.left - a.left,
        a.right - s.right,
        s.top - a.top,
        a.bottom - s.bottom,
        0);
      maxCentreDrift = Math.max(maxCentreDrift,
        Math.abs((a.left + a.width / 2) - (s.left + s.width / 2)));
      if (samples >= 4) {
        clearInterval(timer);
        clearTimeout(deadline);
        resolve({
          samples,
          stageHeightDrift,
          maxAtomOverflow,
          maxCentreDrift,
          chunkMode: window.rise?.currentSession?.chunkMode,
          mask: atom.classList.contains('is-mask')
        });
      }
    }, 40);
    const deadline = setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`Only observed ${samples} fitted Word changes`));
    }, 15_000);
  }));
}

for (const [surface, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  test(`Fit keeps four changing Words inside a stable ${surface} stage`, async ({ page }) => {
    const fractalCacheMisses = [];
    page.on('console', (message) => {
      if (message.text().includes('[FractalFlame] Cache miss! Queue empty.')) {
        fractalCacheMisses.push(message.text());
      }
    });
    await openPrep(page, viewport);
    await chooseFit(page);
    await begin(page);

    const state = await sampleFittedWords(page);
    expect(state.chunkMode).toBe('word');
    expect(state.mask).toBe(true);
    expect(state.stageHeightDrift).toBeLessThanOrEqual(1);
    expect(state.maxAtomOverflow).toBeLessThanOrEqual(1);
    expect(state.maxCentreDrift).toBeLessThanOrEqual(2);
    expect(fractalCacheMisses).toEqual([]);
    await expect(page.locator('.chamber-mask-ground-plate[data-ground="light"]'))
      .toBeAttached({ timeout: 20_000 });

    if (surface === 'desktop') {
      await expect.poll(() => page.evaluate(() => {
        const canvas = document.querySelector('#fractal-canvas');
        const ctx = canvas?.getContext?.('2d');
        if (!ctx || !canvas.width || !canvas.height) return false;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = false;
        let occupied = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] === 0) transparent = true;
          else occupied = true;
          if (transparent && occupied) return true;
        }
        return false;
      }), { timeout: 30_000 }).toBe(true);
    }
  });
}

test('leaving Fit for Medium preserves the Turrell × Fractal Gallery but removes Word masking', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseFit(page);
  await page.locator('[data-font-size="m"]').click();

  await expect.poll(() => page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}');
    const settings = JSON.parse(localStorage.getItem('rise-settings') || '{}');
    return {
      fontSize: settings.fontSize,
      procedural: prefs.visualInterlocution?.interlocution?.procedural,
      wordFill: prefs.visualInterlocution?.interlocution?.wordFill?.procedural,
      presentation: prefs.visualInterlocution?.interlocution?.presentation
    };
  })).toEqual({
    fontSize: 'medium',
    procedural: ['turrell'],
    wordFill: ['fractal'],
    presentation: 'continuous'
  });

  await begin(page);
  await expect(page.locator('#chamber-continuous-field')).toBeAttached();
  await expect(page.locator('#atom-display')).not.toHaveClass(/is-word-fit/);
  await expect(page.locator('#atom-display')).not.toHaveClass(/is-mask/);
});

test('material controls explain locked masks, transact Thick + Fit, and preserve the selected border', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseFit(page);
  await page.locator('.vnav-node[data-id="ink"]').click();

  // Browsers dispatch pointer events to aria-disabled controls; Playwright
  // suppresses them unless forced. This choice must remain explanatory.
  await page.locator('[data-word-fill="same"]').click({ force: true });
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toContainText('Visual masks require Thick + Fit.');
  await expect(dialog.getByRole('button', { name: 'Use Thick + Fit' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use Thick + Fit' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-word-fill="same"]')).toHaveClass(/is-selected/);

  const accent = page.locator('[data-word-fill="accent"]');
  await accent.click();
  await expect(accent).toHaveClass(/is-selected/);
  await accent.click();
  await expect(accent).not.toHaveClass(/is-selected/);

  await page.locator('.vnav-node[data-id="face"]').click();
  const thick = page.locator('.vnav-opt[data-chamber-face="thick"]');
  await thick.focus();
  await page.keyboard.press('Enter');
  await expect(thick).toHaveClass(/is-selected/);
  await page.locator('.vnav-node[data-id="ink"]').click();
  await page.locator('[data-word-fill="same"]').click();
  await expect(page.locator('[data-word-fill-border="cream"]')).toHaveClass(/is-selected/);
  await page.locator('[data-word-fill-border="accent"]').click();
  await page.locator('[data-word-fill="procedural:fractal"]').click();
  await expect(page.locator('[data-word-fill-border="accent"]')).toHaveClass(/is-selected/);
  await expect(page.getByText('Neural Networks')).toHaveCount(0);
  await expect(page.getByText('Rock Garden')).toHaveCount(0);
  await expect(page.getByText('Spectral Plates')).toHaveCount(0);

  await page.locator('.vnav-node[data-id="size"]').click();
  await page.locator('[data-font-size="m"]').click();
  await expect(dialog).toContainText('This change cannot keep the current visual mask. Continue with Accent ink?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});
