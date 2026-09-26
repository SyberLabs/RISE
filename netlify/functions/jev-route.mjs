const CHOICES = {
  experience_program: 'The intent is to create or curate a reading, learning, or other human-facing experience whose central output is a program of content.',
  agent_operation_set: 'The intent is to define or perform operational work through an agent, including concrete actions, workflows, or tool use.'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
});

export const config = { method: ['POST'], path: '/api/jev/route' };

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) return json({ error: 'A TypeSafe API key is required.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
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
    upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${match[1]}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: { intent, targetWords },
        questions: {
          route: {
            type: 'choice',
            instructions: 'Choose the one route that best fits the requested outcome.',
            criteria: CHOICES
          }
        }
      }),
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    return json({ error: error?.name === 'TimeoutError' ? 'TypeSafe request timed out.' : 'TypeSafe request failed.' }, error?.name === 'TimeoutError' ? 504 : 502);
  }

  if (!upstream.ok) return json({ error: 'TypeSafe could not process the request.' }, 502);

  let result;
  try {
    result = await upstream.json();
  } catch {
    return json({ error: 'TypeSafe returned an invalid response.' }, 502);
  }

  const answer = result?.answers?.route;
  if (
    answer?.type !== 'choice' ||
    !Object.hasOwn(CHOICES, answer.choice) ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 || answer.confidence > 1
  ) {
    return json({ error: 'TypeSafe returned an invalid route decision.' }, 502);
  }

  return json({ route: answer.choice, confidence: answer.confidence, model: 'jev-latest' });
};
