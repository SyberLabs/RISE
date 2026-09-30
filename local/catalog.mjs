/**
 * Local RISE's decision catalog, read from the committed public seed files
 * (the same reviewed rows the hosted catalog is loaded from). No network and
 * no database: local RISE works offline once installed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPublicCatalog, CATALOG_SCHEMA_VERSION } from '../src/core/decision/catalog.js';

const seed = name => readFileSync(fileURLToPath(new URL(`../scripts/${name}`, import.meta.url)), 'utf8');

/** The VALUES tuples of the one INSERT in a seed file, as arrays of strings and booleans. */
export function seedRows(sql) {
  const values = sql.slice(sql.indexOf(' VALUES') + 7, sql.search(/\nON CONFLICT/u));
  const rows = [];
  let row = null;
  for (let i = 0; i < values.length; i += 1) {
    const char = values[i];
    if (char === '(' && row === null) { row = []; continue; }
    if (char === ')' && row !== null) { rows.push(row); row = null; continue; }
    if (row === null) continue;
    if (char === "'") {
      let text = '';
      for (i += 1; i < values.length; i += 1) {
        if (values[i] === "'" && values[i + 1] === "'") { text += "'"; i += 1; }
        else if (values[i] === "'") break;
        else text += values[i];
      }
      row.push(text);
    } else if (values.startsWith('TRUE', i)) { row.push(true); i += 3; }
    else if (values.startsWith('FALSE', i)) { row.push(false); i += 4; }
  }
  return rows;
}

export function seedCatalog() {
  const books = seedRows(seed('seed-rise-books.sql')).map(([work_id, title, author, edition_id,
    source_revision, fit_description, decision_criterion, active]) => ({
    work_id, title, author, edition_id, source_revision, fit_description, decision_criterion, active
  })).filter(row => row.active);
  const sounds = seedRows(seed('seed-rise-sounds.sql'))
    .map(([sound_id, decision_criterion, active]) => ({ sound_id, decision_criterion, active }))
    .filter(row => row.active);
  const options = seedRows(seed('seed-jev-options.sql'))
    .filter(row => row[3] !== false)
    .map(([kind, id, description]) => ({ kind, id, description }));
  const catalog = readPublicCatalog({ schemaVersion: CATALOG_SCHEMA_VERSION, books, sounds, options });
  if (!catalog) throw new Error('The committed seed catalog does not pass the decision contract.');
  return { schemaVersion: CATALOG_SCHEMA_VERSION, ...catalog };
}
