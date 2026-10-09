import { readFileSync } from 'node:fs';
import { test, expect, openHomeAsk, connectTestOpenRouter, routeTestOpenRouter } from './fixtures.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { jevColors } from '../src/core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

/**
 * The Tokyo Drift reproduction (docs: request-to-playback design, 2026-09-27),
 * through Home's Ask and the reader's OpenRouter connection: a request →
 * limits before anything plays → Begin → no auto fullscreen.
 */
const releaseInventory = JSON.parse(readFileSync(
  new URL('../src/content/archive/release-inventory.json', import.meta.url), 'utf8'
));
const released = releaseInventory.ulysses;
// The plan production returned for this request on 2026-09-27, with an offered
// opening sound: the night-drive routing replaces it.
const selectors = {
  section: 'first', wpm: 300, curve: 'wave', chunkMode: 'phrase', audio: 'starlight',
  visualMode: 'interlocution', visualStyle: 'psychedelic', visualEngine: 'fractal',
  visualArc: 'triple', arcSplit: '30', middleEngine: 'fractal', finaleEngine: 'fractal',
  middleTheme: 'prism', finaleTheme: 'prism', middleAudio: 'starlight', finaleAudio: 'starlight',
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
test('Tokyo Drift: asked from Home, limits before Begin, no auto fullscreen', async ({ page }) => {
  const jevRequests = await routeTestOpenRouter(page, decision);
  // A cold first visit: no stored session and no intro screen.
  await page.goto('/');
  await expect(page.locator('#beta-enter')).toHaveCount(0);
  await expect(page.locator('[data-home="roll"]')).toBeVisible({ timeout: 15_000 });
  // Fake an explicit reader-owned connection in this browser test; never use
  // a real key or the retired shared Worker endpoint.
  await connectTestOpenRouter(page);

  await openHomeAsk(page);
  await page.locator('#home-intent').fill('i want something psychedelic fast tokyo drift style');
  await page.locator('[data-home="ask"]').click();
  const enter = page.locator('[data-home="enter"]');
  // The asked reading becomes Home's, named in the slot; nothing plays with sound yet.
  await expect(page.locator('h1')).toHaveText('Ulysses', { timeout: 15_000 });
  await expect(page.locator('dialog.home-ask')).toBeHidden();
  await expect(page.locator('.home-label')).toHaveText('As you asked');
  await expect(page.locator('#chamber-display')).toBeHidden();
  await expect(page.locator('[data-home-status]')).toContainText('night drive');
  const note = page.locator('.home-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('You referenced “Tokyo Drift”');
  await expect(note).toContainText('can’t play the Tokyo Drift soundtrack');
  expect(jevRequests()).toBe(1);

  await enter.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.locator('#chamber-display').hover();
  await expect(page.locator('#page-mode-btn .control-label')).toHaveText('Page view');
  await expect(page.locator('#fullscreen-btn')).toBeVisible();
  const played = await page.evaluate(() => window.__RISE_TEST__?.getView('read')?.paneInstance('chamber')?.session?.wpm);
  if (played !== undefined) expect(played).toBe(300);
});
