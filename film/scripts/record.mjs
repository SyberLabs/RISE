#!/usr/bin/env node
/**
 * Record the film's RISE-sourced footage from the real production build.
 *
 *   npx vite build && npx vite preview --port 4318 &
 *   node film/scripts/record.mjs            # every scene
 *   node film/scripts/record.mjs wormhole   # one scene
 *
 * Each scene runs in its own browser context with Playwright's video
 * recorder at 1920×1080 and lands in film/out/raw/<scene>.webm. Title cards
 * and slates are screenshots in film/out/cards/. The assembler
 * (assemble.mjs) trims and grades from film/edl.json.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = resolve(HERE, '..');
const OUT = join(FILM, 'out');
const RAW = join(OUT, 'raw');
const CARDS = join(OUT, 'cards');
const ORIGIN = process.env.RISE_FILM_ORIGIN || 'http://127.0.0.1:4318';
const SIZE = { width: 1920, height: 1080 };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withContext(browser, name, run, { video = true } = {}) {
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    locale: 'en-US',
    ...(video ? { recordVideo: { dir: RAW, size: SIZE } } : {})
  });
  const page = await context.newPage();
  page.on('pageerror', error => console.warn(`[${name}] page error: ${error.message}`));
  const started = Date.now();
  try {
    await run(page);
  } finally {
    const clip = video ? page.video() : null;
    await context.close();
    if (clip) {
      const tmp = await clip.path();
      await rename(tmp, join(RAW, `${name}.webm`));
    }
  }
  console.log(`${name}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

/** Accept the photosensitivity warning if it is raised; carry on if not. */
async function acceptFlashWarning(page, timeout = 20_000) {
  const warning = page.locator('#photosensitivity-modal');
  const display = page.locator('#chamber-display');
  await Promise.race([
    warning.waitFor({ state: 'visible', timeout }).catch(() => {}),
    display.waitFor({ state: 'visible', timeout }).catch(() => {})
  ]);
  if (await warning.isVisible().catch(() => false)) await warning.locator('#safety-accept').click();
}

/** Park the pointer in a corner so hover chrome stays hidden. */
const park = page => page.mouse.move(2, 2);

