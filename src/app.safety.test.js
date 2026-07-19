import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app.js';
import { visualCortex } from './visuals/visual-cortex.js';

describe('App safety orchestration', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false }))
    });
    document.documentElement.classList.remove('photosensitivity-mode', 'reduced-motion');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('photosensitivity-mode', 'reduced-motion');
  });

  it('cancels a live presentation synchronously when Photosensitivity Mode turns on', () => {
    const cancel = vi.spyOn(visualCortex, 'cancelPresentation').mockReturnValue(true);
    const app = new App();
    app.settings = {
      photosensitivityMode: true,
      reducedMotion: false,
      fontSize: 'medium',
      showProgress: true,
      showDuration: true
    };

    app.applyAccessibilitySettings();

    expect(document.documentElement.classList.contains('photosensitivity-mode')).toBe(true);
    expect(cancel).toHaveBeenCalledWith('photosensitivity');
  });

  it('surfaces aggregate budget failures from orbital and Workshop launches', async () => {
    const app = new App();
    app.showToast = vi.fn();
    const sources = [
      { id: 'a', name: 'A', data: 'a'.repeat(1_000_001) },
      { id: 'b', name: 'B', data: 'b'.repeat(1_000_001) }
    ];

    await app.handleBeginSession({ sources, textSource: 'Oversized orbital session' });
    expect(app.showToast).toHaveBeenLastCalledWith(
      expect.stringMatching(/combined character limit/),
      4000
    );

    app.handleCreateSession({ sources, title: 'Oversized Workshop session' });
    expect(app.showToast).toHaveBeenLastCalledWith(
      expect.stringMatching(/combined character limit/),
      4000
    );
  });
});
