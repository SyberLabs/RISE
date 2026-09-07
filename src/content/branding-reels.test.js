import { describe, expect, it } from 'vitest';
import { CANON_IDS } from './archive/canon.js';
import DIVISION_INDEX from './archive/division-index.json' with { type: 'json' };
import {
  BRANDING_CAPTION,
  BRANDING_DRAW_MS,
  BRANDING_HOLD_MS,
  BRANDING_MAX_WORDS,
  BRANDING_MIN_WORDS,
  BRANDING_REELS,
  brandingProgram,
  brandingSource,
  clipToReadingWindow,
  gatherReading
} from './branding-reels.js';
import {
  figureEpisodeAt,
  figureEpisodeSeed,
  scoredFigureProgress
} from '../core/visual-presence.js';
import { lowerExperienceProgram } from '../core/experience-program.js';
import { cueForAtom } from '../core/visual-scheduler.js';
import { classifyCue } from '../core/render/support.js';
import { resolveCaptionStyle } from '../core/render/caption-style.js';

describe('clipToReadingWindow', () => {
  it('cuts a long passage at a sentence so a social clip stays 90–130 words', () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `This is sentence number ${i} with extra padding words here.`
    );
    const text = sentences.join(' ');
    const clipped = clipToReadingWindow(text);
    const count = clipped.split(/\s+/).filter(Boolean).length;
    expect(count).toBeGreaterThanOrEqual(BRANDING_MIN_WORDS);
    expect(count).toBeLessThanOrEqual(BRANDING_MAX_WORDS);
    expect(clipped.endsWith('.')).toBe(true);
  });

  it('keeps a short passage intact', () => {
    const text = 'Begin the morning by saying to thyself.';
    expect(clipToReadingWindow(text)).toBe(text);
  });

  it('hard-caps a single long sentence so social duration cannot blow out', () => {
    const text = `${Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')}.`;
    const clipped = clipToReadingWindow(text);
    expect(clipped.split(/\s+/).filter(Boolean).length).toBe(BRANDING_MAX_WORDS);
  });

  it('joins following short divisions until the window is full, then clips', () => {
    const entries = [
      { content: 'One two three four five.' },
      { content: Array.from({ length: 40 }, () => 'word').join(' ') + '.' },
      { content: Array.from({ length: 80 }, () => 'rest').join(' ') + '.' }
    ];
    const gathered = gatherReading(entries, 0);
    const count = gathered.split(/\s+/).filter(Boolean).length;
    expect(count).toBeGreaterThanOrEqual(BRANDING_MIN_WORDS);
    expect(count).toBeLessThanOrEqual(BRANDING_MAX_WORDS);
    expect(gathered.startsWith('One two three')).toBe(true);
  });
});

describe('BRANDING_REELS', () => {
  it('is thirty unique canon pairings, each a different text and a different visual', () => {
    expect(BRANDING_REELS).toHaveLength(30);
    const ids = BRANDING_REELS.map(reel => reel.id);
    expect(new Set(ids).size).toBe(30);
    const texts = BRANDING_REELS.map(reel => `${reel.workId}::${reel.division}`);
    expect(new Set(texts).size).toBe(30);
    const visuals = BRANDING_REELS.map(reel => JSON.stringify(reel.visual));
    expect(new Set(visuals).size).toBe(30);
    for (const reel of BRANDING_REELS) {
      expect(CANON_IDS.has(reel.workId), reel.workId).toBe(true);
      const labels = DIVISION_INDEX[reel.workId]?.labels || [];
      expect(labels, reel.division).toContain(reel.division);
      expect(['aurora', 'faded-signal']).toContain(reel.soundscape);
    }
  });

  it('covers procedural fields, attractors, and CC0 collections', () => {
    const kinds = new Set(BRANDING_REELS.map(reel => reel.visual.kind));
    expect(kinds.has('procedural')).toBe(true);
    expect(kinds.has('field')).toBe(true);
    expect(kinds.has('sourced')).toBe(true);
    expect(BRANDING_REELS.some(reel => reel.visual.collections?.includes('aic-landscapes'))).toBe(true);
    expect(BRANDING_REELS.some(reel => reel.visual.collections?.includes('sci-astronomy'))).toBe(true);
  });
});

