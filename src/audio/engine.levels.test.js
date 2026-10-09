/**
 * The engine plays each offered sound at its measured trim (sound-levels.js),
 * ducks from the level a sound is going to rather than wherever its fade-in
 * was, says which sound it started, and starts without IndexedDB.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./soundscapes.js', async importOriginal => ({
  ...(await importOriginal()),
  createSoundscape: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }))
}));

const { AudioEngine } = await import('./engine.js');
const { SOUND_TRIM_DB } = await import('./sound-levels.js');

const gainOf = db => 10 ** (db / 20);

/** A gain node that lands on every ramp's target at once. */
function fakeGain(value = 0) {
  return {
    gain: {
      value,
      cancelScheduledValues() {},
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this.value = v; }
    }
  };
}

function readyEngine() {
  const engine = new AudioEngine();
  engine.isInitialized = true;
  engine.context = { currentTime: 0 };
  engine.layerGains = Object.fromEntries(['binaural', 'harmonics', 'noise', 'drone', 'soundscape', 'ui'].map(name => [name, fakeGain()]));
  for (const name of ['startEntrainment', 'startHarmonics', 'startNoise', 'startDrone', 'stopEntrainment', 'stopHarmonics', 'stopNoise', 'stopDrone']) {
    vi.spyOn(engine, name).mockImplementation(() => {});
  }
  return engine;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a sound at its trim', () => {
  it('starts a soundscape at the layer level times its trim, and keeps the configured level untouched', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.startSoundscape('starlight');
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.85 * gainOf(SOUND_TRIM_DB.starlight), 6);
    expect(engine.config.layerVolumes.soundscape).toBe(0.85);
    engine.startSoundscape('piano');
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.85 * gainOf(SOUND_TRIM_DB.piano), 6);
    expect(engine.config.layerVolumes.soundscape).toBe(0.85);
  });

  it('applies a tone at each of its layers times its trim', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.applyPreset('deep');
    expect(engine.layerGains.harmonics.gain.value).toBeCloseTo(0.2 * gainOf(SOUND_TRIM_DB.deep), 6);
    expect(engine.layerGains.drone.gain.value).toBeCloseTo(0.15 * gainOf(SOUND_TRIM_DB.deep), 6);
    expect(engine.config.layerVolumes.harmonics).toBe(0.2);
  });

  it('a reader’s own volume for the layer keeps the trim', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.startSoundscape('jazz');
    engine.setLayerVolume('soundscape', 0.5, false);
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(0.5 * gainOf(SOUND_TRIM_DB.jazz), 6);
  });
});

describe('ducking a trimmed sound', () => {
  it('ducks from where the fade-in is going, so a voice that starts during it does not leave the bed stuck low', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.startSoundscape('starlight');
    const target = 0.85 * gainOf(SOUND_TRIM_DB.starlight);
    // Part way up the fade-in.
    engine.layerGains.soundscape.gain.value = target * 0.1;
    engine.setVoiceDucking(true);
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(target * 0.35, 6);
    engine.setVoiceDucking(false);
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(target, 6);
  });

  it('a bed levelled to -29 dBFS sits at about -38 dBFS under the voice: the floor of 0.35 is 9.1 dB down', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.startSoundscape('starlight');
    const open = engine.layerGains.soundscape.gain.value;
    engine.setVoiceDucking(true);
    const ducked = engine.layerGains.soundscape.gain.value;
    expect(20 * Math.log10(ducked / open)).toBeCloseTo(-9.1, 1);
    expect(-29 + 20 * Math.log10(ducked / open)).toBeCloseTo(-38, 0);
  });

  it('a bed started under the voice starts ducked, and comes back to its own level', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    engine.setVoiceDucking(true);
    engine.startSoundscape('aurora');
    const target = 0.85 * gainOf(SOUND_TRIM_DB.aurora);
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(target * 0.35, 6);
    engine.setVoiceDucking(false);
    expect(engine.layerGains.soundscape.gain.value).toBeCloseTo(target, 6);
  });
});

describe('the sound the engine started', () => {
  it('is told, with its trim, and is what is sounding until it stops', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = readyEngine();
    const started = [];
    engine.onSoundStart = sound => started.push(sound);
    engine.startSoundscape('starlight');
    expect(started).toEqual([{ id: 'starlight', kind: 'soundscape', trimDb: SOUND_TRIM_DB.starlight }]);
    expect(engine.sounding).toEqual({ id: 'starlight', kind: 'soundscape' });
    engine.stopSoundscape(true);
    expect(engine.sounding).toBeNull();
    engine.applyPreset('focus');
    expect(started.at(-1)).toEqual({ id: 'focus', kind: 'tone', trimDb: SOUND_TRIM_DB.focus });
    expect(engine.sounding).toEqual({ id: 'focus', kind: 'tone' });
    engine.applyPreset('silent');
    expect(engine.sounding).toBeNull();
    expect(started).toHaveLength(2);
  });

  it('a listener that throws does not stop the sound', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = readyEngine();
    engine.onSoundStart = () => { throw new Error('listener'); };
    engine.startSoundscape('starlight');
    expect(engine.sounding).toEqual({ id: 'starlight', kind: 'soundscape' });
  });
});

describe('starting without IndexedDB', () => {
  it('loads its assets and says once that personal swells are unavailable, where indexedDB.open throws', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const engine = new AudioEngine();
    engine.context = { decodeAudioData: vi.fn() };
    await expect(engine.loadAssets()).resolves.toBeUndefined();
    const said = warn.mock.calls.filter(call => String(call[0]).includes('Personal swells'));
    expect(said).toHaveLength(1);
    expect(engine.personalPool?.size ?? 0).toBe(0);
  });
});
