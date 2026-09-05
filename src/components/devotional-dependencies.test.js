import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chapel } from './Chapel.js';
import { Rosarium } from './Rosarium.js';
import { Via } from './Via.js';

const mounted = [];

afterEach(() => {
  mounted.splice(0).forEach(({ room, container }) => {
    room.destroy?.();
    container.remove();
  });
  localStorage.clear();
  vi.restoreAllMocks();
});

function mount(Room, options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const room = new Room(container, options);
  mounted.push({ room, container });
  return { room, container };
}

describe('devotional room ownership', () => {
  it('Chapel asks its owner for interaction audio', () => {
    const audio = { playClick: vi.fn() };
    const { container } = mount(Chapel, { getAudioEngine: () => audio });

    container.querySelector('[data-action="back"]').click();

    expect(audio.playClick).toHaveBeenCalledOnce();
  });

  it.each([
    ['Rosarium', Rosarium],
    ['Via', Via]
  ])('%s asks its owner for interaction audio', (_name, Room) => {
    const audio = { playClick: vi.fn() };
    const { container } = mount(Room, { getAudioEngine: () => audio });

    container.querySelector('button').click();

    expect(audio.playClick).toHaveBeenCalledOnce();
  });
});
