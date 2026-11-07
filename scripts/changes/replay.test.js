import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAIMS_SYSTEM } from './claims-context.js';
import { caveatSections } from './claims.js';
import { main, readPeriods } from './replay.mjs';

const fixture = name => readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures', name), 'utf8').replace(/\r\n/g, '\n');
const REPO = 'SyberLabs/RISE';
const WEEK = { id: '2026-10-14', from: '2026-10-13T02:00:00.000Z', to: '2026-10-14T09:00:00.000Z' };

/** gh as replay sees it: the repository's public record, then the recorded week's page for every period. */
const fakeGh = () => async args => {
  if (args[0] === 'api' && args.at(-1) === `repos/${REPO}`) return JSON.stringify({ full_name: REPO, private: false, visibility: 'public' });
  if (args[1] === 'graphql') return fixture('graphql-week.json');
  throw new Error(`unexpected gh call ${args.slice(0, 2).join(' ')}`);
};

const quotedPull = prompt => JSON.parse(prompt.slice(prompt.indexOf('<pull_request>\n') + 15, prompt.indexOf('\n</pull_request>')));
/** The router's recorded answer; for claims, the title and the first line under each caveat section, pending. */
function fakeAsk(route = fixture('route-answer.txt')) {
  const calls = [];
  const ask = async request => {
    calls.push(request);
    if (request.system !== CLAIMS_SYSTEM) return route;
    const pull = quotedPull(request.prompt);
    const caveats = caveatSections(pull.body).map(section => Array.from(pull.body).slice(section.start, section.end).join('').split('\n').find(line => line.trim()).trim());
    return JSON.stringify({ claims: [
      { text: 'It changes what its title says.', kind: 'behavior', status: 'shipped', quote: pull.title, field: 'title' },
      ...caveats.map(quote => ({ text: 'Something here is left for later.', kind: 'process', status: 'pending', quote, field: 'body' }))
    ] });
  };
  return { ask, calls };
}

const scratch = () => mkdtempSync(join(tmpdir(), 'rise-replay-test-'));
const TITLE_655 = JSON.parse(fixture('graphql-week.json')).data.repository.pullRequests.nodes.find(node => node.number === 655).title.slice(0, 40);

