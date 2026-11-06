import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderFigure } from '../../src/core/figures/figure-kit.js';
import { createAsk } from '../../src/core/changes/claude-cli.js';
import { REJECTED_LIMITS, runDigest, serializeRejected } from './run-digest.js';
import { main } from './digest.mjs';
import { ROUTE_CONTEXT_FIELDS } from './route-context.js';

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
    // The router is sent its context contract read from the fact cards; the composer the v1 fields only, never the whole body.
    const quotedPulls = prompt => JSON.parse(prompt.slice(prompt.indexOf('<pull_requests>\n') + 16, prompt.indexOf('\n</pull_requests>')));
    const routed = quotedPulls(calls[0].prompt);
    const composed = quotedPulls(calls[1].prompt);
    expect(routed.length).toBeGreaterThan(0);
    expect(composed.length).toBeGreaterThan(0);
    for (const pull of routed) expect(Object.keys(pull)).toEqual(ROUTE_CONTEXT_FIELDS);
    for (const pull of composed) expect(Object.keys(pull)).toEqual(['number', 'included', 'title', 'mergedAt', 'labels', 'kind', 'significance', 'body']);
    const p655 = composed.find(pull => pull.number === 655);
    expect(Array.from(p655.body)).toHaveLength(4000);
    expect(p655.body).not.toContain('Not verified');
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
    // A beat's numbers come from the pull requests it cites: one that cites none says none.
    silent.current.beats[beat].say = 'That visual now also reaches the screen at once, instead of waiting for the next phrase.';
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
    const { ask, calls } = scriptedAsk([skipAll, skipAll]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    expect(result).toEqual({ written: false, reason: expect.stringMatching(/included/) });
    expect(calls).toHaveLength(2);
  });

  it('writes a change whose route answer could not be read, even when asked again alone, as unrouted, counts it in the run log and says so in the issue', async () => {
    const [route, ...rest] = week();
    const slipped = route.replace('"671": {"audience": "readers"', '"671": {"audience": "reader"');
    expect(slipped).not.toBe(route);
    const { ask, calls } = scriptedAsk([slipped, 'not json', ...rest]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    expect(calls[1].prompt).toContain('"number": 671');
    expect(calls[1].prompt.match(/"number": /g)).toHaveLength(1);
    expect(lines).toContain('Router: 2 calls, 1 a retry for 1 pull request whose answer could not be read; 0 of 15 routes from the cache');
    const p671 = JSON.parse(fixture('graphql-week.json')).data.repository.pullRequests.nodes.find(node => node.number === 671).mergeCommit.oid;
    expect(Object.keys(result.cache)).toHaveLength(14);
    expect(result.cache).not.toHaveProperty(`cache/routes/${p671}.json`);
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.changes.find(change => change.number === 671)).toMatchObject({ included: false, reason: 'unrouted', route: { audience: 'skip', significance: 'minor', kind: 'records' } });
    expect(digest.changes.find(change => change.number === 670)).toMatchObject({ included: false, reason: 'routed' });
    expect(digest.quality).toEqual(JSON.parse(fixture('2026-10-14.json')).quality);
    expect(lines).toContain('  #671 skip/minor/records not included (unrouted)');
    expect(lines).toContain('Unrouted: 1 of 15 pull requests; the router\'s answer for them could not be read, so they took the fallback route skip/minor/records');
    expect(result.issue.body).toContain('| skip | minor | records | no | unrouted |');
    expect(result.issue.body).toContain('Unrouted: the router\'s answer for 1 pull request could not be read, so it took the fallback route skip/minor/records and was left out.');
  });

  it('says the router\'s answer could not be read when every route falls back and nothing is included', async () => {
    const [route] = week();
    const { ask } = scriptedAsk([route.slice(0, route.length / 2), route.slice(0, route.length / 2)]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    expect(result).toEqual({ written: false, reason: 'No change was included: the router\'s answer could not be read for any of the 15 pull requests' });
    expect(lines).toContain('Unrouted: 15 of 15 pull requests; the router\'s answer for them could not be read, so they took the fallback route skip/minor/records');
  });

  it('counts nothing as unrouted when the router itself routes every change to skip/minor/records', async () => {
    const [route] = week();
    const skipped = route.replace(/\{"audience": "[a-z]+", "significance": "[a-z]+", "kind": "[a-z]+"\}/g, '{"audience": "skip", "significance": "minor", "kind": "records"}');
    expect(skipped.match(/"audience": "skip"/g)).toHaveLength(15);
    const { ask } = scriptedAsk([skipped]);
    const lines = [];
    const result = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line) });
    expect(result).toEqual({ written: false, reason: 'No change was included: none was routed to the team as notable or major' });
    expect(lines.filter(line => line.startsWith('Unrouted'))).toEqual([]);
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

  const routerCalls = calls => calls.filter(call => call.system.startsWith('You route the pull requests'));
  const cacheOf = result => async mergeSha => result.cache[`cache/routes/${mergeSha}.json`] ?? null;

  it('re-runs the same period with the routes it cached and makes no router call', async () => {
    const first = scriptedAsk(week());
    const published = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask: first.ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    expect(Object.keys(published.cache)).toHaveLength(15);
    const [, ...afterRouting] = week();
    const again = scriptedAsk(afterRouting);
    const lines = [];
    const rerun = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask: again.ask, repo: REPO, now, since, model: MODEL, readCache: cacheOf(published), log: line => lines.push(line) });
    expect(routerCalls(again.calls)).toHaveLength(0);
    expect(rerun.files['2026-10-14.json']).toBe(published.files['2026-10-14.json']);
    expect(rerun.cache).toEqual({});
    expect(lines).toContain('Router: 0 calls; 15 of 15 routes from the cache');
  });

  it('supersedes a period with the routes the first digest was given, so a resampled router cannot drop a change (#685 and #693 in 2026-10-16-2)', async () => {
    const first = scriptedAsk(week());
    const published = await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask: first.ask, repo: REPO, now, since, model: MODEL, log: () => {} });
    // Asked again, the router would now call #662 and #668 minor.
    const [route, ...afterRouting] = week();
    const resampled = route
      .replace('"662": {"audience": "team", "significance": "notable"', '"662": {"audience": "team", "significance": "minor"')
      .replace('"668": {"audience": "team", "significance": "notable"', '"668": {"audience": "team", "significance": "minor"');
    expect(resampled.match(/"significance": "minor"/g)).toHaveLength(route.match(/"significance": "minor"/g).length + 2);
    const calls = [];
    const ask = async request => {
      calls.push(request);
      if (request.system.startsWith('You route the pull requests')) return resampled;
      const next = afterRouting.shift();
      if (next === undefined) throw new Error('unexpected ask');
      return next;
    };
    const later = new Date('2026-10-14T12:00:00.000Z');
    const superseding = await runDigest({
      gh: fakeGh({ index: JSON.parse(fixture('index.json')), pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now: later,
      supersede: '2026-10-14', model: MODEL, readCache: cacheOf(published), log: () => {}
    });
    expect(routerCalls(calls)).toHaveLength(0);
    const routesOf = digest => digest.changes.map(({ number, route: given, included }) => ({ number, route: given, included }));
    const before = JSON.parse(published.files['2026-10-14.json']);
    const after = JSON.parse(superseding.files['2026-10-14-2.json']);
    expect(routesOf(after)).toEqual(routesOf(before));
    expect(after.changes.filter(change => change.included).map(change => change.number)).toEqual(expect.arrayContaining([662, 668]));
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

  it('fails without writing when the composition is still refused after two repairs, and keeps the three answers it refused', async () => {
    const refused = JSON.stringify({ current: { schema: 'rise.current.v2' }, sources: {} });
    const { ask, calls } = scriptedAsk([fixture('route-answer.txt'), refused, refused, refused]);
    const rejected = [];
    await expect(runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {}, onRefused: entry => rejected.push(entry) }))
      .rejects.toThrow(/refused/);
    expect(calls).toHaveLength(4);
    expect(rejected.map(entry => [entry.stage, entry.attempt, entry.answer])).toEqual([1, 2, 3].map(attempt => ['composition', attempt, refused]));
  });
});

