import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from './router.js';

describe('Router failure containment', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    router = new Router();
    router.transitionDuration = 0;
  });

  it('releases the transition lock and restores the active view after failure', async () => {
    const active = { activate: vi.fn(), deactivate: vi.fn() };
    router.registerView('a', { container: document.querySelector('#a'), init: () => active });
    router.registerView('b', {
      container: document.querySelector('#b'),
      init: () => { throw new Error('initialization failed'); }
    });

    expect(await router.navigate('a')).toBe(true);
    expect(await router.navigate('b')).toBe(false);

    expect(router.transitioning).toBe(false);
    expect(router.currentView).toBe('a');
    expect(document.querySelector('#a').hidden).toBe(false);
    expect(active.deactivate).toHaveBeenCalled();
    expect(active.activate).toHaveBeenCalledTimes(2);
    router.destroy();
  });
});
