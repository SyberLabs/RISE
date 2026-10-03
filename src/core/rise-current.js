import { compileSession } from './session-compiler.js';
import { createExperienceProgram, EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { snapCharacterRangeToTokens } from './source-span.js';
import { hasLiteralForbidden, SOURCE_MARKER, SOURCE_SCORE_CUT } from './chunker.js';
import { JEV_COLOR_THEMES } from './jev-color-themes.js';
import { jevColors } from './jev-palette.js';

export const RISE_CURRENT_SCHEMA = 'rise.current.v1';

/** The bounds of a sealed Current. The realtime protocol lowers through them, so it shares them. */
export const RISE_CURRENT_LIMITS = Object.freeze({
  segments: 16,
  segmentText: 4_000,
  totalText: 20_000,
  dives: 8,
  diveText: 600,
  title: 200,
  name: 120,
  id: 120
});

/** The closed visual catalog. A Current names one of these and nothing else. */
export const RISE_CURRENT_VISUALS = Object.freeze(['still', 'attractor', 'genesis']);

/** The closed theme choice: the shipped color themes, so RISE has one color vocabulary. */
export const RISE_CURRENT_THEME_IDS = JEV_COLOR_THEMES;

export class RiseCurrentError extends Error {
  constructor(code, path, message) {
    super(`${message} (${path})`);
    this.name = 'RiseCurrentError';
    this.code = code;
    this.path = path;
  }
}

const fail = (code, path, message) => { throw new RiseCurrentError(code, path, message); };

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail('CURRENT_OBJECT', path, 'Expected a plain object');
  }
  return value;
}

function keys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      fail('CURRENT_UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
}

function label(value, max, path, code = 'CURRENT_TEXT') {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    fail(code, path, `Expected nonblank text of at most ${max} characters`);
  }
  return value;
}

function id(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > RISE_CURRENT_LIMITS.id) {
    fail('CURRENT_ID', path, `Expected a trimmed id of at most ${RISE_CURRENT_LIMITS.id} characters`);
  }
  return value;
}

function anchor(value, text, path) {
  const source = object(value, path);
  keys(source, ['fromCharacter', 'toCharacter', 'quoteStart', 'quoteEnd'], path);
  const { fromCharacter, toCharacter } = source;
  if (!Number.isInteger(fromCharacter) || !Number.isInteger(toCharacter)
    || fromCharacter < 0 || toCharacter <= fromCharacter || toCharacter > text.length) {
    fail('CURRENT_ANCHOR', path, 'Expected an exact half-open character span inside the segment');
  }
  const snapped = snapCharacterRangeToTokens(text, fromCharacter, toCharacter);
  if (!snapped || snapped.fromCharacter !== fromCharacter || snapped.toCharacter !== toCharacter) {
    fail('CURRENT_ANCHOR', path, 'Dive spans must cover complete whitespace tokens');
  }
  const quoteStart = label(source.quoteStart, 500, `${path}.quoteStart`);
  const quoteEnd = label(source.quoteEnd, 500, `${path}.quoteEnd`);
  if (quoteStart !== quoteStart.trim() || quoteEnd !== quoteEnd.trim()) {
    fail('CURRENT_QUOTE', path, 'Quote fingerprints must be trimmed');
  }
  if (quoteStart.includes('\0') || quoteEnd.includes('\0')) {
    fail('CURRENT_QUOTE', path, 'Quote fingerprints cannot contain NUL');
  }
  const selected = text.slice(fromCharacter, toCharacter);
  if (!selected.startsWith(quoteStart) || !selected.endsWith(quoteEnd)) {
    fail('CURRENT_QUOTE', path, 'Quote fingerprints do not match the selected text');
  }
  return { fromCharacter, toCharacter, quoteStart, quoteEnd };
}

/** True when a literal text holds what is never text: the score cut, or a stand-in that escapes a control. */
export { hasLiteralForbidden };

/** True when text contains a playback marker the chunker would read as an instruction. */
export function hasReservedMarker(text) {
  return new RegExp(SOURCE_MARKER.source, 'i').test(text)
    || text.includes(SOURCE_SCORE_CUT) || text.includes('|');
}

