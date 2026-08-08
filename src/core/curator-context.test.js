import { describe, expect, it } from 'vitest';
import {
  CURATOR_CONTEXT_SCHEMA,
  CuratorContextValidationError,
  exportCuratorContext,
  serializeCuratorContext,
  validateCuratorContext
} from './curator-context.js';

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
    expect(context.audio.swells).toEqual(expect.arrayContaining(['personal', 'my-swell']));
    expect(JSON.stringify(context)).not.toMatch(/data:image|blob:|https?:\/\//i);
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

  it('round-trips through serialize', () => {
    const context = exportCuratorContext({ id: 'ctx-round', sources: [] });
    const again = validateCuratorContext(JSON.parse(serializeCuratorContext(context)));
    expect(again.id).toBe('ctx-round');
    expect(again.schema).toBe(CURATOR_CONTEXT_SCHEMA);
  });
});
