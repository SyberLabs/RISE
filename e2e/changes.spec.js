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

test('a digest links each change to its pull request, says who wrote it, and is spoken in RISE\'s room, no model called', async ({ page }) => {
  test.setTimeout(90_000);
  let modelRequests = 0;
  await page.route(/openrouter\.ai|anthropic\.com|openai\.com|googleapis\.com|elevenlabs\.io|\/api\/local\//u, route => {
    modelRequests += 1;
    return route.abort();
  });
  await serveChanges(page);
  // The paced voice: silent, timed as if spoken, so the test needs no audio device.
  await page.goto(`/changes/${CHANGES_ID}?voice=paced&measure=1`);

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

  // RISE's room, with the digest as its only source: the face, the title over Play, the voice's choice, no question.
  await panel.getByRole('button', { name: 'Open the reading' }).click();
  const room = page.locator('.live-venue--sealed');
  await expect(room.getByRole('heading', { level: 1 })).toHaveText('What changed in RISE, 12–13 October');
  await expect(room.locator('.live-face')).toBeAttached();
  await expect(room).toContainText('Written by claude-sonnet-5-5 via Claude Code');
  await expect(room.getByRole('button', { name: 'Who speaks: your device' })).toBeVisible();
  await expect(page.locator('#live-venue-question')).toHaveCount(0);
  await expect(page.locator('[data-venue-open="providers"]')).toHaveCount(0);
  expect(pathOf(page)).toBe(`/changes/${CHANGES_ID}`);
  await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);

  await room.getByRole('button', { name: 'Play' }).click();
  const warn = page.locator('#photosensitivity-modal');
  await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await warn.isVisible()) await warn.locator('#safety-accept').click();
  // The live runtime reads it: the first beat's words, the stage's instrument, the face speaking, and the swarm
  // attractor the first beat starts held in the outer shell. No bar to ask again: the room asks nothing.
  const words = page.locator('#atom-display');
  await expect(words).toContainText(/remember the room|questions before it/u, { timeout: 20_000 });
  const stage = page.locator('#rise-stage-controls');
  for (const name of ['Back a passage', 'Forward a passage', 'Settings']) {
    await expect(stage.getByRole('button', { name, exact: true })).toHaveCount(1);
  }
  await expect.poll(() => page.evaluate(() => window.__riseFace.state())).toBe('speaking');
  await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.frame), { timeout: 15_000 }).toBe('shell');
  await expect(page.getByRole('form', { name: 'Ask again' })).toHaveCount(0);
  expect(pathOf(page)).toBe(`/changes/${CHANGES_ID}`);

  // While it plays, About this reading says who wrote it and what it speaks about.
  await stage.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.rise-settings__about summary').click();
  const about = page.locator('.rise-settings__about-text');
  await expect(about).toContainText('Written by claude-sonnet-5-5 via Claude Code from 5 merged pull requests');
  await expect(about).toContainText('#653 RISE Live: Sophia holds every visual');
  await page.locator('#rise-settings').press('Escape');

  // It reads to its end, the last beat's words spoken whole; the room's one control goes back to the digest.
  await expect(words).toContainText('harmonograph turned rotary', { timeout: 45_000 });
  await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Back to the digest' }).click();
  await expect(page.locator('#changes .changes-included')).toBeVisible({ timeout: 15_000 });
  expect(pathOf(page)).toBe(`/changes/${CHANGES_ID}`);
  await expect(page.locator('#rise-stage-controls')).toHaveCount(0);
  await expect(page.locator('.live-leave')).toHaveCount(0);
  await expect(page.locator('#chamber-display')).toHaveCount(0);
  // And the room opens again from the page, at its entry.
  await page.getByRole('button', { name: 'Open the reading' }).click();
  await expect(page.locator('.live-venue--sealed').getByRole('button', { name: 'Play' })).toBeVisible();
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
