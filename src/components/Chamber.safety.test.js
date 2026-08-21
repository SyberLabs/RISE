import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { visualCortex } from '../visuals/visual-cortex.js';

function rhythmicSession() {
  return {
    title: 'Safety controls',
    atoms: [
      { content: 'First', duration: 500 },
      { content: 'Second', duration: 500 }
    ],
    totalDuration: 1000,
    atomCount: 2,
    wpm: 320,
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        frequency: 1,
        duration: 700,
        procedural: ['turrell'],
        responsive: false
      }
    }
  };
}

function fakePlayer(initialState = 'playing') {
  const player = {
    state: initialState,
    handler: null,
    cancel: null,
    handlers: new Map(),
    on: vi.fn((event, listener) => {
      const listeners = player.handlers.get(event) || [];
      listeners.push(listener);
      player.handlers.set(event, listeners);
    }),
    emit: (event, payload) => {
      for (const listener of player.handlers.get(event) || []) listener(payload);
    },
    play: vi.fn(() => { player.state = 'playing'; }),
    stop: vi.fn(() => { player.state = 'idle'; }),
    setInterlocutionHandler: vi.fn((handler, cancel) => {
      player.handler = handler;
      player.cancel = cancel;
    })
  };
  player.pause = vi.fn(() => {
    const wasInterlocuting = player.state === 'interlocuting';
    player.state = 'paused';
    if (wasInterlocuting) player.cancel?.('paused');
  });
  return player;
}

function mount(player = fakePlayer()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session: rhythmicSession(),
    player,
    autoStart: false
  });
  return { chamber, container, player };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem('unrelated-pref');
  document.body.replaceChildren();
});

describe('Chamber rhythmic visual safety controls', () => {
  it('disables immediately, blocks later opportunities, and can re-enable session-locally', async () => {
    const cancel = vi.spyOn(visualCortex, 'cancelPresentation').mockReturnValue(true);
    localStorage.setItem('unrelated-pref', 'preserved');
    const { chamber, container, player } = mount();
    const button = container.querySelector('#visuals-toggle-btn');

    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    expect(cancel).toHaveBeenCalledWith('user-disabled');
    expect(chamber.session.visualConfig.visualMode).toBe('off');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await expect(player.handler(700, null, {})).resolves.toMatchObject({
      presented: false,
      reason: 'user-disabled'
    });

    button.click();
    expect(chamber.session.visualConfig.visualMode).toBe('interlocution');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('unrelated-pref')).toBe('preserved');

    chamber.destroy();
  });

  it('opening exit confirmation during a visual pauses through the sanctioned cancel path', () => {
    const cancel = vi.spyOn(visualCortex, 'cancelPresentation').mockReturnValue(true);
    const { chamber, container, player } = mount(fakePlayer('interlocuting'));

    chamber.exitSession();

    expect(player.pause).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith('paused');
    expect(container.querySelector('#exit-confirm-overlay').style.display).toBe('flex');

    chamber.destroy();
  });

  it('does not expose the rhythmic kill switch for persistent visual modes', () => {
    const session = rhythmicSession();
    session.visualConfig = { visualMode: 'focals', focals: { type: 'standard' } };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, { session, player: fakePlayer(), autoStart: false });

    expect(container.querySelector('#visuals-toggle-btn')).toBeNull();
    chamber.destroy();
  });
});

