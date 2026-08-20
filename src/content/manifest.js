/**
 * Deep-freeze a content manifest.
 *
 * Lived in `atrium/constants.js` beside the Atrium's schema version, its era
 * list and its node kinds, and was imported from there by seven Chapel files
 * that wanted none of those — a utility reached through a room it has nothing
 * to do with. When the Atrium was cut, this is the part of that file the rest
 * of the content layer actually needed.
 *
 * Recursive by design: a manifest is nested, and freezing only the top level
 * leaves every value inside it writable, which is the failure a frozen
 * manifest exists to prevent.
 */
export function freezeManifest(value) {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(freezeManifest);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}
