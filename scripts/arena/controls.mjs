/**
 * Known-probability controls for the Decision Arena, labelled by
 * commit-reveal.
 *
 * Each case in controls.json states its own odds ("seven of ten slips say
 * 'soft-rain'"). A well-calibrated decider should put that probability on
 * each option. The slip is drawn only after every decision is captured, from
 * a secret seed whose sha256 was committed to controls.json beforehand, so
 * nobody (decider or operator) can see or steer the labels in advance.
 *
 *   node scripts/arena/controls.mjs commit
 *
 * prints a fresh seed once and writes only its sha256 as `seedCommitment`.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('./controls.json', import.meta.url));
const sha256 = (text) => createHash('sha256').update(text).digest();

/** The public commitment to a secret seed: its sha256 in hex. */
export function commitment(seed) {
  return sha256(String(seed)).toString('hex');
}

/**
 * One label per case, drawn from the case's stated odds. The draw for a case
 * depends only on the seed and the case id: u = the first 48 bits of
 * sha256("<seed>:<id>") as a fraction of 2^48, walked along the odds in the
 * order they are listed.
 */
export function drawLabels(cases, seed) {
  return Object.fromEntries(cases.map(({ id, odds }) => {
    const u = sha256(`${seed}:${id}`).readUIntBE(0, 6) / 2 ** 48;
    const options = Object.entries(odds);
    let cumulative = 0;
    const hit = options.find(([, p]) => u < (cumulative += p));
    return [id, (hit || options.at(-1))[0]];
  }));
}

/** drawLabels, after checking the revealed seed against the commitment. */
export function revealLabels(controls, seed) {
  if (!controls.seedCommitment) throw new Error('controls.json has no seedCommitment; run `node scripts/arena/controls.mjs commit` before capture.');
  if (commitment(seed) !== controls.seedCommitment) throw new Error('The revealed seed does not match seedCommitment.');
  return drawLabels(controls.cases, seed);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'commit') {
    console.error('Usage: node scripts/arena/controls.mjs commit');
    process.exit(2);
  }
  const controls = JSON.parse(readFileSync(FILE, 'utf8'));
  if (controls.seedCommitment) {
    console.error('controls.json already carries a seedCommitment. A second commitment would void the first; remove it by hand only if no run used it.');
    process.exit(1);
  }
  const seed = randomBytes(32).toString('hex');
  controls.seedCommitment = commitment(seed);
  writeFileSync(FILE, JSON.stringify(controls, null, 2) + '\n');
  console.log(`Seed (shown once, never commit it):\n\n  ${seed}\n`);
  console.log('Store it privately (a password manager), not in the repository, a log, or chat.');
  console.log('Reveal it only after every decision is captured; revealLabels(controls, seed) checks it.');
  console.log(`seedCommitment ${controls.seedCommitment} written to scripts/arena/controls.json; commit that file before capture.`);
}
