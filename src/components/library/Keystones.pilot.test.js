import { describe, expect, it, vi } from 'vitest';

vi.mock('../../content/keystones.js', async importOriginal => ({
  ...await importOriginal(),
  resolveKeystone: vi.fn(async () => ({
    admitted: true,
    ready: true,
    sessionInput: { text: 'A short reading.' }
  }))
}));

import { Keystones } from './Keystones.js';

describe('curated pilot choices', () => {
  it('shows the selected reading promise before entry and updates it on selection', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const container = document.createElement('div');
    const room = new Keystones(container);

    expect(container.querySelector('[data-pilot-promise]')?.textContent)
      .toContain('Ovid');
    room.applySelection(0);
    expect(container.querySelector('[data-pilot-promise]')?.textContent)
      .toContain('Marcus Aurelius');
    room.update({ slug: 'tintern' });
    expect(container.querySelector('[data-pilot-promise]')?.textContent)
      .toContain('Wordsworth');

    room.destroy();
    vi.unstubAllGlobals();
  });
});
