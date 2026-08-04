import { describe, expect, it } from 'vitest';
import {
  createEditorAsset,
  EDITOR_ASSET_SCHEMA,
  EditorAssetError,
  editorAssetSupports,
  validateEditorAsset
} from './editor-asset.js';

describe('Editor Asset v1', () => {
  it('normalizes and freezes a capability-aware visual asset', () => {
    const asset = createEditorAsset({
      id: 'procedural:klee',
      lane: 'visual',
      kind: 'procedural',
      name: 'Klee Lines',
      capability: 'both',
      editor: { color: '#7FD4A4', preview: { kind: 'generator', ref: 'klee' } },
      provenance: { provider: 'R.I.S.E.' },
      cueTemplate: { kind: 'procedural', collections: ['klee'] }
    });

    expect(asset.schema).toBe(EDITOR_ASSET_SCHEMA);
    expect(asset.editor.color).toBe('#7fd4a4');
    expect(editorAssetSupports(asset, 'span')).toBe(true);
    expect(editorAssetSupports(asset, 'default')).toBe(true);
    expect(Object.isFrozen(asset.editor.preview)).toBe(true);
  });

  it('keeps project surfaces out of canonical clip cues', () => {
    expect(() => createEditorAsset({
      id: 'surface:focal',
      lane: 'visual',
      kind: 'project-surface',
      name: 'Focal',
      capability: 'default',
      editor: { preview: { kind: 'surface', ref: 'focal' } },
      cueTemplate: { kind: 'sourced', collections: ['focal'] }
    })).toThrow(expect.objectContaining({ code: 'EDITOR_ASSET_SURFACE_CUE' }));
  });

  it('rejects wrong cue kinds, unknown fields, and prototype pollution', () => {
    expect(() => createEditorAsset({
      id: 'collection:aic-oldmasters',
      lane: 'visual',
      kind: 'sourced-collection',
      name: 'Old Masters',
      capability: 'default',
      editor: { preview: { kind: 'sample', ref: 'aic-oldmasters' } },
      cueTemplate: { kind: 'procedural', collections: ['aic-oldmasters'] }
    })).toThrow(EditorAssetError);

    const valid = createEditorAsset({
      id: 'project-image:one',
      lane: 'visual',
      kind: 'sequence-image',
      name: 'One',
      capability: 'span',
      editor: { preview: { kind: 'image', ref: 'data:image/png;base64,b25l' } },
      provenance: JSON.parse('{"safe":true,"__proto__":{"polluted":true}}'),
      cueTemplate: { kind: 'sourced', collections: ['sequence-asset:one'] }
    });
    expect(Object.hasOwn(valid.provenance, '__proto__')).toBe(false);
    expect({}.polluted).toBeUndefined();
    expect(() => validateEditorAsset({ ...valid, componentState: true }))
      .toThrow(expect.objectContaining({ code: 'EDITOR_ASSET_FIELD' }));
  });
});
