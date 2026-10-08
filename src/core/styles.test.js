/**
 * Styles as data (docs/superpowers/specs/2026-10-08-creative-control-design.md §11):
 * every style a Current may name has one record, and every value in it is one
 * the code that applies it understands, so a style cannot name a place, a face
 * or an easing the card would ignore.
 */
import { describe, expect, it } from 'vitest';
import { STYLES, styleOf } from './styles.js';
import { RISE_CURRENT_STYLES } from './rise-current.js';
import { BEAT_PLACES, BEAT_SIZES } from './beats.js';
import { TYPE_NAMES } from './typography.js';
import { EASE, LIBRARY_DEFAULTS } from '../scenes/scene-library.js';

describe('the styles', () => {
  it('are the styles a Current may name, one frozen record each', () => {
    expect(Object.keys(STYLES)).toEqual([...RISE_CURRENT_STYLES]);
    for (const id of RISE_CURRENT_STYLES) {
      const style = STYLES[id];
      expect(style.id).toBe(id);
      expect(Object.isFrozen(style)).toBe(true);
      expect(Object.isFrozen(style.library)).toBe(true);
      expect(Object.isFrozen(style.typography)).toBe(true);
      // One sentence, for the tool's description.
      expect(style.line).toMatch(/^[^\n]+\.$/u);
      expect(style.line.length).toBeLessThanOrEqual(200);
    }
  });

  it('set only library defaults the library reads, each of the type it expects', () => {
    for (const style of Object.values(STYLES)) {
      for (const [key, value] of Object.entries(style.library)) {
        expect(Object.keys(LIBRARY_DEFAULTS), `${style.id}.${key}`).toContain(key);
        expect(typeof value, `${style.id}.${key}`).toBe(typeof LIBRARY_DEFAULTS[key]);
      }
      expect(Object.keys(EASE)).toContain(style.library.ease);
    }
  });

  it('set typography in the words beats use: a place, a size, and faces for text and captions', () => {
    for (const style of Object.values(STYLES)) {
      const { place, size, type } = style.typography;
      expect(BEAT_PLACES).toContain(place);
      expect(BEAT_SIZES).toContain(size);
      for (const [role, face] of Object.entries(type)) {
        expect(['text', 'caption']).toContain(role);
        expect(TYPE_NAMES).toContain(face);
      }
    }
  });

  it('make Premium Educational calm: captions, a humanist sans under a book serif, smooth easing, 2.5 strokes, a faint grid', () => {
    const { typography, library } = STYLES['premium-educational'];
    expect(typography).toEqual({ place: 'caption', size: 'as-set', type: { text: 'book-serif', caption: 'humanist-sans' } });
    expect(library.ease).toBe('smooth');
    expect(library.stroke).toBe(2.5);
    expect(library.gridAlpha).toBeLessThan(LIBRARY_DEFAULTS.gridAlpha);
    expect(library.labelFont).toMatch(/Instrument Sans/u);
  });

  it('make Open Field free: words in the centre, a display face for captions, livelier easing', () => {
    const { typography, library } = STYLES['open-field'];
    expect(typography.place).toBe('centre');
    expect(typography.type).toEqual({ caption: 'display-serif' });
    expect(library.ease).not.toBe('smooth');
  });

  it('are found by id, and nothing else is', () => {
    expect(styleOf('open-field')).toBe(STYLES['open-field']);
    for (const id of [undefined, null, '', 'constructor', 'toString', 'plain']) expect(styleOf(id), String(id)).toBeNull();
  });
});
