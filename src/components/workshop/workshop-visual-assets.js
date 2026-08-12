import { createEditorAsset, validateEditorAsset } from '../../core/editor-asset.js';
import { VISUAL_SCORE_COLORS } from '../../core/visual-score-lane.js';
import { visualFallbackCueFromConfig } from '../../core/visual-program.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';
import {
  normalizeFieldStyle,
  normalizeProceduralStyle
} from '../../core/visual-style-definitions.js';

const PROCEDURAL = Object.freeze([
  ['klee', 'Klee Lines', '╱'],
  ['turrell', 'Turrell Fields', '◈'],
  ['fractal', 'Fractal Flames', '✧'],
  ['neural', 'Neural Networks', '◉'],
  ['rockgarden', 'Rock Garden', '◯'],
  ['harmonograph', 'Harmonograph', '∿']
]);

const PROCEDURAL_PREVIEWS = Object.freeze({
  klee: 'linear-gradient(145deg,#101a25 0 38%,transparent 39%),repeating-linear-gradient(25deg,#d6b56d 0 1px,transparent 1px 17px),#17222c',
  turrell: 'radial-gradient(ellipse at 50% 62%,#f4a2a6 0 12%,#a75e86 34%,#402660 64%,#111729 100%)',
  fractal: 'conic-gradient(from 230deg at 54% 48%,#0b0b15,#7e376f,#e09f67,#2e7191,#0b0b15)',
  neural: 'radial-gradient(circle at 28% 36%,#d6b56d 0 2px,transparent 3px),radial-gradient(circle at 68% 58%,#8dc9bb 0 3px,transparent 4px),linear-gradient(32deg,transparent 46%,#7898ac 48% 49%,transparent 51%),#111b25',
  rockgarden: 'repeating-radial-gradient(ellipse at 62% 54%,#33404a 0 2px,#171f27 3px 8px,#27313b 9px 10px)',
  harmonograph: 'repeating-radial-gradient(ellipse at 50% 50%,transparent 0 6px,#b995c8 7px 8px,transparent 9px 14px),#111923'
});

function collectionPreview(index) {
  const accents = ['#9c735c', '#6e829c', '#a48762', '#758c73', '#8f6c82'];
  const accent = accents[index % accents.length];
  return `linear-gradient(135deg,transparent 0 34%,${accent} 35% 62%,transparent 63%),linear-gradient(25deg,#111820,#27313b)`;
}

const SURFACES = Object.freeze([
  ['focal', 'Focal', '◎'],
  ['attractor', 'Attractor', '∮'],
  ['genesis', 'Genesis', '✣']
]);

const colorAt = index => VISUAL_SCORE_COLORS[index % VISUAL_SCORE_COLORS.length];

function projectImageEntry(asset, index) {
  if (asset.kind === 'video') {
    return {
      group: 'project',
      asset: createEditorAsset({
        id: `project-video:${asset.id}`,
        lane: 'visual',
        kind: 'sequence-video',
        name: asset.name || `Project video ${index + 1}`,
        capability: 'span',
        editor: { color: asset.color || colorAt(index), preview: { kind: 'video', ref: asset.uri } },
        provenance: {
          scope: 'project', projectOwned: true, projectAssetId: asset.id,
          durationMs: asset.durationMs,
          ...(asset.provenance ? { source: asset.provenance } : {})
        },
        cueTemplate: {
          kind: 'video', assetId: asset.id, timeMode: asset.timeMode || 'loop',
          audioPolicy: 'muted', reducedMotion: 'poster'
        }
      })
    };
  }
  return {
    group: 'project',
    asset: createEditorAsset({
      id: `project-image:${asset.id}`,
      lane: 'visual',
      kind: 'sequence-image',
      name: asset.name || `Project image ${index + 1}`,
      capability: 'span',
      editor: { color: asset.color || colorAt(index), preview: { kind: 'image', ref: asset.uri } },
      provenance: {
        scope: 'project', projectOwned: true, projectAssetId: asset.id,
        ...(asset.provenance ? { source: asset.provenance } : {})
      },
      cueTemplate: { kind: 'sourced', collections: [`sequence-asset:${asset.id}`] }
    })
  };
}

