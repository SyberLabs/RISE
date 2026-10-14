/**
 * One run of RISE Changes (docs/plans/RISE-CHANGES.md): collect, prefilter,
 * route, compose, admit, and the two files to write. `gh` and `ask` are
 * injected, so the whole run is testable without GitHub or a model; nothing
 * here writes a file, pushes a branch or opens an issue.
 */
import { boundary, collectMergedPulls, readIndex } from './collect.js';
import { composeCurrent } from './compose.js';
import { MODEL, REPOSITORY } from './contract.js';
import { prefilter } from './prefilter.js';
import { admitRoutes, buildRouteRequest, selectChanges } from './route.js';
import { buildDigest, digestId, issueFor, nextIndex, serialize } from './write.js';

/** More merged pull requests than one router call should judge; narrow the period with --since. */
export const MAX_CANDIDATES = 200;

/**
 * `{ written: false, reason }` when there is nothing to write, else
 * `{ written: true, id, files, issue }`: the file names and their text, and
 * the notification issue's title and body.
 */
export async function runDigest({ gh, ask, repo = REPOSITORY, now = new Date(), since, model = MODEL, log }) {
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

  const included = candidates
    .filter(pull => includedNumbers.has(pull.number))
    .map(pull => ({ ...pull, route: routes.get(pull.number) }));
  const { current, sources } = await composeCurrent({ ask, pulls: included, model, period, log });

  const id = digestId(period.to, (index?.digests ?? []).map(entry => entry.id));
  const digest = buildDigest({ id, period, generatedAt: now.toISOString(), model, changes, current, sources });
  const next = nextIndex(index, digest);
  return {
    written: true,
    id,
    files: { [`${id}.json`]: serialize(digest), 'index.json': serialize(next) },
    issue: issueFor(digest)
  };
}
