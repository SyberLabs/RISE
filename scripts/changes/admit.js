/**
 * Admit: a composer's answer held to everything a card's Current is held to
 * at the connector's door (worker/mcp-server.mjs: the size bound, the Current
 * validator, scene code and figure admission), plus the digest's own rules:
 * the sources, and no number that the pull requests a beat or picture cites do not state. Pure: the
 * verdict depends on the text and the included pull requests alone.
 */
import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../../src/core/rise-current.js';
import { admitSceneCode, describeDiagnostic } from '../../src/core/scene-admission.js';
import { admitSvg } from '../../src/core/svg-admission.js';
import { MCP_CURRENT_BYTES, serializedUtf8Bytes } from '../../src/live/hosts/mcp-size.js';
import { COMPOSER_PROVIDER, sourcesProblems } from '../../src/core/changes/contract.js';
import { figureProblems } from '../../src/core/figures/figure-kit.js';
import { processTalkProblems } from '../../src/core/quality/process-talk.js';
import { pictureCoverage, shownRuns } from './held.js';
import { SCENE_ENGINES } from '../../src/core/beats.js';

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

/**
 * The number rule's tokens, in order: an ISO date (its three parts), a literal read whole (a version, `v2` or three or
 * more dotted parts, or a capitalised identifier such as `LIVE-035`), a number in digits (a comma only before groups
 * of three digits, an optional point, an attached `k` for thousands or an ordinal's st, nd, rd or th), or a word.
 */
const TOKEN = /(?<![\d.])(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<![A-Za-z\d])v\d+(?:\.\d+)*|\d+(?:\.\d+){2,}|(?<![A-Za-z\d])[A-Z]{2,}-\d+(?!\d)|(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?(?:[kK](?![A-Za-z])|(?:st|nd|rd|th)(?![A-Za-z]))?|[A-Za-z]+/g;
const LITERAL = /^v\d|^\d+(?:\.\d+){2,}$|^[A-Z]{2,}-\d+$/u;
const ORDINAL = /(?:st|nd|rd|th)$/u;
const UNITS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 });
const TENS = Object.freeze({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 });
/** A scale word multiplies the number before it by this power of ten. */
const SCALES = Object.freeze({ hundred: 2, thousand: 3, million: 6 });
/** A word's value in a table, read from the table's own keys only ("constructor" is no number). */
const valueIn = (table, name) => (name !== null && Object.hasOwn(table, name) ? table[name] : undefined);
const isNumberWord = name => [UNITS, TENS, SCALES].some(table => valueIn(table, name) !== undefined);
/** Words after which "one" is a pronoun, not a count: "no one", "this one", "the one". */
const PRONOUN_BEFORE = new Set(['no', 'this', 'that', 'each', 'any', 'every', 'the', 'which']);
/** Month names and their short forms; "May" only capitalised, since "may" is also a verb. */
const MONTHS = new Set(['january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']);
const isMonth = token => token !== undefined && (MONTHS.has(token.text.toLowerCase()) || token.text === 'May');
const SPACE = /^\s+$/u;
const SPACE_OR_HYPHEN = /^(?:\s+|-)$/u;
const RANGE = /^\s*[-–]\s*$/u;

/** A decimal in digits as one string: no separators, no leading or trailing zero, times ten to `power`. Exact. */
function canonical(digits, power = 0) {
  const [whole, fraction = ''] = digits.replace(/,/g, '').split('.');
  const point = whole.length + power;
  const all = (whole + fraction).padEnd(point, '0');
  const integer = all.slice(0, point).replace(/^0+/u, '') || '0';
  const rest = all.slice(point).replace(/0+$/u, '');
  return rest ? `${integer}.${rest}` : integer;
}

const wordOf = token => (token !== undefined && /^[A-Za-z]+$/u.test(token.text) ? token.text.toLowerCase() : null);

/**
 * A number written in words from token `i`: `{ value, end }` (the index after its last word), or null. Compounds are
 * read only where they are exact: "twenty-four", "seven hundred and fifty", "two thousand", "a hundred".
 * "one" is not read where it is not a count: "one of" (a member of a group), after a word of PRONOUN_BEFORE, or
 * joined by a hyphen to a word that is not a number ("one-time", "all-in-one").
 */
