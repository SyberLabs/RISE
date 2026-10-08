import { compileSession } from './session-compiler.js';
import { RiseCurrentError, fail, hasLiteralForbidden, hasReservedMarker, id as trimmedId, keys, label, object } from './current-validation.js';
import { BEAT_TYPES, lowerBeats, validateBeats, validateScenes } from './beats.js';
import { hasMath } from './math-text.js';
import { STYLES, styleOf } from './styles.js';
import { cueCommands, sceneCue } from '../scenes/manifests.js';

export { RiseCurrentError, hasLiteralForbidden, hasReservedMarker };

/** A trimmed id within the Current's own bound. */
const id = (value, path) => trimmedId(value, RISE_CURRENT_LIMITS.id, path);
import { createExperienceProgram, EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { snapCharacterRangeToTokens } from './source-span.js';
import { JEV_COLOR_THEMES } from './jev-color-themes.js';
import { jevColors } from './jev-palette.js';

export const RISE_CURRENT_SCHEMA = 'rise.current.v1';
/** The Current with beats and scenes (beats.js); a v1 Current stays valid beside it. */
export const RISE_CURRENT_SCHEMA_V2 = 'rise.current.v2';
/** The styles a v2 Current may name: guidance and defaults bundled under one name (styles.js). */
export const RISE_CURRENT_STYLES = Object.freeze(Object.keys(STYLES));

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

/**
 * The looks a Current may name, by id (looks.js, in its order). The Worker
 * admits the id and learns nothing else; the card lowers the look through its
 * own field, typeface, size and theme (current-look.js).
 */
export const RISE_CURRENT_LOOKS = Object.freeze(['plain', 'gallery', 'nocturne', 'garden', 'flame', 'signal', 'iris', 'revel', 'vigil', 'inlay']);

/** The closed theme choice: the shipped color themes, so RISE has one color vocabulary. */
export const RISE_CURRENT_THEME_IDS = JEV_COLOR_THEMES;

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
/** What every Current carries before its passages or beats: id, title, theme, look and origin. */
function validateHead(source) {
  const currentId = id(source.id, '$.id');
  const title = label(source.title, RISE_CURRENT_LIMITS.title, '$.title');
  const theme = source.theme;
  if (theme !== undefined && !RISE_CURRENT_THEME_IDS.includes(theme)) {
    fail('CURRENT_THEME', '$.theme', `Unknown theme; use one of ${RISE_CURRENT_THEME_IDS.join(', ')}`);
  }
  const look = source.look;
  if (look !== undefined && !RISE_CURRENT_LOOKS.includes(look)) {
    fail('CURRENT_LOOK', '$.look', `Unknown look; use one of ${RISE_CURRENT_LOOKS.join(', ')}`);
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

  return { currentId, title, theme, look, cleanOrigin };
}

export function validateRiseCurrent(input) {
  const source = object(input, '$');
  if (source.schema === RISE_CURRENT_SCHEMA_V2) return validateRiseCurrentV2(source);
  keys(source, ['schema', 'id', 'title', 'theme', 'look', 'origin', 'segments'], '$');
  if (source.schema !== RISE_CURRENT_SCHEMA) fail('CURRENT_SCHEMA', '$.schema', 'Unknown Current schema');
  const { currentId, title, theme, look, cleanOrigin } = validateHead(source);
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
    // Under a look, a passage that names no visual draws the look's field.
    const visual = segment.visual === undefined && look === undefined ? 'still' : segment.visual;
    if (visual !== undefined && !RISE_CURRENT_VISUALS.includes(visual)) {
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
    return { id: segmentId, text, ...(visual === undefined ? {} : { visual }), dives, ...(literal ? { literal: true } : {}) };
  });
  return freeze({
    schema: RISE_CURRENT_SCHEMA, id: currentId, title, ...(theme === undefined ? {} : { theme }),
    ...(look === undefined ? {} : { look }),
    origin: cleanOrigin, segments
  });
}

/**
 * A v2 Current: beats over scenes, lowered here to the passages the rest of
 * this module scores and compiles. Each passage carries what is shown as its
 * text, and beside it what is spoken, its hold, its shown time and its
 * typography (beats.js).
 */
function validateRiseCurrentV2(source) {
  keys(source, ['schema', 'id', 'title', 'theme', 'look', 'origin', 'style', 'type', 'scenes', 'beats'], '$');
  const { currentId, title, theme, look, cleanOrigin } = validateHead(source);
  const style = source.style;
  if (style !== undefined && !RISE_CURRENT_STYLES.includes(style)) {
    fail('CURRENT_STYLE', '$.style', `Unknown style; use one of ${RISE_CURRENT_STYLES.join(', ')}`);
  }
  let type;
  if (source.type !== undefined) {
    const given = object(source.type, '$.type');
    keys(given, ['text', 'caption'], '$.type');
    type = {};
    for (const role of ['text', 'caption']) {
      if (given[role] === undefined) continue;
      if (!BEAT_TYPES.includes(given[role])) fail('BEAT_TYPE', `$.type.${role}`, `Unknown face; use one of ${BEAT_TYPES.join(', ')}`);
      type[role] = given[role];
    }
  }
  const scenes = validateScenes(source.scenes, '$.scenes');
  const beats = validateBeats(source.beats, '$.beats', { scenes });
  const lowered = lowerBeats({ scenes, beats, typography: styleOf(style)?.typography ?? null });
  const segments = lowered.segments.map(segment => ({ ...segment, dives: [] }));
  return freeze({
    schema: RISE_CURRENT_SCHEMA_V2, id: currentId, title, ...(theme === undefined ? {} : { theme }),
    ...(look === undefined ? {} : { look }), origin: cleanOrigin, ...(style === undefined ? {} : { style }),
    ...(type === undefined ? {} : { type }), scenes, beats, segments, audio: lowered.audio,
    spokenIds: [...lowered.spokenIds], unspokenIds: [...lowered.unspokenIds]
  });
}

/**
 * Give a v2 Session's atoms the time its beats ask for: a hold's one silent
 * atom lasts the hold, and a shown beat's atoms share its hold in proportion
 * to their words. The voice's texts and the beats ride on the Session for the
 * runtime and the layers.
 */
function timeBeats(session, current) {
  const unspoken = new Set(current.unspokenIds);
  const voiceWaitsFor = new Set();
  let afterSilence = false;
  for (const segment of current.segments) {
    const atoms = session.atoms.filter(atom => atom.sourceId === segment.id);
    // The seam into a passage no voice says is timed with it: the speech governor would wait for words never said.
    const seam = session.atoms[session.atoms.indexOf(atoms[0]) - 1];
    if (unspoken.has(segment.id) && seam?.seam) seam.beatTimed = true;
    // A spoken passage after one no voice says waits for the reading to reach it before the voice is given it (runtime.js).
    if (afterSilence && !unspoken.has(segment.id)) voiceWaitsFor.add(segment.id);
    afterSilence = unspoken.has(segment.id);
    // The beat's typography and cue ride on its atoms for the layers that render them.
    if (Object.keys(segment.beat).length > 0) for (const atom of atoms) atom.beat = segment.beat;
    if (segment.scene) {
      // The beat's cue as the running engine's commands, for the conductor to deliver when the beat begins;
      // a generated scene takes the cue by name, through the scene's one parameter.
      const { cue } = segment.beat;
      const commands = !cue ? null
        : segment.scene.code !== undefined ? [{ surface: 'scene', parameter: 'cue', value: cue }]
          : cueCommands(segment.scene.engine, cue) ?? [];
      for (const atom of atoms) {
        atom.scene = segment.scene.id;
        if (commands) atom.cueCommands = commands;
      }
    }
    if (segment.hold) {
      for (const atom of atoms) {
        atom.duration = segment.hold.ms;
        atom.hold = { ...segment.hold };
      }
    } else if (segment.shownMs !== undefined) {
      const worded = atoms.filter(atom => atom.content);
      const letters = worded.reduce((sum, atom) => sum + atom.content.length, 0);
      let given = 0;
      worded.forEach((atom, index) => {
        atom.duration = index === worded.length - 1
          ? segment.shownMs - given
          : Math.round(segment.shownMs * (atom.content.length / letters));
        given += atom.duration;
        atom.beatTimed = true;
      });
    }
  }
  session.spokenIds = new Set(current.spokenIds);
  session.unspokenIds = unspoken;
  session.voiceWaitsFor = voiceWaitsFor;
  session.spokenText = new Map(current.segments.filter(segment => segment.spoken !== null).map(segment => [segment.id, segment.spoken]));
  session.beats = current.beats;
  session.scenes = current.scenes;
  // The style's library defaults reach a generated scene through the Chamber (styles.js).
  session.style = current.style ?? null;
  // Maths in what is shown: the Chamber fetches the typesetter as the reading opens, not at its first formula.
  session.hasMath = current.segments.some(segment => hasMath(segment.text));
  return session;
}

/** Map validated Current data once for the durable pair and Session wrapper. */
function materializeValidatedRiseCurrent(current, lowered = null) {
  // A look lowered for the card brings its theme when the Current names none.
  const themeId = current.theme ?? lowered?.theme;
  // The faces for text and captions: the style's, under the Current's own, role by role.
  const typeFaces = { ...styleOf(current.style)?.typography.type, ...current.type };
  const faces = Object.keys(typeFaces).length > 0;
  const look = themeId === undefined ? null : RISE_CURRENT_THEMES[themeId];
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
        // Every passage has a clip: one that names no visual takes the look's, since the reader
        // schedules a program only when it has passages, and the fallback alone would draw nothing.
        clips: current.segments.flatMap((segment, index) => {
          // A v2 passage under a scene draws that scene, by its engine's manifest.
          if (segment.scene) {
            return [{ id: `visual-${index}`, anchor: { sourceIds: [segment.id] }, cue: sceneCue(segment.scene, look?.[segment.scene.engine] ?? null) }];
          }
          if (segment.visual === undefined) {
            return lowered ? [{ id: `visual-${index}`, anchor: { sourceIds: [segment.id] }, cue: lowered.fallbackCue }] : [];
          }
          return [{
            id: `visual-${index}`, anchor: { sourceIds: [segment.id] },
            cue: segment.visual === 'still'
              ? { kind: 'still' }
              : { kind: 'field', renderer: segment.visual, config: look ? { ...look[segment.visual] } : {} }
          }];
        }),
        fallback: lowered?.fallbackCue ?? { kind: 'still' }
      },
      ...(current.audio?.length ? [{
        id: 'current-audio', kind: 'audio',
        clips: current.audio.map((item, index) => ({ id: `audio-${index}`, anchor: { sourceIds: [item.segmentId] }, cue: { ...item.cue } })),
        fallback: { kind: 'silence', fadeMs: 500 }
      }] : []),
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
  const sources = current.segments.map((segment, index) => ({
    id: segment.id,
    name: `${current.title} · ${index + 1}`,
    type: 'text/plain',
    providerId: current.origin.kind === 'model' ? current.origin.provider : 'local',
    provenance: { origin: current.origin, currentId: current.id },
    data: segment.text,
    ...(segment.literal ? { literal: true } : {})
  }));
  return {
    program,
    sources,
    title: current.title,
    provenance: { origin: current.origin, currentId: current.id },
    visualConfig: {
      visualMode: current.segments.some(segment => segment.visual !== undefined && segment.visual !== 'still')
        || (lowered !== null && lowered.fallbackCue.kind !== 'still') ? 'interlocution' : 'off',
      interlocution: lowered?.shelf ?? {
        presentation: 'continuous',
        // The pattern engines the scenes draw with, so the gallery field admits them.
        procedural: [...new Set(current.segments.map(segment => segment.scene).filter(scene => scene && sceneCue(scene).kind === 'procedural').map(scene => scene.engine))],
        sourced: []
      }
    },
    ...(look || faces ? {
      presentation: {
        ...(look ? { colorTheme: themeId, colors: jevColors(themeId), ...lowered?.type } : {}),
        // The faces a v2 Current asks for, by role or id, for its text and its captions (typography.js).
        ...(faces ? { typeFaces } : {})
      }
    } : {})
  };
}

/** Materialize a validated Current as a detached, JSON-safe score and source pair. */
export function materializeRiseCurrent(input) {
  const { program, sources } = materializeValidatedRiseCurrent(validateRiseCurrent(input));
  return { program, sources };
}

/**
 * Lower a sealed external answer into the existing Session playback path.
 * `lowerLook` (current-look.js) turns a named look into its field, typeface,
 * size and theme; without it a look is carried and not drawn.
 */
export function compileRiseCurrent(input, { projection = 'stream', lowerLook = null } = {}) {
  if (!['stream', 'page'].includes(projection)) {
    fail('CURRENT_PROJECTION', '$.projection', 'Unknown projection');
  }
  const current = validateRiseCurrent(input);
  const lowered = current.look !== undefined && typeof lowerLook === 'function' ? lowerLook(current) : null;
  const { program, sources, title, provenance, visualConfig, ...presentation } = materializeValidatedRiseCurrent(current, lowered);
  const session = compileSession({
    title,
    sources,
    experienceProgram: program,
    visualConfig,
    provenance,
    chunkMode: 'sentence',
    projection,
    ...presentation
  });
  return current.schema === RISE_CURRENT_SCHEMA_V2 ? timeBeats(session, current) : session;
}
