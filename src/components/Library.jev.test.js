import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIBRARY_TEXTS } from '../content/library.js';
import { Library } from './Library.js';

const book = LIBRARY_TEXTS.find(text => text.id === 'literary-meditations');
let library;
let container;

afterEach(() => {
  library?.destroy();
  container?.remove();
  document.querySelector('.toc-scrim')?.remove();
  vi.unstubAllGlobals();
});

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  library = new Library(container);
  return container.querySelector('[data-jev-form]');
}

function response(overrides = {}) {
  return {
    requestId: 'request-1',
    model: 'typesafe/jev-1.13-20260917',
    workId: book.id,
    editionId: book.editionId,
    sourceRevision: book.sourceRevision,
    reason: 'A reflective classical work.',
    cacheStatus: 'miss',
    ...overrides
  };
}

describe('Jev recommendation in the reader-facing Library', () => {
  it('turns a chosen Standard Ebooks edition into the existing book-opening path', async () => {
    const form = mount();
    const open = vi.spyOn(library, 'handleTextSelection').mockResolvedValue();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal('fetch', fetch);
    form.elements.intent.value = 'I want a reflective classic';

    await library.recommendWithJev(form);

    expect(fetch).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ intent: 'I want a reflective classic' })
    }));
    expect(container.querySelector('.library-jev-choice h4').textContent).toBe(book.title);
    container.querySelector('[data-action="open-jev"]').click();
    expect(open).toHaveBeenCalledWith(book.id);
  });

  it('refuses a model choice whose edition is absent from this RISE release', async () => {
    const form = mount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response({ sourceRevision: 'sha256:wrong' })
    }));
    form.elements.intent.value = 'A book on self-examination';

    await library.recommendWithJev(form);

    expect(container.querySelector('[data-action="open-jev"]')).toBeNull();
    expect(container.querySelector('[data-jev-result]').textContent)
      .toContain('not available in this RISE release');
  });

  it('labels a reused Jev choice so the reader can tell it came from the cache', async () => {
    const form = mount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ decisionCacheStatus: 'hit' })
    }));
    form.elements.intent.value = 'A reflective classic';

    await library.recommendWithJev(form);

    expect(container.querySelector('.library-jev-choice details').textContent)
      .toContain('Reused cached Jev choice');
  });
});
