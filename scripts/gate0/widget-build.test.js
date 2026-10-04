import { describe, expect, it } from 'vitest';
import { buildWidgetHtml } from './server.mjs';

describe('Gate 0 widget packaging', () => {
  it('bundles AttractorField into the self-contained MCP UI resource', async () => {
    const html = await buildWidgetHtml();
    expect(html).toContain('RISE Gate 0');
    expect(html).toContain('type="module"');
    expect(html).toContain('ui/notifications/tool-result');
    expect(html).toContain('attractor-canvas');
    expect(html).not.toMatch(/<script[^>]+src=/iu);
    expect(html).not.toMatch(/https?:\/\//iu);
  });
});
