/**
 * Admit: a composer's answer held to everything a card's Current is held to
 * at the connector's door (worker/mcp-server.mjs: the size bound, the Current
 * validator, scene code and figure admission), plus the digest's own rules:
 * the sources, and no number that no included pull request states. Pure: the
 * verdict depends on the text and the included pull requests alone.
 */
import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../../src/core/rise-current.js';
import { admitSceneCode, describeDiagnostic } from '../../src/core/scene-admission.js';
import { admitSvg } from '../../src/core/svg-admission.js';
import { MCP_CURRENT_BYTES, serializedUtf8Bytes } from '../../src/live/hosts/mcp-size.js';
import { COMPOSER_PROVIDER, sourcesProblems } from '../../src/core/changes/contract.js';
import { figureProblems } from '../../src/core/figures/figure-kit.js';
import { processTalkProblems } from '../../src/core/quality/process-talk.js';
import { shownRuns } from './held.js';

const MAX_LINE = 300;
const MAX_SCENE_LINES = 10;
const MAX_NUMBER_LINES = 10;

/** Text fit to show a model: no control characters, clipped. */
const clean = text => {
  const line = String(text).replace(/[\u0000-\u001F\u007F]/gu, ' ');
  return line.length <= MAX_LINE ? line : `${line.slice(0, MAX_LINE - 1)}…`;
};

/** One JSON object, bare or inside one code fence; anything else throws. */
export function parseModelJson(text) {
  if (typeof text !== 'string') throw new Error('The answer was not text');
  const trimmed = text.trim();
  const fenced = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(trimmed);
  const value = JSON.parse(fenced ? fenced[1] : trimmed);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('The answer was not a JSON object');
  return value;
}

/** The lines a scene or figure refusal gives, in the connector's words. */
function sceneRefusals(current) {
  const lines = [];
  for (const scene of current.scenes ?? []) {
    const verdict = scene?.code !== undefined ? admitSceneCode(scene.code) : scene?.svg !== undefined ? admitSvg(scene.svg) : { ok: true };
    if (verdict.ok) continue;
    for (const diagnostic of verdict.diagnostics) lines.push(clean(`Scene "${scene.id}" was refused: ${describeDiagnostic(diagnostic)}`));
  }
  return lines.slice(0, MAX_SCENE_LINES);
}

const NUMBER = /\d+(?:[.,]\d+)*/g;
const numbersIn = text => (String(text).match(NUMBER) ?? []).map(token => token.replace(/,/g, ''));

/** The numbers the included pull requests and the dates of the period state. */
function statedNumbers(pulls, period) {
  const stated = new Set(pulls.flatMap(pull => numbersIn(`${pull.number} ${pull.title} ${pull.body ?? ''}`)));
  for (const at of [period.from, period.to]) {
    const date = new Date(at);
    for (const part of [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]) stated.add(String(part));
  }
  return stated;
}

/** A figure shows its text nodes; its markup, comments and style sheets are not read. */
const figureText = svg => svg.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ');

/** A colour written as a string literal (#hex, rgb(), hsl()), quotes included: never text a scene shows. */
const COLOUR = /^.(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?)\([^)]*\)).$/iu;

/** A code scene shows its labels as string literals; its coordinates, colours and other numbers are not read. */
const codeText = code => (code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [])
  .filter(literal => !COLOUR.test(literal)).join(' ');

function unstated(texts, stated, what, whose = 'included pull request') {
  const found = new Set();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const number of numbersIn(text)) if (!stated.has(number)) found.add(number);
  }
  return [...found].slice(0, MAX_NUMBER_LINES).map(number =>
    `${what} says "${number}", which no ${whose} states; use only numbers written in the pull requests, or say it without a number`);
}

/** The same rule for one code scene: the numbers in its string literals. */
export function codeNumberProblems(code, { pulls, period }) {
  return unstated([codeText(code)], statedNumbers(pulls, period), 'The scene', 'pull request the picture cites');
}

/** Numbers the Current says or shows, its figures included, that no included pull request and no date of the period states. */
export function numberProblems(current, { pulls, period }) {
  const figures = (current.scenes ?? []).map(scene => (typeof scene?.svg === 'string' ? figureText(scene.svg) : typeof scene?.code === 'string' ? codeText(scene.code) : undefined));
  return unstated([current.title, ...current.beats.flatMap(beat => [beat?.say, beat?.show]), ...figures], statedNumbers(pulls, period), 'The Current');
}