function wordNumber(tokens, i, text) {
  const glued = (j, glue) => j > 0 && j < tokens.length && glue.test(text.slice(tokens[j - 1].end, tokens[j].start));
  if (wordOf(tokens[i]) === 'one') {
    if (wordOf(tokens[i + 1]) === 'of' && glued(i + 1, SPACE)) return null;
    if (PRONOUN_BEFORE.has(wordOf(tokens[i - 1])) && glued(i, SPACE)) return null;
    if (glued(i + 1, /^-$/u) && wordOf(tokens[i + 1]) !== null && !isNumberWord(wordOf(tokens[i + 1]))) return null;
    if (glued(i, /^-$/u) && wordOf(tokens[i - 1]) !== null) return null;
  }
  let total = 0;
  let group = 0;
  let last = null;
  let j = i;
  if (wordOf(tokens[i]) === 'a' && valueIn(SCALES, wordOf(tokens[i + 1])) !== undefined && glued(i + 1, SPACE)) {
    group = 1;
    last = 'unit';
    j = i + 1;
  }
  for (; j < tokens.length; j += 1) {
    if (j > i && !glued(j, SPACE_OR_HYPHEN)) break;
    const name = wordOf(tokens[j]);
    const unit = valueIn(UNITS, name);
    const tens = valueIn(TENS, name);
    if (unit !== undefined && (last === null || last === 'scale' || last === 'and' || (last === 'tens' && unit < 10))) {
      group += unit;
      last = 'unit';
    } else if (tens !== undefined && (last === null || last === 'scale' || last === 'and')) {
      group += tens;
      last = 'tens';
    } else if (name === 'hundred' && (last === 'unit' || last === 'tens') && group < 100) {
      group *= 100;
      last = 'scale';
    } else if ((name === 'thousand' || name === 'million') && last !== null && last !== 'and' && group > 0) {
      total += group * 10 ** SCALES[name];
      group = 0;
      last = 'scale';
    } else if (name === 'and' && last === 'scale' && (valueIn(UNITS, wordOf(tokens[j + 1])) !== undefined || valueIn(TENS, wordOf(tokens[j + 1])) !== undefined) && glued(j + 1, SPACE)) {
      last = 'and';
    } else {
      break;
    }
  }
  return last === null || last === 'and' ? null : { value: String(total + group), end: j };
}

/**
 * Every number `text` says: `{ written, value, role }`, where `value` is exact ("22k", "22,000" and "22 thousand" are
 * all "22000"; "1.50" is "1.5"; "09" is "9") and `role` is "year", "month" or "day" for a part of a date expression
 * (an ISO date, or a number beside a month name), else null. Units are never read, so 1.5 s and 1,500 ms differ.
 */
