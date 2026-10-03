import { ATTRACTOR_VISUAL_MANIFEST } from './visual-control-contract.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';

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
    cost: null
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
