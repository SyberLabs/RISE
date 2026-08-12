import { describe, expect, it } from 'vitest';
import { buildSequenceMapGroups } from './sequence-map.js';

describe('Workshop sequence map ordering', () => {
  it('preserves source order, sorts by character range, and joins synchronized media', () => {
    const groups = buildSequenceMapGroups({
      sources: [{ id: 'second', name: 'Second' }, { id: 'first', name: 'First' }],
      visualAssignments: [
        { id: 'v-late', sourceId: 'first', fromCharacter: 20, toCharacter: 30 },
        { id: 'v-early', sourceId: 'first', fromCharacter: 0, toCharacter: 10 }
      ],
      audioAssignments: [
        { id: 'a-sync', sourceId: 'first', fromCharacter: 0, toCharacter: 10, syncGroup: 'sync-v-early' },
        { id: 'a-middle', sourceId: 'first', fromCharacter: 12, toCharacter: 18 }
      ]
    });

    expect(groups.map(group => group.sourceId)).toEqual(['second', 'first']);
    expect(groups[1].entries.map(entry => entry.fromCharacter)).toEqual([0, 12, 20]);
    expect(groups[1].entries[0].visual.id).toBe('v-early');
    expect(groups[1].entries[0].audio.map(item => item.id)).toEqual(['a-sync']);
  });
});
