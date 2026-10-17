/**
 * The School corpus: texts the Mystery School serves under its own rule,
 * beside the Archive and never in its canon.
 *
 * Each entry's payload is the generated module `./works/<id>.js`, written
 * by scripts/school-ingest.mjs and never hand-edited. `checksum` is the
 * SHA-256 of JSON.stringify of that module's sections, which is also the
 * address the content plane publishes them at; a mismatch refuses the build.
 * `id` is the School record's id. This module must not import the payloads:
 * it ships with the pane.
 *
 * `rights.life70` is the status where copyright runs for life plus seventy
 * years: 'pd', 'until:YYYY', or 'unknown' when a translator's dates are.
 */

export const SCHOOL_WORKS = Object.freeze([]);

export function schoolWorkById(id) {
  return SCHOOL_WORKS.find(work => work.id === id) ?? null;
}
