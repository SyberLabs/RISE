import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectMergedPulls } from '../../src/core/changes/collect.js';
import { factCard } from '../../src/core/changes/facts.js';
import { prefilter } from '../../src/core/changes/prefilter.js';
import { ROUTE_CONTEXT_FIELDS, routeContext } from './route-context.js';
import { buildRouteRequest } from './route.js';

const page = readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures/graphql-week.json'), 'utf8');

/** The fact cards of the recorded week's pull requests offered to the router (#652 to #671 less the records). */
async function recordedCards() {
  const pulls = await collectMergedPulls(async () => page, { repo: 'SyberLabs/RISE', from: '2026-10-13T02:00:00Z', to: '2026-10-14T09:00:00Z' });
  return prefilter(pulls).candidates.map(factCard);
}

describe('routeContext, the router’s context contract', () => {
  it('gives each pull request its number, title, labels, size, areas with diff stats, flags and the first 600 characters of its body, nothing more', async () => {
    const cards = await recordedCards();
    const context = routeContext(cards);
    expect(ROUTE_CONTEXT_FIELDS).toEqual(['number', 'title', 'labels', 'fileCount', 'additions', 'deletions', 'areas', 'flags', 'body']);
    expect(context).toHaveLength(15);
    context.forEach((entry, index) => {
      expect(Object.keys(entry)).toEqual(ROUTE_CONTEXT_FIELDS);
      expect(entry.number).toBe(cards[index].number);
      expect(entry.areas).toEqual(cards[index].areas);
      expect([entry.fileCount, entry.additions, entry.deletions]).toEqual([cards[index].fileCount, cards[index].additions, cards[index].deletions]);
      for (const area of entry.areas) expect(Object.keys(area)).toEqual(['area', 'files', 'additions', 'deletions']);
    });
  });

  it('cuts the whole body at 600 characters, never a short one', async () => {
    const cards = await recordedCards();
    const context = routeContext(cards);
    const p655 = context.find(entry => entry.number === 655);
    const whole = cards.find(card => card.number === 655).body;
    expect(Array.from(whole).length).toBeGreaterThan(4000);
    expect(p655.body).toBe(Array.from(whole).slice(0, 600).join(''));
    const short = { ...cards[0], body: 'A short body.' };
    expect(routeContext([short])[0].body).toBe('A short body.');
  });

  it('gives a pull request over 100 files its whole size, not the size of the files listed', async () => {
    const [card] = await recordedCards();
    const sweep = { ...card, fileCount: 400, additions: 12000, deletions: 9000 };
    expect(routeContext([sweep])[0]).toMatchObject({ fileCount: 400, additions: 12000, deletions: 9000 });
  });

  it('names only the flags that are set', async () => {
    const [card] = await recordedCards();
    const flagged = { ...card, flags: { migration: false, config: true, dependency: false, workflow: true, docsOnly: false, testsOnly: false } };
    expect(routeContext([flagged])[0].flags).toEqual(['config', 'workflow']);
    expect(routeContext([{ ...card, flags: { ...flagged.flags, config: false, workflow: false } }])[0].flags).toEqual([]);
  });

  it('holds the recorded week’s router input to its measured size, so a field added shows here', async () => {
    const { system, prompt } = buildRouteRequest(await recordedCards());
    expect(Buffer.byteLength(system) + Buffer.byteLength(prompt)).toBe(ROUTER_INPUT_BYTES);
  });
});

/** The recorded week's router input in bytes, system text included. */
const ROUTER_INPUT_BYTES = 20514;
