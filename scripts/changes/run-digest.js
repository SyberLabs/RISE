/**
 * One run of RISE Changes (docs/plans/RISE-CHANGES.md): collect, prefilter,
 * route, claims (with `claims` only), compose, admit, illustrate, and the two files to write. `gh`, `ask`,
 * `readCache` (a route cache file's text by merge SHA, or null) and `readClaimsCache` (the same for claims) are injected, so
 * the whole run is testable without GitHub, a model or the data branch; nothing
 * here writes a file, pushes a branch or opens an issue.
 */
import { boundary, collectMergedPulls, readIndex } from '../../src/core/changes/collect.js';
import { requirePublicRepository } from '../../src/core/changes/repository.js';
import { composeCurrent } from './compose.js';
import { illustrate } from './illustrate.js';
import { endHeldPictures, pictureCoverage } from './held.js';
import { DIGEST_ID, FALLBACK_ROUTE, MODEL, REPOSITORY, densityLine, qualityLine } from '../../src/core/changes/contract.js';
import { factCard } from '../../src/core/changes/facts.js';
import { prefilter } from '../../src/core/changes/prefilter.js';
import { routeCandidates, selectChanges } from './route.js';
import { claimCards, claimsContract } from './claims.js';
import { buildDigest, digestId, issueFor, nextIndex, serialize } from '../../src/core/changes/write.js';
import { BRANDS } from '../../src/core/figures/brands.js';
import { customerFor } from './customers.js';
import { MCP_CURRENT_BYTES } from '../../src/live/hosts/mcp-size.js';

/** More merged pull requests than one router call should judge; narrow the period with --since. */
const MAX_CANDIDATES = 200;

/**
 * rejected.json's bounds: each answer at most the largest Current RISE admits (a picture's source is smaller), the
 * file at most 4 MiB.
 */
export const REJECTED_LIMITS = Object.freeze({ answer: MCP_CURRENT_BYTES, refusal: 16 * 1024, file: 4 * 1024 * 1024 });

/** A refusal's lines kept while they total at most the refusal bound, the last one cut to fit. */
function capRefusal(lines) {
  let left = REJECTED_LIMITS.refusal;
  const kept = [];
  for (const line of lines) {
    if (left <= 0) break;
    kept.push(line.slice(0, left));
    left -= line.length;
  }
  return kept;
}

/**
 * The refused answers as rejected.json: a JSON array, one entry per line, in the order refused. An answer cut to its
 * bound, or emptied once the file would pass its bound, is marked `truncated`; every entry keeps its refusal lines, cut to their own bound.
 */
export function serializeRejected(entries) {
  const capped = entries.map(entry => {
    const refusal = capRefusal(entry.refusal);
    const cutRefusal = refusal.length < entry.refusal.length || refusal.some((line, i) => line.length < entry.refusal[i].length);
    const cutAnswer = entry.answer.length > REJECTED_LIMITS.answer;
    return cutRefusal || cutAnswer
      ? { ...entry, refusal, answer: entry.answer.slice(0, REJECTED_LIMITS.answer), truncated: true }
      : entry;
  });
  const bare = capped.map(entry => JSON.stringify({ ...entry, answer: '', truncated: true }));
  // A line's bytes with its separator; "[\n" and "\n]\n" add 3 more than the lines do.
  const bytes = line => Buffer.byteLength(line, 'utf8') + 2;
  let room = REJECTED_LIMITS.file - 3 - bare.reduce((sum, line) => sum + bytes(line), 0);
  let open = true;
  const lines = capped.map((entry, index) => {
    room += bytes(bare[index]);
    const whole = JSON.stringify(entry);
    open &&= room >= bytes(whole);
    const line = open ? whole : bare[index];
    room -= bytes(line);
    return line;
  });
  return `[\n${lines.join(',\n')}\n]\n`;
}

/**
 * The run's first-pass score (docs/plans/RISE-CHANGES.md, Quality gates): told each rule that fired and each repair
 * asked for; `score(letGo, density)` is the digest's `quality`, right the first time only with no repair and nothing
 * let go, with how densely the reading is pictured.
 */
function createTally() {
  const checks = {};
  const repairs = { composition: 0, illustrator: 0 };
  return {
    fired(rule, count = 1) { checks[rule] = (checks[rule] ?? 0) + count; },
    repaired(stage) { repairs[stage] += 1; },
    score(letGo, density) {
      return {
        firstPass: repairs.composition + repairs.illustrator === 0 && letGo === 0,
        repairs: { ...repairs },
        checks: Object.fromEntries(Object.entries(checks).sort(([a], [b]) => (a < b ? -1 : 1))),
        ...(density ? { density } : {})
      };
    }
  };
}

/**
 * How densely the finished reading is pictured: the pictures it shows, the included changes it speaks of, its speaking
 * beats (those with refs), how many are shown a picture of what they speak of, and the longest run of them without one.
 */
