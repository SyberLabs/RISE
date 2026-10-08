import { test, expect } from './fixtures.js';
import { ARENA_CASE, ARENA_REPLAY_FILE, arenaIndexFixture, arenaReplayFixture } from '../src/test/arena-run.fixture.js';

/**
 * /arena lists a frozen Decision Arena run's cases; /arena/<case> sets the
 * four deciders' choices side by side; /arena/<case>/<decider> replays one
 * as a real reading, one decider at a time, with no model call. The frozen
 * files are served here from a test fixture (src/test/arena-run.fixture.js).
 */
const pathOf = page => new URL(page.url()).pathname;

async function serveArena(page, run = arenaReplayFixture()) {
  await page.route('**/content/arena/index.json', route => route.fulfill({ json: arenaIndexFixture() }));
  await page.route(`**/content/arena/${ARENA_REPLAY_FILE}`, route => route.fulfill({ json: run }));
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
  await expect(panel.locator('[data-arena-decider="kev"]')).toContainText('not run');
  await expect(panel.locator('[data-arena-decider="rules"]')).toContainText('rejected: OUT_OF_MENU');
  await expect(panel.locator('[data-arena-decider="jev"]')).toHaveAttribute('aria-current', 'true');
  await expect(panel.getByRole('heading', { level: 2, name: 'A · OpenAI Decisions — gpt-6-luna-2026-09-01' })).toBeVisible();

  await panel.getByRole('button', { name: 'Play this one: B · TypeSafe Jev' }).click();
  expect(await reading(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  const firstText = await page.evaluate(() => [...window.__RISE_TEST__.getCurrentSession().sourceTexts.values()].join(' '));

  // Leaving the reading returns to the same case, where another decider is one press away.
  await leave(page);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/jev`);
  await panel.getByRole('button', { name: 'Play this one: A · OpenAI Decisions' }).click();
  expect(await reading(page)).toBe(`/arena/${ARENA_CASE}/openai`);
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}/openai`);
  const secondText = await page.evaluate(() => [...window.__RISE_TEST__.getCurrentSession().sourceTexts.values()].join(' '));
  expect(secondText).not.toBe(firstText);
  await expect(page.locator('#chamber-display')).toHaveCount(1);

  await leave(page);
  await expect(panel.locator('[data-arena-decider="openai"]')).toHaveAttribute('aria-current', 'true');
  expect(modelRequests).toBe(0);
});

test('/arena lists each case by the reader\'s request; a case sets the four choices side by side, by keyboard, at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await serveArena(page);
  await page.goto('/arena');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The same request, four deciders', { timeout: 15_000 });
  const link = page.locator('#arena-replay').getByRole('link', { name: 'I need a very slow, restful reading tonight.' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => pathOf(page)).toBe(`/arena/${ARENA_CASE}`);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('“I need a very slow, restful reading tonight.”');
  await expect(heading).toBeFocused();

  const openai = page.locator('[data-arena-decider="openai"]');
  for (const term of ['Book', 'Look', 'Sound', 'Pace']) await expect(openai.locator('dt', { hasText: term })).toBeVisible();
  await expect(openai).toContainText('Middlemarch, by George Eliot · final section');
  await expect(page.locator('[aria-current="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  // Keyboard only: Tab reaches the first play button and Enter opens its reading at its own address.
  const play = page.getByRole('button', { name: 'Play this one: A · OpenAI Decisions' });
  for (let i = 0; i < 40 && !await play.evaluate(el => el === document.activeElement); i += 1) await page.keyboard.press('Tab');
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await reading(page)).toBe(`/arena/${ARENA_CASE}/openai`);
});

test('an arena address with no published run says so in one line and links home', async ({ page }) => {
  // What production answers today: the app's own page, not JSON.
  await page.route('**/content/arena/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html></html>' }));
  for (const path of ['/arena', `/arena/${ARENA_CASE}`, `/arena/${ARENA_CASE}/kev`]) {
    await page.goto(path);
    await expect(page.locator('#arena-replay [role="status"]')).toHaveText('No published run yet — the comparison is being captured.', { timeout: 15_000 });
    expect(pathOf(page)).toBe(path);
  }
  await page.locator('#arena-replay').getByRole('link', { name: 'Back to Home' }).click();
  await expect.poll(() => pathOf(page)).toBe('/');
  await expect(page.locator('.home-actions [data-home="enter"]')).toBeAttached();
});

test('an arena address naming a case the run does not have says so and links to the cases', async ({ page }) => {
  await serveArena(page);
  await page.goto('/arena/not-a-case/openai');
  await expect(page.locator('#arena-replay [role="status"]')).toHaveText('The published run has no case “not-a-case”.', { timeout: 15_000 });
  await page.locator('#arena-replay').getByRole('link', { name: 'All cases' }).click();
  await expect.poll(() => pathOf(page)).toBe('/arena');
  await expect(page.locator('.arena-cases li')).toHaveCount(1);
});
