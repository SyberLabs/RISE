import { expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { jevPalette } from '../core/jev-palette.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { compileJevVisualProgram } from '../core/jev-sequence.js';
import { resolveJevReading } from './jev-reading.js';
import { compileSession } from '../core/session-compiler.js';
import { cueForAtom } from '../core/visual-scheduler.js';

it('opens an existing playable division for every released book and section choice', async () => {
  for (const released of Object.values(releaseInventory)) {
    for (const section of ['first', 'shortest', 'longest']) {
      const selectors = {
        section, wpm: 200, curve: 'flat', chunkMode: 'phrase',
        audio: 'silent', visualMode: 'off', visualStyle: 'quiet',
        visualEngine: 'fractal', visualPalette: 'purple', kleePreset: 'random',
        visualArc: 'single', arcSplit: '50', middleEngine: 'harmonograph',
        finaleEngine: 'ostensoria',
        galleryCadence: 'balanced', chamberFace: 'literary', fontSize: 'medium',
        wordFill: 'plain', colorTheme: 'classic',
        projection: 'stream', revealMode: 'instant'
      };
      const input = await resolveJevReading({
        workId: released.workId,
        editionId: released.editionId,
        sourceRevision: released.sourceRevision,
        config: { ...selectors, colors: jevPalette('classic'),
          ...resolveJevChamberConfig(selectors),
          visualProgram: compileJevVisualProgram(selectors) }
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
    visualArc: 'triple', arcSplit: '70', middleEngine: 'harmonograph',
    finaleEngine: 'ostensoria',
    galleryCadence: 'lively', chamberFace: 'thick', fontSize: 'fit',
    wordFill: 'same', colorTheme: 'prism',
    projection: 'stream', revealMode: 'progressive'
  };
  const input = await resolveJevReading({
    workId: released.workId,
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    config: { ...selectors, colors: jevPalette('prism'),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors) }
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
  expect(session.soundscape).toBe('aurora');
  expect(session.visualProgram.segments.map(segment => segment.match.toProgress))
    .toEqual([0.3, 0.7, 1]);
  expect(cueForAtom(session.visualProgram, { sourceId: 'primary', sourceProgress: 0.2 }).cue.collections)
    .toEqual(['fractal']);
  expect(cueForAtom(session.visualProgram, { sourceId: 'primary', sourceProgress: 0.5 }).cue.collections)
    .toEqual(['harmonograph']);
  expect(cueForAtom(session.visualProgram, { sourceId: 'primary', sourceProgress: 0.8 }).cue.collections)
    .toEqual(['ostensoria']);
});
