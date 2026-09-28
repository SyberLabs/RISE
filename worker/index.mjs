import { isKevWorkerScript, serveKevWorkerScript } from './kev-worker-script.mjs';
import { handleDecisionCatalog } from './decision-catalog.mjs';
import { isRetiredInferenceRoute, retiredInference } from './retired-inference.mjs';

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

// This Worker performs no model inference and holds no model credential.
// Decisions run in the reader's browser on the reader's own connection.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (isKevWorkerScript(path)) return serveKevWorkerScript(request, env);

    if (isRetiredInferenceRoute(path)) return retiredInference();

    if (path === '/api/decision-catalog') {
      // The catalog reads Neon through a short Redis cache; the limiter keeps
      // a flood of uncached reads off the database.
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
