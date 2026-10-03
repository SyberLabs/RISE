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
  // The Library as the router sees it: a room whose panes change in place.
  const registerLibrary = (container = 'a') => {
    const library = { showPane: vi.fn(), update: vi.fn() };
    router.registerView('library', { container: document.querySelector(`#${container}`), init: () => library });
    return library;
  };

  beforeEach(() => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    window.history.replaceState({}, '', '/');
    history = { pushState: vi.fn(), replaceState: vi.fn() };
    router = new Router({ history });
    router.transitionDuration = 0;
  });

  it('pushes the route address once the view is active', async () => {
    registerLibrary();
    await router.navigate('library');
    expect(history.pushState).toHaveBeenCalledWith({ id: 'library', data: {} }, '', '/library');
    router.destroy();
  });

  it('reaches a Library pane through its old id, in place, with an address', async () => {
    const library = registerLibrary();
    await router.navigate('library');
    expect(await router.navigate('chapel', { data: { bookId: 'genesis', chapter: 1 } })).toBe(true);
    expect(router.currentView).toBe('library');
    expect(router.currentData).toEqual({ bookId: 'genesis', chapter: 1, pane: 'chapel' });
    expect(library.update).toHaveBeenLastCalledWith({ bookId: 'genesis', chapter: 1, pane: 'chapel' });
    expect(history.pushState).toHaveBeenLastCalledWith(
      { id: 'library', data: { bookId: 'genesis', chapter: 1, pane: 'chapel' } }, '', '/library/chapel/genesis/1'
    );
    expect(router.viewStack).toEqual([{ viewName: 'library', data: undefined }]);
    // The same pane with the same data is no move at all.
    await router.navigate('chapel', { data: { bookId: 'genesis', chapter: 1 } });
    expect(library.update).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('opens a pane when the Library is entered through an old id', async () => {
    register('portal', 'b');
    registerLibrary();
    await router.navigate('portal');
    await router.navigate('rosarium', { data: { door: true } });
    expect(router.currentView).toBe('library');
    expect(router.currentData).toEqual({ door: true, pane: 'rosary' });
    await router.navigate('today');
    expect(router.currentData).toEqual({ pane: 'today' });
    expect(history.pushState).toHaveBeenLastCalledWith({ id: 'library', data: { pane: 'today' } }, '', '/today');
    router.destroy();
  });

  it('writes the address when the move begins, before a slow room has finished initialising', async () => {
    register('portal', 'b');
    let finish;
    router.registerView('library', {
      container: document.querySelector('#a'),
      init: () => new Promise(resolve => { finish = () => resolve({}); })
    });
    await router.navigate('portal');
    const moving = router.navigate('library');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(history.pushState).toHaveBeenLastCalledWith({ id: 'library', data: {} }, '', '/library');
    finish();
    expect(await moving).toBe(true);
    expect(history.pushState).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('puts the address back where the reader is when a room fails to open', async () => {
    window.history.replaceState({}, '', '/settings');
    const location = { pathname: '/settings', search: '', hash: '' };
    history.pushState.mockImplementation((_s, _t, url) => { location.pathname = url; });
    history.replaceState.mockImplementation((_s, _t, url) => { location.pathname = url; });
    router.destroy();
    router = new Router({ history, location });
    router.transitionDuration = 0;
    register('settings', 'b');
    router.registerView('library', {
      container: document.querySelector('#a'),
      init: async () => { throw new Error('room broke'); }
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await router.navigate('settings');
    expect(await router.navigate('library')).toBe(false);
    expect(history.pushState).toHaveBeenLastCalledWith({ id: 'library', data: {} }, '', '/library');
    expect(history.replaceState).toHaveBeenLastCalledWith({ id: 'settings', data: {} }, '', '/settings');
    expect(router.currentView).toBe('settings');
    router.destroy();
  });

  it('replaces instead of pushing when asked, and keeps transient data out of state', async () => {
    register('library', 'a');
    register('make', 'b');
    await router.navigate('library', { replace: true });
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    await router.navigate('make', { data: { pane: 'visual-lab', recipe: { atoms: new Array(5000).fill('word') } } });
    expect(history.pushState).toHaveBeenCalledWith({ id: 'make', data: {} }, '', '/visual-lab');
    router.destroy();
  });

  it('does not serialise a session in data into history state, and hands the room the session itself', async () => {
    register('library', 'a');
    let received;
    router.registerView('read', {
      container: document.querySelector('#b'),
      init: (_container, data) => { received = data; return {}; }
    });
    await router.navigate('library', { replace: true });
    const session = { atoms: ['a', 'small', 'reading'], publicPath: '/keystone/meditations' };
    await router.navigate('chamber-session', { data: session });
    expect(received.session).toBe(session);
    expect(received.pane).toBe('chamber');
    expect(history.pushState).toHaveBeenLastCalledWith(
      { id: 'read', data: { pane: 'chamber' } }, '', '/keystone/meditations'
    );
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

  it('rewrites a Keystone reading address to the threshold when leaving the reading', async () => {
    window.history.replaceState({}, '', '/keystone/meditations');
    registerLibrary();
    await router.navigate('keystones', { data: { slug: 'meditations' }, replaceUrl: true });
    expect(history.replaceState).toHaveBeenCalledWith(
      { id: 'library', data: { slug: 'meditations', pane: 'keystones' } }, '', '/try-rise'
    );
    router.destroy();
  });

  it('leaves the address alone while a hash door is open, and for keepUrl', async () => {
    window.history.replaceState({}, '', '/#rosary');
    register('library', 'a');
    register('settings', 'b');
    await router.navigate('library');
    expect(history.pushState).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/');
    await router.navigate('settings', { keepUrl: true });
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

describe('Router back and updateAddress', () => {
  it('goes back with the previous data, rewriting the address and adding no entry', async () => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    window.history.replaceState({}, '', '/');
    const history = { pushState: vi.fn(), replaceState: vi.fn() };
    const location = { pathname: '/', search: '', hash: '' };
    history.pushState.mockImplementation((_s, _t, url) => { location.pathname = url; });
    history.replaceState.mockImplementation((_s, _t, url) => { location.pathname = url; });
    const router = new Router({ history, location });
    router.transitionDuration = 0;
    router.registerView('library', {
      container: document.querySelector('#a'), init: () => ({ showPane: vi.fn(), update: vi.fn() })
    });
    await router.navigate('library');
    await router.navigate('chapel', { data: { bookId: 'genesis', chapter: 1 } });
    expect(history.pushState).toHaveBeenCalledTimes(2);
    await router.back();
    expect(router.currentView).toBe('library');
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.replaceState).toHaveBeenLastCalledWith({ id: 'library', data: {} }, '', '/library');
    router.destroy();
  });

  it('goes back from one pane to the previous pane with its data, in place', async () => {
    document.body.innerHTML = '<main id="a"></main>';
    window.history.replaceState({}, '', '/');
    const history = { pushState: vi.fn(), replaceState: vi.fn() };
    const router = new Router({ history });
    router.transitionDuration = 0;
    const library = { showPane: vi.fn(), update: vi.fn() };
    router.registerView('library', { container: document.querySelector('#a'), init: () => library });
    await router.navigate('chapel', { data: { bookId: 'genesis', chapter: 1 } });
    await router.navigate('via');
    expect(library.update).toHaveBeenLastCalledWith({ pane: 'stations' });
    await router.back();
    expect(router.currentView).toBe('library');
    expect(library.update).toHaveBeenLastCalledWith({ bookId: 'genesis', chapter: 1, pane: 'chapel' });
    router.destroy();
  });

  it('updates a pane-hosting room in place, and leaves a room with only update alone', async () => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    window.history.replaceState({}, '', '/');
    const history = { pushState: vi.fn(), replaceState: vi.fn() };
    const router = new Router({ history });
    router.transitionDuration = 0;
    const plain = [];
    router.registerView('portal', {
      container: document.querySelector('#b'),
      init: () => { const room = { update: vi.fn(), destroy: vi.fn() }; plain.push(room); return room; }
    });
    const make = { showPane: vi.fn(), update: vi.fn() };
    router.registerView('make', { container: document.querySelector('#a'), init: () => make });

    await router.navigate('portal');
    expect(await router.navigate('portal', { data: { demoMode: true } })).toBe(true);
    expect(plain).toHaveLength(1);
    expect(plain[0].update).not.toHaveBeenCalled();
    expect(plain[0].destroy).not.toHaveBeenCalled();

    await router.navigate('workshop');
    await router.navigate('vault');
    expect(make.update).toHaveBeenLastCalledWith({ pane: 'vault' });
    router.destroy();
  });

  it('rewrites the address in place when the view data changes', async () => {
    document.body.innerHTML = '<main id="a"></main>';
    window.history.replaceState({}, '', '/');
    const history = { pushState: vi.fn(), replaceState: vi.fn() };
    const router = new Router({ history });
    router.transitionDuration = 0;
    router.registerView('library', { container: document.querySelector('#a'), init: () => ({}) });
    await router.navigate('chapel');
    router.updateAddress({ pane: 'chapel', bookId: 'john', chapter: 3 });
    expect(history.replaceState).toHaveBeenLastCalledWith(
      { id: 'library', data: { pane: 'chapel', bookId: 'john', chapter: 3 } }, '', '/library/chapel/john/3'
    );
    router.destroy();
  });
});
