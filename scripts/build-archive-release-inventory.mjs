/** Generate the compact release identity inventory without eager-loading text. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CANON } from '../src/content/archive/canon.js';

const inventory = {};
const target = resolve('src/content/archive/release-inventory.json');
let previous = {};
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* first generation */ }
for (const { id } of CANON) {
  const mod = await import(`../src/content/archive/works/${id}.js`);
  const key = `${id.toUpperCase().replace(/-/gu, '_')}_META`;
  const meta = mod[key];
  if (!meta?.source || !meta?.edition || !meta?.rights) {
    throw new Error(`${id} does not expose complete release metadata`);
  }
  const editionSlug = new URL(meta.source.url).pathname
    .replace(/^\/ebooks\//u, '').replace(/^\/+|\/+$/gu, '');
  const sourceRevision = createHash('sha256')
    .update(JSON.stringify(meta.source.files))
    .digest('hex');
  inventory[id] = {
    workId: id,
    editionId: `standard-ebooks:${editionSlug}`,
    sourceRevision: `sha256:${sourceRevision}`,
    edition: meta.edition,
    source: meta.source,
    rights: meta.rights,
    parts: meta.parts,
    chars: meta.chars
  };
}

const changed = Object.keys(inventory).filter(id => previous[id]?.sourceRevision
  && previous[id].sourceRevision !== inventory[id].sourceRevision);
if (changed.length && !process.argv.includes('--allow-revision-change')) {
  throw new Error(`Source revisions changed for ${changed.join(', ')}. Audit and migrate dependents, then rerun with --allow-revision-change.`);
}
await writeFile(target, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(inventory).length} edition identities to ${target}`);
