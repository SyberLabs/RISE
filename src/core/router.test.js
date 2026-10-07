import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Router, claimStaleBuildReload } from './router.js';

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

    // Mid-transition: falling through to reset('home') would strand
    // a just-started session's audio behind the portal
    router.transitioning = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(reset).not.toHaveBeenCalled();

    // Settled: the fallback owns Escape again
    router.transitioning = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(reset).toHaveBeenCalledWith('home');

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
    // view they are in. A reader in the Vault could not reach Home.
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

  it('does not reload again after the reload, when the same build still fails', async () => {
    // A blocked chunk fails on every load. The reload builds a new Router,
    // so a guard that lives on the instance is reset by the very reload it
    // guards, and the page reloads forever.
    const load = () => {
      const r = new Router();
      r.transitionDuration = 0;
      r.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
      r.registerView('b', { container: document.querySelector('#b'), init: staleError });
      return r;
    };
    for (let i = 0; i < 3; i += 1) {
      const r = load();
      await r.navigate('a');
      await r.navigate('b');
      r.destroy();
    }

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once more for a later build, so a second deploy still recovers', () => {
    expect(claimStaleBuildReload('/assets/index-A.js')).toBe(true);
    expect(claimStaleBuildReload('/assets/index-A.js')).toBe(false);
    expect(claimStaleBuildReload('/assets/index-B.js')).toBe(true);
    expect(claimStaleBuildReload('/assets/index-B.js')).toBe(false);
  });

  it('lets the same build reload again once the last reload is old', () => {
    // A reload spent on a network blip must not strand the tab when a
    // deploy lands hours later on the build it is still running.
    vi.useFakeTimers();
    try {
      expect(claimStaleBuildReload('/assets/index-A.js')).toBe(true);
      vi.advanceTimersByTime(60_000);
      expect(claimStaleBuildReload('/assets/index-A.js')).toBe(false);
      vi.advanceTimersByTime(5 * 60_000);
      expect(claimStaleBuildReload('/assets/index-A.js')).toBe(true);
      expect(claimStaleBuildReload('/assets/index-A.js')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never reloads when session storage cannot remember the reload', async () => {
    // Without a record, nothing could stop the next load from reloading too.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    try {
      const router = new Router();
      router.transitionDuration = 0;
      router.registerView('a', { container: document.querySelector('#a'), init: () => ({}) });
      router.registerView('b', { container: document.querySelector('#b'), init: staleError });
      await router.navigate('a');
      expect(await router.navigate('b')).toBe(false);
      expect(reload).not.toHaveBeenCalled();
      router.destroy();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
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

describe('Router holds Home under a reading launched from it', () => {
  // Home's last frame is the ground until the reading's field is up: the
  // Read view is unhidden over Home and faded in, and only then is Home
  // deactivated and hidden (RDR-015). Read's place above Home is the
  // stylesheet's (#view-home:not([hidden]) ~ #view-read:not([hidden])).
  let router;
  let home;
  const container = id => document.querySelector(`#view-${id}`);

  beforeEach(() => {
    document.body.innerHTML = '<div id="view-home"></div><div id="view-read"></div><div id="view-library"></div>';
    router = new Router();
    router.transitionDuration = 0;
    home = { activate: vi.fn(), deactivate: vi.fn() };
    router.registerView('home', { container: container('home'), init: () => home });
    router.registerView('read', { container: container('read'), init: () => ({}) });
    router.registerView('library', { container: container('library'), init: () => ({}) });
  });

  /** Holds the next fade-in until the returned release is called. */
  function holdFadeIn() {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    vi.spyOn(router, 'fadeIn').mockImplementationOnce(() => held).mockResolvedValue(undefined);
    return release;
  }

  it('keeps Home shown and running until the reading has faded in, then hides it', async () => {
    await router.navigate('home');
    const fadeOut = vi.spyOn(router, 'fadeOut');
    const release = holdFadeIn();

    const launch = router.navigate('chamber-session', { data: { atoms: [{}] } });
    await vi.waitFor(() => expect(router.fadeIn).toHaveBeenCalledWith(container('read')));

    expect(container('home').hidden).toBe(false);
    expect(fadeOut).not.toHaveBeenCalled();
    expect(home.deactivate).not.toHaveBeenCalled();
    expect(container('read').hidden).toBe(false);

    release();
    expect(await launch).toBe(true);
    expect(home.deactivate).toHaveBeenCalledTimes(1);
    expect(container('home').hidden).toBe(true);
    expect(router.currentView).toBe('read');
    router.destroy();
  });

  it('still takes any other view down before the next one is shown', async () => {
    await router.navigate('home');
    const release = holdFadeIn();

    const move = router.navigate('library');
    await vi.waitFor(() => expect(router.fadeIn).toHaveBeenCalledWith(container('library')));

    expect(home.deactivate).toHaveBeenCalledTimes(1);
    expect(container('home').hidden).toBe(true);

    release();
    expect(await move).toBe(true);
    router.destroy();
  });

  it('leaves Home as it was when the launch is cancelled under it', async () => {
    // Escape during the launch bumps the revision; the reading is abandoned
    // after it is built. Home was never taken down, so it is not faded back
    // in (fadeIn starts from opacity 0: a dip to black) nor activated again.
    router.registerView('read', {
      container: container('read'),
      init: () => { router.navigationRevision += 1; return {}; }
    });
    await router.navigate('home');
    const fadeIn = vi.spyOn(router, 'fadeIn');

    expect(await router.navigate('chamber-session', { data: { atoms: [{}] } })).toBe(false);

    expect(container('home').hidden).toBe(false);
    expect(container('read').hidden).toBe(true);
    expect(home.deactivate).not.toHaveBeenCalled();
    expect(home.activate).toHaveBeenCalledTimes(1);
    expect(fadeIn).not.toHaveBeenCalledWith(container('home'));
    expect(router.currentView).toBe('home');
    router.destroy();
  });
});
