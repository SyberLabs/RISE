import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAIMS_CACHE_BYTES, CLAIMS_CACHE_SCHEMA } from '../../src/core/changes/contract.js';
import { FACTS_VERSION } from '../../src/core/changes/facts.js';
import { CLAIMS_CONTEXT_VERSION, CLAIMS_SYSTEM, buildClaimsRequest } from './claims-context.js';
import { CAVEAT_PHRASES, admitClaims, caveatSections, claimCards, claimId, claimsContract, readClaimsCache } from './claims.js';
import { cacheReader, contractHash, quoted } from './route.js';

const REPO = 'SyberLabs/RISE';
const sha = n => String(n).padStart(40, 'c');
const BODY = 'Adds a cache of 22,000 lines.\n\n## Not verified\n\nNo model was asked a question with it.\n';
const card = (number, extra = {}) => ({
  number, mergeSha: sha(number), title: `Cache change ${number}`, body: BODY, bodyCut: false, labels: ['changes'],
  commits: ['Add the cache', 'Test the cache twice'], files: [{ path: 'src/a.js', additions: 3, deletions: 1 }], fileCount: 1, additions: 3, deletions: 1,
  areas: [{ area: 'src', files: 1, additions: 3, deletions: 1 }],
  flags: { migration: false, config: false, dependency: false, workflow: false, docsOnly: false, testsOnly: false },
  issues: [{ number: 9, title: 'Cache the claims' }], ...extra
});
const answer = claims => JSON.stringify({ claims });
const shipped = { text: 'Adds a cache of 22k lines.', kind: 'behavior', status: 'shipped', quote: 'Adds a cache of 22,000 lines.', field: 'body' };
const caveat = { text: 'No model was asked a question with the cache.', kind: 'behavior', status: 'pending', quote: 'No model was asked a question with it.', field: 'body' };
const id = text => `cl_${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;

describe('admitClaims', () => {
  it('finds each quote in its field, computes the span in code points from its first occurrence, and names it by the hash of where it is', () => {
    const astral = card(1, { body: `\u{1F916} ${BODY}` });
    const { readable, claims, dropped } = admitClaims(answer([shipped, { ...caveat, status: 'flagged' }]), astral, { repo: REPO });
    expect(readable).toBe(true);
    expect(dropped).toEqual([]);
    const start = Array.from(`\u{1F916} ${BODY}`.slice(0, `\u{1F916} ${BODY}`.indexOf(shipped.quote))).length;
    expect(start).toBe(2);
    expect(claims[0]).toEqual({
      id: id(`${REPO}#1@${sha(1)}:body::2-31`),
      text: shipped.text, kind: 'behavior', status: 'shipped',
      span: { field: 'body', start: 2, end: 31, text: shipped.quote }
    });
    expect(claims[1].span.start).toBe(Array.from(`\u{1F916} ${BODY}`).join('').indexOf(caveat.quote) - 1);
    expect(claimId({ repo: REPO, pr: 1, mergeSha: sha(1), field: 'body', start: 2, end: 31 })).toBe(claims[0].id);
  });

  it('reads line endings as LF on both sides, and nothing else: a quote with other spacing is not found', () => {
    const crlf = card(2, { body: BODY.replace(/\n/g, '\r\n') });
    const twoLines = { ...caveat, quote: '## Not verified\r\n\r\nNo model was asked' };
    const { claims, dropped } = admitClaims(answer([twoLines, { ...shipped, quote: 'Adds a cache of  22,000 lines.' }]), crlf, { repo: REPO });
    expect(claims.map(claim => claim.span.text)).toEqual(['## Not verified\n\nNo model was asked']);
    expect(dropped).toEqual(['claim 2: its quote is not in the body word for word']);
  });

  it('reads a commit or an issue by its index, and names the index in the span and the id', () => {
    const commit = { text: 'The cache is tested twice.', kind: 'process', status: 'shipped', quote: 'twice', field: 'commit', index: 1 };
    const issue = { text: 'Claims are cached.', kind: 'behavior', status: 'shipped', quote: 'Cache the claims', field: 'issue', index: 0 };
    const title = { text: 'Changes the cache.', kind: 'behavior', status: 'shipped', quote: 'Cache change 3', field: 'title' };
    const { claims, dropped } = admitClaims(answer([commit, issue, title]), card(3), { repo: REPO });
    expect(dropped).toEqual([]);
    expect(claims.map(claim => claim.span)).toEqual([
      { field: 'commit', index: 1, start: 15, end: 20, text: 'twice' },
      { field: 'issue', index: 0, start: 0, end: 16, text: 'Cache the claims' },
      { field: 'title', start: 0, end: 14, text: 'Cache change 3' }
    ]);
    expect(claims[0].id).toBe(id(`${REPO}#3@${sha(3)}:commit:1:15-20`));
  });

  it('drops a claim off the menu, too long, without its number in the quote, of another shape, or past the twelfth, and says why', () => {
    const bad = [
      { ...shipped, kind: 'feature' },
      { ...shipped, status: 'done' },
      { ...shipped, field: 'diff' },
      { ...shipped, text: 'x'.repeat(301) },
      { ...shipped, text: 'Adds a cache of six lines.' },
      { ...shipped, text: 'Adds a cache of 23,000 lines.' },
      { ...shipped, note: 'extra' },
      { ...shipped, quote: '' },
      { ...shipped, quote: 'y'.repeat(1001) },
      { ...shipped, field: 'commit' },
      { ...shipped, field: 'commit', index: 7 },
      { ...shipped, index: 0 },
      shipped
    ];
    const { claims, dropped } = admitClaims(answer(bad), card(4), { repo: REPO });
    expect(claims).toEqual([]);
    expect(dropped).toEqual([
      'claim 1: kind is not one of behavior, performance, interface, security, process, docs',
      'claim 2: status is not one of shipped, flagged, partial, reverted, pending',
      'claim 3: field is not one of body, title, commit, issue',
      'claim 4: text is not 1 to 300 characters',
      'claim 5: its text says "six", which its quote does not',
      'claim 6: its text says "23,000", which its quote does not',
      'claim 7: a claim has exactly text, kind, status, quote, field, and index for a commit or an issue',
      'claim 8: quote is not 1 to 1000 characters',
      'claim 9: quote is not 1 to 1000 characters',
      'claim 10: index is not the position of one of the 2 commits',
      'claim 11: index is not the position of one of the 2 commits',
      'claim 12: a claim has exactly text, kind, status, quote, field, and index for a commit or an issue',
      'claim 13: past the 12-claim limit'
    ]);
    expect(admitClaims(answer(['a claim', null]), card(4), { repo: REPO }).dropped).toEqual([
      'claim 1: a claim has exactly text, kind, status, quote, field, and index for a commit or an issue',
      'claim 2: a claim has exactly text, kind, status, quote, field, and index for a commit or an issue'
    ]);
    const many = Array.from({ length: 14 }, () => shipped);
    const capped = admitClaims(answer(many), card(4), { repo: REPO });
    expect(capped.claims).toHaveLength(1);
    expect(capped.dropped).toEqual([
      ...Array.from({ length: 11 }, (_, i) => `claim ${i + 2}: it repeats the span of an earlier claim`),
      'claims 13 to 14: past the 12-claim limit'
    ]);
  });

  it('refuses a quote that occurs more than once in its field, so a span cannot anchor outside the section it was quoted from', () => {
    const twice = card(6, { body: '## Summary\nNo model was asked.\n\n## Not verified\n\nNo model was asked.\n' });
    const repeated = { ...caveat, quote: 'No model was asked.' };
    const longer = { ...caveat, quote: '## Not verified\n\nNo model was asked.' };
    const { claims, dropped } = admitClaims(answer([repeated, longer]), twice, { repo: REPO });
    expect(dropped).toEqual(['claim 1: its quote occurs 2 times in the body; quote enough words to be found once']);
    expect(claims.map(claim => claim.span.start)).toEqual([32]);
  });

  it('refuses a quote that is in the pull request but not in the field it names', () => {
    const { claims, dropped } = admitClaims(answer([
      { ...shipped, field: 'title' },
      { ...shipped, field: 'commit', index: 0 },
      { ...shipped, quote: 'Add the cache', text: 'Adds the cache.' }
    ]), card(7), { repo: REPO });
    expect(claims).toEqual([]);
    expect(dropped).toEqual([
      'claim 1: its quote is not in the title word for word',
      'claim 2: its quote is not in the commit word for word',
      'claim 3: its quote is not in the body word for word'
    ]);
  });

  it('reads a null index on the body as none, an answer in one code fence, and nothing that is not {"claims": [...]}', () => {
    expect(admitClaims(answer([{ ...shipped, index: null }]), card(5), { repo: REPO }).claims).toHaveLength(1);
    expect(admitClaims(`\`\`\`json\n${answer([shipped])}\n\`\`\``, card(5), { repo: REPO }).claims).toHaveLength(1);
    for (const text of ['not json', '[]', '{"claims": {}}', '{"routes": []}', 42]) {
      expect(admitClaims(text, card(5), { repo: REPO })).toEqual({ readable: false, claims: [], dropped: [] });
    }
  });
});

