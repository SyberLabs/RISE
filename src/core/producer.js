/**
 * Producer runtime — Stages A–D in one host pass.
 *
 * The agent proposes. This module applies the proposal, inspects acquisition
 * without admitting, compiles and packs a private review when asked, and
 * may enqueue destination-neutral review items. It never admits a candidate,
 * never approves a publication, and never calls a destination adapter.
 *
 * See AGENT-COMPOSITION-AND-RENDER-SPEC.md §8.
 */

import { inspectRequestAsset } from './acquisition.js';
import {
  applyAgentOperationSet,
  validateAgentOperationSet
} from './agent-operations.js';
import { enqueuePublicationReview } from './publication.js';
import { contentHashOf } from './render/hash.js';
import { RENDER_JOB_SCHEMA } from './render/environment.js';
import { admitRenderJob, pinnedRendererForProfile, deriveRenderJob } from './render/job.js';
import { renderProfile } from './render/limits.js';
import { preflightRenderJob, PREFLIGHT_VERDICTS } from './render/preflight.js';
import { renderPreview } from './render/distribution.js';
import { qualityTier } from './render/quality.js';
import { compileSession } from './session-compiler.js';
import {
  emptyWorkshopProject,
  workshopProjectToSessionConfig
} from './workshop-project.js';

export class ProducerError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'ProducerError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new ProducerError(code, message, path, details);
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

async function inspectPending(operations, { projectId, providers }) {
  const pending = [];
  for (const op of operations) {
    if (op.op !== 'request-asset') continue;
    if (!providers || !providers.length) {
      pending.push({
        op: op.id,
        requestId: op.requestId,
        status: 'pending',
        admitted: false,
        code: 'ACQUISITION_PROVIDERS',
        message: 'Acquisition needs an explicit provider list'
      });
      continue;
    }
    try {
      const inspected = await inspectRequestAsset(op, { projectId, providers });
      pending.push({
        op: op.id,
        requestId: op.requestId,
        request: inspected.request,
        candidates: inspected.candidates,
        status: 'pending',
        admitted: false
      });
    } catch (error) {
      pending.push({
        op: op.id,
        requestId: op.requestId,
        status: 'refused',
        admitted: false,
        code: error.code || 'ACQUISITION_INSPECT',
        message: error.message
      });
    }
  }
  return pending;
}

async function inventoryFromProject(project) {
  const sources = [];
  for (const source of project.sources) {
    const text = source.data || '';
    sources.push({
      sourceId: source.id,
      contentHash: await contentHashOf(text),
      byteLength: new TextEncoder().encode(text).byteLength,
      characterCount: text.length,
      editionId: source.metadata?.editionId || source.provenance?.editionId || source.id,
      sourceRevision: source.metadata?.sourceRevision || source.provenance?.sourceRevision || null
    });
  }
  return { sources, assets: [] };
}

async function compileDraft(project) {
  const program = project.experienceProgram;
  if (!program) {
    fail('PRODUCER_NO_SCORE', 'The producer has no Experience Program to compile', '$.project');
  }
  const sessionInput = workshopProjectToSessionConfig(project);
  const session = compileSession(sessionInput);
  const profileId = project.defaults?.render?.profileId || 'social-portrait-1080';
  const profile = renderProfile(profileId);
  if (!profile) fail('PRODUCER_PROFILE', `Unknown render profile: ${profileId}`, '$.profile');
  const programHash = await contentHashOf(program);
  const inventory = await inventoryFromProject(project);
  const job = {
    schema: RENDER_JOB_SCHEMA,
    id: `render-${project.id}-${project.revision}`.slice(0, 160),
    projectId: project.id,
    projectRevision: project.revision,
    programHash,
    sourceSnapshots: inventory.sources.map(item => ({
      sourceId: item.sourceId,
      contentHash: item.contentHash,
      editionId: item.editionId,
      ...(item.sourceRevision ? { sourceRevision: item.sourceRevision } : {})
    })),
    assetSnapshots: [],
    profile: profile.id,
    viewport: { ...profile.viewport },
    frameRate: { ...profile.frameRate },
    durationMs: session.totalDuration,
    seed: `${project.id}:${project.revision}`,
    renderer: pinnedRendererForProfile(profile.id),
    policies: {
      unsupportedCue: 'refuse',
      missingAsset: 'refuse',
      reducedMotion: false,
      includeCredits: true,
      distributionClass: 'private-review'
    }
  };
  const admitted = await admitRenderJob(job);
  const preflight = await preflightRenderJob({
    job: admitted.job,
    program,
    inventory
  });
  return {
    program,
    sources: project.sources,
    session,
    sessionInput,
    job: admitted.job,
    jobHash: admitted.jobHash,
    inventory,
    preflight,
    profileId: profile.id
  };
}

