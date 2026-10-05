/**
 * ONE LIST OF ENGINES. The registry (visual-registry.js) names every engine;
 * the taxonomy, the catalog and every surface read it from there. A second
 * hand-made list of engine ids is one list and one thing that will disagree
 * with it, which is how the Visual Lab, Reader setup and the Workshop came to
 * offer different engines.
 *
 * A list here is three or more registered engine ids written one after
 * another; data that composes an engine or two (a temper, a treatment) is
 * not a list of engines. The files that may still hold one say why.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';

const ROOT = join(import.meta.dirname, '..', '..');
const ENGINE_IDS = LISTED_PROCEDURAL_PATTERNS.map(pattern => pattern.id);

const ALLOWED = Object.freeze({
  'src/core/visual-registry.js': 'the registry itself',
  'src/core/visual-taxonomy.js': 'the order the tree shows the registry\'s dynamic engines in',
  'src/core/visual-catalog.js': 'the catalog\'s manifests, keyed by registered engine',
  'src/app/jev-reading.js': 'Jev\'s closed choices, a model-facing contract checked by validateJevRecommendation',
  'src/core/jev-sequence.js': 'the phases Jev\'s closed choices are scheduled through',
  'src/core/visual-style-definitions.js': 'the engines whose style can be configured'
});

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) sourceFiles(file, out);
    else if (name.endsWith('.js') && !name.endsWith('.test.js')) out.push(file);
  }
  return out;
}

const ID = `['"](?:${ENGINE_IDS.join('|')})['"]`;
const SEPARATOR = String.raw`\s*,\s*(?:\/\/[^\n]*\s*)*`;
const LIST = new RegExp(`${ID}(?:${SEPARATOR}${ID}){2,}`, 'g');

function engineLists() {
  const lists = [];
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    const path = relative(ROOT, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(LIST)) {
      const lineStart = source.lastIndexOf('\n', match.index) + 1;
      if (/^\s*(\*|\/\/|\/\*)/.test(source.slice(lineStart, match.index))) continue;
      const named = [...match[0].matchAll(new RegExp(ID, 'g'))].map(id => id[0].slice(1, -1));
      lists.push({ path, line: source.slice(0, match.index).split('\n').length, named });
    }
  }
  return lists;
}

describe('the engine registry', () => {
  it('is the only hand-made list of engines', () => {
    const strays = engineLists()
      .filter(list => !Object.hasOwn(ALLOWED, list.path))
      .map(list => `${list.path}:${list.line} names ${list.named.join(', ')}`);
    expect(strays).toEqual([]);
  });
});
