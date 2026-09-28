/**
 * Scriptorium model routing: which existing output schema fits a request.
 * One finite choice on the reader's own connection; a recommendation only.
 */
import { callDecision, DecisionError } from './call.js';
import { decisionIdentity } from './providers.js';

export const ROUTE_CHOICES = Object.freeze({
  experience_program: 'The intent is to create or curate a reading, learning, or other human-facing experience whose central output is a program of content.',
  agent_operation_set: 'The intent is to define or perform operational work through an agent, including concrete actions, workflows, or tool use.'
});
const ROUTE_DEADLINE_MS = 12000;

export function buildRouteRequest({ intent, targetWords }) {
  if (typeof intent !== 'string' || !intent.trim() || intent.length > 2000
    || !Number.isInteger(targetWords) || targetWords < 400 || targetWords > 18000) {
    throw new DecisionError('INVALID_REQUEST', 'The routing request is invalid.');
  }
  return {
    state: { intent, targetWords },
    questions: { route: {
      type: 'choice',
      instructions: 'Choose the one route that best fits the requested outcome.',
      criteria: ROUTE_CHOICES
    } }
  };
}

export function readRouteAnswer(result, provider) {
  const answer = result?.answers?.route;
  if (answer?.type !== 'choice' || !Object.hasOwn(ROUTE_CHOICES, answer.choice)
    || !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) return null;
  return { route: answer.choice, confidence: answer.confidence, model: result.model, ...decisionIdentity(provider) };
}

export async function decideRoute(connection, input, { signal } = {}) {
  const body = buildRouteRequest(input);
  const result = await callDecision(connection, body, { signal, deadlineMs: ROUTE_DEADLINE_MS });
  const route = readRouteAnswer(result, connection.provider);
  if (!route) throw new DecisionError('INVALID_RESPONSE', 'The decision model returned an invalid route decision.');
  return route;
}