/**
 * The same rule for one figure: the numbers its visible text shows. `pulls` are the pull requests the picture cites,
 * so a figure's numbers come from the changes it shows, not from anywhere in the week.
 */
export function figureNumberProblems(svg, { pulls, period }) {
  return unstated([figureText(svg)], statedNumbers(pulls, period), 'The figure', 'pull request the picture cites');
}

/** Beats one scene may be held for before a picture or an engine starts again. */
export const HELD_BEATS = 4;
/** RISE's engines a digest may run: for mood, at the opening or the close. */
export const MAX_ENGINES = 2;
/** The beats at either end where an engine may start. */
const MOOD_BEATS = 2;
const BRIEF_MIN = 20;
const BRIEF_MAX = 300;
/** Pictures a digest may ask RISE's illustrator for: a diagram no kit kind can express. */
export const MAX_BESPOKE = 2;

const isKit = picture => Object.keys(picture).length === 3 && ['beat', 'refs', 'kit'].every(key => Object.hasOwn(picture, key));
const isBrief = picture => Object.keys(picture).length === 4 && ['beat', 'refs', 'medium', 'brief'].every(key => Object.hasOwn(picture, key));
/** A picture's refs: one or more pull request numbers, each once. */
const isRefList = refs => Array.isArray(refs) && refs.length > 0 && refs.every(Number.isInteger) && new Set(refs).size === refs.length;

/** Every string and printed number a kit figure shows: what the number rule reads (a bar's max is a scale, never printed). */
export function kitTexts(kit) {
  const texts = [];
  const walk = (value, key) => {
    if (key === 'max' || key === 'kind' || key === 'shape' || key === 'glyph') return;
    if (typeof value === 'string') texts.push(value);
    else if (typeof value === 'number') texts.push(String(value));
    else if (Array.isArray(value)) value.forEach(item => walk(item));
    else if (value !== null && typeof value === 'object') for (const [name, item] of Object.entries(value)) walk(item, name);
  };
  walk(kit);
  return texts;
}

/**
 * What breaks the digest's composition: RISE's engines only for mood (at most two, started at the opening or the
 * close); every other picture either a kit figure RISE draws from the composer's data or, for a diagram no kit kind can
 * express, a brief the illustrator draws (at most two); at least one picture, and no scene held for more than four
 * beats. The plan is held to it before anything is drawn.
 */
