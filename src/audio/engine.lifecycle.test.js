import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.js';

describe('AudioEngine lifecycle ownership', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves an interrupted fade instead of leaving its caller pending', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    engine.context = { currentTime: 0 };
    engine.masterGain = { gain: {
      value: 0.5,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    } };

    const first = engine.fadeOutSession(1);
    const second = engine.fadeInSession(1);
    await expect(first).resolves.toEqual({ cancelled: true });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(second).resolves.toBeUndefined();
  });

  it('cancels delayed teardown when a replacement session begins', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    vi.spyOn(engine, 'init').mockResolvedValue(undefined);
    vi.spyOn(engine, 'resume').mockResolvedValue(undefined);
    vi.spyOn(engine, 'fadeOutSession').mockResolvedValue(undefined);
    vi.spyOn(engine, 'stopAmbient').mockImplementation(() => {});
    vi.spyOn(engine, 'playSwell').mockImplementation(() => {});
    const stopLayers = vi.spyOn(engine, 'stopEntrainment').mockImplementation(() => {});

    const oldStop = engine.stopSession();
    const replacement = engine.startSession();
    await vi.advanceTimersByTimeAsync(50);
    await replacement;
    await vi.advanceTimersByTimeAsync(500);

    await expect(oldStop).resolves.toEqual({ cancelled: true });
    expect(stopLayers).not.toHaveBeenCalled();
  });

  it('applies the selected pure-tone preset when a session starts', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    vi.spyOn(engine, 'init').mockResolvedValue(undefined);
    vi.spyOn(engine, 'resume').mockResolvedValue(undefined);
    vi.spyOn(engine, 'stopAmbient').mockImplementation(() => {});
    vi.spyOn(engine, 'playSwell').mockImplementation(() => {});
    const applyPreset = vi.spyOn(engine, 'applyPreset').mockImplementation(() => {});

    const started = engine.startSession({ preset: 'focus' });
    await vi.advanceTimersByTimeAsync(50);
    await expect(started).resolves.toEqual({ cancelled: false });
    expect(applyPreset).toHaveBeenCalledOnce();
    expect(applyPreset).toHaveBeenCalledWith('focus');
  });

  it('preserves the Aurora mix level when a second session starts', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    vi.spyOn(engine, 'init').mockResolvedValue(undefined);
    vi.spyOn(engine, 'resume').mockResolvedValue(undefined);
    vi.spyOn(engine, 'stopAmbient').mockImplementation(() => {});
    vi.spyOn(engine, 'playSwell').mockImplementation(() => {});

    engine.context = { currentTime: 0 };
    engine.layerGains.soundscape = { gain: {
      value: 0.85,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    } };

    const startedAtVolumes = [];
    vi.spyOn(engine, 'startSoundscape').mockImplementation(() => {
      startedAtVolumes.push(engine.config.layerVolumes.soundscape);
      engine.layers.soundscape = { stop: vi.fn() };
    });

    const first = engine.startSession({ soundscape: 'aurora' });
    await vi.advanceTimersByTimeAsync(50);
    await first;

    const stopped = engine.stopSession({ resumeAmbient: false, immediate: true });
    await vi.runOnlyPendingTimersAsync();
    await stopped;

    const second = engine.startSession({ soundscape: 'aurora' });
    await vi.advanceTimersByTimeAsync(50);
    await second;

    expect(startedAtVolumes).toEqual([0.85, 0.85]);
    expect(engine.config.layerVolumes.soundscape).toBe(0.85);
  });
});

