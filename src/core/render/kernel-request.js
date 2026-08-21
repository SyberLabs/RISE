/**
 * rise.kernel-request.v1 — the JSON an agent, CLI, or Workshop posts
 * into renderArtifact. Browser-safe: no ffmpeg, no Node.
 */

import { resolveCaptionStyle } from './caption-style.js';

export const KERNEL_REQUEST_SCHEMA = 'rise.kernel-request.v1';
export const DEFAULT_RENDER_PROFILE_ID = 'social-portrait-1080';
export const EXPORT_MP4_PATH = '/__rise/export-mp4';

function defined(value) {
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) out[key] = item;
  }
  return out;
}

/** Normalize Workshop/CLI source records into kernel `sources`. */
export function sourcesForKernel(sources = []) {
  if (!sources) return [];
  if (Array.isArray(sources)) {
    return sources.map(source => {
      const id = source.id || source.sourceId;
      const data = typeof source.data === 'string'
        ? source.data
        : (typeof source.text === 'string' ? source.text : '');
      if (!id || !data) return null;
      return defined({
        id,
        name: source.name || id,
        data,
        metadata: source.metadata
      });
    }).filter(Boolean);
  }
  if (typeof sources === 'object') {
    return sourcesForKernel(Object.entries(sources).map(([id, source]) => (
      typeof source === 'string' ? { id, data: source } : { id, ...source }
    )));
  }
  return [];
}

export function sessionInputFromWorkshopPayload(payload = {}) {
  return defined({
    wpm: payload.wpm,
    chunkMode: payload.chunkMode,
    curve: payload.curve,
    sequenceVisualAssets: payload.sequenceVisualAssets,
    capabilities: payload.capabilities,
    recitation: payload.recitation,
    voiceId: payload.voiceId
  });
}

/**
 * Build a kernel request. Does not admit, paint, or mux.
 */
export function buildKernelRequest({
  program,
  sources = [],
  inventory,
  sessionInput,
  profileId = DEFAULT_RENDER_PROFILE_ID,
  projectId,
  projectRevision,
  seed,
  painter,
  scale,
  outputPath,
  fromMs,
  toMs,
  tier,
  ffmpegPath,
  job,
  caption
} = {}) {
  return defined({
    schema: KERNEL_REQUEST_SCHEMA,
    program,
    sources: sourcesForKernel(sources),
    inventory,
    sessionInput,
    profileId: profileId || DEFAULT_RENDER_PROFILE_ID,
    projectId,
    projectRevision,
    seed,
    painter,
    scale,
    outputPath,
    fromMs,
    toMs,
    tier,
    ffmpegPath,
    job,
    caption: caption == null ? undefined : (resolveCaptionStyle(caption) || undefined)
  });
}

/** Workshop hopper: current session payload → kernel request JSON. */
export function kernelRequestFromWorkshopPayload(payload, options = {}) {
  if (!payload?.experienceProgram) return null;
  return buildKernelRequest({
    program: payload.experienceProgram,
    sources: payload.sources,
    sessionInput: sessionInputFromWorkshopPayload(payload),
    profileId: payload.defaults?.render?.profileId
      || options.profileId
      || DEFAULT_RENDER_PROFILE_ID,
    projectId: options.projectId
      || payload.id
      || payload.experienceProgramId
      || payload.experienceProgram.id,
    projectRevision: payload.revision,
    painter: options.painter,
    scale: options.scale,
    fromMs: options.fromMs,
    toMs: options.toMs,
    tier: options.tier,
    caption: options.caption
  });
}

export function renderCliCommand(requestPath) {
  return `npm run render:mp4 -- ${requestPath}`;
}
