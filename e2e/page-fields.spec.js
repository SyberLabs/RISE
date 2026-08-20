import { test, expect } from '@playwright/test';
import { collectAcrossPages } from './page-helpers.js';
const GATE = { code: 'rise2025', name: 'Fields', vault: null, timestamp: Date.now() };
const SEED = {
  text: Array.from({ length: 60 }, (_, i) =>
    `Paragraph ${i}. The pendulum draws the chord it hears, and the room answers in kind, slowly and without hurry at all.`).join('\n\n'),
  textSource: 'Seed', origin: null
};
const prefs = (visualMode, extra = {}) => ({
  visualInterlocution: {
    visualMode,
    focals: { type: 'standard', standardGlyph: 'lotus', personalImage: null },
    attractor: { system: 'aizawa', palette: 'white', form: 'mirror' },
    genesis: { preset: 'random', glass: true },
    interlocution: { sourceFamily: 'procedural', procedural: ['fractal'], sourced: [] },
    ...extra
  }
});

async function openPage(page, mode) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((g) => {
    localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
    localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
    localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(g.prefs));
  }, { gate: GATE, seed: SEED, prefs: prefs(mode) });
  await page.goto('/');
  await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15000 });
  await page.locator('[data-nav="chamber"]').first().click();
  await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
  await page.locator('#begin-btn').click();
  const warn = page.locator('#photosensitivity-modal');
  if (await warn.isVisible({ timeout: 4000 }).catch(() => false)) await warn.locator('#safety-accept').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
  await page.waitForTimeout(3000);
  await page.locator('#chamber-display').hover();
  await page.locator('#page-mode-btn').click();
  await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(4000);
}

/** Figures hydrate lazily on intersection; walk the page so all of them load. */
async function scrollThrough(page) {
  const host = page.locator('.page-scroll, .page-host, .page-article').first();
  for (let i = 0; i < 14; i++) {
    await host.evaluate((el, k) => {
      const s = el.closest('[style*=overflow], .page-scroll') || el.parentElement || el;
      (s.scrollHeight > s.clientHeight ? s : document.scrollingElement)
        .scrollTo(0, k * 700);
    }, i);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2500);
}

test('GENESIS samples itself at intervals, and pauses under the page', async ({ page }) => {
  await openPage(page, 'genesis');
  await scrollThrough(page);
  // Paginated: figure counts belong to the reading, not to one page.
  const walked = await collectAcrossPages(page);
  const r = await page.evaluate(() => {
    const ch = window.rise.router.views.get('chamber-session').instance;
    const imgs = [...document.querySelectorAll('.page-figure.is-shown img')];
    return {
      distinct: new Set(imgs.map(i => i.src)).size,
      kleePaused: ch.kleeField?.paused ?? null,
      allImgs: document.querySelectorAll('.page-figure img').length,
      distinctAll: new Set([...document.querySelectorAll('.page-figure img')].map(i => i.src)).size,
      states: [...document.querySelectorAll('.page-figure')].map(f => f.className.replace('page-figure ', '')),
      plates: document.querySelectorAll('.page-figure.placement-bleed').length
    };
  });
  Object.assign(r, {
    figures: walked.figures, shown: walked.shown, allImgs: walked.figures,
    distinct: walked.distinct, distinctAll: walked.distinct, pages: walked.pages
  });
  console.log('GENESIS ' + JSON.stringify(r));
  expect(r.shown).toBeGreaterThanOrEqual(1);
  expect(r.distinct).toBe(r.shown);          // each sample is a DIFFERENT state
  expect(r.kleePaused).toBe(true);           // computation halted under the page
});

test('ATTRACTOR samples itself, and its rAF is halted under the page', async ({ page }) => {
  await openPage(page, 'attractor');
  await scrollThrough(page);
  const walked = await collectAcrossPages(page);
  const r = await page.evaluate(() => {
    const ch = window.rise.router.views.get('chamber-session').instance;
    const imgs = [...document.querySelectorAll('.page-figure.is-shown img')];
    return {
      distinct: new Set(imgs.map(i => i.src)).size,
      hasField: !!ch.attractorField,
      // null means paused; a number means still integrating.
      rafId: ch.attractorField ? ch.attractorField.rafId : 'no-field'
    };
  });
  Object.assign(r, {
    figures: walked.figures, shown: walked.shown, allImgs: walked.figures,
    distinct: walked.distinct, distinctAll: walked.distinct, pages: walked.pages
  });
  console.log('ATTRACTOR ' + JSON.stringify(r));
  expect(r.shown).toBeGreaterThanOrEqual(1);
  expect(r.distinct).toBe(r.shown);
  expect(r.hasField).toBe(true);
  expect(r.rafId).toBeNull();                // integration stopped
});

test('a FOCAL is shown once above the title', async ({ page }) => {
  await openPage(page, 'focals');
  const r = await page.evaluate(() => {
    const focal = document.querySelector('.page-focal');
    const title = document.querySelector('.page-title');
    return {
      hasFocal: !!focal,
      mark: focal?.textContent || null,
      beforeTitle: !!(focal && title && (focal.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)),
      figures: document.querySelectorAll('.page-figure').length
    };
  });
  console.log('FOCAL ' + JSON.stringify(r));
  expect(r.hasFocal).toBe(true);
  expect(r.mark).toBe('❀');                  // lotus
  expect(r.beforeTitle).toBe(true);
  expect(r.figures).toBe(0);                 // held, not serialized
});
