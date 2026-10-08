/**
 * SCR-002: a Current names one of the ten looks (owner, 2026-10-07: "all ten
 * looks properly and safely integrated"). The Worker learns only the ids; the
 * card lowers a look through its own field, typeface, size and theme.
 */
import { describe, expect, it } from 'vitest';
import { lowerCurrentLook } from './current-look.js';
import { LOOKS } from './looks.js';
import { compileRiseCurrent, RISE_CURRENT_LOOKS, RISE_CURRENT_THEMES, validateRiseCurrent } from './rise-current.js';
import { flameComposition } from './theme-engine-map.js';

const current = (patch = {}) => ({
  schema: 'rise.current.v1',
  id: 'looked',
  title: 'A look',
  origin: { kind: 'model', name: 'Explainer', provider: 'example-provider' },
  segments: [
    { id: 'named', text: 'This passage names its own visual.', visual: 'attractor' },
    { id: 'unnamed', text: 'This one leaves it to the look.' }
  ],
  ...patch
});

const compile = patch => compileRiseCurrent(current(patch), { lowerLook: lowerCurrentLook });
const visualTrack = session => session.experienceProgram.tracks.find(track => track.kind === 'visual');

describe('the looks a Current may name', () => {
  it('are the ten looks, by id, in their order', () => {
    expect(RISE_CURRENT_LOOKS).toEqual(LOOKS.map(look => look.id));
  });

  it('refuses a look it does not know', () => {
    expect(() => validateRiseCurrent(current({ look: 'disco' }))).toThrow(expect.objectContaining({ code: 'CURRENT_LOOK' }));
  });

  it('leaves an unnamed passage to the look, and still names a still passage without one', () => {
    expect(validateRiseCurrent(current({ look: 'revel' })).segments.map(segment => segment.visual)).toEqual(['attractor', undefined]);
    expect(validateRiseCurrent(current()).segments.map(segment => segment.visual)).toEqual(['attractor', 'still']);
  });
});

describe('a look in the card', () => {
  const GALLERY = { gallery: ['turrell'], nocturne: ['turrell', 'harmonograph'], iris: ['ostensoria', 'apparitio'], revel: ['fractal'], inlay: ['fractal'] };

  it.each(Object.entries(GALLERY))('%s draws its own Gallery engines behind every passage that names none', (id, engines) => {
    const session = compile({ look: id });
    expect(visualTrack(session).fallback).toEqual({ kind: 'procedural', collections: engines });
    expect(session.visualConfig.visualMode).toBe('interlocution');
    expect(session.visualConfig.interlocution).toMatchObject({ presentation: 'continuous', procedural: engines, sourced: [] });
    expect(session.visualConfig.interlocution.galleryCadence)
      .toBe(LOOKS.find(look => look.id === id).config.visualInterlocution.interlocution.galleryCadence);
  });

  it('draws the field looks as the Reader does, in the effective theme', () => {
    const theme = look => LOOKS.find(entry => entry.id === look).config.presentation.colorTheme;
    expect(visualTrack(compile({ look: 'plain' })).fallback).toEqual({ kind: 'still' });
    expect(visualTrack(compile({ look: 'garden' })).fallback)
      .toEqual({ kind: 'field', renderer: 'genesis', config: { ...RISE_CURRENT_THEMES[theme('garden')].genesis } });
    expect(visualTrack(compile({ look: 'signal' })).fallback)
      .toEqual({ kind: 'field', renderer: 'attractor', config: { ...RISE_CURRENT_THEMES[theme('signal')].attractor } });
    const flame = visualTrack(compile({ look: 'flame' })).fallback;
    expect(flame).toMatchObject({ kind: 'field', renderer: 'living-flame' });
    expect(flame.config.recipe.id).toBe(flameComposition(theme('flame')));
    expect(visualTrack(compile({ look: 'vigil' })).fallback)
      .toEqual({ kind: 'focal', focal: expect.objectContaining({ type: 'standard', standardGlyph: 'breath' }) });
  });

  it('keeps a passage that names its own visual', () => {
    const clips = visualTrack(compile({ look: 'revel' })).clips;
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ anchor: { sourceIds: ['named'] }, cue: { kind: 'field', renderer: 'attractor' } });
  });

  it('sets the look\'s theme, typeface and size; an explicit theme wins', () => {
    const own = compile({ look: 'signal' }).presentation;
    expect(own).toMatchObject({ colorTheme: 'cobalt', chamberFace: 'mono', fontSize: 'large' });
    expect(compile({ look: 'signal', theme: 'jade' }).presentation).toMatchObject({ colorTheme: 'jade', chamberFace: 'mono' });
    // A passage's own visual takes the effective theme's row.
    expect(visualTrack(compile({ look: 'signal', theme: 'jade' })).clips[0].cue.config)
      .toEqual({ ...RISE_CURRENT_THEMES.jade.attractor });
  });

  it('shows Inlay\'s imagery and heavy face over the spoken sentence: no word mask, no word rhythm', () => {
    const session = compile({ look: 'inlay' });
    expect(session.visualConfig.interlocution.wordFillDeclared).toBe(false);
    expect(session.chunkMode).toBe('sentence');
    expect(session.presentation).toMatchObject({ chamberFace: 'thick', fontSize: 'large' });
  });

  it('plays no bed: sound is not lowered in the card', () => {
    for (const id of RISE_CURRENT_LOOKS) expect(compile({ look: id }).soundscape ?? 'none', id).toBe('none');
  });
});
