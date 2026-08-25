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

const OLD_MASTERS_PREFS = {
  ...PREFS,
  visualInterlocution: {
    ...PREFS.visualInterlocution,
    interlocution: {
      ...PREFS.visualInterlocution.interlocution,
      sourceFamily: 'procedural',
      procedural: ['paradise-lost'],
      sourced: [],
      presentation: 'continuous',
      wordFill: {
        mode: 'pick',
        sourceFamily: 'sourced',
        procedural: [],
        sourced: ['aic-oldmasters']
      }
    }
  }
};

test.describe.configure({ timeout: 90_000 });

async function openPrep(page, viewport, prefs = PREFS) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ gate, seed, prefs }) => {
    const reloadPrefs = sessionStorage.getItem('__fitMaskReloadPrefs');
    if (reloadPrefs) {
      localStorage.setItem('rise_orbital_prefs_v1', reloadPrefs);
      sessionStorage.removeItem('__fitMaskReloadPrefs');
    }
    if (sessionStorage.getItem('__fitMaskSeeded') === 'true') return;
    sessionStorage.setItem('__fitMaskSeeded', 'true');
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(prefs));
  }, { gate: GATE, seed: SEED, prefs });
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

async function hardReloadPrep(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const beginButton = page.locator('#begin-btn');
  if (!await beginButton.isVisible()) {
    await page.locator('[data-nav="chamber"]').first().click();
  }
  await expect(beginButton).toBeEnabled({ timeout: 15_000 });
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
  const warning = page.locator('#photosensitivity-modal');
  const display = page.locator('#chamber-display');
  await Promise.race([
    warning.waitFor({ state: 'visible', timeout: 20_000 }),
    display.waitFor({ state: 'visible', timeout: 20_000 })
  ]);
  if (await warning.isVisible()) await warning.locator('#safety-accept').click();
  await expect(display).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
}

async function observeReadablePendingWords(page, minimumWords = 2) {
  return page.evaluate(minimum => new Promise((resolve, reject) => {
    let stage;
    let atom;
    const words = new Set();
    let observer;
    let mountObserver;
    let deadline;
    const finish = value => {
      observer?.disconnect();
      mountObserver?.disconnect();
      clearTimeout(deadline);
      resolve(value);
    };
    const fail = message => {
      observer?.disconnect();
      mountObserver?.disconnect();
      clearTimeout(deadline);
      reject(new Error(message));
    };
    const inspect = () => {
      const text = atom.textContent.trim();
      if (!text) return;
      const state = atom.dataset.maskState;
      const style = getComputedStyle(atom);
      const stageRect = stage.getBoundingClientRect();
      const atomRect = atom.getBoundingClientRect();
      const centreDrift = Math.abs(
        (atomRect.left + atomRect.width / 2) - (stageRect.left + stageRect.width / 2)
      );
      const overflow = Math.max(
        stageRect.left - atomRect.left,
        atomRect.right - stageRect.right,
        stageRect.top - atomRect.top,
        atomRect.bottom - stageRect.bottom,
        0
      );
      if (state !== 'fallback' && state !== 'preparing') {
        fail(`Mask became ${state || 'unset'} before readiness for ${text}`);
        return;
      }
      if (atom.classList.contains('is-mask-ink')
          || style.color === 'rgba(0, 0, 0, 0)'
          || style.webkitTextFillColor === 'rgba(0, 0, 0, 0)') {
        fail(`Atom became transparent before readiness for ${text}`);
        return;
      }
      if (centreDrift > 2 || overflow > 1) {
        fail(`Pending atom moved: centre=${centreDrift}, overflow=${overflow}`);
        return;
      }
      words.add(text);
      if (words.size >= minimum) finish({ words: words.size, centreDrift, overflow });
    };
    deadline = setTimeout(() => fail(`Only observed ${words.size} pending Words`), 15_000);
    const mount = () => {
      stage = document.querySelector('#chamber-display');
      atom = document.querySelector('#atom-display');
      if (!stage || !atom) return;
      mountObserver?.disconnect();
      observer = new MutationObserver(inspect);
      observer.observe(atom, {
        attributes: true,
        attributeFilter: ['class', 'data-mask-state', 'style'],
        childList: true,
        characterData: true,
        subtree: true
      });
      inspect();
    };
    mountObserver = new MutationObserver(mount);
    mountObserver.observe(document.documentElement, { childList: true, subtree: true });
    mount();
  }), minimumWords);
}

