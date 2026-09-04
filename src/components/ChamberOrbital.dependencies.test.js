import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/personal-swells.js', () => ({
  PersonalSwells: {
    getAll: vi.fn().mockResolvedValue([]),
    removeSwell: vi.fn().mockResolvedValue(undefined),
    addSwell: vi.fn().mockResolvedValue(undefined)
  }
}));

import { ChamberOrbital } from './ChamberOrbital.js';

const orbitals = [];

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const orbital = new ChamberOrbital(container, options);
  orbitals.push(orbital);
  return orbital;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  orbitals.splice(0).forEach(orbital => orbital.destroy());
});

describe('ChamberOrbital host capabilities', () => {
  it('sends text-material settings through the injected transaction', () => {
    const onSettingsTransaction = vi.fn();
    const orbital = mount({ onSettingsTransaction });

    orbital.applyTextMaterialTransaction({
      settings: { chamberFace: 'thick' },
      visualConfig: orbital.config.visualInterlocution
    });

    expect(onSettingsTransaction).toHaveBeenCalledWith({ chamberFace: 'thick' });
  });

  it('uses the injected audio engine for shell feedback', () => {
    const audioEngine = { playClick: vi.fn() };
    const orbital = mount({ getAudioEngine: () => audioEngine });

    orbital.container.querySelector('[data-action="back"]').click();

    expect(audioEngine.playClick).toHaveBeenCalledOnce();
  });

  it('reports a reset through the injected notifier', () => {
    const notify = vi.fn();
    const orbital = mount({ notify });

    orbital.resetPrefs();

    expect(notify).toHaveBeenCalledWith('Settings restored to defaults');
  });
});
