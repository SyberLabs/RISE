// Pinned Kev through a running local RISE. callDecision admits an answer only
// with the X-Kev-Revision attestation, so a returned answer is that revision.
import { callDecision } from '../../../src/core/decision/call.js';
import { KEV } from '../../../src/core/decision/providers.js';
import { connectionFor, DEADLINE_MS } from '../../decision-eval.mjs';
import { fromSystemOne, usageOf } from './jev.mjs';

export function kevDecider({ origin = 'http://127.0.0.1:5780', fetchImpl = fetch } = {}) {
  const connection = connectionFor('local', { origin, fetchImpl });
  return {
    id: 'kev', requestedModel: KEV.model, revision: KEV.revision,
    pricing: { source: 'none: runs on the operator’s computer', asOf: null },
    estimateUsd: () => 0,
    async decide({ body }) {
      const value = await callDecision(connection, body, { deadlineMs: DEADLINE_MS });
      return { ...fromSystemOne(value.answers), servedModel: value.model,
        usage: usageOf(value.usage), costUsd: 0, costSource: 'zero' };
    }
  };
}
