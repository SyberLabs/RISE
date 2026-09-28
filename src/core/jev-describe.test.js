import { describe, expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../content/modern-readings-manifest.json' with { type: 'json' };
import { validateJevRecommendation } from '../app/jev-reading.js';
import { resolveJevChamberConfig } from './jev-config.js';
import { jevColors } from './jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';
import {
  JEV_ADJUSTMENTS,
  adjustJevDecision,
  currentJevAdjustment,
  describeJevPlan,
  jevReleasedWorkIds,
  namesWork,
  readJevRequest
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

describe('describeJevPlan', () => {
  it('describes the live Tokyo Drift plan in words that match its values', () => {
    const rows = describeJevPlan(decision().config);
    expect(rows.map(row => row.label)).toEqual(['Colors', 'Motion', 'Pace & sound', 'Text']);
    expect(rows[0]).toMatchObject({ value: 'Neon night', detail: 'magenta light, lilac text on dark purple' });
    expect(rows[1].value).toBe('Fast, flowing fractal light');
    expect(rows[1].detail).toBe('a new scene about every 10 seconds, in 3 changing phases');
    expect(rows[2]).toMatchObject({ value: 'Fast: 300 words a minute', detail: 'with an energetic chase theme' });
    expect(rows[3]).toMatchObject({ value: 'Japanese serif, large', detail: 'short phrases' });
  });

  it('says plainly when a plan has no motion or is a page', () => {
    const dark = describeJevPlan(decision({ visualMode: 'off', visualStyle: 'quiet', visualArc: 'single', projection: 'page', audio: 'silent' }).config);
    expect(dark[1].value).toBe('No motion in page view');
    expect(dark[2]).toMatchObject({ value: 'Your own pace', detail: 'with no sound' });
  });

  it('names every sound phase when the sound changes partway', () => {
    const phased = decision({ audio: 'silent', middleAudio: 'silent', finaleAudio: 'triumph', visualArc: 'dual', arcSplit: '70', visualStyle: 'immersive', visualEngine: 'klee', finaleEngine: 'apparitio' }).config;
    expect(describeJevPlan(phased)[2].detail).toBe('with no sound, then a triumphant theme');
    expect(describeJevPlan(decision().config)[2].detail).toBe('with an energetic chase theme');
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

  it('knows whether the reader named the chosen text', () => {
    expect(namesWork('read me the iliad, fast', { title: 'The Iliad', author: 'Homer' })).toBe(true);
    expect(namesWork('tokyo drift', { title: 'Ulysses', author: 'James Joyce' })).toBe(false);
  });
});

describe('adjustJevDecision', () => {
  it('produces plans the reader admits exactly like a Jev answer, for every option', () => {
    for (const [kind, options] of Object.entries(JEV_ADJUSTMENTS)) {
      for (const value of Object.keys(options)) {
        for (const base of [decision(), decision({ visualStyle: 'gentle', visualMode: 'off', visualArc: 'single', projection: 'page', colorTheme: 'classic', textColor: 'classic', backgroundColor: 'classic' }, 'the-iliad')]) {
          const next = adjustJevDecision(base, kind, value);
          expect(() => validateJevRecommendation(next), `${kind}:${value}`).not.toThrow();
          expect(currentJevAdjustment(next.config, kind), `${kind}:${value}`).toBe(value);
        }
      }
    }
  });

  it('keeps fast motion when the reader recolors a psychedelic plan', () => {
    const next = adjustJevDecision(decision(), 'colors', 'ember');
    expect(next.config.presentation.colorTheme).toBe('ember');
    expect(next.config.visualStyle).toBe('immersive');
    expect(next.config.visualConfig.interlocution).toMatchObject({ procedural: ['fractal'], galleryCadence: 0.85 });
    expect(describeJevPlan(next.config)[1].value).toBe('Fast, flowing fractal light');
  });

  it('turns a dark page into a moving stream when the reader raises the energy', () => {
    const page = decision({ visualStyle: 'quiet', visualMode: 'off', visualArc: 'single', projection: 'page' });
    const next = adjustJevDecision(page, 'energy', 'intense');
    expect(next.config.projection).toBe('stream');
    expect(next.config.visualConfig.visualMode).toBe('interlocution');
  });

  it('changes the text only among released editions, without touching presentation', () => {
    expect(jevReleasedWorkIds()).toHaveLength(15 + Object.keys(modernManifest).length);
    const next = adjustJevDecision(decision(), 'workId', 'the-iliad');
    expect(next).toMatchObject({ workId: 'the-iliad', editionId: releaseInventory['the-iliad'].editionId });
    expect(next.config).toEqual(decision().config);
    expect(() => validateJevRecommendation(next)).not.toThrow();
    expect(() => adjustJevDecision(decision(), 'workId', 'a-doll-s-house')).toThrow(/not available/);
  });

  it('lets the reader pick a released RISE original, which RISE can still open', () => {
    const original = modernManifest['the-prompt-and-the-pencil'];
    const next = adjustJevDecision(decision(), 'workId', original.workId);
    expect(next).toMatchObject({ workId: original.workId, editionId: original.editionId, sourceRevision: original.sourceRevision });
    expect(() => validateJevRecommendation(next)).not.toThrow();
  });
});
