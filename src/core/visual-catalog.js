import { ATTRACTOR_VISUAL_MANIFEST } from './visual-control-contract.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';
import {
  ATTRACTOR_FORMS,
  ATTRACTOR_PALETTES,
  ATTRACTOR_SYSTEMS,
  KLEE_PRESETS,
  normalizeFieldStyle,
  normalizeProceduralStyle
} from './visual-style-definitions.js';

const LIVE_VISUALS = Object.freeze({
  klee: 'genesis',
  attractor: 'attractor'
});

const TAGS_BY_ID = Object.freeze({
  klee: ['drawing', 'dynamic', 'graphic', 'genesis'],
  turrell: ['light', 'atmosphere', 'gallery'],
  fractal: ['flame', 'filament', 'dense', 'gallery'],
  neural: ['nodes', 'network', 'diagrammatic', 'gallery'],
  rockgarden: ['stones', 'sparse', 'greyscale', 'gallery'],
  harmonograph: ['line', 'pendulum', 'dynamic'],
  ostensoria: ['plate', 'radial', 'dynamic'],
  apparitio: ['apparition', 'spectral', 'dynamic'],
  attractor: ['filament', 'light', 'dynamic']
});

const ids = values => values.map(({ id }) => id);
const enumParameter = (options, value) => ({
  type: 'enum', options: ids(options), default: value, required: false
});
const numberParameter = (minimum, maximum, value) => ({
  type: 'number', minimum, maximum, default: value, required: false
});
const booleanParameter = value => ({ type: 'boolean', default: value, required: false });

