/**
 * Install the intentionally small browser-test control surface.
 * Production builds call this with enabled=false and expose nothing.
 */
export function installTestBridge(app, windowObject, { enabled = false } = {}) {
  if (!enabled) {
    delete windowObject.__RISE_TEST__;
    return null;
  }

  const bridge = Object.freeze({
    navigate: (view, data) => app.router.navigate(view, { data }),
    getRouterState: () => ({
      currentView: app.router?.currentView ?? null,
      transitioning: app.router?.transitioning ?? false
    }),
    getView: id => app.router?.getViewInstance(id) ?? null,
    getCurrentSession: () => app.currentSession,
    getSettings: () => app.settings,
    getAudioEngine: () => app.audioEngine,
    ensureVisualCortex: () => app.ensureVisualCortex()
  });

  windowObject.__RISE_TEST__ = bridge;
  return bridge;
}
