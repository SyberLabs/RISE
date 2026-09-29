import { readFileSync } from 'node:fs';
import { test, expect, openHomeAsk } from './fixtures.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { jevColors } from '../src/core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

/**
 * The Tokyo Drift reproduction (docs: request-to-playback design, 2026-09-27),
 * through the Oracle: a request asked after a first roll → what RISE cannot
 * do, stated before anything plays → Enter → no automatic fullscreen.
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

test('Tokyo Drift: asked after a roll, limits before Enter, no auto fullscreen', async ({ page }) => {
  let jevRequests = 0;
  await page.route('**/api/jev-recommend', route => {
    jevRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(decision) });
  });
  // A cold first visit: no stored session and no intro screen.
  await page.goto('/');
  await expect(page.locator('#beta-enter')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('What will you encounter?', { timeout: 15_000 });

  await openHomeAsk(page);
  await page.locator('#oracle-intent').fill('i want something psychedelic fast tokyo drift style');
  await page.locator('[data-oracle="ask"]').click();
  const enter = page.locator('[data-oracle="enter"]');
  await expect(enter).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#chamber-display')).toBeHidden();
  await expect(page.locator('.oracle-answer-title')).toHaveText('Ulysses');
  await expect(page.locator('[data-oracle-status]')).toContainText('fractal light');
  const note = page.locator('.oracle-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('You referenced “Tokyo Drift”');
  await expect(note).toContainText('can’t play the Tokyo Drift soundtrack');
  expect(jevRequests).toBe(1);

  await enter.click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.locator('#chamber-display').hover();
  await expect(page.locator('#page-mode-btn .control-label')).toHaveText('Page view');
  await expect(page.locator('#fullscreen-btn')).toBeVisible();
  const played = await page.evaluate(() => window.__RISE_TEST__?.getView('chamber-session')?.session?.wpm);
  if (played !== undefined) expect(played).toBe(300);
});
