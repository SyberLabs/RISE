/**
 * What each native engine can be asked for: its parameters, their bounds, and
 * the cues that change the ones it can change while it runs
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §9).
 *
 * A manifest states only what the engine honours today, read from the
 * engine's own code: the attractor's systems, palettes and forms; Genesis's
 * presets; the Living Flame recipe's macros; the climate a harmonograph
 * follows; the palettes the plates take. Nothing here is a promise an engine
 * does not keep. A parameter is `cueable` only where the running engine
 * changes it in place (attractor intensity, the flame's macros); the rest
 * apply when the scene starts.
 *
 * The same manifests drive the Worker's admission (through beats.js), the
 * score's cues (rise-current.js), the runtime's cue delivery (runtime.js)
 * and the guide the model reads. They are the seed of the renderer contract
 * the RiseSDK will freeze.
 */
import { flamePreset, FLAME_PRESET_IDS } from '../visuals/living-flame/flame-presets.js';
import { fail, object } from '../core/current-validation.js';

const number = (minimum, maximum, fallback, cueable = false) => Object.freeze({ type: 'number', minimum, maximum, default: fallback, cueable });
const integer = (minimum, maximum, fallback) => Object.freeze({ type: 'integer', minimum, maximum, default: fallback, cueable: false });
const choice = (values, fallback) => Object.freeze({ type: 'enum', values: Object.freeze([...values]), default: fallback, cueable: false });

/** The attractor's own bounds (visual-control-contract.js keeps the same intensity window). */
const ATTRACTOR = Object.freeze({
  id: 'attractor', kind: 'field', surface: 'attractor', readableOverText: true,
  parameters: Object.freeze({
    system: choice(['aizawa', 'thomas', 'halvorsen'], 'aizawa'),
    palette: choice(['white', 'red', 'blue', 'gold', 'purple', 'neon', 'jade', 'rose', 'citrine', 'silver'], 'gold'),
    form: choice(['mirror', 'kaleido', 'bilateral'], 'mirror'),
    intensity: number(0.4, 0.75, 0.65, true),
    speed: number(0.25, 4, 1)
  }),
  cues: Object.freeze({ calm: Object.freeze({ intensity: 0.45 }), bright: Object.freeze({ intensity: 0.75 }) })
});

const GENESIS = Object.freeze({
  id: 'genesis', kind: 'field', surface: 'genesis', readableOverText: true,
  parameters: Object.freeze({ preset: choice(['harmonic', 'chaotic', 'twittering', 'architectural', 'gravitational'], 'harmonic') }),
  cues: Object.freeze({})
});

const LIVING_FLAME = Object.freeze({
  id: 'living-flame', kind: 'field', surface: 'living-flame', readableOverText: true,
  parameters: Object.freeze({
    preset: choice(FLAME_PRESET_IDS, FLAME_PRESET_IDS[0]),
    energy: number(0, 1, 0.35, true),
    complexity: number(0, 1, 0.55, true),
    hue: number(-180, 180, 0, true),
    symmetry: integer(1, 8, 1),
    intensity: number(0, 1, 0.35)
  }),
  cues: Object.freeze({ calm: Object.freeze({ energy: 0.15 }), surge: Object.freeze({ energy: 0.9 }), warm: Object.freeze({ hue: 30 }), cool: Object.freeze({ hue: -40 }) })
});

/**
 * A procedural pattern engine: drawn by the gallery field from the passage's
 * signal; configured through its cue. The catalog's Klee lines reach a Current
 * as Genesis, the persistent field above, so they are not listed twice.
 */
const pattern = (id, parameters = {}) => Object.freeze({
  id, kind: 'procedural', surface: id, readableOverText: true, parameters: Object.freeze(parameters), cues: Object.freeze({})
});

export const SCENE_MANIFESTS = Object.freeze([
  Object.freeze({ id: 'still', kind: 'still', surface: 'still', readableOverText: true, parameters: Object.freeze({}), cues: Object.freeze({}) }),
  ATTRACTOR,
  GENESIS,
  LIVING_FLAME,
  pattern('fractal'),
  pattern('turrell'),
  pattern('neural'),
  pattern('rockgarden'),
  pattern('harmonograph', { climate: choice(['auto', 'emberDawn', 'solarFlare', 'midnightWater', 'stormViolet', 'jadeVeil', 'whiteHeat'], 'auto') }),
  pattern('ostensoria', { palette: choice(['auto', 'iris', 'reliquary', 'ember', 'ice', 'verdant', 'lilac', 'teal', 'sepia', 'peacock', 'rose', 'citrine'], 'auto') }),
  pattern('apparitio', { palette: choice(['auto', 'prism', 'marian', 'ember', 'holo'], 'auto') })
]);

const BY_ID = new Map(SCENE_MANIFESTS.map(manifest => [manifest.id, manifest]));

/** The engines a scene may name. */
export const SCENE_ENGINES = Object.freeze(SCENE_MANIFESTS.map(manifest => manifest.id));

