/**
 * RISE Changes: the files the generator writes to the changes-data branch and
 * the app reads back (docs/plans/RISE-CHANGES.md). Everything in them is
 * model-written or pull-request-written, so the envelope is checked here on
 * both sides of the branch; the Current inside is admitted by RISE's own
 * Current admission, never by this module alone.
 */

export const DIGEST_SCHEMA = 'syberlabs.changes-digest/v1';
export const INDEX_SCHEMA = 'syberlabs.changes-index/v1';
export const REPOSITORY = 'SyberLabs/RISE';
export const DATA_BRANCH = 'changes-data';
export const SITE = 'https://rise.syberlabs.io';
export const MODEL = 'claude-sonnet-5-5';
export const COMPOSER_PROVIDER = 'Anthropic, via Claude Code';

/** The router's finite menu: a model may choose these values and nothing else. */
export const ROUTE_MENU = Object.freeze({
  audience: Object.freeze(['skip', 'team', 'readers', 'both']),
  significance: Object.freeze(['minor', 'notable', 'major']),
  kind: Object.freeze(['feature', 'fix', 'performance', 'design', 'infrastructure', 'records'])
});

/** The route of a records-only change, and of any change whose answer was not admitted. */
export const FALLBACK_ROUTE = Object.freeze({ audience: 'skip', significance: 'minor', kind: 'records' });

/** Why a change is or is not in the reading; `unspoken`: chosen, but no beat spoke of it, so the run left it out. */
export const REASONS = Object.freeze(['routed', 'records-only', 'limit', 'unspoken']);

export const LIMITS = Object.freeze({
  changes: 60,
  included: 24,
  title: 200,
  body: 4000,
  files: 100,
  fileBytes: 256 * 1024,
  notes: 20,
  note: 300,
  index: 200
});

export const DIGEST_ID = /^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?$/;
const SHA = /^[0-9a-f]{40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isIso = value => typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
const sameKeys = (value, keys) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const title = value => typeof value === 'string' && value.trim().length > 0 && value.length <= LIMITS.title;

export function pullUrl(number, repo = REPOSITORY) {
  return `https://github.com/${repo}/pull/${number}`;
}

function periodProblems(period, path) {
  if (!isObject(period) || !sameKeys(period, ['from', 'to']) || !isIso(period.from) || !isIso(period.to)
    || Date.parse(period.from) >= Date.parse(period.to)) return [`${path} must be { from, to }, ISO times with from before to`];
  return [];
}

/**
 * What is wrong with `sources` for a Current of `beatCount` beats and these
 * included pull request numbers: each key a beat index, each value the numbers
 * that beat speaks about, every included change cited and nothing else.
 */
export function sourcesProblems(sources, beatCount, included) {
  if (!isObject(sources)) return ['"sources" must be an object from beat index to pull request numbers'];
  const problems = [];
  const allowed = new Set(included);
  const cited = new Set();
  for (const [key, numbers] of Object.entries(sources)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      problems.push(`"sources" key "${key.slice(0, 20)}" is not a beat index (0, 1, 2…)`);
      continue;
    }
    if (Number(key) >= beatCount) problems.push(`"sources" names beat ${key}, but the Current has ${beatCount} beats (0 to ${beatCount - 1})`);
    if (!Array.isArray(numbers) || numbers.length === 0 || numbers.some(number => !Number.isInteger(number))) {
      problems.push(`"sources" beat ${key} must list one or more pull request numbers`);
      continue;
    }
    if (new Set(numbers).size !== numbers.length) problems.push(`"sources" beat ${key} lists a pull request twice`);
    for (const number of numbers) {
      if (allowed.has(number)) cited.add(number);
      else problems.push(`"sources" beat ${key} cites #${number}, which is not one of the included pull requests`);
    }
  }
  for (const number of included) {
    if (!cited.has(number)) problems.push(`No beat cites #${number}; every included pull request must be cited by at least one beat`);
  }
  return problems;
}

