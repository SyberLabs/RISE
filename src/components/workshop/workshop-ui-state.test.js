import { describe, expect, it } from 'vitest';
import { inspectorContextLabel, normalizeInspectorContext, workshopChoiceGridClass } from './workshop-ui-state.js';

describe('Workshop UI state', () => {
  it('normalizes unknown inspector contexts to Project', () => {
    const context = normalizeInspectorContext({ kind: 'unknown', id: 'source-1' });
    expect(context).toEqual({ kind: 'project', id: 'source-1' });
    expect(Object.isFrozen(context)).toBe(true);
    expect(inspectorContextLabel(context)).toBe('Project');
  });

  it('retains stable synchronized clip identities', () => {
    const context = normalizeInspectorContext({ kind: 'combinedClip', visualId: 'visual-1', audioId: 'audio-1' });
    expect(context).toEqual({ kind: 'combinedClip', visualId: 'visual-1', audioId: 'audio-1' });
    expect(inspectorContextLabel(context)).toBe('Synchronized clips');
  });

  it('only emits complete choice-grid classes for supported fixed counts', () => {
    expect(workshopChoiceGridClass(5)).toBe('studio-choice-grid studio-choice-grid-5');
    expect(workshopChoiceGridClass(0)).toBe('studio-choice-grid');
    expect(workshopChoiceGridClass(9)).toBe('studio-choice-grid');
    expect(workshopChoiceGridClass(2.5)).toBe('studio-choice-grid');
  });
});
