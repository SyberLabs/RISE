import { isKevWorkerScript, serveKevWorkerScript } from './kev-worker-script.mjs';
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
// own provider; the Worker keeps only disabled local-key routes.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (isKevWorkerScript(path)) return serveKevWorkerScript(request, env);
    if (isRetiredInferenceRoute(path)) return retiredInference();

    // Optional integration routes remain available but are disabled by default.
    if (path === MCP_PATH) return handleMcp(request, env);
    if (path === '/live') return handleLive(request, env);
    if (path === '/api/live/realtime') return handleLiveRealtime(request, env);

    return error(404, 'NOT_FOUND', 'API route not found.');
  }
};
