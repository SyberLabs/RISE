import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { jevPalette } from '../core/jev-palette.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';

/** A disclosed preset using the same allowed choices and released-source gate as live Jev. */
export function sampleJevSceneDecision() {
  const released = releaseInventory.middlemarch;
  const selectors = {
    section: 'first', wpm: 200, curve: 'flat', chunkMode: 'word',
    audio: 'silent', visualMode: 'interlocution', visualStyle: 'immersive',
    middleAudio: 'aurora', finaleAudio: 'faded-signal',
    visualEngine: 'klee', middleEngine: 'harmonograph', finaleEngine: 'ostensoria',
    visualPalette: 'white', visualArc: 'dual', arcSplit: '50',
    kleePreset: 'harmonic', galleryCadence: 'balanced',
    chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic',
    middleTheme: 'amethyst', finaleTheme: 'prism',
    wordFill: 'plain', projection: 'stream', revealMode: 'instant'
  };
  return {
    workId: released.workId,
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    config: {
      ...selectors,
      colors: jevPalette(selectors.colorTheme),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors),
      audioProgram: compileJevAudioProgram(selectors)
    }
  };
}
