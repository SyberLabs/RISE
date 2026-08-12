import { describe, expect, it } from 'vitest';
import {
  createVisualScoreHistory,
  recordVisualScoreCommand,
  redoVisualScoreCommand,
  undoVisualScoreCommand,
  visualScoreHistoryStatus
} from './visual-score-history.js';

const clip = id => ({
  id, sourceId: 'source-1', assetId: 'procedural:klee',
  fromCharacter: 0, toCharacter: 4, quoteStart: 'Text', quoteEnd: 'Text'
});

describe('visual score command history', () => {
  it('undoes and redoes an atomic overlap replacement', () => {
    let history = createVisualScoreHistory();
    history = recordVisualScoreCommand(history, {
      type: 'replace-overlap', before: [clip('old-a'), clip('old-b')],
      after: [clip('replacement')], selectedBefore: 'old-a', selectedAfter: 'replacement'
    });

    const undone = undoVisualScoreCommand(history);
    expect(undone.snapshot.assignments.map(item => item.id)).toEqual(['old-a', 'old-b']);
    expect(undone.snapshot.selectedAssignmentId).toBe('old-a');
    const redone = redoVisualScoreCommand(undone.history);
    expect(redone.snapshot.assignments.map(item => item.id)).toEqual(['replacement']);
    expect(visualScoreHistoryStatus(redone.history)).toMatchObject({ canUndo: true, canRedo: false });
  });

  it('bounds history and clears redo after a new edit', () => {
    let history = createVisualScoreHistory(2);
    for (const id of ['one', 'two', 'three']) {
      history = recordVisualScoreCommand(history, {
        type: 'assign', before: [], after: [clip(id)], selectedAfter: id
      });
    }
    expect(history.past).toHaveLength(2);
    const undone = undoVisualScoreCommand(history);
    const branched = recordVisualScoreCommand(undone.history, {
      type: 'erase', before: [clip('two')], after: []
    });
    expect(branched.future).toEqual([]);
  });

  it('treats a passage style revision as one reversible command', () => {
    const before = [{ ...clip('styled'), cue: {
      kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' }
    } }];
    const after = [{ ...before[0], cue: {
      kind: 'procedural', collections: ['klee'], config: { preset: 'chaotic' }
    } }];
    const history = recordVisualScoreCommand(createVisualScoreHistory(), {
      type: 'configure-visual', before, after,
      selectedBefore: 'styled', selectedAfter: 'styled'
    });
    expect(undoVisualScoreCommand(history).snapshot.assignments[0].cue.config.preset)
      .toBe('harmonic');
  });
});
