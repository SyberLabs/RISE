const JEV_ROUTES = new Set([
  'experience_program',
  'agent_operation_set'
]);

/**
 * Ask JEV which existing RISE output schema best fits this request.
 * The key is supplied by the user and sent only to the same-origin route.
 */
export async function requestJevRoute(apiKey, { intent, targetWords } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) throw new TypeError('A JEV API key is required.');

  const response = await fetch('/api/jev/route', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ intent, targetWords })
  });

  if (!response.ok) {
    throw new Error(`JEV routing failed with HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (!result || !JEV_ROUTES.has(result.route)) {
    throw new TypeError('JEV returned an unsupported route.');
  }
  if (typeof result.confidence !== 'number'
    || !Number.isFinite(result.confidence)
    || result.confidence < 0
    || result.confidence > 1) {
    throw new TypeError('JEV returned an invalid confidence value.');
  }

  return {
    route: result.route,
    confidence: result.confidence,
    model: typeof result.model === 'string' ? result.model : null
  };
}
