/**
 * Offline audio-bed mixer.
 *
 * Named soundscapes lower to a pinned harmonic series (the live halo
 * scheduler is not authority). Silence is zeros. Hold continues the last
 * generative bed. Missing named audio refuses — it does not invent a bed.
 */

import { fail } from './errors.js';
import { RENDER_AUDIO_CHANNELS, RENDER_SAMPLE_RATE } from './layout.js';
import { audioRunAt, narrationRunAt } from './plan.js';
import { duckGainAt } from '../narration.js';

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

export function mixAudio(plan, {
  sampleRate = RENDER_SAMPLE_RATE,
  channels = RENDER_AUDIO_CHANNELS,
  fromMs = 0,
  toMs = null
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

  for (let i = 0; i < frames; i += 1) {
    const ms = Math.min(plan.durationMs - 1, start + Math.floor((i * 1000) / sampleRate));
    const run = audioRunAt(plan, ms);
    if (!run) continue;
    if (run.cueKind !== 'audio:hold' && run.cueKind !== 'audio:silence') {
      held = run;
    }
    const active = run.cueKind === 'audio:hold' ? held : run;
    if (active.cueKind !== 'audio:silence' && active.cueKind !== 'audio:hold'
      && active.cueKind !== 'audio:soundscape' && active.cueKind !== 'audio:tone') {
      fail('RENDER_AUDIO_UNSUPPORTED',
        `Audio cue ${active.cueKind} has no offline mixer`,
        '$.audioRuns',
        { cueKind: active.cueKind });
    }
    const gain = fadeGain(ms, run) * 0.35 * duckGainAt(narrationRunAt(plan, ms), ms);
    const t = ms / 1000;
    const spoken = narrationRunAt(plan, ms);
    for (let ch = 0; ch < channels; ch += 1) {
      let sample = sampleBed(active.cueKind, active.cue, t, ch) * gain;
      if (spoken?.cueKind === 'narration:spoken') {
        const pan = ch === 0 ? 0.85 : 0.65;
        sample += Math.sin(2 * Math.PI * 220 * t) * 0.12 * pan;
      }
      pcm[i * channels + ch] = sample;
    }
  }
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
