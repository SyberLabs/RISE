import { test, expect, revealChamberControls } from './fixtures.js';

/**
 * The wormhole is a second skin over the same roll: a page of its own,
 * reached from Home's Menu, that composes a reading on the device and hands
 * it back to the app to play (DOCK) or to change (ADJUST COURSE).
 */

async function authorize(page) {
}

async function openWormhole(page) {
  await authorize(page);
  await page.goto('/wormhole.html');
  await expect(page.locator('#jump')).toBeVisible({ timeout: 15_000 });
}

async function jump(page) {
  await page.locator('#jump').click();
  await expect(page.locator('#destination')).toBeVisible({ timeout: 10_000 });
}

// A page in the middle of navigating has no test bridge yet; that is "not there yet", not a failure.
// Read's panes are named as `read/setup`, `read/chamber`.
const view = page => page.evaluate(() => {
  const currentView = window.__RISE_TEST__?.getRouterState().currentView;
  return currentView === 'read' ? `read/${window.__RISE_TEST__.getView('read')?.activePane}` : currentView;
}).catch(() => null);

test('Home reaches the wormhole from its Menu, and the page brings the reader back', async ({ page }) => {
  await authorize(page);
  await page.goto('/');
  await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('.portal-menu-toggle').click();
  await page.locator('.portal-nav a[href="/wormhole.html"]').click();
  await expect(page).toHaveURL(/\/wormhole\.html$/u);
  await expect(page.locator('#jump')).toBeVisible();
  await page.locator('.wh-brand').click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
});

test('DOCK plays the destination, and leaving the reading returns to Home', async ({ page }) => {
  await openWormhole(page);
  await jump(page);
  const title = await page.locator('#title').textContent();
  await expect(page.locator('#plan li')).toHaveCount(4);
  await page.locator('#dock').click();

  await expect(page).toHaveURL(/\/$/u, { timeout: 30_000 });
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  const session = await page.evaluate(() => {
    const s = window.__RISE_TEST__.getCurrentSession();
    return { name: s.name, experience: s.origin?.experience, adjusted: s.origin?.adjusted ?? false };
  });
  expect(session.name.startsWith(title)).toBe(true);
  expect(session).toMatchObject({ experience: 'jev', adjusted: false });
  // The handoff is one-use and carries no reading in the address.
  expect(page.url()).not.toContain('invocation');
  expect(await page.evaluate(() => sessionStorage.getItem('rise:invocation-handoff:v1'))).toBeNull();

  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await revealChamberControls(page);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('home');
});

test('ADJUST COURSE opens Reader Setup with the destination set, and leaving a reading from there returns to it', async ({ page }) => {
  await openWormhole(page);
  await jump(page);
  await page.locator('#adjust').click();

  await expect.poll(() => view(page), { timeout: 30_000 }).toBe('read/setup');
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
  const setup = await page.evaluate(() => {
    const c = window.__RISE_TEST__.getView('read').paneInstance('setup').config;
    return { presentation: !!c.presentation?.chamberFace, adjusted: c.origin?.adjusted, hasText: !!c.text };
  });
  expect(setup).toEqual({ presentation: true, adjusted: true, hasText: true });

  await page.locator('#begin-btn').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
  await revealChamberControls(page);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => view(page), { timeout: 15_000 }).toBe('read/setup');
});

test('JUMP AGAIN always changes the destination', async ({ page }) => {
  await openWormhole(page);
  await jump(page);
  const seen = [await page.locator('#title').textContent()];
  for (let i = 0; i < 4; i += 1) {
    await page.locator('#again').click();
    await expect(page.locator('#title')).not.toHaveText(seen.at(-1), { timeout: 10_000 });
    seen.push(await page.locator('#title').textContent());
  }
  expect(seen.slice(1).every((title, i) => title !== seen[i])).toBe(true);
});

