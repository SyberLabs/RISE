/**
 * Write: the digest file, the next index and the owner's notification issue,
 * as text. Nothing here touches a disk or a branch; a digest that breaks the
 * contract's bounds is refused before any of it is produced.
 */
import { DIGEST_ID, DIGEST_SCHEMA, INDEX_SCHEMA, LIMITS, SITE, digestProblems, indexProblems } from './contract.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Stable JSON: two-space indent and a final newline; key order is the order built. */
export function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** The period in words, by UTC date: "12–19 October", "28 September – 5 October". */
export function periodLabel({ from, to }) {
  const start = new Date(from);
  const end = new Date(to);
  const day = date => date.getUTCDate();
  const month = date => MONTHS[date.getUTCMonth()];
  const year = date => date.getUTCFullYear();
  if (year(start) !== year(end)) return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  if (month(start) !== month(end)) return `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
  if (day(start) !== day(end)) return `${day(start)}–${day(end)} ${month(end)}`;
  return `${day(end)} ${month(end)}`;
}

/** The date of period.to, with -2, -3… when that day already has a digest. */
export function digestId(to, existingIds) {
  const date = new Date(to).toISOString().slice(0, 10);
  const taken = new Set(existingIds);
  let id = date;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${date}-${suffix}`;
  if (!DIGEST_ID.test(id)) throw new Error(`No digest id is free for ${date}`);
  return id;
}

/** The digest envelope, refused when it breaks the contract or its 256 KB bound. */
export function buildDigest({ id, period, generatedAt, model, changes, current, sources }) {
  const digest = {
    schema: DIGEST_SCHEMA,
    id,
    audience: 'team',
    title: `What changed in RISE, ${periodLabel(period)}`,
    period: { from: period.from, to: period.to },
    generatedAt,
    model: { router: model, composer: model, via: 'Claude Code' },
    changes,
    current,
    sources
  };
  const problems = digestProblems(digest);
  if (problems.length) throw new Error(`The digest breaks the contract: ${problems.slice(0, 5).join('; ')}`);
  const bytes = new TextEncoder().encode(serialize(digest)).length;
  if (bytes > LIMITS.fileBytes) throw new Error(`The digest is ${bytes} bytes; the contract allows ${LIMITS.fileBytes} (256 KB)`);
  return digest;
}

/** The index with this digest added: newest first by period.to, at most 200 entries. */
export function nextIndex(index, digest) {
  const digests = index === null ? [] : index.digests;
  if (digests.some(entry => entry.id === digest.id)) throw new Error(`index.json already lists ${digest.id}`);
  const entry = {
    id: digest.id,
    audience: digest.audience,
    title: digest.title,
    period: digest.period,
    count: digest.changes.filter(change => change.included).length
  };
  const next = {
    schema: INDEX_SCHEMA,
    digests: [entry, ...digests]
      .sort((a, b) => Date.parse(b.period.to) - Date.parse(a.period.to) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .slice(0, LIMITS.index)
  };
  const problems = indexProblems(next);
  if (problems.length) throw new Error(`The index breaks the contract: ${problems.slice(0, 5).join('; ')}`);
  return next;
}

/** A pull request's words in a Markdown table cell: one line, no pipe, no mention, no tag. */
const cell = text => String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').replace(/@/g, '@\u200b').replace(/</g, '&lt;');

/** The notification issue: the reading's link, the models, and every change with its route. */
export function issueFor(digest) {
  const label = periodLabel(digest.period);
  const included = digest.changes.filter(change => change.included).length;
  return {
    title: `What changed in RISE: ${label}`,
    body: [
      `The team digest for ${label} is ready: ${SITE}/changes/${digest.id}`,
      '',
      `${included} of ${digest.changes.length} merged pull requests are in it. Routed and composed by ${digest.model.router} (router) and ${digest.model.composer} (composer), via ${digest.model.via}.`,
      '',
      '| Pull request | Title | Audience | Significance | Kind | Included | Reason |',
      '|---|---|---|---|---|---|---|',
      ...digest.changes.map(change => `| [#${change.number}](${change.url}) | ${cell(change.title)} | ${change.route.audience} | ${change.route.significance} | ${change.route.kind} | ${change.included ? 'yes' : 'no'} | ${change.reason} |`),
      '',
      `Period: ${digest.period.from} to ${digest.period.to}. Files: \`${digest.id}.json\` and \`index.json\` on the changes-data branch.`
    ].join('\n')
  };
}
