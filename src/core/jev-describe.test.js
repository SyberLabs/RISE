import { describe, expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../content/modern-readings-manifest.json' with { type: 'json' };
import { resolveJevChamberConfig } from './jev-config.js';
import { jevColors } from './jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';
import {
  isRiseOriginal,
  jevReleasedEdition,
  jevReleasedWorkIds,
  readJevRequest,
  summarizeJevPlan
} from './jev-describe.js';

function decision(overrides = {}, workId = 'ulysses') {
  const selectors = {
    section: 'first', wpm: 300, curve: 'wave', chunkMode: 'phrase',
    audio: 'chase', visualMode: 'interlocution', visualStyle: 'psychedelic',
    visualEngine: 'fractal', visualArc: 'triple', arcSplit: '30',
    middleEngine: 'fractal', finaleEngine: 'fractal', middleTheme: 'prism', finaleTheme: 'prism',
    middleAudio: 'chase', finaleAudio: 'chase', visualPalette: 'purple', kleePreset: 'chaotic',
    galleryCadence: 'lively', chamberFace: 'jp', fontSize: 'large', colorTheme: 'prism',
    textColor: 'amethyst', backgroundColor: 'prism', wordFill: 'accent',
    projection: 'stream', revealMode: 'instant', ...overrides
  };
  const released = releaseInventory[workId];
  return {
    schemaVersion: 2, requestId: 'gen-dec-test', model: 'typesafe/jev-1.13',
    workId: released.workId, editionId: released.editionId, sourceRevision: released.sourceRevision,
    reason: 'An experimental day-long journey through Dublin and consciousness.',
    config: {
      ...selectors,
      colors: jevColors(selectors.colorTheme, selectors.textColor, selectors.backgroundColor),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors),
      audioProgram: compileJevAudioProgram(selectors)
    }
  };
}


describe('summarizeJevPlan', () => {
  it('says the live Tokyo Drift plan in four parts that match its values', () => {
    expect(summarizeJevPlan(decision().config)).toEqual(
      ['fast phrases', 'fractal light', 'chase', 'large japanese serif']);
  });

  it('says plainly when a plan has no imagery, no sound, or is a page', () => {
    const quiet = decision({ visualMode: 'off', visualStyle: 'quiet', audio: 'silent',
      middleAudio: 'silent', finaleAudio: 'silent', visualArc: 'single', fontSize: 'medium',
      chunkMode: 'sentence', wpm: 150 }).config;
    expect(summarizeJevPlan(quiet)).toEqual(['slow sentences', 'no imagery', 'silence', 'japanese serif']);
    const page = decision({ visualMode: 'off', visualStyle: 'quiet', visualArc: 'single', projection: 'page' }).config;
    expect(summarizeJevPlan(page)[1]).toBe('no motion');
  });
});

describe('readJevRequest', () => {
  it('treats Tokyo Drift as a style reference and names what RISE cannot show', () => {
    for (const intent of ['i want something psychedelic fast tokyo drift style', 'tokyo drift', 'Tokyo  Drift!']) {
      const { reference, limits } = readJevRequest(intent);
      expect(reference).toMatchObject({ name: 'Tokyo Drift', kind: 'film' });
      expect(limits).toEqual([
        'play the Tokyo Drift soundtrack or show footage from it',
        'show cars or racing',
        'show real places such as Tokyo'
      ]);
    }
  });

  it('adds nothing for an ordinary reading request', () => {
    expect(readJevRequest('Something reflective and slow')).toEqual({ reference: null, limits: [] });
  });

});

describe('the released editions a reading may use', () => {
  it('are the released classics and the RISE originals, nothing else', () => {
    expect(jevReleasedWorkIds()).toHaveLength(15 + Object.keys(modernManifest).length);
    expect(jevReleasedEdition('the-iliad')).toMatchObject({ workId: 'the-iliad', editionId: releaseInventory['the-iliad'].editionId });
    expect(jevReleasedEdition('a-doll-s-house')).toBeNull();
  });

  it('include a RISE original under its own edition', () => {
    const original = modernManifest['the-prompt-and-the-pencil'];
    expect(jevReleasedEdition(original.workId)).toMatchObject({ editionId: original.editionId, sourceRevision: original.sourceRevision });
  });

  it('tell a RISE original by its edition', () => {
    expect(isRiseOriginal('the-prompt-and-the-pencil')).toBe(true);
    expect(isRiseOriginal('the-iliad')).toBe(false);
    expect(isRiseOriginal('a-doll-s-house')).toBe(false);
    const originals = jevReleasedWorkIds().filter(isRiseOriginal);
    expect(originals).toEqual(Object.keys(modernManifest));
  });
});
