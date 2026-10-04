import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualCatalog } from './VisualCatalog.js';
import { stillQueue } from '../visual-navigator/preview.js';
import { visualCortex } from '../../visuals/visual-cortex.js';

const environment = ({ drawing = true } = {}) => ({
  window: { matchMedia: () => ({ matches: false }), self: null, top: null },
  navigator: {},
  document: {
    createElement: () => ({ getContext: kind => kind === '2d' && drawing ? {} : null })
  }
});

let view;
let container;

function mount(options = {}) {
  container = document.createElement('div');
  document.body.append(container);
  view = new VisualCatalog(container, { env: environment(), ...options });
  return view;
}

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
  stillQueue._reset();
  vi.restoreAllMocks();
});

describe('the searchable visual catalog', () => {
  it('shows all nine choices, distinguishes specimens and live openings, and keeps fixed descriptions', () => {
    mount();
    const cards = [...container.querySelectorAll('[data-visual-id]')];
    expect(cards).toHaveLength(9);
    expect(container.querySelectorAll('a[href^="/live?catalog="]')).toHaveLength(2);
    expect(container.textContent).toMatch(/specimen only/iu);
    expect(container.textContent).toMatch(/fixed renderer defaults/u);
    expect(container.textContent).toMatch(/intensity.*default 0\.65.*0\.4 to 0\.75/iu);
    expect(container.textContent).toMatch(/cost.*not measured/iu);
    expect(container.querySelector('[data-visual-id="turrell"]').textContent).toContain('light');
  });

  it('searches names, descriptions and tags without removing capability explanations', () => {
    mount({ env: environment({ drawing: false }) });
    const search = container.querySelector('input[type="search"]');
    search.value = 'atmosphere';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...container.querySelectorAll('[data-visual-id]')].map(card => card.dataset.visualId)).toEqual(['turrell']);
    expect(container.textContent).toMatch(/drawing is unavailable/iu);
    expect(container.querySelector('a[href^="/live?catalog="]')).toBeNull();
  });

  it('does no preview work until requested and applies a late result only while mounted', async () => {
    mount();
    const gate = {};
    gate.promise = new Promise(resolve => { gate.resolve = resolve; });
    vi.spyOn(visualCortex, 'renderLeafStill').mockReturnValue(gate.promise);
    expect(visualCortex.renderLeafStill).not.toHaveBeenCalled();
    container.querySelector('[data-preview="klee"]').click();
    await vi.waitFor(() => expect(visualCortex.renderLeafStill).toHaveBeenCalledWith('klee'));
    view.destroy();
    gate.resolve({ url: 'data:image/png;base64,AAAA' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('img')).toBeNull();
  });

  it('restores an aborted preview button on reentry and never paints the departed result', async () => {
    mount();
    const gate = {};
    gate.promise = new Promise(resolve => { gate.resolve = resolve; });
    vi.spyOn(visualCortex, 'renderLeafStill').mockReturnValue(gate.promise);
    const button = container.querySelector('[data-preview="klee"]');
    button.click();
    await vi.waitFor(() => expect(visualCortex.renderLeafStill).toHaveBeenCalledWith('klee'));

    view.deactivate();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Preview specimen');
    view.activate();

    gate.resolve({ url: 'data:image/png;base64,AAAA' });
    await vi.waitFor(() => expect(stillQueue.cached('catalog:specimen:klee')).toBe('data:image/png;base64,AAAA'));
    expect(container.querySelector('.visual-catalog__preview img')).toBeNull();

    button.click();
    await vi.waitFor(() => expect(container.querySelector('.visual-catalog__preview img')).not.toBeNull());
    expect(visualCortex.renderLeafStill).toHaveBeenCalledTimes(1);
  });

  it('rejects a preview URL outside the sanitizer allowlist', async () => {
    mount();
    vi.spyOn(visualCortex, 'renderLeafStill').mockResolvedValue({ url: 'javascript:alert(1)' });
    container.querySelector('[data-preview="klee"]').click();
    await vi.waitFor(() => expect(container.querySelector('.visual-catalog__preview').textContent).toBe('This preview is unavailable.'));
    expect(container.querySelector('img')).toBeNull();
  });
});
