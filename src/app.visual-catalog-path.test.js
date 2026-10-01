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

  it('updates the reused catalog view when history changes its search query', async () => {
    window.history.replaceState({}, '', '/visual-catalog?q=network');
    app = new App();
    await app.checkBetaAccess();
    expect(document.querySelector('#visual-catalog-search').value).toBe('network');
    window.history.pushState({}, '', '/visual-catalog?q=atmosphere');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => {
      expect(document.querySelector('#visual-catalog-search').value).toBe('atmosphere');
      expect([...document.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['turrell']);
    });
  });
});
