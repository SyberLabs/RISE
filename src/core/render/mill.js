/**
 * Localhost mill: POST /v1/render → SQLite job → renderArtifact.
 *
 * One Node process. Same kernel as the CLI. Not Postgres, not a CMS,
 * not users/follows/feeds, not Instagram. Human publish stays a gate.
 */

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from './errors.js';
import { contentHashOf } from './hash.js';
import {
  classifyRenderDocument,
  materializeExportJob
} from './intake.js';
import {
  openMillDb,
  closeMillDb,
  insertMillJob,
  getMillJob,
  updateMillJob,
  claimNextMillJob
} from './mill-db.js';

export {
  getMillJob,
  MILL_JOB_STATUSES
} from './mill-db.js';

export const MILL_HOST = '127.0.0.1';
export const MILL_DEFAULT_PORT = 8787;
export const MILL_RENDER_PATH = '/v1/render';

const MAX_BODY_BYTES = 2_500_000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(Object.assign(new Error('Render job JSON is too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function requestPath(req) {
  try {
    return new URL(req.url || '/', 'http://127.0.0.1').pathname;
  } catch {
    return '/';
  }
}

async function programHashForDocument(document) {
  const kind = classifyRenderDocument(document);
  if (kind === 'kernel') {
    if (!document.program) {
      fail('RENDER_KERNEL_PROGRAM', 'Kernel request needs an Experience Program', '$.program');
    }
    return contentHashOf(document.program);
  }
  if (kind === 'program-envelope') return contentHashOf(document.program);
  if (kind === 'operations-envelope') return contentHashOf(document.operationSet);
  return contentHashOf(document);
}

function jobPublic(row) {
  return {
    id: row.id,
    program_hash: row.program_hash,
    status: row.status,
    artifact_path: row.artifact_path,
    error: row.error
  };
}

export async function createMill({ root, render } = {}) {
  if (!root) fail('RENDER_MILL_ROOT', 'Mill needs a filesystem root', '$.root');
  mkdirSync(root, { recursive: true });
  const jobsDir = join(root, 'jobs');
  mkdirSync(jobsDir, { recursive: true });
  const db = await openMillDb(join(root, 'mill.sqlite'));
  return {
    root,
    jobsDir,
    db,
    render: render || materializeExportJob,
    draining: false,
    drainPromise: null
  };
}

export function closeMill(mill) {
  closeMillDb(mill.db);
}

export async function admitMillJob(mill, document) {
  const program_hash = await programHashForDocument(document);
  const id = `job-${randomUUID()}`;
  const outDir = join(mill.jobsDir, id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'request.json'), `${JSON.stringify(document, null, 2)}\n`);
  const row = insertMillJob(mill.db, { id, program_hash, status: 'queued' });
  return { ...row, outDir };
}

async function drainOne(mill) {
  const job = claimNextMillJob(mill.db);
  if (!job) return false;
  const outDir = join(mill.jobsDir, job.id);
  try {
    const document = JSON.parse(readFileSync(join(outDir, 'request.json'), 'utf8'));
    const artifact = await mill.render({
      document,
      outDir,
      options: {
        painter: document.painter,
        scale: document.scale,
        profileId: document.profileId,
        outputPath: join(outDir, 'experience.mp4')
      }
    });
    updateMillJob(mill.db, job.id, {
      status: 'done',
      artifact_path: artifact.mp4Path,
      error: null
    });
  } catch (error) {
    updateMillJob(mill.db, job.id, {
      status: 'error',
      error: error.message || String(error)
    });
  }
  return true;
}

export async function drainMill(mill) {
  if (mill.draining) return mill.drainPromise;
  mill.draining = true;
  mill.drainPromise = (async () => {
    try {
      while (await drainOne(mill)) {}
    } finally {
      mill.draining = false;
    }
  })();
  return mill.drainPromise;
}

export async function handleMillRequest(mill, req, res) {
  const pathname = requestPath(req);
  const collection = pathname === MILL_RENDER_PATH || pathname === `${MILL_RENDER_PATH}/`;
  const jobId = !collection && pathname.startsWith(`${MILL_RENDER_PATH}/`)
    ? decodeURIComponent(pathname.slice(MILL_RENDER_PATH.length + 1))
    : null;

  if (collection) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      send(res, 200, { ok: true, mill: true, kernel: 'renderArtifact' });
      return;
    }
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: 'POST a rise.kernel-request.v1 JSON body' });
      return;
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch (error) {
      send(res, error.status || 400, { ok: false, error: error.message });
      return;
    }
    let document;
    try {
      document = JSON.parse(raw);
    } catch (error) {
      send(res, 400, { ok: false, error: `Invalid JSON: ${error.message}` });
      return;
    }
    try {
      const job = await admitMillJob(mill, document);
      send(res, 202, { ok: true, ...jobPublic(job) });
    } catch (error) {
      send(res, 400, {
        ok: false,
        error: error.message || String(error),
        code: error.code || null
      });
    }
    return;
  }

  if (jobId && !jobId.includes('/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, { ok: false, error: 'GET a job by id' });
      return;
    }
    const row = getMillJob(mill.db, jobId);
    if (!row) {
      send(res, 404, { ok: false, error: 'Unknown job' });
      return;
    }
    send(res, 200, { ok: true, ...jobPublic(row) });
    return;
  }

  send(res, 404, { ok: false, error: 'Not found' });
}

export function startMill(mill, { port = MILL_DEFAULT_PORT, host = MILL_HOST } = {}) {
  const server = createServer((req, res) => {
    const method = req.method;
    void handleMillRequest(mill, req, res)
      .catch(error => {
        if (!res.writableEnded) {
          send(res, 500, { ok: false, error: error.message || String(error) });
        }
      })
      .finally(() => {
        if (method === 'POST') void drainMill(mill);
      });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        host,
        port: address.port,
        url: `http://${host}:${address.port}`
      });
    });
  });
}
