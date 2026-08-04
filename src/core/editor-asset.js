export const EDITOR_ASSET_SCHEMA = 'rise.editor-asset.v1';

const LANES = new Set(['visual', 'audio', 'swell']);
const KINDS = new Set([
  'sequence-image', 'sourced-collection', 'procedural',
  'audio-bed', 'audio-swell', 'project-surface'
]);
const CAPABILITIES = new Set(['span', 'default', 'both']);
const PREVIEW_KINDS = new Set(['image', 'sample', 'generator', 'audio', 'surface']);
const AVAILABILITY = new Set(['ready', 'loading', 'unavailable']);
const COLORS = /^#[0-9a-f]{6}$/iu;

export class EditorAssetError extends Error {
  constructor(code, message, path = '$') {
    super(`${message} (${path})`);
    this.name = 'EditorAssetError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, message, path) {
  throw new EditorAssetError(code, message, path);
}

function exactString(value, path, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) {
    fail('EDITOR_ASSET_STRING', 'Expected a non-empty, trimmed string', path);
  }
  return value;
}

function plainClone(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (depth >= 4) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 64).map(item => plainClone(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 64)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    const cloned = plainClone(item, depth + 1);
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function normalizeCue(value, kind, path) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('EDITOR_ASSET_CUE', 'Cue template must be an object', path);
  }
  if (kind === 'audio-bed') {
    const allowed = new Set(['hold', 'silence', 'soundscape', 'tone']);
    if (!allowed.has(value.kind)) {
      fail('EDITOR_ASSET_CUE_KIND', 'Expected an audio-bed cue', `${path}.kind`);
    }
    const cue = { kind: value.kind };
    if (value.kind === 'soundscape') {
      cue.soundscapeId = exactString(value.soundscapeId, `${path}.soundscapeId`, 160);
    }
    if (value.kind === 'tone') {
      cue.presetId = exactString(value.presetId, `${path}.presetId`, 160);
    }
    if (value.fadeMs !== undefined) {
      if (!Number.isInteger(value.fadeMs) || value.fadeMs < 0 || value.fadeMs > 10000) {
        fail('EDITOR_ASSET_FADE', 'Audio fades must be 0–10000 milliseconds', `${path}.fadeMs`);
      }
      cue.fadeMs = value.fadeMs;
    }
    if (value.gain !== undefined) {
      if (typeof value.gain !== 'number' || !Number.isFinite(value.gain)
        || value.gain < 0 || value.gain > 1) {
        fail('EDITOR_ASSET_GAIN', 'Audio gain must be between 0 and 1', `${path}.gain`);
      }
      cue.gain = value.gain;
    }
    return cue;
  }
  if (kind === 'audio-swell') {
    if (value.kind !== 'swell') {
      fail('EDITOR_ASSET_CUE_KIND', 'Expected an audio-swell cue', `${path}.kind`);
    }
    const cue = {
      kind: 'swell',
      swellId: exactString(value.swellId, `${path}.swellId`, 160)
    };
    if (value.fadeMs !== undefined) {
      if (!Number.isInteger(value.fadeMs) || value.fadeMs < 0 || value.fadeMs > 10000) {
        fail('EDITOR_ASSET_FADE', 'Audio fades must be 0–10000 milliseconds', `${path}.fadeMs`);
      }
      cue.fadeMs = value.fadeMs;
    }
    return cue;
  }
  const expectedKind = kind === 'procedural' ? 'procedural' : 'sourced';
  if (value.kind !== expectedKind) {
    fail('EDITOR_ASSET_CUE_KIND', `Expected a ${expectedKind} cue`, `${path}.kind`);
  }
  if (!Array.isArray(value.collections) || value.collections.length !== 1) {
    fail('EDITOR_ASSET_COLLECTION', 'A visual asset must name exactly one collection', `${path}.collections`);
  }
  const cue = {
    kind: expectedKind,
    collections: [exactString(value.collections[0], `${path}.collections[0]`, 240)]
  };
  if (value.engines !== undefined) {
    if (expectedKind !== 'procedural' || !Array.isArray(value.engines)
      || value.engines.length < 1 || value.engines.length > 8) {
      fail('EDITOR_ASSET_ENGINES', 'Engines are supported only by procedural cues', `${path}.engines`);
    }
    cue.engines = value.engines.map((engine, index) =>
      exactString(engine, `${path}.engines[${index}]`, 160));
  }
  return cue;
}