function changeProblems(change, index) {
  const path = `changes[${index}]`;
  if (!isObject(change) || !sameKeys(change, ['number', 'title', 'url', 'mergedAt', 'mergeSha', 'route', 'included', 'reason'])) {
    return [`${path} must have exactly number, title, url, mergedAt, mergeSha, route, included, reason`];
  }
  const problems = [];
  if (!Number.isInteger(change.number) || change.number < 1) problems.push(`${path}.number must be a pull request number`);
  if (!title(change.title)) problems.push(`${path}.title must be 1 to ${LIMITS.title} characters`);
  if (change.url !== pullUrl(change.number)) problems.push(`${path}.url must be ${pullUrl(change.number)}`);
  if (!isIso(change.mergedAt)) problems.push(`${path}.mergedAt must be an ISO time`);
  if (typeof change.mergeSha !== 'string' || !SHA.test(change.mergeSha)) problems.push(`${path}.mergeSha must be 40 hex characters`);
  const route = change.route;
  if (!isObject(route) || !sameKeys(route, Object.keys(ROUTE_MENU))
    || Object.entries(ROUTE_MENU).some(([question, options]) => !options.includes(route[question]))) {
    problems.push(`${path}.route must be one choice from the route menu per question`);
  }
  if (typeof change.included !== 'boolean') problems.push(`${path}.included must be true or false`);
  if (!REASONS.includes(change.reason)) problems.push(`${path}.reason must be one of ${REASONS.join(', ')}`);
  if (change.included === true && change.reason !== 'routed') problems.push(`${path} is included, so its reason is routed`);
  return problems;
}

const RULE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const isCount = value => Number.isInteger(value) && value >= 0 && value <= 10000;

const DENSITY_KEYS = ['pictures', 'includedChanges', 'speakingBeats', 'pictured', 'longestUnpictured'];

/** A density measure: five counts, the pictured beats and the longest run without a picture among the speaking beats. */
const isDensity = density => isObject(density) && sameKeys(density, DENSITY_KEYS) && DENSITY_KEYS.every(key => isCount(density[key]))
  && density.pictured <= density.speakingBeats && density.longestUnpictured <= density.speakingBeats - density.pictured;

/**
 * What is wrong with a run's first-pass score: `{ firstPass, repairs: { composition, illustrator }, checks, density? }`,
 * each repair a count, `checks` at most 40 rule ids (lower-case words joined by hyphens), each fired at least once, and
 * `density`, when there (digests written before it have none), how densely the reading is pictured:
 * `{ pictures, includedChanges, speakingBeats, pictured, longestUnpictured }`.
 */
export function qualityProblems(quality) {
  const keys = ['firstPass', 'repairs', 'checks', ...(isObject(quality) && Object.hasOwn(quality, 'density') ? ['density'] : [])];
  const shaped = isObject(quality) && sameKeys(quality, keys) && typeof quality.firstPass === 'boolean'
    && isObject(quality.repairs) && sameKeys(quality.repairs, ['composition', 'illustrator'])
    && isCount(quality.repairs.composition) && isCount(quality.repairs.illustrator)
    && isObject(quality.checks) && Object.keys(quality.checks).length <= 40
    && Object.entries(quality.checks).every(([rule, count]) => RULE_ID.test(rule) && isCount(count) && count > 0)
    && (!keys.includes('density') || isDensity(quality.density));
  return shaped ? [] : ['quality must be { firstPass, repairs: { composition, illustrator }, checks: { <rule>: <count> }, density? }'];
}

/** The first-pass score in one line, for the issue and the page. */
export function qualityLine({ firstPass, repairs, checks }) {
  const total = repairs.composition + repairs.illustrator;
  const fired = Object.entries(checks).map(([rule, count]) => `${rule} (${count})`).join(', ');
  return `First pass: ${firstPass ? 'yes' : 'no'} — ${total} repair${total === 1 ? '' : 's'}${total ? ` (${repairs.composition} composition, ${repairs.illustrator} illustrator)` : ''}; checks fired: ${fired || 'none'}`;
}

/** How densely the reading is pictured, in one line, for the run log, the issue and the page. */
export function densityLine({ pictures, includedChanges, speakingBeats, pictured, longestUnpictured }) {
  const head = `Pictures: ${pictures} for ${includedChanges} change${includedChanges === 1 ? '' : 's'}`;
  if (pictured === speakingBeats) return `${head}; every speaking beat pictured`;
  return `${head}; ${pictured} of ${speakingBeats} speaking beats pictured, at most ${longestUnpictured} in a row without one`;
}

