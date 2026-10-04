import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `import('…')` a source file makes, resolved to a path under src/. */
function dynamicImports(file) {
  const path = resolve(SRC, file);
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/import\(\s*'([^']+)'\s*\)/g)]
    .map(([, specifier]) => resolve(dirname(path), specifier));
}

describe('preloadHome', () => {
  // A preload the Portal no longer uses is a download on every visit that
  // nothing reads. The two lists are written in two files; this holds them
  // together.
  it('fetches only modules the Portal itself loads for Home', () => {
    const preloaded = dynamicImports('app/home-preload.js');
    const portal = new Set(dynamicImports('components/Portal.js'));

    expect(preloaded.length).toBeGreaterThan(0);
    for (const module of preloaded) {
      expect(portal, `${module} is preloaded but the Portal does not import it`).toContain(module);
    }
  });
});
