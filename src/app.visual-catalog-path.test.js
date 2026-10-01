// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app.js';

let app;

function plantShell() {
  for (const id of ['view-visual-catalog', 'view-portal', 'view-live', 'toast-container']) {
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
  localStorage.setItem('rise-beta-session', JSON.stringify({ code: 'open', name: 'Reader', vault: null, timestamp: Date.now() }));
});

afterEach(() => {
  app?.destroy?.();
  app = null;
  window.history.replaceState({}, '', '/');
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the Visual Catalog public path', () => {
  it('opens directly on a cold boot and reads its search from the address', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=network');
    app = new App();
    await app.checkBetaAccess();
    expect(app.router.getCurrentView()).toBe('visual-catalog');
    expect(document.querySelector('#visual-catalog-search').value).toBe('network');
    expect(document.querySelectorAll('[data-visual-id]')).toHaveLength(1);
  });

  it('resolves a browser history visit to the catalog path with its current query', async () => {
    window.history.replaceState({}, '', '/');
    app = new App();
    await app.checkBetaAccess();
    const navigate = vi.spyOn(app.router, 'navigate');
    window.history.pushState({}, '', '/visual-catalog?q=light');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('visual-catalog', {
      data: { search: '?q=light' }, replace: true, skipStack: true
    }));
  });
});
