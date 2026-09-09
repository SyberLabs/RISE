/**
 * Offline audio-bed mixer.
 *
 * Each named soundscape lowers to its own pinned harmonic series (the live
 * halo scheduler is not authority). Silence is zeros. Hold continues the last
 * generative bed. Missing named audio refuses — it does not invent a bed.
 * Spoken narration mixes recitation / assigned PCM; it never emits a tone.
 */

import { fail } from './errors.js';
import { RENDER_AUDIO_CHANNELS, RENDER_SAMPLE_RATE } from './layout.js';
import { audioRunAt, narrationRunAt } from './plan.js';
import { duckGainAt } from '../narration.js';
import { renderSpokenPcm } from './voice-pcm.js';

/**
 * ONE LOWERING PER NAMED SOUNDSCAPE.
 *
 * These are pinned transcriptions of `src/audio/soundscapes.js` — the same
 * roots, ratios, voice levels and pan positions the live halo uses, plus the
 * one gesture that gives each its character: Aurora's slow breath across the
 * partials, Faded Signal's tape drift in cents. The live scheduler is not
 * authority here and cannot be: it needs an AudioContext.
 *
 * Every id in this table must exist in SOUNDSCAPES. An id that is not in this
 * table refuses rather than borrowing another bed — every export used to be
 * Aurora regardless of what the score asked for, so a whole slate of clips
 * shared one drone and nobody could hear that the score was being ignored.
 */
const BEDS = Object.freeze({
  aurora: Object.freeze({
    root: 108,
    ratios: Object.freeze([1, 5 / 4, 3 / 2, 2, 5 / 2, 3, 15 / 4, 4]),
    levels: Object.freeze([0.245, 0.17, 0.145, 0.112, 0.086, 0.068, 0.052, 0.04]),
    pans: Object.freeze([-0.12, 0.34, -0.46, 0.55, -0.66, 0.73, -0.82, 0.88]),
    shapes: Object.freeze([0.79, 0.93, 1.07, 1.21, 0.86, 1.14, 0.72, 1.28]),
    motion: 0.04,
    breath: 0.22,
    driftCents: 0,
    // Aurora's halo: a wandering harmonic that arrives, sounds, and
    // leaves. It is the shape people actually recognise the soundscape
    // by, and the pad alone is only the ground it arrives over.
    halo: Object.freeze({
      tunings: Object.freeze([200, 216]),
      restSec: 10,
      fadeSec: 3.5,
      presenceSec: 8,
      // Louder than the live 0.05, because that number is a bus gain set
      // against a pad bus of 0.17, and these partials sum to about 0.9.
      // This keeps the halo's share of the mix, not its raw number.
      level: 0.16
    })
  }),
  'faded-signal': Object.freeze({
    root: 108,
    ratios: Object.freeze([1, 9 / 8, 4 / 3, 3 / 2, 2, 9 / 4]),
    levels: Object.freeze([0.25, 0.17, 0.14, 0.105, 0.075, 0.052]),
    pans: Object.freeze([-0.24, 0.34, -0.48, 0.58, -0.72, 0.8]),
    shapes: Object.freeze([-1, 1, 1, -1, -1, 1]),
    motion: 0.035,
    breath: 0.12,
    driftCents: 4.5
  })
});

export const OFFLINE_SOUNDSCAPE_IDS = Object.freeze(Object.keys(BEDS));

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

/**
 * One arrival of Aurora's halo: silence, a swell in, a presence, a swell
 * out — the live scheduler's rest/fade/presence timings, made periodic so
 * an export is the same every time it is rendered. The tuning alternates
 * between the two the halo wanders across.
 */
function haloSample(halo, timeSec, channel) {
  if (!(halo.level > 0)) return 0;
  const cycle = halo.restSec + halo.fadeSec * 2 + halo.presenceSec;
  const index = Math.floor(timeSec / cycle);
  const since = timeSec - index * cycle - halo.restSec;
  if (since <= 0) return 0;
  let env;
  if (since < halo.fadeSec) env = since / halo.fadeSec;
  else if (since < halo.fadeSec + halo.presenceSec) env = 1;
  else env = 1 - (since - halo.fadeSec - halo.presenceSec) / halo.fadeSec;
  if (env <= 0) return 0;
  // Smoothstepped so it swells rather than ramps in a straight line.
  const shaped = env * env * (3 - 2 * env);
  const pan = index % 2 ? 0.25 : -0.25;
  const width = channel === 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
  return Math.sin(2 * Math.PI * halo.tunings[index % halo.tunings.length] * timeSec)
    * halo.level * shaped * width;
}

function sampleBed(kind, cue, timeSec, channel) {
  if (kind === 'audio:silence') return 0;
  if (kind === 'audio:soundscape') {
    const bed = BEDS[cue?.soundscapeId];
    if (!bed) return 0;
    // A score may place the halo's arrival. The defaults are the live
    // scheduler's, whose cycle is longer than a short clip — so a
    // twenty-second export would hear the swell arrive and never leave.
    const halo = bed.halo && (cue.halo ? { ...bed.halo, ...cue.halo } : bed.halo);
    let sample = 0;
    for (let i = 0; i < bed.ratios.length; i += 1) {
      // The wow LFO both detunes (tape drift, in cents) and breathes the
      // partial's level, so a long take never settles into a dead stack
      // of sines. Each partial rides its own shape, one cycle per motion.
      const wow = Math.sin(2 * Math.PI * bed.motion * timeSec * Math.abs(bed.shapes[i]) + i);
      const cents = bed.driftCents * Math.sign(bed.shapes[i] || 1) * wow;
      const freq = bed.root * bed.ratios[i] * (2 ** (cents / 1200));
      const pan = bed.pans[i];
      const width = channel === 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
      const level = bed.levels[i] * (1 + bed.breath * wow);
      sample += Math.sin(2 * Math.PI * freq * timeSec) * level * width;
    }
    if (halo) sample += haloSample(halo, timeSec, channel);
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
    if (run.cueKind === 'audio:soundscape' && !BEDS[run.cue?.soundscapeId]) {
      fail('RENDER_AUDIO_UNSUPPORTED',
        `Soundscape ${run.cue?.soundscapeId || '(unnamed)'} has no offline bed`,
        '$.audioRuns',
        { soundscapeId: run.cue?.soundscapeId || null });
    }
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
    // PHASE IS PER-SAMPLE, NOT PER-MILLISECOND. `ms` selects which run is
    // sounding and how far into its fade we are, and integer milliseconds
    // are right for that. Feeding the same integer to the oscillators held
    // every value for a millisecond at a time, so at 48 kHz the bed was a
    // 1 kHz staircase — forty-eight identical samples, then a step. Every
    // export this mixer has ever written carried that buzz.
    const t = start / 1000 + i / sampleRate;
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
