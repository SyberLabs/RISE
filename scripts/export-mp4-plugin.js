/**
 * Dev-server hopper: Workshop Export MP4 writes a kernel request and
 * the same Node kernel the CLI uses muxes the file.
 *
 * Not the mill. No SQLite, no POST /v1/render. Production builds have
 * no write path — Workshop then downloads the JSON for `npm run render:mp4`.
 */

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { EXPORT_MP4_PATH } from '../src/core/render/kernel-request.js';

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
        reject(Object.assign(new Error('Export job JSON is too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function exportMp4Plugin({ root = process.cwd() } = {}) {
  return {
    name: 'rise-export-mp4',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(EXPORT_MP4_PATH, (req, res) => {
        void handleExportMp4(req, res, { root });
      });
    }
  };
}

export async function handleExportMp4(req, res, { root = process.cwd() } = {}) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    send(res, 200, { ok: true, available: true, kernel: 'renderArtifact' });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'POST a kernel request or program JSON' });
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
  const outDir = join(resolve(root, 'out', 'workshop-export'), `export-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  try {
    const { materializeExportJob } = await import('../src/core/render/intake.js');
    const artifact = await materializeExportJob({
      document,
      outDir,
      options: {
        painter: document.painter || 'chamber',
        scale: document.scale,
        profileId: document.profileId
      }
    });
    send(res, 200, {
      ok: true,
      mp4Path: artifact.mp4Path,
      outDir: artifact.outDir,
      requestPath: artifact.requestPath,
      jobHash: artifact.jobHash
    });
  } catch (error) {
    send(res, 400, {
      ok: false,
      error: error.message || String(error),
      code: error.code || null
    });
  }
}
