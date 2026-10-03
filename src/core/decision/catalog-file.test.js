import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentPlane } from '../../../scripts/lib/content-plane.mjs';
import { readPublicCatalog } from './catalog.js';

describe('content-plane catalog file', () => {
  it('writes public/content/catalog.json and the browser contract accepts it', async () => {
    await buildContentPlane();
    const file = resolve(import.meta.dirname, '../../../public/content/catalog.json');
    const catalog = readPublicCatalog(JSON.parse(await readFile(file, 'utf8')));
    expect(catalog).not.toBeNull();
    expect(catalog.books).toHaveLength(31);
  }, 120_000);
});
