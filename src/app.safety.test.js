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
    localStorage.clear();
    document.documentElement.classList.remove('photosensitivity-mode', 'reduced-motion');
    delete document.documentElement.dataset.chamberFace;
    delete document.documentElement.dataset.fontSize;
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

  it('defaults artwork labels on, restores an explicit opt-out, and propagates it live', () => {
    const app = new App();
    app.loadSettings();
    expect(app.settings.showArtworkLabels).toBe(true);

    localStorage.setItem('rise-settings', JSON.stringify({ showArtworkLabels: false }));
    app.loadSettings();
    expect(app.settings.showArtworkLabels).toBe(false);

    const apply = vi.spyOn(visualCortex, 'setArtworkLabelsVisible');
    app.handleSettingsChange('showArtworkLabels', true);
    expect(apply).toHaveBeenLastCalledWith(true);
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

  it('persists an allowlisted Chamber face on :root like fontSize', () => {
    const app = new App();
    app.loadSettings();
    expect(app.settings.chamberFace).toBe('literary');
    expect(app.settings.fontSize).toBe('medium');

    localStorage.setItem('rise-settings', JSON.stringify({
      fontSize: 'large',
      chamberFace: 'jp'
    }));
    app.loadSettings();
    expect(app.settings.fontSize).toBe('large');
    expect(app.settings.chamberFace).toBe('jp');

    app.applyAccessibilitySettings();
    expect(document.documentElement.dataset.fontSize).toBe('large');
    expect(document.documentElement.dataset.chamberFace).toBe('jp');

    app.handleSettingsChange('chamberFace', 'thick');
    expect(app.settings.chamberFace).toBe('thick');
    expect(JSON.parse(localStorage.getItem('rise-settings')).chamberFace).toBe('thick');
    expect(document.documentElement.dataset.chamberFace).toBe('thick');
  });

  it('coerces an unknown Chamber face to literary on load and change', () => {
    const app = new App();
    localStorage.setItem('rise-settings', JSON.stringify({ chamberFace: 'papyrus' }));
    app.loadSettings();
    expect(app.settings.chamberFace).toBe('literary');

    app.handleSettingsChange('chamberFace', 'Inter');
    expect(app.settings.chamberFace).toBe('literary');
    expect(document.documentElement.dataset.chamberFace).toBe('literary');
  });

  it('persists chamberMask as a boolean and coerces anything else to false', () => {
    const app = new App();
    app.loadSettings();
    expect(app.settings.chamberMask).toBe(false);

    localStorage.setItem('rise-settings', JSON.stringify({ chamberMask: true }));
    app.loadSettings();
    expect(app.settings.chamberMask).toBe(true);

    localStorage.setItem('rise-settings', JSON.stringify({ chamberMask: 'yes' }));
    app.loadSettings();
    expect(app.settings.chamberMask).toBe(false);

    app.handleSettingsChange('chamberMask', true);
    expect(app.settings.chamberMask).toBe(true);
    expect(JSON.parse(localStorage.getItem('rise-settings')).chamberMask).toBe(true);

    app.handleSettingsChange('chamberMask', 'yes');
    expect(app.settings.chamberMask).toBe(false);
    expect(JSON.parse(localStorage.getItem('rise-settings')).chamberMask).toBe(false);
  });
});
