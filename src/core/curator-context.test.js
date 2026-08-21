import { describe, expect, it } from 'vitest';
import {
  CURATOR_CONTEXT_LIMITS,
  CURATOR_CONTEXT_SCHEMA,
  CuratorContextValidationError,
  exportCuratorContext,
  serializeCuratorContext,
  validateCuratorContext
} from './curator-context.js';
import { READING_LIMITS } from './reading-limits.js';

describe('rise.curator-context.v1', () => {
  it('exports registered ids only from a Workshop surface', () => {
    const context = exportCuratorContext({
      id: 'ctx-1',
      sources: [{ id: 'src-a', name: 'Alpha', data: 'Still water' }],
      assets: [{ id: 'moon', name: 'Moon' }],
      swellIds: ['my-swell']
    });

    expect(context.schema).toBe(CURATOR_CONTEXT_SCHEMA);
    expect(context.sources).toEqual([
      expect.objectContaining({ id: 'src-a', title: 'Alpha', characterLength: 11 })
    ]);
    expect(context.visuals.collections).toContain('sequence-asset:moon');
    expect(context.visuals.collections).toContain('global-pool');
    expect(context.visuals.engines).toContain('klee');
    expect(context.visuals.engines).toContain('flaming_sword');
    expect(context.audio.soundscapes).toContain('aurora');
    expect(context.audio.tones).toContain('silent');
    expect(context.audio.swells).toEqual(['my-swell']);
    expect(JSON.stringify(context)).not.toMatch(/data:image|blob:|https?:\/\//i);
  });

  it('offers no swell the reader does not have', () => {
    // A literal 'personal' headed this list and named nothing: a personal
    // signal is `swell_<timestamp>_<rand>`, and no code in src/ reads the
    // word specially. The gate therefore admitted a guaranteed-silent cue.
    const empty = exportCuratorContext({ id: 'ctx-silent', sources: [] });
    expect(empty.audio.swells).toEqual([]);
    // An annotation section with nothing in it is dropped, not shipped empty.
    expect(empty.catalog.swells).toBeUndefined();

    const held = exportCuratorContext({
      id: 'ctx-swell',
      sources: [],
      swells: [{ id: 'swell_1700000000000_ab12', name: 'Kitchen at night' }]
    });
    expect(held.audio.swells).toEqual(['swell_1700000000000_ab12']);
    expect(held.catalog.swells['swell_1700000000000_ab12'])
      .toMatchObject({ kind: 'personal-audio', name: 'Kitchen at night' });
  });

  it('tells a video from a still, and says how long it runs', () => {
    // Both arrived as "Media the reader added to this project", so a composer
    // could not tell one from the other; the duration was measured at upload
    // and then told to nobody.
    const context = exportCuratorContext({
      id: 'ctx-media',
      sources: [],
      assets: [
        { id: 'moon', name: 'Moon.jpg', kind: 'image' },
        { id: 'tide', name: 'Tide.mp4', kind: 'video', durationMs: 31_500 }
      ]
    });
    expect(context.catalog.collections['sequence-asset:moon']).toMatchObject({
      kind: 'sequence-asset', mediaKind: 'image', name: 'Moon.jpg'
    });
    expect(context.catalog.collections['sequence-asset:moon'].durationMs).toBeUndefined();
    expect(context.catalog.collections['sequence-asset:tide']).toMatchObject({
      kind: 'sequence-asset', mediaKind: 'video', durationMs: 31_500, name: 'Tide.mp4'
    });
  });

  it('refuses unknown fields and URI-shaped ids', () => {
    expect(() => validateCuratorContext({
      schema: CURATOR_CONTEXT_SCHEMA,
      id: 'ctx',
      sources: [],
      visuals: { collections: [], engines: [] },
      audio: { soundscapes: [], tones: [], swells: [] },
      hack: true
    })).toThrow(CuratorContextValidationError);

    expect(() => validateCuratorContext({
      schema: CURATOR_CONTEXT_SCHEMA,
      id: 'ctx',
      sources: [{ id: 'https://evil.example/x' }],
      visuals: { collections: [], engines: [] },
      audio: { soundscapes: [], tones: [], swells: [] }
    })).toThrow(expect.objectContaining({ code: 'CURATOR_CONTEXT_URI_REFUSED' }));
  });

  it('carries what the reader said the file is, in place of what RISE guessed', () => {
    // The generated sentence says no more than `mediaKind` already does, so a
    // reader's own words replace it rather than queue behind it.
    const context = exportCuratorContext({
      id: 'ctx-described',
      sources: [],
      assets: [
        { id: 'moon', name: 'Moon.jpg', kind: 'image',
          description: 'The moon over the allotments, the week she died.' },
        { id: 'tide', name: 'Tide.mp4', kind: 'video', durationMs: 31_500 }
      ]
    });
    expect(context.catalog.collections['sequence-asset:moon'].description)
      .toBe('The moon over the allotments, the week she died.');
    // Still attributed, still measured — a description adds to those.
    expect(context.catalog.collections['sequence-asset:moon'])
      .toMatchObject({ kind: 'sequence-asset', mediaKind: 'image', name: 'Moon.jpg' });
    expect(context.catalog.collections['sequence-asset:tide'].description)
      .toBe('A video the reader added to this project.');
  });

  it('does not trust a description the way it trusts a generated one', () => {
    // Every other description in this catalogue is a string this codebase
    // wrote. This one was typed by a person, so it goes through boundedText.
    // AND THE PATH NAMES THE ASSET FIELD, not the catalogue slot it would
    // eventually have been written into. `normalizeCatalog` bounds every
    // description at the end of the export and would refuse this one too, at
    // `$.catalog.collections.sequence-asset:moon.description` — a path that
    // describes RISE's own data structure to a reader who typed a sentence.
    // Checking the string where it ENTERS is what lets the refusal say which
    // input caused it.
    expect(() => exportCuratorContext({
      id: 'ctx-smuggle',
      sources: [],
      assets: [{ id: 'moon', name: 'Moon.jpg', description: 'see https://evil.example/x' }]
    })).toThrow(expect.objectContaining({
      code: 'CURATOR_CONTEXT_URI_REFUSED',
      path: '$.assets.description'
    }));

    expect(() => exportCuratorContext({
      id: 'ctx-long',
      sources: [],
      assets: [{ id: 'moon', name: 'Moon.jpg', description: 'x'.repeat(5_000) }]
    })).toThrow(expect.objectContaining({
      code: 'CURATOR_CONTEXT_TEXT_TOO_LONG',
      path: '$.assets.description'
    }));

    // And the whole document stays free of URIs, which is the property the
    // serialized form has always had to hold.
    const clean = exportCuratorContext({
      id: 'ctx-clean',
      sources: [],
      assets: [{ id: 'moon', name: 'Moon.jpg', description: 'A moon, low over roofs.' }]
    });
    expect(JSON.stringify(clean)).not.toMatch(/data:image|blob:|https?:\/\//i);
  });

  it('bounds a description at the number the descriptor bounds it at', () => {
    // Two ceilings kept equal by hand is how a room comes to accept a
    // description the document then refuses, several steps later.
    expect(CURATOR_CONTEXT_LIMITS.maxDescriptionLength)
      .toBe(READING_LIMITS.maxMaterialDescriptionChars);
    const context = exportCuratorContext({
      id: 'ctx-edge',
      sources: [],
      assets: [{
        id: 'moon',
        name: 'Moon.jpg',
        description: 'x'.repeat(READING_LIMITS.maxMaterialDescriptionChars)
      }]
    });
    expect(context.catalog.collections['sequence-asset:moon'].description)
      .toHaveLength(READING_LIMITS.maxMaterialDescriptionChars);
  });

  it('round-trips through serialize', () => {
    const context = exportCuratorContext({ id: 'ctx-round', sources: [] });
    const again = validateCuratorContext(JSON.parse(serializeCuratorContext(context)));
    expect(again.id).toBe('ctx-round');
    expect(again.schema).toBe(CURATOR_CONTEXT_SCHEMA);
  });
});
