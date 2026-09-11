import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.js';

describe('AudioEngine lifecycle ownership', () => {
  it('can build another context after being destroyed', async () => {
    // init() returns initPromise before it looks at anything else, so
    // leaving it set meant a destroyed engine could never build another
    // context: init() resolved instantly, having done nothing, and every
    // caller went on believing audio was ready.
    vi.stubGlobal('document', {
      addEventListener: () => {},
      removeEventListener: () => {},
      get visibilityState() { return 'visible'; }
    });
    let built = 0;
    vi.stubGlobal('AudioContext', class FakeContext {
      constructor() {
        built += 1;
        this.state = 'running';
        this.destination = {};
      }
      createGain() { return { gain: { value: 0 }, connect: () => {} }; }
      addEventListener() {}
      removeEventListener() {}
      close() { this.state = 'closed'; return Promise.resolve(); }
    });

    const engine = new AudioEngine();
    vi.spyOn(engine, 'loadAssets').mockResolvedValue(undefined);
    await engine.init();
    expect(built).toBe(1);

    engine.destroy();
    expect(engine.initPromise).toBeNull();

    engine._destroyed = false;
    await engine.init();
    expect(built).toBe(2);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports initialization failure through its injected boundary', async () => {
    const onUnavailable = vi.fn();
    vi.stubGlobal('AudioContext', class BlockedAudioContext {
      constructor() { throw new Error('blocked'); }
    });
    const engine = new AudioEngine({ onUnavailable });

    await expect(engine.init()).rejects.toThrow('blocked');

    expect(onUnavailable).toHaveBeenCalledWith(
      'Audio initialization blocked. Interact to enable.',
      4000
    );
  });

  /**
   * iOS takes the audio session away when the phone locks, a call
   * arrives, or the reader leaves the browser, and it puts the
   * AudioContext into a fourth state that is neither running nor
   * suspended. Everything below is about the reading coming back when
   * the reader does, rather than staying silent until the tab is closed.
   */
  describe('an interrupted audio session', () => {
    it('resumes a context WebKit marked interrupted, not only a suspended one', async () => {
      // The guard asked `state !== 'suspended'` and returned. An
      // interrupted context therefore never had resume() called on it
      // at all, for the whole life of the page.
      const resume = vi.fn().mockResolvedValue(undefined);
      const engine = new AudioEngine();
      engine.context = { state: 'interrupted', resume };

      await engine.resume();

      expect(resume).toHaveBeenCalledTimes(1);
    });

    it('leaves a running context alone', async () => {
      const resume = vi.fn().mockResolvedValue(undefined);
      const engine = new AudioEngine();
      engine.context = { state: 'running', resume };

      await engine.resume();

      expect(resume).not.toHaveBeenCalled();
    });

    it('does not try to revive a closed context', async () => {
      // A closed context cannot be resumed, only rebuilt. Asking throws.
      const resume = vi.fn().mockRejectedValue(new Error('closed'));
      const engine = new AudioEngine();
      engine.context = { state: 'closed', resume };

      await engine.resume();

      expect(resume).not.toHaveBeenCalled();
    });

    it('asks for the session back when the page returns to screen', async () => {
      // iOS does not resume a context on its own after an interruption.
      // It waits to be asked, and before this nothing asked — which is
      // why the sound did not return when the reader did.
      const listeners = {};
      vi.stubGlobal('document', {
        addEventListener: (type, fn) => { listeners[type] = fn; },
        removeEventListener: () => {},
        get visibilityState() { return 'visible'; }
      });
      const resume = vi.fn().mockResolvedValue(undefined);
      const engine = new AudioEngine();
      engine.context = {
        state: 'interrupted',
        resume,
        addEventListener: () => {},
        removeEventListener: () => {}
      };

      engine._bindContextLifecycle();
      expect(typeof listeners.visibilitychange).toBe('function');

      listeners.visibilitychange();
      await Promise.resolve();

      expect(resume).toHaveBeenCalled();
    });

    it('rebuilds a context that closed, because resume cannot revive one', async () => {
      // A closed AudioContext is final: resume() throws on one and every
      // node built from it is inert, so the only way back is a new one.
      // Safari closes contexts under memory pressure, and this used to
      // leave the page silent with a reload as the only cure.
      const built = [];
      vi.stubGlobal('document', {
        addEventListener: () => {},
        removeEventListener: () => {},
        get visibilityState() { return 'visible'; }
      });
      vi.stubGlobal('AudioContext', class FakeContext {
        constructor() {
          built.push(this);
          this.state = 'running';
          this.destination = {};
        }
        createGain() {
          return { gain: { value: 0 }, connect: () => {} };
        }
        addEventListener() {}
        removeEventListener() {}
        close() { this.state = 'closed'; return Promise.resolve(); }
      });

      const engine = new AudioEngine();
      vi.spyOn(engine, 'loadAssets').mockResolvedValue(undefined);
      await engine.init();
      expect(built).toHaveLength(1);

      engine.context.state = 'closed';
      await engine.resume();

      expect(built).toHaveLength(2);
      expect(engine.context).toBe(built[1]);
      expect(engine.isInitialized).toBe(true);
    });

    it('does not rebuild twice at once', async () => {
      const engine = new AudioEngine();
      engine._rebuilding = true;
      const init = vi.spyOn(engine, 'init');

      await engine.rebuild();

      expect(init).not.toHaveBeenCalled();
    });

    it('tells the app the audio stopped, so the next tap can recover it', () => {
      const listeners = {};
      vi.stubGlobal('document', {
        addEventListener: () => {},
        removeEventListener: () => {},
        get visibilityState() { return 'visible'; }
      });
      const onInterrupted = vi.fn();
      const engine = new AudioEngine();
      engine.onInterrupted = onInterrupted;
      engine.context = {
        state: 'interrupted',
        resume: vi.fn(),
        addEventListener: (type, fn) => { listeners[type] = fn; },
        removeEventListener: () => {}
      };

      engine._bindContextLifecycle();
      listeners.statechange();

      expect(onInterrupted).toHaveBeenCalledWith('interrupted');
    });
  });

  it('does not wait on a browser that never answers a resume', async () => {
    // Audio needs a user gesture, and `resume()` on a page that has not
    // had one does not reliably reject — on iOS Safari it commonly does
    // not settle at all until a gesture arrives. Everything awaiting it
    // was therefore awaiting a PERSON, and startSession awaits it with
    // the loading screen in front of the reader: refreshing a keystone
    // URL, where nothing has been tapped yet, stuck that screen at
    // 'Stabilizing carrier frequencies'.
    vi.useFakeTimers();
    const engine = new AudioEngine();
    engine.context = { state: 'suspended', resume: () => new Promise(() => {}) };

    let settled = false;
    const resuming = engine.resume().then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await resuming;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it('carries on when a resume is refused outright', async () => {
    const engine = new AudioEngine();
    engine.context = { state: 'suspended', resume: () => Promise.reject(new Error('no gesture')) };
    await expect(engine.resume()).resolves.toBeUndefined();
  });

  it('asks nothing of a context that is already running', async () => {
    const resume = vi.fn();
    const engine = new AudioEngine();
    engine.context = { state: 'running', resume };
    await engine.resume();
    expect(resume).not.toHaveBeenCalled();
  });

  /**
   * masterGain was the global volume control AND the Chamber's reveal AND
   * the bus the spoken voice ran through. The collision was audible:
   * startSession zeroes the bus, Chamber calls player.play() before
   * fadeInSession, and play() emits the first atom synchronously - so the
   * opening phrase started into a bus at zero and rode the ramp up from
   * it, and every unpause did it again.
   */
  describe('the session reveal and the global volume are different buses', () => {
    const graph = () => {
      const made = [];
      vi.stubGlobal('document', {
        addEventListener: () => {},
        removeEventListener: () => {},
        get visibilityState() { return 'visible'; }
      });
      vi.stubGlobal('AudioContext', class FakeContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.destination = { name: 'destination' };
        }
        createGain() {
          const node = {
            gain: {
              value: 0,
              cancelScheduledValues: vi.fn(),
              setValueAtTime: vi.fn(),
              linearRampToValueAtTime: vi.fn()
            },
            connectedTo: null,
            connect(target) { node.connectedTo = target; }
          };
          made.push(node);
          return node;
        }
        addEventListener() {}
        removeEventListener() {}
        close() { return Promise.resolve(); }
      });
      return made;
    };

    it('routes music through the session bus and feedback straight to master', async () => {
      graph();
      const engine = new AudioEngine();
      vi.spyOn(engine, 'loadAssets').mockResolvedValue(undefined);
      await engine.init();

      expect(engine.masterGain.connectedTo).toBe(engine.context.destination);
      expect(engine.sessionGain.connectedTo).toBe(engine.masterGain);
      expect(engine.voiceGain.connectedTo).toBe(engine.masterGain);

      // Musical: part of the session, rides its reveal.
      for (const layer of ['binaural', 'harmonics', 'noise', 'drone',
        'ambient', 'swell', 'soundscape']) {
        expect(engine.layerGains[layer].connectedTo).toBe(engine.sessionGain);
      }
      // Feedback: heard whether a session is running, fading or absent.
      for (const layer of ['ui', 'typing']) {
        expect(engine.layerGains[layer].connectedTo).toBe(engine.masterGain);
      }
    });

    it('opens a session without touching the volume or the voice', async () => {
      graph();
      const engine = new AudioEngine();
      vi.spyOn(engine, 'loadAssets').mockResolvedValue(undefined);
      await engine.init();

      engine.fadeInSession(1.2);

      expect(engine.sessionGain.gain.setValueAtTime)
        .toHaveBeenCalledWith(0, 0);
      // Full, not masterVolume: the reader's volume already lives on
      // masterGain downstream, and applying it here too would square it.
      expect(engine.sessionGain.gain.linearRampToValueAtTime)
        .toHaveBeenCalledWith(1, 1.2);

      // The two that must not move. A phrase starting during the reveal
      // used to be multiplied by whatever this ramp had reached.
      expect(engine.masterGain.gain.setValueAtTime).not.toHaveBeenCalled();
      expect(engine.masterGain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
      expect(engine.voiceGain.gain.setValueAtTime).not.toHaveBeenCalled();
      expect(engine.voiceGain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
      // The level itself is the balance against the bed, set once at
      // build time. What matters here is that the reveal does not move
      // it: a phrase starting during the fade is not multiplied by
      // whatever the ramp had reached.
      expect(engine.voiceGain.gain.value).toBe(engine.config.voiceVolume);
    });

    it('keeps the reader volume on master, where a transition cannot reach it', async () => {
      graph();
      const engine = new AudioEngine();
      vi.spyOn(engine, 'loadAssets').mockResolvedValue(undefined);
      await engine.init();

      engine.setVolume(0.3);

      expect(engine.masterGain.gain.linearRampToValueAtTime)
        .toHaveBeenCalledWith(0.3, 0.1);
      expect(engine.sessionGain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    });
  });

  it('resolves an interrupted fade instead of leaving its caller pending', async () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    engine.context = { currentTime: 0 };
    // The session reveal lives on sessionGain now; masterGain means only
    // how loud RISE is, and is never animated by a transition.
    engine.sessionGain = { gain: {
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

describe('a named swell fails closed', () => {
    // FOUND IN AN EXTERNAL REVIEW OF 0fb9c2b, and verified in the code:
    // playSwell('funeral-bell') with nothing by that name warned and then
    // played a RANDOM different swell. That is not degradation, it is
    // false execution — the runtime sounding something the score never
    // asked for, with nothing to say so.
    //
    // The observation is whether a buffer source was CREATED. playSwell
    // wraps its body in try/catch, so a throwing stub proves nothing:
    // the throw is swallowed and the test passes either way.
    const engineWithPool = (pool) => {
        const created = [];
        const engine = Object.create(AudioEngine.prototype);
        engine.isInitialized = true;
        engine.isMuted = false;
        engine.buffers = { swells: [{ id: 'a' }, { id: 'b' }], personalSwells: [{ id: 'c' }] };
        engine.personalPool = pool;
        engine.masterGain = {};
        engine.layerGains = {};
        engine.context = {
            currentTime: 0,
            createBufferSource: () => {
                const node = { buffer: null, connect() {}, start() {}, stop() {}, onended: null };
                created.push(node);
                return node;
            },
            createGain: () => ({ gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} })
        };
        return { engine, created };
    };

    it('plays nothing when the named swell is absent', async () => {
        const { engine, created } = engineWithPool(new Map());
        await engine.playSwell('funeral-bell');
        expect(created, 'a substitute was sounded').toHaveLength(0);
    });

    it('plays it when the name resolves', async () => {
        const bell = { id: 'funeral-bell' };
        const { engine, created } = engineWithPool(new Map([['funeral-bell', bell]]));
        await engine.playSwell('funeral-bell');
        expect(created).toHaveLength(1);
        expect(created[0].buffer, 'the swell asked for is the swell played').toBe(bell);
    });

    it('an unnamed request still takes any swell', async () => {
        // "Give me a swell" is a different request from "give me THIS
        // swell", and only the second fails closed.
        const { engine, created } = engineWithPool(new Map());
        await engine.playSwell();
        expect(created).toHaveLength(1);
    });
});
