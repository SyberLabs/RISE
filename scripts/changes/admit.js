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
import { processTalkProblems } from '../../src/core/quality/process-talk.js';

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

function unstated(texts, stated, what) {
  const found = new Set();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const number of numbersIn(text)) if (!stated.has(number)) found.add(number);
  }
  return [...found].slice(0, MAX_NUMBER_LINES).map(number =>
    `${what} says "${number}", which no included pull request states; use only numbers written in the pull requests, or say it without a number`);
}

/** The same rule for one code scene: the numbers in its string literals. */
export function codeNumberProblems(code, { pulls, period }) {
  return unstated([codeText(code)], statedNumbers(pulls, period), 'The scene');
}

/** Numbers the Current says or shows, its figures included, that no included pull request and no date of the period states. */
export function numberProblems(current, { pulls, period }) {
  const figures = (current.scenes ?? []).map(scene => (typeof scene?.svg === 'string' ? figureText(scene.svg) : typeof scene?.code === 'string' ? codeText(scene.code) : undefined));
  return unstated([current.title, ...current.beats.flatMap(beat => [beat?.say, beat?.show]), ...figures], statedNumbers(pulls, period), 'The Current');
}

/** The same rule for one figure the illustrator drew: the numbers its visible text shows. */
export function figureNumberProblems(svg, { pulls, period }) {
  return unstated([figureText(svg)], statedNumbers(pulls, period), 'The figure');
}

/** Beats one scene may be held for before a picture or an engine starts again. */
export const HELD_BEATS = 4;
/** RISE's engines a digest may run: for mood, at the opening or the close. */
export const MAX_ENGINES = 2;
/** The beats at either end where an engine may start. */
const MOOD_BEATS = 2;
const BRIEF_MIN = 20;
const BRIEF_MAX = 300;

/**
 * What breaks the digest's composition: RISE's engines only for mood (at most two, started at the opening or the
 * close), every other picture a brief the illustrator draws (a figure, or a code scene when motion explains), at least
 * one, and no scene held for more than four beats. The plan is held to it before anything is drawn.
 */