const MANIFESTS = Object.freeze({
  attractor: {
    id: 'attractor', aliases: [], mapping: { renderer: 'attractor', collection: null },
    contexts: {
      specimen: { supported: true, parameters: {} },
      score: { supported: true, parameters: {
        system: enumParameter(ATTRACTOR_SYSTEMS, 'aizawa'),
        palette: enumParameter(ATTRACTOR_PALETTES, 'white'),
        form: { type: 'enum', options: [...ATTRACTOR_FORMS], default: 'mirror', required: false },
        intensity: numberParameter(0.2, 1, 0.65),
        speed: numberParameter(0.25, 4, 1),
        streaks: booleanParameter(false)
      } },
      current: { supported: true, parameters: {} },
      control: { supported: true, parameters: {
        intensity: { ...ATTRACTOR_VISUAL_MANIFEST.parameters.intensity, required: true }
      } }
    },
    accessibility: { reducedMotion: true }, cost: null
  },
  klee: {
    id: 'klee', aliases: ['genesis'], mapping: { renderer: 'genesis', collection: 'klee' },
    contexts: {
      specimen: { supported: true, parameters: {} },
      score: { supported: true, parameters: {
        preset: enumParameter(KLEE_PRESETS, 'random'),
        glass: booleanParameter(true)
      } },
      current: { supported: true, parameters: {} },
      control: { supported: false, parameters: {} }
    },
    accessibility: null, cost: null
  },
  neural: {
    id: 'neural', aliases: [], mapping: { renderer: null, collection: 'neural' },
    contexts: {
      specimen: { supported: true, parameters: {} },
      score: { supported: true, parameters: {} },
      current: { supported: false, parameters: {} },
      control: { supported: false, parameters: {} }
    },
    accessibility: null, cost: null
  }
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const VISUAL_CATALOG = Object.freeze(LISTED_PROCEDURAL_PATTERNS.map(pattern => {
  const liveVisual = LIVE_VISUALS[pattern.id] || null;
  const mutableControls = pattern.id === 'attractor' ? ['intensity'] : [];
  const parameters = pattern.id === 'attractor' ? ATTRACTOR_VISUAL_MANIFEST.parameters : {};

  return deepFreeze({
    id: pattern.id,
    name: pattern.name,
    description: pattern.description,
    tags: [...(TAGS_BY_ID[pattern.id] || [])],
    requires: { canvas: true },
    specimen: true,
    parameters,
    mutableControls,
    parameterDescription: pattern.id === 'attractor'
      ? 'Intensity is adjustable within the verified range.'
      : 'Uses fixed renderer defaults.',
    liveVisual,
    cost: null,
    manifest: MANIFESTS[pattern.id] || null
  });
}));

const CATALOG_BY_ID = new Map(VISUAL_CATALOG.map(item => [item.id, item]));

export function getCatalogVisual(id) {
  return CATALOG_BY_ID.get(id) || null;
}

function hasCanvas(capabilities) {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return false;
  const prototype = Object.getPrototypeOf(capabilities);
  return (prototype === Object.prototype || prototype === null) && capabilities.canvas === true;
}

export function queryVisualCatalog(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return Object.freeze([]);
  const {
    query = '',
    capabilities,
    liveOnly = false,
    includeUnavailable = false
  } = options;

  if (typeof query !== 'string' || query.length > 200) return Object.freeze([]);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const canDraw = hasCanvas(capabilities);

  return Object.freeze(VISUAL_CATALOG.filter(item => {
    if (!includeUnavailable && item.requires.canvas && !canDraw) return false;
    if (liveOnly && item.liveVisual === null) return false;
    if (terms.length === 0) return true;
    const searchable = [item.id, item.name, item.description, ...item.tags].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  }));
}

export function admitCatalogVisual(id, capabilities) {
  const item = getCatalogVisual(id);
  if (!item) return deepFreeze({ status: 'refused', code: 'UNKNOWN_VISUAL' });
  if (item.liveVisual === null) return deepFreeze({ status: 'refused', code: 'NOT_LIVE_SURFACE' });
  if (!hasCanvas(capabilities)) return deepFreeze({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' });
  return deepFreeze({ status: 'accepted', id: item.id, visual: item.liveVisual });
}

const REFUSED = Object.freeze({
  unknown: Object.freeze({ status: 'refused', code: 'UNKNOWN_VISUAL' }),
  unmanifested: Object.freeze({ status: 'refused', code: 'UNMANIFESTED_VISUAL' }),
  context: Object.freeze({ status: 'refused', code: 'UNSUPPORTED_CONTEXT' }),
  capability: Object.freeze({ status: 'refused', code: 'CAPABILITY_UNAVAILABLE' }),
  configuration: Object.freeze({ status: 'refused', code: 'INVALID_CONFIGURATION' })
});

/** Read a closed plain data record without evaluating accessors. */
function readDataRecord(value, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string' || !allowedKeys.has(key))) return null;
    const data = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value')) return null;
      data[key] = descriptor.value;
    }
    return data;
  } catch {
    return null;
  }
}

function validateConfiguration(config, parameters) {
  if (config === undefined) config = {};
  const data = readDataRecord(config, new Set(Object.keys(parameters)));
  if (!data) return null;
  for (const [key, value] of Object.entries(data)) {
    const descriptor = parameters[key];
    if (descriptor.type === 'enum' && !descriptor.options.includes(value)) return null;
    if (descriptor.type === 'number'
      && (typeof value !== 'number' || !Number.isFinite(value)
        || value < descriptor.minimum || value > descriptor.maximum)) return null;
    if (descriptor.type === 'boolean' && typeof value !== 'boolean') return null;
  }
  if (Object.entries(parameters).some(([key, descriptor]) => descriptor.required && !Object.hasOwn(data, key))) {
    return null;
  }
  return data;
}

/** Strictly admit a proposed configuration without changing legacy normalization. */
export function admitCatalogConfiguration(id, admission = {}) {
  const canonicalId = id === 'genesis' ? 'klee' : id;
  const item = getCatalogVisual(canonicalId);
  if (!item) return REFUSED.unknown;
  if (!item.manifest) return REFUSED.unmanifested;

  const options = readDataRecord(admission, new Set(['context', 'config', 'capabilities']));
  if (!options) return REFUSED.configuration;
  const context = options.context;
  if (typeof context !== 'string') return REFUSED.context;
  const contextManifest = item.manifest.contexts[context];
  if (!contextManifest?.supported) return REFUSED.context;

  const capabilities = readDataRecord(options.capabilities, new Set(['canvas']));
  if (!capabilities || capabilities.canvas !== true) return REFUSED.capability;

  const validated = validateConfiguration(options.config, contextManifest.parameters);
  if (!validated) return REFUSED.configuration;

  let config = validated;
  if (context === 'score') {
    if (item.id === 'attractor') config = normalizeFieldStyle('attractor', validated);
    else if (item.id === 'klee') config = normalizeFieldStyle('genesis', validated);
    else if (item.id === 'neural') config = normalizeProceduralStyle(['neural'], validated);
  }
  return deepFreeze({ status: 'accepted', id: item.id, context, config: { ...config } });
}
