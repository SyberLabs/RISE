import { expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { jevPalette } from '../core/jev-palette.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { resolveJevReading } from './jev-reading.js';
import { compileSession } from '../core/session-compiler.js';

it('opens an existing playable division for every released book and section choice', async () => {
  for (const released of Object.values(releaseInventory)) {
    for (const section of ['first', 'shortest', 'longest']) {
      const selectors = {
        section, wpm: 200, curve: 'flat', chunkMode: 'phrase',
        audio: 'silent', visualMode: 'off', visualStyle: 'quiet',
        visualEngine: 'fractal', visualPalette: 'purple', kleePreset: 'random',
        galleryCadence: 'balanced', chamberFace: 'literary', fontSize: 'medium',
        wordFill: 'plain', colorTheme: 'classic',
        projection: 'stream', revealMode: 'instant'
      };
      const input = await resolveJevReading({
        workId: released.workId,
        editionId: released.editionId,
        sourceRevision: released.sourceRevision,
        config: { ...selectors, colors: jevPalette('classic'),
          ...resolveJevChamberConfig(selectors) }
      });
      const session = compileSession({ ...input, title: input.textSource });
      expect(session.atoms.length, `${released.workId}:${section}`).toBeGreaterThan(0);
      expect(input.text).toBeTruthy();
    }
  }
});

it('compiles a psychedelic Jev plan into a visible, scoped Chamber session', async () => {
  const released = releaseInventory.middlemarch;
  const selectors = {
    section: 'first', wpm: 250, curve: 'wave', chunkMode: 'word',
    audio: 'aurora', visualMode: 'interlocution', visualStyle: 'psychedelic',
    visualEngine: 'fractal', visualPalette: 'purple', kleePreset: 'chaotic',
    galleryCadence: 'lively', chamberFace: 'thick', fontSize: 'fit',
    wordFill: 'same', colorTheme: 'prism',
    projection: 'stream', revealMode: 'progressive'
  };
  const input = await resolveJevReading({
    workId: released.workId,
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    config: { ...selectors, colors: jevPalette('prism'),
      ...resolveJevChamberConfig(selectors) }
  });
  const session = compileSession({ ...input, title: input.textSource });
  expect(session.atoms.length).toBeGreaterThan(0);
  expect(session.projection).toBe('stream');
  expect(session.visualConfig).toMatchObject({
    visualMode: 'interlocution',
    interlocution: {
      presentation: 'continuous', procedural: ['fractal'],
      galleryCadence: 0.85, wordFill: { mode: 'same' }
    }
  });
  expect(session.presentation).toMatchObject({
    chamberFace: 'thick', fontSize: 'fit', colorTheme: 'prism',
    colors: jevPalette('prism')
  });
});
