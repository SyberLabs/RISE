const CATALOG_URL = 'https://rise.syberlabs.io/api/decision-catalog';
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

/**
 * Netlify serves the reader shell on previews and rise.syberlabs.space. Proxy
 * the public catalog to its Cloudflare Worker origin so both deployments use
 * the same rate-limited, Neon-backed catalog without copying database secrets
 * into Netlify or exposing a cross-origin API to the browser.
 */
export default async function decisionCatalog(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return error(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.');
  }

  try {
    const upstream = await fetch(CATALOG_URL, {
      method: request.method,
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000)
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return error(502, 'CATALOG_UNAVAILABLE', 'The reading catalog is unavailable.');
    }
    const headers = new Headers();
    for (const name of ['Content-Type', 'Cache-Control', 'X-Content-Type-Options']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers
    });
  } catch {
    return error(503, 'CATALOG_UNAVAILABLE', 'The reading catalog is unavailable.');
  }
}

export const config = { path: '/api/decision-catalog' };
