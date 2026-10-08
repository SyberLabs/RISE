import { describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

/** The Look sheet names who directs the scene on screen from the block's own record. */
const label = provenance => Chamber.prototype._visualProvenanceLabel.call({
  _direction: { mode: 'follow', currentBlock: 0, director: { blocks: [{ admitted: { provenance } }] } }
});

describe('the visual direction label', () => {
  it('names the decider that directed the block: Kev, Jev, or local', () => {
    expect(label('kev')).toBe('Direction: Kev');
    expect(label('jev')).toBe('Direction: Jev');
    expect(label('local')).toBe('Direction: Local');
  });
});
