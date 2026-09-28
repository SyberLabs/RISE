const JEV_ROUTES = new Set([
  'experience_program',
  'agent_operation_set'
]);

/**
 * Ask Decision service which existing RISE output schema best fits this request.
 * Credentials are held by the server. The legacy argument is never forwarded.
 */
export async function requestJevRoute(apiKey, { intent, targetWords } = {}) {

  const response = await fetch('/api/jev/route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ intent, targetWords })
  });

  if (!response.ok) {
    throw new Error(`Decision service routing failed with HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (!result || !JEV_ROUTES.has(result.route)) {
    throw new TypeError('Decision service returned an unsupported route.');
  }
  if (typeof result.confidence !== 'number'
    || !Number.isFinite(result.confidence)
    || result.confidence < 0
    || result.confidence > 1) {
    throw new TypeError('Decision service returned an invalid confidence value.');
  }

  return {
    route: result.route,
    confidence: result.confidence,
    model: typeof result.model === 'string' ? result.model : null,
    ...(result.provider === 'Kev' ? { provider: result.provider, revision: result.revision } : {})
  };
}
