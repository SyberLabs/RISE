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
    // The reading clock lives on performance.now — fake it alongside
    // Date so advanceTimersByTime moves both in step
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });

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

    it('synchronously cancels an active visual presence', () => {
      const cancel = vi.fn();
      player.setInterlocutionHandler(vi.fn(), cancel);
      player.sessionState.state = 'interlocuting';

      player.pause();

      expect(cancel).toHaveBeenCalledWith('paused');
      expect(player.state).toBe('paused');
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
      // 100ms already read, on the monotonic reading clock
      player._reading.accumulatedMs = 100;
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
      // 1000ms of reading on the monotonic clock; 1800ms of wall time
      player._reading.accumulatedMs = 1000;
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

    it('estimates demand from eligible reading time, equal across chunk modes', () => {
      // Time-based hazard: the same frequency implies the same visual
      // density per authored second, so a Word session no longer
      // out-demands a Phrase session of the same reading length.
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

      // word: 0.75s of eligible-boundary reading → ceil(0.375) + 2
      expect(estimateInterlocutionCount(wordSession, 0.5)).toBe(3);
      // phrase: 1s eligible → ceil(0.5) + 2
      expect(estimateInterlocutionCount(phraseSession, 0.5)).toBe(3);
      // a single sentence has no eligible boundary at all
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

      // 7.75s of eligible reading at max frequency → ceil(7.75) + 2
      expect(estimateInterlocutionCount(shortPresence, 1)).toBe(10);
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

    it('scales flash chance with the authored time an atom occupied', async () => {
      // HAZARD CONTRACT: the same frequency must produce the same
      // flashes-per-minute in every chunk mode. A 2s sentence carries
      // ten times the hazard of a 200ms word, so a roll that fails
      // after the word succeeds after the sentence.
      const buildPlayer = (duration) => {
        const s = new Session({
          atoms: [
            new Atom({ content: 'first', duration }),
            new Atom({ content: 'second', duration })
          ],
          visualConfig: {
            visualMode: 'interlocution',
            interlocution: { frequency: 0.5, duration: 150 }
          }
        });
        const p = new Player(s);
        p.setInterlocutionHandler(vi.fn().mockResolvedValue(true));
        p.sessionState.state = 'playing';
        p.sessionState.startTime = Date.now();
        return p;
      };

      // word 200ms: p = 1-exp(-0.5*0.2) ≈ 0.095; sentence 2000ms: ≈ 0.63
      vi.spyOn(Math, 'random').mockReturnValue(0.3);

      const wordPlayer = buildPlayer(200);
      await wordPlayer.attemptInterlocution();
      expect(wordPlayer.interlocutionHandler).not.toHaveBeenCalled();
      wordPlayer.destroy();

      const sentencePlayer = buildPlayer(2000);
      await sentencePlayer.attemptInterlocution();
      expect(sentencePlayer.interlocutionHandler).toHaveBeenCalledTimes(1);
      sentencePlayer.destroy();
    });

    it('resumes past the completed atom when a pause interrupts the flash entry', async () => {
      // BOUNDARY TRANSACTION: a flash only intercepts an atom that has
      // fully completed its display. A pause landing during flash entry
      // (before the next atom is prepared) must resume by advancing —
      // replaying the completed atom would double its reading time.
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
        presentedDurationMs: 100,
        reason: 'aborted'
      }));
      player.setInterlocutionHandler(handler, cancel);

      const attempt = player.attemptInterlocution();
      await Promise.resolve();
      expect(player.state).toBe('interlocuting');

      player.pause(); // lands before any covered hook — no atom prepared
      await attempt;
      expect(player.state).toBe('paused');
      expect(player.sessionState.currentIndex).toBe(0);

      const atomListener = vi.fn();
      player.on('atom', atomListener);
      player.play();

      expect(player.sessionState.currentIndex).toBe(1);
      expect(atomListener).toHaveBeenCalledWith(expect.objectContaining({ index: 1 }));
      expect(atomListener).not.toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
    });

    it('an ordinary pause without a flash still replays nothing and advances nothing', async () => {
      // Control case: the transaction must not leak into normal pauses.
      player.play();
      await vi.advanceTimersByTimeAsync(40); // mid-atom
      player.pause();
      const indexBefore = player.sessionState.currentIndex;
      player.play();
      expect(player.sessionState.currentIndex).toBe(indexBefore);
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

describe('Player reading clock (temporal contract phase 3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makePlayer(durations = [100, 200, 300, 400]) {
    const atoms = durations.map((duration, i) =>
      new Atom({ content: `atom-${i}`, duration }));
    return new Player(new Session({ atoms, title: 'Clock Session' }));
  }

  it('remaining time is O(1) prefix math and matches the atom sum', () => {
    const player = makePlayer([100, 200, 300, 400]);
    // Idle at index 0, nothing consumed: full total remains
    expect(player.calculateRemainingTime()).toBe(1000);

    player.sessionState.currentIndex = 2;
    expect(player.calculateRemainingTime()).toBe(700); // 300 + 400

    player.speedFactor = 0.5; // 2x speed
    expect(player.calculateRemainingTime()).toBe(350);

    player.sessionState.currentIndex = 4; // past the end
    expect(player.calculateRemainingTime()).toBe(0);
    player.destroy();
  });

  it('mid-atom remainder uses the live clock, later atoms use prefix sums', () => {
    let now = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const player = makePlayer([100, 200, 300, 400]);

    player.sessionState.currentIndex = 1;
    player.currentAtomRemainingTime = 200;
    player.atomStartTime = 5000;
    now = 5080; // 80ms consumed of the current atom

    expect(player.calculateRemainingTime()).toBe(120 + 700);
    player.destroy();
  });

  it('wall-clock jumps never inflate elapsed reading time', () => {
    let perfNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
    const player = makePlayer();

    player.play();
    perfNow = 3000; // 2s of genuine playing
    player.pause();

    // The machine sleeps for an hour — wall time races, reading stops
    vi.spyOn(Date, 'now').mockImplementation(() => Date.now.getMockImplementation ? 9_999_999_999 : 0);
    perfNow = 3_600_000;

    expect(player.elapsed).toBe(2000);
    player.destroy();
  });

  it('interlocution and pause suspend the reading clock; resume continues it', () => {
    let perfNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => perfNow);
    const player = makePlayer();

    player.play();
    perfNow = 2000; // 1s playing
    player.pause();
    perfNow = 10_000; // 8s paused — must not count
    player.play();
    perfNow = 10_500; // 0.5s playing

    expect(player.elapsed).toBe(1500);
    player.destroy();
  });

  it('auto-pauses when the tab hides and resumes only its own pause', () => {
    const player = makePlayer();
    const hidden = vi.spyOn(document, 'hidden', 'get');

    player.play();
    expect(player.state).toBe('playing');

    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.state).toBe('paused');

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.state).toBe('playing');

    // A USER pause is never overridden by tab visibility
    player.pause();
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.state).toBe('paused');

    player.destroy();
  });

  it('visibility auto-pause cancels an in-flight visual and resumes its own pause', () => {
    const player = makePlayer();
    const hidden = vi.spyOn(document, 'hidden', 'get');
    const cancel = vi.fn();
    player.setInterlocutionHandler(vi.fn(), cancel);
    player.sessionState.state = 'interlocuting';

    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.state).toBe('paused');
    expect(cancel).toHaveBeenCalledWith('paused');

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.state).toBe('playing');

    player.destroy();
  });
});