async function expectAtomicMaskReady(page) {
  const atom = page.locator('#atom-display');
  await expect(atom).toHaveAttribute('data-mask-state', 'ready', { timeout: 20_000 });
  await expect(atom).toHaveClass(/is-mask-ink/);
  await expect(atom).toHaveClass(/is-mask-ready/);
}

async function installFirstDataDecodeGate(page) {
  await page.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const nativeToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    const fractalUrls = new Set();
    let held = false;
    const armed = sessionStorage.getItem('__fitMaskDelayFirstDecode') === 'true';
    sessionStorage.removeItem('__fitMaskDelayFirstDecode');
    window.__fitMaskDecodeGate = {
      armed,
      pending: false,
      heldUrl: null,
      heldFromFractalCanvas: false,
      release: null
    };
    HTMLCanvasElement.prototype.toDataURL = function trackedToDataUrl(...args) {
      const url = nativeToDataUrl.apply(this, args);
      if (this.id === 'fractal-canvas') fractalUrls.add(url);
      return url;
    };
    HTMLImageElement.prototype.decode = function gatedDecode() {
      if (window.__fitMaskDecodeGate.armed && !held && fractalUrls.has(this.src)) {
        held = true;
        window.__fitMaskDecodeGate.pending = true;
        window.__fitMaskDecodeGate.heldUrl = this.src;
        window.__fitMaskDecodeGate.heldFromFractalCanvas = fractalUrls.has(this.src);
        return new Promise((resolve, reject) => {
          window.__fitMaskDecodeGate.release = () => {
            window.__fitMaskDecodeGate.release = null;
            Promise.resolve(nativeDecode.call(this)).then(resolve, reject);
          };
        });
      }
      return nativeDecode.call(this);
    };
  });
}

async function chooseMaskFit(page) {
  await chooseFit(page);
  await page.locator('.vnav-node[data-id="face"]').click();
  await page.locator('.vnav-opt[data-chamber-face="thick"]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('rise-settings') || '{}'
  ).chamberFace)).toBe('thick');
}

async function armFirstDataDecode(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('__fitMaskDelayFirstDecode', 'true');
  });
}

async function releaseFirstDataDecode(page) {
  await page.evaluate(() => window.__fitMaskDecodeGate?.release?.());
}

async function expectHeldFractalProjection(page) {
  expect(await page.evaluate(() => {
    const gate = window.__fitMaskDecodeGate;
    const projectionUrls = [...document.querySelectorAll(
      '.chamber-fill-field .continuous-field-artwork[src]'
    )].map(image => image.src);
    const roomUrls = [...document.querySelectorAll(
      '#chamber-continuous-field .continuous-field-artwork[src]'
    )].map(image => image.src);
    return {
      heldFromFractalCanvas: gate?.heldFromFractalCanvas,
      projectionOwnsHeldUrl: projectionUrls.includes(gate?.heldUrl),
      roomOwnsHeldUrl: roomUrls.includes(gate?.heldUrl)
    };
  })).toEqual({
    heldFromFractalCanvas: true,
    projectionOwnsHeldUrl: true,
    roomOwnsHeldUrl: false
  });
}

async function chooseOldMastersFit(page) {
  await chooseMaskFit(page);
  await page.evaluate(oldMasters => {
    const prefs = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}');
    prefs.visualInterlocution = {
      ...(prefs.visualInterlocution || {}),
      interlocution: {
        ...(prefs.visualInterlocution?.interlocution || {}),
        ...oldMasters.visualInterlocution.interlocution
      }
    };
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(prefs));
    sessionStorage.setItem('__fitMaskReloadPrefs', JSON.stringify(prefs));
  }, OLD_MASTERS_PREFS);
  await expect.poll(() => page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1') || '{}');
    const settings = JSON.parse(localStorage.getItem('rise-settings') || '{}');
    return {
      chunkMode: prefs.chunkMode,
      chamberFace: settings.chamberFace,
      fontSize: settings.fontSize,
      presentation: prefs.visualInterlocution?.interlocution?.presentation,
      procedural: prefs.visualInterlocution?.interlocution?.procedural,
      sourced: prefs.visualInterlocution?.interlocution?.sourced,
      wordFillMode: prefs.visualInterlocution?.interlocution?.wordFill?.mode,
      wordFillSourced: prefs.visualInterlocution?.interlocution?.wordFill?.sourced
    };
  })).toEqual({
    chunkMode: 'word',
    chamberFace: 'thick',
    fontSize: 'fit',
    presentation: 'continuous',
    procedural: ['paradise-lost'],
    sourced: [],
    wordFillMode: 'pick',
    wordFillSourced: ['aic-oldmasters']
  });
}

