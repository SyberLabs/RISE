import { describe, expect, it } from 'vitest';
import { sequences } from '../../public/sequences/sequences.js';
import { selectSequence } from '../../public/sequences/selector.js';

describe('public sequence preview selection', () => {
  it('offers editorial order as the baseline', () => {
    const { selected, decision } = selectSequence({ sequences, completedIds: ['reset'] });
    expect(selected.id).toBe('focus');
    expect(decision.mode).toBe('curated');
    expect(decision.candidateIds).toEqual(['focus', 'close']);
  });

  it('bounds a preference match to approved alternatives with no provider cost', () => {
    const { selected, decision } = selectSequence({
      sequences,
      completedIds: ['reset'],
      mode: 'bounded-jev',
      preference: 'reflect'
    });
    expect(selected.id).toBe('close');
    expect(decision.baselineId).toBe('focus');
    expect(decision.mode).toBe('bounded-jev-simulation');
    expect(decision.providerCalls).toBe(0);
    expect(decision.providerCostUsd).toBe(0);
  });

  it('falls back when no approved alternative exists', () => {
    const { selected, decision } = selectSequence({
      sequences,
      completedIds: ['reset', 'focus'],
      mode: 'bounded-jev',
      preference: 'reflect'
    });
    expect(selected.id).toBe('close');
    expect(decision.mode).toBe('curated');
    expect(decision.reason).toBe('insufficient-approved-options');
  });
});
