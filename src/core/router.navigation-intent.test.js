import { describe, it, expect, vi } from 'vitest';
import { Router } from './router.js';

describe('navigation intent ownership', () => {
  it('announces queued intent synchronously and prevents stale chamber initialization', async () => {
    const intent = vi.fn();
    const router = new Router({ onNavigationIntent: intent });
    const init = vi.fn();
    const a = document.createElement('main');
    router.registerView('make', { container: a, init: () => ({}) });
    router.registerView('read', { container: document.createElement('main'), init });
    router.registerView('home', { container: document.createElement('main'), init: () => ({}) });
    router.fadeIn = vi.fn().mockResolvedValue();
    router.fadeOut = vi.fn().mockResolvedValue();
    await router.navigate('make');
    let release;
    router.fadeOut.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const launch = router.navigate('chamber-session');
    const leave = router.navigate('home');
    expect(intent).toHaveBeenLastCalledWith('home', {});
    release();
    expect(await launch).toBe(false);
    expect(await leave).toBe(true);
    expect(init).not.toHaveBeenCalled();
    router.destroy();
  });
});
