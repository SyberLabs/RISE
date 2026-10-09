import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUND_IDS, PARKED_SOUNDS } from './sound-ids.js';
import { LEVEL_BAND, SOUND_TRIM_DB, soundTrimDb } from './sound-levels.js';

const OFFERED = [...SOUND_IDS.soundscape, ...SOUND_IDS.tone];
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/evals/sound/levels.json'), 'utf8'));

describe('the levelled sound catalogue', () => {
  it('has a trim for every offered sound and for nothing else', () => {
    expect(Object.keys(SOUND_TRIM_DB).sort()).toEqual([...OFFERED].sort());
    for (const id of Object.keys(PARKED_SOUNDS)) expect(Object.hasOwn(SOUND_TRIM_DB, id), id).toBe(false);
    for (const trim of Object.values(SOUND_TRIM_DB)) expect(Number.isFinite(trim)).toBe(true);
  });

  it('gives no trim to a sound it does not level', () => {
    expect(soundTrimDb('starlight')).toBe(SOUND_TRIM_DB.starlight);
    expect(soundTrimDb('silent')).toBe(0);
    expect(soundTrimDb('personal:abc')).toBe(0);
    expect(soundTrimDb(undefined)).toBe(0);
  });

  it('was measured, every offered sound inside the band, with the trims it ships', () => {
    expect(manifest.band).toEqual(LEVEL_BAND);
    expect(manifest.sounds.map(sound => sound.id).sort()).toEqual([...OFFERED].sort());
    for (const sound of manifest.sounds) {
      expect(sound.trimDb, sound.id).toBe(SOUND_TRIM_DB[sound.id]);
      expect(Math.abs(sound.rmsDbfs - LEVEL_BAND.rmsDbfs), `${sound.id} at ${sound.rmsDbfs} dBFS`).toBeLessThanOrEqual(LEVEL_BAND.toleranceDb);
      expect(sound.peakDbfs, sound.id).toBeLessThan(0);
    }
  });
});
