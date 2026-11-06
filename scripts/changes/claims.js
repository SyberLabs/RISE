/**
 * Claims (docs/plans/RISE-CHANGES.md, Claims): one model call per included pull request lists what it claims, each
 * claim resting on exact words of the pull request. Code admits every claim, with no model: the quote must occur word
 * for word in the field it names (line endings read as LF), code computes its span from the first occurrence, every
 * number in the claim's text must be in the quote, and kind and status come from the menu. A body section that says
 * something is not verified, not done or pending must be quoted by a pending or flagged claim; when none does, the
 * pull request is asked once more, and a gap still left is recorded, never filled by code. A pull request's admitted
 * claims are kept by merge SHA and reused while the contract hash holds and every claim re-admits against its text.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { mentionsIn, parseModelJson } from './admit.js';
import { CLAIMS_CACHE_SCHEMA, CLAIM_LIMITS, CLAIM_MENU, cachedClaimsProblems } from '../../src/core/changes/contract.js';
import { FACTS_VERSION } from '../../src/core/changes/facts.js';
import { serialize } from '../../src/core/changes/write.js';
import { CLAIMS_CONTEXT_VERSION, CLAIMS_SYSTEM, buildClaimsRequest, lf } from './claims-context.js';
import { contractHash } from './route.js';

const CONCURRENCY = 4;
const CAVEAT_STATUSES = new Set(['pending', 'flagged']);

/** The words that make a heading or a label line a caveat section, matched whole and in any case. */
export const CAVEAT_PHRASES = Object.freeze(['not verified', 'unverified', 'not done', 'not yet', 'not in this pr', 'pending', 'awaiting', 'human gate', 'needs a human', 'todo', 'known limits']);
const CAVEAT = new RegExp(`\\b(?:${CAVEAT_PHRASES.join('|')})\\b`, 'iu');

