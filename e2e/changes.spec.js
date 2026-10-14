import { test, expect } from './fixtures.js';
import { CHANGES_ID, REFUSED_SCENE, changesDigestFixture, changesIndexFixture } from '../src/test/changes-digest.fixture.js';

/**
 * /changes lists the RISE Changes digests; /changes/<id> shows one: its
 * reading, its pull requests and how each was routed. The preview server has
 * no Worker, so the files are served here from a test fixture
 * (src/test/changes-digest.fixture.js). No model is called.
 */
const pathOf = page => new URL(page.url()).pathname;

async function serveChanges(page, digest = changesDigestFixture()) {
  await page.route('**/content/changes/index.json', route => route.fulfill({ json: changesIndexFixture() }));
  await page.route(`**/content/changes/${CHANGES_ID}.json`, route => route.fulfill({ json: digest }));
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

test('/changes lists the digests, newest first, and opens one by keyboard at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveChanges(page);
  await page.goto('/changes');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What changed in RISE', { timeout: 15_000 });
  const rows = page.locator('.changes-digests li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('12–13 October 2026 · 5 changes in the reading');
  await expect(rows.first().locator('.changes-badge')).toHaveText('Team');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await rows.first().getByRole('link').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => pathOf(page)).toBe(`/changes/${CHANGES_ID}`);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('What changed in RISE, 12–13 October');
  await expect(heading).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a digest plays its admitted Current as a reading, links each change to its pull request, and says who wrote it', async ({ page }) => {
  let modelRequests = 0;
  await page.route(/openrouter\.ai|anthropic\.com|\/api\/local\//u, route => {
    modelRequests += 1;
    return route.abort();
  });
  await serveChanges(page);
  await page.goto(`/changes/${CHANGES_ID}`);

  const panel = page.locator('#changes');
  await expect(panel).toContainText('Written by claude-sonnet-5-5 via Claude Code from 5 merged pull requests, 12–13 October 2026.', { timeout: 15_000 });
  const included = panel.locator('.changes-included a');
  await expect(included).toHaveCount(5);
  await expect(included.first()).toHaveAttribute('href', 'https://github.com/SyberLabs/RISE/pull/652');
  await expect(included.first()).toContainText('#652 The attractor can be a swarm, and the harmonograph rotary');

  const chosen = panel.locator('details.changes-chosen');
  await chosen.locator('summary').click();
  await expect(chosen.locator('.changes-routes li')).toHaveCount(8);
  await expect(chosen).toContainText('#654 SCR-007: delivery deployed (#652 live at 2f13e80a)');
  await expect(chosen).toContainText('Left out: records only');

  await panel.getByRole('button', { name: 'Play the reading' }).click();
  expect(await reading(page)).toBe(`/changes/${CHANGES_ID}`);
  await expect.poll(() => pathOf(page)).toBe(`/changes/${CHANGES_ID}`);
  // The words stream: an early beat's words reach the Chamber, then the last beat's replace them.
  const display = page.locator('#chamber-display');
  await expect(display).toContainText(/remember|questions|RISE said|frames|inner eye/u, { timeout: 20_000 });
  await expect(display).toContainText('harmonograph', { timeout: 30_000 });
  expect(modelRequests).toBe(0);
});

for (const [name, digest] of [
  ['a malformed digest', () => ({ ...changesDigestFixture(), sources: { 0: [999] } })],
  ['a digest with refused scene code', () => {
    const value = changesDigestFixture();
    value.current.scenes.push(REFUSED_SCENE);
    return value;
  }]
]) {
  test(`${name} shows the refusal and no reading`, async ({ page }) => {
    await serveChanges(page, digest());
    await page.goto(`/changes/${CHANGES_ID}`);
    await expect(page.locator('#changes [role="status"]')).toHaveText('This digest could not be shown.', { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Play the reading' })).toHaveCount(0);
    await page.locator('#changes').getByRole('link', { name: 'All digests' }).click();
    await expect.poll(() => pathOf(page)).toBe('/changes');
    await expect(page.locator('.changes-digests li')).toHaveCount(2);
  });
}

test('a changes address with no files behind it says so in one line', async ({ page }) => {
  // What the preview answers with no Worker: the app's own page, not JSON.
  await page.route('**/content/changes/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html></html>' }));
  await page.goto('/changes');
  await expect(page.locator('#changes [role="status"]')).toHaveText('The list of digests could not be shown.', { timeout: 15_000 });
  await page.goto(`/changes/${CHANGES_ID}`);
  await expect(page.locator('#changes [role="status"]')).toHaveText('This digest could not be shown.', { timeout: 15_000 });
});
