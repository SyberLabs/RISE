/**
 * Known-probability controls for the Decision Arena, labelled by
 * commit-reveal.
 *
 * Each case in controls.json states its own odds ("seven of ten slips say
 * 'soft-rain'"). A well-calibrated decider should put that probability on
 * each option. The slip for a case is drawn from
 * sha256("<seed>:<sha256 of JSON.stringify(run.results)>:<case id>"): the
 * captured answers, not the file's bytes, so re-encoding the file (extra
 * whitespace, reordered metadata) cannot re-roll the labels.
 *
 * What this guarantees:
 * - Deciders cannot see the labels: they do not exist until after capture.
 * - The seed cannot change after capture: its sha256 is committed to
 *   controls.json beforehand, and revealLabels refuses any other seed.
 * - Nobody can steer the labels before capture, the operator included: they
 *   depend on the captured answers, which nobody knows in advance.
 *
 * What it does not guarantee: the operator who runs `commit` holds the seed,
 * so once a run is captured they can compute its labels, and could discard
 * it and re-capture until the labels suit them. Only keeping every captured
 * run file exposes that.
 *
 *   node scripts/arena/controls.mjs commit [--seed-file <path>]
 *
 * writes a fresh seed to <path> (default ~/.rise-arena-seed, mode 0600, never
 * overwritten), prints only that path, and writes the seed's sha256 to
 * controls.json as `seedCommitment`.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const FILE = fileURLToPath(new URL('./controls.json', import.meta.url));
const sha256 = (data) => createHash('sha256').update(data).digest();

/** The public commitment to a secret seed: its sha256 in hex. */
export function commitment(seed) {
  return sha256(String(seed)).toString('hex');
}

/**
 * One label per case, drawn from the case's stated odds. The draw for a case
 * depends only on the seed, the run digest (sha256 hex of
 * JSON.stringify(run.results)) and the case id: u = the first 48 bits of
 * sha256("<seed>:<runDigest>:<id>") as a fraction of 2^48, walked along the
 * odds in the order they are listed.
 */
export function drawLabels(cases, seed, runDigest) {
  return Object.fromEntries(cases.map(({ id, odds }) => {
    const u = sha256(`${seed}:${runDigest}:${id}`).readUIntBE(0, 6) / 2 ** 48;
    const options = Object.entries(odds);
    let cumulative = 0;
    const hit = options.find(([, p]) => u < (cumulative += p));
    return [id, (hit || options.at(-1))[0]];
  }));
}

/** sha256 hex of a run's captured answers: JSON.stringify(run.results). */
export const resultsDigest = runText => sha256(JSON.stringify(JSON.parse(runText).results)).toString('hex');

/** drawLabels for a captured run file's answers, after checking the revealed seed against the commitment. */
export function revealLabels(controls, seed, runFile) {
  if (!controls.seedCommitment) throw new Error('controls.json has no seedCommitment; run `node scripts/arena/controls.mjs commit` before capture.');
  if (commitment(seed) !== controls.seedCommitment) throw new Error('The revealed seed does not match seedCommitment.');
  return drawLabels(controls.cases, seed, resultsDigest(runFile));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { positionals, values } = parseArgs({ allowPositionals: true,
    options: { 'seed-file': { type: 'string', default: join(homedir(), '.rise-arena-seed') } } });
  if (positionals[0] !== 'commit') {
    console.error('Usage: node scripts/arena/controls.mjs commit [--seed-file <path>]');
    process.exit(2);
  }
  const controls = JSON.parse(readFileSync(FILE, 'utf8'));
  if (controls.seedCommitment) {
    console.error('controls.json already carries a seedCommitment. A second commitment would void the first; remove it by hand only if no run used it.');
    process.exit(1);
  }
  const seed = randomBytes(32).toString('hex');
  const seedFile = values['seed-file'];
  writeFileSync(seedFile, seed, { flag: 'wx', mode: 0o600 });
  controls.seedCommitment = commitment(seed);
  writeFileSync(FILE, JSON.stringify(controls, null, 2) + '\n');
  console.log(`Seed written to ${seedFile} (mode 0600). Keep it out of the repository, logs and chat.`);
  console.log('Reveal it only after every decision is captured; revealLabels(controls, seed, runFile) checks it.');
  console.log(`seedCommitment ${controls.seedCommitment} written to scripts/arena/controls.json; commit that file before capture.`);
}
