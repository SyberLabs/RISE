import { test, expect } from './fixtures.js';
import { answerDecisions, connectOpenRouter, runAsLocalRise } from './reader-connection.js';
import releaseInventory from '../src/content/archive/release-inventory.json' with { type: 'json' };
import { jevColors, jevPalette } from '../src/core/jev-palette.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

// Connecting OpenRouter adds one real OAuth redirect and page load to each flow.
test.describe.configure({ timeout: 120_000 });

const GATE_SESSION = { code: 'rise2025', name: 'Jev Sequence Test', vault: null, timestamp: Date.now() };

for (const identity of [
  { model: 'typesafe/jev-1.13' },
  { model: 'kev-latest', provider: 'Kev', revision: '139fdd94f1b6a6ad80cc15e08fcb99cac885a101' }
]) test(`one ${identity.model} plan carries a late visual and soundscape phase into the Chamber`, async ({ page }) => {
  const released = releaseInventory['literary-walden'];
  const choices = {
    section: 'shortest', wpm: 300, curve: 'flat', chunkMode: 'phrase',
    audio: 'aurora', middleAudio: 'silent', finaleAudio: 'faded-signal',
    visualMode: 'interlocution', visualStyle: 'psychedelic',
    visualEngine: 'fractal', middleEngine: 'harmonograph', finaleEngine: 'ostensoria',
    visualArc: 'triple', arcSplit: '70',
    colorTheme: 'prism', textColor: 'prism', backgroundColor: 'prism',
    middleTheme: 'ember', finaleTheme: 'jade',
    visualPalette: 'purple', kleePreset: 'chaotic', galleryCadence: 'lively',
    chamberFace: 'thick', fontSize: 'large', wordFill: 'accent',
    projection: 'stream', revealMode: 'instant'
  };
  const config = {
    ...choices,
    colors: jevColors(choices.colorTheme, choices.textColor, choices.backgroundColor),
    ...resolveJevChamberConfig(choices),
    visualProgram: compileJevVisualProgram(choices),
    audioProgram: compileJevAudioProgram(choices)
  };
  const plan = { workId: released.workId, model: identity.model, config };
  await page.addInitScript(gate => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
  }, GATE_SESSION);
  // Hosted Jev on the reader's OpenRouter account, or Kev in local RISE.
  const seen = identity.provider === 'Kev' ? await runAsLocalRise(page, plan) : null;
  await page.goto('/');
  const calls = seen || (await connectOpenRouter(page), await answerDecisions(page, plan));
  await page.locator('#portal-jev-intent').fill('Give me a visual journey through this reading.');
  await page.locator('.portal-jev-submit').click();
  // Home previews Jev's answer; the reading starts only from Play.
  await page.locator('#portal-play').click();
  await expect(page.locator('#chamber-continuous-field')).toBeVisible({ timeout: 30_000 });
  expect(calls).toHaveLength(1);
  if (identity.provider === 'Kev') expect(calls[0].authorization).toBeUndefined();

  const result = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__?.getView('chamber-session');
    const last = chamber?.session?.atoms?.find(atom => atom.sourceProgress >= 0.8);
    if (!chamber || !last) return null;
    const visual = chamber._visualSchedule.observe(last);
    const audio = chamber._audioSchedule.observe(last);
    return {
      visualId: visual?.id,
      engine: visual?.cue?.collections?.[0],
      cueTheme: visual?.cue?.colorTheme,
      sessionTheme: chamber.session.presentation?.colorTheme,
      audioId: audio?.bed?.cue?.soundscapeId,
      color: chamber.container.style.getPropertyValue('--color-accent').trim()
    };
  });
  expect(result).toEqual({
    visualId: 'jev-finale', engine: 'ostensoria',
    cueTheme: 'jade', sessionTheme: 'jade',
    audioId: 'faded-signal', color: jevPalette('jade').accent
  });
});