function mentionsIn(text) {
  const source = String(text);
  const tokens = [...source.matchAll(TOKEN)].map(match => ({ text: match[0], start: match.index, end: match.index + match[0].length, iso: match[1] === undefined ? null : [match[1], match[2], match[3]] }));
  const gap = (a, b) => source.slice(tokens[a].end, tokens[b].start);
  const digitsOf = token => token.text.replace(ORDINAL, '');
  const dayLike = i => tokens[i] !== undefined && /^\d{1,2}(?:st|nd|rd|th)?$/u.test(tokens[i].text) && Number(digitsOf(tokens[i])) >= 1 && Number(digitsOf(tokens[i])) <= 31;
  // "30 October", "30th of October"; "October 30", "Oct. 30"; a date ends where punctuation or the text does.
  const beforeMonth = i => (isMonth(tokens[i + 1]) && SPACE.test(gap(i, i + 1))) || (wordOf(tokens[i + 1]) === 'of' && isMonth(tokens[i + 2]) && SPACE.test(gap(i, i + 1)) && SPACE.test(gap(i + 1, i + 2)));
  const afterMonth = i => i > 0 && isMonth(tokens[i - 1]) && (SPACE.test(gap(i - 1, i)) || (tokens[i - 1].text.length <= 4 && /^\.\s+$/u.test(gap(i - 1, i))));
  const closes = i => /^\s*(?:$|[^\sA-Za-z\d])/u.test(source.slice(tokens[i].end));
  const joined = (a, b) => (b === a + 1 && RANGE.test(gap(a, b))) || (b === a + 2 && ['to', 'and'].includes(wordOf(tokens[a + 1])) && SPACE.test(gap(a, a + 1)) && SPACE.test(gap(a + 1, a + 2)));
  // A day before a month name; a day after one where the date ends, or with a second day where that range ends; a
  // year after a month name or such a day; then the first day of a range whose second day stands before a month name.
  const dated = new Map();
  tokens.forEach((token, i) => {
    if (dayLike(i)) {
      if (beforeMonth(i) || (afterMonth(i) && closes(i))) dated.set(i, 'day');
      else if (afterMonth(i)) {
        const second = [i + 1, i + 2].find(next => dayLike(next) && joined(i, next) && closes(next));
        if (second !== undefined) dated.set(i, 'day').set(second, 'day');
      }
    } else if (/^\d{4}$/u.test(token.text) && i > 0 && (isMonth(tokens[i - 1]) || dated.get(i - 1) === 'day') && /^,?\s+$/u.test(gap(i - 1, i))) {
      dated.set(i, 'year');
    }
  });
  tokens.forEach((token, i) => {
    if (!dayLike(i) || dated.has(i)) return;
    if ([i + 1, i + 2].some(next => dated.get(next) === 'day' && beforeMonth(next) && joined(i, next))) dated.set(i, 'day');
  });
  const found = [];
  const add = (from, to, value, role = null) => found.push({ written: source.slice(tokens[from].start, tokens[to].end), value, role });
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (token.iso) {
      found.push(...['year', 'month', 'day'].map((role, part) => ({ written: token.text, value: canonical(token.iso[part]), role })));
      i += 1;
    } else if (LITERAL.test(token.text)) {
      add(i, i, token.text);
      i += 1;
    } else if (/^\d/u.test(token.text)) {
      const k = /[kK]$/u.test(token.text);
      const ordinal = ORDINAL.test(token.text);
      let value = canonical(k ? token.text.slice(0, -1) : digitsOf(token), k ? 3 : 0);
      let end = i;
      while (!k && !ordinal && valueIn(SCALES, wordOf(tokens[end + 1])) !== undefined && SPACE.test(gap(end, end + 1))) {
        end += 1;
        value = canonical(value, SCALES[wordOf(tokens[end])]);
      }
      if (!ordinal) [value, end] = half(value, end);
      add(i, end, value, end === i ? (dated.get(i) ?? null) : null);
      i = end + 1;
    } else {
      const words = wordNumber(tokens, i, source);
      if (words === null) {
        i += 1;
        continue;
      }
      const [value, end] = half(words.value, words.end - 1);
      add(i, end, value);
      i = end + 1;
    }
  }
  return found;

  /** "one and a half", "2 and a half": a whole number and a half, read as its decimal. */
  function half(value, end) {
    const next = [1, 2, 3].map(step => wordOf(tokens[end + step]));
    const joined = [1, 2, 3].every(step => end + step < tokens.length && SPACE.test(gap(end + step - 1, end + step)));
    return /^\d+$/u.test(value) && joined && next.join(' ') === 'and a half' ? [`${value}.5`, end + 3] : [value, end];
  }
}

/** The numbers the pull requests state, in their number, title and body, read as `mentionsIn` reads them. */
function statedNumbers(pulls) {
  return new Set(pulls.flatMap(pull => mentionsIn(`${pull.number} ${pull.title} ${pull.body ?? ''}`).map(mention => mention.value)));
}

/** The year, month and day of the period's two dates: each passes only in that role inside a date expression. */
function periodParts(period) {
  const parts = { year: new Set(), month: new Set(), day: new Set() };
  for (const at of [period.from, period.to]) {
    const date = new Date(at);
    parts.year.add(String(date.getUTCFullYear()));
    parts.month.add(String(date.getUTCMonth() + 1));
    parts.day.add(String(date.getUTCDate()));
  }
  return parts;
}

/** A figure shows its text nodes; its markup, comments and style sheets are not read. */
const figureText = svg => svg.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ');

/** A colour written as a string literal (#hex, rgb(), hsl()), quotes included: never text a scene shows. */
const COLOUR = /^.(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?)\([^)]*\)).$/iu;

