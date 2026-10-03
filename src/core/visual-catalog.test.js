import { describe, expect, it } from 'vitest';
import { ATTRACTOR_VISUAL_MANIFEST } from './visual-control-contract.js';
import { renderSupportFor } from './render/support.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';
import { compileSession } from './session-compiler.js';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from './experience-program.js';
import {
  ATTRACTOR_FORMS,
  ATTRACTOR_PALETTES,
  ATTRACTOR_SYSTEMS,
  KLEE_PRESETS,
  normalizeFieldStyle
} from './visual-style-definitions.js';
import {
  VISUAL_CATALOG,
  admitCatalogConfiguration,
  admitCatalogVisual,
  getCatalogVisual,
  queryVisualCatalog
} from './visual-catalog.js';

describe('visual catalog metadata', () => {
  it('mirrors all nine registered identities and descriptions as specimens', () => {
    expect(VISUAL_CATALOG).toHaveLength(9);
    expect(VISUAL_CATALOG.map(({ id, name, description }) => ({ id, name, description })))
      .toEqual(LISTED_PROCEDURAL_PATTERNS.map(({ id, name, description }) => ({ id, name, description })));
    expect(VISUAL_CATALOG.every(({ specimen }) => specimen === true)).toBe(true);
  });

  it('keeps specimen support, live openings, and mutable controls separate', () => {
    expect(VISUAL_CATALOG.filter(({ liveVisual }) => liveVisual !== null).map(({ id, liveVisual }) => [id, liveVisual]))
      .toEqual([['klee', 'genesis'], ['attractor', 'attractor']]);
    expect(VISUAL_CATALOG.filter(({ mutableControls }) => mutableControls.length > 0)
      .map(({ id, mutableControls }) => [id, mutableControls]))
      .toEqual([['attractor', ['intensity']]]);
    for (const item of VISUAL_CATALOG) {
      expect(item.requires).toEqual({ canvas: true });
      expect(item.cost).toBeNull();
      if (item.id !== 'attractor') {
        expect(item.parameters).toEqual({});
        expect(item.parameterDescription).toBe('Uses fixed renderer defaults.');
        expect(renderSupportFor(`visual:procedural:${item.id}`).render).toBe('native');
      }
    }
    expect(VISUAL_CATALOG.find(({ id }) => id === 'attractor').parameters)
      .toBe(ATTRACTOR_VISUAL_MANIFEST.parameters);
    expect(VISUAL_CATALOG.find(({ id }) => id === 'attractor').parameters.intensity)
      .toEqual({ type: 'number', minimum: 0.4, maximum: 0.75, default: 0.65 });
    expect(renderSupportFor('visual:field:attractor').render).toBe('native');
    expect(renderSupportFor('visual:field:genesis').render).toBe('native');
  });

  it('freezes the catalog and all nested metadata returned by lookup', () => {
    const item = getCatalogVisual('attractor');
    expect(Object.isFrozen(VISUAL_CATALOG)).toBe(true);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.tags)).toBe(true);
    expect(Object.isFrozen(item.requires)).toBe(true);
    expect(Object.isFrozen(item.parameters)).toBe(true);
    expect(Object.isFrozen(item.parameters.intensity)).toBe(true);
    expect(Object.isFrozen(item.mutableControls)).toBe(true);
    expect(getCatalogVisual('unknown')).toBeNull();
  });
});

const scoreProgram = cue => validateExperienceProgram({
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'catalog-score',
  authority: 'proposed',
  editable: true,
  tracks: [
    {
      id: 'movement', kind: 'movement', clips: [
        { id: 'opening', anchor: { sourceIds: ['catalog-text'] }, data: { index: 0, title: 'Opening' } }
      ]
    },
    {
      id: 'visual', kind: 'visual', fallback: { kind: 'still' }, clips: [
        { id: 'catalog-visual', anchor: { sourceIds: ['catalog-text'] }, cue }
      ]
    }
  ]
});

