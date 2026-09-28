/**
 * Routes that once spent SyberLabs inference credentials. They are retired,
 * not removed: a tab opened before this release still calls them, and it
 * must get a clear answer that costs nothing, never a silent SPA page or a
 * paid model call. No handler here reads any credential.
 */
export const RETIRED_INFERENCE_ROUTES = Object.freeze([
  '/api/jev-recommend',
  '/api/jev-decision',
  '/api/jev/route',
  '/api/jev-visual-score',
  '/api/enterprise-decision',
  '/api/personal-piece'
]);

export const RETIRED_MESSAGE = 'RISE no longer pays for AI requests. Reload RISE, then connect your own OpenRouter account or run RISE locally. Reading and manual settings still work.';

export function isRetiredInferenceRoute(path) {
  return RETIRED_INFERENCE_ROUTES.includes(path);
}

export function retiredInference() {
  return new Response(JSON.stringify({ error: { code: 'SHARED_INFERENCE_RETIRED', message: RETIRED_MESSAGE } }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