/** A code scene shows its labels as string literals; its coordinates, colours and other numbers are not read. */
const codeText = code => (code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [])
  .filter(literal => !COLOUR.test(literal)).join(' ');

/**
 * The numbers `texts` say that neither `pulls` nor `also` state, a date of the period in its role excepted: one
 * `{ written, value }` for each spelling.
 */
function unstatedIn(texts, pulls, period, also = []) {
  const stated = new Set(statedNumbers(pulls));
  const parts = periodParts(period);
  const found = new Map();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const { written, value, role } of mentionsIn(text)) {
      const counted = also.includes(value) && new RegExp(`(?<![\\w-])${written.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:(?:more|new|separate|distinct|included)\\s+)?(?:changes?|pull requests?|PRs?|updates?)\\b`, 'iu').test(text);
      if (!stated.has(value) && !counted && !(role !== null && parts[role].has(value))) found.set(written, { written, value });
    }
  }
  return [...found.values()];
}

const numberLine = (what, whose) => ({ written }) => `${what} says "${written}", which no ${whose} states; use only numbers written in the pull requests, or say it without a number`;

function unstated(texts, pulls, period, what, whose = 'included pull request') {
  return unstatedIn(texts, pulls, period).slice(0, MAX_NUMBER_LINES).map(numberLine(what, whose));
}

/** The same rule for one code scene: the numbers in its string literals. */
export function codeNumberProblems(code, { pulls, period }) {
  return unstated([codeText(code)], pulls, period, 'The scene', 'pull request the picture cites');
}

/** Numbers the Current's figures and code scenes show that no included pull request states. */
export function sceneNumberProblems(current, { pulls, period }) {
  const figures = (current.scenes ?? []).map(scene => (typeof scene?.svg === 'string' ? figureText(scene.svg) : typeof scene?.code === 'string' ? codeText(scene.code) : undefined));
  return unstated(figures, pulls, period, 'The Current');
}

/**
 * Numbers the Current says or shows that its sources do not state: each beat's against the pull requests in its own
 * refs (`sources`, beat index to pull request numbers; a beat with none may state only a date of the period), the
 * title against the pull requests some beat cites (an included one no beat cites leaves the reading), and the figures
 * against every included pull request. The count of cited changes is computed by the host, not written by the
 * composer, so every beat may state it; no other count is added, and the title is not given it.
 */
export function numberProblems(current, { pulls, period, sources = {} }) {
  const cited = new Set(Object.values(sources).filter(Array.isArray).flat());
  const spoken = pulls.filter(pull => cited.has(pull.number));
  const count = [String(spoken.length)];
  const beats = current.beats.flatMap((beat, index) => {
    const refs = Array.isArray(sources[index]) ? sources[index] : [];
    return unstatedIn([beat?.say, beat?.show], pulls.filter(pull => refs.includes(pull.number)), period, count).map(({ written, value }) => {
      const other = pulls.find(pull => !refs.includes(pull.number) && statedNumbers([pull]).has(value));
      const fix = other ? `#${other.number} states it: cite #${other.number} on this beat if it speaks of that change` : 'use only numbers written in the pull requests a beat cites';
      return `beat ${index} (refs [${refs.join(', ')}]) says "${written}", which none of them states; ${fix}, or say it without a number`;
    });
  });
  return [
    ...unstatedIn([current.title], spoken, period).map(numberLine('The title', 'pull request a beat cites')),
    ...beats,
    ...sceneNumberProblems(current, { pulls, period })
  ].slice(0, MAX_NUMBER_LINES);
}

/**
 * The same rule for one figure: the numbers its visible text shows. `pulls` are the pull requests the picture cites,
 * so a figure's numbers come from the changes it shows, not from anywhere in the week.
 */
export function figureNumberProblems(svg, { pulls, period }) {
  return unstated([figureText(svg)], pulls, period, 'The figure', 'pull request the picture cites');
}

