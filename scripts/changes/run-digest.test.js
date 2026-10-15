import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderFigure } from '../../src/core/figures/figure-kit.js';
import { runDigest } from './run-digest.js';

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

/** The recorded model answers: the router's, the composer's, then the illustrator's, one per brief. */
const week = () => [fixture('route-answer.txt'), fixture('composition.json'), ...JSON.parse(fixture('illustrations.json'))];

function scriptedAsk(answers) {
  const calls = [];
  const ask = async request => { calls.push(request); const next = answers.shift(); if (next === undefined) throw new Error('unexpected ask'); return next; };
  return { ask, calls };
}

describe('runDigest on the week of #652–#671', () => {
  const now = new Date('2026-10-14T09:00:00.000Z');
  const since = '2026-10-13T02:00:00Z';

  it('produces the committed sample digest and index from the recorded week and model answers', async () => {
    const { ask, calls } = scriptedAsk(week());
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(result.written).toBe(true);
    expect(result.id).toBe('2026-10-14');
    expect(result.files['2026-10-14.json']).toBe(fixture('2026-10-14.json'));
    expect(result.files['index.json']).toBe(fixture('index.json'));
    expect(calls).toHaveLength(2 + JSON.parse(fixture('illustrations.json')).length);
    expect(calls.every(call => call.model === MODEL)).toBe(true);
  });

  it('draws each picture after the composition, kit figures by RISE and briefs by the illustrator, each on its beat', async () => {
    const { ask, calls } = scriptedAsk(week());
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    const { current, pictures } = JSON.parse(fixture('composition.json'));
    const briefs = pictures.filter(picture => picture.brief !== undefined);
    expect(calls).toHaveLength(2 + briefs.length);
    briefs.forEach((picture, index) => expect(calls[2 + index].prompt).toContain(picture.brief));
    for (const [index, picture] of pictures.entries()) {
      const id = `picture-${index + 1}`;
      expect(digest.current.beats[picture.beat].scene).toBe(id);
      if (picture.kit) expect(digest.current.scenes.find(scene => scene.id === id).svg).toBe(renderFigure(picture.kit, { theme: current.theme }));
    }
    expect(digest.current.scenes.filter(scene => scene.svg !== undefined)).toHaveLength(pictures.length);
    expect(digest).not.toHaveProperty('notes');
  });

  it('writes the contract\u2019s sources from the refs on each beat, and no refs into the Current', async () => {
    const { ask } = scriptedAsk(week());
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    const { current } = JSON.parse(fixture('composition.json'));
    const expected = Object.fromEntries(current.beats.flatMap((beat, index) => (beat.refs?.length ? [[String(index), beat.refs]] : [])));
    expect(digest.sources).toEqual(expected);
    expect(digest.current.beats.some(beat => 'refs' in beat)).toBe(false);
  });

  it('keeps the scene before for a picture still refused, and says so in the digest and the issue', async () => {
    const refused = ['@scene picture svg', '```svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script></svg>', '```'].join('\n');
    const [route, composition, , ...rest] = week();
    const { ask } = scriptedAsk([route, composition, refused, refused, refused, ...rest]);
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    const first = JSON.parse(fixture('composition.json')).pictures.find(picture => picture.brief !== undefined);
    expect(digest.current.beats[first.beat].scene).toBeUndefined();
    expect(digest.notes).toHaveLength(1);
    expect(digest.notes[0]).toMatch(new RegExp(`beat ${first.beat}.*not drawn`));
    expect(result.issue.body).toContain('Notes from the run:');
  });

  it('scores the run: right the first time, with nothing repaired and no check fired', async () => {
    const { ask } = scriptedAsk(week());
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.quality).toEqual({ firstPass: true, repairs: { composition: 0, illustrator: 0 }, checks: {} });
    expect(lines).toContain('Quality: First pass: yes — 0 repairs; checks fired: none');
    expect(result.issue.body).toContain('First pass: yes — 0 repairs; checks fired: none');
  });

  it('scores a run that repaired its composition and let a picture go, and says which checks fired', async () => {
    const [route, composition, , ...rest] = week();
    const talky = JSON.parse(composition);
    talky.current.beats.at(-1).say = 'That is the week; the next dry run will tell.';
    const refused = ['@scene picture svg', '```svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script></svg>', '```'].join('\n');
    const { ask } = scriptedAsk([route, JSON.stringify(talky), composition, refused, refused, refused, ...rest]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.quality).toEqual({ firstPass: false, repairs: { composition: 1, illustrator: 2 }, checks: { figure: 3, 'process-talk': 2 } });
    expect(lines).toContain('Quality: First pass: no — 3 repairs (1 composition, 2 illustrator); checks fired: figure (3), process-talk (2)');
  });

  it('hands every admitted figure to the rendered check it is given', async () => {
    const { ask } = scriptedAsk(week());
    const rendered = [];
    const renderCheck = async svg => { rendered.push(svg); return { problems: [], ms: 1 }; };
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {}, renderCheck });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(rendered).toEqual(digest.current.scenes.filter(scene => scene.svg !== undefined).map(scene => scene.svg));
  });

  it('never offers a records-only pull request to the router', async () => {
    const { ask, calls } = scriptedAsk(week());
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    const records = digest.changes.filter(change => change.reason === 'records-only').map(change => change.number);
    expect(records.sort()).toEqual([654, 657, 659, 664, 666]);
    for (const number of records) expect(calls[0].prompt).not.toContain(`"number": ${number},`);
    for (const number of records) expect(calls[1].prompt).not.toContain(`"number": ${number},`);
  });

  it('gives the composer the routed changes it did not include as context, in merge order', async () => {
    const { ask, calls } = scriptedAsk(week());
    await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const { prompt } = calls[1];
    const data = JSON.parse(prompt.slice(prompt.indexOf('<pull_requests>') + 15, prompt.indexOf('</pull_requests>')));
    expect(data.map(item => item.number)).toEqual([652, 653, 655, 656, 661, 662, 658, 660, 663, 665, 667, 668, 669, 670, 671]);
    expect(data.filter(item => !item.included).map(item => item.number)).toEqual([656, 663, 670, 671]);
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
    const { ask } = scriptedAsk(week());
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
