/**
 * Prefilter: the deterministic part of routing. A pull request that changes
 * nothing but task records is bookkeeping about other work; it is listed and
 * never offered to a model.
 */

export const RECORDS_PREFIX = 'docs/product/tasks/';

/** True only when every changed file was seen and each is a task record. */
export function isRecordsOnly(pull) {
  return pull.files.length > 0 && pull.fileCount === pull.files.length
    && pull.files.every(path => path.startsWith(RECORDS_PREFIX));
}

export function prefilter(pulls) {
  const records = [];
  const candidates = [];
  for (const pull of pulls) (isRecordsOnly(pull) ? records : candidates).push(pull);
  return { records, candidates };
}
