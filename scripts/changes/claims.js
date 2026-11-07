/**
 * Claims (docs/plans/RISE-CHANGES.md, Claims): one model call per included pull request lists what it claims, each
 * claim resting on exact words of the pull request. Code admits every claim, with no model: the quote must occur word
 * for word in the field it names (line endings read as LF), code computes its span from the first occurrence, every
 * number in the claim's text must be in the quote, and kind and status come from the menu. A body section that says
 * something is not verified, not done or pending must be quoted by a pending or flagged claim; when none does, the
 * pull request is asked once more, and a gap still left is recorded, never filled by code. A claim dropped for a number
 * its quote does not hold is listed in that same repair, or in one of its own, for a wider quote or the claim without
 * the number, and admitted again by the same rules: at most two calls a pull request. A pull request's admitted
 * claims are kept by merge SHA and reused while the contract hash holds and every claim re-admits against its text.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { mentionsIn, parseModelJson } from './admit.js';
import { CLAIMS_CACHE_SCHEMA, CLAIM_LIMITS, CLAIM_MENU, cachedClaimsProblems } from '../../src/core/changes/contract.js';
import { FACTS_VERSION } from '../../src/core/changes/facts.js';
import { serialize } from '../../src/core/changes/write.js';
import { CLAIMS_CONTEXT_VERSION, CLAIMS_SYSTEM, buildClaimsRequest, lf } from './claims-context.js';
import { contractHash, quoted } from './route.js';

const CONCURRENCY = 4;
const CAVEAT_STATUSES = new Set(['pending', 'flagged']);

/**
 * The words that make a heading or a label line a caveat section, as patterns matched whole and in any case: each
 * phrase, with the plural of TODO and the inflections of known limits.
 */
export const CAVEAT_PHRASES = Object.freeze(['not verified', 'unverified', 'not done', 'not yet', 'not in this pr', 'pending', 'awaiting', 'human gate', 'needs a human', 'todos?', 'known limit(?:s|ations?)?']);
const CAVEAT = new RegExp(`\\b(?:${CAVEAT_PHRASES.join('|')})\\b`, 'iu');