function measureDensity(current, { sources, pictureRefs, includedChanges }) {
  const starts = new Map();
  current.beats.forEach((beat, index) => { if (beat.scene !== undefined) starts.set(index, { refs: pictureRefs[beat.scene] ?? null }); });
  const { speaking, pictured, longest } = pictureCoverage(current.beats.length, starts, sources);
  return {
    pictures: (current.scenes ?? []).filter(scene => Object.hasOwn(pictureRefs, scene.id)).length,
    includedChanges,
    speakingBeats: speaking,
    pictured,
    longestUnpictured: longest
  };
}

/**
 * `{ written: false, reason }` when there is nothing to write, else
 * `{ written: true, id, files, cache, issue }`: the file names and their text, the new cache files by path, and
 * the notification issue's title and body; with `claims`, also `claims`, claims.json's text, and the new claims cache
 * files in `cache` (the composer is not given the claims). `renderCheck`, when given, renders
 * each admitted figure (illustrate.js). `onRefused` is given each model
 * answer RISE refuses, `{ stage, attempt, beat?, refusal, answer }`, the moment
 * it is refused, so a run that throws or is stopped has already handed it over.
 */
const kitBrief = picture => picture !== null && typeof picture === 'object' && (Object.hasOwn(picture, 'brief') || Object.hasOwn(picture, 'medium') || Object.hasOwn(picture, 'code'));

