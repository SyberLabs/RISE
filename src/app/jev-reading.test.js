import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextById } from '../content/library.js';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../content/modern-readings-manifest.json' with { type: 'json' };
import { MODERN_READINGS } from '../content/modern-readings.js';
import { jevColors, jevPalette } from '../core/jev-palette.js';
import {
  compileJevAudioProgram,
  compileJevVisualProgram
} from '../core/jev-sequence.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { JEV_COLOR_THEMES } from '../core/jev-color-themes.js';
import { openingLines, openingOf, resolveJevReading, selectJevDivision, validateJevRecommendation } from './jev-reading.js';
import { divideSections } from '../content/archive/divisions.js';

vi.mock('../content/library.js', () => ({ getTextById: vi.fn() }));

const released = releaseInventory.middlemarch;
const divisions = {
  divided: true,
  noun: 'Chapter',
  entries: [
    { id: 0, label: 'Chapter I', content: 'The first source text.', words: 4 },
    { id: 1, label: 'Chapter II', content: 'A shorter passage.', words: 3 },
    { id: 2, label: 'Chapter III', content: 'The longest existing passage.', words: 5 }
  ]
};

function decision(config = {}) {
  const selectors = {
    section: 'first', wpm: 200, curve: 'flat', chunkMode: 'phrase',
    audio: 'aurora', visualMode: 'focals', projection: 'stream',
    revealMode: 'instant', visualEngine: 'fractal', visualPalette: 'purple',
    visualArc: 'single', arcSplit: '50', middleEngine: 'harmonograph',
    finaleEngine: 'ostensoria', middleAudio: 'aurora', finaleAudio: 'faded-signal',
    kleePreset: 'chaotic', galleryCadence: 'balanced',
    visualStyle: 'gentle', chamberFace: 'literary', fontSize: 'medium',
    wordFill: 'plain', colorTheme: 'classic', textColor: 'classic',
    backgroundColor: 'classic', middleTheme: 'amethyst',
    finaleTheme: 'prism', ...config
  };
  return {
    schemaVersion: 2,
    requestId: 'test-decision',
    model: 'typesafe/jev-1.13',
    reason: 'A reviewed catalog description.',
    workId: released.workId,
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    text: 'Model-supplied prose must never reach the reading.',
    config: {
      ...selectors,
      colors: jevColors(selectors.colorTheme, selectors.textColor, selectors.backgroundColor),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors),
      audioProgram: compileJevAudioProgram(selectors)
    }
  };
}

beforeEach(() => {
  vi.mocked(getTextById).mockReset();
  vi.mocked(getTextById).mockReturnValue({
    id: released.workId,
    workId: released.workId,
    provider: 'archive-ingest',
    title: 'Middlemarch',
    editionId: released.editionId,
    sourceRevision: released.sourceRevision,
    provenance: { editionId: released.editionId },
    getDivisions: vi.fn(async () => divisions)
  });
});

