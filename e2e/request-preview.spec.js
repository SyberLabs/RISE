import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { jevColors } from '../src/core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

/**
 * The Tokyo Drift reproduction (docs: request-to-playback design, 2026-09-27).
 * One request box → an interpretation stated before anything plays →
 * local adjustment with no new request → Play → no automatic fullscreen.
 */
const releaseInventory = JSON.parse(readFileSync(
  new URL('../src/content/archive/release-inventory.json', import.meta.url), 'utf8'
));
const released = releaseInventory.ulysses;
// The plan production returned for this request on 2026-09-27.
const selectors = {
  section: 'first', wpm: 300, curve: 'wave', chunkMode: 'phrase', audio: 'chase',
  visualMode: 'interlocution', visualStyle: 'psychedelic', visualEngine: 'fractal',
  visualArc: 'triple', arcSplit: '30', middleEngine: 'fractal', finaleEngine: 'fractal',
  middleTheme: 'prism', finaleTheme: 'prism', middleAudio: 'chase', finaleAudio: 'chase',
  visualPalette: 'purple', kleePreset: 'chaotic', galleryCadence: 'lively', chamberFace: 'jp',
  fontSize: 'large', colorTheme: 'prism', textColor: 'amethyst', backgroundColor: 'prism',
  wordFill: 'accent', projection: 'stream', revealMode: 'instant'
};
const decision = {
  schemaVersion: 2, requestId: 'browser-tokyo-drift', model: 'typesafe/jev-1.13',
  workId: 'ulysses', editionId: released.editionId, sourceRevision: released.sourceRevision,
  reason: 'An experimental day-long journey through Dublin and consciousness.',
  config: {
    ...selectors, colors: jevColors('prism', 'amethyst', 'prism'),
    ...resolveJevChamberConfig(selectors),
    visualProgram: compileJevVisualProgram(selectors),
    audioProgram: compileJevAudioProgram(selectors)
  }
};

test('Tokyo Drift: one box, interpretation and limits before Play, local adjust, no auto fullscreen', async ({ page }) => {
  let jevRequests = 0;
  await page.route('**/api/jev-recommend', route => {
    jevRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(decision) });
  });
  // A cold first visit: no stored session and no intro screen.
  await page.goto('/');
  await expect(page.locator('#beta-enter')).toHaveCount(0);
  const intent = page.locator('#portal-jev-intent');
  await expect(intent).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('h1')).toHaveText('What do you want to experience?');

  await intent.fill('i want something psychedelic fast tokyo drift style');
  await page.locator('.portal-jev-submit').click();
  const preview = page.locator('#portal-preview');
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#chamber-display')).toBeHidden();
  await expect(preview.locator('.portal-preview-lede')).toContainText('You referenced “Tokyo Drift”');
  await expect(preview.locator('.portal-rows')).toContainText('Neon night');
  await expect(preview.locator('.portal-rows')).toContainText('Fast, flowing fractal light');
  await expect(preview.locator('.portal-limit')).toBeVisible();
  await expect(preview.locator('.portal-limit-body')).toContainText('can’t play the Tokyo Drift soundtrack');
  await expect(preview.locator('.portal-read-title')).toHaveText('Ulysses');

  await preview.locator('[data-adjust-kind="speed"][data-adjust-value="fastest"]').click();
  await expect(preview.locator('.portal-rows')).toContainText('400 words a minute');
  expect(jevRequests).toBe(1);

  // Reload keeps the request and the preview without asking again.
  await page.reload();
  await expect(page.locator('#portal-jev-intent')).toHaveValue('i want something psychedelic fast tokyo drift style');
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await expect(preview.locator('.portal-rows')).toContainText('400 words a minute');
  expect(jevRequests).toBe(1);

  await preview.locator('#portal-play').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.locator('#chamber-display').hover();
  await expect(page.locator('#page-mode-btn .control-label')).toHaveText('Page view');
  await expect(page.locator('#fullscreen-btn')).toBeVisible();
  const played = await page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.session?.wpm);
  if (played !== undefined) expect(played).toBe(400);
});
