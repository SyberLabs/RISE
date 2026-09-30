import { isKevWorkerScript, serveKevWorkerScript } from './kev-worker-script.mjs';
import { handleDecisionCatalog } from './decision-catalog.mjs';
import { isRetiredInferenceRoute, retiredInference } from './retired-inference.mjs';
import { handleLiveRealtime } from './live-realtime.mjs';
import { handleLive, handleMcp, MCP_PATH } from './mcp-server.mjs';

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

// Shared model inference is retired. The reader's browser connects to their
// own provider; the Worker keeps only the public catalog and disabled local-key routes.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (isKevWorkerScript(path)) return serveKevWorkerScript(request, env);
    if (isRetiredInferenceRoute(path)) return retiredInference();

    // Optional integration routes remain available but are disabled by default.
    if (path === MCP_PATH) return handleMcp(request, env);
    if (path === '/live') return handleLive(request, env);
    if (path === '/api/live/realtime') return handleLiveRealtime(request, env);

    if (path === '/api/decision-catalog') {
      // The public catalog reads Neon through a short Redis cache; the limiter
      // keeps a flood of uncached reads off the database.
      const ip = request.headers.get('CF-Connecting-IP')?.trim();
      if (!ip || typeof env?.DECISION_LIMITER?.limit !== 'function') {
        return error(503, 'CATALOG_NOT_CONFIGURED', 'The reading catalog is unavailable.');
      }
      try {
        const result = await env.DECISION_LIMITER.limit({ key: ip });
        if (!result?.success) return error(429, 'RATE_LIMITED', 'Too many catalog requests.');
      } catch {
        return error(503, 'CATALOG_NOT_CONFIGURED', 'The reading catalog is unavailable.');
      }
      return handleDecisionCatalog(request, env);
    }

    return error(404, 'NOT_FOUND', 'API route not found.');
  }
};
