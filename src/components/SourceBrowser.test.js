import { describe, expect, it, vi } from 'vitest';
import { SourceBrowser } from './SourceBrowser.js';
import { SourceRegistry } from '../sources/index.js';
import { ArchiveTextProvider } from '../sources/text/archive.js';

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

  it('opens the authoritative Archive, exposes current shelves, and filters within them', async () => {
    const provider = new ArchiveTextProvider();
    const get = vi.spyOn(SourceRegistry, 'get').mockImplementation(id =>
      id === provider.id ? provider : undefined);
    const textProviders = vi.spyOn(SourceRegistry, 'getTextProviders').mockReturnValue([provider]);
    const visualProviders = vi.spyOn(SourceRegistry, 'getVisualProviders').mockReturnValue([]);

    const onSelect = vi.fn();
    const browser = new SourceBrowser({
      mode: 'text',
      providerIds: ['library-archive'],
      autoSelectProviderId: 'library-archive',
      onSelect
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(browser.activeProvider).toBe(provider);
    expect(browser.element.querySelector('.sb-library-navigation').hidden).toBe(false);
    expect(browser.element.querySelector('[data-library-category="received"]')).not.toBeNull();
    expect(browser.element.querySelector('.sb-content-title').textContent)
      .toContain(`${provider.count} works`);
    expect(browser.element.querySelectorAll('.sb-item')).toHaveLength(provider.count);

    browser.element.querySelector('[data-library-category="received"]').click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(browser.activeCategory).toBe('received');
    expect(browser.contentItems.length).toBeGreaterThan(0);
    expect(browser.contentItems.every(item => item.metadata.shelfId === 'received')).toBe(true);
    expect(browser.element.querySelector('.sb-item-edition')).not.toBeNull();

    const dividedIndex = browser.contentItems.findIndex(item => item.metadata.canBrowseParts);
    await browser.openTextItem(dividedIndex);
    expect(browser.viewMode).toBe('contents');
    expect(browser.element.querySelector('.sb-contents')).not.toBeNull();
    expect(browser.element.querySelectorAll('.sb-chapter-item').length).toBeGreaterThan(1);
    expect(browser.element.querySelector('.sb-whole-add').textContent).toContain('Add complete work');

    const firstEntry = browser.textContents.entries[0];
    await browser.selectTextEntry(firstEntry.id);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        parentWorkId: browser.activeTextItem.id,
        divisionLabel: firstEntry.label
      })
    }), provider);

    browser.destroy();
    get.mockRestore();
    textProviders.mockRestore();
    visualProviders.mockRestore();
  });
});
