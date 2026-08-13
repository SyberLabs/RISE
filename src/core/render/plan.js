/**
 * Compile an admitted job + Experience Program into an immutable render plan.
 *
 * The plan is the complete visual, textual, and acoustic state schedule.
 * It does not raster, mix, or encode. Session compile remains the source of
 * atom timing so interactive preview and render share one score.
 */

import { validateExperienceProgram, lowerExperienceProgram } from '../experience-program.js';
import { compileSession } from '../session-compiler.js';
import { cueForAtom } from '../visual-scheduler.js';
import { SEQUENCE_ASSET_PREFIX } from '../visual-score-lane.js';
import { fail } from './errors.js';
import { validateRenderJob, jobFrameCount } from './job.js';
import { classifyCue, renderSupportFor } from './support.js';
import { contentHashOf } from './hash.js';
import { safeAreasFor } from './layout.js';
import { renderProfile } from './limits.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function coalesce(atoms, keyId, keyCue) {
  const runs = [];
  for (const atom of atoms) {
    const id = atom[keyId];
    const last = runs[runs.length - 1];
    if (last && last.cueId === id) {
      last.toMs = atom.endMs;
      last.atomEnd = atom.index;
      continue;
    }
    runs.push({
      cueId: id,
      cue: atom[keyCue],
      fromMs: atom.startMs,
      toMs: atom.endMs,
      atomStart: atom.index,
      atomEnd: atom.index
    });
  }
  return runs;
}

function assetIdFromCue(cue) {
  if (cue?.kind === 'video') return cue.assetId || null;
  if (cue?.kind === 'sourced') {
    const collection = cue.collections?.[0];
    if (typeof collection === 'string' && collection.startsWith(SEQUENCE_ASSET_PREFIX)) {
      return collection.slice(SEQUENCE_ASSET_PREFIX.length);
    }
  }
  return null;
}

/**
 * @param {{
 *   job: object,
 *   program: object,
 *   sources: object[],
 *   inventory?: { assets?: object[] },
 *   sessionInput?: object
 * }} input
 */
