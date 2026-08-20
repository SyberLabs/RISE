/**
 * SQLite job index for the local render mill.
 *
 * Rows are jobs, not content. MP4 / SRT / poster / manifest live on disk.
 * Node 20 has no node:sqlite; sql.js is the same SQLite C, in-process.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const MILL_JOB_STATUSES = Object.freeze(['queued', 'running', 'done', 'error']);

const SCHEMA = `CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  program_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  artifact_path TEXT,
  error TEXT
)`;

let sqlJsPromise;

function loadSqlJs() {
  if (!sqlJsPromise) {
    const initSqlJs = require('sql.js');
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

function persist(db) {
  if (!db.path) return;
  writeFileSync(db.path, Buffer.from(db.sql.export()));
}

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    program_hash: row.program_hash,
    status: row.status,
    artifact_path: row.artifact_path ?? null,
    error: row.error ?? null
  };
}

export async function openMillDb(path) {
  const SQL = await loadSqlJs();
  const persistPath = path && path !== ':memory:' ? path : null;
  let sql;
  if (persistPath && existsSync(persistPath)) {
    sql = new SQL.Database(readFileSync(persistPath));
  } else {
    sql = new SQL.Database();
    if (persistPath) mkdirSync(dirname(persistPath), { recursive: true });
  }
  sql.run(SCHEMA);
  const db = { sql, path: persistPath };
  persist(db);
  return db;
}

export function closeMillDb(db) {
  if (!db?.sql) return;
  persist(db);
  db.sql.close();
  db.sql = null;
}

export function insertMillJob(db, { id, program_hash, status = 'queued' }) {
  db.sql.run(
    'INSERT INTO jobs (id, program_hash, status, artifact_path, error) VALUES (?, ?, ?, NULL, NULL)',
    [id, program_hash, status]
  );
  persist(db);
  return getMillJob(db, id);
}

export function getMillJob(db, id) {
  const stmt = db.sql.prepare(
    'SELECT id, program_hash, status, artifact_path, error FROM jobs WHERE id = ?'
  );
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return normalize(row);
}

export function updateMillJob(db, id, patch = {}) {
  const current = getMillJob(db, id);
  if (!current) return null;
  const next = { ...current, ...patch };
  db.sql.run(
    'UPDATE jobs SET program_hash = ?, status = ?, artifact_path = ?, error = ? WHERE id = ?',
    [next.program_hash, next.status, next.artifact_path, next.error, id]
  );
  persist(db);
  return getMillJob(db, id);
}

export function claimNextMillJob(db) {
  const stmt = db.sql.prepare(
    "SELECT id, program_hash, status, artifact_path, error FROM jobs WHERE status = 'queued' LIMIT 1"
  );
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) return null;
  return updateMillJob(db, row.id, { status: 'running', error: null });
}