test('it works from the keyboard alone, and focus is never lost', async ({ page }) => {
  await openWormhole(page);
  await page.locator('#jump').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Tab');
  await expect(page.locator('#again')).toBeFocused();
  await page.keyboard.press('Enter');
  // Busy, the control keeps focus rather than dropping it to the page.
  await expect(page.locator('#again')).toBeFocused();
  await expect(page.locator('#dock')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('#adjust')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#sound')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sound')).toHaveText('SOUND');
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test.describe(`accessibility at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 });

    test('one heading level, real landmarks, and a picture that says nothing twice', async ({ page }) => {
      await openWormhole(page);
      for (const state of ['waiting', 'arrived']) {
        if (state === 'arrived') await jump(page);
        const outline = await page.evaluate(() => ({
          h1: document.querySelectorAll('h1').length,
          main: document.querySelectorAll('main').length,
          bannerInMain: !!document.querySelector('main header, main footer'),
          header: !!document.querySelector('body > .wormhole > header'),
          footer: !!document.querySelector('body > .wormhole > footer'),
          consoleHidden: document.querySelector('.wh-console').getAttribute('aria-hidden'),
          visibleHeadings: [...document.querySelectorAll('h2')].filter(h => h.getClientRects().length).length,
          lang: document.documentElement.lang
        }));
        expect(outline, state).toEqual({
          h1: 1, main: 1, bannerInMain: false, header: true, footer: true, consoleHidden: 'true', visibleHeadings: 1, lang: 'en'
        });
      }
    });

    test('every control is at least 44px, and nothing meant to be read is under 12px', async ({ page }) => {
      await openWormhole(page);
      await jump(page);
      const found = await page.evaluate(() => {
        const small = [];
        for (const el of document.querySelectorAll('button, a[href]')) {
          if (!el.getClientRects().length) continue;
          const box = el.getBoundingClientRect();
          if (box.height < 44 || box.width < 44) small.push(`${el.id || el.className}: ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
        const tiny = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (!node.textContent.trim() || !parent.getClientRects().length || parent.closest('[aria-hidden="true"], .sr-only, script, style')) continue;
          const size = parseFloat(getComputedStyle(parent).fontSize);
          if (size < 12) tiny.push(`${node.textContent.trim().slice(0, 30)}: ${size}px`);
        }
        return { small, tiny };
      });
      expect(found.small, 'controls under 44px').toEqual([]);
      expect(found.tiny, 'text under 12px').toEqual([]);
    });

    test('the primary key is on the first screen, and nothing runs off the side', async ({ page }) => {
      await openWormhole(page);
      const fit = await page.evaluate(() => ({
        bottom: document.querySelector('#jump').getBoundingClientRect().bottom,
        height: innerHeight,
        sideways: document.documentElement.scrollWidth - innerWidth
      }));
      expect(fit.bottom).toBeLessThanOrEqual(fit.height);
      expect(fit.sideways).toBeLessThanOrEqual(0);
      await jump(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('text keeps AA contrast on the lightest ground it can sit on', async ({ page }) => {
      await openWormhole(page);
      await jump(page);
      const failures = await page.evaluate(() => {
        const rgb = colour => {
          const ctx = document.createElement('canvas').getContext('2d');
          ctx.fillStyle = colour;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        // The page ground is a radial gradient; #1d3040 is its lightest stop.
        const ground = rgb('#1d3040');
        const out = [];
        for (const selector of ['.wh-brand', '.wh-eyebrow', '.wh-destination h2', '#meta', '.wh-plan li', '.wh-status', '.wh-secondary', '.wh-link', '.wh-footer', '.wh-sound']) {
          const el = document.querySelector(selector);
          if (!el || !el.getClientRects().length) continue;
          const value = ratio(rgb(getComputedStyle(el).color), ground);
          if (value < 4.5) out.push(`${selector} ${value.toFixed(2)}:1`);
        }
        return out;
      });
      expect(failures).toEqual([]);
    });
  });
}

test('reduced motion: nothing moves, nothing flickers, and the destination arrives at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWormhole(page);
  const running = () => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  expect(await running()).toBe(0);
  const started = Date.now();
  await jump(page);
  expect(Date.now() - started).toBeLessThan(1500);
  expect(await running()).toBe(0);
});

test('a jump under full motion still takes the crossing, then arrives with its plan', async ({ page }) => {
  await openWormhole(page);
  const started = Date.now();
  await page.locator('#jump').click();
  await expect(page.locator('#status')).toHaveText('Crossing…');
  await expect(page.locator('#destination')).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(800);
  await expect(page.locator('#status')).toContainText('Destination found');
  await expect(page.locator('.wormhole')).toHaveClass(/has-destination/u);
});

