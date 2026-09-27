import { test, expect } from './fixtures.js';
import releaseInventory from '../src/content/archive/release-inventory.json' with { type: 'json' };
import { jevPalette } from '../src/core/jev-palette.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

const GATE_SESSION = { code: 'rise2025', name: 'Jev Sequence Test', vault: null, timestamp: Date.now() };

test('one Jev plan carries a late visual and soundscape phase into the Chamber', async ({ page }) => {
  const released = releaseInventory['literary-walden'];
  const choices = {
    section: 'shortest', wpm: 300, curve: 'flat', chunkMode: 'phrase',
    audio: 'aurora', middleAudio: 'silent', finaleAudio: 'faded-signal',
    visualMode: 'interlocution', visualStyle: 'psychedelic',
    visualEngine: 'fractal', middleEngine: 'harmonograph', finaleEngine: 'ostensoria',
    visualArc: 'triple', arcSplit: '70',
    colorTheme: 'prism', middleTheme: 'ember', finaleTheme: 'jade',
    visualPalette: 'purple', kleePreset: 'chaotic', galleryCadence: 'lively',
    chamberFace: 'thick', fontSize: 'large', wordFill: 'accent',
    projection: 'stream', revealMode: 'instant'
  };
  const config = {
    ...choices,
    colors: jevPalette(choices.colorTheme),
    ...resolveJevChamberConfig(choices),
    visualProgram: compileJevVisualProgram(choices),
    audioProgram: compileJevAudioProgram(choices)
  };
  let calls = 0;
  await page.route('**/api/jev-recommend', route => {
    calls += 1;
    return route.fulfill({ json: {
      schemaVersion: 1, requestId: 'jev-sequence-browser', model: 'typesafe/jev-1.13',
      workId: released.workId, editionId: released.editionId,
      sourceRevision: released.sourceRevision, reason: 'A released reading.', config
    } });
  });
  await page.addInitScript(gate => {
    localStorage.setItem('rise-beta-session', JSON.stringify(gate));
  }, GATE_SESSION);
  await page.goto('/');
  await page.locator('#portal-jev-intent').fill('Give me a visual journey through this reading.');
  await page.locator('.portal-jev-submit').click();
  await expect(page.locator('#chamber-continuous-field')).toBeVisible({ timeout: 30_000 });
  expect(calls).toBe(1);

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