/** What is wrong with a digest's envelope; empty when it keeps the contract. */
export function digestProblems(digest) {
  const keys = ['schema', 'id', 'audience', 'title', 'period', 'generatedAt', 'model', 'changes', 'current', 'sources'];
  // Optional: `quality`, the run's first-pass score, and `notes`, what the run let go (a picture not drawn), one sentence each.
  const optional = ['quality', 'notes'].filter(key => isObject(digest) && Object.hasOwn(digest, key));
  if (!isObject(digest) || !sameKeys(digest, [...keys, ...optional])) return [`A digest has exactly ${keys.join(', ')}, and quality and notes when it has them`];
  const problems = [];
  if (optional.includes('quality')) problems.push(...qualityProblems(digest.quality));
  if (optional.includes('notes') && (!Array.isArray(digest.notes) || digest.notes.length < 1 || digest.notes.length > LIMITS.notes
    || digest.notes.some(note => typeof note !== 'string' || !note.trim() || note.length > LIMITS.note))) {
    problems.push(`notes must be 1 to ${LIMITS.notes} sentences of at most ${LIMITS.note} characters`);
  }
  if (digest.schema !== DIGEST_SCHEMA) problems.push(`schema must be ${DIGEST_SCHEMA}`);
  if (typeof digest.id !== 'string' || !DIGEST_ID.test(digest.id)) problems.push('id must be a date, with a short suffix only for a second run that day');
  if (digest.audience !== 'team') problems.push('audience must be team');
  if (!title(digest.title)) problems.push(`title must be 1 to ${LIMITS.title} characters`);
  problems.push(...periodProblems(digest.period, 'period'));
  if (!isIso(digest.generatedAt)) problems.push('generatedAt must be an ISO time');
  const model = digest.model;
  if (!isObject(model) || !sameKeys(model, ['router', 'composer', 'via']) || !title(model.router) || !title(model.composer) || model.via !== 'Claude Code') {
    problems.push('model must be { router, composer, via: "Claude Code" }');
  }
  if (!Array.isArray(digest.changes)) return [...problems, 'changes must be a list'];
  if (digest.changes.length > LIMITS.changes) problems.push(`At most ${LIMITS.changes} changes are listed; this digest has ${digest.changes.length}`);
  digest.changes.forEach((change, index) => problems.push(...changeProblems(change, index)));
  const numbers = digest.changes.map(change => change?.number);
  if (new Set(numbers).size !== numbers.length) problems.push('A pull request is listed twice');
  const included = digest.changes.filter(change => change?.included === true).map(change => change.number);
  if (included.length === 0) problems.push('A digest includes at least one change');
  if (included.length > LIMITS.included) problems.push(`At most ${LIMITS.included} changes are included; this digest includes ${included.length}`);
  const current = digest.current;
  if (!isObject(current) || current.schema !== 'rise.current.v2' || !Array.isArray(current.beats)) {
    problems.push('current must be a rise.current.v2 Current');
  } else {
    problems.push(...sourcesProblems(digest.sources, current.beats.length, included));
  }
  return problems;
}

/**
 * What is wrong with index.json; empty when it keeps the contract. An entry may carry `supersededBy`, the id of a
 * listed digest that re-ran its period: the list shows that one in its place, and the entry's own page links to it.
 */
export function indexProblems(index) {
  if (!isObject(index) || !sameKeys(index, ['schema', 'digests'])) return ['index.json has exactly schema and digests'];
  const problems = [];
  if (index.schema !== INDEX_SCHEMA) problems.push(`index.json schema must be ${INDEX_SCHEMA}`);
  if (!Array.isArray(index.digests)) return [...problems, 'index.json digests must be a list'];
  if (index.digests.length > LIMITS.index) problems.push(`index.json lists at most ${LIMITS.index} digests`);
  index.digests.forEach((entry, at) => {
    const path = `digests[${at}]`;
    const keys = ['id', 'audience', 'title', 'period', 'count', ...(isObject(entry) && Object.hasOwn(entry, 'supersededBy') ? ['supersededBy'] : [])];
    if (!isObject(entry) || !sameKeys(entry, keys)) {
      problems.push(`${path} has exactly id, audience, title, period, count, and supersededBy when a re-run replaced it`);
      return;
    }
    if (keys.includes('supersededBy') && (entry.supersededBy === entry.id || !index.digests.some(other => isObject(other) && other.id === entry.supersededBy))) {
      problems.push(`${path}.supersededBy names a digest the index lists, other than ${typeof entry.id === 'string' ? entry.id.slice(0, 20) : 'the entry'} itself`);
    }
    if (typeof entry.id !== 'string' || !DIGEST_ID.test(entry.id)) problems.push(`${path}.id is not a digest id`);
    if (entry.audience !== 'team') problems.push(`${path}.audience must be team`);
    if (!title(entry.title)) problems.push(`${path}.title must be 1 to ${LIMITS.title} characters`);
    problems.push(...periodProblems(entry.period, `${path}.period`));
    if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > LIMITS.included) problems.push(`${path}.count must be 1 to ${LIMITS.included}`);
  });
  const ids = index.digests.map(entry => entry?.id);
  if (new Set(ids).size !== ids.length) problems.push('index.json lists a digest twice');
  return problems;
}
