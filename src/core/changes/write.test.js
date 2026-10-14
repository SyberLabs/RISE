import { describe, expect, it } from 'vitest';
import { buildDigest, digestId, issueFor, nextIndex, periodLabel, serialize } from './write.js';

const MODEL = 'claude-sonnet-5-5';
const sha = n => String(n).padStart(40, 'd');
const change = (number, included = true, extra = {}) => ({
  number, title: `Change ${number}`, url: `https://github.com/SyberLabs/RISE/pull/${number}`, mergedAt: '2026-10-13T10:00:00Z',
  mergeSha: sha(number), route: { audience: 'team', significance: 'notable', kind: 'feature' },
  included, reason: included ? 'routed' : 'routed', ...extra
});
const current = {
  schema: 'rise.current.v2', id: 'week', title: 'What changed in RISE', theme: 'cobalt',
  origin: { kind: 'model', name: MODEL, provider: 'Anthropic, via Claude Code' },
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [{ say: 'This week.', scene: 'field' }, { say: 'One.' }, { say: 'Two.' }]
};
const period = { from: '2026-10-12T09:00:00.000Z', to: '2026-10-19T09:00:00.000Z' };
const digest = (overrides = {}) => buildDigest({
  id: '2026-10-19', period, generatedAt: '2026-10-19T09:03:00.000Z', model: MODEL,
  changes: [change(2), change(1), change(3, false)], current, sources: { 1: [2], 2: [1] }, ...overrides
});
const entry = (id, to) => ({ id, audience: 'team', title: `Week ${id}`, period: { from: '2019-01-01T00:00:00.000Z', to }, count: 1 });

describe('periodLabel', () => {
  it('names the days of one month once', () => {
    expect(periodLabel(period)).toBe('12–19 October');
  });
  it('names both months across a month', () => {
    expect(periodLabel({ from: '2026-09-28T09:00:00Z', to: '2026-10-05T09:00:00Z' })).toBe('28 September – 5 October');
  });
  it('names both years across a year', () => {
    expect(periodLabel({ from: '2026-12-28T09:00:00Z', to: '2027-01-04T09:00:00Z' })).toBe('28 December 2026 – 4 January 2027');
  });
  it('names one day once', () => {
    expect(periodLabel({ from: '2026-10-19T01:00:00Z', to: '2026-10-19T09:00:00Z' })).toBe('19 October');
  });
});

describe('digestId', () => {
  it('is the date of period.to', () => {
    expect(digestId(period.to, [])).toBe('2026-10-19');
  });
  it('takes a short suffix when that day already has a digest', () => {
    expect(digestId(period.to, ['2026-10-19'])).toBe('2026-10-19-2');
    expect(digestId(period.to, ['2026-10-19', '2026-10-19-2'])).toBe('2026-10-19-3');
    expect(digestId(period.to, ['2026-10-12'])).toBe('2026-10-19');
  });
  it('always matches the contract’s id pattern', () => {
    expect(digestId(period.to, ['2026-10-19', ...Array.from({ length: 40 }, (_, i) => `2026-10-19-${i + 2}`)])).toMatch(/^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?$/);
  });
});

