import { ACOUSTIC_PIECES } from '../../audio/acoustic-pieces.js';

export const ACOUSTIC_OFFLINE_IDS = Object.freeze(Object.keys(ACOUSTIC_PIECES));

const TAU = 2 * Math.PI;
const scores = new Map(ACOUSTIC_OFFLINE_IDS.map(id => [id, ACOUSTIC_PIECES[id]]));

function noteEnvelope(age, duration, attack) {
  if (age <= 0 || age >= duration) return 0;
  const decayEnd = Math.min(0.22, duration * 0.45);
  if (age < attack) return 0.0001 + (age / attack) * (1 - 0.0001);
  if (age < decayEnd) return 1 - ((age - attack) / (decayEnd - attack)) * 0.68;
  return 0.32 * (1 - (age - decayEnd) / (duration - decayEnd)) +
    0.0001 * ((age - decayEnd) / (duration - decayEnd));
}

/** Deterministically approximate one sample from a live keyboard miniature. */
export function sampleAcousticPiece(id, timeSec, channel = 0) {
  const score = scores.get(id);
  if (!score || !Number.isFinite(timeSec) || timeSec < 0 || !Number.isFinite(channel)) return 0;

  const beatSec = 60 / score.bpm;
  const barBeats = score.beatsPerBar || 4;
  const barSec = beatSec * barBeats;
  const cycleSec = barSec * score.bars.length;
  const cycleTime = timeSec % cycleSec;
  const barIndex = Math.floor(cycleTime / barSec);
  const barTime = cycleTime - barIndex * barSec;
  let sample = 0;

  for (const [midi, offset, beats, level] of score.bars[barIndex]) {
    const age = barTime - offset * beatSec;
    const duration = beats * beatSec;
    if (age <= 0 || age >= duration) continue;
    const envelope = noteEnvelope(age, duration, score.attack);
    const fundamental = 440 * 2 ** ((midi - 69) / 12);
    for (const [harmonic, amplitude] of score.partials) {
      sample += Math.sin(TAU * fundamental * harmonic * age) * amplitude * level * envelope;
    }
  }

  // The live instrument routes every partial to the same mono output.
  return Number.isFinite(sample) ? sample : 0;
}