const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/u;
const BOLD_LABEL = /^ {0,3}(\*\*|__)(.+?)\1[ \t]*$/u;
const COLON_LABEL = /^(?![-*+][ \t]|>|\||#{1,6}(?:[ \t]|$)|\d+[.)][ \t])\S.{0,78}:[ \t]*$/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
/** A repair names at most this many unquoted sections, each heading cut to this many characters. */
const REPAIR_SECTIONS = 5;
const REPAIR_HEADING = 80;

const codePoints = text => Array.from(text).length;

/** A field's text with line endings read as LF, or undefined when the field or its index names nothing. */
function fieldText(card, field, index) {
  if (field === 'body') return lf(card.body);
  if (field === 'title') return lf(card.title);
  const list = field === 'commit' ? card.commits : card.issues.map(issue => issue.title);
  return Number.isInteger(index) && index >= 0 && index < list.length ? lf(list[index]) : undefined;
}

/** "cl_" and the first 12 hex of the sha256 of where the claim's words are. */
export function claimId({ repo, pr, mergeSha, field, index, start, end }) {
  return `cl_${createHash('sha256').update(`${repo}#${pr}@${mergeSha}:${field}:${index ?? ''}:${start}-${end}`).digest('hex').slice(0, 12)}`;
}

const SHAPE = 'a claim has exactly text, kind, status, quote, field, and index for a commit or an issue';
const KEYS = new Set(['text', 'kind', 'status', 'quote', 'field', 'index']);

/** One answered claim as an admitted claim, or the reason it is dropped. */
function admitOne(given, card, repo) {
  const isObject = given !== null && typeof given === 'object' && !Array.isArray(given);
  if (!isObject || !['text', 'kind', 'status', 'quote', 'field'].every(key => Object.hasOwn(given, key)) || Object.keys(given).some(key => !KEYS.has(key))) return { reason: SHAPE };
  const indexed = given.field === 'commit' || given.field === 'issue';
  if (!indexed && Object.hasOwn(given, 'index') && given.index !== null) return { reason: SHAPE };
  for (const key of ['kind', 'status', 'field']) {
    if (!CLAIM_MENU[key].includes(given[key])) return { reason: `${key} is not one of ${CLAIM_MENU[key].join(', ')}` };
  }
  if (typeof given.text !== 'string' || !given.text.trim() || codePoints(given.text) > CLAIM_LIMITS.text) return { reason: `text is not 1 to ${CLAIM_LIMITS.text} characters` };
  if (typeof given.quote !== 'string' || !given.quote || codePoints(given.quote) > CLAIM_LIMITS.quote) return { reason: `quote is not 1 to ${CLAIM_LIMITS.quote} characters` };
  const index = indexed ? given.index : undefined;
  const source = fieldText(card, given.field, index);
  if (source === undefined) {
    const count = given.field === 'commit' ? card.commits.length : card.issues.length;
    return { reason: `index is not the position of one of the ${count} ${given.field}s` };
  }
  const quote = lf(given.quote);
  const at = source.indexOf(quote);
  if (at < 0) return { reason: `its quote is not in the ${given.field} word for word` };
  let times = 1;
  for (let next = source.indexOf(quote, at + 1); next >= 0; next = source.indexOf(quote, next + 1)) times += 1;
  if (times > 1) return { reason: `its quote occurs ${times} times in the ${given.field}; quote enough words to be found once` };
  const stated = new Set(mentionsIn(quote).map(mention => mention.value));
  const unstated = mentionsIn(given.text).find(mention => !stated.has(mention.value));
  if (unstated) return { reason: `its text says "${unstated.written}", which its quote does not`, unstated: { text: given.text, quote: given.quote, field: given.field, ...(indexed ? { index } : {}) } };
  const start = codePoints(source.slice(0, at));
  const end = start + codePoints(quote);
  const span = indexed ? { field: given.field, index, start, end, text: quote } : { field: given.field, start, end, text: quote };
  return { claim: { id: claimId({ repo, pr: card.number, mergeSha: card.mergeSha, field: given.field, index, start, end }), text: given.text, kind: given.kind, status: given.status, span } };
}

/**
 * The claims admitted from one answer for this card, in the order given, and a line for each claim dropped;
 * `unstated` is each claim dropped for a number its quote does not hold, `{ claim, text, quote, field, index? }`, with
 * its place in the answer. `readable` is false, with nothing admitted, when the answer is not one JSON object
 * `{"claims": [...]}`.
 */
export function admitClaims(text, card, { repo }) {
  let given;
  try {
    given = parseModelJson(text).claims;
  } catch {
    given = undefined;
  }
  if (!Array.isArray(given)) return { readable: false, claims: [], dropped: [], unstated: [] };
  const claims = [];
  const dropped = [];
  const unstated = [];
  given.slice(0, CLAIM_LIMITS.claims).forEach((entry, at) => {
    const { claim, reason, unstated: numbered } = admitOne(entry, card, repo);
    if (claim && claims.some(earlier => earlier.id === claim.id)) dropped.push(`claim ${at + 1}: it repeats the span of an earlier claim`);
    else if (claim) claims.push(claim);
    else dropped.push(`claim ${at + 1}: ${reason}`);
    if (numbered) unstated.push({ claim: at + 1, ...numbered });
  });
  const past = CLAIM_LIMITS.claims + 1;
  if (given.length >= past) dropped.push(`${given.length === past ? `claim ${past}` : `claims ${past} to ${given.length}`}: past the ${CLAIM_LIMITS.claims}-claim limit`);
  return { readable: true, claims, dropped, unstated };
}

/** A heading line's level and text: an ATX heading has its level, a label line (wholly bold, or ending in a colon) 7. */
function headingOf(line) {
  const atx = ATX.exec(line);
  if (atx) return { level: atx[1].length, text: atx[2] };
  const label = BOLD_LABEL.exec(line)?.[2] ?? (COLON_LABEL.test(line) ? line.trim() : null);
  if (label === null) return null;
  const text = label.replace(/:\s*$/u, '').trim();
  return { level: 7, text: /^(\*\*|__)(.+)\1$/u.exec(text)?.[2].trim() ?? text };
}

/**
 * The body's caveat sections, `{ heading, start, end }` in code points over the body with line endings read as LF: the
 * text under each heading or label line that names a CAVEAT_PHRASES phrase, up to the next heading of its level or
 * higher (a label line ends at the next heading or label line). No line inside a fenced code block is a heading. A
 * section with nothing under it is none. Linear in the body: a line is passed over by at most one open heading a level.
 */
export function caveatSections(body) {
  const text = lf(body);
  const lines = [];
  let fence = null;
  let point = 0;
  for (let at = 0; at <= text.length;) {
    const end = text.indexOf('\n', at);
    const line = text.slice(at, end < 0 ? text.length : end);
    const marker = FENCE.exec(line)?.[1];
    let heading = null;
    if (fence !== null) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length).trim()) fence = null;
    } else if (marker) {
      fence = marker;
    } else {
      heading = headingOf(line);
    }
    const width = codePoints(line);
    lines.push({ at, point, next: point + width + (end < 0 ? 0 : 1), heading, blank: !line.trim() });
    point += width + 1;
    if (end < 0) break;
    at = end + 1;
  }
  const sections = [];
  lines.forEach((line, i) => {
    if (!line.heading || !CAVEAT.test(line.heading.text)) return;
    let j = i + 1;
    while (j < lines.length && !(lines[j].heading && (lines[j].heading.level <= line.heading.level || line.heading.level === 7))) j += 1;
    let content = false;
    for (let k = i + 1; k < j && !content; k += 1) content = !lines[k].blank;
    if (!content) return;
    sections.push({ heading: line.heading.text, start: line.next, end: j < lines.length ? lines[j].point : point - 1 });
  });
  return sections;
}

