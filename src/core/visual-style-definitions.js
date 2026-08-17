export const ATTRACTOR_SYSTEMS = Object.freeze([
  Object.freeze({ id: 'aizawa', name: 'Aizawa', icon: '∮', description: 'Toroidal bloom — orbits folding through a luminous sphere' }),
  Object.freeze({ id: 'thomas', name: 'Thomas', icon: '∿', description: 'Cyclically symmetric weave — slow, looping lattice' }),
  Object.freeze({ id: 'halvorsen', name: 'Halvorsen', icon: '❋', description: 'Threefold sweep — spiral arms in rotational symmetry' })
]);

export const ATTRACTOR_PALETTES = Object.freeze([
  Object.freeze({ id: 'white', name: 'White', swatch: '#ffffff' }),
  Object.freeze({ id: 'red', name: 'Red', swatch: '#ffc4aa' }),
  Object.freeze({ id: 'blue', name: 'Blue', swatch: '#c6e2ff' }),
  Object.freeze({ id: 'gold', name: 'Gold', swatch: '#ffe8b0' }),
  Object.freeze({ id: 'purple', name: 'Purple', swatch: '#e0ccff' })
]);

export const ATTRACTOR_FORMS = Object.freeze(['mirror', 'kaleido', 'bilateral']);

export const KLEE_PRESETS = Object.freeze([
  Object.freeze({ id: 'random', name: 'Random' }),
  Object.freeze({ id: 'architectural', name: 'Architectural' }),
  Object.freeze({ id: 'chaotic', name: 'Chaotic' }),
  Object.freeze({ id: 'harmonic', name: 'Harmonic' }),
  Object.freeze({ id: 'gravitational', name: 'Gravitational' }),
  Object.freeze({ id: 'twittering', name: 'Twittering' })
]);

export const HARMONOGRAPH_CLIMATES = Object.freeze([
  Object.freeze({ id: 'auto', name: 'Auto' }),
  Object.freeze({ id: 'emberDawn', name: 'Ember' }),
  Object.freeze({ id: 'solarFlare', name: 'Solar' }),
  Object.freeze({ id: 'midnightWater', name: 'Midnight' }),
  Object.freeze({ id: 'stormViolet', name: 'Storm' }),
  Object.freeze({ id: 'jadeVeil', name: 'Jade' }),
  Object.freeze({ id: 'whiteHeat', name: 'White' })
]);

export const OSTENSORIA_PALETTES = Object.freeze([
  Object.freeze({ id: 'auto', name: 'Auto' }),
  Object.freeze({ id: 'iris', name: 'Iris' }),
  Object.freeze({ id: 'reliquary', name: 'Reliquary' }),
  Object.freeze({ id: 'ember', name: 'Ember' }),
  Object.freeze({ id: 'ice', name: 'Ice' }),
  Object.freeze({ id: 'verdant', name: 'Verdant' }),
  Object.freeze({ id: 'lilac', name: 'Lilac' }),
  Object.freeze({ id: 'teal', name: 'Teal' }),
  Object.freeze({ id: 'sepia', name: 'Sepia' }),
  Object.freeze({ id: 'peacock', name: 'Peacock' })
]);

export const APPARITIO_PALETTES = Object.freeze([
  Object.freeze({ id: 'auto', name: 'Auto' }),
  Object.freeze({ id: 'prism', name: 'Prism' }),
  Object.freeze({ id: 'marian', name: 'Marian' }),
  Object.freeze({ id: 'ember', name: 'Ember' }),
  Object.freeze({ id: 'holo', name: 'Holo' })
]);

