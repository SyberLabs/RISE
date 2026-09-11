/**
 * What a composed reading may claim, and what it may never take.
 */
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_KEYS,
  createPresentationLens,
  sessionPresentation
} from './session-presentation.js';

const reader = () => ({
  chamberFace: 'literary',
  fontSize: 'medium',
  bandOffset: 0,
  photosensitivityMode: true,
  masterVolume: 0.4
});

describe('what a reading may claim', () => {
  it('claims nothing at all unless it says so', () => {
    expect(sessionPresentation({})).toBeNull();
    expect(sessionPresentation({ presentation: {} })).toBeNull();
    expect(sessionPresentation(null)).toBeNull();
    expect(sessionPresentation({ presentation: [] })).toBeNull();
  });

  it('normalizes through the same resolvers the settings use', () => {
    // An authored typo cannot put a face or a size into the Chamber that
    // a reader could never have chosen for themselves.
    expect(sessionPresentation({ presentation: { chamberFace: 'not-a-face' } }))
      .toEqual({ chamberFace: 'literary' });
    expect(sessionPresentation({ presentation: { fontSize: 'enormous' } })).toBeNull();
    expect(sessionPresentation({ presentation: { bandOffset: 9 } })).toEqual({ bandOffset: 1 });
    expect(sessionPresentation({ presentation: { bandOffset: 'x' } })).toEqual({ bandOffset: 0 });
  });

  it('takes the three presentation keys and no others', () => {
    const claimed = sessionPresentation({
      presentation: {
        chamberFace: 'thick',
        fontSize: 'fit',
        bandOffset: 0.2,
        photosensitivityMode: false,
        masterVolume: 1,
        reducedMotion: false
      }
    });
    expect(Object.keys(claimed).sort()).toEqual([...PRESENTATION_KEYS].sort());
  });
});

describe('the lens over a reader settings', () => {
  const composed = {
    presentation: { chamberFace: 'thick', fontSize: 'fit', bandOffset: 0.18 }
  };

  it('answers with the reading opening position', () => {
    const lens = createPresentationLens(composed, reader);
    const settings = lens.getSettings();
    expect(settings.chamberFace).toBe('thick');
    expect(settings.fontSize).toBe('fit');
    expect(settings.bandOffset).toBe(0.18);
  });

  it('leaves everything it does not claim alone', () => {
    const lens = createPresentationLens(composed, reader);
    const settings = lens.getSettings();
    // Safety and audio are the reader's, once and for good.
    expect(settings.photosensitivityMode).toBe(true);
    expect(settings.masterVolume).toBe(0.4);
  });

  it('never writes back — the reader settings are the same afterwards', () => {
    // THE WHOLE REASON IT IS A LENS. Setting the settings and restoring
    // them afterwards is the same idea with a crash in the middle of it.
    const settings = reader();
    const lens = createPresentationLens(composed, () => settings);
    lens.getSettings();
    lens.release('fontSize');
    lens.getSettings();
    expect(settings).toEqual(reader());
  });

  it('gives a key back the moment the reader reaches for it', () => {
    // The Size control sits in the Chamber bar. A control that is
    // offered and does nothing is worse than one that is not offered.
    const lens = createPresentationLens(composed, reader);
    expect(lens.claims('fontSize')).toBe(true);
    expect(lens.getSettings().fontSize).toBe('fit');

    lens.release('fontSize');

    expect(lens.claims('fontSize')).toBe(false);
    expect(lens.getSettings().fontSize).toBe('medium');
    // And only that one.
    expect(lens.getSettings().chamberFace).toBe('thick');
  });

  it('follows the reader own settings as they change', () => {
    let live = { ...reader(), chamberFace: 'literary' };
    const lens = createPresentationLens({ presentation: { bandOffset: 0.2 } }, () => live);
    expect(lens.getSettings().chamberFace).toBe('literary');
    live = { ...live, chamberFace: 'display' };
    expect(lens.getSettings().chamberFace).toBe('display');
    expect(lens.getSettings().bandOffset).toBe(0.2);
  });

  it('is the plain settings for an ordinary reading', () => {
    const lens = createPresentationLens({}, reader);
    expect(lens.getSettings()).toEqual(reader());
    expect(lens.claims('fontSize')).toBe(false);
    lens.release('fontSize');
    expect(lens.getSettings()).toEqual(reader());
  });

  it('survives being handed nothing to read from', () => {
    const lens = createPresentationLens(composed, null);
    expect(lens.getSettings().fontSize).toBe('fit');
  });
});