const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/u;
const BOLD_LABEL = /^ {0,3}(\*\*|__)(.+?)\1[ \t]*$/u;
const COLON_LABEL = /^(?![-*+>|#]|\d+[.)])\S.{0,78}:[ \t]*$/u;

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
  const stated = new Set(mentionsIn(quote).map(mention => mention.value));
  const unstated = mentionsIn(given.text).find(mention => !stated.has(mention.value));
  if (unstated) return { reason: `its text says "${unstated.written}", which its quote does not` };
  const start = codePoints(source.slice(0, at));
  const end = start + codePoints(quote);
  const span = indexed ? { field: given.field, index, start, end, text: quote } : { field: given.field, start, end, text: quote };
  return { claim: { id: claimId({ repo, pr: card.number, mergeSha: card.mergeSha, field: given.field, index, start, end }), text: given.text, kind: given.kind, status: given.status, span } };
}

/**
 * The claims admitted from one answer for this card, in the order given, and a line for each claim dropped;
 * `readable` is false, with nothing admitted, when the answer is not one JSON object `{"claims": [...]}`.
 */
export function admitClaims(text, card, { repo }) {
  let given;
  try {
    given = parseModelJson(text).claims;
  } catch {
    given = undefined;
  }
  if (!Array.isArray(given)) return { readable: false, claims: [], dropped: [] };
  const claims = [];
  const dropped = [];
  given.forEach((entry, at) => {
    if (at >= CLAIM_LIMITS.claims) {
      dropped.push(`claim ${at + 1}: past the ${CLAIM_LIMITS.claims}-claim limit`);
      return;
    }
    const { claim, reason } = admitOne(entry, card, repo);
    if (claim && claims.some(earlier => earlier.id === claim.id)) dropped.push(`claim ${at + 1}: it repeats the span of an earlier claim`);
    else if (claim) claims.push(claim);
    else dropped.push(`claim ${at + 1}: ${reason}`);
  });
  return { readable: true, claims, dropped };
}

/** A heading line's level and text: an ATX heading has its level, a label line (wholly bold, or ending in a colon) 7. */
function headingOf(line) {
  const atx = ATX.exec(line);
  if (atx) return { level: atx[1].length, text: atx[2] };
  const label = BOLD_LABEL.exec(line)?.[2] ?? (COLON_LABEL.test(line) ? line.trim() : null);
  return label === null ? null : { level: 7, text: label.replace(/:\s*$/u, '').trim() };
}

/**
 * The body's caveat sections, `{ heading, start, end }` in code points over the body with line endings read as LF: the
 * text under each heading or label line that names a CAVEAT_PHRASES phrase, up to the next heading of its level or
 * higher (a label line ends at the next heading or label line). A section with nothing under it is none.
 */
export function caveatSections(body) {
  const text = lf(body);
  const lines = [];
  for (let at = 0; at <= text.length;) {
    const end = text.indexOf('\n', at);
    const stop = end < 0 ? text.length : end;
    lines.push({ at, next: end < 0 ? text.length : end + 1, heading: headingOf(text.slice(at, stop)) });
    if (end < 0) break;
    at = end + 1;
  }
  const sections = [];
  lines.forEach((line, i) => {
    if (!line.heading || !CAVEAT.test(line.heading.text)) return;
    const closing = lines.slice(i + 1).find(later => later.heading && (later.heading.level <= line.heading.level || line.heading.level === 7));
    const end = closing ? closing.at : text.length;
    if (!text.slice(line.next, end).trim()) return;
    sections.push({ heading: line.heading.text, start: codePoints(text.slice(0, line.next)), end: codePoints(text.slice(0, end)) });
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

function refusalOf(verdict, caveats) {
  if (!verdict.readable) return ['The answer could not be read as one JSON object {"claims": [...]}.'];
  const lines = verdict.dropped.map(line => `Dropped ${line}.`);
  if (verdict.claims.length === 0) lines.push('No claim was admitted.');
  for (const section of caveats.filter(caveat => !caveat.covered)) {
    lines.push(`The body’s section "${section.heading}" (characters ${section.start} to ${section.end}) says what is not verified, not done or pending, and no claim of status pending or flagged quotes from it; add one, quoting its exact words.`);
  }
  return lines;
}

const repairOf = (request, answer, refusal) => ({
  system: request.system,
  prompt: [request.prompt, '', 'Your previous answer was:', '', answer, '', 'RISE refused it:', ...refusal.map(line => `- ${line}`), '', 'Answer again with the whole JSON object.'].join('\n')
});

/** One card's claims: from its cache file when that re-admits, else from at most two calls. */
async function claimOne({ card, ask, model, repo, contract, readCached, now, log, refused }) {
  const text = await readCached(card.mergeSha);
  if (text !== null) {
    const cached = readClaimsCache(text, card, { repo, contract });
    if (cached.claims) return { number: card.number, mergeSha: card.mergeSha, fromCache: true, claims: cached.claims, dropped: [], caveats: cached.caveats, gap: cached.caveats.some(caveat => !caveat.covered), calls: 0 };
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
  const result = verdict => {
    const caveats = caveatsOf(card, verdict.claims);
    return { number: card.number, mergeSha: card.mergeSha, fromCache: false, claims: verdict.claims, dropped: verdict.dropped, caveats, gap: caveats.some(caveat => !caveat.covered), calls, readable: verdict.readable };
  };
  if (first.failed !== undefined) {
    log(`Claims: #${card.number} has no claim: its call failed (${first.failed})`);
    return result({ readable: false, claims: [], dropped: [] });
  }
  let verdict = admitClaims(first.answer, card, { repo });
  const caveats = caveatsOf(card, verdict.claims);
  if (!verdict.readable || verdict.claims.length === 0 || caveats.some(caveat => !caveat.covered)) {
    const refusal = refusalOf(verdict, caveats);
    refused({ stage: 'claims', pull: card.number, attempt: 1, refusal, answer: String(first.answer ?? '') });
    const second = await attempt(repairOf(request, String(first.answer ?? ''), refusal));
    const repaired = second.failed === undefined ? admitClaims(second.answer, card, { repo }) : null;
    if (repaired?.readable) verdict = repaired;
  }
  const done = result(verdict);
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
 * caveats: [{ heading, start, end, covered }], gap }`. `cache` holds a new cache file for each card claimed this run
 * with at least one claim admitted, marked `gap` when a caveat section is left unquoted; never one read from the cache.
 * `calls` counts the model calls made, `repairs` those asked once more. Each answer that needed a repair is passed to
 * `refused` (rejected.json).
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
  log(`Claims: ${plural(calls, 'call')}, ${plural(repairs, 'repair')}; ${fromCache} of ${cards.length} pull requests from the cache; ${gaps} with a caveat gap`);
  const results = done.map(({ number, mergeSha, fromCache: cached, claims, dropped, caveats, gap }) => ({ number, mergeSha, fromCache: cached, claims, dropped, caveats, gap }));
  return { results, cache, calls, repairs };
}