describe('AudioEngine reading-clock entrainment', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const beatParam = () => ({
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  });

  const engineWithBinaural = () => {
    const engine = new AudioEngine();
    engine.context = { currentTime: 10 };
    engine.isInitialized = true;
    engine.layers.binaural = { rightOsc: { frequency: beatParam() } };
    return engine;
  };

  it('interpolates ramp beats in reading time, geometric on exponential curves', () => {
    const engine = new AudioEngine();
    const linear = { curve: 'linear', points: [
      { time: 0, beat: 10 }, { time: 60, beat: 4 }, { time: 120, beat: 10 }
    ] };
    expect(engine.beatAtRampTime(linear, 0)).toBe(10);
    expect(engine.beatAtRampTime(linear, 30)).toBe(7);
    expect(engine.beatAtRampTime(linear, 90)).toBe(7);
    // Clamped, never extrapolated
    expect(engine.beatAtRampTime(linear, -5)).toBe(10);
    expect(engine.beatAtRampTime(linear, 500)).toBe(10);

    const expo = { curve: 'exponential', points: [
      { time: 0, beat: 4 }, { time: 100, beat: 16 }
    ] };
    expect(engine.beatAtRampTime(expo, 50)).toBeCloseTo(8, 10);
  });

  it('stores a curve ramp for position steering instead of wall-clock scheduling', async () => {
    vi.useFakeTimers();
    const engine = engineWithBinaural();
    vi.spyOn(engine, 'init').mockResolvedValue(undefined);
    vi.spyOn(engine, 'resume').mockResolvedValue(undefined);
    vi.spyOn(engine, 'stopAmbient').mockImplementation(() => {});
    vi.spyOn(engine, 'playSwell').mockImplementation(() => {});
    vi.spyOn(engine, 'setEntrainmentConfig').mockImplementation(() => {});
    engine.masterGain = { gain: beatParam() };

    const started = engine.startSession({
      entrainment: { mode: 'binaural', curve: 'induction', durationSec: 600, autoRamp: true }
    });
    await vi.advanceTimersByTimeAsync(50);
    await started;

    const param = engine.layers.binaural.rightOsc.frequency;
    // The beat starts at the curve's first point…
    expect(engine._positionRamp).not.toBeNull();
    expect(param.setValueAtTime).toHaveBeenCalled();
    // …but NO wall-clock ramp was scheduled: the reading clock owns time
    expect(param.exponentialRampToValueAtTime).not.toHaveBeenCalled();
    expect(param.linearRampToValueAtTime).not.toHaveBeenCalled();

    // The player steers by canonical progress
    engine.setEntrainmentPosition(0.5);
    expect(param.setTargetAtTime).toHaveBeenCalledTimes(1);
    const [value, , tau] = param.setTargetAtTime.mock.calls[0];
    const expectedBeat = engine.beatAtRampTime(engine._positionRamp, 300);
    expect(value).toBeCloseTo(engine.getCarrierFrequency() + expectedBeat, 10);
    expect(tau).toBeGreaterThan(0);

    // Steering is throttled at a fixed context time…
    engine.setEntrainmentPosition(0.6);
    expect(param.setTargetAtTime).toHaveBeenCalledTimes(1);
    // …and resumes once the audio clock moves past the throttle window
    engine.context.currentTime += 1;
    engine.setEntrainmentPosition(0.6);
    expect(param.setTargetAtTime).toHaveBeenCalledTimes(2);
  });

  it('holds the beat after stopSession and outside an active session', () => {
    const engine = engineWithBinaural();
    engine._positionRamp = { curve: 'linear', points: [
      { time: 0, beat: 10 }, { time: 100, beat: 4 }
    ] };
    const param = engine.layers.binaural.rightOsc.frequency;

    // No session: progress events must not move audio
    engine.sessionActive = false;
    engine.setEntrainmentPosition(0.5);
    expect(param.setTargetAtTime).not.toHaveBeenCalled();

    engine.sessionActive = true;
    engine.setEntrainmentPosition(0.5);
    expect(param.setTargetAtTime).toHaveBeenCalledTimes(1);

    engine.stopSession({ resumeAmbient: false, immediate: true });
    expect(engine._positionRamp).toBeNull();
  });

  it('honors an explicit points ramp via the wall-clock contract unchanged', () => {
    const engine = engineWithBinaural();
    engine.applyEntrainmentRamp({
      curve: 'linear',
      points: [{ time: 0, beat: 10 }, { time: 60, beat: 6 }]
    });
    const param = engine.layers.binaural.rightOsc.frequency;
    expect(param.setValueAtTime).toHaveBeenCalled();
    expect(param.linearRampToValueAtTime).toHaveBeenCalled();
  });
});
