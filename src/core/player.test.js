/**
 * R.I.S.E. Player Engine Test Suite
 * Tests for playback control and event emission
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Player } from './player.js';
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

      await player.processNextNode();

      expect(handler).not.toHaveBeenCalled();
    });

    it('forwards zero duration and the responsive semantic signal', async () => {
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

      await player.processNextNode();

      expect(handler).toHaveBeenCalledWith(0, signal);
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