/**
 * Apply an agent proposal and, when asked, compile a private review.
 * Admission and publication remain human.
 */
export async function runProducer({
  project = null,
  operationSet,
  context = null,
  resolvedSources = {},
  providers = null,
  now = null,
  tier = 'draft',
  profiles = null,
  proposePublication = true,
  render = true,
  encode = null
} = {}) {
  const set = validateAgentOperationSet(operationSet);
  const applied = applyAgentOperationSet({
    project: project || emptyWorkshopProject({ id: set.projectId, intent: 'custom' }),
    operationSet: set,
    context,
    resolvedSources
  });
  const acquisition = await inspectPending(set.operations, {
    projectId: applied.project.id,
    providers
  });
  const wantsCompile = applied.requests.some(item => item.op === 'request-compile');
  const previewOp = applied.requests.find(item => item.op === 'request-preview');
  const result = {
    project: applied.project,
    inspection: applied.inspection,
    requests: applied.requests,
    acquisition,
    admitted: [],
    approved: [],
    delivered: [],
    stage: wantsCompile || previewOp ? 'produce' : 'draft'
  };
  if (!wantsCompile && !previewOp) return deepFreeze(result);

  const compiled = await compileDraft(applied.project);
  result.preflight = compiled.preflight;
  result.job = compiled.job;
  result.inventory = compiled.inventory;
  result.sessionInput = compiled.sessionInput;
  if (compiled.preflight.verdict === PREFLIGHT_VERDICTS.REFUSED) {
    result.stage = 'refused';
    return deepFreeze(result);
  }

  if (!render) return deepFreeze(result);

  const input = {
    program: compiled.program,
    sources: compiled.sources,
    session: compiled.session,
    sessionInput: compiled.sessionInput,
    job: compiled.job,
    inventory: compiled.inventory
  };
  const packages = {};
  if (previewOp) {
    packages.preview = await renderPreview(input, {
      fromMs: previewOp.fromMs,
      toMs: previewOp.toMs,
      tier: previewOp.tier || tier
    });
  }
  if (wantsCompile) {
    const { renderArtifact, KERNEL_REQUEST_SCHEMA } = await import(
      /* @vite-ignore */
      new URL('./render/artifact.js', import.meta.url).href
    );
    // Compile is always the final pin (scale 1, 48 kHz). Draft is preview only.
    const compileTier = qualityTier('final');
    const ids = profiles || [compiled.profileId];
    for (const profileId of ids) {
      const job = profileId === compiled.profileId
        ? compiled.job
        : deriveRenderJob(compiled.job, profileId);
      const artifact = await renderArtifact({
        schema: KERNEL_REQUEST_SCHEMA,
        program: compiled.program,
        sources: compiled.sources,
        inventory: compiled.inventory,
        sessionInput: compiled.sessionInput,
        job,
        outputPath: encode?.outputPath,
        painter: encode?.painter || 'chamber',
        scale: encode?.scale ?? compileTier.scale,
        sampleRate: encode?.sampleRate || compileTier.sampleRate,
        ffmpegPath: encode?.ffmpegPath,
        fromMs: encode?.fromMs,
        toMs: encode?.toMs,
        tier: 'final'
      });
      if (!artifact?.mp4Path) {
        fail('PRODUCER_COMPILE_MP4', 'Compile must mux an MP4 via renderArtifact', '$');
      }
      packages[profileId] = artifact;
    }
  }
  result.packages = packages;

  if (proposePublication && wantsCompile) {
    const reviewItems = [];
    for (const [profileId, rendered] of Object.entries(packages)) {
      if (profileId === 'preview' || !rendered?.package) continue;
      reviewItems.push(await enqueuePublicationReview({
        id: `review-${applied.project.id}-${profileId}`.slice(0, 160),
        projectId: applied.project.id,
        destinationKind: 'social-short',
        pack: rendered.package,
        metadata: {
          title: applied.project.title || applied.project.id,
          thumbnail: 'poster',
          captionsMode: 'sidecar-and-burn-in'
        },
        now
      }));
    }
    result.reviewItems = reviewItems;
  }
  result.stage = 'review-queued';
  return deepFreeze(result);
}
