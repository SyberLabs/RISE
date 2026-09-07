import { describe, expect, it } from 'vitest';
import { CANON_IDS } from './archive/canon.js';
import DIVISION_INDEX from './archive/division-index.json' with { type: 'json' };
import {
  BRANDING_LIVERIES,
  BRANDING_LIVERY_IDS,
  BRANDING_MAX_WORDS,
  BRANDING_MIN_WORDS,
  BRANDING_PLATE_TIMING,
  BRANDING_REELS,
  BRANDING_SHORT_MAX_WORDS,
  BRANDING_SHORT_MIN_WORDS,
  brandingPresentation,
  brandingProgram,
  brandingSource,
  brandingVisualFamily,
  brandingWordWindow,
  clipToReadingWindow,
  gatherReading
} from './branding-reels.js';
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
  it('pairs every reel with a distinct passage and a known livery', () => {
    expect(BRANDING_REELS.length).toBeGreaterThanOrEqual(36);
    const ids = BRANDING_REELS.map(reel => reel.id);
    expect(new Set(ids).size).toBe(ids.length);
    const texts = BRANDING_REELS.map(reel => `${reel.workId}::${reel.division}`);
    expect(new Set(texts).size).toBe(texts.length);
    for (const reel of BRANDING_REELS) {
      expect(CANON_IDS.has(reel.workId), reel.workId).toBe(true);
      const labels = DIVISION_INDEX[reel.workId]?.labels || [];
      expect(labels, `${reel.id}: ${reel.division}`).toContain(reel.division);
      expect(['aurora', 'faded-signal']).toContain(reel.soundscape);
      expect(BRANDING_LIVERY_IDS, reel.id).toContain(reel.livery);
      expect(['short', 'standard'], reel.id).toContain(reel.length);
    }
  });

  it('uses all three liveries and both lengths so the batch has range', () => {
    for (const livery of BRANDING_LIVERY_IDS) {
      expect(BRANDING_REELS.some(reel => reel.livery === livery), livery).toBe(true);
    }
    expect(BRANDING_REELS.some(reel => reel.length === 'short')).toBe(true);
    expect(BRANDING_REELS.some(reel => reel.length === 'standard')).toBe(true);
  });

  it('covers procedural fields, attractors, and CC0 collections', () => {
    const kinds = new Set(BRANDING_REELS.map(reel => reel.visual.kind));
    expect(kinds.has('procedural')).toBe(true);
    expect(kinds.has('field')).toBe(true);
    expect(kinds.has('sourced')).toBe(true);
    expect(BRANDING_REELS.some(reel => reel.visual.collections?.includes('aic-landscapes'))).toBe(true);
    expect(BRANDING_REELS.some(reel => reel.visual.collections?.includes('sci-astronomy'))).toBe(true);
  });

  it('reaches every plate surface, so no engine ships untested by the slate', () => {
    const families = new Set(BRANDING_REELS.map(reel => brandingVisualFamily(reel.visual)));
    for (const family of Object.keys(BRANDING_PLATE_TIMING)) {
      expect(families, family).toContain(family);
    }
  });
});

describe('brandingPresentation', () => {
  it('gives every plate surface a cadence, so no take is one frozen still', () => {
    for (const reel of BRANDING_REELS) {
      const family = brandingVisualFamily(reel.visual);
      if (family === 'attractor' || family === 'sourced') continue;
      const { drawMs, holdMs, dissolveMs } = brandingPresentation(reel);
      expect(drawMs, reel.id).toBeGreaterThan(0);
      expect(holdMs, reel.id).toBeGreaterThanOrEqual(0);
      // A plate must be fully faded in well before its own episode ends.
      expect(dissolveMs, reel.id).toBeLessThan(drawMs);
    }
  });

  it('carries the reel livery and lets framing override the family default', () => {
    const covered = BRANDING_REELS.find(reel => reel.framing?.fit === 'cover');
    expect(brandingPresentation(covered).fit).toBe('cover');
    expect(BRANDING_PLATE_TIMING.sourced.fit).toBe('plate');
    const matted = BRANDING_REELS.find(reel =>
      reel.visual.kind === 'sourced' && !reel.framing);
    expect(brandingPresentation(matted).fit).toBe('plate');
    const glass = BRANDING_REELS.find(reel => reel.livery === 'glass');
    expect(brandingPresentation(glass).caption).toBe(BRANDING_LIVERIES.glass);
    expect(resolveCaptionStyle(BRANDING_LIVERIES.glass).glass).toBe(true);
    expect(resolveCaptionStyle(BRANDING_LIVERIES.ink).edgeColor).toBeNull();
    expect(resolveCaptionStyle(BRANDING_LIVERIES.signal).edgeColor).toBe('#1A140C');
  });

  it('reads a short reel in about twenty seconds and a standard one in about forty-five', () => {
    expect(brandingWordWindow({ length: 'short' }))
      .toEqual({ minWords: BRANDING_SHORT_MIN_WORDS, maxWords: BRANDING_SHORT_MAX_WORDS });
    expect(brandingWordWindow({ length: 'standard' }))
      .toEqual({ minWords: BRANDING_MIN_WORDS, maxWords: BRANDING_MAX_WORDS });
    expect(BRANDING_SHORT_MAX_WORDS).toBeLessThan(BRANDING_MIN_WORDS);
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
    expect(classifyCue(hit.cue, 'visual')).toBe('visual:procedural:klee');
  });
});
