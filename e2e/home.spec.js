import { test, expect, connectTestOpenRouter, revealChamberControls } from './fixtures.js';
import { openAskDialog } from './reader-connection.js';

/**
 * Home is a home with a window: today's poem's engine moves full-screen,
 * the slot names the poem and sets its opening's first line still, and
 * nothing streams. Begin opens it through the app's launchToday, as /today
 * does; Another reading rolls a vivid one in its place; Adjust opens the
 * reading showing in Reader Setup, today's at its exact poem. On a desk
 * Library, Make and Settings sit in the header; Ask joins the keys for a
 * connected reader. A reading left unfinished comes back to Home and leads
 * it: Continue is the one key, and today's poem waits on one line below. A
 * reading read to its end offers no Continue.
 */
async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('.home-title')).not.toBeEmpty({ timeout: 15_000 });
}

const reading = page => page.evaluate(() => {
  const portal = window.__RISE_TEST__.getView('home');
  const { decision, title, spoken } = portal.reading;
  return { decision, title, spoken, text: portal.opening?.text };
});

async function another(page) {
  const before = await page.locator('h1').textContent();
  await page.locator('[data-home="roll"]').click();
  await expect(page.locator('h1')).not.toHaveText(before, { timeout: 10_000 });
  await expect(page.locator('[data-home="adjust"]')).toBeVisible();
  return (await reading(page)).decision;
}

/** The epigraph, once the opening is here. */
async function epigraph(page) {
  const still = page.locator('.home-epigraph');
  await expect(still).not.toBeEmpty({ timeout: 15_000 });
  return still.textContent();
}

const view = page => page.evaluate(() => window.__RISE_TEST__.getRouterState().currentView);

/** Horizontal overflow of the page, in px; no state may cause any. */
const sideways = page => page.evaluate(() =>
  Math.max(document.documentElement.scrollWidth, document.querySelector('.portal').scrollWidth) - innerWidth);

