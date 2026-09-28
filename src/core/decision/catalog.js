/**
 * The public decision catalog: which released books, sounds, and type options
 * a decision model may be offered. Shared by the Worker (which reads Neon and
 * publishes it), the browser (which checks what it receives), and the local
 * bridge. Every row is reviewed public metadata; nothing here is a secret.
 */
import releaseInventory from '../../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../../content/modern-readings-manifest.json' with { type: 'json' };
import { JEV_AUDIO_IDS } from '../jev-config.js';

export const CATALOG_SCHEMA_VERSION = 1;
export const OPTION_KINDS = Object.freeze(['chamberFace', 'fontSize']);
export const SOUND_CATALOG_LIMIT = 64;

export const RELEASE_EDITIONS = Object.freeze({
  ...Object.fromEntries(Object.values(releaseInventory)
    .filter(item => item.editionId?.startsWith('standard-ebooks:')
      && item.source?.url?.startsWith('https://standardebooks.org/ebooks/'))
    .map(item => [item.workId, item])),
  ...modernManifest
});

const BOOK_KEYS = ['work_id', 'title', 'author', 'edition_id', 'source_revision',
  'fit_description', 'decision_criterion', 'active'];

export function admittedBook(row) {
  const edition = RELEASE_EDITIONS[row?.work_id];
  return Boolean(edition && row?.active === true
    && row.edition_id === edition.editionId
    && row.source_revision === edition.sourceRevision
    && typeof row.title === 'string' && row.title.length > 1 && row.title.length <= 120
    && typeof row.author === 'string' && row.author.length > 1 && row.author.length <= 100
    && typeof row.fit_description === 'string' && row.fit_description.length >= 10
    && row.fit_description.length <= 180
    && typeof row.decision_criterion === 'string' && row.decision_criterion.length >= 10
    && row.decision_criterion.length <= 240);
}

export function validCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < 1
    || rows.length > Object.keys(RELEASE_EDITIONS).length
    || rows.some(row => !admittedBook(row))) return null;
  const ids = rows.map(row => row.work_id);
  return new Set(ids).size === ids.length ? rows : null;
}

export function validSoundCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > JEV_AUDIO_IDS.length) return null;
  const ids = new Set();
  for (const row of rows) {
    if (row?.active !== true || !JEV_AUDIO_IDS.includes(row.sound_id)
      || ids.has(row.sound_id) || typeof row.decision_criterion !== 'string'
      || row.decision_criterion.length < 10 || row.decision_criterion.length > 120) return null;
    ids.add(row.sound_id);
  }
  return rows;
}

/** Only the public columns leave the Worker, whatever else a row carries. */
export function publicCatalog({ books, sounds, options }) {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    books: books.map(row => Object.fromEntries(BOOK_KEYS.map(key => [key, row[key]]))),
    sounds: sounds.map(row => ({ sound_id: row.sound_id, decision_criterion: row.decision_criterion, active: row.active })),
    // null: the optional menu table is not migrated; the compiled menu applies.
    options: options === null ? null
      : options.map(row => ({ kind: row.kind, id: row.id, description: row.description }))
  };
}

/** Admit a published catalog exactly as the Worker would have served it. */
export function readPublicCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== CATALOG_SCHEMA_VERSION) return null;
  const books = validCatalog(value.books);
  const sounds = validSoundCatalog(value.sounds);
  if (!books || !sounds) return null;
  if (value.options !== null && !Array.isArray(value.options)) return null;
  return { books, sounds, options: value.options };
}
