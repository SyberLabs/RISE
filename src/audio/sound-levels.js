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

/**
 * dB the whole session is lifted by when the host says it is a phone (MCP Apps `hostContext.platform: 'mobile'`).
 * The band above is measured at the output, and a phone's own speaker gives little of a bed's low end back, next to
 * a system voice the app speaks at its own level: at -29 dBFS, and about -38 under the voice, the owner heard the
 * bed on an iPhone only just (2026-10-09). +6 dB puts it near -23, and -32 under the voice: a step a listener
 * hears plainly as louder, with the bed still far below full scale.
 * The catalogue's levelling is untouched; only the session's reveal reaches higher (AudioEngine.setSessionLift).
 */
export const PHONE_SPEAKER_LIFT_DB = 6;
