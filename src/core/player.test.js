/**
 * R.I.S.E. Player Engine Test Suite
 * Tests for playback control and event emission
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Player, estimateInterlocutionCount } from './player.js';
import { Session, Atom } from './models.js';

describe('Player', () => {
  let session;
  let player;

  beforeEach(() => {
    vi.useFakeTimers();

    const atoms = [
      new Atom({ content: 'one', duration: 100 }),
      new Atom({ content: 'two', duration: 100 }),
      new Atom({ content: 'three', duration: 100 })
    ];

    session = new Session({ atoms, title: 'Test Session' });
    player = new Player(session);
  });

  afterEach(() => {
    vi.useRealTimers();
    player.destroy();
  });

  describe('initialization', () => {
    it('initializes with idle state', () => {
      expect(player.state).toBe('idle');
    });

    it('initializes with zero progress', () => {
      expect(player.progress).toBe(0);
    });

    it('initializes with zero elapsed time', () => {
      expect(player.elapsed).toBe(0);
    });
  });

  describe('event subscription', () => {
    it('allows subscribing to events', () => {
      const callback = vi.fn();
      player.on('atom', callback);

      player.emit('atom', { test: true });

      expect(callback).toHaveBeenCalledWith({ test: true });
    });

    it('returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = player.on('atom', callback);

      unsubscribe();
      player.emit('atom', { test: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      player.on('state', callback1);
      player.on('state', callback2);

      player.emit('state', { state: 'playing' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('play()', () => {
    it('changes state to playing', () => {
      player.play();

      expect(player.state).toBe('playing');
    });

    it('emits state change event', () => {
      const callback = vi.fn();
      player.on('state', callback);

      player.play();

      expect(callback).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('emits first atom event', () => {
      const callback = vi.fn();
      player.on('atom', callback);

      player.play();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].atom.content).toBe('one');
      expect(callback.mock.calls[0][0].index).toBe(0);
    });

    it('does nothing if already playing', () => {
      const callback = vi.fn();

      player.play();
      player.on('state', callback);
      player.play();

      expect(callback).not.toHaveBeenCalled();
    });

    it('does nothing if session is complete', () => {
      player.sessionState.currentIndex = session.atoms.length;
      player.sessionState.state = 'complete';

      player.play();

      expect(player.state).toBe('complete');
    });
  });

  describe('pause()', () => {
    it('changes state to paused', () => {
      player.play();
      player.pause();

      expect(player.state).toBe('paused');
    });

    it('emits state change event', () => {
      player.play();

      const callback = vi.fn();
      player.on('state', callback);
      player.pause();

      expect(callback).toHaveBeenCalledWith({ state: 'paused' });
    });

    it('does nothing if not playing', () => {
      const callback = vi.fn();
      player.on('state', callback);

      player.pause();

      expect(callback).not.toHaveBeenCalled();
    });

    it('records pause time', () => {
      player.play();
      vi.advanceTimersByTime(50);
      player.pause();

      expect(player.sessionState.pausedAt).toBeDefined();
    });
  });

  describe('toggle()', () => {
    it('plays when paused', () => {
      player.toggle();

      expect(player.state).toBe('playing');
    });

    it('pauses when playing', () => {
      player.play();
      player.toggle();

      expect(player.state).toBe('paused');
    });
  });

  describe('stop()', () => {
    it('resets state to idle', () => {
      player.play();
      player.stop();

      expect(player.state).toBe('idle');
    });

    it('resets progress to 0', () => {
      player.play();
      player.sessionState.advance();
      player.stop();

      expect(player.progress).toBe(0);
    });

    it('emits state change event', () => {
      player.play();

      const callback = vi.fn();
      player.on('state', callback);
      player.stop();

      expect(callback).toHaveBeenCalledWith({ state: 'idle' });
    });

    it('clears timers', () => {
      player.play();
      player.stop();

      expect(player.timerId).toBeNull();
    });
  });

  describe('progress tracking', () => {
    it('emits progress events', () => {
      const callback = vi.fn();
      player.on('progress', callback);

      player.play();

      expect(callback).toHaveBeenCalled();
    });

    it('progress increases as atoms advance', () => {
      player.play();

      expect(player.progress).toBe(0);

      player.sessionState.advance();
      expect(player.progress).toBeCloseTo(1 / 3, 2);
    });

    it('keeps the visible timeline time-based at unequal atom boundaries', () => {
      session = new Session({
        title: 'Unequal Session',
        atoms: [
          new Atom({ content: 'brief', duration: 100 }),
          new Atom({ content: 'long', duration: 900 })
        ]
      });
      player.destroy();
      player = new Player(session);
      const callback = vi.fn();
      player.on('progress', callback);

      player.sessionState.state = 'playing';
      player.sessionState.currentIndex = 1;
      player.sessionState.startTime = Date.now() - 100;
      player.currentAtomRemainingTime = 900;
      player.atomStartTime = performance.now();
      player.startProgressAnimation();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.lastCall[0].progress).toBeCloseTo(0.1, 1);

      // Scheduling the new atom must not overwrite 10% elapsed-time progress
      // with the coarse index value of 50%.
      callback.mockClear();
      player.scheduleNextAtom();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('session completion', () => {
    it('emits complete event when all atoms processed', async () => {
      const callback = vi.fn();
      player.on('complete', callback);

      // Advance to end
      player.sessionState.currentIndex = session.atoms.length - 1;
      player.play();

      // Wait for final atom to complete
      vi.advanceTimersByTime(200);

      // Process pending RAF callbacks
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
    });

    it('sets state to complete', async () => {
      player.sessionState.currentIndex = session.atoms.length - 1;
      player.play();

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      expect(player.state).toBe('complete');
    });

    it('commits an exact final progress frame', async () => {
      const callback = vi.fn();
      player.on('progress', callback);
      player.sessionState.currentIndex = session.atoms.length - 1;
      player.play();

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      expect(callback.mock.lastCall[0]).toMatchObject({
        progress: 1,
        remaining: 0
      });
    });

    it('distinguishes reading, visible presence, and wall-clock time', () => {
      const callback = vi.fn();
      player.on('complete', callback);
      player.sessionState.state = 'playing';
      player.sessionState.currentIndex = session.atoms.length;
      player.sessionState.startTime = Date.now() - 1000;
      player.sessionWallStartTime = Date.now() - 1800;
      player.interlocutionStats.presented = 1;
      player.interlocutionStats.skipped = 2;
      player.interlocutionStats.visibleDurationMs = 700;

      player.scheduleNextAtom();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        duration: 1000,
        readingDurationMs: 1000,
        presenceDurationMs: 700,
        wallDurationMs: 1800,
        presentedCount: 1,
        skippedCount: 2
      }));
    });
  });

  describe('calculateRemainingTime()', () => {
    it('calculates total remaining duration', () => {
      const remaining = player.calculateRemainingTime();

      // 3 atoms * 100ms each
      expect(remaining).toBe(300);
    });

    it('decreases as atoms are processed', () => {
      player.sessionState.advance();

      const remaining = player.calculateRemainingTime();

      // 2 atoms left * 100ms each
      expect(remaining).toBe(200);
    });

    it('returns 0 when complete', () => {
      player.sessionState.currentIndex = session.atoms.length;

      expect(player.calculateRemainingTime()).toBe(0);
    });
  });

  describe('destroy()', () => {
    it('stops playback', () => {
      player.play();
      player.destroy();

      expect(player.state).toBe('idle');
    });

    it('clears all listeners', () => {
      const callback = vi.fn();
      player.on('atom', callback);

      player.destroy();

      expect(player.listeners.size).toBe(0);
    });
  });

  describe('voice sync mode', () => {
    it('can enable voice sync', () => {
      const speakFn = vi.fn();
      player.setVoiceSync(true, speakFn);

      expect(player.voiceSyncEnabled).toBe(true);
      expect(player.speakFn).toBe(speakFn);
    });

    it('can disable voice sync', () => {
      player.setVoiceSync(true, vi.fn());
      player.setVoiceSync(false);

      expect(player.voiceSyncEnabled).toBe(false);
    });
  });

  describe('interlocution handler', () => {
    it('can set interlocution handler', () => {
      const handler = vi.fn();
      player.setInterlocutionHandler(handler);

      expect(player.interlocutionHandler).toBe(handler);
    });

    it('honors an explicit zero flash frequency', async () => {
      session.visualConfig = {
        visualMode: 'interlocution',
        interlocution: { frequency: 0, responsive: true }
      };
      session.semanticTrack = [{ valence: 0.8, arousal: 1 }];
      const handler = vi.fn();
      player.setInterlocutionHandler(handler);
      player.sessionState.state = 'playing';
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await player.attemptInterlocution();

      expect(handler).not.toHaveBeenCalled();
    });

    it('migrates a legacy zero duration and forwards the responsive semantic signal', async () => {
      const signal = { valence: -0.25, arousal: 0.7 };
      session.visualConfig = {
        visualMode: 'interlocution',
        interlocution: { frequency: 1, duration: 0, responsive: true }
      };
      session.semanticTrack = [signal];
      const handler = vi.fn().mockResolvedValue(undefined);
      player.setInterlocutionHandler(handler);
      player.sessionState.state = 'playing';
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await player.attemptInterlocution();

      expect(handler).toHaveBeenCalledWith(150, signal, expect.any(Object));
    });

    it('recovers playback when the interlocution handler rejects', async () => {
      session.visualConfig = {
        visualMode: 'interlocution',
        interlocution: { frequency: 1, duration: 33 }
      };
      const errorListener = vi.fn();
      player.on('error', errorListener);
      player.setInterlocutionHandler(vi.fn().mockRejectedValue(new Error('worker failed')));
      player.sessionState.state = 'playing';
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await player.attemptInterlocution();

      expect(player.state).toBe('playing');
      expect(player.sessionState.currentIndex).toBe(0);
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ phase: 'interlocution' }));
    });

    it('estimates demand from eligible atom boundaries rather than raw reading time', () => {
      const wordSession = new Session({
        wpm: 240,
        chunkMode: 'word',
        atoms: Array.from({ length: 4 }, (_, index) => new Atom({
          content: `word-${index}`,
          duration: 250
        }))
      });
      const phraseSession = new Session({
        wpm: 240,
        chunkMode: 'phrase',
        atoms: [
          new Atom({ content: 'First phrase,', duration: 1000 }),
          new Atom({ content: 'second phrase.', duration: 1000 })
        ]
      });
      const sentenceSession = new Session({
        wpm: 240,
        chunkMode: 'sentence',
        atoms: [new Atom({ content: 'Four words in one sentence.', duration: 1000 })]
      });

      expect(estimateInterlocutionCount(wordSession, 0.5)).toBe(4);
      expect(estimateInterlocutionCount(phraseSession, 0.5)).toBe(3);
      expect(estimateInterlocutionCount(sentenceSession, 0.5)).toBe(0);
    });

    it('reduces preload demand for long visual presences', () => {
      const atoms = Array.from({ length: 32 }, (_, index) => new Atom({
        content: `boundary-${index}`,
        duration: 250
      }));
      const shortPresence = new Session({
        wpm: 240,
        atoms,
        visualConfig: { visualMode: 'interlocution', interlocution: { duration: 200 } }
      });
      const longPresence = new Session({
        wpm: 240,
        atoms,
        visualConfig: { visualMode: 'interlocution', interlocution: { duration: 2000 } }
      });

      expect(estimateInterlocutionCount(shortPresence, 1)).toBe(33);
      expect(estimateInterlocutionCount(longPresence, 1)).toBe(6);
    });

    it('accounts for structured presented and skipped outcomes', async () => {
      session.visualConfig = {
        visualMode: 'interlocution',
        interlocution: { frequency: 1, duration: 700 }
      };
      player.sessionState.state = 'playing';
      player.sessionState.startTime = Date.now();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      player.setInterlocutionHandler(vi.fn()
        .mockResolvedValueOnce({
          presented: true,
          requestedDurationMs: 700,
          presentedDurationMs: 700,
          reason: 'presented'
        })
        .mockResolvedValueOnce({
          presented: false,
          requestedDurationMs: 700,
          presentedDurationMs: 0,
          reason: 'cadence'
        }));

      await player.attemptInterlocution();
      await player.attemptInterlocution();

      expect(player.interlocutionStats).toMatchObject({
        opportunities: 2,
        cadenceRejected: 1,
        presented: 1,
        skipped: 1,
        visibleDurationMs: 700
      });
    });

    it('cancels an in-flight presence on stop without accepting a late result', async () => {
      session.visualConfig = {
        visualMode: 'interlocution',
        interlocution: { frequency: 1, duration: 2000 }
      };
      player.sessionState.state = 'playing';
      player.sessionState.startTime = Date.now();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      let settle;
      const handler = vi.fn(() => new Promise(resolve => { settle = resolve; }));
      const cancel = vi.fn(() => settle({
        presented: false,
        requestedDurationMs: 2000,
        presentedDurationMs: 400,
        reason: 'aborted'
      }));
      player.setInterlocutionHandler(handler, cancel);

      const attempt = player.attemptInterlocution();
      await Promise.resolve();
      player.stop();

      await expect(attempt).resolves.toBe(false);
      expect(cancel).toHaveBeenCalledWith('aborted');
      expect(player.state).toBe('idle');
      expect(player.interlocutionStats).toMatchObject({
        opportunities: 0,
        presented: 0,
        skipped: 0,
        visibleDurationMs: 0
      });
    });

    it.each(['word', 'phrase', 'sentence'])(
      'keeps a long %s atom uninterrupted and presents once at its exit boundary',
      async (chunkMode) => {
        session = new Session({
          wpm: 240,
          chunkMode,
          atoms: [
            new Atom({ content: 'The complete first atom.', duration: 1000 }),
            new Atom({ content: 'The complete second atom.', duration: 1000 })
          ],
          visualConfig: {
            visualMode: 'interlocution',
            interlocution: { frequency: 1, duration: 200 }
          }
        });
        player.destroy();
        player = new Player(session);
        const handler = vi.fn().mockResolvedValue(true);
        const atomListener = vi.fn();
        player.setInterlocutionHandler(handler);
        player.on('atom', atomListener);

        player.play();
        await vi.advanceTimersByTimeAsync(900);

        expect(handler).not.toHaveBeenCalled();
        expect(atomListener.mock.calls.map(([event]) => event.atom.content)).toEqual([
          'The complete first atom.'
        ]);

        await vi.advanceTimersByTimeAsync(200);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(atomListener.mock.calls.map(([event]) => event.atom.content)).toEqual([
          'The complete first atom.',
          'The complete second atom.'
        ]);

        await vi.advanceTimersByTimeAsync(1200);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(player.state).toBe('complete');
      }
    );

    it('prepares the next atom while covered but starts its clock only after reveal', async () => {
      session = new Session({
        atoms: [
          new Atom({ content: 'Completed thought.', duration: 100 }),
          new Atom({ content: 'New thought.', duration: 100 })
        ],
        visualConfig: {
          visualMode: 'interlocution',
          interlocution: { frequency: 1, duration: 700 }
        }
      });
      player.destroy();
      player = new Player(session);
      let settlePresence;
      let lifecycle;
      const handler = vi.fn((_duration, _signal, hooks) => {
        lifecycle = hooks;
        return new Promise(resolve => { settlePresence = resolve; });
      });
      const atomListener = vi.fn();
      player.setInterlocutionHandler(handler);
      player.on('atom', atomListener);

      player.play();
      await vi.advanceTimersByTimeAsync(150);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(player.state).toBe('interlocuting');
      expect(atomListener.mock.calls.map(([event]) => event.atom.content)).toEqual([
        'Completed thought.'
      ]);

      lifecycle.onCovered();

      expect(player.sessionState.currentIndex).toBe(1);
      expect(player.currentAtomRemainingTime).toBe(100);
      expect(player.atomStartTime).toBeNull();
      expect(atomListener.mock.calls.map(([event]) => ({
        content: event.atom.content,
        concealed: event.concealed === true
      }))).toEqual([
        { content: 'Completed thought.', concealed: false },
        { content: 'New thought.', concealed: true }
      ]);

      await vi.advanceTimersByTimeAsync(500);
      expect(player.currentAtomRemainingTime).toBe(100);
      expect(player.state).toBe('interlocuting');

      settlePresence({
        presented: true,
        requestedDurationMs: 700,
        presentedDurationMs: 700,
        reason: 'presented'
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(player.state).toBe('playing');
      expect(player.atomStartTime).not.toBeNull();
      expect(atomListener).toHaveBeenCalledTimes(2);
    });

    it('speaks a concealed next atom after reveal without emitting it twice', async () => {
      session = new Session({
        atoms: [
          new Atom({ content: 'Completed thought.', duration: 100 }),
          new Atom({ content: 'Spoken next thought.', duration: 100 })
        ],
        visualConfig: {
          visualMode: 'interlocution',
          interlocution: { frequency: 1, duration: 200 }
        }
      });
      player.destroy();
      player = new Player(session);
      const speak = vi.fn();
      const atomListener = vi.fn();
      player.setVoiceSync(true, speak);
      player.setInterlocutionHandler(vi.fn((_duration, _signal, lifecycle) => {
        lifecycle.onCovered();
        return Promise.resolve({
          presented: true,
          requestedDurationMs: 200,
          presentedDurationMs: 200,
          reason: 'presented'
        });
      }));
      player.on('atom', atomListener);
      player.sessionState.state = 'playing';

      await player.processNextNode();

      expect(atomListener).toHaveBeenCalledTimes(1);
      expect(atomListener.mock.calls[0][0]).toMatchObject({
        atom: { content: 'Spoken next thought.' },
        concealed: true
      });
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith(
        'Spoken next thought.',
        expect.objectContaining({ onEnd: expect.any(Function) })
      );
    });

    it('does not create opportunities across authored pause boundaries', async () => {
      session = new Session({
        atoms: [
          new Atom({ content: 'Before.', duration: 100 }),
          new Atom({ content: '', duration: 100, timingLocked: true, tags: ['PAUSE'] }),
          new Atom({ content: 'After.', duration: 100 })
        ],
        visualConfig: {
          visualMode: 'interlocution',
          interlocution: { frequency: 1, duration: 200 }
        }
      });
      player.destroy();
      player = new Player(session);
      const handler = vi.fn().mockResolvedValue(true);
      player.setInterlocutionHandler(handler);

      player.play();
      await vi.advanceTimersByTimeAsync(500);

      expect(handler).not.toHaveBeenCalled();
      expect(player.state).toBe('complete');
    });
  });

  describe('dynamic speed', () => {
    it('includes the speed factor in remaining time', () => {
      player.setSpeedFactor(2);
      expect(player.calculateRemainingTime()).toBe(600);

      player.setSpeedFactor(0.5);
      expect(player.calculateRemainingTime()).toBe(150);
    });
  });

  describe('resume from pause', () => {
    it('resumes from paused position', () => {
      player.play();
      vi.advanceTimersByTime(50);
      player.pause();

      const pausedIndex = player.sessionState.currentIndex;

      player.play();

      // Should continue from same atom
      expect(player.sessionState.currentIndex).toBe(pausedIndex);
    });

    it('does not re-emit atom on resume', () => {
      const callback = vi.fn();

      player.play();
      callback.mockClear();

      player.pause();
      player.on('atom', callback);
      player.play();

      // Should not emit atom event on resume
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('elapsed time tracking', () => {
    it('tracks elapsed time while playing', () => {
      player.play();
      vi.advanceTimersByTime(50);

      expect(player.elapsed).toBeGreaterThan(0);
    });

    it('freezes elapsed time when paused', () => {
      player.play();
      vi.advanceTimersByTime(50);
      player.pause();

      const pausedElapsed = player.elapsed;
      vi.advanceTimersByTime(100);

      expect(player.elapsed).toBe(pausedElapsed);
    });
  });
});
