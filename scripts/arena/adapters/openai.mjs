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
// The guide states no question limit. If all 28 are refused in one call, the
// questions are split, in order, into calls of 14 and then 7.
export const SPLITS = Object.freeze([28, 14, 7]);
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

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) },
  (_, index) => list.slice(index * size, (index + 1) * size));

export function openaiDecider({ env = process.env, fetchImpl = fetch } = {}) {
  const key = env.OPENAI_API_KEY || '';
  if (key.length < 20) throw new Error('The openai decider needs OPENAI_API_KEY: the operator’s own key. Each case is billed to that account.');
  let perCall = null; // settled by the first call that is accepted

  async function post(input, questions) {
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
      return { status: response.status };
    }
    try {
      const value = await response.json();
      if (!Array.isArray(value?.answers)) throw new Error();
      return { value };
    } catch {
      throw new DecisionError('INVALID_RESPONSE');
    }
  }

  async function ask(input, questions, size) {
    const values = [];
    for (const group of chunks(questions, size)) {
      const { status, value } = await post(input, group);
      if (status) return { status };
      values.push(value);
    }
    return { values };
  }

  return {
    id: 'openai', requestedModel: OPENAI_MODEL, revision: null, pricing: PRICING,
    get questionsPerCall() { return perCall; },
    // About four characters make a token; two per token leaves room for splits.
    estimateUsd: body => Math.ceil(JSON.stringify(toOpenAI(body)).length / 2)
      * PRICING.inputUsdPerMillionTokens / 1e6,
    async decide({ body }) {
      const { input, questions } = toOpenAI(body);
      let result;
      for (const size of perCall ? [perCall] : SPLITS) {
        result = await ask(input, questions, size);
        if (result.values) { perCall = size; break; }
        if (perCall || result.status !== 400) break;
      }
      if (!result.values) throw new DecisionError(`HTTP_${result.status}`);
      const answers = {};
      const probabilities = {};
      let inputTokens = 0;
      let reported = true;
      const served = new Set();
      for (const value of result.values) {
        const tokens = value.usage?.input_tokens ?? value.usage?.prompt_tokens;
        if (Number.isFinite(tokens)) inputTokens += tokens;
        else reported = false;
        if (typeof value.model === 'string') served.add(value.model);
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
      }
      return {
        answers, probabilities: Object.keys(probabilities).length ? probabilities : null,
        servedModel: served.size === 1 ? [...served][0] : served.size ? [...served].sort().join(',') : null,
        usage: reported ? { input_tokens: inputTokens, calls: result.values.length } : { calls: result.values.length },
        costUsd: reported ? inputTokens * PRICING.inputUsdPerMillionTokens / 1e6 : null,
        costSource: 'computed'
      };
    }
  };
}
