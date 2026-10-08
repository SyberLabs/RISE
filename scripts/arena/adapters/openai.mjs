// OpenAI's Decisions API (public beta, 2026-10-06) on the operator's own key.
//
// The RISE request maps one to one: each System One question becomes a
// `choice` question whose criteria become {value, description} choices, and
// the state becomes the input text. Only the operator's offline capture calls
// this; nothing under src/ knows the endpoint.
// https://developers.openai.com/api/docs/guides/decisions
import { DecisionError } from '../../../src/core/decision/call.js';
import { probabilityList } from './jev.mjs';

export const OPENAI_URL = 'https://api.openai.com/v1/decisions';
export const OPENAI_MODEL = 'gpt-6-luna';
export const PRICING = Object.freeze({ source: 'https://developers.openai.com/api/docs/guides/decisions',
  asOf: '2026-10-08', inputUsdPerMillionTokens: 0.10 });
// The guide states no question limit; all 28 go in one call, and a rejection
// is recorded as HTTP_<status>.
const DEADLINE_MS = 30000;

export function toOpenAI(body) {
  return {
    input: `Reader intent: ${body.state.reader_intent}\nExperience hint: ${body.state.experience_hint}`,
    questions: Object.entries(body.questions).map(([name, question]) => ({
      type: 'choice', name, instructions: question.instructions,
      choices: Object.entries(question.criteria).map(([value, description]) => ({ value, description }))
    }))
  };
}

export function openaiDecider({ env = process.env, fetchImpl = fetch } = {}) {
  const key = env.OPENAI_API_KEY || '';
  if (key.length < 20) throw new Error('The openai decider needs OPENAI_API_KEY: the operator’s own key. Each case is billed to that account.');
  return {
    id: 'openai', requestedModel: OPENAI_MODEL, revision: null, pricing: PRICING,
    // About four characters make a token; two per token is a conservative ceiling.
    estimateUsd: body => Math.ceil(JSON.stringify(toOpenAI(body)).length / 2)
      * PRICING.inputUsdPerMillionTokens / 1e6,
    async decide({ body }) {
      const { input, questions } = toOpenAI(body);
      let response;
      try {
        response = await fetchImpl(OPENAI_URL, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(DEADLINE_MS),
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OPENAI_MODEL, input, questions })
        });
      } catch (cause) {
        throw new DecisionError(cause?.name === 'TimeoutError' ? 'TIMEOUT' : 'UNREACHABLE');
      }
      if (!response.ok) {
        void response.body?.cancel?.().catch?.(() => {});
        throw new DecisionError(`HTTP_${response.status}`);
      }
      let value;
      try {
        value = await response.json();
        if (!Array.isArray(value?.answers)) throw new Error();
      } catch {
        throw new DecisionError('INVALID_RESPONSE');
      }
      const answers = {};
      const probabilities = {};
      for (const answer of value.answers) {
        if (typeof answer?.name !== 'string') continue;
        if (answer.type !== 'choice' || typeof answer.choice !== 'string') {
          answers[answer.name] = { type: answer.type === 'refusal' ? 'refusal' : 'invalid' };
          continue;
        }
        answers[answer.name] = { type: 'choice', choice: answer.choice,
          ...(Number.isFinite(answer.confidence) ? { confidence: answer.confidence } : {}) };
        const list = probabilityList(answer.probabilities);
        if (list) probabilities[answer.name] = list;
      }
      const tokens = value.usage?.input_tokens ?? value.usage?.prompt_tokens;
      const reported = Number.isFinite(tokens);
      return {
        answers, probabilities: Object.keys(probabilities).length ? probabilities : null,
        servedModel: typeof value.model === 'string' ? value.model : null,
        usage: reported ? { input_tokens: tokens } : null,
        costUsd: reported ? tokens * PRICING.inputUsdPerMillionTokens / 1e6 : null,
        costSource: 'computed'
      };
    }
  };
}