describe('Jev reading handoff', () => {
  it('opens the exact original reading shipped with this release', async () => {
    const reading = MODERN_READINGS[0];
    const edition = modernManifest[reading.id];
    vi.mocked(getTextById).mockReturnValue({
      id: reading.id, workId: reading.id, provider: 'rise-original',
      title: reading.title, editionId: edition.editionId,
      sourceRevision: edition.sourceRevision,
      provenance: { basis: 'rise-original' },
      getDivisions: async () => ({ divided: false, noun: 'reading', entries: [{
        id: reading.id, label: reading.title, content: reading.content,
        words: reading.content.trim().split(/\s+/u).length
      }] })
    });
    const originalDecision = { ...decision(), workId: reading.id,
      editionId: edition.editionId, sourceRevision: edition.sourceRevision };
    expect((await resolveJevReading(originalDecision)).text).toBe(reading.content);
    await expect(resolveJevReading({ ...originalDecision,
      sourceRevision: `sha256:${'0'.repeat(64)}` })).rejects.toThrow('not available');
  });
  it('admits Soft Rain as a local soundscape', async () => {
    const input = await resolveJevReading(decision({ audio: 'soft-rain' }));
    expect(input.soundscape).toBe('soft-rain');
    expect(input.audioPreset).toBe('silent');
  });

  it('selects the exact released source and maps enums to Chamber input', async () => {
    const input = await resolveJevReading(decision());
    expect(input.text).toBe('The first source text.');
    expect(input.textSource).toBe('Middlemarch · Chapter I');
    expect(input.origin).toEqual({ view: 'home', icon: '✧', name: 'Home', experience: 'jev' });
    expect(input).toMatchObject({
      wpm: 200, curve: 'flat', chunkMode: 'phrase',
      audioPreset: 'silent', soundscape: 'aurora',
      projection: 'stream', revealMode: 'instant',
      visualConfig: { visualMode: 'focals' },
      presentation: {
        chamberFace: 'literary', fontSize: 'medium',
        colorTheme: 'classic', colors: jevPalette('classic')
      },
      continuation: {
        workId: released.workId, editionId: released.editionId,
        sourceRevision: released.sourceRevision, entryId: '0',
        entryIndex: 0, entryCount: 3, noun: 'chapter'
      }
    });
  });

  it('admits every shipped color theme in every color choice', () => {
    for (const id of JEV_COLOR_THEMES) {
      for (const key of ['colorTheme', 'textColor', 'backgroundColor', 'middleTheme', 'finaleTheme']) {
        expect(() => validateJevRecommendation(decision({ [key]: id })), `${key} ${id}`).not.toThrow();
      }
    }
  });

  it('rejects unknown options and changed edition identity', async () => {
    await expect(resolveJevReading({ ...decision(), schemaVersion: 1 }))
      .rejects.toThrow('invalid reading plan');
    await expect(resolveJevReading(decision({ chunkMode: 'script' })))
      .rejects.toThrow('invalid reading plan');
    for (const audio of ['focus', 'deep', 'gateway']) {
      await expect(resolveJevReading(decision({ audio })))
      .rejects.toThrow('invalid reading plan');
    }
    for (const visualArc of ['quad', ''] ) {
      await expect(resolveJevReading(decision({ visualArc })))
        .rejects.toThrow('invalid reading plan');
    }
    for (const arcSplit of ['20', '40', '60', '80']) {
      await expect(resolveJevReading(decision({ arcSplit })))
        .rejects.toThrow('invalid reading plan');
    }
    for (const engineKey of ['middleEngine', 'finaleEngine']) {
      await expect(resolveJevReading(decision({ [engineKey]: 'unknown' })))
        .rejects.toThrow('invalid reading plan');
    }
    for (const audioKey of ['middleAudio', 'finaleAudio']) {
      await expect(resolveJevReading(decision({ [audioKey]: 'unknown' })))
        .rejects.toThrow('invalid reading plan');
    }
    for (const themeKey of ['middleTheme', 'finaleTheme']) {
      await expect(resolveJevReading(decision({ [themeKey]: 'unknown' })))
        .rejects.toThrow('invalid reading plan');
    }
    await expect(resolveJevReading({ ...decision(), sourceRevision: 'other' }))
      .rejects.toThrow('not available');
    const tampered = decision();
    tampered.config.colors = { ...jevPalette('classic'), accent: '#000000' };
    await expect(resolveJevReading(tampered))
      .rejects.toThrow('invalid reading plan');
    const tamperedVisual = decision();
    tamperedVisual.config.visualConfig = { visualMode: 'off' };
    await expect(resolveJevReading(tamperedVisual))
      .rejects.toThrow('invalid reading plan');
  });

  it('opens a vivid nonflashing Gallery in Stream', async () => {
    const input = await resolveJevReading(decision({
      visualStyle: 'psychedelic', visualMode: 'interlocution', visualEngine: 'fractal',
      galleryCadence: 'lively', colorTheme: 'prism', textColor: 'prism',
      backgroundColor: 'prism',
      projection: 'stream', wordFill: 'accent', chamberFace: 'thick'
    }));
    expect(input.projection).toBe('stream');
    expect(input.visualConfig).toMatchObject({
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural', procedural: ['fractal'], sourced: [],
        presentation: 'continuous', galleryCadence: 0.85,
        wordFill: { mode: 'accent' }
      }
    });
    expect(input.presentation.colors).toEqual(jevColors('prism', 'prism', 'prism'));
  });

  it('attaches the validated helper-derived visual program', async () => {
    const input = await resolveJevReading(decision({ visualArc: 'triple', arcSplit: '70' }));
    const expected = decision({ visualArc: 'triple', arcSplit: '70' }).config;
    expect(input.visualProgram).toEqual(compileJevVisualProgram(expected));
    expect(input.audioProgram).toEqual(compileJevAudioProgram(expected));
    expect((await resolveJevReading(decision())).visualProgram).toBeNull();

    const dual = await resolveJevReading(decision({ visualArc: 'dual', arcSplit: '70' }));
    expect(dual.visualProgram.segments.map(segment => segment.match.toProgress))
      .toEqual([0.7, 1]);

    const missing = decision();
    delete missing.config.visualProgram;
    await expect(resolveJevReading(missing)).rejects.toThrow('invalid reading plan');

    const missingAudio = decision({ visualArc: 'triple', arcSplit: '70' });
    delete missingAudio.config.audioProgram;
    await expect(resolveJevReading(missingAudio)).rejects.toThrow('invalid reading plan');
  });

  it('chooses a real division using the section enum', () => {
    expect(selectJevDivision(divisions, 'shortest').entry.id).toBe(1);
    expect(selectJevDivision(divisions, 'longest').entry.id).toBe(2);
    expect(selectJevDivision(divisions, 'middle').entry.id).toBe(1);
    expect(selectJevDivision(divisions, 'last').entry.id).toBe(2);
  });

  it('hands a mood sound and a real later chapter to the Chamber', async () => {
    const input = await resolveJevReading(decision({ section: 'last', audio: 'scary' }));
    expect(input.text).toBe('The longest existing passage.');
    expect(input.soundscape).toBe('scary');
    expect(input.continuation.entryId).toBe('2');
  });
});