/** Beats an engine, or a picture over a beat that cites none of its changes, may be held for before a picture starts. */
export const HELD_BEATS = 4;
/** Beats a picture may be held for while every beat under it cites one of the changes it shows. */
export const CITED_HELD_BEATS = 6;
/** Speaking beats (beats with refs) in a row that may go without a picture of what they speak of. */
export const UNPICTURED_BEATS = 2;
/** The scenes a Current has room for: the connector's bound, shared by the opening, the close, RISE's eye and the pictures. */
const SCENE_ROOM = 8;
/** What a refusal for a missing picture suggests: the kinds a week of rules, process and service changes is drawn with. */
const KIND_HINT = 'for a rule or a process change, a list or a compare; for a change to what flows between services, queues and stores, a system';
/** The answer's fields that name RISE's engines, and the beat each is placed on. */
const ENDS = Object.freeze(['opening', 'close']);
const ENGINE_RULE = 'RISE’s engines open and close a digest; a change is shown with a kit picture';
const BRIEF_MIN = 20;
const BRIEF_MAX = 300;
/** Pictures a digest may ask RISE's illustrator for: a diagram no kit kind can express. */
export const MAX_BESPOKE = 2;

const isKit = picture => Object.keys(picture).length === 3 && ['beat', 'refs', 'kit'].every(key => Object.hasOwn(picture, key));
const isBrief = picture => Object.keys(picture).length === 4 && ['beat', 'refs', 'medium', 'brief'].every(key => Object.hasOwn(picture, key));
/** A picture's refs: one or more pull request numbers, each once. */
const isRefList = refs => Array.isArray(refs) && refs.length > 0 && refs.every(Number.isInteger) && new Set(refs).size === refs.length;
/** Each beat's refs that are a list of numbers: a malformed one is refused by the refs rule, never read here. */
const refsMap = beatRefs => Object.fromEntries(Object.entries(beatRefs).filter(([, refs]) => Array.isArray(refs) && refs.every(Number.isInteger)));
const isPicture = picture => picture !== null && typeof picture === 'object' && !Array.isArray(picture) && (isKit(picture) || isBrief(picture));

/**
 * What each beat starts once the run places the pictures (held.js's `starts`): each picture on its beat, the first one
 * on a beat that names no scene, and every scene the Current names on a beat (an engine, or a declared still, at rest).
 */
function plannedStarts(current, pictures) {
  const scenes = new Map((current.scenes ?? []).map(scene => [scene.id, scene]));
  const starts = new Map();
  const beats = current.beats;
  for (const picture of Array.isArray(pictures) ? pictures : []) {
    if (!isPicture(picture) || !Number.isInteger(picture.beat) || picture.beat < 0 || picture.beat >= beats.length) continue;
    if (beats[picture.beat]?.scene !== undefined || starts.has(picture.beat)) continue;
    starts.set(picture.beat, { refs: isRefList(picture.refs) ? picture.refs : null });
  }
  beats.forEach((beat, index) => { if (beat?.scene !== undefined) starts.set(index, { refs: null, rest: scenes.get(beat.scene)?.engine === 'still' }); });
  return starts;
}

const named = numbers => {
  const tags = numbers.map(number => `#${number}`);
  return tags.length === 1 ? tags[0] : `${tags.slice(0, -1).join(', ')} and ${tags.at(-1)}`;
};

/**
 * Every string and printed number a kit figure shows: what the number rule reads. A bar's max is a scale, a system
 * node's "at" its place on the grid, and its "id" (with the "from" and "to" that name one) a name; none is printed.
 */
const UNPRINTED = new Set(['max', 'at', 'id', 'from', 'to', 'kind', 'shape', 'glyph']);
function kitTexts(kit) {
  const texts = [];
  const walk = (value, key) => {
    if (UNPRINTED.has(key)) return;
    if (typeof value === 'string') texts.push(value);
    else if (typeof value === 'number') texts.push(String(value));
    else if (Array.isArray(value)) value.forEach(item => walk(item));
    else if (value !== null && typeof value === 'object') for (const [name, item] of Object.entries(value)) walk(item, name);
  };
  walk(kit);
  return texts;
}

/**
 * What breaks the digest's composition, once RISE has placed the opening and close engines (the only engines a digest
 * runs, so at most two, at its ends): every picture either a kit figure RISE draws from the composer's data or, for a
 * diagram no kit kind can express, a brief the illustrator draws (at most two); at least one picture, no engine held
 * for more than four beats, and no picture for more than six (four when a beat under it cites none of its changes).
 * The plan is held to it before anything is drawn.
 */
