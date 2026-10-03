/**
 * Local RISE's decision catalog, read from the committed editorial file
 * `src/content/decision-catalog.json` (the same rows the build publishes at
 * `/content/catalog.json`). No network and no database.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicCatalog, readPublicCatalog } from '../src/core/decision/catalog.js';

export function seedCatalog() {
  const source = JSON.parse(readFileSync(fileURLToPath(new URL('../src/content/decision-catalog.json', import.meta.url)), 'utf8'));
  const catalog = publicCatalog(source);
  if (!readPublicCatalog(catalog)) throw new Error('The committed catalog does not pass the decision contract.');
  return catalog;
}
