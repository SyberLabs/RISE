#!/usr/bin/env node

/**
 * Fail-closed release admission for the corridor described in the roadmap.
 *
 * This does not pretend to automate editorial or real-device judgment.  It
 * verifies the evidence the repository can prove, and emits the remaining
 * human gates beside it so a green build cannot be mistaken for a release.
 */

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { releaseArchiveMetadata } from '../src/content/archive/index.js';
import { KEYSTONE_MANIFESTS, resolveKeystone } from '../src/content/keystones.js';
import { inspectReleaseVoiceAssets } from './lib/release-voice-evidence.mjs';

const MIN_CERTIFIED_WORKS = 10;
const MAX_CERTIFIED_WORKS = 15;
const REQUIRED_DEVICES = Object.freeze([
  'iphone-safari',
  'android-chrome',
  'desktop-chrome',
  'desktop-safari',
  'desktop-firefox'
]);

function finding(code, status, message, details = {}) {
  return Object.freeze({ code, status, message, ...details });
}

function ffmpegFinding() {
  const executable = process.env.RISE_FFMPEG_PATH || 'ffmpeg';
  const result = spawnSync(executable, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000
  });
  if (result.error || result.status !== 0) {
    return finding(
      'RELEASE_FFMPEG_UNAVAILABLE',
      'blocked',
      'FFmpeg is unavailable. Put it on PATH or set RISE_FFMPEG_PATH to the pinned binary.'
    );
  }
  const version = String(result.stdout || '').split(/\r?\n/u)[0].trim();
  return finding('RELEASE_FFMPEG_AVAILABLE', 'pass', version || 'FFmpeg available.');
}

function nodeFinding() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  const supported = (major === 20 && minor >= 19)
    || (major === 22 && minor >= 12)
    || major > 22;
  return supported
    ? finding('RELEASE_NODE_SUPPORTED', 'pass', `Node ${process.versions.node} satisfies the pinned release toolchain.`)
    : finding(
      'RELEASE_NODE_UNSUPPORTED',
      'blocked',
      `Node ${process.versions.node} is below the release minimum; use the version pinned in .node-version.`
    );
}

function voiceAssetFindings(report) {
  const megabytes = (report.totalBytes / (1024 * 1024)).toFixed(1);
  const source = report.sourceIssues.length === 0
    ? finding(
      'RELEASE_VOICE_ASSETS_COMPLETE',
      'pass',
      `${report.assetCount} source WAVs (${megabytes} MiB) cover ${report.phraseCount} exact Keystone phrases; review identity ${report.manifestHash}.`
    )
    : finding(
      'RELEASE_VOICE_ASSETS_INVALID',
      'blocked',
      `${report.sourceIssues.length} source voice-pack integrity issue(s) must be resolved.`,
      { issueCount: report.sourceIssues.length, issues: report.sourceIssues.slice(0, 20) }
    );
  const distribution = report.distributionIssues.length === 0
    ? finding(
      'RELEASE_VOICE_DISTRIBUTION_COMPLETE',
      'pass',
      `The built distribution contains byte-identical copies of all ${report.assetCount} voice assets.`
    )
    : finding(
      'RELEASE_VOICE_DISTRIBUTION_INCOMPLETE',
      'blocked',
      `${report.distributionIssues.length} built voice asset(s) are missing, invalid, or differ from source.`,
      {
        issueCount: report.distributionIssues.length,
        issues: report.distributionIssues.slice(0, 20)
      }
    );
  return [source, distribution];
}

function acousticEvidenceFinding(evidence, voiceReport) {
  const acoustic = evidence?.acousticReview;
  const decisions = acoustic?.decisions && typeof acoustic.decisions === 'object'
    ? acoustic.decisions
    : {};
  const expectedKeys = new Set(voiceReport.records.map(record => record.key));
  const decisionKeys = Object.keys(decisions);
  const decisionsComplete = decisionKeys.length === voiceReport.phraseCount
    && decisionKeys.every(key => expectedKeys.has(key))
    && voiceReport.records.every(record => decisions[record.key]?.status === 'pass');
  const complete = acoustic
    && acoustic.voiceId === voiceReport.voiceId
    && acoustic.manifestHash === voiceReport.manifestHash
    && Number(acoustic.phraseCount) === voiceReport.phraseCount
    && Number(acoustic.reviewedPhraseCount) === voiceReport.phraseCount
    && Number(acoustic.unresolvedDefectCount) === 0
    && typeof acoustic.reviewer === 'string' && acoustic.reviewer.trim()
    && typeof acoustic.completedAt === 'string' && acoustic.completedAt.trim()
    && Number.isFinite(Date.parse(acoustic.completedAt))
    && decisionsComplete;
  return complete
    ? finding(
      'RELEASE_ACOUSTIC_ACCEPTANCE',
      'pass',
      `${voiceReport.phraseCount} exact Keystone phrases were accepted by ${acoustic.reviewer}.`
    )
    : finding(
      'RELEASE_ACOUSTIC_ACCEPTANCE',
      'human',
      `Review all ${voiceReport.phraseCount} exact Keystone phrases with release:prepare-acoustic-review, resolve every defect, and record evidence for ${voiceReport.manifestHash}.`,
      {
        expectedVoiceId: voiceReport.voiceId,
        expectedManifestHash: voiceReport.manifestHash,
        expectedPhraseCount: voiceReport.phraseCount
      }
    );
}

