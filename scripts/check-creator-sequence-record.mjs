import { readFileSync } from 'node:fs';
import { requireApprovedCreatorSequenceRecord } from '../src/core/creator-sequence-record.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-creator-sequence-record.mjs <record.json>');
  process.exitCode = 2;
} else {
  try {
    const record = requireApprovedCreatorSequenceRecord(JSON.parse(readFileSync(file, 'utf8')));
    console.log(`Structure valid: ${record.id} version ${record.version}.`);
    console.log('Source bytes, rights, creator permission, and approver authority still require human verification.');
  } catch (error) {
    console.error(`Invalid creator sequence record: ${error.message}`);
    process.exitCode = 1;
  }
}
