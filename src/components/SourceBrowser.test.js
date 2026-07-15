import { describe, expect, it, vi } from 'vitest';
import { SourceBrowser } from './SourceBrowser.js';
import { SourceRegistry } from '../sources/index.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

describe('SourceBrowser request ownership', () => {
  it('does not let a stale provider response overwrite the active provider', async () => {
    const slow = deferred();
    const providerA = { id: 'a', name: 'A', contentType: 'text', supportsSearch: false, list: vi.fn(() => slow.promise) };
    const providerB = { id: 'b', name: 'B', contentType: 'text', supportsSearch: false, list: vi.fn().mockResolvedValue([{ id: 'b1', name: 'B item' }]) };
    vi.spyOn(SourceRegistry, 'get').mockImplementation(id => id === 'a' ? providerA : providerB);

    const browser = new SourceBrowser();
    const aRequest = browser.loadProviderContent('a');
    await browser.loadProviderContent('b');
    slow.resolve([{ id: 'a1', name: 'A item' }]);
    await aRequest;

    expect(browser.activeProvider).toBe(providerB);
    expect(browser.contentItems).toEqual([{ id: 'b1', name: 'B item' }]);
    browser.destroy();
    vi.restoreAllMocks();
  });
});
