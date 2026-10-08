const intensity = Object.freeze({
  type: 'number',
  minimum: 0.4,
  maximum: 0.75,
  default: 0.65,
  cueable: true
});

export const ATTRACTOR_VISUAL_MANIFEST = Object.freeze({
  surface: 'attractor',
  parameters: Object.freeze({ intensity }),
  readableOverText: true,
  requiresCanvas: true
});

const INVALID = Object.freeze({ ok: false, code: 'INVALID_CONTROL' });
/** A cue name, as a beat may give one (beats.js). */
const NAME = /^[A-Za-z0-9_:=.-]{1,40}$/u;

/**
 * Validate the shared visual command shape against a surface's manifest
 * (src/scenes/manifests.js, or the attractor's own here): the parameter must
 * be one the surface changes while it runs; a number is held to its bounds,
 * an enum to its values, a name (a generated scene's cue) to the cue pattern.
 */
export function validateVisualCommand(command, manifest = ATTRACTOR_VISUAL_MANIFEST) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) return INVALID;
  const prototype = Object.getPrototypeOf(command);
  if (prototype !== Object.prototype && prototype !== null) return INVALID;
  const keys = Reflect.ownKeys(command);
  if (keys.length !== 3 || !['surface', 'parameter', 'value'].every(key => keys.includes(key))) {
    return INVALID;
  }
  const descriptors = Object.getOwnPropertyDescriptors(command);
  if (keys.some(key => !Object.hasOwn(descriptors[key], 'value'))) return INVALID;

  const { surface, parameter, value } = command;
  const spec = manifest && surface === manifest.surface && typeof parameter === 'string'
    && Object.hasOwn(manifest.parameters, parameter) ? manifest.parameters[parameter] : null;
  if (!spec || spec.cueable === false) return Object.freeze({ ok: false, code: 'UNSUPPORTED_SURFACE' });
  if (spec.type === 'enum' || spec.type === 'name') {
    if (spec.type === 'enum' ? !spec.values.includes(value) : typeof value !== 'string' || !NAME.test(value)) return INVALID;
    return Object.freeze({ ok: true, command: Object.freeze({ surface, parameter, value }), requested: value, effective: value });
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  const { minimum, maximum } = spec;
  const effective = Math.min(maximum, Math.max(minimum, value));
  return Object.freeze({
    ok: true,
    command: Object.freeze({ surface, parameter, value: effective }),
    requested: value,
    effective
  });
}
