/**
 * CLI / Workshop hopper into renderArtifact.
 *
 * Accepts a kernel request, an Experience Program, or an agent operation
 * set. Does not paint or mix — those stay in the kernel.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fail } from './errors.js';
import {
  DEFAULT_RENDER_PROFILE_ID,
  KERNEL_REQUEST_SCHEMA,
  buildKernelRequest,
  sourcesForKernel
} from './kernel-request.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';
import {
  AGENT_OPERATION_LIMITS,
  AGENT_OPERATION_SET_SCHEMA,
  validateAgentOperationSet
} from '../agent-operations.js';
import { emptyWorkshopProject } from '../workshop-project.js';
import { writeRenderPackageDir } from './package-fs.js';

export const RENDER_CLI_USAGE = `Usage: node scripts/render-mp4.mjs <program-or-ops.json> [options]

Input JSON is one of:
  rise.kernel-request.v1
  rise.experience-program.v1   (needs --sources, or a { program, sources } wrapper)
  rise.agent-operation-set.v1  (needs --sources, or a { operationSet, resolvedSources } wrapper)

Options:
  --in <path>        Input JSON (or pass as the first argument)
  --sources <path>   Source text JSON (array, or { sourceId: { data } })
  --out <dir>        Output directory (default: out/render)
  --scale <n>        Paint scale (default: 1)
  --painter <name>   chamber | clerk (default: chamber)
  --profile <id>     Render profile (default: social-portrait-1080)
  --ffmpeg <path>    Explicit ffmpeg binary (or set RISE_FFMPEG_PATH)
`;

function defined(value) {
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) out[key] = item;
  }
  return out;
}

const CLI_FLAGS = new Set([
  '--in', '--sources', '--out', '--scale', '--painter', '--profile', '--ffmpeg'
]);

function cliArgs(argv) {
  const raw = Array.isArray(argv) ? argv : [];
  if (raw[0] === process.execPath || /node(\.exe)?$/i.test(String(raw[0] || ''))) {
    return raw.slice(2);
  }
  return raw;
}

export function parseRenderCliArgs(argv, { cwd = process.cwd() } = {}) {
  const args = cliArgs(argv);
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const values = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (CLI_FLAGS.has(args[i])) {
      values[args[i]] = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] && !args[i].startsWith('--')) positional.push(args[i]);
  }
  const inputArg = values['--in'] || positional[0];
  if (!inputArg) {
    return { error: 'Missing input JSON (experience program, operation set, or kernel request).' };
  }
  const scaleRaw = values['--scale'];
  const scale = scaleRaw == null ? 1 : Number(scaleRaw);
  if (!Number.isFinite(scale) || scale <= 0) {
    return { error: '--scale must be a positive number' };
  }
  const outDir = resolve(cwd, values['--out'] || join('out', 'render'));
  const sourcesPath = values['--sources'];
  return {
    inputPath: resolve(cwd, inputArg),
    sourcesPath: sourcesPath ? resolve(cwd, sourcesPath) : null,
    outDir,
    mp4Path: join(outDir, 'experience.mp4'),
    scale,
    painter: values['--painter'] || 'chamber',
    profileId: values['--profile'] || DEFAULT_RENDER_PROFILE_ID,
    ffmpegPath: values['--ffmpeg'] || process.env.RISE_FFMPEG_PATH || null
  };
}

export function classifyRenderDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RENDER_INTAKE_RECORD', 'Expected a JSON object', '$');
  }
  if (value.schema === KERNEL_REQUEST_SCHEMA) return 'kernel';
  if (value.schema === EXPERIENCE_PROGRAM_SCHEMA) return 'program';
  if (value.schema === AGENT_OPERATION_SET_SCHEMA) return 'operations';
  if (value.program?.schema === EXPERIENCE_PROGRAM_SCHEMA) return 'program-envelope';
  if (value.operationSet?.schema === AGENT_OPERATION_SET_SCHEMA) return 'operations-envelope';
  fail(
    'RENDER_INTAKE_SCHEMA',
    'Expected an Experience Program, agent operation set, or kernel request',
    '$.schema'
  );
}

export function resolvedSourcesFromInput(value) {
  if (value == null) return {};
  if (Array.isArray(value)) {
    const map = {};
    for (const item of value) {
      const id = item?.id || item?.sourceId;
      const data = typeof item?.data === 'string'
        ? item.data
        : (typeof item?.text === 'string' ? item.text : '');
      if (!id || !data) continue;
      map[id] = { id, name: item.name || id, data, metadata: item.metadata };
    }
    return map;
  }
  if (typeof value === 'object') {
    const map = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string') {
        map[key] = { id: key, name: key, data: item };
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const id = item.id || item.sourceId || key;
      const data = typeof item.data === 'string'
        ? item.data
        : (typeof item.text === 'string' ? item.text : '');
      if (!data) continue;
      map[id] = { id, name: item.name || id, data, metadata: item.metadata };
    }
    return map;
  }
  fail('RENDER_INTAKE_SOURCES', 'Sources must be an array or a map of source records', '$.sources');
}

function overlayRequest(request, options = {}) {
  return {
    ...request,
    ...defined({
      painter: options.painter,
      scale: options.scale,
      outputPath: options.outputPath,
      ffmpegPath: options.ffmpegPath,
      fromMs: options.fromMs,
      toMs: options.toMs,
      tier: options.tier,
      profileId: options.profileId || request.profileId || DEFAULT_RENDER_PROFILE_ID
    })
  };
}

export function kernelRequestFromDocument(document, options = {}) {
  const kind = classifyRenderDocument(document);
  if (kind === 'operations' || kind === 'operations-envelope') {
    fail(
      'RENDER_INTAKE_OPERATIONS',
      'Operation sets compile through renderFromDocument',
      '$.schema'
    );
  }
  if (kind === 'kernel') {
    const sources = options.sources != null
      ? sourcesForKernel(options.sources)
      : document.sources;
    return overlayRequest({ ...document, sources }, options);
  }
  const program = kind === 'program' ? document : document.program;
  const sourceInput = options.sources ?? document.sources ?? document.resolvedSources;
  const sources = sourcesForKernel(sourceInput);
  if (!sources.length) {
    fail(
      'RENDER_INTAKE_SOURCES',
      'Experience Program JSON needs source text (--sources, or a kernel request)',
      '$.sources'
    );
  }
  return overlayRequest(buildKernelRequest({
    program,
    sources,
    inventory: document.inventory || options.inventory,
    sessionInput: document.sessionInput || options.sessionInput,
    profileId: options.profileId || document.profileId,
    projectId: document.projectId || options.projectId
  }), options);
}

function withCompileOp(operationSet) {
  if (operationSet.operations.some(op => op.op === 'request-compile')) {
    return operationSet;
  }
  if (operationSet.operations.length >= AGENT_OPERATION_LIMITS.maxOperations) {
    fail(
      'RENDER_INTAKE_COMPILE_OP',
      'Operation set is full and has no request-compile',
      '$.operations'
    );
  }
  const used = new Set(operationSet.operations.map(op => op.id));
  let id = 'op-cli-compile';
  let n = 2;
  while (used.has(id)) {
    id = `op-cli-compile-${n}`;
    n += 1;
  }
  return validateAgentOperationSet({
    schema: operationSet.schema,
    id: operationSet.id,
    projectId: operationSet.projectId,
    baseRevision: operationSet.baseRevision,
    generationId: operationSet.generationId,
    intent: operationSet.intent,
    rationale: operationSet.rationale,
    operations: [...operationSet.operations, { op: 'request-compile', id }]
  });
}

async function renderFromOperations(document, options = {}) {
  const kind = classifyRenderDocument(document);
  const rawSet = kind === 'operations' ? document : document.operationSet;
  const operationSet = withCompileOp(validateAgentOperationSet(rawSet));
  const sourceInput = options.sources
    ?? document.resolvedSources
    ?? document.sources
    ?? options.resolvedSources;
  const resolvedSources = resolvedSourcesFromInput(sourceInput);
  if (!Object.keys(resolvedSources).length) {
    fail(
      'RENDER_INTAKE_SOURCES',
      'Operation set JSON needs source text (--sources or resolvedSources)',
      '$.sources'
    );
  }
  const { runProducer } = await import('../producer.js');
  const produced = await runProducer({
    project: options.project || emptyWorkshopProject({
      id: operationSet.projectId,
      title: operationSet.intent || operationSet.projectId
    }),
    operationSet,
    resolvedSources,
    render: true,
    proposePublication: false,
    encode: defined({
      painter: options.painter || 'chamber',
      scale: options.scale,
      outputPath: options.outputPath,
      ffmpegPath: options.ffmpegPath,
      fromMs: options.fromMs,
      toMs: options.toMs,
      tier: 'final'
    })
  });
  if (produced.stage === 'refused') {
    fail('RENDER_PREFLIGHT_REFUSED', 'Preflight refused this job', '$', {
      refusals: produced.preflight?.refusals
    });
  }
  const profileId = options.profileId
    || produced.job?.profile
    || DEFAULT_RENDER_PROFILE_ID;
  const artifact = produced.packages?.[profileId]
    || produced.packages?.[DEFAULT_RENDER_PROFILE_ID];
  if (!artifact?.mp4Path) {
    fail('RENDER_INTAKE_COMPILE', 'Producer did not mux an MP4', '$');
  }
  return artifact;
}

export async function renderFromDocument(document, options = {}) {
  const kind = classifyRenderDocument(document);
  if (kind === 'operations' || kind === 'operations-envelope') {
    return renderFromOperations(document, options);
  }
  const request = kernelRequestFromDocument(document, options);
  const { renderArtifact } = await import('./artifact.js');
  return renderArtifact(request);
}

export function writeArtifactSidecars(outDir, artifact, extra = {}) {
  mkdirSync(outDir, { recursive: true });
  if (artifact?.package) writeRenderPackageDir(outDir, artifact.package);
  const encoded = artifact?.encoded || {};
  writeFileSync(join(outDir, 'encode.json'), `${JSON.stringify({
    path: artifact.mp4Path,
    width: encoded.width,
    height: encoded.height,
    codec: encoded.codec,
    encoder: encoded.encoder,
    frameCount: encoded.frameCount ?? artifact.plan?.frameCount,
    durationMs: encoded.durationMs ?? artifact.plan?.durationMs,
    profile: artifact.job?.profile || extra.profileId || DEFAULT_RENDER_PROFILE_ID,
    jobHash: artifact.jobHash,
    scale: extra.scale,
    painter: extra.painter
  }, null, 2)}\n`);
}

/**
 * Write the request JSON, mux via the kernel, write sidecars.
 * Workshop's local export job and the CLI share this.
 */
export async function materializeExportJob({ document, outDir, options = {} } = {}) {
  if (!outDir) fail('RENDER_INTAKE_OUT', 'Export job needs an output directory', '$.outDir');
  mkdirSync(outDir, { recursive: true });
  const requestPath = join(outDir, 'request.json');
  writeFileSync(requestPath, `${JSON.stringify(document, null, 2)}\n`);
  const outputPath = options.outputPath || join(outDir, 'experience.mp4');
  const artifact = await renderFromDocument(document, { ...options, outputPath });
  writeArtifactSidecars(outDir, artifact, options);
  return { ...artifact, outDir, requestPath, mp4Path: artifact.mp4Path };
}