export function compositionProblems(current, pictures) {
  const problems = [];
  const beats = current.beats;
  const scenes = new Map((current.scenes ?? []).map(scene => [scene.id, scene]));
  for (const scene of scenes.values()) {
    if (scene.engine === undefined) problems.push(`Scene "${scene.id}" is drawn by the composer; draw a picture through "pictures" instead: a brief the illustrator draws. "current.scenes" holds RISE’s engines only`);
  }
  const engines = [...scenes.values()].filter(scene => scene.engine !== undefined);
  if (engines.length > MAX_ENGINES) problems.push(`The Current declares ${engines.length} of RISE’s engines; at most ${MAX_ENGINES} of RISE’s engines, for mood at the opening or the close. Explain with pictures`);
  beats.forEach((beat, index) => {
    const scene = scenes.get(beat?.scene);
    if (scene?.engine !== undefined && index >= MOOD_BEATS && index < beats.length - MOOD_BEATS) {
      problems.push(`beat ${index} starts RISE’s engine "${scene.id}"; an engine sets the mood at the opening or the close only (the first or last ${MOOD_BEATS} beats). Explain the middle with a picture`);
    }
  });
  if (!Array.isArray(pictures)) return [...problems, '"pictures" must be a list of { beat, medium, brief }'];
  const room = Math.max(0, 8 - engines.length);
  if (pictures.length > room) problems.push(`"pictures" has ${pictures.length}; a Current has room for at most ${room} pictures beside its ${engines.length} engine${engines.length === 1 ? '' : 's'}`);
  if (pictures.length === 0) problems.push('"pictures" needs at least one picture: a brief for each change or group of changes that a picture explains');
  const starts = new Set();
  pictures.forEach((picture, index) => {
    const where = `"pictures"[${index}]`;
    if (picture === null || typeof picture !== 'object' || Array.isArray(picture)
      || Object.keys(picture).length !== 3 || !['beat', 'medium', 'brief'].every(key => Object.hasOwn(picture, key))) {
      problems.push(`${where} has exactly beat, medium and brief`);
      return;
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
    if (!['figure', 'scene'].includes(picture.medium)) problems.push(`${where}.medium is figure or scene`);
    if (typeof picture.brief !== 'string' || picture.brief.trim().length < BRIEF_MIN || picture.brief.length > BRIEF_MAX) {
      problems.push(`${where}.brief is ${BRIEF_MIN} to ${BRIEF_MAX} characters: what to draw, concretely, from the pull requests’ own words`);
    }
  });
  beats.forEach((beat, index) => { if (beat?.scene !== undefined) starts.add(index); });
  const ordered = [...starts].sort((x, y) => x - y);
  const runs = [0, ...ordered.filter(index => index > 0)].map((start, at, list) => [start, (list[at + 1] ?? beats.length) - start]);
  for (const [start, length] of runs) {
    if (length > HELD_BEATS) problems.push(`beat ${start} holds one scene for ${length} beats; start a picture at least every ${HELD_BEATS} beats`);
  }
  return problems;
}

/**
 * The verdict on one composer answer: `{ ok: true, current, sources, pictures }`,
 * the Current with its origin set to the composer and the briefs the illustrator
 * draws, or `{ ok: false, diagnostics, rules }`, the lines a repair call is given
 * and how many each rule gave.
 */
export function admitComposition(text, { pulls, model, period }) {
  const refused = (rule, line) => ({ ok: false, diagnostics: [line], rules: { [rule]: 1 } });
  let value;
  try {
    value = parseModelJson(text);
  } catch {
    return refused('answer', 'The answer must be one JSON object, {"current": ..., "sources": ..., "pictures": [...]}, with nothing before or after it');
  }
  const keys = Object.keys(value);
  if (keys.length !== 3 || !['current', 'sources', 'pictures'].every(key => Object.hasOwn(value, key))) {
    return refused('answer', 'The answer must have exactly three fields, "current", "sources" and "pictures"');
  }
  const given = value.current;
  if (given === null || typeof given !== 'object' || Array.isArray(given) || given.schema !== RISE_CURRENT_SCHEMA_V2) {
    return refused('answer', `"current" must be a Current of beats, "schema": "${RISE_CURRENT_SCHEMA_V2}"`);
  }
  const current = { ...given, origin: { kind: 'model', name: model, provider: COMPOSER_PROVIDER } };
  if (serializedUtf8Bytes(current) > MCP_CURRENT_BYTES) {
    return refused('size', `RISE refused this Current: The Current exceeds the ${MCP_CURRENT_BYTES.toLocaleString('en-US')}-byte MCP limit`);
  }
  try {
    validateRiseCurrent(current);
  } catch (error) {
    return refused('current', clean(`RISE refused this Current: ${error?.message ?? 'The Current was not valid'}`));
  }
  const subject = pulls.map(pull => `${pull.title}\n${pull.body ?? ''}`).join('\n');
  const found = {
    scene: sceneRefusals(current),
    composition: compositionProblems(current, value.pictures).map(clean),
    sources: sourcesProblems(value.sources, current.beats.length, pulls.map(pull => pull.number)).map(clean),
    number: [
      ...numberProblems(current, { pulls, period }),
      ...(Array.isArray(value.pictures) ? unstated(value.pictures.map(picture => picture?.brief), statedNumbers(pulls, period), 'A picture\u2019s brief') : [])
    ],
    'process-talk': processTalkProblems(current.beats.map(beat => [beat?.say, beat?.show].filter(Boolean).join(' ')), { subject }).map(problem => clean(problem.message))
  };
  const diagnostics = Object.values(found).flat();
  const rules = Object.fromEntries(Object.entries(found).filter(([, lines]) => lines.length).map(([rule, lines]) => [rule, lines.length]));
  return diagnostics.length ? { ok: false, diagnostics, rules } : { ok: true, current, sources: value.sources, pictures: value.pictures };
}
