import { afterEach, describe, expect, it, vi } from 'vitest';
import { installTestBridge } from './test-bridge.js';

describe('installTestBridge', () => {
  afterEach(() => {
    delete window.__RISE_TEST__;
  });

  it('installs only the frozen, named test operations', async () => {
    const chamber = {};
    const cortex = {};
    const app = {
      router: {
        currentView: 'portal',
        transitioning: false,
        navigate: vi.fn(),
        getViewInstance: vi.fn(() => chamber)
      },
      currentSession: { id: 'session' },
      settings: { fontSize: 'large' },
      audioEngine: { id: 'audio' },
      ensureVisualCortex: vi.fn(async () => cortex)
    };

    const bridge = installTestBridge(app, window, { enabled: true });

    expect(Object.isFrozen(bridge)).toBe(true);
    expect(Object.keys(bridge).sort()).toEqual([
      'ensureVisualCortex',
      'getAudioEngine',
      'getCurrentSession',
      'getRouterState',
      'getSettings',
      'getView',
      'navigate'
    ]);
    bridge.navigate('chamber', { text: 'Test' });
    expect(app.router.navigate).toHaveBeenCalledWith('chamber', { data: { text: 'Test' } });
    expect(bridge.getRouterState()).toEqual({ currentView: 'portal', transitioning: false });
    expect(bridge.getView('chamber')).toBe(chamber);
    expect(bridge.getCurrentSession()).toBe(app.currentSession);
    expect(bridge.getSettings()).toBe(app.settings);
    expect(bridge.getAudioEngine()).toBe(app.audioEngine);
    await expect(bridge.ensureVisualCortex()).resolves.toBe(cortex);
  });

  it('removes an existing bridge when disabled', () => {
    window.__RISE_TEST__ = { stale: true };

    expect(installTestBridge({}, window, { enabled: false })).toBeNull();
    expect(window.__RISE_TEST__).toBeUndefined();
  });
});
