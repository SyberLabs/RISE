import { test, expect } from './fixtures.js';
import { openAskDialog } from './reader-connection.js';

/**
 * Home is already reading: today's poem plays silently, full-screen, under
 * its own engine, named in the bar below. Read it with sound opens it through
 * the app's launchToday, as /today does; Another reading rolls a vivid one in its place,
 * which Adjust opens in Reader Setup. Leaving a reading comes back to Home
 * and the same reading.
 */
async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(', by ', { timeout: 15_000 });
}

const reading = page => page.evaluate(() => {
  const portal = window.__RISE_TEST__.getView('home');
  const { decision, heading } = portal.reading;
  return { decision, heading, text: portal.opening?.text };
});

async function another(page) {
  const before = await page.locator('h1').textContent();
  await page.locator('[data-home="roll"]').click();
  await expect(page.locator('h1')).not.toHaveText(before, { timeout: 10_000 });
  await expect(page.locator('[data-home="adjust"]')).toBeVisible();
  return (await reading(page)).decision;
}

/** The unit the stream is showing now, once it shows one. */
async function streaming(page) {
  const current = page.locator('.home-stream .reading-stream-current');
  await expect(current).not.toBeEmpty({ timeout: 15_000 });
  return current.textContent();
}

const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

/** Horizontal overflow of the page, in px; no state may cause any. */
const sideways = page => page.evaluate(() =>
  Math.max(document.documentElement.scrollWidth, document.querySelector('.portal').scrollWidth) - innerWidth);

