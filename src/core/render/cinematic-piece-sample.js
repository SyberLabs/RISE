import { CINEMATIC_PIECE_PROFILES } from '../../audio/cinematic-pieces.js';

export const CINEMATIC_OFFLINE_IDS = Object.freeze(Object.keys(CINEMATIC_PIECE_PROFILES));

function waveform(wave, phase) {
  const cycle = phase - Math.floor(phase);
  if (wave === 'sawtooth') return cycle * 2 - 1;
  if (wave === 'square') return cycle < 0.5 ? 1 : -1;
  if (wave === 'triangle') return 1 - 4 * Math.abs(cycle - 0.5);
  return Math.sin(2 * Math.PI * cycle);
}

function filteredWave(profile, frequency, timeSec) {
  const harmonics = profile.type === 'sine' ? 1 : 4;
  let sample = 0;
  for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
    const cutoff = Math.min(1, profile.filter / (frequency * harmonic * 1.5));
    const partial = profile.type === 'triangle'
      ? (harmonic % 2 ? 1 / (harmonic * harmonic) : 0)
      : profile.type === 'square'
        ? (harmonic % 2 ? 1 / harmonic : 0)
        : 1 / harmonic;
    sample += waveform(profile.type, frequency * timeSec * harmonic) * partial * cutoff;
  }
  return sample;
}

function noteWaveform(profile, frequency, timeSec) {
  const harmonics = profile.noteType === 'sine' ? 1 : 4;
  let sample = 0;
  for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
    const cutoff = Math.min(1, profile.filter * 1.25 / (frequency * harmonic * 1.5));
    const partial = profile.noteType === 'triangle'
      ? (harmonic % 2 ? 1 / (harmonic * harmonic) : 0)
      : profile.noteType === 'square'
        ? (harmonic % 2 ? 1 / harmonic : 0)
        : 1 / harmonic;
    sample += waveform(profile.noteType, frequency * timeSec * harmonic) * partial * cutoff;
  }
  return sample;
}

/** Deterministic bounded-cost PCM approximation of the live cinematic piece. */
export function sampleCinematicPiece(id, timeSec, channel = 0) {
  const profile = CINEMATIC_PIECE_PROFILES[id];
  if (!profile || !Number.isFinite(timeSec) || timeSec < 0 || (channel !== 0 && channel !== 1)) return 0;

  const startGain = Math.min(1, timeSec / 1.1);
  let sample = 0;
  for (let index = 0; index < profile.partials.length; index += 1) {
    const frequency = profile.root * profile.partials[index];
    const level = index === 0 ? 0.13 : 0.055 / index;
    sample += filteredWave(profile, frequency, timeSec) * level;
  }

  const interval = profile.interval / 1000;
  const noteIndex = Math.floor(timeSec / interval);
  const age = timeSec - noteIndex * interval;
  if (age < profile.duration) {
    const attack = id === 'chase' ? 0.012 : 0.08;
    const level = id === 'chase' ? 0.085 : 0.065;
    const envelope = age < attack ? age / attack : (profile.duration - age) / (profile.duration - attack);
    const frequency = profile.root * profile.notes[noteIndex % profile.notes.length];
    const pan = (noteIndex % 2 === 0 ? -1 : 1) * profile.pan;
    const stereo = channel === 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
    sample += noteWaveform(profile, frequency, age) * level * Math.max(0, envelope) * stereo;
  }
  return sample * startGain;
}