export function manifestFor(engine) {
  return BY_ID.get(engine) ?? null;
}

/** One value against one parameter's bounds; null when it does not fit. */
export function fitParameter(spec, value) {
  if (spec.type === 'enum') return spec.values.includes(value) ? value : null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (spec.type === 'integer' && !Number.isInteger(value)) return null;
  return value >= spec.minimum && value <= spec.maximum ? value : null;
}

/**
 * A scene's parameters against its engine's manifest: unknown names and
 * values out of bounds are refused with a path, as the Current refuses.
 */
export function validateSceneParams(engine, params, path) {
  const manifest = manifestFor(engine);
  if (!manifest) fail('SCENE_ENGINE', path, `Unknown engine; use one of ${SCENE_ENGINES.join(', ')}`);
  if (params === undefined) return {};
  const given = object(params, path);
  const clean = {};
  for (const [name, value] of Object.entries(given)) {
    const spec = manifest.parameters[name];
    if (!spec || ['__proto__', 'constructor', 'prototype'].includes(name)) {
      const known = Object.keys(manifest.parameters);
      fail('SCENE_PARAM', `${path}.${name.slice(0, 40)}`, known.length
        ? `${engine} has no parameter ${name.slice(0, 40)}; it has ${known.join(', ')}`
        : `${engine} takes no parameters`);
    }
    const fitted = fitParameter(spec, value);
    if (fitted === null) {
      fail('SCENE_PARAM', `${path}.${name}`, spec.type === 'enum'
        ? `${name} is one of ${spec.values.join(', ')}`
        : `${name} is a number from ${spec.minimum} to ${spec.maximum}`);
    }
    clean[name] = fitted;
  }
  return clean;
}

const SET = /^set:([A-Za-z]+)=(-?\d+(?:\.\d+)?|[A-Za-z]+)$/u;

/**
 * What a cue asks of a scene's engine, as the commands the running engine
 * takes (`{ surface, parameter, value }`), or null when the cue is not one of
 * this engine's: a named cue from its manifest, or `set:<parameter>=<value>`
 * on a parameter the engine changes while it runs.
 */
export function cueCommands(engine, cue) {
  const manifest = manifestFor(engine);
  if (!manifest || typeof cue !== 'string') return null;
  const named = manifest.cues[cue];
  if (named) return Object.entries(named).map(([parameter, value]) => ({ surface: manifest.surface, parameter, value }));
  const match = SET.exec(cue);
  if (!match) return null;
  const [, parameter, raw] = match;
  const spec = manifest.parameters[parameter];
  if (!spec || !spec.cueable) return null;
  const value = spec.type === 'enum' ? raw : Number(raw);
  return fitParameter(spec, value) === null ? null : [{ surface: manifest.surface, parameter, value }];
}

/**
 * The visual cue a scene lowers to on the score: a field cue for a persistent
 * engine (its config the theme's defaults under the scene's parameters; the
 * Living Flame a whole recipe from its preset and macros), a procedural cue
 * for a pattern engine, a still for none.
 * @param {{engine: string, params?: object}} scene
 * @param {object|null} themeConfig the theme's own defaults for this engine (rise-current.js)
 */
export function sceneCue(scene, themeConfig = null) {
  const manifest = manifestFor(scene.engine);
  const params = scene.params ?? {};
  if (!manifest || manifest.kind === 'still') return { kind: 'still' };
  if (manifest.id === 'living-flame') {
    const recipe = flamePreset(params.preset ?? LIVING_FLAME.parameters.preset.default);
    const macros = { ...recipe.macros };
    for (const key of ['energy', 'complexity', 'hue']) if (params[key] !== undefined) macros[key] = params[key];
    return {
      kind: 'field', renderer: 'living-flame',
      config: {
        recipe: { ...recipe, macros, ...(params.symmetry === undefined ? {} : { symmetry: params.symmetry }) },
        intensity: params.intensity ?? LIVING_FLAME.parameters.intensity.default
      }
    };
  }
  if (manifest.kind === 'field') return { kind: 'field', renderer: manifest.id, config: { ...(themeConfig ?? {}), ...params } };
  return { kind: 'procedural', collections: [manifest.id], config: { ...params } };
}

/** The guide's account of every engine and its parameters, one line each. */
export function describeManifests() {
  return SCENE_MANIFESTS.filter(manifest => manifest.id !== 'still').map(manifest => {
    const parameters = Object.entries(manifest.parameters).map(([name, spec]) => {
      const bounds = spec.type === 'enum' ? spec.values.join('|') : `${spec.minimum}..${spec.maximum}`;
      return `${name} (${bounds}${spec.cueable ? ', cueable' : ''})`;
    });
    const cues = Object.keys(manifest.cues);
    return `${manifest.id}: ${parameters.length ? parameters.join(', ') : 'no parameters'}${cues.length ? `; cues ${cues.join(', ')}` : ''}`;
  }).join('\n');
}