export function compileRenderPlan(input = {}) {
  const job = validateRenderJob(input.job);
  const program = validateExperienceProgram(input.program);
  const sessionInput = input.sessionInput && typeof input.sessionInput === 'object'
    ? input.sessionInput
    : {};
  const session = compileSession({
    wpm: 160,
    chunkMode: 'phrase',
    curve: 'flat',
    ...sessionInput,
    experienceProgram: program,
    sources: input.sources
  });

  if (session.totalDuration !== job.durationMs) {
    fail('RENDER_DURATION_MISMATCH',
      'Job duration must equal the compiled session duration',
      '$.durationMs',
      { jobDurationMs: job.durationMs, sessionDurationMs: session.totalDuration });
  }

  const lowered = lowerExperienceProgram(program);
  const visualProgram = lowered.visualProgram;
  const audioBed = lowered.audioProgram?.lanes?.bed || lowered.audioProgram;
  const narrationProgram = lowered.narrationProgram;
  const assets = new Map((input.inventory?.assets || []).map(asset => [asset.assetId, asset]));

  const atoms = [];
  let cursor = 0;
  for (const atom of session.atoms) {
    const duration = Number(atom.duration) || 0;
    const visual = visualProgram
      ? cueForAtom(visualProgram, atom)
      : { id: '__fallback__', cue: { kind: 'still' } };
    const audio = audioBed
      ? cueForAtom(audioBed, atom)
      : { id: '__fallback__', cue: { kind: 'silence' } };
    const visualKind = classifyCue(visual.cue, 'visual');
    const support = renderSupportFor(visualKind);
    if (!support || support.render === 'unsupported') {
      fail('RENDER_CUE_UNSUPPORTED',
        support?.reason || `Cue ${visualKind} cannot be rendered`,
        '$.tracks',
        { cueKind: visualKind, cueId: visual.id });
    }
    const audioKind = classifyCue(audio.cue, 'audio');
    const audioSupport = renderSupportFor(audioKind);
    if (!audioSupport || audioSupport.render === 'unsupported') {
      fail('RENDER_CUE_UNSUPPORTED',
        audioSupport?.reason || `Cue ${audioKind} cannot be rendered`,
        '$.tracks',
        { cueKind: audioKind, cueId: audio.id });
    }
    const spoken = narrationProgram
      ? cueForAtom({ ...narrationProgram, fallback: { kind: 'none' } }, atom)
      : null;
    const hasNarration = spoken && spoken.id !== '__fallback__' && spoken.cue?.kind === 'spoken';
    if (hasNarration) {
      const narrationKind = classifyCue(spoken.cue, 'narration');
      const narrationSupport = renderSupportFor(narrationKind);
      if (!narrationSupport || narrationSupport.render === 'unsupported') {
        fail('RENDER_CUE_UNSUPPORTED',
          narrationSupport?.reason || `Cue ${narrationKind} cannot be rendered`,
          '$.tracks',
          { cueKind: narrationKind, cueId: spoken.id });
      }
    }
    atoms.push(Object.freeze({
      index: atom.position,
      startMs: cursor,
      endMs: cursor + duration,
      text: typeof atom.content === 'string' ? atom.content : '',
      sourceId: atom.sourceId || null,
      sourceProgress: atom.sourceProgress,
      sourceCharacterStart: atom.sourceCharacterStart,
      sourceCharacterEnd: atom.sourceCharacterEnd,
      visualCueId: visual.id,
      visualCue: visual.cue,
      visualKind,
      audioCueId: audio.id,
      audioCue: audio.cue,
      audioKind,
      narrationCueId: hasNarration ? spoken.id : null,
      narrationCue: hasNarration ? spoken.cue : null,
      narrationKind: hasNarration ? 'narration:spoken' : null
    }));
    cursor += duration;
  }

  const visualRuns = coalesce(atoms, 'visualCueId', 'visualCue').map((run) => {
    const assetId = assetIdFromCue(run.cue);
    const mapped = {
      cueId: run.cueId,
      cueKind: classifyCue(run.cue, 'visual'),
      cue: run.cue,
      fromMs: run.fromMs,
      toMs: run.toMs,
      atomStart: run.atomStart,
      atomEnd: run.atomEnd,
      assetId
    };
    if (run.cue?.kind === 'video') {
      const asset = assetId ? assets.get(assetId) : null;
      const sourceDurationMs = Number.isInteger(asset?.durationMs) ? asset.durationMs : null;
      if (!sourceDurationMs) {
        fail('RENDER_VIDEO_DURATION',
          `Video asset ${assetId} needs a duration before it can be mapped`,
          '$.inventory.assets',
          { assetId });
      }
      mapped.video = Object.freeze({
        assetId,
        activeFromMs: run.fromMs,
        activeToMs: run.toMs,
        sourceFromMs: 0,
        sourceToMs: sourceDurationMs,
        sourceDurationMs,
        timeMode: run.cue.timeMode,
        fit: 'cover',
        audioPolicy: 'muted'
      });
    }
    return Object.freeze(mapped);
  });

  const audioRuns = coalesce(atoms, 'audioCueId', 'audioCue').map(run => Object.freeze({
    cueId: run.cueId,
    cueKind: classifyCue(run.cue, 'audio'),
    cue: run.cue,
    fromMs: run.fromMs,
    toMs: run.toMs,
    fadeMs: Number.isInteger(run.cue?.fadeMs) ? run.cue.fadeMs : 0,
    gain: typeof run.cue?.gain === 'number' ? run.cue.gain : 1
  }));

  const narrationRuns = coalesce(
    atoms.filter(atom => atom.narrationCueId),
    'narrationCueId',
    'narrationCue'
  ).map(run => Object.freeze({
    cueId: run.cueId,
    cueKind: 'narration:spoken',
    cue: run.cue,
    fromMs: run.fromMs,
    toMs: run.toMs,
    duck: run.cue?.duck || null,
    words: run.cue?.words || null,
    pronunciations: run.cue?.pronunciations || null,
    voiceId: run.cue?.voiceId || null,
    voiceAssetId: run.cue?.voiceAssetId || null
  }));

  const profile = renderProfile(job.profile);
  const plan = {
    schema: 'rise.render-plan.v1',
    jobId: job.id,
    profile: job.profile,
    seed: job.seed,
    viewport: job.viewport,
    frameRate: job.frameRate,
    durationMs: job.durationMs,
    frameCount: jobFrameCount(job),
    safeAreas: safeAreasFor(job.viewport),
    loudnessLufs: profile.loudnessLufs,
    atoms,
    visualRuns,
    audioRuns,
    narrationRuns
  };
  return deepFreeze(plan);
}

export async function hashRenderPlan(plan) {
  return contentHashOf(plan);
}

export function atomAt(plan, presentationMs) {
  const atoms = plan.atoms;
  let lo = 0;
  let hi = atoms.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (atoms[mid].endMs <= presentationMs) lo = mid + 1;
    else hi = mid;
  }
  const atom = atoms[lo];
  if (!atom || presentationMs < atom.startMs || presentationMs >= atom.endMs) return null;
  return atom;
}

export function visualRunAt(plan, presentationMs) {
  return plan.visualRuns.find(run => presentationMs >= run.fromMs && presentationMs < run.toMs) || null;
}

export function audioRunAt(plan, presentationMs) {
  return plan.audioRuns.find(run => presentationMs >= run.fromMs && presentationMs < run.toMs) || null;
}

export function narrationRunAt(plan, presentationMs) {
  return (plan.narrationRuns || [])
    .find(run => presentationMs >= run.fromMs && presentationMs < run.toMs) || null;
}
