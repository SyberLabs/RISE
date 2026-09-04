import { afterEach, describe, expect, it, vi } from 'vitest';
import { Library } from './Library.js';
import { Vault } from './Vault.js';
import { Settings } from './Settings.js';

const mounted = [];

afterEach(() => {
  mounted.splice(0).forEach(({ room, container }) => {
    room.destroy?.();
    container.remove();
  });
  vi.restoreAllMocks();
});

function mount(Room, options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const room = new Room(container, options);
  mounted.push({ room, container });
  return { room, container };
}

describe('shell room ownership', () => {
  it.each([
    ['Library', Library],
    ['Vault', Vault]
  ])('%s asks its owner for interaction audio', (_name, Room) => {
    const audio = { playClick: vi.fn() };
    const { container } = mount(Room, { getAudioEngine: () => audio });

    container.querySelector('[data-action="back"]').click();

    expect(audio.playClick).toHaveBeenCalledOnce();
  });

  it('Settings reports through its owner', () => {
    const notify = vi.fn();
    const { room } = mount(Settings, { notify });

    room.showToast('Data exported successfully');

    expect(notify).toHaveBeenCalledWith('Data exported successfully');
  });
});
