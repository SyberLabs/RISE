#!/usr/bin/env node
/**
 * Inspect a render package directory.
 *
 *   node scripts/verify-render-package.mjs <package-dir>
 *
 * Answers:
 *   1. do all output hashes match?
 *   2. which source/program/assets produced it?
 *   3. which renderer/profile produced it?
 *   4. were degradations applied?
 *   5. are publication rights unresolved?
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readRenderPackageDir } from '../src/core/render/package-fs.js';
import { verifyRenderPackage } from '../src/core/render/verify.js';

const dir = process.argv[2] ? resolve(process.argv[2]) : null;
if (!dir || !existsSync(dir)) {
  console.error('Usage: node scripts/verify-render-package.mjs <package-dir>');
  process.exit(2);
}

const report = await verifyRenderPackage(readRenderPackageDir(dir));
const { answers } = report;

console.log(report.ok ? '✓ package verifies' : '✗ package failed verification');
console.log(`1. hashes match: ${answers.hashesMatch ? 'yes' : 'no'}`);
console.log(`2. provenance: job ${answers.provenance.jobId}`);
console.log(`   program ${answers.provenance.programHash}`);
console.log(`   sources ${answers.provenance.sourceSnapshots.map(item => item.sourceId).join(', ') || '(none)'}`);
console.log(`   assets ${answers.provenance.assetSnapshots.map(item => item.assetId).join(', ') || '(none)'}`);
console.log(`3. renderer: ${answers.renderer.profile} · ${answers.renderer.quality} · ${answers.renderer.renderer?.version}`);
console.log(`4. degradations: ${answers.degradations.length ? answers.degradations.join(', ') : 'none'}`);
console.log(`5. rights unresolved: ${answers.rightsUnresolved.length
  ? answers.rightsUnresolved.map(item => item.assetId).join(', ')
  : 'none'}`);
if (answers.publicationBlocked) console.log('   publication is blocked');

if (report.findings.length) {
  console.error('');
  for (const finding of report.findings) {
    console.error(`  ${finding.code}: ${finding.message}`);
  }
}

process.exit(report.ok ? 0 : 1);