describe('Chamber Recitation visual contract', () => {
  function recitationVoice() {
    return {
      speak: vi.fn(() => ({
        durationMs: 1400,
        onsets: [120, 650],
        finished: Promise.resolve({ reason: 'ended' })
      })),
      prepare: vi.fn(() => Promise.resolve(true)),
      prime: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      setDuckingEnabled: vi.fn()
    };
  }

  it('starts narration and the progressive reveal only after a full-frame presence', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const session = rhythmicSession();
    session.recitation = { enabled: true };
    session.revealMode = 'progressive';
    session.atoms[1].content = 'Second phrase';
    session.visualConfig.interlocution.presentation = 'full-frame';
    const player = fakePlayer();
    const voice = recitationVoice();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, {
      session,
      player,
      voice,
      autoStart: false
    });

    player.emit('atom', {
      atom: session.atoms[1],
      index: 1,
      concealed: true
    });

    expect(voice.speak).not.toHaveBeenCalled();
    expect(player.atomDurationOverride(session.atoms[1], 1)).toBeNull();
    const words = [...container.querySelectorAll('#atom-display .atom-word')];
    expect(words).toHaveLength(2);
    expect(words[0].hasAttribute('data-pending')).toBe(true);
    expect(words[1].hasAttribute('data-pending')).toBe(true);

    const completion = player.atomCompletionOverride(session.atoms[1], 1);
    expect(voice.speak).toHaveBeenCalledOnce();
    expect(voice.speak).toHaveBeenCalledWith(1);
    expect(completion).toBeInstanceOf(Promise);
    expect(words[0].hasAttribute('data-pending')).toBe(true);
    vi.advanceTimersByTime(120);
    expect(words[0].hasAttribute('data-pending')).toBe(false);
    expect(words[1].hasAttribute('data-pending')).toBe(true);
    vi.advanceTimersByTime(530);
    expect(words[1].hasAttribute('data-pending')).toBe(false);

    // Completion lookup is idempotent; scheduling cannot start the same WAV twice.
    expect(player.atomCompletionOverride(session.atoms[1], 1)).toBe(completion);
    expect(voice.speak).toHaveBeenCalledOnce();
    chamber.destroy();
  });

  it.each([
    ['full-frame', 'interlocution'],
    ['behind-stream', 'interlocution'],
    ['continuous', 'interlocution'],
    ['full-frame', 'attractor'],
    ['full-frame', 'focals'],
    ['full-frame', 'off']
  ])('never requests automatic ducking for %s/%s', (presentation, visualMode) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    const session = rhythmicSession();
    session.recitation = { enabled: true };
    session.visualConfig.visualMode = visualMode;
    session.visualConfig.interlocution.presentation = presentation;
    const player = fakePlayer();
    const voice = recitationVoice();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, {
      session,
      player,
      voice,
      autoStart: false
    });

    expect(voice.setDuckingEnabled).not.toHaveBeenCalled();
    if (visualMode === 'interlocution') {
      chamber.toggleRhythmicVisuals(false);
      chamber.toggleRhythmicVisuals(true);
      expect(voice.setDuckingEnabled).not.toHaveBeenCalled();
    }
    chamber.destroy();
  });
});

describe('Chamber visual program scheduling (PERICOPE-IMAGERY-SPEC)', () => {
  it('builds the visual scheduler SYNCHRONOUSLY when a program is present', () => {
    // The regression that stranded a Gospel reading on its first
    // episode: an async import() raced auto-start, so the scheduler
    // was null when the first atoms flowed. A synchronous build must
    // make _visualSchedule available the instant the Chamber exists.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const session = {
      title: 'Mt27', atomCount: 1, atoms: [{ content: 'x', duration: 500, chapter: 27, verse: 1 }],
      wpm: 240,
      visualConfig: { visualMode: 'interlocution', interlocution: { frequency: 1, duration: 700, procedural: [], sourced: ['chapel-gospel-before-pilate'] } },
      visualProgram: {
        coordinateSpace: 'scripture', enabled: true,
        segments: [
          { id: 'before-pilate', match: { chapter: 27, verseStart: 1, verseEnd: 25 }, cue: { kind: 'sourced', collections: ['chapel-gospel-before-pilate'] } },
          { id: 'flagellation', match: { chapter: 27, verseStart: 26, verseEnd: 26 }, cue: { kind: 'sourced', collections: ['chapel-gospel-flagellation'] } }
        ],
        fallback: { kind: 'still' }
      }
    };
    const chamber = new Chamber(container, { session, player: fakePlayer(), autoStart: false });
    expect(chamber._visualSchedule).not.toBeNull();
    // and it actually switches the cortex on a boundary-crossing atom
    const applySpy = vi.spyOn(visualCortex, 'applyCue');
    chamber._visualSchedule.observe({ chapter: 27, verse: 26 });
    expect(applySpy).toHaveBeenCalled();
    expect(applySpy.mock.calls[0][0].collections).toEqual(['chapel-gospel-flagellation']);
  });

  it('no scheduler when the session carries no program (plain reading)', () => {
    const { chamber } = mount();
    expect(chamber._visualSchedule).toBeNull();
  });
});