async function humanEvidenceFindings(voiceReport) {
  let evidence;
  try {
    evidence = JSON.parse(await readFile(new URL('../release-evidence.json', import.meta.url), 'utf8'));
  } catch (error) {
    return [finding(
      'RELEASE_HUMAN_EVIDENCE_INVALID',
      'blocked',
      `Human release evidence could not be read: ${error.message}`
    )];
  }
  if (evidence?.schema !== 'rise.release-evidence.v1') {
    return [finding(
      'RELEASE_HUMAN_EVIDENCE_INVALID',
      'blocked',
      'release-evidence.json does not declare rise.release-evidence.v1.'
    )];
  }

  const deviceRecords = Array.isArray(evidence.realDevices) ? evidence.realDevices : [];
  const missingDevices = REQUIRED_DEVICES.filter(id => !deviceRecords.some(record =>
    record?.id === id
      && record.passed === true
      && typeof record.reviewer === 'string' && record.reviewer.trim()
      && typeof record.completedAt === 'string' && record.completedAt.trim()
  ));
  const deviceFinding = missingDevices.length === 0
    ? finding('RELEASE_REAL_DEVICE_CERTIFICATION', 'pass', 'All five required browser/device families have witnessed passing evidence.')
    : finding(
      'RELEASE_REAL_DEVICE_CERTIFICATION',
      'human',
      `Witnessed real-device evidence remains for: ${missingDevices.join(', ')}.`,
      { missingDevices }
    );

  const stranger = evidence.strangerTesting;
  const strangerComplete = stranger
    && Number(stranger.participantCount) >= 3
    && stranger.entryUnderstood === true
    && stranger.readingCompleted === true
    && stranger.nextActionUnderstood === true
    && typeof stranger.reviewer === 'string' && stranger.reviewer.trim()
    && typeof stranger.completedAt === 'string' && stranger.completedAt.trim();
  const strangerFinding = strangerComplete
    ? finding('RELEASE_STRANGER_TESTING', 'pass', `${stranger.participantCount} unprompted participants completed the release corridor.`)
    : finding(
      'RELEASE_STRANGER_TESTING',
      'human',
      'Record at least three witnessed, unprompted corridor tests in release-evidence.json.'
    );
  return [acousticEvidenceFinding(evidence, voiceReport), deviceFinding, strangerFinding];
}

async function inspect() {
  const findings = [];
  findings.push(nodeFinding());
  const certified = releaseArchiveMetadata({ includeCandidates: false });
  if (certified.length < MIN_CERTIFIED_WORKS || certified.length > MAX_CERTIFIED_WORKS) {
    findings.push(finding(
      'RELEASE_CANONICAL_SHELF_SIZE',
      'blocked',
      `The public shelf has ${certified.length} certified works; release requires ${MIN_CERTIFIED_WORKS}–${MAX_CERTIFIED_WORKS}.`,
      { certifiedWorkIds: certified.map(item => item.id) }
    ));
  } else {
    findings.push(finding(
      'RELEASE_CANONICAL_SHELF_SIZE',
      'pass',
      `The public shelf has ${certified.length} exact, certified editions.`
    ));
  }

  for (const manifest of KEYSTONE_MANIFESTS) {
    const result = await resolveKeystone(manifest.slug);
    if (result.ready) {
      findings.push(finding(
        `RELEASE_KEYSTONE_${manifest.slug.toUpperCase()}`,
        'pass',
        `${manifest.title} is admitted at /keystone/${manifest.slug}.`
      ));
      continue;
    }
    findings.push(finding(
      `RELEASE_KEYSTONE_${manifest.slug.toUpperCase()}`,
      'blocked',
      `${manifest.title} is not release-admissible.`,
      { blockers: result.blockers }
    ));
  }

  findings.push(ffmpegFinding());
  const voiceReport = await inspectReleaseVoiceAssets({
    distributionRoot: resolve(import.meta.dirname, '../dist')
  });
  findings.push(...voiceAssetFindings(voiceReport));
  findings.push(...await humanEvidenceFindings(voiceReport));
  return Object.freeze(findings);
}

const findings = await inspect();
const blocked = findings.filter(item => item.status === 'blocked');
const human = findings.filter(item => item.status === 'human');
const report = Object.freeze({
  schema: 'rise.release-readiness.v1',
  ready: blocked.length === 0 && human.length === 0,
  summary: {
    pass: findings.filter(item => item.status === 'pass').length,
    blocked: blocked.length,
    human: human.length
  },
  findings
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('RISE release readiness');
  console.log('');
  for (const item of findings) {
    const mark = item.status === 'pass' ? 'PASS' : item.status === 'human' ? 'HUMAN' : 'BLOCKED';
    console.log(`[${mark}] ${item.code}: ${item.message}`);
    for (const blocker of item.blockers || []) {
      console.log(`  - ${blocker.code}: ${blocker.message}`);
    }
  }
  console.log('');
  console.log(`Result: ${report.summary.pass} pass, ${report.summary.blocked} blocked, ${report.summary.human} human gates.`);
}

if (!report.ready) process.exitCode = 1;
