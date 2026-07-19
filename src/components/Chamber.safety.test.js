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
    on: vi.fn(),
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
  vi.restoreAllMocks();
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