export const FOCAL_GLYPHS = Object.freeze([
  Object.freeze({ id: 'breath', name: 'Breath', icon: '◯', dynamic: true, description: 'Gentle pulsing circle' }),
  Object.freeze({ id: 'anchor', name: 'Anchor', icon: '⚓', dynamic: false, description: 'Stable grounding point' }),
  Object.freeze({ id: 'lotus', name: 'Lotus', icon: '❀', dynamic: false, description: 'Centered bloom' }),
  Object.freeze({ id: 'eye', name: 'Eye', icon: '◉', dynamic: true, description: 'Soft focus ring' }),
  Object.freeze({ id: 'star', name: 'Star', icon: '✦', dynamic: false, description: 'Fixed point of light' }),
  Object.freeze({ id: 'wave', name: 'Wave', icon: '≈', dynamic: true, description: 'Gentle oscillation' }),
  Object.freeze({ id: 'void', name: 'Void', icon: '●', dynamic: false, description: 'Pure stillness' }),
  Object.freeze({ id: 'rose', name: 'Rose', icon: '❂', dynamic: true, description: 'Procedural rose window' })
]);

export const ROSE_MODES = Object.freeze([
  Object.freeze({ id: 'vitrum', name: 'Vitrum' }),
  Object.freeze({ id: 'verbum', name: 'Verbum' })
]);

const ids = values => new Set(values.map(value => value.id));
const KLEE_IDS = ids(KLEE_PRESETS);
const HARMONOGRAPH_IDS = ids(HARMONOGRAPH_CLIMATES);
const OSTENSORIA_IDS = ids(OSTENSORIA_PALETTES);
const APPARITIO_IDS = ids(APPARITIO_PALETTES);
const FOCAL_IDS = ids(FOCAL_GLYPHS);
const ROSE_IDS = ids(ROSE_MODES);
const ATTRACTOR_SYSTEM_IDS = ids(ATTRACTOR_SYSTEMS);
const ATTRACTOR_PALETTE_IDS = ids(ATTRACTOR_PALETTES);
const ATTRACTOR_FORM_IDS = new Set(ATTRACTOR_FORMS);

const title = value => typeof value === 'string' && value
  ? value.charAt(0).toUpperCase() + value.slice(1)
  : '';

export const VISUAL_STYLE_DEFINITIONS = Object.freeze({
  focal: Object.freeze({
    id: 'focal', label: 'Focal', group: 'fields', configurable: true,
    defaults: Object.freeze({ type: 'standard', standardGlyph: 'breath', roseMode: 'vitrum' })
  }),
  attractor: Object.freeze({
    id: 'attractor', label: 'Attractor', group: 'fields', configurable: true,
    defaults: Object.freeze({ system: 'aizawa', palette: 'white', form: 'mirror' })
  }),
  genesis: Object.freeze({
    id: 'genesis', label: 'Genesis', group: 'fields', configurable: true,
    defaults: Object.freeze({ preset: 'random', glass: true })
  }),
  klee: Object.freeze({
    id: 'klee', label: 'Klee Lines', group: 'procedural', configurable: true,
    defaults: Object.freeze({ preset: 'random' })
  }),
  harmonograph: Object.freeze({
    id: 'harmonograph', label: 'Harmonograph', group: 'procedural', configurable: true,
    defaults: Object.freeze({ climate: 'auto' })
  }),
  ostensoria: Object.freeze({
    id: 'ostensoria', label: 'Iris Plates', group: 'procedural', configurable: true,
    defaults: Object.freeze({ palette: 'auto' })
  }),
  apparitio: Object.freeze({
    id: 'apparitio', label: 'Spectral Plates', group: 'procedural', configurable: true,
    defaults: Object.freeze({ palette: 'auto' })
  })
});

export function normalizeFieldStyle(renderer, value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (renderer === 'focal') {
    const personalAssetId = typeof source.personalAssetId === 'string'
      ? source.personalAssetId.trim().slice(0, 160)
      : '';
    if (source.type === 'personal' && personalAssetId) {
      // Personal focal cues retain only durable identity. The hydrated
      // sequence asset supplies its document-lifetime URL at runtime.
      return Object.freeze({ type: 'personal', personalAssetId });
    }
    const standardGlyph = FOCAL_IDS.has(source.standardGlyph) ? source.standardGlyph : 'breath';
    return Object.freeze({
      type: 'standard',
      standardGlyph,
      ...(standardGlyph === 'rose'
        ? { roseMode: ROSE_IDS.has(source.roseMode) ? source.roseMode : 'vitrum' }
        : {})
    });
  }
  if (renderer === 'attractor') {
    return Object.freeze({
      system: ATTRACTOR_SYSTEM_IDS.has(source.system) ? source.system : 'aizawa',
      palette: ATTRACTOR_PALETTE_IDS.has(source.palette) ? source.palette : 'white',
      form: ATTRACTOR_FORM_IDS.has(source.form) ? source.form : 'mirror'
    });
  }
  if (renderer === 'genesis') {
    return Object.freeze({
      preset: KLEE_IDS.has(source.preset) ? source.preset : 'random',
      glass: source.glass !== false
    });
  }
  return Object.freeze({});
}

