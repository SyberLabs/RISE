import { isKevWorkerScript, serveKevWorkerScript } from './kev-worker-script.mjs';
import { isRetiredInferenceRoute, retiredInference } from './retired-inference.mjs';
import { handleLiveRealtime } from './live-realtime.mjs';
import { handleLive, handleMcp, MCP_PATH } from './mcp-server.mjs';
import { handlePlus, isPlusRoute } from './plus.mjs';

// The Plus allowance meter, a Durable Object class the configurations bind as PLUS_METER.
export { PlusMeter } from './plus.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function error(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: JSON_HEADERS
  });
}

// Frozen Decision Arena files (docs/specs/ARCHITECTURE.md §8.47). A missing one
// is a 404: the app shell must never be served, and cached, as a run file.
async function serveArenaFile(request, env) {
  const path = new URL(request.url).pathname;
  const asset = await env.ASSETS.fetch(request);
  const type = asset.headers.get('Content-Type') ?? '';
  if (asset.status === 304) return asset;
  if (!asset.ok || type.includes('text/html')) return error(404, 'NOT_FOUND', 'No such arena file.');
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', path.endsWith('/index.json')
    ? 'public, max-age=0, must-revalidate'
    : 'public, max-age=31536000, immutable');
  return new Response(asset.body, { status: asset.status, headers });
}

// RFC 9116. The contact is the one PRIVACY.md and terms.html publish; renew Expires before it passes
// (worker/index.test.js fails once it has).
const SECURITY_TXT = [
  'Contact: mailto:syberlabs.software@gmail.com',
  'Expires: 2027-10-09T00:00:00Z',
  'Preferred-Languages: en',
  'Canonical: https://rise.syberlabs.io/.well-known/security.txt',
  ''
].join('\n');

// /.well-known/ answers only what RISE publishes. An authless MCP server has no authorization
// metadata, and a 404 is how a client learns that; the app shell here would read as a success.
function serveWellKnown(request, path) {
  if (path === '/.well-known/security.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
    return new Response(request.method === 'HEAD' ? null : SECURITY_TXT, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }
    });
  }
  return error(404, 'NOT_FOUND', 'Nothing is published at this address.');
}

// Shared model inference is retired. The reader's browser connects to their
// own provider; the Worker keeps only disabled local-key routes.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path.startsWith('/.well-known/')) return serveWellKnown(request, path);
    if (isKevWorkerScript(path)) return serveKevWorkerScript(request, env);
    if (isRetiredInferenceRoute(path)) return retiredInference();
    if (path.startsWith('/content/arena/')) return serveArenaFile(request, env);

    // Optional integration routes remain available but are disabled by default.
    if (path === MCP_PATH) return handleMcp(request, env);
    if (path === '/live') return handleLive(request, env);
    if (path === '/api/live/realtime') return handleLiveRealtime(request, env);
    // The paid voice: a Stripe receipt in a signed cookie, metered by PlusMeter (worker/plus.mjs).
    if (isPlusRoute(path)) return handlePlus(request, env);

    return error(404, 'NOT_FOUND', 'API route not found.');
  }
};
