/**
 * One loudness for every sound RISE offers (SND-001): each is trimmed so that,
 * through the real engine at its default levels, it sits inside LEVEL_BAND.
 * The trims are measured, not chosen: scripts/measure-sound-levels.mjs records
 * each sound and writes docs/evals/sound/levels.json, and sound-levels.test.js
 * holds every entry of that manifest inside the band with these trims.
 * A sound with no entry (a personal bed, a chant bed, a parked sound's
 * stand-in by its own id) plays at 0 dB.
 */

/** RMS in dBFS at the output, measured over 25 s from 3 s after the start, with its tolerance either side. */
export const LEVEL_BAND = Object.freeze({ rmsDbfs: -29, toleranceDb: 2 });

/** dB added to each offered sound's layer gain. */
export const SOUND_TRIM_DB = Object.freeze({
  aurora: 5.5,
  'faded-signal': 4,
  'soft-rain': 1,
  starlight: -2,
  'night-drive': 1,
  piano: 17.5,
  jazz: 14,
  lullaby: 22.5,
  nocturne: 23.5,
  waltz: 20,
  blues: 19,
  bossa: 24,
  ragtime: 17.5,
  focus: -12.5,
  deep: -16.5,
  gateway: -17.5
});

/** The trim for a sound id, in dB; 0 for one this catalogue does not level. */
export const soundTrimDb = id => (typeof id === 'string' && Object.hasOwn(SOUND_TRIM_DB, id) ? SOUND_TRIM_DB[id] : 0);
