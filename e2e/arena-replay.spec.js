import { test, expect } from './fixtures.js';
import { ARENA_CASE, ARENA_RUN_FILE, arenaIndexFixture, arenaRunFixture } from '../src/test/arena-run.fixture.js';

/**
 * /arena/<case>/<decider> replays a frozen Decision Arena result as a real
 * reading, one decider at a time, with no model call. The frozen files are
 * served here from a test fixture (src/test/arena-run.fixture.js).
 */
const pathOf = page => new URL(page.url()).pathname;

async function serveArena(page, run = arenaRunFixture()) {
  await page.route('**/content/arena/index.json', route => route.fulfill({ json: arenaIndexFixture() }));
  await page.route(`**/content/arena/${ARENA_RUN_FILE}`, route => route.fulfill({ json: run }));
}

async function reading(page) {
  const warn = page.locator('#photosensitivity-modal');
  await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await warn.isVisible()) await warn.locator('#safety-accept').click();
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'read'
    && window.__RISE_TEST__.getView('read')?.activePane === 'chamber'
    && !window.__RISE_TEST__.getRouterState().transitioning, null, { timeout: 20_000 });
  return page.evaluate(() => window.__RISE_TEST__.getCurrentSession().publicPath);
}

async function leave(page) {
  await page.keyboard.press('Escape');
  await page.locator('#exit-confirm-overlay').getByRole('button', { name: 'End reading' }).click();
  await page.waitForFunction(() => window.__RISE_TEST__.getRouterState().currentView === 'home', null, { timeout: 10_000 });
}

test('an arena address replays each decider\'s frozen decision as a reading, one at a time, with no model call', async ({ page }) => {
  let modelRequests = 0;
  await page.route(/openrouter\.ai|\/content\/catalog\.json|\/api\/local\//u, route => {
    modelRequests += 1;
    return route.abort();
  });
  await serveArena(page);
  await page.goto(`/arena/${ARENA_CASE}/jev`);

  const panel = page.locator('#arena-replay');
  await expect(panel).toContainText('Frozen result captured 2026-10-07. Independent comparison; no partnership with OpenAI or TypeSafe.', { timeout: 15_000 });
  await expect(panel).toContainText('C · Kev: not run');
  await expect(panel).toContainText('D · rules, no model: rejected: NO_BOOK');
  await expect(panel.getByRole('button', { name: 'B · TypeSafe Jev' })).toHaveAttribute('aria-current', 'true');

  await panel.getByRole('button', { name: 'B · TypeSafe Jev' }).click();
  expect(await reading(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  const firstText = await page.evaluate(() => [...window.__RISE_TEST__.getCurrentSession().sourceTexts.values()].join(' '));

  // Leaving the reading returns to the same case, where another decider is one press away.
  await leave(page);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  await panel.getByRole('button', { name: 'A · OpenAI Decisions' }).click();
  expect(await reading(page)).toBe(`/arena/${ARENA_CASE}/openai`);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/openai`);
  const secondText = await page.evaluate(() => [...window.__RISE_TEST__.getCurrentSession().sourceTexts.values()].join(' '));
  expect(secondText).not.toBe(firstText);
  await expect(page.locator('#chamber-display')).toHaveCount(1);

  await leave(page);
  await expect(page.locator('#arena-replay button[aria-current="true"]')).toHaveText('A · OpenAI Decisions');
  expect(modelRequests).toBe(0);
});

test('an arena address with no frozen result for its case opens Home', async ({ page }) => {
  await serveArena(page);
  await page.goto('/arena/not-a-case/openai');
  await expect.poll(() => pathOf(page), { timeout: 15_000 }).toBe('/');
  await expect(page.locator('.home-actions [data-home="enter"]')).toBeAttached();
  await expect(page.locator('#arena-replay')).toHaveCount(0);
});

test('an arena address with no run published opens Home', async ({ page }) => {
  await page.route('**/content/arena/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(`/arena/${ARENA_CASE}/kev`);
  await expect.poll(() => pathOf(page), { timeout: 15_000 }).toBe('/');
  await expect(page.locator('.home-actions [data-home="enter"]')).toBeAttached();
});
