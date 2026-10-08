import { describe, expect, it } from 'vitest';
import { ENGINE_CATALOG } from '../core/visual-registry.js';
import { FLAME_PRESET_IDS } from '../visuals/living-flame/flame-presets.js';
import { cueCommands, describeManifests, fitParameter, manifestFor, SCENE_ENGINES, SCENE_MANIFESTS, sceneCue, validateSceneParams } from './manifests.js';

const refuses = (engine, params, code) => {
  let caught = null;
  try { validateSceneParams(engine, params, '$.scenes[0].params'); } catch (error) { caught = error; }
  expect(caught?.code, `expected ${code}`).toBe(code);
  return caught;
};

describe('the manifests', () => {
  it('cover every engine the catalog lists, and still', () => {
    // Klee reaches a Current as Genesis (visual-registry.test.js says the same).
    const listed = ENGINE_CATALOG.filter(engine => engine.listed).map(engine => (engine.id === 'klee' ? 'genesis' : engine.id));
    for (const id of listed) expect(SCENE_ENGINES, id).toContain(id);
    expect(SCENE_ENGINES).toContain('still');
    expect(new Set(SCENE_ENGINES).size).toBe(SCENE_MANIFESTS.length);
  });

  it('bound every parameter, and mark cueable only what an engine changes while it runs', () => {
    for (const manifest of SCENE_MANIFESTS) {
      for (const [name, spec] of Object.entries(manifest.parameters)) {
        if (spec.type === 'enum') expect(spec.values, `${manifest.id}.${name}`).toContain(spec.default);
        else expect(fitParameter(spec, spec.default), `${manifest.id}.${name}`).toBe(spec.default);
      }
      for (const [cue, values] of Object.entries(manifest.cues)) {
        for (const [name, value] of Object.entries(values)) {
          expect(manifest.parameters[name]?.cueable, `${manifest.id} cue ${cue}`).toBe(true);
          expect(fitParameter(manifest.parameters[name], value)).toBe(value);
        }
      }
    }
    expect(manifestFor('attractor').parameters.intensity).toMatchObject({ minimum: 0.4, maximum: 0.75, cueable: true });
    expect(manifestFor('genesis').parameters.preset.cueable).toBe(false);
    expect(manifestFor('living-flame').parameters.preset.values).toEqual([...FLAME_PRESET_IDS]);
  });
});

describe('a scene’s parameters', () => {
  it('are kept when they fit, and refused by name and bound when they do not', () => {
    expect(validateSceneParams('attractor', { palette: 'jade', intensity: 0.5 }, '$')).toEqual({ palette: 'jade', intensity: 0.5 });
    expect(validateSceneParams('attractor', undefined, '$')).toEqual({});
    expect(validateSceneParams('turrell', {}, '$')).toEqual({});
    expect(refuses('attractor', { glow: 1 }, 'SCENE_PARAM').message).toContain('has no parameter glow');
    expect(refuses('turrell', { glow: 1 }, 'SCENE_PARAM').message).toContain('takes no parameters');
    refuses('attractor', { intensity: 0.9 }, 'SCENE_PARAM');
    refuses('attractor', { intensity: '0.5' }, 'SCENE_PARAM');
    refuses('attractor', { palette: 'mauve' }, 'SCENE_PARAM');
    refuses('living-flame', { symmetry: 2.5 }, 'SCENE_PARAM');
    refuses('nope', {}, 'SCENE_ENGINE');
  });
});

describe('cues', () => {
  it('name a manifest cue, or set a cueable parameter within bounds, and nothing else', () => {
    expect(cueCommands('attractor', 'bright')).toEqual([{ surface: 'attractor', parameter: 'intensity', value: 0.75 }]);
    expect(cueCommands('living-flame', 'warm')).toEqual([{ surface: 'living-flame', parameter: 'hue', value: 30 }]);
    expect(cueCommands('attractor', 'set:intensity=0.6')).toEqual([{ surface: 'attractor', parameter: 'intensity', value: 0.6 }]);
    expect(cueCommands('living-flame', 'set:hue=-40')).toEqual([{ surface: 'living-flame', parameter: 'hue', value: -40 }]);
    expect(cueCommands('attractor', 'set:intensity=0.9')).toBeNull();
    expect(cueCommands('attractor', 'set:palette=jade')).toBeNull();
    expect(cueCommands('genesis', 'calm')).toBeNull();
    expect(cueCommands('attractor', 'rotate')).toBeNull();
    expect(cueCommands('nope', 'calm')).toBeNull();
  });
});

describe('what a scene lowers to on the score', () => {
  it('is a field cue with the theme’s defaults under the scene’s parameters, for a persistent engine', () => {
    const cue = sceneCue({ engine: 'attractor', params: { palette: 'jade' } }, { system: 'thomas', palette: 'blue', form: 'mirror' });
    expect(cue).toEqual({ kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'jade', form: 'mirror' } });
    expect(sceneCue({ engine: 'genesis' })).toEqual({ kind: 'field', renderer: 'genesis', config: {} });
  });

  it('is a whole recipe for the Living Flame, from its preset with the scene’s macros laid over', () => {
    const cue = sceneCue({ engine: 'living-flame', params: { preset: 'violet-nebula', energy: 0.8, symmetry: 4 } });
    expect(cue.kind).toBe('field');
    expect(cue.renderer).toBe('living-flame');
    expect(cue.config.recipe.id).toBe('violet-nebula');
    expect(cue.config.recipe.macros.energy).toBe(0.8);
    expect(cue.config.recipe.symmetry).toBe(4);
    expect(cue.config.intensity).toBe(0.35);
  });

  it('is a procedural cue naming the engine, for a pattern engine; a still for none', () => {
    expect(sceneCue({ engine: 'ostensoria', params: { palette: 'ice' } })).toEqual({ kind: 'procedural', collections: ['ostensoria'], config: { palette: 'ice' } });
    expect(sceneCue({ engine: 'turrell' })).toEqual({ kind: 'procedural', collections: ['turrell'], config: {} });
    expect(sceneCue({ engine: 'still' })).toEqual({ kind: 'still' });
  });

  it('is a scene cue carrying the code, for a generated scene', () => {
    const code = 'export default () => ({ frame() {} })';
    expect(sceneCue({ id: 'vector', code })).toEqual({ kind: 'scene', sceneId: 'vector', code });
  });
});

describe('the guide’s account', () => {
  it('names every engine, its parameters with bounds, and its cues', () => {
    const text = describeManifests();
    expect(text).toContain('attractor: system (aizawa|thomas|halvorsen)');
    expect(text).toContain('intensity (0.4..0.75, cueable)');
    expect(text).toContain('turrell: no parameters');
    expect(text).toContain('cues calm, surge, warm, cool');
    expect(text).not.toContain('still:');
  });
});
