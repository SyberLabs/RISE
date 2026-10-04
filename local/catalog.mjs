/**
 * Local RISE's decision catalog, read from the committed editorial file
 * `src/content/decision-catalog.json` and validated exactly as the build does
 * for `/content/catalog.json`. No network and no database.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDecisionCatalog } from '../scripts/lib/content-plane.mjs';

const SOURCE = fileURLToPath(new URL('../src/content/decision-catalog.json', import.meta.url));

export async function committedCatalog() {
  const dir = await mkdtemp(join(tmpdir(), 'rise-catalog-'));
  try {
    const out = join(dir, 'catalog.json');
    await buildDecisionCatalog({ source: SOURCE, out });
    return JSON.parse(await readFile(out, 'utf8'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
