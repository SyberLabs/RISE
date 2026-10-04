import { afterEach, describe, expect, it, vi } from 'vitest';
import { sameData } from './same-data.js';

afterEach(() => vi.restoreAllMocks());

describe('sameData', () => {
  it('ignores key order and treats missing data as empty', () => {
    expect(sameData({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameData(undefined, {})).toBe(true);
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('tells two sessions apart by identity, without serializing either', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const atoms = [{ text: 'same' }];
    expect(sameData({ pane: 'chamber', session: { atoms } }, { pane: 'chamber', session: { atoms } })).toBe(false);
    expect(sameData({ pane: 'chamber' }, { pane: 'chamber', session: { atoms } })).toBe(false);
    expect(stringify).not.toHaveBeenCalled();
  });

  it('compares the rest of the data around one session without serializing the session', () => {
    const session = { atoms: [{ text: 'never written' }] };
    const stringify = vi.spyOn(JSON, 'stringify');
    expect(sameData({ pane: 'chamber', session }, { pane: 'setup', session })).toBe(false);
    expect(sameData({ pane: 'chamber', session }, { session, pane: 'chamber' })).toBe(true);
    for (const [value] of stringify.mock.calls) expect(value).not.toHaveProperty('session');
  });
});
