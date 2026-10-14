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

/** Numbers the Current says or shows that no included pull request, and no date of the period, states. */
function unstatedNumbers(current, pulls, period) {
  const stated = new Set(pulls.flatMap(pull => numbersIn(`${pull.number} ${pull.title} ${pull.body ?? ''}`)));
  for (const at of [period.from, period.to]) {
    const date = new Date(at);
    for (const part of [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]) stated.add(String(part));
  }
  const unstated = new Set();
  // A figure shows its text nodes; its markup, comments and style sheets are not read.
  const figureText = (current.scenes ?? []).map(scene => typeof scene?.svg === 'string'
    ? scene.svg.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')
    : undefined);
  for (const text of [current.title, ...current.beats.flatMap(beat => [beat?.say, beat?.show]), ...figureText]) {
    if (typeof text !== 'string') continue;
    for (const number of numbersIn(text)) if (!stated.has(number)) unstated.add(number);
  }
  return [...unstated].slice(0, MAX_NUMBER_LINES).map(number =>
    `The Current says "${number}", which no included pull request states; use only numbers written in the pull requests, or say it without a number`);
}

/**
 * The verdict on one composer answer: `{ ok: true, current, sources }`, the
 * Current with its origin set to the composer, or `{ ok: false, diagnostics }`,
 * the lines a repair call is given.
 */
export function admitComposition(text, { pulls, model, period }) {
  let value;
  try {
    value = parseModelJson(text);
  } catch {
    return { ok: false, diagnostics: ['The answer must be one JSON object, {"current": ..., "sources": ...}, with nothing before or after it'] };
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !Object.hasOwn(value, 'current') || !Object.hasOwn(value, 'sources')) {
    return { ok: false, diagnostics: ['The answer must have exactly two fields, "current" and "sources"'] };
  }
  const given = value.current;
  if (given === null || typeof given !== 'object' || Array.isArray(given) || given.schema !== RISE_CURRENT_SCHEMA_V2) {
    return { ok: false, diagnostics: [`"current" must be a Current of beats, "schema": "${RISE_CURRENT_SCHEMA_V2}"`] };
  }
  const current = { ...given, origin: { kind: 'model', name: model, provider: COMPOSER_PROVIDER } };
  if (serializedUtf8Bytes(current) > MCP_CURRENT_BYTES) {
    return { ok: false, diagnostics: [`RISE refused this Current: The Current exceeds the ${MCP_CURRENT_BYTES.toLocaleString('en-US')}-byte MCP limit`] };
  }
  try {
    validateRiseCurrent(current);
  } catch (error) {
    return { ok: false, diagnostics: [clean(`RISE refused this Current: ${error?.message ?? 'The Current was not valid'}`)] };
  }
  const diagnostics = [
    ...sceneRefusals(current),
    ...sourcesProblems(value.sources, current.beats.length, pulls.map(pull => pull.number)).map(clean),
    ...unstatedNumbers(current, pulls, period)
  ];
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, current, sources: value.sources };
}