export function compositionProblems(current, pictures, { beatRefs = {} } = {}) {
  const problems = [];
  const beats = current.beats;
  const scenes = new Map((current.scenes ?? []).map(scene => [scene.id, scene]));
  for (const scene of scenes.values()) {
    if (scene.engine === undefined) problems.push(`Scene "${scene.id}" is drawn by the composer; draw a picture through "pictures" instead: a kit figure, or a brief the illustrator draws. "current.scenes" holds RISE’s engines only`);
  }
  const engines = [...scenes.values()].filter(scene => scene.engine !== undefined);
  if (engines.length > MAX_ENGINES) problems.push(`The Current declares ${engines.length} of RISE’s engines; at most ${MAX_ENGINES} of RISE’s engines, for mood at the opening or the close. Explain with pictures`);
  beats.forEach((beat, index) => {
    const scene = scenes.get(beat?.scene);
    if (scene?.engine !== undefined && index >= MOOD_BEATS && index < beats.length - MOOD_BEATS) {
      problems.push(`beat ${index} starts RISE’s engine "${scene.id}"; an engine sets the mood at the opening or the close only (the first or last ${MOOD_BEATS} beats). Explain the middle with a picture`);
    }
  });
  if (!Array.isArray(pictures)) return [...problems, '"pictures" must be a list of { beat, refs, kit } or { beat, refs, medium, brief }'];
  if (pictures.length === 0) problems.push('"pictures" needs at least one picture: one for each change or group of changes that a picture explains');
  const bespoke = pictures.filter(picture => picture !== null && typeof picture === 'object' && !Array.isArray(picture) && isBrief(picture)).length;
  if (bespoke > MAX_BESPOKE) problems.push(`"pictures" has ${bespoke} pictures for the illustrator; at most ${MAX_BESPOKE}. Draw a measurement, a sequence, a sorting or a layout as a kit figure (bars, flow, columns, stack)`);
  const starts = new Set();
  pictures.forEach((picture, index) => {
    const where = `"pictures"[${index}]`;
    if (picture === null || typeof picture !== 'object' || Array.isArray(picture) || !(isKit(picture) || isBrief(picture))) {
      problems.push(`${where} is either { beat, refs, kit } or { beat, refs, medium, brief }`);
      return;
    }
    if (!isRefList(picture.refs)) {
      problems.push(`${where}.refs lists the pull requests the picture shows: one or more numbers, each among its beat\u2019s refs`);
    } else if (Number.isInteger(picture.beat)) {
      const own = Array.isArray(beatRefs[picture.beat]) ? beatRefs[picture.beat] : [];
      if (!picture.refs.every(number => own.includes(number))) {
        problems.push(`${where}.refs [${picture.refs.join(', ')}] are not all among beat ${picture.beat}\u2019s refs [${own.join(', ')}]; a picture shows what its own beat speaks of: move it to that beat, or picture this beat\u2019s change`);
      }
    }
    if (!Number.isInteger(picture.beat) || picture.beat < 0 || picture.beat >= beats.length) {
      problems.push(`${where} names beat ${String(picture.beat).slice(0, 12)}, but the Current has beats 0 to ${beats.length - 1}`);
    } else if (starts.has(picture.beat)) {
      problems.push(`${where} names beat ${picture.beat} twice; one picture starts on a beat`);
    } else if (beats[picture.beat]?.scene !== undefined) {
      problems.push(`${where}: beat ${picture.beat} already starts a scene; a picture starts on a beat that names none`);
    } else {
      starts.add(picture.beat);
    }
    if (isKit(picture)) {
      for (const line of figureProblems(picture.kit)) problems.push(`${where}.kit: ${line}`);
      return;
    }
    if (!['figure', 'scene'].includes(picture.medium)) problems.push(`${where}.medium is figure or scene`);
    if (typeof picture.brief !== 'string' || picture.brief.trim().length < BRIEF_MIN || picture.brief.length > BRIEF_MAX) {
      problems.push(`${where}.brief is ${BRIEF_MIN} to ${BRIEF_MAX} characters: what to draw, concretely, from the pull requests’ own words`);
    }
  });
  // What each beat shows, as the run will end it (held.js): a picture until its beats move on, then RISE's eye.
  const shown = new Map();
  for (const picture of pictures) {
    if (picture !== null && typeof picture === 'object' && Number.isInteger(picture.beat) && starts.has(picture.beat)) {
      shown.set(picture.beat, { refs: isRefList(picture.refs) ? picture.refs : null });
    }
  }
  beats.forEach((beat, index) => { if (beat?.scene !== undefined) shown.set(index, { refs: null }); });
  const { runs, eye } = shownRuns(beats.length, shown, beatRefs);
  const needsEye = eye && !engines.some(scene => scene.engine === 'still');
  const room = Math.max(0, 8 - engines.length - (needsEye ? 1 : 0));
  if (pictures.length > room) {
    problems.push(`"pictures" has ${pictures.length}; a Current has room for at most ${room} pictures beside its ${engines.length} engine${engines.length === 1 ? '' : 's'}${needsEye ? ' and RISE’s eye, which shows where a picture’s beats move on' : ''}`);
  }
  for (const [start, length] of runs) {
    if (length > HELD_BEATS) problems.push(`beat ${start} holds one scene for ${length} beats; start a picture at least every ${HELD_BEATS} beats`);
  }
  return problems;
}

/**
 * Each beat's `refs` as the contract's `sources` (beat index to pull request numbers), and the beats without them:
 * `refs` sits beside a beat's words in the composer's answer and never reaches the Current.
 */
function splitRefs(beats) {
  const sources = {};
  const refsGiven = {};
  const clean = beats.map((beat, index) => {
    if (beat === null || typeof beat !== 'object' || Array.isArray(beat) || !Object.hasOwn(beat, 'refs')) return beat;
    const { refs, ...rest } = beat;
    refsGiven[index] = refs;
    if (!(Array.isArray(refs) && refs.length === 0)) sources[String(index)] = refs;
    return rest;
  });
  return { beats: clean, sources, refsGiven };
}