describe('visual catalog configuration admission', () => {
  it('exposes only the three audited frozen manifests with distinct contexts', () => {
    const attractor = getCatalogVisual('attractor').manifest;
    const klee = getCatalogVisual('klee').manifest;
    const neural = getCatalogVisual('neural').manifest;
    expect([attractor.id, klee.id, neural.id]).toEqual(['attractor', 'klee', 'neural']);
    expect(klee.aliases).toContain('genesis');
    expect(attractor.mapping).toMatchObject({ renderer: 'attractor' });
    expect(klee.mapping).toMatchObject({ renderer: 'genesis', collection: 'klee' });
    expect(neural.mapping).toMatchObject({ collection: 'neural' });
    for (const manifest of [attractor, klee, neural]) {
      expect(Object.keys(manifest.contexts).sort()).toEqual(['control', 'current', 'score', 'specimen']);
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(Object.isFrozen(manifest.contexts.score.parameters)).toBe(true);
    }
    for (const item of VISUAL_CATALOG.filter(({ id }) => !['attractor', 'klee', 'neural'].includes(id))) {
      expect(item.manifest).toBeNull();
    }
    expect(attractor.accessibility.reducedMotion).toBe(true);
    expect(klee.accessibility).toBeNull();
    expect(neural.accessibility).toBeNull();
  });

  it('admits configurations that validate and compile through the real score path', () => {
    const cases = [
      ['attractor', { system: 'thomas', palette: 'gold', form: 'kaleido', intensity: 0.4, speed: 4, streaks: true }, 'attractor'],
      ['klee', { preset: 'harmonic', glass: false }, 'genesis'],
      ['neural', {}, null]
    ];
    for (const [id, config, renderer] of cases) {
      const receipt = admitCatalogConfiguration(id, { context: 'score', config, capabilities: { canvas: true } });
      expect(receipt).toMatchObject({ status: 'accepted', id, context: 'score' });
      const cue = renderer
        ? { kind: 'field', renderer, config: receipt.config }
        : { kind: 'procedural', collections: ['neural'] };
      const program = scoreProgram(cue);
      expect(program.tracks.find(track => track.kind === 'visual').clips[0].cue).toEqual(cue);
      const session = compileSession({
        sources: [{ id: 'catalog-text', name: 'Catalog', data: 'A short reading.' }],
        visualConfig: { visualMode: 'off' }, experienceProgram: program
      });
      expect(session.visualProgram.segments[0].cue).toEqual(cue);
    }
  });

  it('preserves renderer defaults and exported enum bounds for score descriptors', () => {
    const attractor = getCatalogVisual('attractor').manifest.contexts.score.parameters;
    expect(attractor.system.options).toEqual(ATTRACTOR_SYSTEMS.map(({ id }) => id));
    expect(attractor.system.default).toBe('aizawa');
    expect(attractor.palette.options).toEqual(ATTRACTOR_PALETTES.map(({ id }) => id));
    expect(attractor.palette.default).toBe('white');
    expect(attractor.form.options).toEqual(ATTRACTOR_FORMS);
    expect(attractor.form.default).toBe('mirror');
    expect(attractor.intensity).toMatchObject({ minimum: 0.2, maximum: 1, default: 0.65 });
    expect(attractor.speed).toMatchObject({ minimum: 0.25, maximum: 4, default: 1 });
    expect(attractor.streaks).toMatchObject({ type: 'boolean', default: false });
    expect(getCatalogVisual('klee').manifest.contexts.score.parameters.preset.options)
      .toEqual(KLEE_PRESETS.map(({ id }) => id));

    const defaults = admitCatalogConfiguration('attractor', { context: 'score', capabilities: { canvas: true } });
    expect(defaults.config).toEqual(normalizeFieldStyle('attractor', {}));
    const kleeDefaults = admitCatalogConfiguration('genesis', { context: 'score', capabilities: { canvas: true } });
    expect(kleeDefaults.config).toEqual(normalizeFieldStyle('genesis', {}));
  });

  it('keeps specimen, Current, and control capabilities distinct', () => {
    for (const id of ['attractor', 'klee', 'neural']) {
      expect(admitCatalogConfiguration(id, { context: 'specimen', capabilities: { canvas: true } }))
        .toEqual({ status: 'accepted', id, context: 'specimen', config: {} });
    }
    expect(admitCatalogConfiguration('attractor', { context: 'current', capabilities: { canvas: true } }).status)
      .toBe('accepted');
    expect(admitCatalogConfiguration('klee', { context: 'current', capabilities: { canvas: true } }).status)
      .toBe('accepted');
    expect(admitCatalogConfiguration('neural', { context: 'current', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'UNSUPPORTED_CONTEXT' });
    expect(admitCatalogConfiguration('attractor', {
      context: 'control', config: { intensity: 0.4 }, capabilities: { canvas: true }
    })).toMatchObject({ status: 'accepted', config: { intensity: 0.4 } });
    expect(admitCatalogConfiguration('attractor', {
      context: 'control', config: { intensity: 0.75 }, capabilities: { canvas: true }
    })).toMatchObject({ status: 'accepted', config: { intensity: 0.75 } });
    expect(admitCatalogConfiguration('klee', { context: 'control', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'UNSUPPORTED_CONTEXT' });
  });

  it('refuses malformed inputs and unsupported score parameters without clamping', () => {
    expect(admitCatalogConfiguration('genesis', { context: 'score', capabilities: { canvas: true } }).id)
      .toBe('klee');
    expect(admitCatalogConfiguration('missing', { context: 'specimen', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'UNKNOWN_VISUAL' });
    expect(admitCatalogConfiguration('turrell', { context: 'score', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'UNMANIFESTED_VISUAL' });
    expect(admitCatalogConfiguration('attractor', { context: 'what', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'UNSUPPORTED_CONTEXT' });
    expect(admitCatalogConfiguration('attractor', { context: 'control', config: { intensity: 0.76 }, capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    expect(admitCatalogConfiguration('attractor', { context: 'control', capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    expect(admitCatalogConfiguration('attractor', { context: 'score', config: { intensity: 1.1 }, capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    for (const config of [{ intensity: 0.2 }, { intensity: 1 }, { speed: 0.25 }]) {
      expect(admitCatalogConfiguration('attractor', { context: 'score', config, capabilities: { canvas: true } }).status)
        .toBe('accepted');
    }
    expect(admitCatalogConfiguration('attractor', { context: 'score', config: { density: 4 }, capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    expect(admitCatalogConfiguration('attractor', { context: 'score', config: { system: 'unknown' }, capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    expect(admitCatalogConfiguration('attractor', { context: 'score' }))
      .toEqual({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' });
    let contextCalls = 0;
    expect(admitCatalogConfiguration('attractor', {
      context: { toString() { contextCalls++; return 'score'; } }, capabilities: { canvas: true }
    }))
      .toEqual({ status: 'refused', code: 'UNSUPPORTED_CONTEXT' });
    expect(contextCalls).toBe(0);
  });

  it('never invokes getters and detaches and freezes accepted receipts', () => {
    let getterCalls = 0;
    const config = {};
    Object.defineProperty(config, 'intensity', { enumerable: true, get() { getterCalls++; return 0.6; } });
    expect(admitCatalogConfiguration('attractor', { context: 'control', config, capabilities: { canvas: true } }))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    const options = {};
    Object.defineProperty(options, 'context', { enumerable: true, get() { getterCalls++; return 'score'; } });
    expect(admitCatalogConfiguration('attractor', options))
      .toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });
    expect(getterCalls).toBe(0);
    const capabilities = {};
    Object.defineProperty(capabilities, 'canvas', { enumerable: true, get() { getterCalls++; return true; } });
    expect(admitCatalogConfiguration('attractor', { context: 'score', capabilities }))
      .toEqual({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' });
    expect(getterCalls).toBe(0);
    const symbolConfig = { intensity: 0.6 };
    symbolConfig[Symbol('extra')] = true;
    expect(admitCatalogConfiguration('attractor', {
      context: 'control', config: symbolConfig, capabilities: { canvas: true }
    })).toEqual({ status: 'refused', code: 'INVALID_CONFIGURATION' });

    const source = Object.assign(Object.create(null), { system: 'aizawa' });
    const receipt = admitCatalogConfiguration('attractor', { context: 'score', config: source, capabilities: { canvas: true } });
    expect(receipt.status).toBe('accepted');
    expect(receipt.config).not.toBe(source);
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.config)).toBe(true);
    expect(getCatalogVisual('genesis')).toBeNull();
    expect(admitCatalogVisual('genesis', { canvas: true }))
      .toEqual({ status: 'refused', code: 'UNKNOWN_VISUAL' });
  });

  it('leaves the existing permissive authored normalizer unchanged', () => {
    expect(normalizeFieldStyle('attractor', { intensity: 2, extra: true }))
      .toMatchObject({ intensity: 1 });
  });
});

describe('queryVisualCatalog', () => {
  it('matches every whitespace-separated term across normalized metadata', () => {
    expect(queryVisualCatalog({ query: 'nodes regular', capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['neural']);
    expect(queryVisualCatalog({ query: 'KLEE GRAPHIC', capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['klee']);
  });

  it('returns no results for non-string or over-200-character queries', () => {
    expect(queryVisualCatalog({ query: 12, capabilities: { canvas: true } })).toEqual([]);
    expect(queryVisualCatalog({ query: 'a'.repeat(201), capabilities: { canvas: true } })).toEqual([]);
    expect(queryVisualCatalog({ query: `Klee${' '.repeat(196)}`, capabilities: { canvas: true } })
      .map(({ id }) => id)).toEqual(['klee']);
  });

  it('fails closed for unavailable canvas unless unavailable specimens are requested', () => {
    expect(queryVisualCatalog({}).map(({ id }) => id)).toEqual([]);
    expect(queryVisualCatalog({ capabilities: { canvas: false } })).toEqual([]);
    expect(queryVisualCatalog({ capabilities: { canvas: 'yes' } })).toEqual([]);
    expect(queryVisualCatalog({ capabilities: [] })).toEqual([]);
    expect(queryVisualCatalog({ includeUnavailable: true }).map(({ id }) => id)).toHaveLength(9);
  });

  it('filters to admitted live openings when liveOnly is true', () => {
    expect(queryVisualCatalog({ capabilities: { canvas: true }, liveOnly: true })
      .map(({ id }) => id)).toEqual(['klee', 'attractor']);
    expect(queryVisualCatalog({ liveOnly: true, includeUnavailable: true })
      .map(({ id }) => id)).toEqual(['klee', 'attractor']);
  });

  it('returns immutable arrays and immutable entry metadata', () => {
    const result = queryVisualCatalog({ capabilities: { canvas: true } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
});

describe('admitCatalogVisual', () => {
  it('maps only the verified live aliases to existing Current names', () => {
    expect(admitCatalogVisual('klee', { canvas: true }))
      .toEqual({ status: 'accepted', id: 'klee', visual: 'genesis' });
    expect(admitCatalogVisual('attractor', { canvas: true }))
      .toEqual({ status: 'accepted', id: 'attractor', visual: 'attractor' });
  });

  it('refuses unknown and specimen-only surfaces before checking capabilities', () => {
    expect(admitCatalogVisual('unknown', {})).toEqual({ status: 'refused', code: 'UNKNOWN_VISUAL' });
    expect(admitCatalogVisual('turrell', {})).toEqual({ status: 'refused', code: 'NOT_LIVE_SURFACE' });
  });

  it.each([undefined, null, [], { canvas: false }, { canvas: 'true' }])(
    'refuses a live surface when its canvas capability record is invalid: %s',
    capabilities => {
      expect(admitCatalogVisual('attractor', capabilities))
        .toEqual({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' });
    }
  );

  it('returns immutable admission receipts', () => {
    const accepted = admitCatalogVisual('klee', { canvas: true });
    const refused = admitCatalogVisual('turrell', { canvas: true });
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(refused)).toBe(true);
  });
});
