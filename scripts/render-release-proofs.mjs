#!/usr/bin/env node
/**
 * Render the bounded release-proof matrix from one admitted composition.
 *
 * This is evidence, not publication: outputs remain under out/release and no
 * network or social-delivery action occurs.
 */
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { buildVerticalSlice } from '../src/core/render/vertical-slice.js';
import { KERNEL_REQUEST_SCHEMA } from '../src/core/render/kernel-request.js';
import { materializeExportJob } from '../src/core/render/intake.js';

const DEFAULT_OUT = join('out', 'release', 'render-proofs');

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

function positiveNumber(name, fallback) {
  const value = Number(option(name, String(fallback)));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const digest = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', chunk => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolveHash(`sha256:${digest.digest('hex')}`));
  });
}

const outRoot = resolve(option('--out', DEFAULT_OUT));
const painter = option('--painter', 'chamber');
const scale = positiveNumber('--scale', 1);
const openingMs = Math.round(positiveNumber('--opening-ms', 3_000));
const representativeMs = Math.round(positiveNumber('--representative-ms', 12_000));
const ffmpegPath = option('--ffmpeg', process.env.RISE_FFMPEG_PATH || null);

const slice = await buildVerticalSlice();
const request = {
  schema: KERNEL_REQUEST_SCHEMA,
  program: slice.program,
  sources: slice.sources,
  inventory: slice.inventory,
  sessionInput: slice.sessionInput
};
const durationMs = slice.session.totalDuration;
const proofs = [
  {
    id: 'portrait-opening',
    profileId: 'social-portrait-1080',
    fromMs: 0,
    toMs: Math.min(openingMs, durationMs)
  },
  {
    id: 'portrait-representative',
    profileId: 'social-portrait-1080',
    fromMs: 0,
    toMs: Math.min(representativeMs, durationMs)
  },
  {
    id: 'landscape-opening',
    profileId: 'cinema-landscape-1080',
    fromMs: 0,
    toMs: Math.min(openingMs, durationMs)
  }
];

mkdirSync(outRoot, { recursive: true });
const results = [];
for (const proof of proofs) {
  const outDir = join(outRoot, proof.id);
  console.log(`[release-render] ${proof.id} · ${proof.profileId} · ${proof.toMs} ms`);
  const artifact = await materializeExportJob({
    document: request,
    outDir,
    options: {
      painter,
      scale,
      profileId: proof.profileId,
      ffmpegPath,
      fromMs: proof.fromMs,
      toMs: proof.toMs,
      tier: 'final'
    }
  });
  const mp4Hash = await sha256File(artifact.mp4Path);
  results.push({
    ...proof,
    mp4Path: artifact.mp4Path,
    width: artifact.encoded.width,
    height: artifact.encoded.height,
    frameCount: artifact.encoded.frameCount,
    durationMs: artifact.encoded.durationMs,
    mp4Bytes: statSync(artifact.mp4Path).size,
    mp4Hash,
    jobHash: artifact.jobHash,
    planHash: artifact.planHash
  });
}

const manifest = {
  schema: 'rise.release-render-proof.v1',
  generatedAt: new Date().toISOString(),
  painter,
  scale,
  sourceProgram: slice.program.id,
  sourceDurationMs: durationMs,
  results
};
writeFileSync(
  join(outRoot, 'proof-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);
console.log(`[release-render] wrote ${results.length} proof packages to ${outRoot}`);
