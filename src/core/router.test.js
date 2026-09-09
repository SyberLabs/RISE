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

  it('swallows Escape during a transition — no rightful owner yet', async () => {
    const reset = vi.spyOn(Router.prototype, 'reset');
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    await router.navigate('a');

    // Mid-transition: falling through to reset('portal') would strand
    // a just-started session's audio behind the portal
    router.transitioning = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(reset).not.toHaveBeenCalled();

    // Settled: the fallback owns Escape again
    router.transitioning = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(reset).toHaveBeenCalledWith('portal');

    reset.mockRestore();
    router.destroy();
  });

  it('resolves a queued navigation only after that route finishes', async () => {
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: () => ({}) });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    vi.spyOn(router, 'fadeIn')
      .mockImplementationOnce(() => held)
      .mockResolvedValue(undefined);

    const first = router.navigate('a');
    await vi.waitFor(() => expect(router.transitioning).toBe(true));
    const queued = router.navigate('b');
    let queuedSettled = false;
    void queued.then(() => { queuedSettled = true; });
    await Promise.resolve();
    expect(queuedSettled).toBe(false);

    release();
    expect(await first).toBe(true);
    expect(await queued).toBe(true);
    expect(router.currentView).toBe('b');
    router.destroy();
  });

  it('honors a queued forced remount of the route that is currently mounting', async () => {
    const update = vi.fn();
    router.registerView('a', {
      container: document.querySelector('#a'),
      init: () => ({ update })
    });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    vi.spyOn(router, 'fadeIn')
      .mockImplementationOnce(() => held)
      .mockResolvedValue(undefined);

    const first = router.navigate('a', { data: { session: 'first' } });
    await vi.waitFor(() => expect(router.transitioning).toBe(true));
    const forced = router.navigate('a', { force: true, data: { session: 'second' } });
    release();

    expect(await first).toBe(true);
    expect(await forced).toBe(true);
    expect(update).toHaveBeenCalledWith({ session: 'second' });
    router.destroy();
  });

  it('reports navigation failure when the route-change observer throws', async () => {
    router.destroy();
    router = new Router({
      onViewChange: () => { throw new Error('observer failed'); }
    });
    router.transitionDuration = 0;
    router.registerView('a', {
      container: document.querySelector('#a'),
      init: () => ({ deactivate: vi.fn() })
    });

    expect(await router.navigate('a')).toBe(false);
    expect(router.currentView).toBeNull();
    expect(document.querySelector('#a').hidden).toBe(true);
    router.destroy();
  });
});

describe('Router stale-build recovery', () => {
  let reload;

  beforeEach(() => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    sessionStorage.clear();
    reload = vi.fn();
    // jsdom's location.reload is not configurable by assignment
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload }
    });
  });

  const staleError = () => {
    throw new TypeError(
      'Failed to fetch dynamically imported module: https://x/assets/Portal-abc.js');
  };

  it('reloads once to recover a tab left open across a deploy', async () => {
    // The trap: a hashed chunk the new build replaced 404s forever, so
    // every retry fails identically and the reader can never leave the
    // view they are in. A reader in the Vault could not reach the Portal.
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: staleError });

    await router.navigate('a');
    expect(await router.navigate('b')).toBe(false);

    expect(reload).toHaveBeenCalledTimes(1);
    // …and it remembers where the reader was going
    expect(JSON.parse(sessionStorage.getItem('rise_stale_reload')).viewName).toBe('b');
    router.destroy();
  });

  it('never reloads more than once, whatever keeps failing', async () => {
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: staleError });

    await router.navigate('a');
    await router.navigate('b');
    await router.navigate('b');
    await router.navigate('b');

    expect(reload).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('leaves ordinary failures to the existing containment path', async () => {
    // An init that throws for its own reasons is recoverable in-session;
    // reloading would be a violent response to a contained error.
    const router = new Router();
    router.transitionDuration = 0;
    const active = { activate: vi.fn(), deactivate: vi.fn() };
    router.registerView('a', { container: document.querySelector('#a'), init: () => active });
    router.registerView('b', {
      container: document.querySelector('#b'),
      init: () => { throw new Error('initialization failed'); }
    });

    await router.navigate('a');
    expect(await router.navigate('b')).toBe(false);

    expect(reload).not.toHaveBeenCalled();
    expect(router.currentView).toBe('a');
    expect(document.querySelector('#a').hidden).toBe(false);
    router.destroy();
  });

  it('recognizes the browser-specific wordings of a missing chunk', async () => {
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });

    for (const message of [
      'Failed to fetch dynamically imported module: /assets/Vault-x.js',
      'error loading dynamically imported module',
      'Importing a module script failed.'
    ]) {
      sessionStorage.clear();
      reload.mockClear();
      const r = new Router();
      r.transitionDuration = 0;
      r.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
      r.registerView('b', {
        container: document.querySelector('#b'),
        init: () => { throw new TypeError(message); }
      });
      await r.navigate('a');
      await r.navigate('b');
      expect(reload, message).toHaveBeenCalledTimes(1);
      r.destroy();
    }
    router.destroy();
  });
});

describe('Stale-build recovery preserves the destination, not just the view', () => {
  let reload;

  beforeEach(() => {
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload }
    });
  });

  const staleInit = () => {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
  };

  it('carries the route data across the reload', async () => {
    // Recovering the view but losing the selected node drops the reader
    // at a general view instead of the passage they opened.
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: staleInit });

    await router.navigate('a');
    await router.navigate('b', { data: { selectedId: 'hist-bastille', viewMode: 'graph' } });

    const saved = JSON.parse(sessionStorage.getItem('rise_stale_reload'));
    expect(saved.viewName).toBe('b');
    expect(saved.data).toEqual({ selectedId: 'hist-bastille', viewMode: 'graph' });
    router.destroy();
  });

  it('degrades to a plain view recovery rather than losing it', async () => {
    // Unserializable route data must not cost the reader the recovery.
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: staleInit });

    const circular = { name: 'loop' };
    circular.self = circular;

    await router.navigate('a');
    await router.navigate('b', { data: circular });

    const saved = JSON.parse(sessionStorage.getItem('rise_stale_reload'));
    expect(saved.viewName).toBe('b');
    expect(saved.data).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('bounds what a reload may carry', async () => {
    const router = new Router();
    router.transitionDuration = 0;
    router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
    router.registerView('b', { container: document.querySelector('#b'), init: staleInit });

    await router.navigate('a');
    await router.navigate('b', { data: { text: 'x'.repeat(20_000) } });

    const raw = sessionStorage.getItem('rise_stale_reload');
    expect(raw.length).toBeLessThan(4100);
    expect(JSON.parse(raw).viewName).toBe('b');
    router.destroy();
  });
});
