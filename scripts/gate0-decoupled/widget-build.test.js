import { describe, expect, it } from 'vitest';
import { buildDecoupledWidgetHtml } from './widget-build.mjs';

describe('decoupled widget resource', () => {
  it('builds a self-contained module with the actual Attractor renderer and no external connections', async () => {
    const html = await buildDecoupledWidgetHtml();
    expect(html).toContain('attractor-canvas');
    expect(html).toContain('Set intensity 0.75');
    expect(html).toContain('rise_set_visual');
    expect(html).not.toMatch(/(?:src|href)=["']https?:/iu);
    expect(html).not.toContain('import("http');
    expect(html).toContain('<script type="module">');
  });
});