describe('the answers a run refused (rejected.json)', () => {
  const now = new Date('2026-10-14T09:00:00.000Z');
  const since = '2026-10-13T02:00:00Z';
  const run = (answers, rest = {}) => {
    const rejected = [];
    const lines = [];
    const { ask } = scriptedAsk(answers);
    return runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: line => lines.push(line), onRefused: entry => rejected.push(entry), ...rest })
      .then(result => ({ result, rejected, lines }));
  };
  const talkyComposition = say => {
    const talky = JSON.parse(fixture('composition.json'));
    talky.current.beats.at(-1).say = say;
    return JSON.stringify(talky);
  };

  it('keeps a refused composition answer with its refusal lines, and the repaired one is not kept', async () => {
    const [route, composition, ...rest] = week();
    const talky = talkyComposition('That is the week; the next dry run will tell.');
    const { result, rejected, lines } = await run([route, talky, composition, ...rest]);
    expect(result.written).toBe(true);
    expect(rejected).toEqual([{ stage: 'composition', attempt: 1, refusal: expect.any(Array), answer: talky }]);
    expect(rejected[0].refusal.length).toBeGreaterThan(0);
    expect(lines.slice(lines.indexOf('Composition 1 of 3 refused:') + 1, lines.indexOf('Composition 1 of 3 refused:') + 1 + rejected[0].refusal.length))
      .toEqual(rejected[0].refusal.map(line => `  ${line}`));
    expect(JSON.parse(serializeRejected(rejected))).toEqual(rejected);
  });

  it('keeps nothing from a first-pass run, so no rejected.json is written', async () => {
    const { result, rejected } = await run(week());
    expect(result.written).toBe(true);
    expect(rejected).toEqual([]);
  });

  it('keeps each router answer only when a route in it could not be read, the first and its retry', async () => {
    const [route, ...rest] = week();
    const slipped = route.replace('"671": {"audience": "readers"', '"671": {"audience": "reader"');
    const { rejected } = await run([slipped, 'not json', ...rest]);
    expect(rejected).toEqual([
      { stage: 'router', attempt: 1, refusal: ['#671: its route could not be read, so it is asked once more'], answer: slipped },
      { stage: 'router', attempt: 2, refusal: ['#671: its route could not be read, so it took the fallback route skip/minor/records'], answer: 'not json' }
    ]);
  });

  it('keeps each refused illustrator answer with the beat it was for, in order', async () => {
    const refused = ['@scene picture svg', '```svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script></svg>', '```'].join('\n');
    const [route, composition, , ...rest] = week();
    const { rejected } = await run([route, composition, refused, refused, refused, ...rest]);
    const first = JSON.parse(fixture('composition.json')).pictures.find(picture => picture.brief !== undefined);
    expect(rejected.map(({ stage, beat, attempt, answer }) => ({ stage, beat, attempt, answer }))).toEqual([1, 2, 3].map(attempt => ({ stage: 'illustrator', beat: first.beat, attempt, answer: refused })));
    for (const entry of rejected) expect(entry.refusal.some(line => line.startsWith('figure'))).toBe(true);
  });

  it('keeps an illustrator figure the rendered check refused, with the check’s problems as its refusal', async () => {
    const [route, composition, drawn, next] = week();
    let faulted = false;
    const renderCheck = async svg => {
      const fault = !faulted && drawn.includes(svg);
      faulted ||= fault;
      return { problems: fault ? [{ rule: 'overlap', message: 'two labels touch' }] : [], ms: 1 };
    };
    const { rejected } = await run([route, composition, drawn, drawn, next], { renderCheck });
    expect(faulted).toBe(true);
    expect(rejected).toEqual([{ stage: 'illustrator', beat: 8, attempt: 1, refusal: ['overlap: two labels touch'], answer: drawn }]);
  });

  it('keeps both figures the rendered check refused when the repaired one is still at fault', async () => {
    const [route, composition, drawn, next] = week();
    const renderCheck = async svg => ({ problems: drawn.includes(svg) ? [{ rule: 'overlap', message: 'two labels touch' }] : [], ms: 1 });
    const { rejected } = await run([route, composition, drawn, drawn, next], { renderCheck });
    expect(rejected).toEqual([1, 2].map(attempt => ({ stage: 'illustrator', beat: 8, attempt, refusal: ['overlap: two labels touch'], answer: drawn })));
  });

  it('keeps an illustrator answer that drew nothing with its full refusal, not only its rule', async () => {
    const [route, composition, , next] = week();
    const nothing = 'I would rather not draw this.';
    const { rejected } = await run([route, composition, nothing, nothing, nothing, next]);
    expect(rejected).toEqual([1, 2, 3].map(attempt => ({ stage: 'illustrator', beat: 8, attempt, refusal: ['nothing-drawn: the answer drew no picture'], answer: nothing })));
  });

  it('keeps an illustrator answer let go as a cue, with the reason it was let go', async () => {
    const [route, composition, , next] = week();
    const cue = '@cue opening bright\n';
    const { result, rejected } = await run([route, composition, cue, next]);
    const digest = JSON.parse(result.files['2026-10-14.json']);
    expect(digest.notes).toEqual([expect.stringContaining('the illustrator answered with a cue')]);
    expect(rejected).toEqual([{ stage: 'illustrator', beat: 8, attempt: 1, refusal: ['let go: the illustrator answered with a cue'], answer: cue }]);
  });

  it('never keeps the model credential: an answer that echoes it is kept redacted', async () => {
    const TOKEN = 'sk-ant-oat01-fake-token-for-the-redaction-test';
    const [route, composition, ...rest] = week();
    const talky = talkyComposition(`That is the week; the next dry run will tell. ${TOKEN}`);
    const answers = [route, talky, composition, ...rest];
    const cli = async () => ({ code: 0, stderr: '', stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: answers.shift() }) });
    const ask = createAsk({ run: cli, env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, log: () => {} });
    const rejected = [];
    await runDigest({ gh: fakeGh({ pages: [fixture('graphql-week.json')] }), ask, repo: REPO, now, since, model: MODEL, log: () => {}, onRefused: entry => rejected.push(entry) });
    expect(rejected).toHaveLength(1);
    expect(rejected[0].answer).toBe(talky.replace(TOKEN, '[redacted]'));
    expect(serializeRejected(rejected)).not.toContain(TOKEN);
  });

  it('caps each answer at the largest Current RISE admits and the file at its bound, saying where it cut', () => {
    const long = 'x'.repeat(REJECTED_LIMITS.answer + 10);
    const [kept] = JSON.parse(serializeRejected([{ stage: 'composition', attempt: 1, refusal: ['too long'], answer: long }]));
    expect(kept).toEqual({ stage: 'composition', attempt: 1, refusal: ['too long'], answer: long.slice(0, REJECTED_LIMITS.answer), truncated: true });
    const many = Array.from({ length: 100 }, (_, index) => ({ stage: 'illustrator', beat: 1, attempt: index + 1, refusal: ['figure'], answer: long }));
    const text = serializeRejected(many);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(REJECTED_LIMITS.file);
    const all = JSON.parse(text);
    expect(all.map(entry => entry.attempt)).toEqual(many.map(entry => entry.attempt));
    expect(all.at(-1)).toEqual({ stage: 'illustrator', beat: 1, attempt: 100, refusal: ['figure'], answer: '', truncated: true });
  });

  it('caps an entry’s refusal lines at their own bound, so the file stays under its bound', () => {
    const lines = Array.from({ length: 50 }, () => 'y'.repeat(REJECTED_LIMITS.refusal));
    const text = serializeRejected([{ stage: 'composition', attempt: 1, refusal: lines, answer: 'a' }]);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(REJECTED_LIMITS.file);
    const [kept] = JSON.parse(text);
    expect(kept.truncated).toBe(true);
    expect(kept.refusal.join('').length).toBe(REJECTED_LIMITS.refusal);
  });
});