async function installOldMastersSourceGate(page) {
  let release;
  let pending = false;
  let released = false;
  let armed = false;
  let phase = 'idle';
  let capturedObjectUrl = null;
  let visualUrl = null;
  let digitalUrl = null;
  let imageUrl = null;
  let fullImageUrl = null;
  const requestedChain = [];
  const readiness = new Promise(resolve => { release = resolve; });
  const base = 'https://id.rijksmuseum.nl';
  const headers = {
    'access-control-allow-origin': '*',
    'content-type': 'application/json'
  };
  await page.route('https://openaccess-api.clevelandart.org/**', route => route.fulfill({
    status: 404,
    headers,
    body: JSON.stringify({ data: null })
  }));
  await page.route('https://api.artic.edu/api/v1/artworks/**', route => route.fulfill({
    status: 404,
    headers,
    body: JSON.stringify({ data: null })
  }));
  await page.route('https://id.rijksmuseum.nl/**', async route => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    const objectMatch = url.pathname.match(/^\/(\d+)$/);
    if (armed && capturedObjectUrl === null && objectMatch) {
      const objectId = objectMatch[1];
      capturedObjectUrl = requestUrl;
      visualUrl = `${base}/visual/${objectId}`;
      digitalUrl = `${base}/digital/${objectId}`;
      fullImageUrl = `https://iiif.micr.io/rise-fit-${objectId}/full/max/0/default.jpg`;
      imageUrl = fullImageUrl.replace('/full/max/', '/full/843,/');
      requestedChain.push(requestUrl);
      phase = 'object';
      pending = true;
      if (!released) await readiness;
      await route.fulfill({
        headers,
        body: JSON.stringify({
          id: capturedObjectUrl,
          identified_by: [
            { type: 'Name', content: 'Rembrandt study' },
            { type: 'Identifier', content: 'SK-A-1' }
          ],
          shows: [{ id: visualUrl }],
          produced_by: { carried_out_by: [{ _label: 'Rembrandt van Rijn' }] }
        })
      });
      return;
    }
    if (requestUrl === visualUrl) {
      requestedChain.push(requestUrl);
      phase = 'visual';
      await route.fulfill({
        headers,
        body: JSON.stringify({
          id: visualUrl,
          rights: 'https://creativecommons.org/publicdomain/mark/1.0/',
          digitally_shown_by: [{ id: digitalUrl }]
        })
      });
      return;
    }
    if (requestUrl === digitalUrl) {
      requestedChain.push(requestUrl);
      phase = 'digital';
      await route.fulfill({
        headers,
        body: JSON.stringify({
          id: digitalUrl,
          access_point: [{ id: fullImageUrl }]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, headers, body: '{}' });
  });
  await page.route('https://iiif.micr.io/**', route => {
    if (route.request().url() !== imageUrl) {
      return route.fulfill({ status: 404, body: '' });
    }
    requestedChain.push(route.request().url());
    phase = 'image';
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6kQAAAAASUVORK5CYII=',
        'base64'
      )
    });
  });
  return {
    arm: () => { armed = true; },
    isPending: () => pending,
    capturedObjectUrl: () => capturedObjectUrl,
    requestedChain: () => [...requestedChain],
    phase: () => phase,
    release: () => {
      released = true;
      release();
    }
  };
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
    await chooseMaskFit(page);
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

