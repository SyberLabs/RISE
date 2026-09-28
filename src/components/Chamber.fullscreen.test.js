import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Chamber.js'), 'utf8');

describe('Chamber fullscreen is the reader’s choice', () => {
  it('never requests fullscreen except from the Fullscreen control', () => {
    const calls = [...source.matchAll(/requestFullscreen\?\.\(|requestFullscreen\(\)/g)];
    expect(calls).toHaveLength(1);
    const start = source.indexOf("fullscreenBtn?.addEventListener('click'");
    const handler = source.slice(start, source.indexOf('this._syncFullscreenControl =', start));
    expect(handler).toContain('document.documentElement.requestFullscreen?.()');
    expect(calls[0].index).toBeGreaterThan(start);
    expect(calls[0].index).toBeLessThan(start + handler.length);
  });

  it('labels Page by its state rather than a bare destination', () => {
    expect(source).toContain('<span class="control-label">Page view</span>');
    expect(source).toContain("label.textContent = next ? 'Back to stream' : 'Page view'");
    expect(source).not.toMatch(/<span class="control-label">Page<\/span>/);
  });
});
