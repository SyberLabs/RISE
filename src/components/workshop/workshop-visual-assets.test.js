import { describe, expect, it } from 'vitest';
import {
  applyEditorAssetDefault,
  buildWorkshopVisualAssetRegistry,
  projectAssetIdFromEditorAsset
} from './workshop-visual-assets.js';

const IMAGE = 'data:image/png;base64,aW1hZ2U=';

describe('Workshop visual asset registry', () => {
  it('adapts project, shared, collection, procedural, and field assets', () => {
    const registry = buildWorkshopVisualAssetRegistry({
      projectAssets: [{
        id: 'moon', uri: IMAGE, name: 'Moon', color: '#7fd4a4',
        provenance: { origin: 'saved-sequence', snapshotOf: 'shared:moon' }
      }],
      globalAssets: [{ id: 'global-one', uri: IMAGE, name: 'Shared moon' }],
      savedBlueprints: [{
        id: 'saved-one', title: 'Saved',
        sequenceVisualAssets: [{ id: 'saved-moon', uri: IMAGE, name: 'Earlier moon' }]
      }]
    });

    expect(new Set(registry.map(entry => entry.group))).toEqual(new Set([
      'project', 'shared', 'collections', 'procedural', 'fields', 'internal'
    ]));
    const project = registry.find(entry => entry.asset.id === 'project-image:moon');
    const collection = registry.find(entry => entry.asset.id === 'collection:aic-oldmasters');
    const procedural = registry.find(entry => entry.asset.id === 'procedural:klee');
    const attractor = registry.find(entry => entry.asset.id === 'surface:attractor');
    const stillness = registry.find(entry => entry.asset.id === 'surface:off');
    expect(project.asset.cueTemplate.collections).toEqual(['sequence-asset:moon']);
    expect(project.asset.capability).toBe('span');
    expect(project).not.toHaveProperty('defaultValue');
    expect(project.asset.provenance.source).toEqual({
      origin: 'saved-sequence', snapshotOf: 'shared:moon'
    });
    expect(projectAssetIdFromEditorAsset(project.asset)).toBe('moon');
    expect(collection.asset.capability).toBe('both');
    expect(procedural.asset.capability).toBe('both');
    expect(procedural.previewStyle).toContain('gradient');
    expect(attractor.asset).toMatchObject({
      capability: 'both',
      cueTemplate: { kind: 'field', renderer: 'attractor' }
    });
    expect(stillness).toMatchObject({ hidden: true, asset: { name: 'Intentional stillness' } });
    expect(registry.find(entry => entry.asset.id === 'surface:scored')).toBeUndefined();
    expect(procedural.asset.cueTemplate).toEqual({
      kind: 'procedural', collections: ['klee'], config: { preset: 'random' }
    });
    expect(registry.filter(entry => entry.materialization)).toHaveLength(2);
  });

  it('maps default choices without carrying editor metadata into visual config', () => {
    const registry = buildWorkshopVisualAssetRegistry();
    const klee = registry.find(entry => entry.asset.id === 'procedural:klee');
    const focal = registry.find(entry => entry.asset.id === 'surface:focal');

    const scored = applyEditorAssetDefault({ interlocution: { responsive: true } }, klee);
    expect(scored).toMatchObject({
      visualMode: 'interlocution',
      interlocution: { sourceFamily: 'procedural', procedural: ['klee'], sourced: [], responsive: true }
    });
    expect(scored).not.toHaveProperty('editor');
    expect(applyEditorAssetDefault(scored, focal).visualMode).toBe('focals');

    const projectImage = buildWorkshopVisualAssetRegistry({
      projectAssets: [{ id: 'portrait', uri: IMAGE, name: 'Portrait', color: '#7fd4a4' }]
    }).find(entry => entry.asset.id === 'project-image:portrait');
    expect(applyEditorAssetDefault({}, projectImage)).toEqual({});
  });
});
