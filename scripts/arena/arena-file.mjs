/**
 * The Decision Arena run file: one frozen, content-addressed capture.
 *
 * `run-<sha12>.json` is named by the first twelve hex digits of the SHA-256 of
 * its own bytes, so a file that was edited after capture no longer matches its
 * name. A run captured from a harness with uncommitted changes cannot be
 * reproduced from its commit and is refused, unless it is a mock run (a
 * pipeline check, never published). A run stopped at the cost cap says
 * `partial: true`.
 */
import { createHash } from 'node:crypto';

export const ARENA_SCHEMA = 'syberlabs.decision-arena/v1';
const FILE_NAME = /^run-([0-9a-f]{12})\.json$/u;
const COST_SOURCES = new Set(['billed', 'computed', 'zero']);

export const sha256Hex = text => createHash('sha256').update(text).digest('hex');

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);

/**
 * @param text the file's exact bytes, as text
 * @param fileName its published name, `run-<sha12>.json`
 * @returns the parsed run; throws with the reason it was refused
 */
export function readArenaRun(text, fileName) {
  const named = FILE_NAME.exec(fileName);
  if (!named) throw new Error('An arena run is named run-<sha12>.json.');
  if (sha256Hex(text).slice(0, 12) !== named[1]) throw new Error('The run file does not match the hash in its name.');
  let run;
  try { run = JSON.parse(text); } catch { throw new Error('The run file is not JSON.'); }
  if (run?.schema !== ARENA_SCHEMA) throw new Error(`Unknown arena schema; expected ${ARENA_SCHEMA}.`);
  const { harness, inputs, providers, results } = run;
  if (!isObject(harness) || !/^[0-9a-f]{40}$/u.test(harness.commit) || typeof harness.node !== 'string') {
    throw new Error('The run does not name the harness commit that produced it.');
  }
  if (harness.dirty !== false && !(harness.dirty === true && harness.mock === true)) {
    throw new Error('The run was captured from uncommitted harness code.');
  }
  if (typeof run.runId !== 'string' || !run.runId || typeof run.createdAt !== 'string'
    || !hash(inputs?.cases?.sha256) || !Number.isSafeInteger(inputs.cases.count)
    || !hash(inputs.options?.sha256) || !hash(inputs.catalog?.sha256)
    || !isObject(run.scores) || !Array.isArray(run.notes) || (run.partial !== undefined && run.partial !== true)) {
    throw new Error('The run lacks its identity, input hashes, scores or notes.');
  }
  if (!Array.isArray(providers) || !providers.length
    || providers.some(item => typeof item?.id !== 'string' || !Array.isArray(item.servedModels) || !isObject(item.pricing))
    || new Set(providers.map(item => item.id)).size !== providers.length) {
    throw new Error('The run lists no valid providers.');
  }
  const ids = new Set(providers.map(item => item.id));
  if (!Array.isArray(results) || results.some(row => !isObject(row)
    || typeof row.caseId !== 'string' || !ids.has(row.providerId) || !Number.isSafeInteger(row.run) || row.run < 1
    || (row.admitted !== null && !isObject(row.admitted)) || (row.admitted === null) === (row.rejectCode === null)
    || (row.costSource !== null && !COST_SOURCES.has(row.costSource)))) {
    throw new Error('The run has a malformed result row.');
  }
  return run;
}
