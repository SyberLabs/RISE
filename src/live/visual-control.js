import { ATTRACTOR_VISUAL_MANIFEST } from '../visuals/attractor-manifest.js';

const INVALID = Object.freeze({ ok: false, code: 'INVALID_CONTROL' });

/** Validate the complete internal command shape and bound its readable target. */
export function validateVisualCommand(command) {
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
  if (surface !== ATTRACTOR_VISUAL_MANIFEST.surface
    || parameter !== 'intensity') {
    return Object.freeze({ ok: false, code: 'UNSUPPORTED_SURFACE' });
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;

  const { minimum, maximum } = ATTRACTOR_VISUAL_MANIFEST.parameters.intensity;
  const effective = Math.min(maximum, Math.max(minimum, value));
  return Object.freeze({
    ok: true,
    command: Object.freeze({ surface, parameter, value: effective }),
    requested: value,
    effective
  });
}

/** Match the one reader-owned visual phrase; no extra instruction is interpreted. */
export function interpretVisualControl(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase().replace(/\s*[.!?]+$/u, '').trim().replace(/\s+/gu, ' ');
  return normalized === 'more vibrant' || normalized === 'please more vibrant';
}