describe('buildDigest', () => {
  it('writes the contract’s envelope', () => {
    const value = digest();
    expect(Object.keys(value)).toEqual(['schema', 'id', 'audience', 'title', 'period', 'generatedAt', 'model', 'changes', 'current', 'sources']);
    expect(value.schema).toBe('syberlabs.changes-digest/v1');
    expect(value.audience).toBe('team');
    expect(value.title).toBe('What changed in RISE, 12–19 October');
    expect(value.model).toEqual({ router: MODEL, composer: MODEL, via: 'Claude Code' });
    expect(value.changes.map(item => item.number)).toEqual([2, 1, 3]);
  });

  it('refuses more than 60 changes or 24 included', () => {
    const many = Array.from({ length: 61 }, (_, i) => change(i + 1, false));
    expect(() => digest({ changes: many })).toThrow(/60/);
    const included = Array.from({ length: 25 }, (_, i) => change(i + 1));
    expect(() => digest({ changes: included, sources: { 1: included.map(item => item.number) } })).toThrow(/24/);
  });

  it('refuses a title over 200 characters', () => {
    expect(() => digest({ changes: [change(2, true, { title: 'x'.repeat(201) }), change(1)] })).toThrow(/title/);
  });

  it('refuses sources that break the contract', () => {
    expect(() => digest({ sources: { 1: [2] } })).toThrow(/#1/);
    expect(() => digest({ sources: { 1: [2, 3], 2: [1] } })).toThrow(/#3/);
  });

  it('refuses a file over 256 KB', () => {
    const big = { ...current, beats: Array.from({ length: 70 }, () => ({ say: 'x'.repeat(3990) })) };
    expect(() => digest({ current: big, sources: { 1: [2], 2: [1] } })).toThrow(/256/);
  });
});

describe('nextIndex', () => {
  it('starts an index on the first run', () => {
    const index = nextIndex(null, digest());
    expect(index).toEqual({ schema: 'syberlabs.changes-index/v1', digests: [{ id: '2026-10-19', audience: 'team', title: 'What changed in RISE, 12–19 October', period, count: 2 }] });
  });

  it('puts the newest digest first, whatever order it found', () => {
    const before = { schema: 'syberlabs.changes-index/v1', digests: [entry('2026-10-05', '2026-10-05T09:00:00.000Z'), entry('2026-10-12', '2026-10-12T09:00:00.000Z')] };
    expect(nextIndex(before, digest()).digests.map(item => item.id)).toEqual(['2026-10-19', '2026-10-12', '2026-10-05']);
  });

  it('keeps a same-day rerun beside the first, newest first', () => {
    const before = { schema: 'syberlabs.changes-index/v1', digests: [entry('2026-10-19', '2026-10-19T08:00:00.000Z')] };
    expect(nextIndex(before, digest({ id: '2026-10-19-2' })).digests.map(item => item.id)).toEqual(['2026-10-19-2', '2026-10-19']);
  });

  it('keeps at most 200 entries, dropping the oldest', () => {
    const digests = Array.from({ length: 200 }, (_, i) => entry(`2020-01-01-${i}`, new Date(Date.UTC(2020, 0, 1, 0, i)).toISOString()));
    const index = nextIndex({ schema: 'syberlabs.changes-index/v1', digests }, digest());
    expect(index.digests).toHaveLength(200);
    expect(index.digests[0].id).toBe('2026-10-19');
    expect(index.digests.some(item => item.id === '2020-01-01-0')).toBe(false);
  });

  it('refuses an id the index already has', () => {
    const before = { schema: 'syberlabs.changes-index/v1', digests: [entry('2026-10-19', '2026-10-19T08:00:00.000Z')] };
    expect(() => nextIndex(before, digest())).toThrow(/2026-10-19/);
  });
});

describe('serialize', () => {
  it('is stable JSON with a two-space indent and a final newline', () => {
    expect(serialize({ b: 1, a: [1, 2] })).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}\n');
  });
});

describe('issueFor', () => {
  it('links the reading and tables every change with its route', () => {
    const { title, body } = issueFor(digest());
    expect(title).toBe('What changed in RISE: 12–19 October');
    expect(body).toContain('https://rise.syberlabs.io/changes/2026-10-19');
    expect(body).toContain('[#2](https://github.com/SyberLabs/RISE/pull/2)');
    expect(body).toContain('| [#3](https://github.com/SyberLabs/RISE/pull/3) | Change 3 | team | notable | feature | no | routed |');
    expect(body).toContain(MODEL);
    expect(body.match(/^\| \[#/gm)).toHaveLength(3);
  });

  it('keeps a pull request title from breaking the table or mentioning anyone', () => {
    const { body } = issueFor(digest({ changes: [change(2, true, { title: 'Fix | the @owner <b>table</b>\nnext' }), change(1)] }));
    const row = body.split('\n').find(line => line.startsWith('| [#2]'));
    expect(row).toContain('Fix \\| the @​owner &lt;b>table&lt;/b> next');
  });
});