function compositionProblems(current, pictures, { beatRefs = {}, kitOnly = false } = {}) {
  const problems = [];
  const beats = current.beats;
  const scenes = new Map((current.scenes ?? []).map(scene => [scene.id, scene]));
  for (const scene of scenes.values()) {
    if (scene.engine === undefined) problems.push(`Scene "${scene.id}" is drawn by the composer; draw a picture through "pictures" instead: a kit figure, or a brief the illustrator draws`);
  }
  const engines = [...scenes.values()].filter(scene => scene.engine !== undefined);
  if (!Array.isArray(pictures)) return [...problems, '"pictures" must be a list of { beat, refs, kit } or { beat, refs, medium, brief }'];
  if (pictures.length === 0) problems.push('"pictures" needs at least one picture: one for each change or group of changes that a picture explains');
  const bespoke = pictures.filter(picture => picture !== null && typeof picture === 'object' && !Array.isArray(picture) && isBrief(picture)).length;
  if (!kitOnly && bespoke > MAX_BESPOKE) problems.push(`"pictures" has ${bespoke} pictures for the illustrator; at most ${MAX_BESPOKE}. Draw a measurement, a sequence, a sorting, a layout, a set of rules or a before and after as a kit figure (bars, flow, columns, stack, list, compare)`);
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
    } else if (scenes.get(beats[picture.beat]?.scene)?.engine !== undefined) {
      problems.push(`${where}: beat ${picture.beat} ${picture.beat === 0 ? 'opens' : 'closes'} with RISE’s engine; put the picture on another beat that speaks of its change`);
    } else if (beats[picture.beat]?.scene !== undefined) {
      problems.push(`${where}: beat ${picture.beat} already starts a scene; a picture starts on a beat that names none`);
    } else {
      starts.add(picture.beat);
    }
    if (isKit(picture)) {
      for (const line of figureProblems(picture.kit)) problems.push(`${where}.kit: ${line}`);
      return;
    }
    if (kitOnly) {
      problems.push(`${where} is an illustrator brief. A public digest draws kit figures only (bars, flow, columns, stack, list, compare); nothing is sent to an illustrator and no scene code is written`);
      return;
    }
    if (!['figure', 'scene'].includes(picture.medium)) problems.push(`${where}.medium is figure or scene`);
    if (typeof picture.brief !== 'string' || picture.brief.trim().length < BRIEF_MIN || picture.brief.length > BRIEF_MAX) {
      problems.push(`${where}.brief is ${BRIEF_MIN} to ${BRIEF_MAX} characters: what to draw, concretely, from the pull requests’ own words`);
    }
  });
  // What each beat shows, as the run will end it (held.js): a picture until its beats move on, then RISE's eye.
  const { runs, eye } = shownRuns(beats.length, plannedStarts(current, pictures), refsMap(beatRefs));
  const needsEye = eye && !engines.some(scene => scene.engine === 'still');
  const room = Math.max(0, SCENE_ROOM - engines.length - (needsEye ? 1 : 0));
  if (pictures.length > room) {
    problems.push(`"pictures" has ${pictures.length}; a Current has room for at most ${room} pictures beside its ${engines.length} engine${engines.length === 1 ? '' : 's'}${needsEye ? ' and RISE’s eye, which shows where a picture’s beats move on' : ''}`);
  }
  // RISE's eye is the room at rest, not a picture: the hold limit binds pictures and engines only, and a picture
  // longer while every beat under it cites what it shows.
  for (const { start, length, rest, picture, cited } of runs) {
    if (rest) continue;
    if (picture && cited) {
      if (length > CITED_HELD_BEATS) problems.push(`beat ${start} holds one picture for ${length} beats; a picture is held at most ${CITED_HELD_BEATS} beats while every beat under it cites what it shows: start another picture`);
    } else if (length > HELD_BEATS) {
      problems.push(`beat ${start} holds one scene for ${length} beats; an engine, or a picture over a beat that cites none of its changes, is held at most ${HELD_BEATS} beats: start a picture`);
    }
  }
  return problems;
}

/**
 * The density floor: no more than two speaking beats in a row without a picture of what they speak of (RISE's eye
 * rests freely on beats without refs), and a picture for every major change a beat speaks of. `majors` are the
 * included changes routed major. Refused like the composition rule, and repaired.
 */