describe('runDigest for a customer', () => {
  it('runs a brand its company has not confirmed only dry, before reading anything', async () => {
    const gh = async () => { throw new Error('unexpected gh call'); };
    const { ask } = scriptedAsk([]);
    await expect(runDigest({ gh, ask, repo: 'openstatusHQ/openstatus', figures: 'kit', log: () => {} }))
      .rejects.toThrow(/not confirmed by the company yet, so only a dry run may use it/);
  });
});

describe('digest.mjs main and rejected.json on disk', () => {
  const entry = attempt => ({ stage: 'composition', attempt, refusal: ['a refusal'], answer: `answer ${attempt}` });
  const outDir = () => join(mkdtempSync(join(tmpdir(), 'rise-changes-test-')), 'out');

  it('writes rejected.json the moment an answer is kept, so a run stopped mid-way leaves it parseable', async () => {
    const out = outDir();
    const file = join(out, 'rejected.json');
    let onDisk = null;
    const digest = async ({ onRefused }) => {
      onRefused(entry(1));
      onDisk = JSON.parse(readFileSync(file, 'utf8'));
      onRefused(entry(2));
      throw new Error('the job was cancelled');
    };
    await expect(main(['--out', out], { env: {}, log: () => {}, digest })).rejects.toThrow('the job was cancelled');
    expect(onDisk).toEqual([entry(1)]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([entry(1), entry(2)]);
    expect(existsSync(join(out, 'run.json'))).toBe(false);
  });

  it('writes no rejected.json when nothing was refused', async () => {
    const out = outDir();
    const digest = async () => ({ written: false, reason: 'No pull request was merged into main in the period' });
    await main(['--out', out], { env: {}, log: () => {}, digest });
    expect(existsSync(join(out, 'rejected.json'))).toBe(false);
    expect(JSON.parse(readFileSync(join(out, 'run.json'), 'utf8'))).toEqual({ written: false, reason: 'No pull request was merged into main in the period' });
  });
});
