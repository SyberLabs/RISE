import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  resolve('src/components/Atrium.js'),
  resolve('src/content/atrium/coverage.js'),
  resolve('src/content/atrium/catalog.js'),
  resolve('src/content/atrium/philosophy.js'),
  resolve('src/content/atrium/history.js'),
  // The portal's Atrium door reaches this lazily — it must stay
  // metadata-only just like the browse surfaces
  resolve('src/content/atrium/featured.js'),
  // Curated imagery resolves museum records, never payload text
  resolve('src/content/atrium/imagery/service.js')
];
const STATIC_EDGE = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const PAYLOAD_MODULE = /[\\/](?:expanded-[^\\/]+|payloads|philosophy-(?:classical|aristotle|transmission)|history-(?:baseline|expansion[^\\/]*))\.js$/;

function resolveModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const candidate = resolve(dirname(fromFile), specifier);
  return extname(candidate) ? candidate : `${candidate}.js`;
}

function walkStaticImports(roots) {
  const visited = new Set();
  const pending = [...roots];
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(STATIC_EDGE)) {
      const dependency = resolveModule(file, match[1]);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return [...visited];
}

describe('Atrium payload boundary', () => {
  it('keeps expanded text and payload aggregators outside the browse import graph', () => {
    const graph = walkStaticImports(ROOTS);
    expect(graph.filter(file => PAYLOAD_MODULE.test(file))).toEqual([]);
    expect(graph.some(file => /[\\/]handoff\.js$/.test(file))).toBe(false);
  });
});

