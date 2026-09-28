import { decisionProvider, validProviderResult, validProviderResponse, decisionIdentity } from '../../server/decision-provider.mjs';
import { readJson } from './jev-decision.mjs';

const CHOICES = {
  experience_program: 'The intent is to create or curate a reading, learning, or other human-facing experience whose central output is a program of content.',
  agent_operation_set: 'The intent is to define or perform operational work through an agent, including concrete actions, workflows, or tool use.'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export const config = { method: ['POST'], path: '/api/jev/route',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: 'ip' } };

export async function handleJevRoute(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return json({ error: 'Request must come from this site.' }, 403);
  }
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const provider = decisionProvider(env);
  if (!provider) return json({ error: 'Decision service is unavailable.' }, 503);

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.status === 413 ? 'Request body exceeds 32 KB.' : 'Request body must be valid JSON.' }, error.status === 413 ? 413 : 400);
  }

  const { intent, targetWords } = body ?? {};
  if (typeof intent !== 'string' || intent.trim().length === 0 || intent.length > 2000) {
    return json({ error: 'Intent must be a non-empty string of at most 2000 characters.' }, 400);
  }
  if (!Number.isInteger(targetWords) || targetWords < 400 || targetWords > 18000) {
    return json({ error: 'targetWords must be an integer from 400 to 18000.' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: provider.model,
        state: { intent, targetWords },
        questions: {
          route: {
            type: 'choice',
            instructions: 'Choose the one route that best fits the requested outcome.',
            criteria: CHOICES
          }
        }
      }),
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)])
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return json({ error: timedOut ? 'Decision service timed out.' : 'Decision service failed.' }, timedOut ? 504 : 502);
  }

  if (!upstream.ok) return json({ error: 'Decision service could not process the request.' }, 502);
  if (!validProviderResponse(upstream, provider)) return json({ error: 'Decision service returned an unexpected checkpoint.' }, 502);

  let result;
  try {
    result = await upstream.json();
  } catch {
    return json({ error: 'Decision service returned an invalid response.' }, 502);
  }

  const answer = result?.answers?.route;
  if (
    !validProviderResult(result, provider) || answer?.type !== 'choice' ||
    !Object.hasOwn(CHOICES, answer.choice) ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 || answer.confidence > 1
  ) {
    return json({ error: 'Decision service returned an invalid route decision.' }, 502);
  }

  return json({ route: answer.choice, confidence: answer.confidence, model: result.model, ...decisionIdentity(provider) });
}

export default function route(request) { return handleJevRoute(request, process.env); }