describe('the opening of a passage', () => {
  it('keeps verse lines and drops leading blank lines', () => {
    expect(openingOf('\n  \nSing, goddess, the wrath\nof Achilles, son of Peleus,\nthat brought the Greeks their woes.')).toBe(
      'Sing, goddess, the wrath\nof Achilles, son of Peleus,\nthat brought the Greeks their woes.');
  });

  it('cuts at the last line break or sentence end that fits, with no ellipsis', () => {
    expect(openingOf('Line one,\nline two,\nline three.', 15)).toBe('Line one,');
    expect(openingOf('One two. Three four five six.', 20)).toBe('One two.');
    expect(openingOf('“Go home.” She went away. And then', 14)).toBe('“Go home.”');
    expect(openingOf('It was so. Then Mr. Casaubon and Mrs. Cadwallader came in', 50)).toBe('It was so.');
    expect(openingOf('Short and done.', 15)).toBe('Short and done.');
  });

  it('cuts between words and ends with an ellipsis when no sentence or line ends in reach', () => {
    expect(openingOf('alpha beta gamma delta', 12)).toBe('alpha beta…');
    const preview = openingOf('word '.repeat(200));
    expect(preview.length).toBeLessThanOrEqual(240);
    expect(preview).toMatch(/ word…$/u);
  });
});

describe('the opening lines of a reading', () => {
  it('opens the same division the reading opens, for every section', async () => {
    for (const section of ['first', 'middle', 'last', 'shortest', 'longest']) {
      const reading = await resolveJevReading(decision({ section }));
      const { words } = divisions.entries.find(entry => entry.content === reading.text);
      expect(await openingLines(decision({ section })))
        .toEqual({ text: reading.text, verse: reading.verseLines, words });
    }
  });

  it('counts the division’s words, so Home can say how long it takes', async () => {
    expect((await openingLines(decision({ section: 'shortest' }))).words).toBe(3);
  });

  it('says whether that division is verse, so the Chamber reads it by line', async () => {
    const opening = async workId => {
      const { editionId, sourceRevision } = releaseInventory[workId];
      const module = await import(`../content/archive/works/${workId}.js`);
      const sections = Object.values(module).find(Array.isArray);
      vi.mocked(getTextById).mockReturnValue({
        id: workId, workId, provider: 'archive-ingest', editionId, sourceRevision,
        getDivisions: async () => divideSections(sections, { declared: true })
      });
      return openingLines({ ...decision(), workId, editionId, sourceRevision });
    };
    expect((await opening('spoon-river-anthology')).verse).toBe(true);
    expect((await opening('oedipus-rex')).verse).toBe(true);
    const prose = await opening('middlemarch');
    expect(prose.verse).toBe(false);
    expect(prose.text.length).toBeGreaterThan(0);
    expect(prose.text.length).toBeLessThanOrEqual(240);
  });

  it('refuses what the reading refuses, in the same words', async () => {
    await expect(openingLines({ ...decision(), schemaVersion: 1 }))
      .rejects.toThrow('invalid reading plan');
    await expect(openingLines({ ...decision(), sourceRevision: 'other' }))
      .rejects.toThrow('not available');
  });
});
