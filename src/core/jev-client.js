import { getConnection } from './ai-connection.js';
import { decideRoute } from './decision/route.js';

/**
 * Ask the reader's own decision model (Jev through their OpenRouter account,
 * or local Kev) which existing RISE output schema best fits this request.
 * No SyberLabs service is involved. The legacy argument is never forwarded.
 */
export async function requestJevRoute(_legacyKey, { intent, targetWords } = {}, { signal } = {}) {
  return decideRoute(getConnection(), { intent, targetWords }, { signal });
}
