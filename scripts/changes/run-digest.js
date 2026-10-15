/**
 * One run of RISE Changes (docs/plans/RISE-CHANGES.md): collect, prefilter,
 * route, compose, admit, illustrate, and the two files to write. `gh` and `ask` are
 * injected, so the whole run is testable without GitHub or a model; nothing
 * here writes a file, pushes a branch or opens an issue.
 */
import { boundary, collectMergedPulls, readIndex } from '../../src/core/changes/collect.js';
import { composeCurrent } from './compose.js';
import { illustrate } from './illustrate.js';
import { MODEL, REPOSITORY, qualityLine } from '../../src/core/changes/contract.js';
import { prefilter } from '../../src/core/changes/prefilter.js';
import { admitRoutes, buildRouteRequest, selectChanges } from './route.js';
import { buildDigest, digestId, issueFor, nextIndex, serialize } from '../../src/core/changes/write.js';

/** More merged pull requests than one router call should judge; narrow the period with --since. */
export const MAX_CANDIDATES = 200;

/**
 * The run's first-pass score (docs/plans/RISE-CHANGES.md, Quality gates): told each rule that fired and each repair
 * asked for; `score(letGo)` is the digest's `quality`, right the first time only with no repair and nothing let go.
 */
export function createTally() {
  const checks = {};
  const repairs = { composition: 0, illustrator: 0 };
  return {
    fired(rule, count = 1) { checks[rule] = (checks[rule] ?? 0) + count; },
    repaired(stage) { repairs[stage] += 1; },
    score(letGo) {
      return {
        firstPass: repairs.composition + repairs.illustrator === 0 && letGo === 0,
        repairs: { ...repairs },
        checks: Object.fromEntries(Object.entries(checks).sort(([a], [b]) => (a < b ? -1 : 1)))
      };
    }
  };
}

/**
 * `{ written: false, reason }` when there is nothing to write, else
 * `{ written: true, id, files, issue }`: the file names and their text, and
 * the notification issue's title and body. `renderCheck`, when given, renders
 * each admitted figure (illustrate.js).
 */
export async function runDigest({ gh, ask, repo = REPOSITORY, now = new Date(), since, model = MODEL, log, renderCheck }) {
  const index = await readIndex(gh, repo);
  const period = { from: boundary({ index, now, since }), to: now.toISOString() };
  log(`Period: ${period.from} to ${period.to}${index === null ? ' (no index yet)' : ''}`);

  const pulls = await collectMergedPulls(gh, { repo, from: period.from, to: period.to });
  if (pulls.length === 0) return { written: false, reason: 'No pull request was merged into main in the period' };
  const { records, candidates } = prefilter(pulls);
  log(`Merged: ${pulls.length} (${records.length} records-only, ${candidates.length} to route)`);
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(`${candidates.length} pull requests to route; at most ${MAX_CANDIDATES} in one run. Narrow the period with --since`);
  }

  const routes = candidates.length ? admitRoutes(await ask({ ...buildRouteRequest(candidates), model }), candidates) : new Map();
  const { changes, unlisted } = selectChanges({ candidates, records, routes });
  for (const change of changes) {
    log(`  #${change.number} ${change.route.audience}/${change.route.significance}/${change.route.kind} ${change.included ? 'included' : `not included (${change.reason})`}`);
  }
  if (unlisted) log(`${unlisted} more pull requests are not listed: a digest lists at most ${changes.length}`);
  const includedNumbers = new Set(changes.filter(change => change.included).map(change => change.number));
  if (includedNumbers.size === 0) return { written: false, reason: 'No change was included: none was routed to the team as notable or major' };

  const routed = candidates.map(pull => ({ ...pull, route: routes.get(pull.number) }));
  const included = routed.filter(pull => includedNumbers.has(pull.number));
  // The routed changes left out are context: a later minor fix may settle an included change's caveat.
  const context = routed.filter(pull => !includedNumbers.has(pull.number));
  const tally = createTally();
  const composed = await composeCurrent({ ask, pulls: included, context, model, period, log, tally });
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
  const { current, notes: pictureNotes } = await illustrate({ ask, model, current: composed.current, pictures: composed.pictures, pulls: included.filter(pull => !unspoken.has(pull.number)), period, log, tally, renderCheck });
  const notes = [...unspokenNotes, ...pictureNotes];
  const { sources } = composed;
  // The first pass is lost by a repair or by anything let go, a picture or an unspoken change; the latter is never a repair.
  const quality = tally.score(pictureNotes.length + unspoken.size);
  log(`Quality: ${qualityLine(quality)}`);
  log(`Quality JSON: ${JSON.stringify(quality)}`);

  const id = digestId(period.to, (index?.digests ?? []).map(entry => entry.id));
  const digest = buildDigest({ id, period, generatedAt: now.toISOString(), model, changes: spokenChanges, current, sources, quality, notes });
  const next = nextIndex(index, digest);
  return {
    written: true,
    id,
    files: { [`${id}.json`]: serialize(digest), 'index.json': serialize(next) },
    issue: issueFor(digest)
  };
}
