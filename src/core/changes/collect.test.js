import { describe, expect, it } from 'vitest';
import { boundary, collectMergedPulls, normalizePull, readIndex } from './collect.js';

const REPO = 'SyberLabs/RISE';
const sha = n => String(n).padStart(40, 'a');

function node(number, { mergedAt, updatedAt = mergedAt, body = `Body of ${number}.`, files = ['src/a.js'], total = files.length, title = `Change ${number}` } = {}) {
  return {
    number, title, url: `https://github.com/${REPO}/pull/${number}`, mergedAt, updatedAt, body,
    mergeCommit: { oid: sha(number) },
    labels: { nodes: [{ name: 'live' }] },
    files: { totalCount: total, nodes: files.map(path => ({ path })) }
  };
}

function page(nodes, endCursor = null) {
  return JSON.stringify({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes } } } });
}

/** A gh that answers GraphQL pages in order and records every call. */
function fakeGh(pages) {
  const calls = [];
  const gh = async args => {
    calls.push(args);
    const next = pages.shift();
    if (next === undefined) throw new Error('unexpected call');
    return next;
  };
  return { gh, calls };
}

describe('readIndex', () => {
  it('reads index.json from the changes-data branch, raw', async () => {
    const index = { schema: 'syberlabs.changes-index/v1', digests: [] };
    const { gh, calls } = fakeGh([JSON.stringify(index)]);
    expect(await readIndex(gh, REPO)).toEqual(index);
    expect(calls[0]).toEqual(['api', '-H', 'Accept: application/vnd.github.raw+json', `repos/${REPO}/contents/index.json?ref=changes-data`]);
  });

  it('is null when the branch or the file does not exist yet', async () => {
    const gh = async () => { throw Object.assign(new Error('gh: Not Found (HTTP 404)'), { stderr: 'gh: Not Found (HTTP 404)' }); };
    expect(await readIndex(gh, REPO)).toBeNull();
  });

  it('fails on any other error, so a run never re-digests a period it could not see', async () => {
    const gh = async () => { throw Object.assign(new Error('gh: Server Error (HTTP 502)'), { stderr: 'HTTP 502' }); };
    await expect(readIndex(gh, REPO)).rejects.toThrow(/502/);
  });

  it('refuses an index that is not the contract', async () => {
    const { gh } = fakeGh([JSON.stringify({ schema: 'other', digests: [] })]);
    await expect(readIndex(gh, REPO)).rejects.toThrow(/index\.json/);
  });
});

describe('boundary', () => {
  const now = new Date('2026-10-19T09:00:00Z');
  const entry = (id, to) => ({ id, audience: 'team', title: 't', period: { from: '2026-10-01T00:00:00Z', to }, count: 1 });

  it('is the newest period.to in the index', () => {
    const index = { schema: 'syberlabs.changes-index/v1', digests: [entry('2026-10-12', '2026-10-12T09:00:00Z'), entry('2026-10-05', '2026-10-05T09:00:00Z')] };
    expect(boundary({ index, now })).toBe('2026-10-12T09:00:00.000Z');
  });

  it('is seven days before now without an index or digests', () => {
    expect(boundary({ index: null, now })).toBe('2026-10-12T09:00:00.000Z');
    expect(boundary({ index: { schema: 'syberlabs.changes-index/v1', digests: [] }, now })).toBe('2026-10-12T09:00:00.000Z');
  });

  it('takes --since over both', () => {
    const index = { schema: 'syberlabs.changes-index/v1', digests: [entry('2026-10-12', '2026-10-12T09:00:00Z')] };
    expect(boundary({ index, now, since: '2026-10-01' })).toBe('2026-10-01T00:00:00.000Z');
  });

  it('refuses a since that is not a date before now', () => {
    expect(() => boundary({ index: null, now, since: 'last week' })).toThrow(/--since/);
    expect(() => boundary({ index: null, now, since: '2026-10-20T00:00:00Z' })).toThrow(/--since/);
  });
});