/** Check one Dive's anchor against the text it points into; returns the clean anchor. */
export function validateDiveAnchor(value, text, path) {
  return anchor(value, text, path);
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * What each theme draws with: renderer ids only, never a number or a color.
 * Page colors come from the theme's own Jev palette (jevColors), not from here.
 */
export const RISE_CURRENT_THEMES = freeze({
  classic: { attractor: { system: 'aizawa', palette: 'gold', form: 'mirror' }, genesis: { preset: 'harmonic' } },
  amethyst: { attractor: { system: 'thomas', palette: 'purple', form: 'kaleido' }, genesis: { preset: 'chaotic' } },
  prism: { attractor: { system: 'halvorsen', palette: 'neon', form: 'mirror' }, genesis: { preset: 'chaotic' } },
  ember: { attractor: { system: 'halvorsen', palette: 'red', form: 'bilateral' }, genesis: { preset: 'twittering' } },
  cobalt: { attractor: { system: 'thomas', palette: 'blue', form: 'mirror' }, genesis: { preset: 'architectural' } },
  jade: { attractor: { system: 'aizawa', palette: 'jade', form: 'bilateral' }, genesis: { preset: 'gravitational' } },
  rose: { attractor: { system: 'aizawa', palette: 'rose', form: 'kaleido' }, genesis: { preset: 'harmonic' } },
  citrine: { attractor: { system: 'thomas', palette: 'citrine', form: 'bilateral' }, genesis: { preset: 'twittering' } },
  silver: { attractor: { system: 'halvorsen', palette: 'silver', form: 'kaleido' }, genesis: { preset: 'architectural' } }
});

/** Strict, detached input from an author or model. No runtime objects are accepted. */
export function validateRiseCurrent(input) {
  const source = object(input, '$');
  keys(source, ['schema', 'id', 'title', 'theme', 'origin', 'segments'], '$');
  if (source.schema !== RISE_CURRENT_SCHEMA) fail('CURRENT_SCHEMA', '$.schema', 'Unknown Current schema');
  const currentId = id(source.id, '$.id');
  const title = label(source.title, RISE_CURRENT_LIMITS.title, '$.title');
  const theme = source.theme;
  if (theme !== undefined && !RISE_CURRENT_THEME_IDS.includes(theme)) {
    fail('CURRENT_THEME', '$.theme', `Unknown theme; use one of ${RISE_CURRENT_THEME_IDS.join(', ')}`);
  }

  const origin = object(source.origin, '$.origin');
  keys(origin, ['kind', 'name', 'provider'], '$.origin');
  if (!['model', 'human'].includes(origin.kind)) fail('CURRENT_ORIGIN', '$.origin.kind', 'Unknown origin kind');
  const cleanOrigin = { kind: origin.kind, name: label(origin.name, RISE_CURRENT_LIMITS.name, '$.origin.name') };
  if (origin.kind === 'model') {
    cleanOrigin.provider = label(origin.provider, RISE_CURRENT_LIMITS.name, '$.origin.provider', 'CURRENT_PROVIDER');
  } else if (origin.provider !== undefined) {
    fail('CURRENT_PROVIDER', '$.origin.provider', 'A human origin cannot name a model provider');
  }

  if (!Array.isArray(source.segments) || source.segments.length < 1
    || source.segments.length > RISE_CURRENT_LIMITS.segments) {
    fail('CURRENT_SEGMENTS', '$.segments', `Expected 1 to ${RISE_CURRENT_LIMITS.segments} segments`);
  }
  let total = 0;
  const seen = new Set();
  const segments = Array.from(source.segments, (item, index) => {
    const path = `$.segments[${index}]`;
    const segment = object(item, path);
    keys(segment, ['id', 'text', 'visual', 'dives', 'literal'], path);
    if (segment.literal !== undefined && typeof segment.literal !== 'boolean') {
      fail('CURRENT_LITERAL', `${path}.literal`, 'literal is true or false');
    }
    const literal = segment.literal === true;
    const segmentId = id(segment.id, `${path}.id`);
    if (seen.has(segmentId)) fail('CURRENT_DUPLICATE_ID', `${path}.id`, 'Duplicate segment id');
    seen.add(segmentId);
    const text = label(segment.text, RISE_CURRENT_LIMITS.segmentText, `${path}.text`);
    // A literal segment says its bars and bracketed words are words; it still cannot carry the score cut
    // or the stand-ins that escape it, which are never text.
    if (literal ? hasLiteralForbidden(text) : hasReservedMarker(text)) {
      fail('CURRENT_RESERVED_TEXT', `${path}.text`, literal
        ? 'Literal text cannot contain the score cut or the stand-ins that escape it'
        : 'Text contains a reserved playback marker');
    }
    total += text.length;
    if (total > RISE_CURRENT_LIMITS.totalText) {
      fail('CURRENT_TOTAL_TEXT', '$.segments', `Current exceeds ${RISE_CURRENT_LIMITS.totalText.toLocaleString('en-US')} characters`);
    }
    const visual = segment.visual === undefined ? 'still' : segment.visual;
    if (!RISE_CURRENT_VISUALS.includes(visual)) {
      fail('CURRENT_VISUAL', `${path}.visual`, 'Unknown visual selection');
    }
    const rawDives = segment.dives === undefined ? [] : segment.dives;
    if (!Array.isArray(rawDives) || rawDives.length > RISE_CURRENT_LIMITS.dives) {
      fail('CURRENT_DIVES', `${path}.dives`, 'Expected at most eight Dive notes');
    }
    const diveIds = new Set();
    const dives = Array.from(rawDives, (item, diveIndex) => {
      const divePath = `${path}.dives[${diveIndex}]`;
      const dive = object(item, divePath);
      keys(dive, ['id', 'text', 'anchor'], divePath);
      const diveId = id(dive.id, `${divePath}.id`);
      if (diveIds.has(diveId)) fail('CURRENT_DUPLICATE_ID', `${divePath}.id`, 'Duplicate Dive id');
      diveIds.add(diveId);
      return {
        id: diveId,
        text: label(dive.text, RISE_CURRENT_LIMITS.diveText, `${divePath}.text`),
        anchor: anchor(dive.anchor, text, `${divePath}.anchor`)
      };
    });
    return { id: segmentId, text, visual, dives, ...(literal ? { literal: true } : {}) };
  });
  return freeze({
    schema: RISE_CURRENT_SCHEMA, id: currentId, title, ...(theme === undefined ? {} : { theme }),
    origin: cleanOrigin, segments
  });
}

/** Lower a sealed external answer into the existing score and Session path. */
export function compileRiseCurrent(input, { projection = 'stream' } = {}) {
  if (!['stream', 'page'].includes(projection)) {
    fail('CURRENT_PROJECTION', '$.projection', 'Unknown projection');
  }
  const current = validateRiseCurrent(input);
  const look = current.theme === undefined ? null : RISE_CURRENT_THEMES[current.theme];
  const sourceIds = current.segments.map(segment => segment.id);
  const program = createExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: current.id,
    authority: current.origin.kind === 'model' ? 'proposed' : 'user',
    editable: true,
    tracks: [
      {
        id: 'current-movements', kind: 'movement',
        clips: current.segments.map((segment, index) => ({
          id: `movement-${index}`, anchor: { sourceIds: [segment.id] },
          data: { index, title: null }
        }))
      },
      {
        id: 'current-visuals', kind: 'visual',
        clips: current.segments.map((segment, index) => ({
          id: `visual-${index}`, anchor: { sourceIds: [segment.id] },
          cue: segment.visual === 'still'
            ? { kind: 'still' }
            : { kind: 'field', renderer: segment.visual, config: look ? { ...look[segment.visual] } : {} }
        })),
        fallback: { kind: 'still' }
      },
      {
        id: 'current-dives', kind: 'thread',
        clips: current.segments.flatMap((segment, index) => segment.dives.map((dive, noteIndex) => ({
          id: `dive-${index}-${noteIndex}`,
          anchor: { sourceIds: [segment.id], ...dive.anchor },
          cue: { kind: 'gloss', text: dive.text },
          metadata: { externalId: dive.id }
        })))
      }
    ]
  });
  return compileSession({
    title: current.title,
    sources: current.segments.map((segment, index) => ({
      id: segment.id,
      name: `${current.title} · ${index + 1}`,
      type: 'text/plain',
      providerId: current.origin.kind === 'model' ? current.origin.provider : 'local',
      provenance: { origin: current.origin, currentId: current.id },
      data: segment.text,
      ...(segment.literal ? { literal: true } : {})
    })),
    experienceProgram: program,
    visualConfig: {
      visualMode: current.segments.some(segment => segment.visual !== 'still') ? 'interlocution' : 'off',
      interlocution: { presentation: 'continuous', procedural: [], sourced: [] }
    },
    provenance: { origin: current.origin, currentId: current.id },
    chunkMode: 'sentence',
    projection,
    ...(look ? { presentation: { colorTheme: current.theme, colors: jevColors(current.theme) } } : {})
  });
}