for (const [surface, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  test(`Fractal Flames atomic readiness keeps a readable ${surface} fallback across hard reload`, async ({ page }) => {
    await installFirstDataDecodeGate(page);
    await openPrep(page, viewport);
    await chooseMaskFit(page);
    await armFirstDataDecode(page);
    await hardReloadPrep(page);
    await begin(page);

    await expect.poll(() => page.evaluate(
      () => window.__fitMaskDecodeGate?.pending === true
    ), { timeout: 20_000 }).toBe(true);
    expect(await page.evaluate(
      () => window.__fitMaskDecodeGate?.heldFromFractalCanvas
    )).toBe(true);
    const pending = await observeReadablePendingWords(page);
    expect(pending.words).toBeGreaterThanOrEqual(2);
    expect(pending.centreDrift).toBeLessThanOrEqual(2);
    expect(pending.overflow).toBeLessThanOrEqual(1);

    await releaseFirstDataDecode(page);
    await expectAtomicMaskReady(page);
    await expectHeldFractalProjection(page);
  });
}

test('glyph local projection keeps the Fractal viewport inside the field and the word centred', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseMaskFit(page);
  await begin(page);
  await expectAtomicMaskReady(page);

  // Observe several Fit words (short and long) as the reading advances; each
  // ready mask must place a finite, glyph-local viewport inside the field and
  // no larger than it, with the word centred on the stage.
  const samples = await page.evaluate(async () => {
    const seen = [];
    const centre = rect => rect.left + rect.width / 2;
    const middle = rect => rect.top + rect.height / 2;
    for (let i = 0; i < 4; i += 1) {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 260)));
      const atom = document.querySelector('#atom-display');
      const field = document.querySelector('.chamber-fill-field');
      const viewport = document.querySelector('.chamber-fill-viewport');
      const stage = document.querySelector('#chamber-display');
      if (!atom || !field || !viewport || !stage) continue;
      if (atom.dataset.maskState !== 'ready') continue;
      const f = field.getBoundingClientRect();
      const v = viewport.getBoundingClientRect();
      const a = atom.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      seen.push({
        word: (atom.textContent || '').trim(),
        finite: v.width > 0 && v.height > 0 && Number.isFinite(v.width) && Number.isFinite(v.height),
        inside: v.left >= f.left - 1 && v.top >= f.top - 1
          && v.right <= f.right + 1 && v.bottom <= f.bottom + 1,
        // never larger than the stage — the scale cap
        withinField: v.width <= f.width + 1 && v.height <= f.height + 1,
        // glyph-local: the viewport is centred on the WORD, not the stage
        glyphDrift: Math.max(Math.abs(centre(v) - centre(a)), Math.abs(middle(v) - middle(a))),
        // and the word itself is centred on the stage
        centreDrift: Math.abs(centre(a) - centre(s))
      });
    }
    return seen;
  });

  const distinct = new Set(samples.map(sample => sample.word));
  expect(samples.length).toBeGreaterThanOrEqual(2);
  expect(distinct.size).toBeGreaterThanOrEqual(2);   // short and long words
  for (const sample of samples) {
    expect(sample.finite, sample.word).toBe(true);
    expect(sample.inside, sample.word).toBe(true);
    expect(sample.withinField, sample.word).toBe(true);
    expect(sample.glyphDrift, sample.word).toBeLessThanOrEqual(3);
    expect(sample.centreDrift, sample.word).toBeLessThanOrEqual(2);
  }
});

test('Fit mask and contour share one glyph geometry (mask shapes with the real font)', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseMaskFit(page);
  await begin(page);
  await expectAtomicMaskReady(page);

  // The mask carves the material into the letters; the visible contour is the
  // atom's own -webkit-text-stroke. They coincide only if the mask shapes with
  // the SAME font the atom renders (Space Grotesk 700). The regression this
  // guards is a font-ISOLATED mask (a serialized data: URL image cannot see
  // the page web font) that silently falls back and drifts across letters —
  // invisible to a centre/inside check, visible as a diverging outline. Same
  // font at the same size ⇒ the same advance width; a fallback diverges by
  // several percent.
  const geom = await page.evaluate(async () => {
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 260)));
      const atom = document.querySelector('#atom-display');
      const maskText = document.querySelector('.chamber-fit-mask-defs text');
      if (!atom || !maskText) continue;
      if (atom.dataset.maskState !== 'ready') continue;
      const word = (atom.textContent || '').trim();
      if (!word || /\s/.test(word)) continue;   // single-token Fit atoms only
      const range = document.createRange();
      range.selectNodeContents(atom);
      const atomWidth = range.getBoundingClientRect().width;   // real-font advance
      let maskWidth = 0;
      try { maskWidth = maskText.getComputedTextLength(); }
      catch { try { maskWidth = maskText.getBBox().width; } catch { maskWidth = 0; } }
      if (atomWidth > 4 && maskWidth > 4) {
        results.push({ word, atomWidth, maskWidth, ratio: maskWidth / atomWidth });
      }
    }
    return results;
  });

  expect(geom.length).toBeGreaterThanOrEqual(2);
  for (const g of geom) {
    expect(
      Math.abs(g.ratio - 1),
      `${g.word}: mask advance ${g.maskWidth.toFixed(1)} vs atom ${g.atomWidth.toFixed(1)}`
    ).toBeLessThan(0.02);
  }
});

