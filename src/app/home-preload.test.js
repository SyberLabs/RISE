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
  // A preload Home no longer uses is a download on every visit that
  // nothing reads. The two lists are written in two files; this holds them
  // together.
  it('fetches only modules Home itself loads', () => {
    const preloaded = dynamicImports('app/home-preload.js');
    const home = new Set(dynamicImports('components/Home.js'));

    expect(preloaded.length).toBeGreaterThan(0);
    for (const module of preloaded) {
      expect(home, `${module} is preloaded but Home does not import it`).toContain(module);
    }
  });
});