function densityProblems(current, pictures, { beatRefs = {}, majors = [] } = {}) {
  const refsAt = refsMap(beatRefs);
  const starts = plannedStarts(current, pictures);
  const problems = [];
  for (const run of pictureCoverage(current.beats.length, starts, refsAt).unpictured) {
    if (run.length <= UNPICTURED_BEATS) continue;
    const changes = [...new Set(run.flatMap(beat => refsAt[beat]))].sort((a, b) => a - b);
    problems.push(`beats ${run[0]} to ${run.at(-1)} speak of ${named(changes)} with no picture of ${changes.length === 1 ? 'it' : 'them'}; at most ${UNPICTURED_BEATS} speaking beats in a row go without one. Give each theme one picture on its first beat, held across its beats: ${KIND_HINT}`);
  }
  const spoken = new Set(Object.values(refsAt).flat());
  const shown = new Set([...starts.values()].flatMap(start => start.refs ?? []));
  for (const number of majors) {
    if (spoken.has(number) && !shown.has(number)) problems.push(`#${number} is a major change and no picture shows it; give it a picture on a beat that speaks of it: ${KIND_HINT}`);
  }
  return problems;
}

/**
 * The ends RISE keeps (`opening`, `close`): when the pictures need more of the Current's scenes than the ends leave,
 * the close is given up, then the opening, as long as that makes room; otherwise both stay and the room is refused.
 */