export async function runDigest({ gh, ask, repo = REPOSITORY, now = new Date(), since, supersede, model = MODEL, log, renderCheck, figures, dryRun = false, readCache, claims = false, readClaimsCache, onRefused = () => {} }) {
  const refused = entry => onRefused({ ...entry, answer: String(entry.answer ?? '') });
  if (figures !== undefined && figures !== 'kit') throw new Error('--figures kit is the only public-digest mode');
  const kitOnly = figures === 'kit';
  // A customer's product names the digest, and its brand draws the figures; a brand the company has not confirmed runs only dry.
  const customer = customerFor(repo);
  const branded = customer ? BRANDS[customer.brand] : null;
  if (customer && !branded) throw new Error(`${repo}: brand ${customer.brand} is not in brands.js`);
  if (branded && !branded.confirmed && !dryRun) throw new Error(`${repo}: its brand is not confirmed by the company yet, so only a dry run may use it`);
  // Before the index, the pull requests, or a model: a private repository stops here.
  await requirePublicRepository(gh, repo);
  const index = await readIndex(gh, repo);
  // A re-run of a published period replaces that digest in the list: its period starts where the replaced one did.
  let replaced = null;
  if (supersede !== undefined) {
    if (typeof supersede !== 'string' || !DIGEST_ID.test(supersede)) throw new Error('--supersede names a digest id: a date, with a short suffix for a second run that day');
    replaced = index?.digests.find(entry => entry.id === supersede) ?? null;
    if (replaced === null) throw new Error(`--supersede ${supersede}: index.json lists no such digest`);
    if (replaced.supersededBy !== undefined) throw new Error(`${supersede} is already superseded by ${replaced.supersededBy}; supersede that one instead`);
  }
  const period = { from: boundary({ index, now, since: since ?? replaced?.period.from }), to: now.toISOString() };
  log(`Period: ${period.from} to ${period.to}${index === null ? ' (no index yet)' : ''}`);
  if (replaced) log(`Supersedes ${replaced.id}: /changes will list this digest in its place`);

  const pulls = await collectMergedPulls(gh, { repo, from: period.from, to: period.to });
  if (pulls.length === 0) return { written: false, reason: 'No pull request was merged into main in the period' };
  const { records, candidates } = prefilter(pulls);
  log(`Merged: ${pulls.length} (${records.length} records-only, ${candidates.length} to route)`);
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(`${candidates.length} pull requests to route; at most ${MAX_CANDIDATES} in one run. Narrow the period with --since`);
  }

  const cards = candidates.map(factCard);
  const { routes, cache } = await routeCandidates({ cards, ask, model, product: customer?.product, readCached: readCache, now, log, refused });
  const { changes, unlisted } = selectChanges({ candidates, records, routes });
  for (const change of changes) {
    log(`  #${change.number} ${change.route.audience}/${change.route.significance}/${change.route.kind} ${change.included ? 'included' : `not included (${change.reason})`}`);
  }
  if (unlisted) log(`${unlisted} more pull requests are not listed: a digest lists at most ${changes.length}`);
  const unrouted = [...routes.values()].filter(route => route === FALLBACK_ROUTE).length;
  if (unrouted) log(`Unrouted: ${unrouted} of ${candidates.length} pull requests; the router's answer for them could not be read, so they took the fallback route skip/minor/records`);
  const includedNumbers = new Set(changes.filter(change => change.included).map(change => change.number));
  if (includedNumbers.size === 0) {
    return { written: false, reason: unrouted > 0 && unrouted === candidates.length
      ? `No change was included: the router's answer could not be read for any of the ${unrouted} pull requests`
      : 'No change was included: none was routed to the team as notable or major' };
  }

  let claimed = null;
  if (claims) {
    claimed = await claimCards({ cards: cards.filter(card => includedNumbers.has(card.number)), ask, model, repo, readCached: readClaimsCache, now, log, refused });
    Object.assign(cache, claimed.cache);
  }

  const routed = candidates.map(pull => ({ ...pull, route: routes.get(pull.number) }));
  const included = routed.filter(pull => includedNumbers.has(pull.number));
  // The routed changes left out are context: a later minor fix may settle an included change's caveat.
  const context = routed.filter(pull => !includedNumbers.has(pull.number));
  const tally = createTally();
  const composed = await composeCurrent({ ask, pulls: included, context, model, period, log, tally, refused, kitOnly, product: customer?.product });
  for (const end of composed.dropped ?? []) log(`  RISE gave up the ${end} to make room for the pictures`);
  // A change chosen for the reading that no beat speaks of is left out of it, said in the notes, and not repaired.
  const unspoken = new Set(composed.unspoken ?? []);
  const spokenChanges = changes.map(change => (unspoken.has(change.number) ? { ...change, included: false, reason: 'unspoken' } : change));
  // Past a few, one note names them all, so the notes stay within the contract's bound beside the picture notes.
  const unspokenNotes = unspoken.size > 5
    ? [`${[...unspoken].map(number => `#${number}`).join(', ')} were chosen for the reading, but no beat spoke of them; they are listed as unspoken under How this was chosen.`]
    : [...unspoken].map(number => `#${number} was chosen for the reading, but no beat spoke of it; it is listed as unspoken under How this was chosen.`);
  for (const line of unspokenNotes) log(`  ${line}`);
  if (unspoken.size) tally.fired('unspoken', unspoken.size);
  const kits = composed.pictures.filter(picture => picture.kit !== undefined).length;
  log(`Composed ${composed.current.beats.length} beats; drawing ${composed.pictures.length} pictures (${kits} from the figure kit, ${composed.pictures.length - kits} by the illustrator)`);
  if (kitOnly && composed.pictures.some(kitBrief)) throw new Error('A public digest draws kit figures only; an illustrator brief is refused before any picture is drawn');
  const { current: illustrated, notes: pictureNotes } = await illustrate({ ask, model, current: composed.current, pictures: composed.pictures, pulls: included.filter(pull => !unspoken.has(pull.number)), period, log, tally, refused, renderCheck, brand: branded?.brand });
  if (kitOnly && (illustrated.scenes ?? []).some(scene => scene !== null && typeof scene === 'object' && Object.hasOwn(scene, 'code'))) {
    throw new Error('A public digest draws kit figures only; a scene with code is refused and nothing is written');
  }
  const notes = [...unspokenNotes, ...pictureNotes];
  const { sources } = composed;
  // A picture stays only while its beats speak of what it shows; then the reading returns to RISE's eye.
  const pictureRefs = Object.fromEntries(composed.pictures
    .map(picture => [illustrated.beats[picture.beat]?.scene, picture.refs])
    .filter(([id]) => typeof id === 'string' && id.startsWith('picture-')));
  const { current, ended } = endHeldPictures(illustrated, { sources, pictureRefs });
  if (ended.length) log(`  RISE’s eye returns at beat${ended.length === 1 ? '' : 's'} ${ended.join(', ')}, where a picture’s beats move on`);
  // The first pass is lost by a repair or by anything let go, a picture or an unspoken change; the latter is never a repair.
  const density = measureDensity(current, { sources, pictureRefs, includedChanges: spokenChanges.filter(change => change.included).length });
  const quality = tally.score(pictureNotes.length + unspoken.size, density);
  log(`Quality: ${qualityLine(quality)}`);
  log(densityLine(density));
  log(`Quality JSON: ${JSON.stringify(quality)}`);

  const id = digestId(period.to, (index?.digests ?? []).map(entry => entry.id));
  const digest = buildDigest({ id, period, generatedAt: now.toISOString(), model, changes: spokenChanges, current, sources, quality, notes, repo, name: customer?.product.name });
  const next = nextIndex(index, digest, { supersede: replaced?.id });
  return {
    written: true,
    id,
    files: { [`${id}.json`]: serialize(digest), 'index.json': serialize(next) },
    cache,
    issue: issueFor(digest, { supersedes: replaced?.id, repository: repo, name: customer?.product.name, unrouted }),
    ...(claimed ? { claims: serialize({ repo, model, contract: claimsContract({ model }), calls: claimed.calls, repairs: claimed.repairs, pulls: claimed.results }) } : {})
  };
}
