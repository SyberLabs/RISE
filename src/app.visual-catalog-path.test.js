// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app.js';

let app;

function plantShell() {
  for (const id of ['view-make', 'view-portal', 'view-live', 'toast-container']) {
    const node = document.createElement('div');
    node.id = id;
    node.hidden = true;
    document.body.append(node);
  }
}

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  });
  plantShell();
});

afterEach(() => {
  app?.destroy?.();
  app = null;
  window.history.replaceState({}, '', '/');
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the Visual Catalog public path, a tab of Make', () => {
  it('opens directly on a cold boot and reads its search from the address', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=network');
    app = new App();
    await app.initializeApp({});
    expect(app.router.getCurrentView()).toBe('make');
    expect(document.querySelector('#visual-catalog-search').value).toBe('network');
    expect(document.querySelectorAll('[data-visual-id]')).toHaveLength(1);
  });

  it('updates the reused catalog view when history changes its search query', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=network');
    app = new App();
    await app.initializeApp({});
    expect(document.querySelector('#visual-catalog-search').value).toBe('network');
    window.history.pushState({}, '', '/visual-catalog?q=atmosphere');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => {
      expect(document.querySelector('#visual-catalog-search').value).toBe('atmosphere');
      expect([...document.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['turrell']);
    });
  });

  it('applies the newest query when history changes before cold catalog initialization settles', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=klee');
    let releaseInit;
    const gate = new Promise(resolve => { releaseInit = resolve; });
    const registerViews = App.prototype.registerViews;
    vi.spyOn(App.prototype, 'registerViews').mockImplementation(function (...args) {
      const result = registerViews.apply(this, args);
      const route = this.router.views.get('make');
      const init = route.init;
      route.init = async (...initArgs) => {
        await gate;
        return init(...initArgs);
      };
      return result;
    });
    app = new App();

    const opening = app.initializeApp({});
    await vi.waitFor(() => expect(app.router?.transitioning).toBe(true));

    window.history.pushState({}, '', '/visual-catalog?q=attractor');
    window.dispatchEvent(new PopStateEvent('popstate'));
    releaseInit();

    await opening;
    await vi.waitFor(() => {
      expect(app.router.getCurrentView()).toBe('make');
      expect(app.router.transitioning).toBe(false);
      expect(document.querySelector('#visual-catalog-search').value).toBe('attractor');
      expect([...document.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['ostensoria', 'attractor']);
    });
  });

  it('handles same-path history changes while a cold catalog route is entering', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=klee');
    app = new App();
    const opening = app.initializeApp({});
    await vi.waitFor(() => expect(document.querySelector('#visual-catalog-search')).not.toBeNull());
    expect(document.querySelector('#visual-catalog-search').value).toBe('klee');

    window.history.pushState({}, '', '/visual-catalog?q=attractor');
    window.history.pushState({}, '', '/visual-catalog?q=turrell');
    window.history.back();
    await vi.waitFor(() => expect(window.location.search).toBe('?q=attractor'));
    await vi.waitFor(() => {
      expect(document.querySelector('#visual-catalog-search').value).toBe('attractor');
      expect([...document.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['ostensoria', 'attractor']);
    });
    await opening;
  });

  it('queues a catalog Back destination received while leaving for the Portal', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=klee');
    app = new App();
    await app.initializeApp({});

    let releaseFadeOut;
    let announceFadeOut;
    let holdFirstFadeOut = true;
    const fadeOutStarted = new Promise(resolve => { announceFadeOut = resolve; });
    vi.spyOn(app.router, 'fadeOut').mockImplementation(() => {
      if (!holdFirstFadeOut) return Promise.resolve();
      holdFirstFadeOut = false;
      return new Promise(resolve => {
        releaseFadeOut = resolve;
        announceFadeOut();
      });
    });

    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await fadeOutStarted;
    expect(app.router.getCurrentView()).toBe('make');

    window.history.pushState({}, '', '/visual-catalog?q=attractor');
    window.dispatchEvent(new PopStateEvent('popstate'));

    releaseFadeOut();
    await vi.waitFor(() => expect(document.querySelector('#view-portal').hidden).toBe(false));
    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/visual-catalog');
      expect(window.location.search).toBe('?q=attractor');
      expect(app.router.getCurrentView()).toBe('make');
      expect(app.router.transitioning).toBe(false);
      expect(document.querySelector('#view-make').hidden).toBe(false);
      expect(document.querySelector('#view-portal').hidden).toBe(true);
      expect([...document.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['ostensoria', 'attractor']);
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('#visual-catalog-search').value).toBe('attractor');
  });
});
