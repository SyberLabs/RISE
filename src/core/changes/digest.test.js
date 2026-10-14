import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDigest } from './digest.js';

// A Windows checkout may give the fixtures CRLF; the files the run writes are LF.
const fixture = name => readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures', name), 'utf8').replace(/\r\n/g, '\n');
const REPO = 'SyberLabs/RISE';
const MODEL = 'claude-sonnet-5-5';
const notFound = () => Object.assign(new Error('gh: Not Found (HTTP 404)'), { stderr: 'gh: Not Found (HTTP 404)' });

/** gh as the workflow sees it: the index on changes-data (or none), then GraphQL pages. */
function fakeGh({ index = null, pages }) {
  const queue = [...pages];
  return async args => {
    if (args.includes('api') && args.some(arg => arg.includes('contents/index.json'))) {
      if (index === null) throw notFound();
      return JSON.stringify(index);
    }
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected gh call');
    return next;
  };
}

function scriptedAsk(answers) {
  const calls = [];
  const ask = async request => { calls.push(request); const next = answers.shift(); if (next === undefined) throw new Error('unexpected ask'); return next; };
  return { ask, calls };
}

describe('runDigest on the week of #652–#671', () => {
  const now = new Date('2026-10-14T09:00:00.000Z');
  const since = '2026-10-13T02:00:00Z';

  it('produces the committed sample digest and index from the recorded week and model answers', async () => {
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), fixture('composition.json')]);
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(result.written).toBe(true);
    expect(result.id).toBe('2026-10-14');
    expect(result.files['2026-10-14.json']).toBe(fixture('2026-10-14.json'));
    expect(result.files['index.json']).toBe(fixture('index.json'));
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.model === MODEL)).toBe(true);
  });

  it('never offers a records-only pull request to the router', async () => {
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), fixture('composition.json')]);
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    const records = digest.changes.filter(change => change.reason === 'records-only').map(change => change.number);
    expect(records.sort()).toEqual([654, 657, 659, 664, 666]);
    for (const number of records) expect(calls[0].prompt).not.toContain(`"number": ${number},`);
  });

  it('writes nothing when nothing is included, and says why', async () => {
    const skipAll = JSON.stringify({ routes: {} });
    const { ask, calls } = scriptedAsk([skipAll]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    expect(result).toEqual({ written: false, reason: expect.stringMatching(/included/) });
    expect(calls).toHaveLength(1);
  });

  it('writes nothing when nothing merged, without asking a model', async () => {
    const empty = JSON.stringify({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } } });
    const { ask, calls } = scriptedAsk([]);
    const result = await runDigest({ gh: fakeGh({ pages: [empty] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(result.written).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('continues an existing index, with a suffix when the day already has a digest', async () => {
    const index = JSON.parse(fixture('index.json'));
    const { ask } = scriptedAsk([fixture('route-answer.txt'), fixture('composition.json')]);
    const result = await runDigest({ gh: fakeGh({ index, pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(result.id).toBe('2026-10-14-2');
    expect(JSON.parse(result.files['index.json']).digests.map(entry => entry.id)).toEqual(['2026-10-14-2', '2026-10-14']);
  });

  it('fails without writing when the composition is still refused after two repairs', async () => {
    const refused = JSON.stringify({ current: { schema: 'rise.current.v2' }, sources: {} });
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), refused, refused, refused]);
    await expect(runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} }))
      .rejects.toThrow(/refused/);
    expect(calls).toHaveLength(4);
  });
});