/** Each caveat section of the card's body, with whether a pending or flagged claim's span overlaps it. */
function caveatsOf(card, claims) {
  return caveatSections(card.body).map(section => ({
    ...section,
    covered: claims.some(claim => claim.span.field === 'body' && CAVEAT_STATUSES.has(claim.status) && claim.span.start < section.end && claim.span.end > section.start)
  }));
}

/** The contract hash a cached claim must carry: the claims system text, the model, the context's version, the fact rules' version. */
export function claimsContract({ model }) {
  return contractHash(CLAIMS_SYSTEM, model, CLAIMS_CONTEXT_VERSION, FACTS_VERSION);
}

/**
 * A claims cache file's result for this card, or the reason it is ignored: its shape (cachedClaimsProblems), then every
 * claim admitted again from its own span against the card's text, to exactly the claim filed, and its gap as computed.
 */
export function readClaimsCache(text, card, { repo, contract }) {
  let entry;
  try {
    entry = JSON.parse(text);
  } catch {
    return { problem: 'not JSON' };
  }
  const problems = cachedClaimsProblems(entry, { mergeSha: card.mergeSha, contract });
  if (problems.length) return { problem: problems[0] };
  const asked = entry.claims.map(({ text: said, kind, status, span }) => ({ text: said, kind, status, quote: span.text, field: span.field, ...(Object.hasOwn(span, 'index') ? { index: span.index } : {}) }));
  const again = admitClaims(JSON.stringify({ claims: asked }), card, { repo });
  if (again.dropped.length || !isDeepStrictEqual(again.claims, entry.claims)) return { problem: 'a claim no longer admits against the pull request’s text' };
  const caveats = caveatsOf(card, again.claims);
  if (entry.gap !== caveats.some(caveat => !caveat.covered)) return { problem: 'gap is not the gap its claims leave' };
  return { claims: again.claims, caveats };
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const sectionNames = sections => `section${sections.length === 1 ? '' : 's'} ${sections.map(section => `"${section.heading}"`).join(', ')}`;

/** A body heading as data in a repair prompt: JSON-quoted with "<" escaped, cut to REPAIR_HEADING characters. */
const headingData = heading => JSON.stringify(Array.from(heading).slice(0, REPAIR_HEADING).join('')).replace(/</g, '\\u003c');

function refusalOf(verdict, caveats) {
  if (!verdict.readable) return ['The answer could not be read as one JSON object {"claims": [...]}.'];
  const lines = verdict.dropped.map(line => `Dropped ${line}.`);
  if (verdict.claims.length === 0) lines.push('No claim was admitted.');
  const open = caveats.filter(caveat => !caveat.covered);
  for (const section of open.slice(0, REPAIR_SECTIONS)) {
    lines.push(`The body’s caveat section at characters ${section.start} to ${section.end}, headed ${headingData(section.heading)}, says what is not verified, not done or pending, and no claim of status pending or flagged quotes from it; add one, quoting its exact words.`);
  }
  if (open.length > REPAIR_SECTIONS) lines.push(`And ${open.length - REPAIR_SECTIONS} more caveat sections are not quoted either.`);
  return lines;
}

/**
 * The one repair: the refusal, then each claim dropped for a number quoted as data; a whole answer again when the first
 * needs one, else only those claims. An answer holds at most CLAIM_LIMITS.claims, so the list is bounded by it.
 */
const repairOf = (request, answer, refusal, unstated, whole) => ({
  system: request.system,
  prompt: [
    request.prompt, '', 'Your previous answer, quoted as data:', '', quoted('previous_answer', answer), '', 'RISE refused it:', ...refusal.map(line => `- ${line}`), '',
    ...(unstated.length ? [
      'These claims were dropped because their text states a number their quote does not, quoted as data:', '', quoted('dropped_for_a_number', unstated), '',
      'For each, give either a wider quote, copied exactly from the same field, that holds every number in its text, or the same claim without the number. Never state a number its quote does not.', ''
    ] : []),
    whole ? 'Answer again with the whole JSON object.' : 'Answer with one JSON object {"claims": [...]} holding only those claims, each repaired or left out.'
  ].join('\n')
});

const uncovered = (card, claims) => caveatsOf(card, claims).filter(caveat => !caveat.covered).length;

/** One card's claims: from its cache file when that re-admits, else from at most two calls. */
async function claimOne({ card, ask, model, repo, contract, readCached, now, log, refused }) {
  const text = await readCached(card.mergeSha);
  if (text !== null) {
    const cached = readClaimsCache(text, card, { repo, contract });
    if (cached.claims) return { number: card.number, mergeSha: card.mergeSha, fromCache: true, claims: cached.claims, dropped: [], caveats: cached.caveats, gap: cached.caveats.some(caveat => !caveat.covered), calls: 0, recovered: 0 };
    log(`Claims cache: ${card.mergeSha.slice(0, 12)} ignored (${cached.problem}); #${card.number} is claimed afresh`);
  }
  const request = buildClaimsRequest(card);
  let calls = 0;
  const attempt = async next => {
    calls += 1;
    try {
      return { answer: await ask({ ...next, model }) };
    } catch (error) {
      return { failed: String(error?.message ?? error).slice(0, 200) };
    }
  };
  const first = await attempt(request);
  const result = (verdict, recovered = 0) => {
    const caveats = caveatsOf(card, verdict.claims);
    return { number: card.number, mergeSha: card.mergeSha, fromCache: false, claims: verdict.claims, dropped: verdict.dropped, caveats, gap: caveats.some(caveat => !caveat.covered), calls, readable: verdict.readable, recovered };
  };
  if (first.failed !== undefined) {
    log(`Claims: #${card.number} has no claim: its call failed (${first.failed})`);
    return result({ readable: false, claims: [], dropped: [] });
  }
  let verdict = admitClaims(first.answer, card, { repo });
  let recovered = 0;
  const caveats = caveatsOf(card, verdict.claims);
  const whole = !verdict.readable || verdict.claims.length === 0 || caveats.some(caveat => !caveat.covered);
  // One repair at most, carrying the caveat refusal and the claims dropped for a number together: two calls a pull request.
  if (whole || verdict.unstated.length) {
    const refusal = refusalOf(verdict, caveats);
    refused({ stage: 'claims', pull: card.number, attempt: 1, refusal, answer: String(first.answer ?? '') });
    const second = await attempt(repairOf(request, String(first.answer ?? ''), refusal, verdict.unstated, whole));
    const repaired = second.failed === undefined ? admitClaims(second.answer, card, { repo }) : null;
    // A repair that cannot be read or admits nothing changes nothing. A whole answer replaces the first only when it
    // leaves no more sections unquoted; a list of the dropped claims only adds new spans, within the claim limit.
    const fresh = repaired?.readable ? repaired.claims.filter(claim => !verdict.claims.some(kept => kept.id === claim.id)) : [];
    if (whole && repaired?.readable && repaired.claims.length > 0 && uncovered(card, repaired.claims) <= uncovered(card, verdict.claims)) {
      recovered = fresh.length;
      verdict = repaired;
    } else if (!whole && fresh.length > 0) {
      const added = fresh.slice(0, CLAIM_LIMITS.claims - verdict.claims.length);
      recovered = added.length;
      verdict = { ...verdict, claims: [...verdict.claims, ...added] };
    }
  }
  const done = result(verdict, recovered);
  if (!done.readable) log(`Claims: #${card.number} has no claim: its answer could not be read, even asked once more`);
  else if (done.claims.length === 0) log(`Claims: #${card.number} has no claim: every claim it gave was dropped`);
  else if (done.gap) {
    const kept = done.claims.length === 1 ? 'its 1 claim is' : `its ${done.claims.length} claims are`;
    log(`Claims: #${card.number} has no pending or flagged claim quoting its ${sectionNames(done.caveats.filter(caveat => !caveat.covered))} after one repair; ${kept} kept and the gap recorded`);
  }
  if (done.claims.length) done.file = serialize({ schema: CLAIMS_CACHE_SCHEMA, mergeSha: card.mergeSha, contract, claims: done.claims, gap: done.gap, at: now.toISOString() });
  return done;
}

/** `work` over `items` with at most `limit` running at once; the results in the items' order. */
async function pool(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const at = next;
      next += 1;
      results[at] = await work(items[at]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Each card's claims, in the cards' order, at most four calls at once: `{ number, mergeSha, fromCache, claims, dropped,
 * caveats: [{ heading, start, end, covered }], gap, recovered }`. `cache` holds a new cache file for each card claimed
 * this run with at least one claim admitted, marked `gap` when a caveat section is left unquoted; never one read from
 * the cache. `calls` counts the model calls made, `repairs` those asked once more, `recovered` the claims a repair
 * admitted at a span the first answer did not (0 for a card read from the cache). Each answer that needed a repair is
 * passed to `refused` (rejected.json).
 */
export async function claimCards({ cards, ask, model, repo, readCached = async () => null, now, log, refused = () => {} }) {
  const contract = claimsContract({ model });
  const done = await pool(cards, CONCURRENCY, card => claimOne({ card, ask, model, repo, contract, readCached, now, log, refused }));
  const cache = {};
  for (const one of done) if (one.file) cache[`cache/claims/${one.mergeSha}.json`] = one.file;
  const calls = done.reduce((sum, one) => sum + one.calls, 0);
  const repairs = done.filter(one => one.calls === 2).length;
  const fromCache = done.filter(one => one.fromCache).length;
  const gaps = done.filter(one => one.gap).length;
  const recovered = done.reduce((sum, one) => sum + one.recovered, 0);
  log(`Claims: ${plural(calls, 'call')}, ${plural(repairs, 'repair')}, ${plural(recovered, 'claim')} recovered; ${fromCache} of ${cards.length} pull requests from the cache; ${gaps} with a caveat gap`);
  const results = done.map(({ number, mergeSha, fromCache: cached, claims, dropped, caveats, gap, recovered: added }) => ({ number, mergeSha, fromCache: cached, claims, dropped, caveats, gap, recovered: added }));
  return { results, cache, calls, repairs, recovered };
}
