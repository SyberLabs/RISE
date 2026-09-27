const PREFERENCES = new Set(['any', 'calm', 'energize', 'reflect']);
const MODES = new Set(['curated', 'bounded-jev']);

/** Select only from the approved, finite editorial set. No provider is contacted. */
export function selectSequence({ sequences = [], completedIds = [], preference = 'any', mode = 'curated' } = {}) {
  const started = performance.now();
  const requestedMode = mode;
  const done = Array.isArray(completedIds) ? completedIds : [];
  const eligible = Array.isArray(sequences) ? sequences.filter((sequence) =>
    sequence?.approvedForDemo === true &&
    typeof sequence.id === 'string' &&
    !done.includes(sequence.id)
  ) : [];
  const baseline = eligible[0] ?? null;
  const validRequest = MODES.has(mode) && PREFERENCES.has(preference) && Array.isArray(completedIds);
  let selected = baseline;
  let actualMode = 'curated';
  let reason = baseline ? 'editorial-order' : 'no-approved-unread-sequence';

  // One local, bounded Jev decision simulation: an explicit reader preference
  // can choose a different approved sequence when the baseline does not match.
  if (!validRequest) {
    reason = 'invalid-input-curated-fallback';
  } else if (mode === 'bounded-jev') {
    if (eligible.length < 2) {
      reason = 'insufficient-approved-options';
    } else if (preference === 'any') {
      reason = 'no-specific-preference';
    } else if (baseline.tags?.includes(preference)) {
      reason = 'editorial-choice-matches-preference';
    } else {
      const match = eligible.slice(1).find((sequence) => sequence.tags?.includes(preference));
      if (match) {
        selected = match;
        actualMode = 'bounded-jev-simulation';
        reason = 'explicit-preference-matched-approved-alternative';
      } else {
        reason = 'no-approved-preference-match';
      }
    }
  }

  return {
    selected,
    decision: {
      requestedMode,
      mode: actualMode,
      preference: PREFERENCES.has(preference) ? preference : 'any',
      candidateIds: eligible.map((sequence) => sequence.id),
      baselineId: baseline?.id ?? null,
      selectedId: selected?.id ?? null,
      reason,
      latencyMs: Math.max(0, performance.now() - started),
      providerCalls: 0,
      providerCostUsd: 0,
    },
  };
}