test('the Menu link is reachable at its own pixel, on a desk and a phone', async ({ page }) => {
  await authorize(page);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('.portal-menu-toggle').click();
    await expect(page.locator('.portal-nav')).toBeVisible();
    await page.waitForTimeout(400);
    const reach = await page.evaluate(() => {
      const link = document.querySelector('.portal-nav a[href="/wormhole.html"]');
      const box = link.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { reachable: top === link || link.contains(top), inView: box.bottom <= innerHeight, height: Math.round(box.height) };
    });
    expect(reach, `${viewport.width}px`).toMatchObject({ reachable: true, inView: true });
    expect(reach.height).toBeGreaterThanOrEqual(44);
  }
});

// ─── The picture: in depth where WebGL2 allows, flat where it does not ───

const viewportShot = page => page.locator('.wh-viewport').screenshot();

/** A browser with no WebGL2 is not a failure (the flat picture is tested below); it just cannot show the deep one. */
async function needsWebGL(page) {
  const available = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  test.skip(!available, 'this browser has no WebGL2');
}

test('the deep scene draws, and moves under full motion', async ({ page }) => {
  await openWormhole(page);
  await needsWebGL(page);
  await expect(page.locator('.wormhole')).toHaveClass(/has-gl/u);
  await expect(page.locator('#scene')).toBeVisible();
  const first = await viewportShot(page);
  // A blank or uniform frame compresses to almost nothing; a lit scene does not.
  expect(first.length, 'the viewport is not blank').toBeGreaterThan(20_000);
  await page.waitForTimeout(500);
  const later = await viewportShot(page);
  expect(later.equals(first), 'the scene is moving').toBe(false);
  // The flat picture's layers stand down while the deep one is on.
  for (const hidden of ['#starfield', '.wh-gate', '.wh-ship']) await expect(page.locator(hidden)).toBeHidden();
});

test('under reduced motion the deep scene is a still frame, and still shows the arrival', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWormhole(page);
  await needsWebGL(page);
  await expect(page.locator('.wormhole')).toHaveClass(/has-gl/u);
  const first = await viewportShot(page);
  await page.waitForTimeout(700);
  expect((await viewportShot(page)).equals(first), 'nothing moves').toBe(true);
  await jump(page);
  await page.waitForTimeout(300);
  const arrived = await viewportShot(page);
  expect(arrived.equals(first), 'the arrival is shown').toBe(false);
  await page.waitForTimeout(700);
  expect((await viewportShot(page)).equals(arrived), 'and then it holds still').toBe(true);
});

test('without WebGL2 the flat picture stands in, and the controls work as ever', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
      return type === 'webgl2' ? null : original.call(this, type, ...rest);
    };
  });
  await openWormhole(page);
  await expect(page.locator('.wormhole')).not.toHaveClass(/has-gl/u);
  await expect(page.locator('#scene')).toBeHidden();
  await expect(page.locator('#starfield')).toBeVisible();
  await expect(page.locator('.wh-ship')).toBeVisible();
  await jump(page);
  await expect(page.locator('#dock')).toBeFocused();
});

test('if the GPU drops its context, the flat picture takes over without a reload', async ({ page }) => {
  await openWormhole(page);
  await needsWebGL(page);
  await expect(page.locator('.wormhole')).toHaveClass(/has-gl/u);
  const lost = await page.evaluate(() => {
    const extension = document.querySelector('#scene').getContext('webgl2')?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(extension);
  });
  test.skip(!lost, 'this browser cannot simulate a lost context');
  await expect(page.locator('.wormhole')).not.toHaveClass(/has-gl/u, { timeout: 5000 });
  await expect(page.locator('#starfield')).toBeVisible();
  await jump(page);
});

test('the console stays a picture: nothing in it is reachable by keyboard or assistive technology', async ({ page }) => {
  await openWormhole(page);
  const inside = await page.evaluate(() => {
    const consoleBox = document.querySelector('.wh-console');
    return {
      hidden: consoleBox.getAttribute('aria-hidden'),
      focusable: consoleBox.querySelectorAll('a, button, input, select, textarea, [tabindex]').length
    };
  });
  expect(inside).toEqual({ hidden: 'true', focusable: 0 });
});

// ─── The ship rides a ring round the gate, and follows the pointer along it ───

