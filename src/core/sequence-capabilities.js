/**
 * Launch-scoped capabilities granted to one exact sequence.
 *
 * These are not reusable reader preferences. A capability travels with the
 * sequence that earned it and is normalized again at the compiler boundary so
 * restored or imported JSON cannot turn a global control on by itself.
 */

export const SEQUENCE_CAPABILITIES = Object.freeze({
  RECITATION_AUDIO: 'recitation-audio'
});

const KNOWN_CAPABILITIES = new Set(Object.values(SEQUENCE_CAPABILITIES));

export function normalizeSequenceCapabilities(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.filter(item =>
    typeof item === 'string' && KNOWN_CAPABILITIES.has(item)))].sort());
}

export function sequenceHasCapability(value, capability) {
  return normalizeSequenceCapabilities(value).includes(capability);
}
