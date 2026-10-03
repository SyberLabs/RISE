import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from './router.js';
import { ROUTE_ALIASES } from './route-url.js';

describe('Router addresses', () => {
  let router;
  let history;

  const register = (name, container = name) => router.registerView(name, {
    container: document.querySelector(`#${container}`),
    init: () => ({})
  });

  beforeEach(() => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    window.history.replaceState({}, '', '/');
    history = { pushState: vi.fn(), replaceState: vi.fn() };
    router = new Router({ history });
    router.transitionDuration = 0;
  });

  it('pushes the route address once the view is active', async () => {
    register('library', 'a');
    register('chapel', 'b');
    await router.navigate('library');
    expect(history.pushState).toHaveBeenCalledWith({ id: 'library', data: {} }, '', '/library');
    await router.navigate('chapel', { data: { bookId: 'genesis', chapter: 1 } });
    expect(history.pushState).toHaveBeenLastCalledWith(
      { id: 'chapel', data: { bookId: 'genesis', chapter: 1 } }, '', '/library/chapel/genesis/1'
    );
    router.destroy();
  });

  it('replaces instead of pushing when asked, and keeps transient data out of state', async () => {
    register('library', 'a');
    register('chamber-session', 'b');
    await router.navigate('library', { replace: true });
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    await router.navigate('chamber-session', { data: { atoms: new Array(5000).fill('word') } });
    expect(history.pushState).toHaveBeenCalledWith({ id: 'chamber-session', data: {} }, '', '/read/session');
    router.destroy();
  });

  it('does not touch history when the address already matches or the id has none', async () => {
    window.history.replaceState({}, '', '/library');
    register('library', 'a');
    register('nowhere', 'b');
    await router.navigate('library');
    await router.navigate('nowhere');
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
    router.destroy();
  });

  it('does not rewrite an address that already names the same room', async () => {
    window.history.replaceState({}, '', '/night-drive');
    register('portal', 'a');
    await router.navigate('portal');
    expect(history.pushState).not.toHaveBeenCalled();
    router.destroy();
  });

  it('leaves the address alone while a hash door is open, and for keepUrl', async () => {
    window.history.replaceState({}, '', '/#rosary');
    register('library', 'a');
    register('via', 'b');
    await router.navigate('library');
    expect(history.pushState).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/');
    await router.navigate('via', { keepUrl: true });
    expect(history.pushState).not.toHaveBeenCalled();
    router.destroy();
  });

  it('resolves an old id through the alias table', async () => {
    register('b-room', 'b');
    ROUTE_ALIASES['old-room'] = 'b-room';
    try {
      expect(await router.navigate('old-room')).toBe(true);
      expect(router.currentView).toBe('b-room');
    } finally {
      delete ROUTE_ALIASES['old-room'];
      router.destroy();
    }
  });
});