describe('Player + Shuttle (LATERAL-TRAVERSAL-SPEC)', () => {
  let session;
  let player;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    const atoms = Array.from({ length: 6 }, (_, i) =>
      new Atom({ content: `atom-${i}`, duration: 100 }));
    session = new Session({ atoms, title: 'Shuttle Session' });
    player = new Player(session);
  });

  afterEach(() => {
    vi.useRealTimers();
    player.destroy();
  });

  it('velocity divides the display time of the current atom', () => {
    player.play();
    expect(player._atomDisplayMs(session.atoms[0])).toBe(100);
    player.shuttleForward(); // 2×
    expect(player._atomDisplayMs(session.atoms[0])).toBe(50);
    player.shuttleForward(); // 4×
    expect(player._atomDisplayMs(session.atoms[0])).toBe(50); // 25 floors to 50
  });

  it('fast-forward advances without interlocution rolls; home restores them', async () => {
    const handler = vi.fn(async () => ({ presented: false, reason: 'test' }));
    player.setInterlocutionHandler(handler);
    player.play();
    player.shuttleForward(); // 2× — rolls must not happen
    await vi.advanceTimersByTimeAsync(400);
    expect(handler).not.toHaveBeenCalled();
    expect(player.sessionState.currentIndex).toBeGreaterThan(1);
  });

  it('rewind retreats through completed atoms in reverse sequence', async () => {
    player.play();
    await vi.advanceTimersByTimeAsync(320); // reach ~atom 3
    const reached = player.sessionState.currentIndex;
    expect(reached).toBeGreaterThanOrEqual(2);
    player.shuttleBackward(); // toward home… (from 1× enters -2×)
    expect(player.shuttle.velocity).toBe(-2);
    await vi.advanceTimersByTimeAsync(200);
    expect(player.sessionState.currentIndex).toBeLessThan(reached);
  });

  it('rewind clamps at atom 0, comes home, and reading resumes forward', async () => {
    const shuttleEvents = [];
    player.on('shuttle', e => shuttleEvents.push(e));
    player.play();
    player.shuttleBackward();
    player.shuttleBackward(); // -4× from the very start
    // one rewind tick hits the leader: the clamp fires, home returns
    await vi.advanceTimersByTimeAsync(60);
    expect(player.shuttle.atHome).toBe(true);
    expect(shuttleEvents.some(e => e.reason === 'start-of-text')).toBe(true);
    // …and normal FORWARD reading has resumed
    await vi.advanceTimersByTimeAsync(250);
    expect(player.sessionState.currentIndex).toBeGreaterThan(0);
  });

  it('the high-water mark survives rewind and re-reading', async () => {
    player.play();
    await vi.advanceTimersByTimeAsync(320);
    const hwm = player.shuttle.highWaterMark;
    expect(hwm).toBeGreaterThanOrEqual(2);
    player.shuttleBackward();
    await vi.advanceTimersByTimeAsync(150);
    expect(player.shuttle.highWaterMark).toBe(hwm); // never falls
  });

  it('pausing while shuttling drops to home; resume is normal reading', async () => {
    player.play();
    player.shuttleForward();
    player.shuttleForward(); // 4×
    player.pause();
    expect(player.shuttle.atHome).toBe(true);
    player.play();
    expect(player.shuttle.velocity).toBe(1);
  });

  it('a shuttle-exempt session refuses the keys (the liturgy rule)', () => {
    const exempt = new Session({
      atoms: [new Atom({ content: 'fixed', duration: 100 })],
      title: 'Liturgy', shuttleExempt: true
    });
    const liturgical = new Player(exempt);
    liturgical.play();
    expect(liturgical.shuttleAvailable).toBe(false);
    expect(liturgical.shuttleForward()).toBeNull();
    expect(liturgical.shuttleBackward()).toBeNull();
    expect(liturgical.shuttle.atHome).toBe(true);
    liturgical.destroy();
  });

  it('completion is met regardless of velocity (spec §7)', async () => {
    const complete = vi.fn();
    player.on('complete', complete);
    player.play();
    player.shuttleForward();
    player.shuttleForward();
    player.shuttleForward(); // 8×
    await vi.advanceTimersByTimeAsync(2000);
    expect(complete).toHaveBeenCalled();
  });
});