describe('normalizePull', () => {
  it('keeps the contract fields, clips the body and the title, and keeps the first 100 paths', () => {
    const files = Array.from({ length: 100 }, (_, i) => `src/f${i}.js`);
    const pull = normalizePull(node(652, { mergedAt: '2026-10-13T10:00:00Z', body: 'x'.repeat(5000), files, total: 140, title: 't'.repeat(250) }), REPO);
    expect(pull.number).toBe(652);
    expect(pull.body).toHaveLength(4000);
    expect(Array.from(pull.title)).toHaveLength(200);
    expect(pull.title.endsWith('…')).toBe(true);
    expect(pull.files).toHaveLength(100);
    expect(pull.fileCount).toBe(140);
    expect(pull.mergeSha).toBe(sha(652));
    expect(pull.labels).toEqual(['live']);
    expect(pull.url).toBe(`https://github.com/${REPO}/pull/652`);
  });

  it('reads a missing body as empty', () => {
    expect(normalizePull(node(1, { mergedAt: '2026-10-13T10:00:00Z', body: null }), REPO).body).toBe('');
  });

  it('refuses a pull request whose url is not this repository’s', () => {
    const bad = { ...node(2, { mergedAt: '2026-10-13T10:00:00Z' }), url: 'https://evil.example/pull/2' };
    expect(() => normalizePull(bad, REPO)).toThrow(/url/);
  });

  it('refuses a merge commit that is not 40 hex characters', () => {
    const bad = { ...node(3, { mergedAt: '2026-10-13T10:00:00Z' }), mergeCommit: { oid: 'nope' } };
    expect(() => normalizePull(bad, REPO)).toThrow(/merge commit/);
  });
});

describe('collectMergedPulls', () => {
  const from = '2026-10-12T09:00:00.000Z';
  const to = '2026-10-19T09:00:00.000Z';

  it('pages through pull requests newest-updated first and keeps those merged in the period', async () => {
    const { gh, calls } = fakeGh([
      page([
        node(10, { mergedAt: '2026-10-18T10:00:00Z' }),
        node(9, { mergedAt: '2026-10-19T10:00:00Z' }), // after the period
        node(8, { mergedAt: '2026-10-11T10:00:00Z', updatedAt: '2026-10-17T00:00:00Z' }) // merged before, commented on since
      ], 'c1'),
      page([
        node(7, { mergedAt: '2026-10-12T09:00:01Z' }),
        node(6, { mergedAt: '2026-10-12T08:00:00Z' }) // updated before the boundary: the last page
      ], 'c2')
    ]);
    const pulls = await collectMergedPulls(gh, { repo: REPO, from, to });
    expect(pulls.map(pull => pull.number)).toEqual([10, 7]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('owner=SyberLabs');
    expect(calls[0]).toContain('name=RISE');
    expect(calls[0].some(arg => arg.startsWith('cursor='))).toBe(false);
    expect(calls[1]).toContain('cursor=c1');
  });

  it('follows the cursor until a page has no next page', async () => {
    const { gh, calls } = fakeGh([
      page([node(5, { mergedAt: '2026-10-15T00:00:00Z' })], 'a'),
      page([node(4, { mergedAt: '2026-10-14T00:00:00Z' })], 'b'),
      page([node(3, { mergedAt: '2026-10-13T00:00:00Z' })])
    ]);
    const pulls = await collectMergedPulls(gh, { repo: REPO, from, to });
    expect(pulls.map(pull => pull.number)).toEqual([5, 4, 3]);
    expect(calls).toHaveLength(3);
  });

  it('orders what it keeps by merge time, newest first', async () => {
    const { gh } = fakeGh([page([
      node(1, { mergedAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' }),
      node(2, { mergedAt: '2026-10-17T00:00:00Z' })
    ])]);
    const pulls = await collectMergedPulls(gh, { repo: REPO, from, to });
    expect(pulls.map(pull => pull.number)).toEqual([2, 1]);
  });

  it('fails on a GraphQL error instead of digesting half a week', async () => {
    const gh = async () => JSON.stringify({ errors: [{ message: 'rate limited' }] });
    await expect(collectMergedPulls(gh, { repo: REPO, from, to })).rejects.toThrow(/rate limited/);
  });
});