function collectionEntries(offset) {
  const entries = Object.entries(MUSEUM_CATEGORIES).map(([id, category], index) => ({
    group: 'collections',
    previewStyle: collectionPreview(index),
    asset: createEditorAsset({
      id: `collection:aic-${id}`,
      lane: 'visual',
      kind: 'sourced-collection',
      name: category.name,
      capability: 'both',
      editor: { color: colorAt(offset + index), preview: { kind: 'sample', ref: `aic-${id}` } },
      provenance: { provider: 'Art Institute of Chicago', collectionId: `aic-${id}`, kind: category.kind },
      cueTemplate: { kind: 'sourced', collections: [`aic-${id}`] }
    }),
    defaultValue: { surface: 'scored', sourceFamily: 'collections' }
  }));
  entries.unshift({
    group: 'shared',
    previewStyle: collectionPreview(entries.length),
    asset: createEditorAsset({
      id: 'collection:global-pool',
      lane: 'visual',
      kind: 'sourced-collection',
      name: 'Global Pool',
      capability: 'both',
      editor: { color: colorAt(offset + entries.length), preview: { kind: 'sample', ref: 'global-pool' } },
      provenance: { provider: 'Personal Library', collectionId: 'global-pool' },
      cueTemplate: { kind: 'sourced', collections: ['global-pool'] }
    }),
    defaultValue: { surface: 'scored', sourceFamily: 'personal' }
  });
  return entries;
}

function proceduralEntries(offset) {
  return PROCEDURAL.map(([id, name, symbol], index) => ({
    group: 'procedural',
    symbol,
    previewStyle: PROCEDURAL_PREVIEWS[id],
    asset: createEditorAsset({
      id: `procedural:${id}`,
      lane: 'visual',
      kind: 'procedural',
      name,
      capability: 'both',
      editor: { color: colorAt(offset + index), preview: { kind: 'generator', ref: id } },
      provenance: { provider: 'RISE Visual Cortex', familyId: id },
      cueTemplate: {
        kind: 'procedural', collections: [id],
        ...(['klee', 'harmonograph'].includes(id)
          ? { config: normalizeProceduralStyle([id], {}) }
          : {})
      }
    }),
    defaultValue: { surface: 'scored', sourceFamily: 'procedural' }
  }));
}

function surfaceEntries(offset, visualConfig = {}) {
  const fields = SURFACES.map(([surface, name, symbol], index) => ({
    group: 'fields',
    symbol,
    asset: createEditorAsset({
      id: `surface:${surface}`,
      lane: 'visual',
      kind: 'project-surface',
      name,
      capability: 'both',
      editor: { color: colorAt(offset + index), preview: { kind: 'surface', ref: surface } },
      provenance: { provider: 'RISE Reading Surface', surface },
      cueTemplate: {
        kind: 'field', renderer: surface,
        config: normalizeFieldStyle(surface,
          surface === 'focal' ? visualConfig.focals
            : surface === 'attractor' ? visualConfig.attractor : visualConfig.genesis)
      }
    }),
    defaultValue: { surface }
  }));
  // Stillness is an authoring operation, not an asset. Keep its cue in the
  // internal registry so saved assignments remain resolvable, but never
  // expose it in browsing, search, or the passage picker.
  fields.push({
    group: 'internal',
    hidden: true,
    symbol: '○',
    asset: createEditorAsset({
      id: 'surface:off',
      lane: 'visual',
      kind: 'project-surface',
      name: 'Intentional stillness',
      capability: 'both',
      editor: { color: colorAt(offset + fields.length), preview: { kind: 'surface', ref: 'off' } },
      provenance: { provider: 'RISE Reading Surface', surface: 'off' },
      cueTemplate: { kind: 'still' }
    }),
    defaultValue: { surface: 'off' }
  });
  return fields;
}

