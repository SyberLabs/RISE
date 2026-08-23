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
    delete document.documentElement.dataset.accent;
  });

  it('cancels a live presentation synchronously when Photosensitivity Mode turns on', async () => {
    const cancel = vi.spyOn(visualCortex, 'cancelPresentation').mockReturnValue(true);
    const app = new App();
    // The cortex is loaded on demand, so a live presentation only exists
    // once something has asked for one. This is that state.
    await app.ensureVisualCortex();
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

  /**
   * The cortex is 179 KB of engines that a reader who never opens a reading
   * never downloads. Deferring it must not make the safety surfaces throw,
   * and must not quietly make them asynchronous: a cortex that was never
   * loaded is a cortex showing nothing, so there is nothing to cancel.
   */
  it('applies the safety surfaces before the cortex has ever been loaded', () => {
    const app = new App();
    app.settings = {
      photosensitivityMode: true,
      reducedMotion: true,
      fontSize: 'large',
      chamberFace: 'jp',
      showProgress: false,
      showDuration: false,
      showArtworkLabels: false
    };

    expect(() => app.applyAccessibilitySettings()).not.toThrow();
    expect(document.documentElement.classList.contains('photosensitivity-mode')).toBe(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
    expect(document.documentElement.dataset.fontSize).toBe('large');

    expect(() => app.handleSettingsChange('showArtworkLabels', true)).not.toThrow();
    expect(app.settings.showArtworkLabels).toBe(true);
  });

  it('defaults artwork labels on, restores an explicit opt-out, and propagates it live', async () => {
    const app = new App();
    app.loadSettings();
    expect(app.settings.showArtworkLabels).toBe(true);

    localStorage.setItem('rise-settings', JSON.stringify({ showArtworkLabels: false }));
    app.loadSettings();
    expect(app.settings.showArtworkLabels).toBe(false);

    await app.ensureVisualCortex();
    const apply = vi.spyOn(visualCortex, 'setArtworkLabelsVisible');
    app.handleSettingsChange('showArtworkLabels', true);
    expect(apply).toHaveBeenLastCalledWith(true);
  });

  it('resolves one cortex and one audio engine however many callers ask', async () => {
    const app = new App();
    const [cortexA, cortexB] = await Promise.all([
      app.ensureVisualCortex(),
      app.ensureVisualCortex()
    ]);
    expect(cortexA).toBe(visualCortex);
    expect(cortexB).toBe(visualCortex);

    const [engineA, engineB] = await Promise.all([
      app.ensureAudioEngine(),
      app.ensureAudioEngine()
    ]);
    expect(engineA).toBe(engineB);
    expect(app.audioEngine).toBe(engineA);
  });

  /**
   * Arming the first-interaction listener must not itself be what pulls
   * the 87 KB engine in. The engine arrives on the interaction, which is
   * the earliest moment a reader can want a sound.
   */
  it('arms the audio listener without constructing an engine', async () => {
    const app = new App();
    app.setupAudioInteraction();
    expect(app.audioEngine).toBe(null);

    window.dispatchEvent(new window.MouseEvent('mousedown'));
    await vi.waitFor(() => expect(app.audioEngine).not.toBe(null));
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

  it('pushes a live Chamber face or mask change onto the open session', () => {
    const app = new App();
    app.loadSettings();
    const applyChamberStreamFace = vi.fn();
    const applyChamberMask = vi.fn();
    app.router = {
      getViewInstance: (name) => name === 'chamber-session'
        ? { applyChamberStreamFace, applyChamberMask }
        : null
    };

    app.handleSettingsChange('chamberFace', 'jp');
    expect(applyChamberStreamFace).toHaveBeenCalled();
    expect(applyChamberMask).toHaveBeenCalled();

    app.handleSettingsChange('chamberMask', true);
    expect(applyChamberMask).toHaveBeenCalledTimes(2);
  });

  it('allowlists fontSize and pushes a live size change onto the open Chamber', () => {
    const app = new App();
    app.loadSettings();
    const applyChamberStreamFace = vi.fn();
    const applyChamberMask = vi.fn();
    const applyChamberTypeSize = vi.fn();
    app.router = {
      getViewInstance: (name) => name === 'chamber-session'
        ? { applyChamberStreamFace, applyChamberMask, applyChamberTypeSize }
        : null
    };

    app.handleSettingsChange('fontSize', 'large');
    expect(app.settings.fontSize).toBe('large');
    expect(JSON.parse(localStorage.getItem('rise-settings')).fontSize).toBe('large');
    expect(document.documentElement.dataset.fontSize).toBe('large');
    expect(applyChamberTypeSize).toHaveBeenCalled();

    app.handleSettingsChange('fontSize', 'fit');
    expect(app.settings.fontSize).toBe('fit');
    expect(JSON.parse(localStorage.getItem('rise-settings')).fontSize).toBe('fit');
    expect(document.documentElement.dataset.fontSize).toBe('fit');

    app.handleSettingsChange('fontSize', 'huge');
    expect(app.settings.fontSize).toBe('medium');
    expect(applyChamberTypeSize).toHaveBeenCalledTimes(3);
  });

  it('persists an allowlisted Chamber accent on :root with chamberFace and fontSize', () => {
    const app = new App();
    app.loadSettings();
    expect(app.settings.chamberAccent).toBe('ivory');
    expect(app.settings.chamberFace).toBe('literary');
    expect(app.settings.fontSize).toBe('medium');

    localStorage.setItem('rise-settings', JSON.stringify({
      fontSize: 'large',
      chamberFace: 'jp',
      chamberAccent: 'sunset'
    }));
    app.loadSettings();
    expect(app.settings.fontSize).toBe('large');
    expect(app.settings.chamberFace).toBe('jp');
    expect(app.settings.chamberAccent).toBe('sunset');

    app.applyAccessibilitySettings();
    expect(document.documentElement.dataset.fontSize).toBe('large');
    expect(document.documentElement.dataset.chamberFace).toBe('jp');
    expect(document.documentElement.dataset.accent).toBe('sunset');

    app.handleSettingsChange('chamberAccent', 'gecko');
    expect(app.settings.chamberAccent).toBe('gecko');
    expect(JSON.parse(localStorage.getItem('rise-settings')).chamberAccent).toBe('gecko');
    expect(JSON.parse(localStorage.getItem('rise-settings')).chamberFace).toBe('jp');
    expect(JSON.parse(localStorage.getItem('rise-settings')).fontSize).toBe('large');
    expect(document.documentElement.dataset.accent).toBe('gecko');
  });

  it('coerces an unknown Chamber accent to ivory on load and change', () => {
    const app = new App();
    localStorage.setItem('rise-settings', JSON.stringify({ chamberAccent: 'violet' }));
    app.loadSettings();
    expect(app.settings.chamberAccent).toBe('ivory');

    app.handleSettingsChange('chamberAccent', 'chartreuse');
    expect(app.settings.chamberAccent).toBe('ivory');
    expect(document.documentElement.dataset.accent).toBe('ivory');
  });
});