test('Old Masters atomic readiness keeps a readable fallback until the first sourced response after hard reload', async ({ page }) => {
  const sourceGate = await installOldMastersSourceGate(page);
  await openPrep(page, { width: 1280, height: 800 });
  await chooseOldMastersFit(page);
  sourceGate.arm();
  await hardReloadPrep(page);
  const pendingWords = observeReadablePendingWords(page);
  const beginning = begin(page);

  await expect.poll(sourceGate.isPending, { timeout: 20_000 }).toBe(true);
  const capturedObjectUrl = sourceGate.capturedObjectUrl();
  expect(capturedObjectUrl).not.toBeNull();
  expect(capturedObjectUrl).toMatch(/^https:\/\/id\.rijksmuseum\.nl\/\d+$/);
  const pending = await pendingWords;
  expect(pending.words).toBeGreaterThanOrEqual(2);
  expect(pending.centreDrift).toBeLessThanOrEqual(2);
  expect(pending.overflow).toBeLessThanOrEqual(1);

  sourceGate.release();
  await expect.poll(sourceGate.phase, { timeout: 20_000 }).toBe('image');
  const objectId = new URL(capturedObjectUrl).pathname.slice(1);
  expect(sourceGate.requestedChain()).toEqual([
    capturedObjectUrl,
    `https://id.rijksmuseum.nl/visual/${objectId}`,
    `https://id.rijksmuseum.nl/digital/${objectId}`,
    `https://iiif.micr.io/rise-fit-${objectId}/full/843,/0/default.jpg`
  ]);
  await beginning;
  await expectAtomicMaskReady(page);
});

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
  // The refusal names the condition that is ACTUALLY missing. Fit is already
  // set and the field is a Gallery (Turrell), so the face is the only thing
  // standing in the way — and the Gallery must survive the remedy rather than
  // be cleared to satisfy it.
  await expect(dialog).toContainText('A mask needs the Thick face.');
  await expect(dialog.getByRole('button', { name: 'Set it' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Set it' }).click();
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

test('the Fit material covers the glyph, leaving no matte inside the word', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseMaskFit(page);
  await begin(page);
  await expectAtomicMaskReady(page);

  // A stencil is not a frame. The gallery fits the authored work with
  // `contain` so a portrait is never cropped to the screen; inside the
  // letters the opposite is required, or a portrait source (843x1260) in a
  // wide word draws a quarter of the glyph and the rest falls through to
  // the darkened blur backdrop as black bars. Measured at 0.239 of the word
  // before this was fixed.
  const material = await page.evaluate(() => {
    const viewport = document.querySelector('.chamber-fill-viewport');
    const art = [...(viewport?.querySelectorAll('.continuous-field-artwork') || [])]
      .filter(node => node.getAttribute('src'));
    const backdrops = [...(viewport?.querySelectorAll('.continuous-field-backdrop') || [])];
    return {
      artworks: art.length,
      everyArtworkCovers: art.length > 0 && art.every(n => getComputedStyle(n).objectFit === 'cover'),
      everyBackdropHidden: backdrops.every(n => n.hidden && !n.getAttribute('src'))
    };
  });

  expect(material.artworks).toBeGreaterThan(0);
  expect(material.everyArtworkCovers, 'the projection must cover the glyph').toBe(true);
  expect(material.everyBackdropHidden, 'a covering projection needs no matte filler').toBe(true);
});

test('a dressed Fit word is never undressed to be redressed', async ({ page }) => {
  await openPrep(page, { width: 1280, height: 800 });
  await chooseMaskFit(page);
  await begin(page);
  await expectAtomicMaskReady(page);

  // Every atom re-ran the mask, and every run began by reverting to the
  // opaque word and awaiting promises that were already settled — an await
  // plus the reveal's rAF guarantees a paint in between, so each word
  // flashed white for a frame. Measured at 144 strobes across 145 words:
  // a ~7.5Hz flash of the whole reading, which at that rate is a
  // photosensitivity fault and not a reveal.
  const observed = await page.evaluate(() => new Promise(resolve => {
    const atom = document.querySelector('#atom-display');
    const words = new Set();
    let strobes = 0;
    const observer = new MutationObserver(() => {
      const state = atom.dataset.maskState;
      const text = (atom.textContent || '').trim();
      if (text) words.add(text);
      if (state === 'fallback' || state === 'preparing') strobes += 1;
    });
    observer.observe(atom, {
      attributes: true, attributeFilter: ['data-mask-state', 'class'],
      childList: true, characterData: true, subtree: true
    });
    setTimeout(() => {
      observer.disconnect();
      resolve({ strobes, words: words.size, finalState: atom.dataset.maskState });
    }, 4000);
  }));

  expect(observed.words, 'the reading did not advance').toBeGreaterThanOrEqual(3);
  expect(observed.strobes, 'the mask dropped mid-reading').toBe(0);
  expect(observed.finalState).toBe('ready');
});