const bottom = (page, selector) => page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().bottom, selector);

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} the reading and Read it with sound are on the first screen, and nothing scrolls sideways`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(page.locator('.home-label')).toHaveText('Today’s poem');
    await streaming(page);
    for (const selector of ['[data-home="enter"]', '[data-home="roll"]', '[data-home="library"]', '.portal-legal-link']) {
      expect(await bottom(page, selector), selector).toBeLessThanOrEqual(viewport.height);
    }
    // One solid key.
    await expect(page.locator('.home .btn-primary')).toHaveText('Read it with sound');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await another(page);
    expect(await bottom(page, '[data-home="enter"]')).toBeLessThanOrEqual(viewport.height);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await openAskDialog(page);
    await expect(page.locator('dialog.home-ask h2')).toHaveText('Asking needs your own AI.');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}

test('on a desk the bar sits under the stream; on a phone the key spans the width over a row of two', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHome(page);
  const boxes = () => page.evaluate(() => {
    const box = sel => document.querySelector(sel).getBoundingClientRect().toJSON();
    return { stage: box('.home-stage'), enter: box('[data-home="enter"]'), roll: box('[data-home="roll"]'), link: box('.home-link'), caption: box('.home-caption'), bar: box('.home-bar') };
  });
  let b = await boxes();
  expect(b.stage.bottom).toBeLessThanOrEqual(b.bar.top + 1);
  // Caption on the left, the keys on the right, on one line.
  expect(b.caption.right).toBeLessThan(b.enter.left);
  expect(Math.abs(b.enter.top - b.roll.top)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  b = await boxes();
  expect(b.caption.bottom).toBeLessThanOrEqual(b.enter.top);
  expect(b.enter.width).toBeGreaterThan(390 - 2 * 16 - 2);
  expect(b.roll.top).toBeGreaterThanOrEqual(b.enter.bottom);
  expect(Math.abs(b.roll.top - b.link.top)).toBeLessThan(4);
});

test('the opening is real text for a screen reader, and focus runs header, key, Another reading, link', async ({ page }) => {
  await openHome(page);
  const { heading, text } = await reading(page);
  await expect(page.locator('[role="status"] [data-home-status]')).toHaveText(`Today’s poem: ${heading}`);
  await expect(page.locator('[data-home-opening]')).toHaveText(text);
  await expect(page.locator('.home-stream')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('body').focus();
  const order = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => document.activeElement.dataset.home || document.activeElement.className));
  }
  expect(order).toEqual(['portal-menu-toggle', 'enter', 'roll', 'library']);
  // Nothing a reader must read is under 12px, and every key is a 44px target.
  const sizes = await page.evaluate(() => ({
    text: Math.min(...[...document.querySelectorAll('.home-bar *, .portal-footer *')]
      .filter(el => el.textContent.trim() && el.getClientRects().length)
      .map(el => parseFloat(getComputedStyle(el).fontSize))),
    targets: Math.min(...[...document.querySelectorAll('.home-actions button, .portal-legal-link')]
      .map(el => el.getBoundingClientRect().height))
  }));
  expect(sizes.text).toBeGreaterThanOrEqual(12);
  expect(sizes.targets).toBeGreaterThanOrEqual(44);
});

test('Read it with sound plays today\'s exact poem, and leaving it returns to Home on the same poem', async ({ page }) => {
  await openHome(page);
  const { heading, text } = await reading(page);
  await page.locator('[data-home="enter"]').click();
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'read'
    && window.__RISE_TEST__.getView('read')?.activePane === 'chamber'
    && !window.__RISE_TEST__.getRouterState().transitioning, null, { timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { text: [...s.sourceTexts.values()].join(' '), origin: s.origin?.view, visualMode: s.visualConfig?.visualMode ?? 'off' };
  });
  expect(session.origin).toBe('home');
  expect(session.visualMode).not.toBe('off');
  // The poem played is the one whose opening Home was streaming.
  const flat = value => value.replace(/\s+/gu, ' ').trim();
  expect(flat(session.text).startsWith(flat(text).slice(0, 60))).toBe(true);

  await page.keyboard.press('Escape');
  await page.locator('#exit-confirm-overlay').getByRole('button', { name: 'End reading' }).click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
  await expect(page.locator('h1')).toHaveText(heading);
  await expect(page.locator('[data-home="enter"]')).toBeEnabled();
  await streaming(page);
});

test('Another reading rolls a vivid one with its plan in the caption; Read it with sound plays it, and Home holds it on return', async ({ page }) => {
  await openHome(page);
  const decision = await another(page);
  expect(['signal', 'ember', 'revel']).toContain(decision.temper);
  await expect(page.locator('.home-label')).toHaveText(new RegExp(`^${decision.temper[0].toUpperCase()}${decision.temper.slice(1)}: `, 'u'));
  await expect(page.locator('[data-home="library"]')).toHaveCount(0);
  await streaming(page);
  const heading = await page.locator('h1').textContent();
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
  await expect(page.locator('h1')).toHaveText(heading);
});

test('Adjust opens Reader Setup with the rolled reading set, and Begin plays it as rolled', async ({ page }) => {
  await openHome(page);
  const decision = await another(page);
  await page.locator('[data-home="adjust"]').click();
  await expect.poll(() => view(page), { timeout: 20_000 }).toBe('read');
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__.getView('read')?.activePane)).toBe('setup');
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
});

test('Home still reads on ink on a device with no WebGL', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /^webgl/u.test(kind) ? null : getContext.call(this, kind, ...rest);
    };
  });
  await openHome(page);
  await streaming(page);
  await another(page);
  await streaming(page);
  await expect(page.locator('[data-home="enter"]')).toBeEnabled();
  await expect(page.locator('.home-alert')).toBeHidden();
  expect(errors).toEqual([]);
});

test('under reduced motion the opening holds still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const first = await streaming(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.home-stream .reading-stream-current')).toHaveText(first);
  // The engine swaps without a fade.
  expect(parseFloat(await page.locator('.reading-stage-layer').first().evaluate(el => getComputedStyle(el).transitionDuration))).toBeLessThan(0.01);
});

test('a reload starts on today\'s poem again', async ({ page }) => {
  await openHome(page);
  const { heading } = await reading(page);
  await another(page);
  await page.reload();
  await expect(page.locator('h1')).toHaveText(heading, { timeout: 15_000 });
  await expect(page.locator('.home-label')).toHaveText('Today’s poem');
});

test('the longest titles and plans stay on a small phone with the key on screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openHome(page);
  for (const [work, temper, section] of [['lyrical-ballads', 'revel', 'shortest'], ['the-photo-that-knew-your-street', 'ember', 'longest'], ['spoon-river-anthology', 'signal', 'first']]) {
    await page.evaluate(async ([work, temper, section]) => {
      const portal = window.__RISE_TEST__.getView('home');
      const tools = await portal.loadTools();
      const decision = tools.composeRoll({ temper: tools.TEMPERS.find(t => t.id === temper), workId: work, section });
      portal.showDecision(tools, decision, { temper });
    }, [work, temper, section]);
    await expect(page.locator('[data-home="adjust"]')).toBeVisible();
    expect(await sideways(page), work).toBeLessThanOrEqual(0);
    expect(await bottom(page, '[data-home="enter"]'), work).toBeLessThanOrEqual(640);
  }
});

test('each unit of the stream arrives settled: at full strength, moving in for at most 160ms', async ({ page }) => {
  await openHome(page);
  await streaming(page);
  const entrance = await page.locator('.home-stream .reading-stream-current').evaluate(el => {
    const { animationName, animationDuration } = getComputedStyle(el);
    const keyframes = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
      .find(rule => rule instanceof CSSKeyframesRule && rule.name === animationName);
    return { ms: parseFloat(animationDuration) * 1000, from: Number(keyframes.findRule('from').style.opacity || 1) };
  });
  expect(entrance.ms).toBeLessThanOrEqual(160);
  expect(entrance.from).toBe(1);
});

test('on a desk a long name stays on one line, whole for a screen reader and as a tooltip', async ({ page }) => {
  await openHome(page);
  const keyTop = () => page.locator('[data-home="enter"]').evaluate(el => el.getBoundingClientRect().top);
  const before = await keyTop();
  const long = 'Animal Tranquillity and Decay, by William Wordsworth and Samuel Taylor Coleridge, a Sketch';
  await page.evaluate(long => {
    const portal = window.__RISE_TEST__.getView('home');
    portal.present({ ...portal.reading, heading: long }, portal.opening);
  }, long);
  const title = page.locator('h1');
  await expect(title).toHaveText(long);
  await expect(title).toHaveAttribute('title', long);
  const lineHeight = await title.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  expect((await title.boundingBox()).height).toBeLessThan(lineHeight * 1.5);
  expect(await keyTop()).toBe(before);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
});

/**
 * With the text hidden and the stream held: the contrast of each selector's
 * text against the brightest pixel behind its box, and the luminance at points.
 */
async function behind(page, selectors, points) {
  const boxes = await page.evaluate(selectors => {
    window.__RISE_TEST__.getView('home').stream.stop();
    const style = document.createElement('style');
    style.id = 'hide-text';
    style.textContent = `${selectors.join(', ')} { color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; transition: none !important; animation: none !important; }`;
    const boxes = selectors.map(selector => {
      const el = document.querySelector(selector);
      const { x, y, width, height } = el.getBoundingClientRect();
      return { selector, x, y, width, height, color: getComputedStyle(el).color };
    });
    document.head.append(style);
    return boxes;
  }, selectors);
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async ({ png, boxes, points }) => {
    document.getElementById('hide-text').remove();
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const ctx = new OffscreenCanvas(image.width, image.height).getContext('2d');
    ctx.drawImage(image, 0, 0);
    const channel = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const luminance = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const brightest = ({ x, y, width, height }) => {
      const data = ctx.getImageData(Math.floor(x), Math.floor(y), Math.ceil(width), Math.ceil(height)).data;
      let max = 0;
      for (let i = 0; i < data.length; i += 4) max = Math.max(max, luminance(data[i], data[i + 1], data[i + 2]));
      return max;
    };
    const ratio = box => (luminance(...box.color.match(/[\d.]+/gu).map(Number)) + 0.05) / (brightest(box) + 0.05);
    return {
      contrast: Object.fromEntries(boxes.map(box => [box.selector, Math.round(ratio(box) * 100) / 100])),
      light: points.map(({ x, y }) => luminance(...ctx.getImageData(x, y, 1, 1).data))
    };
  }, { png, boxes, points });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height}, over a white engine, every word keeps 4.5:1 and the engine shows around the stream`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await page.locator('.home-engine').evaluate(engine => {
      const white = document.createElement('div');
      white.style.cssText = 'position:absolute;inset:0;z-index:1;background:#fff';
      engine.append(white);
    });
    // A unit with one before it, so both lines of the stream are measured.
    await expect(page.locator('.home-stream .reading-stream-previous')).not.toBeEmpty({ timeout: 15_000 });
    const stream = await page.locator('.home-stream').boundingBox();
    const x = Math.round(viewport.width / 2);
    const { contrast, light } = await behind(page, [
      '.home-stream .reading-stream-current', '.home-stream .reading-stream-previous',
      '.home-label', '.home-title', '.home-link', '[data-home="roll"]', '.portal-legal-link'
    ], [{ x, y: Math.round(stream.y - 120) }, { x, y: Math.round(stream.y + stream.height + 120) }]);
    for (const [selector, value] of Object.entries(contrast)) expect(value, selector).toBeGreaterThanOrEqual(4.5);
    // Above and below the stream, the engine shows at better than half its light.
    for (const value of light) expect(value).toBeGreaterThan(0.5);
  });
}
