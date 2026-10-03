import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDecisionCatalog } from '../../../scripts/lib/content-plane.mjs';
import { readPublicCatalog } from './catalog.js';

const SOURCE = resolve(import.meta.dirname, '../../content/decision-catalog.json');
let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'rise-catalog-test-')); });
afterEach(() => rm(dir, { recursive: true, force: true }));

async function build(edit) {
  const rows = JSON.parse(await readFile(SOURCE, 'utf8'));
  edit?.(rows);
  const source = join(dir, 'source.json');
  await writeFile(source, JSON.stringify(rows));
  const out = join(dir, 'out', 'catalog.json');
  await buildDecisionCatalog({ source, out });
  return JSON.parse(await readFile(out, 'utf8'));
}

describe('decision catalog build step', () => {
  it('writes a file the browser contract accepts', async () => {
    const catalog = await build();
    expect(readPublicCatalog(catalog)).not.toBeNull();
    expect(catalog.books).toHaveLength(31);
  });

  it('leaves out a withdrawn row and still builds', async () => {
    const catalog = await build(rows => {
      rows.books[0].active = false;
      rows.options[0].active = false;
    });
    expect(catalog.books).toHaveLength(30);
    expect(catalog.books.map(row => row.work_id)).not.toContain('middlemarch');
    expect(catalog.options).toHaveLength(11);
  });

  it.each([
    ['an option with an unknown kind', rows => { rows.options[0].kind = 'audio'; }],
    ['an option with an empty description', rows => { rows.options[0].description = ''; }],
    ['a book whose fit_description is too short', rows => { rows.books[0].fit_description = 'Short'; }]
  ])('fails the build for %s', async (_name, edit) => {
    await expect(build(edit)).rejects.toThrow(/public catalog contract/u);
  });
});
