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
function fakeGh({ index = null, pages, repository } = {}) {
  const queue = [...pages];
  const record = repository ?? { full_name: REPO, private: false, visibility: 'public' };
  return async args => {
    if (args[0] === 'api' && args.at(-1) === `repos/${REPO}`) return JSON.stringify(record);
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

  it('returns to RISE\u2019s eye where a picture\u2019s beats move on to other changes', async () => {
    const { ask } = scriptedAsk(week());
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.current.scenes.find(scene => scene.engine === 'still')).toEqual({ id: 'eye', engine: 'still' });
    expect(digest.current.beats.flatMap((beat, index) => (beat.scene === 'eye' ? [index] : []))).toEqual([4, 7, 9, 12]);
    expect(lines).toContain('  RISE\u2019s eye returns at beats 4, 7, 9, 12, where a picture\u2019s beats move on');
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

  it('moves an included change no beat speaks of out of the reading, says so, and repairs nothing', async () => {
    const [route, composition, ...rest] = week();
    const silent = JSON.parse(composition);
    const beat = silent.current.beats.findIndex(item => item.refs?.includes(667));
    silent.current.beats[beat].refs = silent.current.beats[beat].refs.filter(number => number !== 667);
    const { ask, calls } = scriptedAsk([route, JSON.stringify(silent), ...rest]);
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(calls).toHaveLength(2 + rest.length);
    expect(digest.changes.find(change => change.number === 667)).toMatchObject({ included: false, reason: 'unspoken' });
    expect(Object.values(digest.sources).flat()).not.toContain(667);
    expect(digest.notes).toEqual(['#667 was chosen for the reading, but no beat spoke of it; it is listed as unspoken under How this was chosen.']);
    expect(digest.quality).toEqual({ firstPass: false, repairs: { composition: 0, illustrator: 0 }, checks: { unspoken: 1 }, density: { pictures: 6, includedChanges: 10, speakingBeats: 11, pictured: 7, longestUnpictured: 2 } });
    expect(result.issue.body).toContain('| no | unspoken |');
    expect(result.issue.body).toContain('no beat spoke of it');
    expect(JSON.parse(result.files['index.json']).digests[0].count).toBe(digest.changes.filter(change => change.included).length);
  });

  it('scores the run: right the first time, with nothing repaired and no check fired', async () => {
    const { ask } = scriptedAsk(week());
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.quality).toEqual({
      firstPass: true, repairs: { composition: 0, illustrator: 0 }, checks: {},
      density: { pictures: 6, includedChanges: 11, speakingBeats: 12, pictured: 7, longestUnpictured: 2 }
    });
    expect(lines).toContain('Quality: First pass: yes — 0 repairs; checks fired: none');
    expect(lines).toContain('Pictures: 6 for 11 changes; 7 of 12 speaking beats pictured, at most 2 in a row without one');
    expect(result.issue.body).toContain('First pass: yes — 0 repairs; checks fired: none');
    expect(result.issue.body).toContain('Pictures: 6 for 11 changes; 7 of 12 speaking beats pictured, at most 2 in a row without one');
  });

  it('measures the pictures the reading shows, not the ones it planned: a picture let go leaves its beats unpictured', async () => {
    const [route, composition, , ...rest] = week();
    const refused = ['@scene picture svg', '```svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script></svg>', '```'].join('\n');
    const { ask } = scriptedAsk([route, composition, refused, refused, refused, ...rest]);
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(JSON.parse(result.files['2026-10-14.json']).quality.density).toEqual({ pictures: 5, includedChanges: 11, speakingBeats: 12, pictured: 6, longestUnpictured: 3 });
  });

  it('gives up the close when the pictures need its scene, and says so', async () => {
    const { ask } = scriptedAsk(week());
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.current.scenes.map(scene => scene.id).sort()).toEqual(['eye', 'opening', 'picture-1', 'picture-2', 'picture-3', 'picture-4', 'picture-5', 'picture-6']);
    expect(lines).toContain('  RISE gave up the close to make room for the pictures');
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
    const { density: _density, ...score } = digest.quality;
    expect(score).toEqual({ firstPass: false, repairs: { composition: 1, illustrator: 2 }, checks: { figure: 3, 'process-talk': 2 } });
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

  it('supersedes a published digest: a new id, the old entry marked, the period the old one began', async () => {
    const index = JSON.parse(fixture('index.json'));
    const { ask } = scriptedAsk(week());
    const lines = [];
    const later = new Date('2026-10-14T12:00:00.000Z');
    const result = await runDigest({ gh: fakeGh({ index, pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now: later, supersede: '2026-10-14', model: MODEL, log: line => lines.push(line) });
    expect(result.id).toBe('2026-10-14-2');
    const digest = JSON.parse(result.files['2026-10-14-2.json']);
    expect(digest.period).toEqual({ from: '2026-10-13T02:00:00.000Z', to: '2026-10-14T12:00:00.000Z' });
    const entries = JSON.parse(result.files['index.json']).digests;
    expect(entries.map(entry => [entry.id, entry.supersededBy])).toEqual([['2026-10-14-2', undefined], ['2026-10-14', '2026-10-14-2']]);
    expect(lines).toContain('Supersedes 2026-10-14: /changes will list this digest in its place');
    expect(result.issue.body).toContain('https://rise.syberlabs.io/changes/2026-10-14, which /changes no longer lists.');
  });

  it('refuses to supersede a digest the index does not list, or one already superseded, before asking a model', async () => {
    const index = JSON.parse(fixture('index.json'));
    const { ask, calls } = scriptedAsk(week());
    await expect(runDigest({ gh: fakeGh({ index, pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, supersede: '2026-10-01', model: MODEL, log: () => {} }))
      .rejects.toThrow(/2026-10-01/);
    const marked = { ...index, digests: [{ ...index.digests[0], id: '2026-10-14-2' }, { ...index.digests[0], supersededBy: '2026-10-14-2' }] };
    await expect(runDigest({ gh: fakeGh({ index: marked, pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, supersede: '2026-10-14', model: MODEL, log: () => {} }))
      .rejects.toThrow(/already superseded by 2026-10-14-2/);
    expect(calls).toHaveLength(0);
  });

  it('stops before reading pull requests or calling a model when the repository is not public', async () => {
    const calls = [];
    const gh = async args => {
      calls.push(args);
      return JSON.stringify({ full_name: REPO, private: true, visibility: 'private' });
    };
    const ask = async () => { throw new Error('the model was called'); };
    await expect(runDigest({ gh, ask, repo: REPO, now, log: () => {} })).rejects.toThrow('The repository is not public, so the run stops before reading it');
    expect(calls).toEqual([['api', '--method', 'GET', `repos/${REPO}`]]);
  });

  it('refuses a figures mode other than kit before asking GitHub', async () => {
    const gh = async () => { throw new Error('GitHub was asked'); };
    await expect(runDigest({ gh, ask: async () => {}, repo: REPO, figures: 'scene', now, log: () => {} })).rejects.toThrow(/--figures kit/);
  });

  it('refuses a repository name that is not owner/name before asking GitHub', async () => {
    const gh = async () => { throw new Error('GitHub was asked'); };
    const ask = async () => { throw new Error('the model was called'); };
    await expect(runDigest({ gh, ask, repo: 'https://github.com/SyberLabs/RISE', now, log: () => {} })).rejects.toThrow(/owner\/name/);
  });

  it('refuses an illustrator brief before drawing it when the digest may use kit figures only', async () => {
    const composition = fixture('composition.json');
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), composition, composition, composition]);
    await expect(runDigest({
      gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, figures: 'kit', log: () => {}
    })).rejects.toThrow(/refused 3 times/);
    expect(calls).toHaveLength(4);
    expect(calls.slice(1).every(call => /kit figures only/.test(call.system))).toBe(true);
    expect(calls.some(call => /"medium": "figure" \| "scene"/.test(call.system))).toBe(false);
  });

  it('fails without writing when the composition is still refused after two repairs', async () => {
    const refused = JSON.stringify({ current: { schema: 'rise.current.v2' }, sources: {} });
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), refused, refused, refused]);
    await expect(runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {} }))
      .rejects.toThrow(/refused/);
    expect(calls).toHaveLength(4);
  });
});