function sharedImageEntry({ id, uri, name, origin, projectId, projectAssetId }, index) {
  return {
    group: 'shared',
    materialization: { uri, name, originId: id },
    asset: createEditorAsset({
      id: `shared-image:${id}`,
      lane: 'visual',
      kind: 'sequence-image',
      name: name || `Shared image ${index + 1}`,
      capability: 'span',
      editor: { color: colorAt(index), preview: { kind: 'image', ref: uri } },
      provenance: {
        scope: 'shared', projectOwned: false, origin,
        ...(projectId ? { projectId } : {}),
        ...(projectAssetId ? { projectAssetId } : {})
      }
    })
  };
}

export function buildWorkshopVisualAssetRegistry({
  projectAssets = [], globalAssets = [], savedBlueprints = [], visualConfig = {}
} = {}) {
  const entries = projectAssets.map(projectImageEntry);
  const shared = globalAssets.map((asset, index) => sharedImageEntry({
    id: `global:${asset.id}`, uri: asset.uri, name: asset.name, origin: 'global-pool'
  }, index));
  for (const blueprint of savedBlueprints) {
    for (const [index, asset] of (blueprint.sequenceVisualAssets || []).entries()) {
      if (!asset?.uri || asset.kind === 'video' || blueprint.id == null) continue;
      shared.push(sharedImageEntry({
        id: `project:${blueprint.id}:${asset.id || index}`,
        uri: asset.uri,
        name: asset.name || `${blueprint.title || 'Saved sequence'} image ${index + 1}`,
        origin: 'saved-sequence',
        projectId: blueprint.id,
        projectAssetId: asset.id
      }, shared.length));
    }
  }
  entries.push(...shared);
  entries.push(...collectionEntries(entries.length));
  entries.push(...proceduralEntries(entries.length));
  entries.push(...surfaceEntries(entries.length, visualConfig));
  const ids = new Set();
  return Object.freeze(entries.filter(entry => {
    validateEditorAsset(entry.asset);
    if (ids.has(entry.asset.id)) return false;
    ids.add(entry.asset.id);
    return true;
  }).map(Object.freeze));
}

export function projectAssetIdFromEditorAsset(asset) {
  const canonical = validateEditorAsset(asset);
  return canonical.provenance.projectOwned === true
    ? canonical.provenance.projectAssetId || null
    : null;
}

export function applyEditorAssetDefault(visualConfig, entry) {
  const asset = validateEditorAsset(entry.asset);
  const next = JSON.parse(JSON.stringify(visualConfig || {}));
  const surface = entry.defaultValue?.surface;
  if (!surface) return next;
  const mode = surface === 'focal' ? 'focals'
    : surface === 'scored' ? 'interlocution'
      : surface || 'off';
  next.visualMode = mode;
  if (surface === 'scored' && visualConfig?.visualMode !== 'interlocution') {
    next.interlocution = {
      ...(next.interlocution || {}),
      fallbackCue: visualFallbackCueFromConfig(visualConfig)
    };
  }
  if (asset.kind === 'sourced-collection') {
    next.interlocution = {
      ...(next.interlocution || {}),
      sourceFamily: entry.defaultValue?.sourceFamily || 'collections',
      sourced: [...asset.cueTemplate.collections],
      procedural: []
    };
  } else if (asset.kind === 'procedural') {
    next.interlocution = {
      ...(next.interlocution || {}),
      sourceFamily: 'procedural',
      procedural: [...asset.cueTemplate.collections],
      sourced: [],
      ...(asset.cueTemplate.collections[0] === 'klee'
        ? { kleePreset: asset.cueTemplate.config?.preset || 'random' }
        : asset.cueTemplate.collections[0] === 'harmonograph'
          ? { harmonographClimate: asset.cueTemplate.config?.climate || 'auto' }
          : {})
    };
  }
  return next;
}
