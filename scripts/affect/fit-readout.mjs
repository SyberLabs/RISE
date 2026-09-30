/**
 * Refuse to write readout weights until enough human judgments exist.
 * Invented labels are not an input this script will accept.
 */
import { readFileSync } from 'node:fs';
import { canFitReadout } from '../../src/affect/preference/judgments.js';

const path = process.argv[2];
const store = path ? JSON.parse(readFileSync(path, 'utf8')) : [];
const decision = canFitReadout(store);
if (!decision.ok) {
    console.error(decision.reason);
    process.exit(2);
}
console.error('A fit is allowed by count only. This script does not yet estimate coefficients; add the estimator when the judgments are real.');
process.exit(2);
