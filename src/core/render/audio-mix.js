/**
 * Offline audio-bed mixer.
 *
 * Named soundscapes lower to a pinned harmonic series (the live halo
 * scheduler is not authority). Silence is zeros. Hold continues the last
 * generative bed. Missing named audio refuses — it does not invent a bed.
 * Spoken narration mixes recitation / assigned PCM; it never emits a tone.
 */

import { fail } from './errors.js';
import { RENDER_AUDIO_CHANNELS, RENDER_SAMPLE_RATE } from './layout.js';
import { audioRunAt, narrationRunAt } from './plan.js';
import { duckGainAt } from '../narration.js';
import { renderSpokenPcm } from './voice-pcm.js';

const AURORA = Object.freeze({
  root: 108,
  ratios: Object.freeze([1, 5 / 4, 3 / 2, 2, 5 / 2]),
  levels: Object.freeze([0.22, 0.16, 0.13, 0.1, 0.07]),
  pans: Object.freeze([-0.2, 0.35, -0.5, 0.55, 0.1])
});

const TONE = Object.freeze({
  focus: 216,
  deep: 108,
  gateway: 162
});

const TRUE_PEAK_DBTP = -1;

function fadeGain(ms, run) {
  const fade = Math.max(0, run.fadeMs | 0);
  let gain = typeof run.gain === 'number' ? run.gain : 1;
  if (fade > 0) {
    const into = ms - run.fromMs;
    const out = run.toMs - ms;
    if (into < fade) gain *= into / fade;
    if (out < fade) gain *= out / fade;
  }
  return Math.max(0, Math.min(1, gain));
}

function sampleBed(kind, cue, timeSec, channel) {
  if (kind === 'audio:silence') return 0;
  if (kind === 'audio:soundscape') {
    let sample = 0;
    for (let i = 0; i < AURORA.ratios.length; i += 1) {
      const freq = AURORA.root * AURORA.ratios[i];
      const pan = AURORA.pans[i];
      const width = channel === 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
      sample += Math.sin(2 * Math.PI * freq * timeSec) * AURORA.levels[i] * width;
    }
    return sample;
  }
  if (kind === 'audio:tone') {
    const freq = TONE[cue.presetId] || TONE.focus;
    return Math.sin(2 * Math.PI * freq * timeSec) * 0.18;
  }
  return 0;
}

function hasSpokenRuns(plan) {
  return (plan.narrationRuns || []).some(run =>
    run.cueKind === 'narration:spoken' || run.cue?.kind === 'spoken');
}

/**
 * Ungated mean-square loudness (BS.1770 weighting omitted so 8 kHz tests
 * and 48 kHz export share one gain law). Social profiles aim at −14 LUFS.
 */
export function measureLoudnessLufs(pcm, channels = RENDER_AUDIO_CHANNELS) {
  const frames = Math.floor(pcm.length / channels);
  if (frames < 1) return Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < frames; i += 1) {
    let energy = 0;
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = pcm[i * channels + ch];
      energy += sample * sample;
    }
    sum += energy;
  }
  const mean = sum / frames;
  if (mean < 1e-12) return Number.NEGATIVE_INFINITY;
  return -0.691 + 10 * Math.log10(mean);
}

export function applyLoudness(pcm, {
  targetLufs,
  channels = RENDER_AUDIO_CHANNELS,
  truePeakDbtp = TRUE_PEAK_DBTP
} = {}) {
  if (typeof targetLufs !== 'number' || !Number.isFinite(targetLufs)) return pcm;
  const measured = measureLoudnessLufs(pcm, channels);
  if (!Number.isFinite(measured)) return pcm;
  let gain = 10 ** ((targetLufs - measured) / 20);
  const ceiling = 10 ** (truePeakDbtp / 20);
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const abs = Math.abs(pcm[i] * gain);
    if (abs > peak) peak = abs;
  }
  if (peak > ceiling && peak > 0) gain *= ceiling / peak;
  for (let i = 0; i < pcm.length; i += 1) pcm[i] *= gain;
  return pcm;
}

export function mixAudio(plan, {
  sampleRate = RENDER_SAMPLE_RATE,
  channels = RENDER_AUDIO_CHANNELS,
  fromMs = 0,
  toMs = null,
  inventory = {},
  voiceBytes = null,
  readVoiceAsset = null,
  manifest = undefined,
  loudnessLufs = plan.loudnessLufs
} = {}) {
  const start = Math.max(0, fromMs | 0);
  const end = Math.min(plan.durationMs, toMs == null ? plan.durationMs : toMs | 0);
  if (end < start) {
    fail('RENDER_AUDIO_RANGE', 'Audio mix range must be half-open and ordered', '$.fromMs');
  }
  const durationMs = end - start;
  const frames = Math.max(0, Math.round((durationMs / 1000) * sampleRate));
  const pcm = new Float32Array(frames * channels);
  let held = { cueKind: 'audio:silence', cue: { kind: 'silence' }, fadeMs: 0, gain: 1 };
  for (const run of plan.audioRuns) {
    if (run.toMs <= start && run.cueKind !== 'audio:hold' && run.cueKind !== 'audio:silence') {
      held = run;
    }
  }

  const spoken = hasSpokenRuns(plan)
    ? renderSpokenPcm(plan, { inventory, voiceBytes, readVoiceAsset, manifest }, {
      sampleRate,
      channels,
      fromMs: start,
      toMs: end,
      frames
    })
    : null;

  for (let i = 0; i < frames; i += 1) {
    const ms = Math.min(plan.durationMs - 1, start + Math.floor((i * 1000) / sampleRate));
    const run = audioRunAt(plan, ms);
    let gain = 0;
    let active = run;
    if (run) {
      if (run.cueKind !== 'audio:hold' && run.cueKind !== 'audio:silence') {
        held = run;
      }
      active = run.cueKind === 'audio:hold' ? held : run;
      if (active.cueKind !== 'audio:silence' && active.cueKind !== 'audio:hold'
        && active.cueKind !== 'audio:soundscape' && active.cueKind !== 'audio:tone') {
        fail('RENDER_AUDIO_UNSUPPORTED',
          `Audio cue ${active.cueKind} has no offline mixer`,
          '$.audioRuns',
          { cueKind: active.cueKind });
      }
      gain = fadeGain(ms, run) * 0.35 * duckGainAt(narrationRunAt(plan, ms), ms);
    }
    const t = ms / 1000;
    for (let ch = 0; ch < channels; ch += 1) {
      let sample = active
        ? sampleBed(active.cueKind, active.cue, t, ch) * gain
        : 0;
      if (spoken) sample += spoken[i * channels + ch];
      pcm[i * channels + ch] = sample;
    }
  }
  applyLoudness(pcm, { targetLufs: loudnessLufs, channels });
  return Object.freeze({ sampleRate, channels, frames, pcm, fromMs: start, toMs: end });
}

export function peakAmplitude(pcm) {
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const abs = Math.abs(pcm[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}