export function validateEditorAsset(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('EDITOR_ASSET_RECORD', 'Expected an editor asset object', '$');
  }
  const allowed = new Set([
    'schema', 'id', 'lane', 'kind', 'name', 'capability', 'editor',
    'provenance', 'cueTemplate', 'availability'
  ]);
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) fail('EDITOR_ASSET_FIELD', `Unknown editor asset field ${unknown}`, `$.${unknown}`);
  if (value.schema !== EDITOR_ASSET_SCHEMA) {
    fail('EDITOR_ASSET_SCHEMA', `Expected ${EDITOR_ASSET_SCHEMA}`, '$.schema');
  }
  if (!LANES.has(value.lane)) fail('EDITOR_ASSET_LANE', 'Unsupported lane', '$.lane');
  if (!KINDS.has(value.kind)) fail('EDITOR_ASSET_KIND', 'Unsupported asset kind', '$.kind');
  if (!CAPABILITIES.has(value.capability)) {
    fail('EDITOR_ASSET_CAPABILITY', 'Unsupported capability', '$.capability');
  }
  if (!value.editor || typeof value.editor !== 'object' || Array.isArray(value.editor)) {
    fail('EDITOR_ASSET_EDITOR', 'Editor metadata is required', '$.editor');
  }
  const preview = value.editor.preview;
  if (!preview || typeof preview !== 'object' || !PREVIEW_KINDS.has(preview.kind)) {
    fail('EDITOR_ASSET_PREVIEW', 'A supported preview is required', '$.editor.preview');
  }
  const color = typeof value.editor.color === 'string' && COLORS.test(value.editor.color)
    ? value.editor.color.toLowerCase()
    : '#7fd4a4';
  const availability = value.availability || { state: 'ready', reason: null };
  if (!AVAILABILITY.has(availability.state)) {
    fail('EDITOR_ASSET_AVAILABILITY', 'Unsupported availability state', '$.availability.state');
  }
  const cueTemplate = normalizeCue(value.cueTemplate, value.kind, '$.cueTemplate');
  if (value.kind === 'project-surface' && cueTemplate) {
    fail('EDITOR_ASSET_SURFACE_CUE', 'Project surfaces cannot define clip cues', '$.cueTemplate');
  }
  if ((value.kind === 'sourced-collection' || value.kind === 'procedural'
    || value.kind === 'audio-bed' || value.kind === 'audio-swell') && !cueTemplate) {
    fail('EDITOR_ASSET_CUE_REQUIRED', 'This asset kind requires a cue template', '$.cueTemplate');
  }
  const asset = {
    schema: EDITOR_ASSET_SCHEMA,
    id: exactString(value.id, '$.id', 240),
    lane: value.lane,
    kind: value.kind,
    name: exactString(value.name, '$.name'),
    capability: value.capability,
    editor: {
      color,
      preview: {
        kind: preview.kind,
        ref: exactString(preview.ref, '$.editor.preview.ref', 12 * 1024 * 1024)
      }
    },
    provenance: plainClone(value.provenance) || {},
    cueTemplate,
    availability: {
      state: availability.state,
      reason: typeof availability.reason === 'string'
        ? availability.reason.trim().slice(0, 300) || null
        : null
    }
  };
  return freeze(asset);
}

export function createEditorAsset(value) {
  return validateEditorAsset({ schema: EDITOR_ASSET_SCHEMA, ...value });
}

export function editorAssetSupports(value, action) {
  const asset = validateEditorAsset(value);
  if (action === 'span') return asset.capability === 'span' || asset.capability === 'both';
  if (action === 'default') return asset.capability === 'default' || asset.capability === 'both';
  return false;
}
