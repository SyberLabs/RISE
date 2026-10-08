import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(content) {
  vi.resetModules();
  document.head.querySelector('meta[name="rise-embed"]')?.remove();
  if (content !== undefined) {
    const meta = document.createElement('meta');
    meta.name = 'rise-embed';
    meta.content = content;
    document.head.append(meta);
  }
  return import('./embed-address.js');
}

afterEach(() => document.head.querySelector('meta[name="rise-embed"]')?.remove());

describe('where the app runs', () => {
  it('is the window\'s own address on RISE\'s pages', async () => {
    const address = await load();
    expect(address.IN_HOST_CARD).toBe(false);
    expect(address.appLocation()).toBe(globalThis.location);
    expect(address.appHistory()).toBe(globalThis.history);
  });

  it('is the route a host card declares, kept in memory so the host\'s history is never written', async () => {
    const address = await load('/live?embed=mcp&voice=paced');
    expect(address.IN_HOST_CARD).toBe(true);
    const location = address.appLocation();
    expect([location.pathname, location.search, location.hash]).toEqual(['/live', '?embed=mcp&voice=paced', '']);
    const replace = vi.spyOn(globalThis.history, 'replaceState');
    const push = vi.spyOn(globalThis.history, 'pushState');
    address.appHistory().pushState({ id: 'read' }, '', '/read?pane=chamber');
    expect([location.pathname, location.search]).toEqual(['/read', '?pane=chamber']);
    address.appHistory().replaceState({ id: 'home' }, '', '/');
    expect([location.pathname, location.search]).toEqual(['/', '']);
    expect(address.appHistory().state).toEqual({ id: 'home' });
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('refuses a declared route that is not a plain path, and stays on the window', async () => {
    for (const bad of ['https://evil.example/live', '//evil.example', 'live', '/live"><x', '']) {
      const address = await load(bad);
      expect(address.IN_HOST_CARD, bad).toBe(false);
    }
  });
});
