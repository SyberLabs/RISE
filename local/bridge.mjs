/**
 * The local RISE bridge: one loopback HTTP server that serves the built app,
 * the public catalog, and exactly one model route, POST /api/local/kev/systemone,
 * which it forwards to the pinned Kev server on another loopback port with a
 * per-run bearer key the page never sees.
 *
 * It is not a proxy. The upstream address is fixed at start; nothing in a
 * request can choose a host, path, or provider. Requests from other websites
 * are refused by Host (DNS rebinding) and Origin (cross-site requests) checks.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

export const KEV_ROUTE = '/api/local/kev/systemone';
export const STATUS_ROUTE = '/api/local/status';
export const CATALOG_ROUTE = '/api/decision-catalog';
export const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_QUESTIONS = 64;
const LOOPBACK = new Set(['127.0.0.1', 'localhost']);

// The production policy minus the one host local RISE never needs (OpenRouter).
export const LOCAL_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; "
  + "img-src 'self' data: blob: https:; media-src 'self' blob:; worker-src 'self' blob:; "
  + "connect-src 'self' https://www.gutenberg.org https://corsproxy.io https://export.arxiv.org https://commons.wikimedia.org "
  + 'https://upload.wikimedia.org https://api.artic.edu https://www.artic.edu https://collectionapi.metmuseum.org '
  + "https://openaccess-api.clevelandart.org https://id.rijksmuseum.nl; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8'
};

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function refuse(res, status, code, message) {
  json(res, status, { error: { code, message } });
}

/** The exact origins this server may be addressed as. */
export function allowedOrigins(port) {
  return new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
}

export function hostAllowed(host, port) {
  if (typeof host !== 'string') return false;
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/u.exec(host.toLowerCase());
  return Boolean(match && LOOPBACK.has(match[1]) && Number(match[2]) === port);
}

/** A System One request with nothing a page could use to steer the server. */
export function systemOneBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.some(key => !['model', 'state', 'questions'].includes(key))) return null;
  if (value.model !== undefined && value.model !== 'kev-latest') return null;
  if (typeof value.state !== 'string' && (typeof value.state !== 'object' || value.state === null || Array.isArray(value.state))) return null;
  const questions = value.questions;
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) return null;
  const entries = Object.entries(questions);
  if (entries.length < 1 || entries.length > MAX_QUESTIONS) return null;
  for (const [id, question] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(id) || question?.type !== 'choice'
      || typeof question.instructions !== 'string' || !question.criteria
      || typeof question.criteria !== 'object' || Array.isArray(question.criteria)) return null;
  }
  return { model: 'kev-latest', state: value.state, questions };
}

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { tooLarge: true };
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) return { tooLarge: true };
    chunks.push(chunk);
  }
  try {
    return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { value: null };
  }
}

async function forwardToKev(req, res, { kev, port }) {
  const origin = req.headers.origin;
  if (!allowedOrigins(port).has(origin) || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
    return refuse(res, 403, 'ORIGIN_NOT_ALLOWED', 'Only this local RISE page may use Kev.');
  }
  if ((req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return refuse(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }
  const status = kev.status();
  if (status.state !== 'ready') return refuse(res, 503, 'KEV_NOT_READY', 'Kev is not ready yet.');
  const body = await readBody(req);
  if (body.tooLarge) return refuse(res, 413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
  const request = systemOneBody(body.value);
  if (!request) return refuse(res, 400, 'INVALID_REQUEST', 'Expected a System One choice request.');
  let upstream;
  try {
    upstream = await fetch(`http://127.0.0.1:${kev.port}/v1/systemone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kev.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (cause) {
    return refuse(res, cause?.name === 'TimeoutError' ? 504 : 502, 'KEV_UNREACHABLE', 'Kev did not answer.');
  }
  const text = await upstream.text();
  if (!upstream.ok) return refuse(res, upstream.status === 422 ? 400 : 502, 'KEV_ERROR', 'Kev could not answer this request.');
  const revision = upstream.headers.get('x-kev-revision');
  send(res, 200, text, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    ...(revision ? { 'X-Kev-Revision': revision } : {})
  });
}

async function serveStatic(req, res, { distDir, indexHtml }) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '', { Allow: 'GET, HEAD' });
  const url = new URL(req.url, 'http://local');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, ''); }
  const root = resolve(distDir);
  const file = resolve(root, `.${normalize(pathname)}`);
  const inside = file === root || file.startsWith(root + sep);
  let target = null;
  if (inside && pathname !== '/' && !pathname.endsWith('/')) {
    try { if ((await stat(file)).isFile()) target = file; } catch { target = null; }
  }
  const headers = { 'Content-Security-Policy': LOCAL_CSP };
  if (!target) {
    // Single-page app: unknown paths get the marked shell, missing assets 404.
    if (/\.[a-z0-9]+$/iu.test(pathname) && !pathname.endsWith('.html')) return send(res, 404, 'Not found', headers);
    return send(res, 200, req.method === 'HEAD' ? '' : indexHtml(),
      { ...headers, 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
  }
  if (target === join(root, 'index.html')) {
    return send(res, 200, req.method === 'HEAD' ? '' : indexHtml(), { ...headers, 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
  }
  const data = await readFile(target);
  send(res, 200, req.method === 'HEAD' ? '' : data, {
    ...headers, 'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
}

/** Mark the shell so the app knows it is local RISE (ai-connection.js isLocalRise). */
export function markLocal(html) {
  return html.replace('<head>', '<head>\n    <meta name="rise-local" content="1">');
}

/**
 * @param options.distDir built app directory
 * @param options.port the loopback port this server listens on
 * @param options.kev { port, token, status(): { state, revision, device, message } }
 * @param options.catalog () => public catalog JSON
 */
export async function createBridge({ distDir, port, kev, catalog }) {
  const html = markLocal(await readFile(join(distDir, 'index.html'), 'utf8'));
  const server = createServer(async (req, res) => {
    try {
      if (!hostAllowed(req.headers.host, port)) {
        return refuse(res, 421, 'HOST_NOT_ALLOWED', 'Local RISE answers only on its own loopback address.');
      }
      const { pathname } = new URL(req.url, 'http://local');
      if (pathname === STATUS_ROUTE) {
        if (req.method !== 'GET') return refuse(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET.');
        const status = kev.status();
        return json(res, 200, { rise: 'local', kev: {
          state: status.state, revision: status.revision || null,
          device: status.device || null, message: status.message || null
        } });
      }
      if (pathname === CATALOG_ROUTE) {
        if (req.method !== 'GET') return refuse(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET.');
        return json(res, 200, catalog());
      }
      if (pathname === KEV_ROUTE) {
        if (req.method !== 'POST') return refuse(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST.');
        return await forwardToKev(req, res, { kev, port });
      }
      if (pathname.startsWith('/api/')) return refuse(res, 404, 'NOT_FOUND', 'API route not found.');
      return await serveStatic(req, res, { distDir, indexHtml: () => html });
    } catch {
      if (!res.headersSent) refuse(res, 500, 'LOCAL_ERROR', 'Local RISE could not answer.');
      else res.destroy();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  return server;
}
