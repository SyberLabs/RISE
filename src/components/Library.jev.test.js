import { afterEach, expect, it, vi } from 'vitest';
import { Library } from './Library.js';

let library;
let container;

afterEach(() => {
  library?.destroy();
  container?.remove();
  document.querySelector('.toc-scrim')?.remove();
  vi.unstubAllGlobals();
});

it('has no second request box: describing a reading happens on Home', () => {
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const onNavigate = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  library = new Library(container, { onNavigate });

  expect(container.querySelector('[data-jev-form]')).toBeNull();
  expect(container.querySelector('textarea, input[name="intent"]')).toBeNull();
  expect(container.textContent).not.toMatch(/Ask (Jev|RISE)/);
  const link = container.querySelector('[data-action="go-home"]');
  expect(link.textContent).toBe('Describe what you want on Home');
  link.click();
  expect(onNavigate).toHaveBeenCalledWith('portal');
  expect(provider).not.toHaveBeenCalledWith('/api/jev-recommend', expect.anything());
});
