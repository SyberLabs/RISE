// Jev through the operator's own OpenRouter key: the same connection and the
// same single bounded call the browser makes (decision-eval's live mode).
import { callDecision } from '../../../src/core/decision/call.js';
import { JEV } from '../../../src/core/decision/providers.js';
import { connectionFor, DEADLINE_MS } from '../../decision-eval.mjs';

// OpenRouter publishes no Decisions price for Jev; until a call reports its
// billed cost, each one is budgeted at this ceiling.
export const JEV_ESTIMATE_USD = 0.05;

/** Only numeric usage fields are kept; nothing else from the envelope is stored. */
export function usageOf(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const kept = Object.fromEntries(Object.entries(usage).filter(([, value]) => Number.isFinite(value)));
  return Object.keys(kept).length ? kept : null;
}

/** [{value, probability}] from either that array or a {value: probability} map. */
export function probabilityList(value) {
  const pairs = Array.isArray(value) ? value.map(item => [item?.value, item?.probability])
    : value && typeof value === 'object' ? Object.entries(value) : [];
  const list = pairs.filter(([option, p]) => typeof option === 'string' && Number.isFinite(p))
    .map(([option, probability]) => ({ value: option, probability }));
  return list.length ? list : null;
}

/** A System One answers object, reduced to choices, confidence and probabilities. */
export function fromSystemOne(answers) {
  const raw = {};
  const probabilities = {};
  for (const [name, answer] of Object.entries(answers || {})) {
    if (answer?.type !== 'choice' || typeof answer.choice !== 'string') {
      raw[name] = { type: typeof answer?.type === 'string' ? answer.type : 'invalid' };
      continue;
    }
    raw[name] = { type: 'choice', choice: answer.choice,
      ...(Number.isFinite(answer.confidence) ? { confidence: answer.confidence } : {}) };
    const list = probabilityList(answer.probabilities);
    if (list) probabilities[name] = list;
  }
  return { answers: raw, probabilities: Object.keys(probabilities).length ? probabilities : null };
}

export function jevDecider({ env = process.env, fetchImpl = fetch } = {}) {
  const connection = connectionFor('live', { env, fetchImpl });
  return {
    id: 'jev', requestedModel: JEV.model, revision: null,
    pricing: { source: 'OpenRouter usage.cost, billed per request', asOf: null },
    estimateUsd: () => JEV_ESTIMATE_USD,
    async decide({ body }) {
      const value = await callDecision(connection, body, { deadlineMs: DEADLINE_MS });
      const usage = usageOf(value.usage);
      return { ...fromSystemOne(value.answers), servedModel: value.model, usage,
        costUsd: Number.isFinite(usage?.cost) ? usage.cost : null, costSource: 'billed' };
    }
  };
}