/** The gate's centre, in page coordinates, and a ring radius that is clearly outside it. */
async function gate(page) {
  const box = await page.locator('.wh-viewport').boundingBox();
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.42, radius: Math.min(box.width, box.height) * 0.36 };
}
const shipAngle = page => page.evaluate(() => Number(document.querySelector('.wormhole').dataset.shipAngle));
/** The shorter way round from one angle to another. */
const arcBetween = (from, to) => { let d = (to - from) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d <= -Math.PI) d += 2 * Math.PI; return d; };

test('the ship waits at the bottom of the ring, and follows the pointer round the gate', async ({ page }) => {
  await openWormhole(page);
  await needsWebGL(page);
  await expect.poll(() => shipAngle(page)).toBeCloseTo(-Math.PI / 2, 1);
  const { x, y, radius } = await gate(page);
  for (const [name, dx, dy, expected] of [['right', 1, 0, 0], ['top', 0, -1, Math.PI / 2], ['left', -1, 0, Math.PI], ['bottom', 0, 1, -Math.PI / 2]]) {
    await page.mouse.move(x + dx * radius, y + dy * radius, { steps: 6 });
    await expect.poll(async () => Math.abs(arcBetween(await shipAngle(page), expected)), { message: name, timeout: 4000 }).toBeLessThan(0.08);
  }
});

test('the ship never jumps: sweeping the pointer clean round the gate, its angle changes a little every frame', async ({ page }) => {
  await openWormhole(page);
  await needsWebGL(page);
  const { x, y, radius } = await gate(page);
  // Sample the ship's angle every frame while the pointer makes a fast, full circuit, twice over the far side.
  await page.evaluate(() => {
    const root = document.querySelector('.wormhole');
    window.__samples = [];
    const tick = () => { window.__samples.push(Number(root.dataset.shipAngle)); window.__watch = requestAnimationFrame(tick); };
    tick();
  });
  for (let lap = 0; lap < 2; lap += 1) {
    for (let step = 0; step <= 40; step += 1) {
      const angle = (step / 40) * Math.PI * 2 + lap * 0.3;
      await page.mouse.move(x + Math.cos(angle) * radius, y - Math.sin(angle) * radius);
      await page.waitForTimeout(16);
    }
  }
  const samples = await page.evaluate(() => { cancelAnimationFrame(window.__watch); return window.__samples; });
  expect(samples.length, 'frames sampled').toBeGreaterThan(30);
  // A frame is at most a little over a sixtieth of a second on a busy machine; be generous, and still far below a jump.
  const worst = Math.max(...samples.slice(1).map((v, i) => Math.abs(arcBetween(samples[i], v))));
  expect(worst, 'the largest change of angle in one frame').toBeLessThan(0.45);
  // It really did travel round: it was not merely still.
  const travelled = samples.slice(1).reduce((sum, v, i) => sum + Math.abs(arcBetween(samples[i], v)), 0);
  expect(travelled).toBeGreaterThan(Math.PI);
});

test('pointing at the gate itself does not send the ship anywhere', async ({ page }) => {
  await openWormhole(page);
  await needsWebGL(page);
  const { x, y, radius } = await gate(page);
  await page.mouse.move(x, y - radius, { steps: 4 });
  await expect.poll(async () => Math.abs(arcBetween(await shipAngle(page), Math.PI / 2))).toBeLessThan(0.08);
  const held = await shipAngle(page);
  // Crossing the gate's own centre has no bearing, so the ship keeps its last one.
  await page.mouse.move(x + 1, y - 1, { steps: 4 });
  await page.waitForTimeout(400);
  expect(Math.abs(arcBetween(await shipAngle(page), held))).toBeLessThan(0.05);
});

test('under reduced motion the ship does not follow the pointer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWormhole(page);
  await needsWebGL(page);
  const { x, y, radius } = await gate(page);
  await page.mouse.move(x + radius, y, { steps: 6 });
  await page.waitForTimeout(600);
  expect(await shipAngle(page)).toBeCloseTo(-Math.PI / 2, 2);
});

test.describe('on a touchscreen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap sends the ship to that side of the gate, along the ring', async ({ page }) => {
    await openWormhole(page);
    await needsWebGL(page);
    const { x, y, radius } = await gate(page);
    await page.touchscreen.tap(x + radius * 0.9, y);
    await expect.poll(async () => Math.abs(arcBetween(await shipAngle(page), 0)), { timeout: 4000 }).toBeLessThan(0.1);
  });
});
