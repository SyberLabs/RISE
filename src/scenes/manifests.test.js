import { describe, expect, it } from 'vitest';
import { ENGINE_CATALOG } from '../core/visual-registry.js';
import { FLAME_PRESET_IDS } from '../visuals/living-flame/flame-presets.js';
import { collectionEngine, cueCommands, describeManifests, fitParameter, manifestFor, SCENE_ENGINES, SCENE_MANIFESTS, sceneCue, validateSceneParams } from './manifests.js';

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

  it('take the swarm and the rotary pendulums as start-only choices, each defaulting to the engine as it was', () => {
    expect(manifestFor('attractor').parameters.trace).toEqual({ type: 'enum', values: ['filament', 'swarm'], default: 'filament', cueable: false });
    expect(manifestFor('harmonograph').parameters.pendulums).toEqual({ type: 'enum', values: ['lateral', 'rotary'], default: 'lateral', cueable: false });
    expect(validateSceneParams('attractor', { trace: 'swarm', system: 'thomas' }, '$')).toEqual({ trace: 'swarm', system: 'thomas' });
    expect(validateSceneParams('harmonograph', { pendulums: 'rotary', climate: 'jadeVeil' }, '$')).toEqual({ pendulums: 'rotary', climate: 'jadeVeil' });
    expect(refuses('attractor', { trace: 'ribbon' }, 'SCENE_PARAM').message).toContain('trace is one of filament, swarm');
    expect(refuses('harmonograph', { pendulums: 'triple' }, 'SCENE_PARAM').message).toContain('pendulums is one of lateral, rotary');
    expect(cueCommands('attractor', 'set:trace=swarm')).toBeNull();
    expect(cueCommands('harmonograph', 'set:pendulums=rotary')).toBeNull();
    expect(sceneCue({ engine: 'harmonograph', params: { pendulums: 'rotary' } }))
      .toEqual({ kind: 'procedural', collections: ['harmonograph'], config: { pendulums: 'rotary' } });
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

  it('is a sourced cue naming the reviewed collection, for a collection; which work shows is RISE’s choice', () => {
    expect(sceneCue({ engine: 'astronomy' })).toEqual({ kind: 'sourced', collections: ['sci-astronomy'] });
    expect(manifestFor('astronomy')).toMatchObject({ kind: 'sourced', parameters: {}, cues: {} });
    expect(() => validateSceneParams('astronomy', { subject: 'nebula' }, '$.params')).toThrow(/astronomy takes no parameters/u);
  });

  it('is read back to the collection’s name from the cue on screen; any other cue has none', () => {
    expect(collectionEngine(sceneCue({ engine: 'astronomy' }))).toBe('astronomy');
    expect(collectionEngine({ kind: 'sourced', collections: ['aic-landscapes'] })).toBeNull();
    expect(collectionEngine(sceneCue({ engine: 'turrell' }))).toBeNull();
    expect(collectionEngine(null)).toBeNull();
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
    expect(text).toContain('trace (filament|swarm)');
    expect(text).toContain('pendulums (lateral|rotary)');
  });

  it('leaves out the parameters it is asked to withhold, and nothing else', () => {
    const text = describeManifests({ withheld: ['trace', 'pendulums'] });
    expect(text).not.toMatch(/trace|pendulums|swarm|rotary/u);
    expect(text).toContain('speed (0.25..4); cues calm, bright');
    expect(text).toContain('harmonograph: climate (auto|emberDawn|solarFlare|midnightWater|stormViolet|jadeVeil|whiteHeat)\n');
    expect(text.split('\n')).toHaveLength(describeManifests().split('\n').length);
  });

  it('says what a collection is, since its name alone does not: RISE chooses the work, so the words do not name it', () => {
    expect(describeManifests()).toContain('astronomy: no parameters; a photograph of the sky RISE chooses from its reviewed Astronomy collection and hangs with its credit: say what such skies show, never which object this one is');
  });

  it('describes only the engines it is given, when given them', () => {
    const text = describeManifests({ engines: ['attractor', 'turrell'] });
    expect(text.split('\n').map(line => line.split(':')[0])).toEqual(['attractor', 'turrell']);
  });
});