describe('BRANDING_DRAW_MS', () => {
  it('finishes the branding figure in two seconds even on a long take', () => {
    expect(BRANDING_DRAW_MS).toBe(2000);
    expect(scoredFigureProgress(0, 48_000, BRANDING_DRAW_MS)).toBe(0);
    expect(scoredFigureProgress(BRANDING_DRAW_MS, 48_000, BRANDING_DRAW_MS)).toBe(1);
    expect(scoredFigureProgress(1_000, 48_000, BRANDING_DRAW_MS)).toBeLessThan(1);
    expect(scoredFigureProgress(BRANDING_DRAW_MS, 48_000)).toBeLessThan(0.2);
  });

  it('holds the completed figure briefly, then starts a new seed', () => {
    expect(BRANDING_HOLD_MS).toBe(1200);
    const episodeMs = BRANDING_DRAW_MS + BRANDING_HOLD_MS;

    const opening = figureEpisodeAt(0, BRANDING_DRAW_MS, BRANDING_HOLD_MS);
    expect(opening.index).toBe(0);
    expect(opening.elapsedMs).toBe(0);
    expect(figureEpisodeSeed('take', opening.index)).toBe('take');

    const justDrawn = figureEpisodeAt(BRANDING_DRAW_MS, BRANDING_DRAW_MS, BRANDING_HOLD_MS);
    expect(justDrawn.index).toBe(0);
    expect(scoredFigureProgress(justDrawn.elapsedMs, 48_000, BRANDING_DRAW_MS)).toBe(1);

    const stillHeld = figureEpisodeAt(episodeMs - 1, BRANDING_DRAW_MS, BRANDING_HOLD_MS);
    expect(stillHeld.index).toBe(0);
    expect(scoredFigureProgress(stillHeld.elapsedMs, 48_000, BRANDING_DRAW_MS)).toBe(1);

    const next = figureEpisodeAt(episodeMs, BRANDING_DRAW_MS, BRANDING_HOLD_MS);
    expect(next.index).toBe(1);
    expect(next.elapsedMs).toBe(0);
    expect(scoredFigureProgress(next.elapsedMs, 48_000, BRANDING_DRAW_MS)).toBe(0);
    expect(figureEpisodeSeed('take', next.index)).toBe('take:figure:1');
    expect(figureEpisodeSeed('take', 2)).toBe('take:figure:2');
  });
});

describe('brandingProgram', () => {
  it('scores a caption-ready reading with one visual and one soundscape', () => {
    const reel = BRANDING_REELS[0];
    const program = brandingProgram(reel, 'source-1');
    expect(program.tracks.map(track => track.kind).sort())
      .toEqual(['audio', 'movement', 'reading', 'visual']);
    expect(program.tracks.find(track => track.kind === 'visual').clips[0].cue)
      .toEqual(reel.visual);
    expect(program.tracks.find(track => track.kind === 'audio').clips[0].cue.soundscapeId)
      .toBe(reel.soundscape);
    expect(BRANDING_CAPTION).toEqual({
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      fontSize: 64,
      color: '#F4C430',
      edgeColor: '#1A140C',
      position: { x: 0.5, y: 0.76 }
    });
    expect(resolveCaptionStyle(BRANDING_CAPTION).edgeColor).toBe('#1A140C');
  });

  it('anchors the visual cue to the source id so Chamber does not paint a still', () => {
    const reel = BRANDING_REELS[0];
    const source = brandingSource(reel, 'Begin the morning by saying to thyself.');
    const program = brandingProgram(reel, source.id);
    const lowered = lowerExperienceProgram(program);
    const hit = cueForAtom(lowered.visualProgram, {
      sourceId: source.id,
      sourceProgress: 0.4
    });
    expect(source.id).toBe(`branding-${reel.id}`);
    expect(classifyCue(hit.cue, 'visual')).toBe('visual:procedural:fractal');
  });
});
