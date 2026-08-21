#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectReleaseVoiceAssets } from './lib/release-voice-evidence.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

const input = option('--input') || process.argv.slice(2).find(value => !value.startsWith('--'));
if (!input) {
  throw new Error('Pass the exported review with --input <acoustic-review-evidence.json>.');
}

const report = await inspectReleaseVoiceAssets();
if (report.sourceIssues.length) {
  throw new Error('The source voice pack changed or is incomplete; prepare a new acoustic review.');
}

const submitted = JSON.parse(await readFile(resolve(input), 'utf8'));
const decisions = submitted?.decisions && typeof submitted.decisions === 'object'
  ? submitted.decisions
  : {};
const expectedKeys = new Set(report.records.map(record => record.key));
const decisionKeys = Object.keys(decisions);
const invalidKeys = decisionKeys.filter(key => !expectedKeys.has(key));
const missingKeys = report.records
  .map(record => record.key)
  .filter(key => decisions[key]?.status !== 'pass');
const metadataMatches = submitted.voiceId === report.voiceId
  && submitted.manifestHash === report.manifestHash
  && Number(submitted.phraseCount) === report.phraseCount
  && Number(submitted.reviewedPhraseCount) === report.phraseCount
  && Number(submitted.unresolvedDefectCount) === 0
  && typeof submitted.reviewer === 'string' && submitted.reviewer.trim()
  && typeof submitted.completedAt === 'string'
  && Number.isFinite(Date.parse(submitted.completedAt));
if (!metadataMatches || invalidKeys.length || missingKeys.length
  || decisionKeys.length !== report.phraseCount) {
  throw new Error(
    `Acoustic evidence is incomplete or belongs to different bytes: `
    + `${missingKeys.length} non-passing/missing, ${invalidKeys.length} unknown.`
  );
}

const evidencePath = resolve('release-evidence.json');
const releaseEvidence = JSON.parse(await readFile(evidencePath, 'utf8'));
if (releaseEvidence.schema !== 'rise.release-evidence.v1') {
  throw new Error('release-evidence.json does not declare rise.release-evidence.v1.');
}
const orderedDecisions = Object.fromEntries(report.records.map(record => [
  record.key,
  {
    status: 'pass',
    ...(typeof decisions[record.key].note === 'string' && decisions[record.key].note.trim()
      ? { note: decisions[record.key].note.trim() }
      : {})
  }
]));
releaseEvidence.acousticReview = {
  voiceId: report.voiceId,
  manifestHash: report.manifestHash,
  phraseCount: report.phraseCount,
  reviewedPhraseCount: report.phraseCount,
  unresolvedDefectCount: 0,
  reviewer: submitted.reviewer.trim(),
  completedAt: submitted.completedAt,
  decisions: orderedDecisions
};
await writeFile(evidencePath, `${JSON.stringify(releaseEvidence, null, 2)}\n`, 'utf8');
console.log(`Recorded ${report.phraseCount} passing acoustic decisions in ${evidencePath}`);
