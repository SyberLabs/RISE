import { handleJevDecision } from '../netlify/functions/jev-decision.mjs';
import handleJevRoute from '../netlify/functions/jev-route.mjs';
import { handleJevRecommend } from './jev-recommend.mjs';
import { handlePersonalPiece } from './personal-piece.mjs';

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

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path === '/api/personal-piece') return handlePersonalPiece(request, env);

    if (path === '/api/jev-decision' || path === '/api/jev-recommend') {
      const ip = request.headers.get('CF-Connecting-IP')?.trim();
      if (!ip || !env?.OPENROUTER_API_KEY?.trim() || typeof env?.DECISION_LIMITER?.limit !== 'function') {
        return error(503, 'DECISION_NOT_CONFIGURED', 'Decision service is unavailable.');
      }

      try {
        const result = await env.DECISION_LIMITER.limit({ key: ip });
        if (!result?.success) {
          return error(429, 'RATE_LIMITED', 'Too many decision requests.');
        }
      } catch {
        return error(503, 'DECISION_NOT_CONFIGURED', 'Decision service is unavailable.');
      }

      return path === '/api/jev-recommend'
        ? handleJevRecommend(request, env)
        : handleJevDecision(request, env.OPENROUTER_API_KEY);
    }

    if (path === '/api/jev/route') {
      return handleJevRoute(request);
    }

    return error(404, 'NOT_FOUND', 'API route not found.');
  }
};
