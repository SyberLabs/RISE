#!/usr/bin/env node
/**
 * Render the producer composition to a local MP4.
 *
 *   node scripts/render-mp4.mjs
 *   node scripts/render-mp4.mjs --scale 1 --painter chamber --out out/render
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_OPERATION_SET_SCHEMA } from '../src/core/agent-operations.js';
import { emptyWorkshopProject } from '../src/core/workshop-project.js';
import { runProducer } from '../src/core/producer.js';
import { exportRenderMp4 } from '../src/core/render/export-mp4.js';
import { writeRenderPackageDir } from '../src/core/render/package-fs.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || process.argv[index + 1] == null) return fallback;
  return process.argv[index + 1];
}

const scale = Number(arg('--scale', '1')) || 1;
const painter = arg('--painter', 'chamber');
const outDir = resolve(arg('--out', join(ROOT, '..', 'out', 'render')));
const mp4Path = join(outDir, 'experience.mp4');

const operationSet = {
  schema: AGENT_OPERATION_SET_SCHEMA,
  id: 'ops-render-mp4',
  projectId: 'project-memory',
  baseRevision: 0,
  generationId: 'run-mp4',
  intent: 'Build quietly, then open into color.',
  operations: [
    { op: 'add-source', id: 'op-source', sourceId: SOURCE_ID },
    {
      op: 'assign-visual',
      id: 'op-visual',
      assignmentId: 'visual-klee',
      sourceId: SOURCE_ID,
      assetId: 'procedural:klee',
      fromCharacter: 0,
      toCharacter: SOURCE_TEXT.length
    },
    {
      op: 'assign-audio',
      id: 'op-audio',
      assignmentId: 'bed-aurora',
      sourceId: SOURCE_ID,
      assetId: 'soundscape:aurora',
      fromCharacter: 0,
      toCharacter: SOURCE_TEXT.length
    },
    {
      op: 'set-pace',
      id: 'op-pace',
      assignmentId: 'pace-1',
      sourceId: SOURCE_ID,
      cue: { wpm: 150, chunkMode: 'phrase' }
    },
    { op: 'set-render-profile', id: 'op-profile', profileId: 'social-portrait-1080' },
    { op: 'request-compile', id: 'op-compile' }
  ]
};

console.log('Producing the score…');
const produced = await runProducer({
  project: emptyWorkshopProject({ id: 'project-memory', title: 'Memory' }),
  operationSet,
  resolvedSources: {
    [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
  },
  render: true,
  proposePublication: false,
  tier: 'draft'
});

if (produced.stage === 'refused') {
  console.error('Preflight refused this job.');
  console.error(produced.preflight);
  process.exit(1);
}

const rendered = produced.packages['social-portrait-1080'];
mkdirSync(outDir, { recursive: true });
writeRenderPackageDir(outDir, rendered.package);

console.log(`Muxing ${rendered.plan.frameCount} frames at scale ${scale} (${painter}) → ${mp4Path}`);
const encoded = await exportRenderMp4({
  plan: rendered.plan,
  inventory: produced.inventory,
  outputPath: mp4Path,
  scale,
  painter
});

writeFileSync(join(outDir, 'encode.json'), `${JSON.stringify({
  path: encoded.path,
  width: encoded.width,
  height: encoded.height,
  codec: encoded.codec,
  encoder: encoded.encoder,
  frameCount: rendered.plan.frameCount,
  durationMs: rendered.plan.durationMs,
  profile: rendered.job.profile,
  scale,
  painter
}, null, 2)}\n`);

console.log(`Wrote ${encoded.path}`);
console.log(`${encoded.width}×${encoded.height} · ${rendered.plan.frameCount} frames · ${rendered.plan.durationMs} ms`);
console.log(`Sidecars: ${outDir}`);