describe('replay.mjs', () => {
  it('reads the seven published periods built in, or a file of periods, and refuses a period that is not one', async () => {
    const builtin = await readPeriods('builtin');
    expect(builtin.periods.map(period => period.id)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-16-2', '2026-10-19', '2026-10-26', '2026-11-02']);
    expect(builtin.hidden).toEqual([652, 653, 655, 660, 672, 673, 684, 686, 732, 734, 738, 742, 746]);
    const file = join(scratch(), 'periods.json');
    writeFileSync(file, JSON.stringify({ periods: [WEEK] }));
    expect(await readPeriods(file)).toEqual({ periods: [WEEK], hidden: builtin.hidden });
    writeFileSync(file, JSON.stringify({ periods: [{ ...WEEK, to: WEEK.from }] }));
    await expect(readPeriods(file)).rejects.toThrow(/each period is \{ id, from, to \}/);
  });

  it('routes and claims a period, counting calls and bytes by role, and a second pass over the same cache makes no model call', async () => {
    const dir = scratch();
    const periods = join(dir, 'periods.json');
    writeFileSync(periods, JSON.stringify({ periods: [WEEK, { ...WEEK, id: '2026-10-14-2' }] }));
    const cache = join(dir, 'cache');
    const first = fakeAsk();
    const lines = [];
    const one = await main(['--periods', periods, '--cache', cache, '--out', join(dir, 'one')], { gh: fakeGh(), ask: first.ask, log: line => lines.push(line) });
    const claimCalls = first.calls.filter(call => call.system === CLAIMS_SYSTEM).length;
    expect(one.calls).toEqual({ router: 1, claims: claimCalls, total: 1 + claimCalls });
    expect(claimCalls).toBe(one.periods[0].claimed.length);
    expect(one.periods[1]).toMatchObject({ id: '2026-10-14-2', calls: { router: 0, claims: 0 } });
    expect(one.inputBytes.router).toBe(Buffer.byteLength(first.calls[0].system) + Buffer.byteLength(first.calls[0].prompt));
    expect(one.outputBytes.router).toBe(Buffer.byteLength(fixture('route-answer.txt')));
    expect(one.cacheHits).toEqual({ routes: 15, claims: claimCalls });
    expect(JSON.parse(readFileSync(join(dir, 'one', 'report.json'), 'utf8'))).toEqual(one);
    expect(existsSync(join(cache, 'cache', 'routes'))).toBe(true);
    expect(existsSync(join(cache, 'cache', 'claims'))).toBe(true);
    // The four hidden-caveat pull requests of the recorded week are claimed with their caveat quoted, included or not.
    const hidden = Object.fromEntries(one.hiddenCaveats.map(entry => [entry.number, entry]));
    for (const number of [652, 653, 655, 660]) expect(hidden[number], `#${number}`).toMatchObject({ found: true, covered: true });
    for (const number of [672, 742]) expect(hidden[number]).toMatchObject({ found: false });
    expect(one.pulls['655'].claims.some(claim => claim.status === 'pending' && claim.span.field === 'body')).toBe(true);
    expect(lines).toContain(`Replay: 1 router call, ${claimCalls} claims calls; 15 routes and ${claimCalls} claims from the cache`);

    const second = fakeAsk();
    const two = await main(['--periods', periods, '--cache', cache, '--out', join(dir, 'two')], { gh: fakeGh(), ask: second.ask, log: () => {} });
    expect(second.calls).toHaveLength(0);
    expect(two.calls).toEqual({ router: 0, claims: 0, total: 0 });
    expect([one.cachedReCalls, one.uncachedRetries]).toEqual([0, 15 + claimCalls]);
    expect([two.cachedReCalls, two.uncachedRetries]).toEqual([0, 0]);
    expect(two.pulls).toEqual(Object.fromEntries(Object.entries(one.pulls).map(([number, pull]) => [number, { ...pull, fromCache: true }])));
  });

  it('claims a hidden-caveat pull request the router left out, and says it was not included', async () => {
    const dir = scratch();
    const periods = join(dir, 'periods.json');
    writeFileSync(periods, JSON.stringify({ periods: [WEEK] }));
    const minor = fixture('route-answer.txt').replace('"655": {"audience": "both", "significance": "major"', '"655": {"audience": "team", "significance": "minor"');
    const { ask, calls } = fakeAsk(minor);
    const report = await main(['--periods', periods, '--cache', join(dir, 'cache'), '--out', join(dir, 'out')], { gh: fakeGh(), ask, log: () => {} });
    expect(report.periods[0].included).not.toContain(655);
    expect(report.periods[0].claimed).toContain(655);
    expect(calls.some(call => call.system === CLAIMS_SYSTEM && quotedPull(call.prompt).body.includes('## Not verified\n\n- **No real model'))).toBe(true);
    expect(report.hiddenCaveats.find(entry => entry.number === 655)).toEqual({ number: 655, found: true, included: false, pendingOrFlagged: 1, sections: 1, covered: true });
  });

  it('retries on the second pass a pull request the first could not cache, and counts it apart from a call for one it cached', async () => {
    const dir = scratch();
    const periods = join(dir, 'periods.json');
    writeFileSync(periods, JSON.stringify({ periods: [WEEK] }));
    const cache = join(dir, 'cache');
    const fake = fakeAsk();
    const failing = async request => {
      if (request.system === CLAIMS_SYSTEM && quotedPull(request.prompt).title.startsWith(TITLE_655)) throw new Error('The CLI exited with 1');
      return fake.ask(request);
    };
    const one = await main(['--periods', periods, '--cache', cache, '--out', join(dir, 'one')], { gh: fakeGh(), ask: failing, log: () => {} });
    expect(one.pulls['655'].claims).toEqual([]);
    const two = await main(['--periods', periods, '--cache', cache, '--out', join(dir, 'two')], { gh: fakeGh(), ask: fakeAsk().ask, log: () => {} });
    expect(two.calls).toEqual({ router: 0, claims: 1, total: 1 });
    expect([two.cachedReCalls, two.uncachedRetries]).toEqual([0, 1]);

    writeFileSync(join(cache, 'cache', 'claims', `${one.pulls['652'].mergeSha}.json`), 'not json');
    const three = await main(['--periods', periods, '--cache', cache, '--out', join(dir, 'three')], { gh: fakeGh(), ask: fakeAsk().ask, log: () => {} });
    expect(three.calls).toEqual({ router: 0, claims: 1, total: 1 });
    expect([three.cachedReCalls, three.uncachedRetries]).toEqual([1, 0]);
  });

  it('counts the claims a repair recovered, per pull request and in all', async () => {
    const dir = scratch();
    const periods = join(dir, 'periods.json');
    writeFileSync(periods, JSON.stringify({ periods: [WEEK] }));
    const fake = fakeAsk();
    const bound = { text: 'One turn at every bound comes to 5,820 characters.', kind: 'behavior', status: 'shipped', field: 'body' };
    const ask = async request => {
      const given = await fake.ask(request);
      if (request.system !== CLAIMS_SYSTEM || !quotedPull(request.prompt).title.startsWith(TITLE_655)) return given;
      if (request.prompt.includes('<dropped_for_a_number>')) return JSON.stringify({ claims: [{ ...bound, quote: 'One turn at every bound comes to 5,820 characters, so the newest turn always fits.' }] });
      return JSON.stringify({ claims: [...JSON.parse(given).claims, { ...bound, quote: 'so the newest turn always fits.' }] });
    };
    const lines = [];
    const report = await main(['--periods', periods, '--cache', join(dir, 'cache'), '--out', join(dir, 'out')], { gh: fakeGh(), ask, log: line => lines.push(line) });
    expect(report.pulls['655']).toMatchObject({ recovered: 1, dropped: ['claim 3: its text says "One", which its quote does not'] });
    expect(Object.entries(report.pulls).filter(([, pull]) => pull.recovered !== 0).map(([number]) => number)).toEqual(['655']);
    expect(report.recovered).toBe(1);
    expect(report.calls.claims).toBe(report.periods[0].claimed.length + 1);
    expect(lines).toContain('Claims recovered by a repair: 1');
  });

  it('stops before reading a pull request or asking a model when the repository is not public', async () => {
    const dir = scratch();
    const { ask, calls } = fakeAsk();
    const gh = async args => (args.at(-1) === `repos/${REPO}` ? JSON.stringify({ full_name: REPO, private: true, visibility: 'private' }) : fixture('graphql-week.json'));
    await expect(main(['--periods', 'builtin', '--cache', join(dir, 'cache'), '--out', join(dir, 'out')], { gh, ask, log: () => {} })).rejects.toThrow(/not public/);
    expect(calls).toHaveLength(0);
  });

  it('needs --periods, --cache and --out, and a new or empty out directory', async () => {
    const dir = scratch();
    const deps = { gh: fakeGh(), ask: fakeAsk().ask, log: () => {} };
    await expect(main(['--cache', dir, '--out', join(dir, 'out')], deps)).rejects.toThrow('replay needs --periods <file|builtin>, --cache <dir> and --out <dir>');
    writeFileSync(join(dir, 'taken'), '');
    await expect(main(['--periods', 'builtin', '--cache', join(dir, 'cache'), '--out', dir], deps)).rejects.toThrow(/not empty/);
  });
});