describe('caveatSections', () => {
  const recorded = JSON.parse(readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures/hidden-caveats.json'), 'utf8'));

  it('finds a caveat section in each of the 13 pull requests whose caveat the 4,000-character cut hid', () => {
    expect(recorded.pulls.map(pull => pull.number)).toEqual([652, 653, 655, 660, 672, 673, 684, 686, 732, 734, 738, 742, 746]);
    for (const pull of recorded.pulls) {
      const sections = caveatSections(pull.body);
      expect(sections.length, `#${pull.number}`).toBeGreaterThan(0);
      expect(sections.every(section => section.start > 4000), `#${pull.number}`).toBe(true);
    }
    const p655 = recorded.pulls.find(pull => pull.number === 655).body;
    const [section] = caveatSections(p655);
    expect(section.heading).toBe('Not verified');
    expect(section.start).toBe(Array.from(p655.slice(0, p655.indexOf('## Not verified\n') + 16)).length);
    expect(section.end).toBe(Array.from(p655).length);
  });

  it('reads a heading or a label line that names a caveat, and ends it at the next heading of its level or higher', () => {
    const body = [
      '## What changed', 'It works.', '', '## Not verified', 'Phones.', '### Detail', 'More.', '## Next', 'Later.',
      '**Known limits**', 'Ten at most.', '', 'Awaiting a person:', 'The owner signs off.', '# Notes', 'Done.'
    ].join('\n');
    const sections = caveatSections(body);
    expect(sections.map(({ heading }) => heading)).toEqual(['Not verified', 'Known limits', 'Awaiting a person']);
    const text = Array.from(body);
    expect(text.slice(sections[0].start, sections[0].end).join('')).toBe('Phones.\n### Detail\nMore.\n');
    expect(text.slice(sections[1].start, sections[1].end).join('')).toBe('Ten at most.\n\n');
    expect(text.slice(sections[2].start, sections[2].end).join('')).toBe('The owner signs off.\n');
  });

  it('names each phrase of its short list, with its plurals and close inflections, and no caveat in prose, a list item, or a heading with nothing under it', () => {
    expect(CAVEAT_PHRASES).toEqual(['not verified', 'unverified', 'not done', 'not yet', 'not in this pr', 'pending', 'awaiting', 'human gate', 'needs a human', 'todos?', 'known limit(?:s|ations?)?']);
    const named = [
      'NOT VERIFIED', 'Unverified', 'Not done', 'Not yet', 'Not in this PR', 'Pending', 'Awaiting', 'Human gate', 'Needs a human',
      'TODO', 'TODOs', 'Known limit', 'Known limits', 'Known limitation', 'Known limitations'
    ];
    for (const heading of named) expect(caveatSections(`## ${heading} here\nText.`), heading).toHaveLength(1);
    for (const heading of ['Todoist', 'Known limiter', 'Pendingly', 'Unverifiable']) expect(caveatSections(`## ${heading}\nText.`), heading).toEqual([]);
    expect(caveatSections('The unverified path is now refused.\n- Not verified: phones\n## Not done\n## Next\nText.')).toEqual([]);
  });

  it('reads no heading inside a fenced code block, so a snippet neither makes a section nor cuts one short', () => {
    const body = ['## Setup', '```sh', '# TODO later', 'echo', '```', '## Not verified', 'Phones.', '~~~', '# Not done', '## Next', '~~~', 'More.', '## Next', 'x'].join('\n');
    const sections = caveatSections(body);
    expect(sections.map(section => section.heading)).toEqual(['Not verified']);
    expect(Array.from(body).slice(sections[0].start, sections[0].end).join('')).toBe('Phones.\n~~~\n# Not done\n## Next\n~~~\nMore.\n');
  });

  it('reads a bold label followed by a colon, and no list item, quote or numbered item ending in one', () => {
    const body = ['**Not verified**:', 'Phones.', '', '__Pending__:', 'The owner.', '- Not verified:', 'a', '> Pending:', 'b', '1. Pending:', 'c', '* TODO:', 'd'].join('\n');
    expect(caveatSections(body).map(section => section.heading)).toEqual(['Not verified', 'Pending']);
  });

  it('finds a caveat section in exactly #652, #653, #655, #660 and #661 of the recorded week', () => {
    const week = JSON.parse(readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures/graphql-week.json'), 'utf8')).data.repository.pullRequests.nodes;
    const found = week.filter(node => caveatSections(node.body ?? '').length > 0).map(node => node.number).sort();
    expect(found).toEqual([652, 653, 655, 660, 661]);
    // #661's "Not done or seen" is within the first 4,000 characters, so it is not one of the 13 the cut hid.
    const p661 = week.find(node => node.number === 661).body;
    expect(caveatSections(p661)[0]).toMatchObject({ heading: 'Not done or seen' });
    expect(caveatSections(p661)[0].start).toBeLessThan(4000);
  });

  it('is linear: 7,000 caveat sections are read at once', () => {
    const body = '# TODO\nx\n'.repeat(7000);
    const started = performance.now();
    const sections = caveatSections(body);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(sections).toHaveLength(7000);
    expect(sections.at(-1)).toEqual({ heading: 'TODO', start: 7 + 9 * 6999, end: 9 * 7000 });
  });
});

describe('claimsContract', () => {
  it('is the route cache’s hash over the claims system text, its model, the claims context’s version and the fact rules’ version', () => {
    const hash = contractHash(CLAIMS_SYSTEM, 'm', CLAIMS_CONTEXT_VERSION, FACTS_VERSION);
    expect(claimsContract({ model: 'm' })).toBe(hash);
    expect(claimsContract({ model: 'n' })).not.toBe(hash);
    expect(contractHash(CLAIMS_SYSTEM, 'm', CLAIMS_CONTEXT_VERSION + 1, FACTS_VERSION)).not.toBe(hash);
    expect(contractHash(`${CLAIMS_SYSTEM} `, 'm', CLAIMS_CONTEXT_VERSION, FACTS_VERSION)).not.toBe(hash);
  });
});

describe('claimCards', () => {
  const now = new Date('2026-11-06T09:00:00.000Z');
  const scripted = answers => {
    const calls = [];
    const ask = async request => { calls.push(request); const next = answers.shift(); if (next === undefined) throw new Error('unexpected ask'); return next; };
    return { ask, calls };
  };
  const reader = files => async mergeSha => files[mergeSha] ?? null;
  const run = (cards, ask, extra = {}) => claimCards({ cards, ask, model: 'm', repo: REPO, now, log: () => {}, ...extra });

  it('makes one call a pull request with its own request, admits its claims, and caches them by merge SHA', async () => {
    const { ask, calls } = scripted([answer([shipped, caveat])]);
    const lines = [];
    const { results, cache, calls: made } = await run([card(10)], ask, { log: line => lines.push(line) });
    expect(calls).toEqual([{ ...buildClaimsRequest(card(10)), model: 'm' }]);
    expect(made).toBe(1);
    expect(results[0]).toMatchObject({ number: 10, fromCache: false, gap: false, dropped: [] });
    expect(results[0].claims.map(claim => claim.status)).toEqual(['shipped', 'pending']);
    expect(results[0].caveats).toEqual([{ heading: 'Not verified', start: 47, end: 87, covered: true }]);
    const file = JSON.parse(cache[`cache/claims/${sha(10)}.json`]);
    expect(file).toEqual({ schema: CLAIMS_CACHE_SCHEMA, mergeSha: sha(10), contract: claimsContract({ model: 'm' }), claims: results[0].claims, gap: false, at: now.toISOString() });
    expect(lines).toContain('Claims: 1 call, 0 repairs; 0 of 1 pull requests from the cache; 0 with a caveat gap');
  });

  it('asks once more, with the refusal and only that pull request’s request, when no pending or flagged claim quotes its caveat section', async () => {
    const refusals = [];
    const { ask, calls } = scripted([answer([shipped, { ...caveat, status: 'shipped' }]), answer([shipped, caveat])]);
    const { results, calls: made } = await run([card(11)], ask, { refused: entry => refusals.push(entry) });
    expect(made).toBe(2);
    expect(calls[1].system).toBe(calls[0].system);
    expect(calls[1].prompt.startsWith(calls[0].prompt)).toBe(true);
    expect(calls[1].prompt).toContain('- The body’s caveat section at characters 47 to 87, headed "Not verified", says what is not verified, not done or pending, and no claim of status pending or flagged quotes from it; add one, quoting its exact words.');
    expect(calls[1].prompt).toContain(quoted('previous_answer', answer([shipped, { ...caveat, status: 'shipped' }])));
    expect(results[0]).toMatchObject({ gap: false });
    expect(results[0].claims.map(claim => claim.status)).toEqual(['shipped', 'pending']);
    expect(refusals).toEqual([{ stage: 'claims', pull: 11, attempt: 1, refusal: [expect.stringContaining('"Not verified"')], answer: expect.any(String) }]);
  });

  it('keeps the claims and records the gap when the repair still leaves the caveat unquoted, logs it, and caches it marked', async () => {
    const lines = [];
    const { ask, calls } = scripted([answer([shipped]), answer([shipped])]);
    const { results, cache, repairs } = await run([card(12)], ask, { log: line => lines.push(line) });
    expect(calls).toHaveLength(2);
    expect(repairs).toBe(1);
    expect(results[0]).toMatchObject({ gap: true, caveats: [{ heading: 'Not verified', covered: false }] });
    expect(results[0].claims).toHaveLength(1);
    expect(JSON.parse(cache[`cache/claims/${sha(12)}.json`]).gap).toBe(true);
    expect(lines).toContain('Claims: #12 has no pending or flagged claim quoting its section "Not verified" after one repair; its 1 claim is kept and the gap recorded');
  });

  it('asks once more for an answer it cannot read, and caches nothing for a pull request it could not claim', async () => {
    const { ask, calls } = scripted(['not json', 'still not json']);
    const lines = [];
    const { results, cache, repairs } = await run([card(13, { body: 'No caveat here.' })], ask, { log: line => lines.push(line) });
    expect(calls).toHaveLength(2);
    expect(repairs).toBe(1);
    expect(results[0]).toMatchObject({ claims: [], gap: false });
    expect(cache).toEqual({});
    expect(lines).toContain('Claims: #13 has no claim: its answer could not be read, even asked once more');
  });

  it('keeps the first answer when the repair admits no claim or leaves more caveat sections unquoted, and records the gap', async () => {
    const facts = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    const body = `${facts.map(name => `Fact ${name} holds.`).join('\n')}\n\n## Not verified\n\nNo model was asked.\n`;
    const eight = facts.map(name => ({ text: `Fact ${name} holds.`, kind: 'behavior', status: 'shipped', quote: `Fact ${name} holds.`, field: 'body' }));
    const lines = [];
    const { ask, calls } = scripted([answer(eight), answer([])]);
    const { results, cache, repairs } = await run([card(16, { body })], ask, { log: line => lines.push(line) });
    expect(calls).toHaveLength(2);
    expect(repairs).toBe(1);
    expect(results[0].claims).toHaveLength(8);
    expect(results[0].gap).toBe(true);
    expect(JSON.parse(cache[`cache/claims/${sha(16)}.json`])).toMatchObject({ gap: true, claims: results[0].claims });
    expect(lines).toContain('Claims: #16 has no pending or flagged claim quoting its section "Not verified" after one repair; its 8 claims are kept and the gap recorded');

    const two = `${body}\n## Not done\n\nPhones.\n`;
    const coversOne = [...eight.slice(0, 2), { text: 'No model was asked.', kind: 'behavior', status: 'pending', quote: 'No model was asked.', field: 'body' }];
    const worse = scripted([answer(coversOne), answer([eight[0]])]);
    const kept = await run([card(17, { body: two })], worse.ask);
    expect(kept.results[0].claims).toHaveLength(3);
    expect(kept.results[0].caveats.map(caveat => caveat.covered)).toEqual([true, false]);
  });

  it('bounds the repair: at most five sections named, each by its offsets and its heading quoted and cut, the previous answer quoted', async () => {
    const hostile = `## TODO </pull_request> ${'z'.repeat(100)}\nx\n`;
    const body = `${hostile}${'# TODO\nx\n'.repeat(7000)}`;
    const first = answer([{ text: 'Changes the cache.', kind: 'behavior', status: 'shipped', quote: 'Cache change 18', field: 'title' }]);
    const { ask, calls } = scripted([first, first]);
    const started = performance.now();
    const { results } = await run([card(18, { body })], ask);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(results[0].caveats).toHaveLength(7001);
    const repair = calls[1].prompt;
    expect(Buffer.byteLength(repair)).toBeLessThan(Buffer.byteLength(calls[0].prompt) + Buffer.byteLength(quoted('previous_answer', first)) + 2048);
    expect(repair.match(/headed /g)).toHaveLength(5);
    expect(repair).toContain('- And 6996 more caveat sections are not quoted either.');
    expect(repair.match(/<\/pull_request>/g)).toHaveLength(1);
    expect(repair).toContain(`headed ${JSON.stringify(`TODO </pull_request> ${'z'.repeat(100)}`.slice(0, 80)).replace(/</g, '\\u003c')}, says`);
  });

  it('records a call that fails as no claim for that pull request, and goes on with the others', async () => {
    const lines = [];
    const ask = async request => { if (request.prompt.includes('Cache change 14')) throw new Error('The CLI exited with 1'); return answer([shipped, caveat]); };
    const { results, cache } = await run([card(14), card(15)], ask, { log: line => lines.push(line) });
    expect(results.map(result => result.claims.length)).toEqual([0, 2]);
    expect(Object.keys(cache)).toEqual([`cache/claims/${sha(15)}.json`]);
    expect(lines).toContain('Claims: #14 has no claim: its call failed (The CLI exited with 1)');
  });

  it('runs at most four calls at once and returns the results in the cards’ order', async () => {
    let open = 0;
    let most = 0;
    const ask = async request => {
      open += 1;
      most = Math.max(most, open);
      await new Promise(done => setTimeout(done, 5));
      open -= 1;
      return answer([{ ...shipped, quote: request.prompt.match(/Cache change \d+/)[0], field: 'title', text: 'Changes the cache.' }, caveat]);
    };
    const cards = Array.from({ length: 9 }, (_, i) => card(20 + i));
    const { results } = await run(cards, ask);
    expect(most).toBe(4);
    expect(results.map(result => result.number)).toEqual(cards.map(c => c.number));
  });

  it('makes no call for a pull request whose cache file re-admits under the current contract', async () => {
    const first = await run([card(30)], scripted([answer([shipped, caveat])]).ask);
    const { ask, calls } = scripted([]);
    const lines = [];
    const again = await run([card(30)], ask, { readCached: reader({ [sha(30)]: first.cache[`cache/claims/${sha(30)}.json`] }), log: line => lines.push(line) });
    expect(calls).toHaveLength(0);
    expect(again.results[0]).toEqual({ ...first.results[0], fromCache: true });
    expect(again.cache).toEqual({});
    expect(lines).toContain('Claims: 0 calls, 0 repairs; 1 of 1 pull requests from the cache; 0 with a caveat gap');
  });

  it('ignores a cache file it cannot re-admit against the pull request’s text, and claims it afresh', async () => {
    const first = await run([card(31)], scripted([answer([shipped, caveat])]).ask);
    const good = JSON.parse(first.cache[`cache/claims/${sha(31)}.json`]);
    const variant = change => JSON.stringify(change(structuredClone(good)));
    const bad = [
      'not json',
      'null',
      variant(entry => ({ ...entry, contract: '0'.repeat(64) })),
      variant(entry => ({ ...entry, mergeSha: sha(9) })),
      variant(entry => ({ ...entry, extra: 1 })),
      variant(entry => ({ ...entry, gap: true })),
      variant(entry => { entry.claims[0].text = 'Adds a cache of 99 lines.'; return entry; }),
      variant(entry => { entry.claims[0].span.start += 1; return entry; }),
      variant(entry => { entry.claims[0].id = 'cl_000000000000'; return entry; }),
      variant(entry => { entry.claims[0].span.text = 'Adds a cache of 22,001 lines.'; return entry; }),
      variant(entry => { entry.claims[1].status = 'shipped'; return entry; })
    ];
    for (const text of bad) {
      const { ask, calls } = scripted([answer([shipped, caveat])]);
      const lines = [];
      const again = await run([card(31)], ask, { readCached: reader({ [sha(31)]: text }), log: line => lines.push(line) });
      expect(calls, text).toHaveLength(1);
      expect(again.results[0].fromCache).toBe(false);
      expect(lines.some(line => line.startsWith(`Claims cache: ${sha(31).slice(0, 12)} ignored`)), text).toBe(true);
    }
    const edited = card(31, { body: BODY.replace('22,000', '23,000') });
    expect(readClaimsCache(first.cache[`cache/claims/${sha(31)}.json`], edited, { repo: REPO, contract: claimsContract({ model: 'm' }) }).problem)
      .toBe('a claim no longer admits against the pull request’s text');
  });
});

describe('cacheReader for the claims', () => {
  it('reads cache/claims/<mergeSha>.json up to its own bound, and never a route file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rise-claims-cache-'));
    try {
      await mkdir(join(dir, 'cache', 'claims'), { recursive: true });
      await mkdir(join(dir, 'cache', 'routes'), { recursive: true });
      await writeFile(join(dir, 'cache', 'claims', `${sha(1)}.json`), 'x'.repeat(8000));
      await writeFile(join(dir, 'cache', 'claims', `${sha(2)}.json`), 'x'.repeat(CLAIMS_CACHE_BYTES + 1));
      await writeFile(join(dir, 'cache', 'routes', `${sha(3)}.json`), '{}');
      const read = cacheReader(dir, { directory: 'claims', bytes: CLAIMS_CACHE_BYTES });
      expect(await read(sha(1))).toHaveLength(8000);
      expect(await read(sha(2))).toBeNull();
      expect(await read(sha(3))).toBeNull();
      expect(await cacheReader(dir)(sha(1))).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