export function normalizeProceduralStyle(collections, value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const family = Array.isArray(collections) && collections.length === 1 ? collections[0] : null;
  if (family === 'klee') {
    return Object.freeze({ preset: KLEE_IDS.has(source.preset) ? source.preset : 'random' });
  }
  if (family === 'harmonograph') {
    return Object.freeze({ climate: HARMONOGRAPH_IDS.has(source.climate) ? source.climate : 'auto' });
  }
  if (family === 'ostensoria') {
    return Object.freeze({ palette: OSTENSORIA_IDS.has(source.palette) ? source.palette : 'auto' });
  }
  if (family === 'apparitio') {
    return Object.freeze({ palette: APPARITIO_IDS.has(source.palette) ? source.palette : 'auto' });
  }
  return Object.freeze({});
}

export function normalizeConfigurableVisualCue(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.kind === 'field') {
    return Object.freeze({
      kind: 'field', renderer: value.renderer,
      config: normalizeFieldStyle(value.renderer, value.config)
    });
  }
  if (value.kind === 'procedural') {
    const cue = {
      kind: 'procedural',
      collections: Object.freeze([...(value.collections || [])])
    };
    if (Array.isArray(value.engines) && value.engines.length) cue.engines = Object.freeze([...value.engines]);
    const config = normalizeProceduralStyle(cue.collections, value.config);
    if (Object.keys(config).length) cue.config = config;
    return Object.freeze(cue);
  }
  return value;
}

export function personalFocalAssetIdFromCue(cue) {
  if (cue?.kind !== 'field' || cue.renderer !== 'focal') return null;
  const config = normalizeFieldStyle('focal', cue.config);
  return config.type === 'personal' ? config.personalAssetId : null;
}

export function visualCueStyleSummary(cue) {
  if (cue?.kind === 'field' && cue.renderer === 'focal') {
    const config = normalizeFieldStyle('focal', cue.config);
    if (config.type === 'personal') return 'Personal image';
    return `${title(config.standardGlyph)}${config.standardGlyph === 'rose' ? ` · ${title(config.roseMode)}` : ''}`;
  }
  if (cue?.kind === 'field' && cue.renderer === 'attractor') {
    const config = normalizeFieldStyle('attractor', cue.config);
    return `${title(config.system)} · ${title(config.palette)} · ${title(config.form)}`;
  }
  if (cue?.kind === 'field' && cue.renderer === 'genesis') {
    const config = normalizeFieldStyle('genesis', cue.config);
    return `${title(config.preset)}${config.glass ? ' · Glass' : ''}`;
  }
  if (cue?.kind === 'procedural' && cue.collections?.[0] === 'klee') {
    return title(normalizeProceduralStyle(cue.collections, cue.config).preset);
  }
  if (cue?.kind === 'procedural' && cue.collections?.[0] === 'harmonograph') {
    return title(normalizeProceduralStyle(cue.collections, cue.config).climate);
  }
  if (cue?.kind === 'procedural' && cue.collections?.[0] === 'ostensoria') {
    return title(normalizeProceduralStyle(cue.collections, cue.config).palette);
  }
  if (cue?.kind === 'procedural' && cue.collections?.[0] === 'apparitio') {
    return title(normalizeProceduralStyle(cue.collections, cue.config).palette);
  }
  return '';
}

export function visualCueIsConfigurable(cue) {
  return Boolean(
    cue?.kind === 'field'
    || (cue?.kind === 'procedural' && ['klee', 'harmonograph', 'ostensoria', 'apparitio'].includes(cue.collections?.[0]))
  );
}