function keptEnds(ends, pictures, beatCount, refsAt) {
  if (!Array.isArray(pictures)) return ends;
  const room = kept => {
    const starts = new Map();
    for (const picture of pictures) {
      if (!isPicture(picture) || !Number.isInteger(picture.beat) || picture.beat < 0 || picture.beat >= beatCount || starts.has(picture.beat)) continue;
      starts.set(picture.beat, { refs: isRefList(picture.refs) ? picture.refs : null });
    }
    if (kept.includes('opening')) starts.set(0, { refs: null });
    if (kept.includes('close')) starts.set(beatCount - 1, { refs: null });
    return SCENE_ROOM - kept.length - (shownRuns(beatCount, starts, refsAt).eye ? 1 : 0);
  };
  for (const kept of [ends, ends.filter(end => end !== 'close'), []]) {
    if (pictures.length <= room(kept)) return kept;
  }
  return ends;
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
 * The verdict on one composer answer: `{ ok: true, current, sources, pictures, unspoken, dropped }`,
 * the Current with its origin set to the composer, its pictures, the included
 * changes no beat cites (the run moves them out of the reading), and the ends given
 * up to make room for the pictures (`close`, then `opening`), or
 * `{ ok: false, diagnostics, rules }`, the lines a repair call is given and how many
 * each rule gave.
 */
export function admitComposition(text, { pulls, model, period, kitOnly = false }) {
  const refused = (rule, line) => ({ ok: false, diagnostics: [line], rules: { [rule]: 1 } });
  let value;
  try {
    value = parseModelJson(text);
  } catch {
    return refused('answer', 'The answer must be one JSON object, {"current": ..., "pictures": [...]}, with nothing before or after it');
  }
  if (!['current', 'pictures'].every(key => Object.hasOwn(value, key)) || Object.keys(value).some(key => !['current', 'pictures', ...ENDS].includes(key))) {
    return refused('answer', 'The answer must have the fields "current" and "pictures", and may have "opening" and "close"; each beat carries its own "refs"');
  }
  const given = value.current;
  if (given === null || typeof given !== 'object' || Array.isArray(given) || given.schema !== RISE_CURRENT_SCHEMA_V2 || !Array.isArray(given.beats)) {
    return refused('answer', `"current" must be a Current of beats, "schema": "${RISE_CURRENT_SCHEMA_V2}"`);
  }
  const ends = ENDS.filter(end => Object.hasOwn(value, end));
  const endLines = ends.flatMap(end => {
    const named = value[end];
    if (named === null || typeof named !== 'object' || Array.isArray(named) || typeof named.engine !== 'string' || Object.keys(named).some(key => !['engine', 'params'].includes(key))) {
      return [`"${end}" is { "engine", "params"? }: one of RISE’s engines, which RISE places on the ${end === 'opening' ? 'first' : 'last'} beat`];
    }
    return SCENE_ENGINES.includes(named.engine) ? [] : [clean(`"${end}" names "${named.engine.slice(0, 40)}", which is not one of RISE’s engines: ${SCENE_ENGINES.join(', ')}`)];
  });
  if (ends.length === 2 && given.beats.length < 2) endLines.push('A Current of one beat has room for an opening or a close, not both');
  if (endLines.length) return { ok: false, diagnostics: endLines, rules: { answer: endLines.length } };
  // RISE's engines are named only in "opening" and "close": one named anywhere else is refused, never repaired into place.
  const named = thing => thing !== null && typeof thing === 'object' && !Array.isArray(thing) && Object.hasOwn(thing, 'engine');
  const engineLines = [
    ...(Array.isArray(given.scenes) ? given.scenes : []).filter(named).map(scene => `Scene "${scene.id}" names RISE’s engine "${scene.engine}"`),
    ...(Array.isArray(value.pictures) ? value.pictures : []).flatMap((picture, index) => (named(picture) ? [`"pictures"[${index}] names RISE’s engine "${picture.engine}"`] : []))
  ].map(line => clean(`${line}: ${ENGINE_RULE}. Name an engine only in "opening" or "close"`)).slice(0, MAX_SCENE_LINES);
  if (engineLines.length) return { ok: false, diagnostics: engineLines, rules: { engine: engineLines.length } };
  const { beats: spoken, sources, refsGiven } = splitRefs(given.beats);
  // The close, then the opening, give their scenes to the pictures when the pictures need them.
  const kept = keptEnds(ends, value.pictures, spoken.length, refsMap(refsGiven));
  const dropped = ['close', 'opening'].filter(end => ends.includes(end) && !kept.includes(end));
  // RISE places the opening on the first beat and the close on the last, and declares their scenes.
  const placed = kept.map(end => ({ id: end, engine: value[end].engine, ...(value[end].params === undefined ? {} : { params: value[end].params }) }));
  const beats = spoken.map((beat, index) => {
    const end = index === 0 && kept.includes('opening') ? 'opening' : index === spoken.length - 1 && kept.includes('close') ? 'close' : null;
    return end && beat !== null && typeof beat === 'object' && !Array.isArray(beat) ? { ...beat, scene: end } : beat;
  });
  const scenes = placed.length === 0 || (given.scenes !== undefined && !Array.isArray(given.scenes)) ? {} : { scenes: [...(given.scenes ?? []), ...placed] };
  const { beats: _written, ...head } = given;
  const current = { ...head, ...scenes, beats, origin: { kind: 'model', name: model, provider: COMPOSER_PROVIDER } };
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
    const texts = picture.kit !== undefined ? kitTexts(picture.kit) : [picture.brief];
    return unstated(texts, pulls.filter(pull => picture.refs.includes(pull.number)), period, `"pictures"[${index}]`, 'pull request the picture cites');
  };
  const found = {
    scene: sceneRefusals(current),
    composition: compositionProblems(current, value.pictures, { beatRefs: refsGiven, kitOnly }).map(clean),
    density: Array.isArray(value.pictures) ? densityProblems(current, value.pictures, { beatRefs: refsGiven, majors: pulls.filter(pull => pull.route?.significance === 'major').map(pull => pull.number) }).map(clean) : [],
    refs: refsProblems(sources, current.beats.length, pulls.map(pull => pull.number)).map(clean),
    number: [
      ...numberProblems(current, { pulls, period, sources }),
      ...pictures.flatMap(pictureNumbers)
    ],
    'process-talk': processTalkProblems(current.beats.map(beat => [beat?.say, beat?.show].filter(Boolean).join(' ')), { subject }).map(problem => clean(problem.message))
  };
  const diagnostics = Object.values(found).flat();
  const rules = Object.fromEntries(Object.entries(found).filter(([, lines]) => lines.length).map(([rule, lines]) => [rule, lines.length]));
  if (diagnostics.length) return { ok: false, diagnostics, rules };
  const cited = new Set(Object.values(sources).flat());
  const unspoken = pulls.map(pull => pull.number).filter(number => !cited.has(number));
  return { ok: true, current, sources, pictures: value.pictures, unspoken, dropped };
}
