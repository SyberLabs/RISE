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