const bottom = (page, selector) => page.evaluate(sel => document.querySelector(sel).getBoundingClientRect().bottom, selector);

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} the reading and Begin are on the first screen, and nothing scrolls sideways`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(page.locator('.home-label')).toHaveText('Today’s poem');
    await epigraph(page);
    for (const selector of ['[data-home="enter"]', '[data-home="roll"]', '[data-home="adjust"]', '.portal-legal-link']) {
      expect(await bottom(page, selector), selector).toBeLessThanOrEqual(viewport.height);
    }
    // One solid key, and no word moving.
    await expect(page.locator('.home .btn-primary')).toHaveText('Begin');
    await expect(page.locator('.reading-stream-current')).toHaveCount(0);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await another(page);
    expect(await bottom(page, '[data-home="enter"]')).toBeLessThanOrEqual(viewport.height);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await openAskDialog(page);
    await expect(page.locator('dialog.home-ask h2')).toHaveText('Asking needs your own AI.');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}

test('the window stands over the slot, then the keys, in one column; on a phone the key spans the width over a row of two', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHome(page);
  await epigraph(page);
  const boxes = () => page.evaluate(() => {
    const box = sel => document.querySelector(sel).getBoundingClientRect().toJSON();
    return { window: box('.home-window'), slot: box('.home-featured'), enter: box('[data-home="enter"]'), roll: box('[data-home="roll"]'), link: box('[data-home="adjust"]') };
  });
  let b = await boxes();
  expect(b.window.bottom).toBeLessThanOrEqual(b.slot.top + 1);
  expect(b.slot.bottom).toBeLessThanOrEqual(b.enter.top);
  // The keys on one line under the slot.
  expect(Math.abs(b.enter.top - b.roll.top)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  b = await boxes();
  expect(b.slot.bottom).toBeLessThanOrEqual(b.enter.top);
  expect(b.enter.width).toBeGreaterThan(390 - 2 * 16 - 2);
  expect(b.roll.top).toBeGreaterThanOrEqual(b.enter.bottom);
  expect(Math.abs(b.roll.top - b.link.top)).toBeLessThan(4);
});

test('the opening is real text for a screen reader, and focus runs the header rooms, the Menu, key, Another reading, Adjust', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHome(page);
  const { spoken, text } = await reading(page);
  await expect(page.locator('[role="status"] [data-home-status]')).toHaveText(spoken);
  await expect(page.locator('[data-home-opening]')).toHaveText(text);
  await expect(page.locator('.home-epigraph')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('body').focus();
  const order = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const { dataset, className } = document.activeElement;
      return dataset.home || dataset.nav || dataset.action || className;
    }));
  }
  expect(order).toEqual(['library', 'make', 'settings', 'portal-menu-toggle', 'enter', 'roll', 'adjust']);
  // Nothing a reader must read is under 12px, and every key is a 44px target.
  const sizes = await page.evaluate(() => ({
    text: Math.min(...[...document.querySelectorAll('.home-rooms *, .home-featured *, .home-actions *, .portal-footer *')]
      .filter(el => el.textContent.trim() && el.getClientRects().length)
      .map(el => parseFloat(getComputedStyle(el).fontSize))),
    targets: Math.min(...[...document.querySelectorAll('.home-room, .home-actions button:not([hidden]), .portal-legal-link')]
      .map(el => el.getBoundingClientRect().height))
  }));
  expect(sizes.text).toBeGreaterThanOrEqual(12);
  expect(sizes.targets).toBeGreaterThanOrEqual(44);
});

/** Every control a reader can reach outside the Menu sheet, the dialog and the legal links. */
const targets = page => page.evaluate(() => [...document.querySelectorAll('.portal button, .portal a[href]')]
  .filter(el => !el.closest('.portal-nav, dialog, .portal-legal'))
  .filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
  .length);

test('a desk offers seven targets and a phone four; one more each once the reader\'s own AI is connected', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHome(page);
  await expect(page.locator('.home-rooms')).toBeVisible();
  expect(await targets(page)).toBe(7);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.home-rooms')).toBeHidden();
  expect(await targets(page)).toBe(4);
  await connectTestOpenRouter(page);
  await expect(page.locator('.home-actions [data-home="ask-open"]')).toBeVisible();
  expect(await targets(page)).toBe(5);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await targets(page)).toBe(8);
  // Ask on Home opens the request itself, the Menu closed.
  await page.locator('.home-actions [data-home="ask-open"]').click();
  await expect(page.locator('#home-intent')).toBeVisible();
  await expect(page.locator('.portal-nav')).toBeHidden();
});

test('on a desk Library, Make and Settings are one press away in the header, the Menu closed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [selector, room, path] of [
    ['.home-rooms [data-nav="library"]', 'library', '/library'],
    ['.home-rooms [data-nav="make"]', 'make', '/make/workshop'],
    ['.home-rooms [data-action="settings"]', 'settings', '/settings']
  ]) {
    await openHome(page);
    await expect(page.locator('.portal-nav')).toBeHidden();
    await page.locator(selector).click();
    await expect.poll(() => view(page), { timeout: 15_000 }).toBe(room);
    expect(new URL(page.url()).pathname, selector).toBe(path);
  }
});

test('Begin plays today\'s exact poem; left unfinished, it leads Home as Continue, today\'s poem one line below', async ({ page }) => {
  await openHome(page);
  const { title, text } = await reading(page);
  await page.locator('[data-home="enter"]').click();
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'read'
    && window.__RISE_TEST__.getView('read')?.activePane === 'chamber'
    && !window.__RISE_TEST__.getRouterState().transitioning, null, { timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { name: s.name, text: [...s.sourceTexts.values()].join(' '), origin: s.origin?.view, visualMode: s.visualConfig?.visualMode ?? 'off' };
  });
  expect(session.origin).toBe('home');
  expect(session.visualMode).not.toBe('off');
  // The poem played is the one whose opening Home set still.
  const flat = value => value.replace(/\s+/gu, ' ').trim();
  expect(flat(session.text).startsWith(flat(text).slice(0, 60))).toBe(true);

  await page.keyboard.press('Escape');
  await page.locator('#exit-confirm-overlay').getByRole('button', { name: 'End reading' }).click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
  // Left unfinished, the reading leads: Continue is the one key, the slot
  // names the session with its whole length (no "left", no bar, no epigraph),
  // and today's poem is one line under the keys, which Begin opens.
  await expect(page.locator('.home-label')).toHaveText('Continue');
  await expect(page.locator('h1')).toHaveText(session.name);
  await expect(page.locator('.home-meta')).toHaveText(/^\d+ min$/u);
  await expect(page.locator('.home-epigraph')).toBeEmpty();
  await expect(page.locator('.home .btn-primary')).toHaveText('Continue');
  await expect(page.locator('.home .btn-primary')).toHaveAttribute('data-home', 'continue');
  await expect(page.locator('[data-home="adjust"]')).toBeHidden();
  await expect(page.locator('.home-line')).toContainText(`Today’s poem · ${title}`);
  await expect(page.locator('.home-line')).toHaveAttribute('data-home', 'enter');
  await expect(page.locator('.home-line')).toBeEnabled();
  // The same counts as with Begin: Continue in its place, the line for Adjust.
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await targets(page)).toBe(7);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await targets(page)).toBe(4);

  // Continue reopens the reading held.
  await page.locator('[data-home="continue"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => window.__RISE_TEST__.getCurrentSession().name)).toBe(session.name);
});

test('a reading read to its end offers no Continue; Begin leads again', async ({ page }) => {
  await openHome(page);
  // The shortest division at the fastest pace, so the reading ends within the test.
  await page.evaluate(async () => {
    const portal = window.__RISE_TEST__.getView('home');
    const tools = await portal.loadTools();
    const decision = tools.composeRoll({ look: 'signal', workId: 'lyrical-ballads', section: 'shortest' });
    decision.config.wpm = 500;
    portal.showDecision(tools, decision, { look: 'signal' });
  });
  await expect(page.locator('[data-home="adjust"]')).toBeVisible();
  await epigraph(page);
  const heading = await page.locator('h1').textContent();
  await page.locator('[data-home="enter"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  // Ten times faster still. The Player marks the reading complete at its last word.
  await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber').player.setSpeedFactor(0.1));
  await expect(page.locator('#chamber-post')).toBeVisible({ timeout: 90_000 });
  await page.locator('#post-return-chamber').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
  // Leaving a finished reading releases it: nothing to continue, so Begin leads the reading Home had.
  expect(await page.evaluate(() => window.__RISE_TEST__.getCurrentSession())).toBeNull();
  await expect(page.locator('h1')).toHaveText(heading);
  await expect(page.locator('.home-label')).toHaveText('By chance');
  await expect(page.locator('.home .btn-primary')).toHaveText('Begin');
  await expect(page.locator('.home .btn-primary')).toHaveAttribute('data-home', 'enter');
  await expect(page.locator('[data-home="continue"]')).toHaveCount(0);
  await expect(page.locator('.home-line')).toHaveCount(0);
  await expect(page.locator('[data-home="adjust"]')).toBeVisible();
});

test('Another reading rolls a vivid one, named by chance with its look; Begin plays it, and on return it leads as Continue', async ({ page }) => {
  await openHome(page);
  const decision = await another(page);
  expect(['signal', 'iris', 'revel']).toContain(decision.look);
  await expect(page.locator('.home-label')).toHaveText('By chance');
  await expect(page.locator('.home-meta')).toContainText(`${decision.look[0].toUpperCase()}${decision.look.slice(1)}`);
  await epigraph(page);
  await page.locator('[data-home="enter"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { wpm: s.wpm, face: s.presentation?.chamberFace, experience: s.origin?.experience };
  });
  expect(session).toEqual({ wpm: decision.config.wpm, face: decision.config.presentation.chamberFace, experience: 'jev' });

  await revealChamberControls(page);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
  // Left unfinished, the rolled reading leads as Continue, named by its session.
  await expect(page.locator('.home-label')).toHaveText('Continue');
  await expect(page.locator('.home .btn-primary')).toHaveAttribute('data-home', 'continue');
  await expect(page.locator('.home-line')).toBeVisible();
  // Another reading takes the slot for the visit: Begin leads it, Adjust is back, the line is gone.
  await another(page);
  await expect(page.locator('.home-label')).toHaveText('By chance');
  await expect(page.locator('.home .btn-primary')).toHaveAttribute('data-home', 'enter');
  await expect(page.locator('.home-line')).toHaveCount(0);
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

test('Adjust on today\'s poem opens Reader Setup at the day\'s exact poem, not the plan\'s first section', async ({ page }) => {
  await openHome(page);
  const exact = await page.evaluate(() => window.__RISE_TEST__.getView('home').reading.exact);
  expect(exact.entryId).toBeTruthy();
  await page.locator('[data-home="adjust"]').click();
  await expect.poll(() => view(page), { timeout: 20_000 }).toBe('read');
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__.getView('read')?.activePane)).toBe('setup');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  const continuation = await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('setup').config.continuation);
  expect(continuation.entryId).toBe(String(exact.entryId));
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
  await epigraph(page);
  await another(page);
  await epigraph(page);
  await expect(page.locator('[data-home="enter"]')).toBeEnabled();
  await expect(page.locator('.home-alert')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the epigraph holds still, and under reduced motion the engine swaps without a fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const first = await epigraph(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.home-epigraph')).toHaveText(first);
  expect(parseFloat(await page.locator('.reading-stage-layer').first().evaluate(el => getComputedStyle(el).transitionDuration))).toBeLessThan(0.01);
});

test('a reload starts on today\'s poem again', async ({ page }) => {
  await openHome(page);
  const { title } = await reading(page);
  await another(page);
  await page.reload();
  await expect(page.locator('h1')).toHaveText(title, { timeout: 15_000 });
  await expect(page.locator('.home-label')).toHaveText('Today’s poem');
});

test('the longest titles and plans stay on a small phone with the key on screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openHome(page);
  for (const [work, look, section] of [['lyrical-ballads', 'revel', 'shortest'], ['the-photo-that-knew-your-street', 'iris', 'longest'], ['spoon-river-anthology', 'signal', 'first']]) {
    await page.evaluate(async ([work, look, section]) => {
      const portal = window.__RISE_TEST__.getView('home');
      const tools = await portal.loadTools();
      const decision = tools.composeRoll({ look, workId: work, section });
      portal.showDecision(tools, decision, { look });
    }, [work, look, section]);
    await expect(page.locator('[data-home="adjust"]')).toBeVisible();
    await epigraph(page);
    expect(await sideways(page), work).toBeLessThanOrEqual(0);
    expect(await bottom(page, '[data-home="enter"]'), work).toBeLessThanOrEqual(640);
  }
});

test('on a desk a long name stays on one line, whole for a screen reader and as a tooltip', async ({ page }) => {
  await openHome(page);
  const keyTop = () => page.locator('[data-home="enter"]').evaluate(el => el.getBoundingClientRect().top);
  const before = await keyTop();
  const long = 'Animal Tranquillity and Decay, by William Wordsworth and Samuel Taylor Coleridge, a Sketch';
  await page.evaluate(long => {
    const portal = window.__RISE_TEST__.getView('home');
    portal.present({ ...portal.reading, title: long }, portal.opening);
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
 * With the text hidden: the contrast of each selector's text against the
 * brightest pixel behind its box, and the luminance at points.
 */
async function behind(page, selectors, points) {
  const boxes = await page.evaluate(selectors => {
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
  test(`at ${viewport.width}x${viewport.height}, over a white engine, every word keeps 4.5:1 and the engine shows through the window`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);
    await epigraph(page);
    await page.locator('.home-engine').evaluate(engine => {
      const white = document.createElement('div');
      white.style.cssText = 'position:absolute;inset:0;z-index:1;background:#fff';
      engine.append(white);
    });
    const pane = await page.locator('.home-window').boundingBox();
    const x = Math.round(viewport.width / 2);
    const { contrast, light } = await behind(page, [
      '.home-epigraph', '.home-label', '.home-title', '.home-meta', '.home-link', '[data-home="roll"]', '.portal-legal-link'
    ], [{ x, y: Math.round(pane.y + pane.height * 0.4) }, { x, y: Math.round(pane.y + pane.height * 0.6) }]);
    for (const [selector, value] of Object.entries(contrast)) expect(value, selector).toBeGreaterThanOrEqual(4.5);
    // In the window, above the slot, the engine shows at better than half its light.
    for (const value of light) expect(value).toBeGreaterThan(0.5);
  });
}
