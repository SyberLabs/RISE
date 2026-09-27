import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

function mount(firstReadPreview = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const player = {
    state: 'playing',
    pause: vi.fn(() => { player.state = 'paused'; }),
    play: vi.fn(() => { player.state = 'playing'; }),
    stop: vi.fn(),
    on: vi.fn(),
    setInterlocutionHandler: vi.fn()
  };
  const chamber = new Chamber(container, {
    session: {
      title: 'Meditations',
      atoms: [{ content: 'A thought', duration: 60000 }],
      totalDuration: 60000,
      atomCount: 1,
      visualConfig: { visualMode: 'off' },
      firstReadPreview
    },
    player
  });
  return { chamber, container, player, choice: container.querySelector('#first-read-choice') };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('first-read choice', () => {
  it('appears once at thirty seconds of active reading and Continue dismisses it', () => {
    const { chamber, container, player, choice } = mount();
    chamber.updateProgress({ elapsed: 29999 });
    expect(choice.hidden).toBe(true);
    chamber.updateProgress({ elapsed: 30000 });
    expect(choice.hidden).toBe(false);
    expect(container.querySelector('#play-pause-btn')).toBeTruthy();
    container.querySelector('#first-read-continue').click();
    expect(choice.hidden).toBe(true);
    chamber.updateProgress({ elapsed: 40000 });
    expect(choice.hidden).toBe(true);
    expect(player.state).toBe('playing');
    chamber.destroy();
  });

  it('never appears in an ordinary session', () => {
    const { chamber, choice } = mount(false);
    chamber.updateProgress({ elapsed: 30000 });
    expect(choice?.hidden ?? true).toBe(true);
    chamber.destroy();
  });

  it('opens the existing Page projection and stays hidden on later progress', () => {
    const { chamber, container, choice } = mount();
    chamber.updateProgress({ elapsed: 30000 });
    container.querySelector('#first-read-page').click();
    expect(chamber.pageModeActive).toBe(true);
    expect(choice.hidden).toBe(true);
    chamber.updateProgress({ elapsed: 40000 });
    expect(choice.hidden).toBe(true);
    chamber.destroy();
  });

  it('uses transport for Pause', () => {
    const { chamber, container, player, choice } = mount();
    chamber.updateProgress({ elapsed: 30000 });
    container.querySelector('#first-read-pause').click();
    expect(player.state).toBe('paused');
    expect(choice.hidden).toBe(true);
    chamber.destroy();
  });

  it('stays absent if Page opened before the milestone', () => {
    const { chamber, choice } = mount();
    void chamber.togglePageMode(true);
    chamber.updateProgress({ elapsed: 30000 });
    expect(choice.hidden).toBe(true);
    chamber.destroy();
  });

  it('is removed on completion and destroy, including later progress', () => {
    const completed = mount();
    completed.chamber.updateProgress({ elapsed: 30000 });
    completed.chamber.onSessionComplete();
    expect(completed.choice.hidden).toBe(true);
    completed.chamber.updateProgress({ elapsed: 40000 });
    expect(completed.choice.hidden).toBe(true);
    completed.chamber.destroy();

    const destroyed = mount();
    destroyed.chamber.updateProgress({ elapsed: 30000 });
    destroyed.chamber.destroy();
    expect(destroyed.choice.hidden).toBe(true);
    destroyed.chamber.updateProgress({ elapsed: 40000 });
    expect(destroyed.choice.hidden).toBe(true);
  });
});