/**
 * The sources rules, worded for refs on the beats. An included change no beat cites is not a refusal: the run moves it
 * out of the reading (`unspoken`), so only a bad or foreign ref is refused here.
 */
function refsProblems(sources, beatCount, included) {
  const cited = new Set(Object.values(sources).flat());
  return sourcesProblems(sources, beatCount, included.filter(number => cited.has(number))).map(line => line
    .replace(/^"sources" beat (\d+)/u, 'beat $1 "refs"'));
}

/**
 * The verdict on one composer answer: `{ ok: true, current, sources, pictures, unspoken }`,
 * the Current with its origin set to the composer, its pictures, and the included
 * changes no beat cites (the run moves them out of the reading), or
 * `{ ok: false, diagnostics, rules }`, the lines a repair call is given and how many
 * each rule gave.
 */
export function admitComposition(text, { pulls, model, period }) {
  const refused = (rule, line) => ({ ok: false, diagnostics: [line], rules: { [rule]: 1 } });
  let value;
  try {
    value = parseModelJson(text);
  } catch {
    return refused('answer', 'The answer must be one JSON object, {"current": ..., "pictures": [...]}, with nothing before or after it');
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !['current', 'pictures'].every(key => Object.hasOwn(value, key))) {
    return refused('answer', 'The answer must have exactly two fields, "current" and "pictures"; each beat carries its own "refs"');
  }
  const given = value.current;
  if (given === null || typeof given !== 'object' || Array.isArray(given) || given.schema !== RISE_CURRENT_SCHEMA_V2 || !Array.isArray(given.beats)) {
    return refused('answer', `"current" must be a Current of beats, "schema": "${RISE_CURRENT_SCHEMA_V2}"`);
  }
  const { beats, sources, refsGiven } = splitRefs(given.beats);
  const current = { ...given, beats, origin: { kind: 'model', name: model, provider: COMPOSER_PROVIDER } };
  if (serializedUtf8Bytes(current) > MCP_CURRENT_BYTES) {
    return refused('size', `RISE refused this Current: The Current exceeds the ${MCP_CURRENT_BYTES.toLocaleString('en-US')}-byte MCP limit`);
  }
  try {
    validateRiseCurrent(current);
  } catch (error) {
    return refused('current', clean(`RISE refused this Current: ${error?.message ?? 'The Current was not valid'}`));
  }
  const subject = pulls.map(pull => `${pull.title}\n${pull.body ?? ''}`).join('\n');
  const pictures = Array.isArray(value.pictures) ? value.pictures : [];
  // A picture's numbers come from the pull requests it cites.
  const pictureNumbers = (picture, index) => {
    if (picture === null || typeof picture !== 'object' || !isRefList(picture.refs)) return [];
    const stated = statedNumbers(pulls.filter(pull => picture.refs.includes(pull.number)), period);
    const texts = picture.kit !== undefined ? kitTexts(picture.kit) : [picture.brief];
    return unstated(texts, stated, `"pictures"[${index}]`, 'pull request the picture cites');
  };
  const found = {
    scene: sceneRefusals(current),
    composition: compositionProblems(current, value.pictures, { beatRefs: refsGiven }).map(clean),
    refs: refsProblems(sources, current.beats.length, pulls.map(pull => pull.number)).map(clean),
    number: [
      ...numberProblems(current, { pulls, period }),
      ...pictures.flatMap(pictureNumbers)
    ],
    'process-talk': processTalkProblems(current.beats.map(beat => [beat?.say, beat?.show].filter(Boolean).join(' ')), { subject }).map(problem => clean(problem.message))
  };
  const diagnostics = Object.values(found).flat();
  const rules = Object.fromEntries(Object.entries(found).filter(([, lines]) => lines.length).map(([rule, lines]) => [rule, lines.length]));
  if (diagnostics.length) return { ok: false, diagnostics, rules };
  const cited = new Set(Object.values(sources).flat());
  const unspoken = pulls.map(pull => pull.number).filter(number => !cited.has(number));
  return { ok: true, current, sources, pictures: value.pictures, unspoken };
}