const SCENES = {
  /** The Wormhole page: idle starfield, then the transit. */
  async wormhole(page) {
    await page.goto(`${ORIGIN}/wormhole.html`);
    await page.locator('#jump').waitFor();
    await park(page);
    await sleep(3000);
    await page.locator('#jump').click();
    await park(page);
    await sleep(9000);
    // A second crossing for a longer, cleaner transit.
    const again = page.locator('#again');
    if (await again.isVisible().catch(() => false)) {
      await again.click();
      await park(page);
      await sleep(9000);
    }
  },

  /**
   * The Wormhole's picture alone, filling the frame: the console's viewport
   * is pinned over the whole window and everything else is hidden. The
   * WebGL scene re-fits to the element, so this is the same transit, larger.
   */
  async 'wormhole-full'(page) {
    await page.goto(`${ORIGIN}/wormhole.html`);
    await page.locator('#jump').waitFor();
    await page.addStyleTag({ content: `
      .wh-header, .wh-interface, .wh-footer, .wh-toprail, .wh-bottomrail, .wh-viewport-id,
      .wh-coordinate, .wh-reticle, .wh-grid, .wh-scan { display: none !important; }
      .wormhole { background: #080d16 !important; }
      .wh-console { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
        margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important;
        box-shadow: none !important; transform: none !important; background: #080d16 !important; }
      .wh-viewport { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
        border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      .wh-viewport canvas { width: 100% !important; height: 100% !important; }
    ` });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await park(page);
    await sleep(3000);
    // The controls are hidden, so press them from script.
    await page.evaluate(() => document.getElementById('jump')?.click());
    await sleep(10_000);
    await page.evaluate(() => document.getElementById('again')?.click());
    await sleep(10_000);
  },

  /** Home: the day's reading streaming in the stage. */
  async home(page) {
    await page.goto(`${ORIGIN}/`);
    await page.locator('[data-home="roll"]').waitFor({ timeout: 20_000 });
    await park(page);
    await sleep(14_000);
  },

  /** The Keystones rail, centring Meditations. */
  async keystones(page) {
    await page.goto(`${ORIGIN}/try-rise`);
    await page.locator('#keystone-metamorphoses').waitFor({ timeout: 20_000 });
    await park(page);
    await sleep(2500);
    await page.locator('#keystone-meditations').click();
    await park(page);
    await sleep(2500);
    await page.locator('[data-enter]').hover();
    await sleep(3000);
  },

  /** Enter Meditations; stream for a while; then open the Page. */
  async reading(page) {
    await page.goto(`${ORIGIN}/keystone/meditations`);
    const enter = page.locator('[data-enter]');
    await enter.waitFor({ timeout: 20_000 });
    await page.waitForFunction(() => !document.querySelector('[data-enter]')?.disabled, null, { timeout: 30_000 });
    await enter.click();
    await acceptFlashWarning(page);
    await page.locator('#chamber-display').waitFor({ timeout: 20_000 });
    await park(page);
    await sleep(24_000);
    // The Page: the same reading as a composed text.
    await page.locator('#chamber-display').hover();
    const pageBtn = page.locator('#page-mode-btn');
    if (await pageBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pageBtn.click();
      await page.locator('.page-article').waitFor({ timeout: 10_000 }).catch(() => {});
      await park(page);
      await sleep(3000);
      // Drift down the page the way a reader does.
      for (let step = 0; step < 24; step += 1) {
        await page.evaluate(() => {
          const el = document.querySelector('#chamber-page');
          if (el) el.scrollTop += 28;
        });
        await sleep(250);
      }
      await sleep(2000);
    } else {
      await park(page);
      await sleep(11_000);
    }
  },

  /** Make → Visual Lab: a Living Flame scene under the hand. */
  async lab(page) {
    await page.goto(`${ORIGIN}/`);
    await page.locator('[data-home="roll"]').waitFor({ timeout: 20_000 });
    const link = page.locator('.portal-nav [data-nav="make"]');
    const toggle = page.locator('.portal-menu-toggle');
    if (!(await link.isVisible()) && await toggle.isVisible()) await toggle.click();
    await link.click();
    await page.locator('.make-nav [data-tab="visual-lab"]').first().click();
    await page.locator('.vl-stage canvas').waitFor({ timeout: 20_000 });
    await sleep(3500);
    const slide = async (name, from, to, steps = 20, pause = 90) => {
      for (let i = 0; i <= steps; i += 1) {
        const value = Math.round(from + (to - from) * (i / steps));
        await page.evaluate(([n, v]) => {
          const input = document.querySelector(`[name="vl-${n}"]`);
          if (!input) return;
          input.value = String(v);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, [name, value]);
        await sleep(pause);
      }
    };
    await slide('energy', 40, 85);
    await sleep(1500);
    await slide('hue', 0, 140);
    await sleep(1500);
    await page.locator('[data-vl="mutate"]').click();
    await sleep(3000);
    await page.locator('[data-vl="mutate"]').click();
    await sleep(3500);
    // Fold the panel away so the flame fills the frame for the last beat.
    await page.locator('.vl-toggle').click().catch(() => {});
    await park(page);
    await sleep(4000);
  }
};

/* ────────────────────────────── cards ────────────────────────────── */

const CARD_CSS = `
  :root { color-scheme: dark; }
  html, body { margin: 0; width: 1920px; height: 1080px; background: #080d16; overflow: hidden; }
  .card { position: relative; width: 1920px; height: 1080px; display: grid; place-items: center;
    color: #e6efec; font-family: "Instrument Serif", "Crimson Pro", Georgia, serif; text-align: center;
    background: radial-gradient(ellipse at 50% 60%, #0f1a26 0%, #080d16 65%); }
  .mark { width: 72px; height: 84px; opacity: .92; }
  .word { font-size: 196px; line-height: 1; letter-spacing: .06em; margin: 28px 0 0; font-weight: 400; }
  .sub { font-family: "Instrument Sans", "Helvetica Neue", Arial, sans-serif; font-size: 34px; letter-spacing: .28em;
    text-transform: uppercase; color: #9fb7b3; margin-top: 26px; }
  .url { font-family: "Instrument Sans", Arial, sans-serif; font-size: 44px; color: #f5b687; margin-top: 44px; letter-spacing: .04em; }
  .small { font-family: "Instrument Sans", Arial, sans-serif; font-size: 26px; color: #7f9794; margin-top: 30px; letter-spacing: .12em; }
  .rail { position: absolute; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #6e939788, transparent); }
  .rail.top { top: 128px; } .rail.bottom { bottom: 128px; }
  .corner { position: absolute; font-family: "Instrument Sans", Arial, sans-serif; font-size: 20px; letter-spacing: .3em;
    color: #5d7673; text-transform: uppercase; }
  .corner.tl { top: 76px; left: 96px; } .corner.tr { top: 76px; right: 96px; } .corner.bl { bottom: 76px; left: 96px; } .corner.br { bottom: 76px; right: 96px; }
  /* slates */
  .slate { align-content: start; justify-items: start; padding: 150px 190px; box-sizing: border-box;
    text-align: left; background: linear-gradient(160deg, #0b1420 0%, #080d16 60%, #120f0d 100%); }
  .slate .eyebrow { font-family: "Instrument Sans", Arial, sans-serif; font-size: 28px; letter-spacing: .32em; text-transform: uppercase; color: #f5b687; }
  .slate .title { font-size: 104px; line-height: 1.02; margin: 26px 0 0; max-width: 1480px; }
  .slate .prompt { font-family: "Crimson Pro", Georgia, serif; font-size: 36px; line-height: 1.38; color: #b7c8c4; margin-top: 44px; max-width: 1500px; }
  .slate .meta { position: absolute; bottom: 150px; left: 190px; right: 190px; display: flex; justify-content: space-between;
    font-family: "Instrument Sans", Arial, sans-serif; font-size: 26px; letter-spacing: .18em; text-transform: uppercase; color: #6e9397; }
`;

const MARK = '<img class="mark" src="/syberlabs-mark.webp" alt="">';

function titleCard({ word, sub, url, small, mark = true, corners = [] }) {
  const [tl = 'SyberLabs', tr = '2026', bl = 'RISE', br = 'rise.syberlabs.io'] = corners;
  return `<div class="card">
    <div class="rail top"></div><div class="rail bottom"></div>
    <span class="corner tl">${tl}</span><span class="corner tr">${tr}</span>
    <span class="corner bl">${bl}</span><span class="corner br">${br}</span>
    <div>${mark ? MARK : ''}${word ? `<h1 class="word">${word}</h1>` : ''}
      ${sub ? `<p class="sub">${sub}</p>` : ''}${url ? `<p class="url">${url}</p>` : ''}${small ? `<p class="small">${small}</p>` : ''}</div>
  </div>`;
}

function slateCard({ id, source, seconds, title, prompt }) {
  return `<div class="card slate">
    <p class="eyebrow">${source} · shot ${id} · ${seconds} s · missing, shown as a slate</p>
    <h1 class="title">${title}</h1>
    <p class="prompt">${prompt}</p>
    <div class="meta"><span>RISE · Through the Vortex</span><span>Review cut</span></div>
  </div>`;
}

const LOWER_THIRD_CSS = `
  html, body { margin: 0; width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
  .lt { position: absolute; left: 112px; bottom: 96px; color: #eef4f2; }
  .lt .rule { width: 56px; height: 3px; background: #f5b687; margin-bottom: 18px; }
  .lt .l1 { font-family: "Instrument Serif", "Crimson Pro", Georgia, serif; font-size: 58px; line-height: 1.05;
    text-shadow: 0 2px 18px rgba(0,0,0,.55); }
  .lt .l2 { font-family: "Instrument Sans", "Helvetica Neue", Arial, sans-serif; font-size: 26px; letter-spacing: .22em;
    text-transform: uppercase; color: #b9cdc9; margin-top: 12px; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
`;

function lowerThird({ line1, line2 }) {
  return `<div class="lt"><div class="rule"></div><div class="l1">${line1}</div>${line2 ? `<div class="l2">${line2}</div>` : ''}</div>`;
}

async function screenshotCard(page, name, html, { css = CARD_CSS, transparent = false } = {}) {
  await page.evaluate(([style, body]) => {
    // Keep the built stylesheet (its @font-face rules); replace the rest.
    for (const node of [...document.head.children]) {
      if (!(node.tagName === 'LINK' && node.rel === 'stylesheet') && node.tagName !== 'STYLE') node.remove();
    }
    const extra = document.createElement('style');
    extra.id = 'film-card';
    document.getElementById('film-card')?.remove();
    extra.textContent = style;
    document.head.append(extra);
    document.body.innerHTML = body;
  }, [css, html]);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
  await sleep(300);
  await page.screenshot({ path: join(CARDS, `${name}.png`), type: 'png', omitBackground: transparent });
}

async function cards(browser, edl) {
  await withContext(browser, 'cards', async page => {
    await page.goto(`${ORIGIN}/`);
    await page.locator('.sl-lockup').waitFor({ timeout: 20_000 });
    // Load the three faces by using them once; fonts.ready then waits on them.
    await page.evaluate(() => {
      const probe = document.createElement('p');
      probe.innerHTML = '<span style="font-family:\'Instrument Serif\'">a</span><span style="font-family:\'Crimson Pro\'">a</span><span style="font-family:\'Instrument Sans\'">a</span>';
      document.body.append(probe);
    });
    await page.evaluate(() => document.fonts.ready);
    for (const card of edl.cards) await screenshotCard(page, card.name, titleCard(card));
    for (const lt of edl.lowerThirds || []) {
      await screenshotCard(page, `lt-${lt.name}`, lowerThird(lt), { css: LOWER_THIRD_CSS, transparent: true });
    }
    for (const shot of edl.shots) {
      if (shot.source === 'runway' || shot.source === 'supplied') {
        await screenshotCard(page, `slate-${shot.id}`, slateCard(shot));
      }
    }
  }, { video: false });
}

/* ─────────────────────────────── main ─────────────────────────────── */

const wanted = process.argv.slice(2);
const edl = JSON.parse(await readFile(join(FILM, 'edl.json'), 'utf8'));
await mkdir(RAW, { recursive: true });
await mkdir(CARDS, { recursive: true });

// The cloud image pins its own Chromium; a newer Playwright would otherwise
// look for a build that was never downloaded.
const browser = await chromium.launch({
  ...(process.env.RISE_FILM_CHROMIUM || process.env.PLAYWRIGHT_BROWSERS_PATH
    ? { executablePath: process.env.RISE_FILM_CHROMIUM || `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` }
    : { channel: 'chromium' }),
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=1'
  ]
});

try {
  const names = wanted.length ? wanted : [...Object.keys(SCENES), 'cards'];
  for (const name of names) {
    if (name === 'cards') { await cards(browser, edl); continue; }
    if (!SCENES[name]) { console.error(`unknown scene: ${name}`); process.exitCode = 1; continue; }
    await rm(join(RAW, `${name}.webm`), { force: true });
    await withContext(browser, name, SCENES[name]);
  }
} finally {
  await browser.close();
}
