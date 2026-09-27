import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIBRARY_TEXTS } from '../content/library.js';
import { Library } from './Library.js';
import { jevColors } from '../core/jev-palette.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';

const book = LIBRARY_TEXTS.find(text => text.id === 'literary-meditations');
let library;
let container;

afterEach(() => {
  library?.destroy();
  container?.remove();
  document.querySelector('.toc-scrim')?.remove();
  vi.unstubAllGlobals();
});

function mount(options = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  library = new Library(container, options);
  return container.querySelector('[data-jev-form]');
}

function response(overrides = {}) {
  const selectors = {
    section: 'first', wpm: 200, curve: 'flat', chunkMode: 'phrase',
    audio: 'aurora', visualMode: 'focals', visualStyle: 'gentle',
    visualEngine: 'klee', visualArc: 'single', arcSplit: '50',
    middleEngine: 'turrell', finaleEngine: 'fractal',
    middleTheme: 'classic', finaleTheme: 'classic',
    middleAudio: 'silent', finaleAudio: 'silent',
    visualPalette: 'white', kleePreset: 'random', galleryCadence: 'balanced',
    chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic',
    textColor: 'classic', backgroundColor: 'classic',
    wordFill: 'plain', projection: 'stream', revealMode: 'instant'
  };
  return {
    schemaVersion: 2,
    requestId: 'request-1',
    model: 'typesafe/jev-1.13-20260917',
    workId: book.id,
    editionId: book.editionId,
    sourceRevision: book.sourceRevision,
    reason: 'A reflective classical work.',
    config: { ...selectors, colors: jevColors(selectors.colorTheme, selectors.textColor, selectors.backgroundColor),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors),
      audioProgram: compileJevAudioProgram(selectors) },
    cacheStatus: 'miss',
    ...overrides
  };
}

describe('RISE recommendation in the reader-facing Library', () => {
  it('offers microphone dictation beside its editable RISE request', () => {
    const form = mount();
    expect(form.querySelector('[data-jev-dictate]')).not.toBeNull();
    expect(form.querySelector('[data-jev-dictation-status]')).not.toBeNull();
    expect(form.textContent).toMatch(/browser.s speech service/i);
  });
  it('asks RISE from a home-page intent and carries reader choices to the selected text', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    const selected = vi.fn();
    vi.stubGlobal('fetch', fetch);
    mount({
      initialIntent: 'A reflective classic',
      readingPreferences: {
        wpm: 260, curve: 'wave', chunkMode: 'phrase',
        audioPreset: 'silent', soundscape: 'aurora', visualMode: 'focals'
      },
      onSelectText: selected
    });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/jev-recommend',
      expect.objectContaining({ body: JSON.stringify({ intent: 'A reflective classic', schemaVersion: 3 }) })));
    await vi.waitFor(() => expect(container.querySelector('.library-jev-choice h3')?.textContent)
      .toBe(book.title));
    library.onSelectText('A selected passage', book.title, { wpm: 200, verseLines: true });
    expect(selected).toHaveBeenCalledWith('A selected passage', book.title, expect.objectContaining({
      wpm: 260, curve: 'wave', chunkMode: 'phrase', soundscape: 'aurora',
      visualConfig: { visualMode: 'focals' }, verseLines: true
    }));
  });

  it('turns a chosen Standard Ebooks edition into the existing book-opening path', async () => {
    const form = mount();
    const open = vi.spyOn(library, 'handleTextSelection').mockResolvedValue();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response() });
    vi.stubGlobal('fetch', fetch);
    form.elements.intent.value = 'I want a reflective classic';

    await library.recommendWithJev(form);

    expect(fetch).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ intent: 'I want a reflective classic', schemaVersion: 3 })
    }));
    expect(container.querySelector('.library-jev-choice h3').textContent).toBe(book.title);
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

  it('labels a reused RISE choice so the reader can tell it came from the cache', async () => {
    const form = mount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ decisionCacheStatus: 'hit' })
    }));
    form.elements.intent.value = 'A reflective classic';

    await library.recommendWithJev(form);

    expect(container.querySelector('.library-jev-choice details').textContent)
      .toContain('Reused cached RISE choice');
  });

  it('rejects a malformed or unsupported JSON plan before showing an open action', async () => {
    const form = mount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ schemaVersion: 3 })
    }));
    form.elements.intent.value = 'A reflective classic';
    await library.recommendWithJev(form);
    expect(container.querySelector('[data-action="open-jev"]')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => response({ config: { ...response().config, fontSize: 'giant' } })
    }));
    await library.recommendWithJev(form);
    expect(container.querySelector('[data-action="open-jev"]')).toBeNull();
  });
});
