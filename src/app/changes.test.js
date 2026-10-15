import { describe, expect, it, vi } from 'vitest';
import { CHANGES_ID, REFUSED_SCENE, changesDigestFixture, changesIndexFixture } from '../test/changes-digest.fixture.js';
import { admitChangesDigest, admitChangesIndex, loadChangesDigest, mountChanges, periodWords } from './changes.js';
import { changesFromPath, sceneSampleFromPath } from '../core/jev-demo-path.js';
import { routeFromPath } from '../core/route-url.js';
import sampleDigest from '../core/changes/fixtures/2026-10-14.json' with { type: 'json' };
import sampleIndex from '../core/changes/fixtures/index.json' with { type: 'json' };

const files = (index = changesIndexFixture(), digest = changesDigestFixture()) => async path => {
  if (path === '/content/changes/index.json') return index;
  if (path === `/content/changes/${CHANGES_ID}.json`) return digest;
  throw new Error(`${path}: 404`);
};

async function mount(options) {
  const section = document.createElement('section');
  const launch = vi.fn(async () => {});
  const go = vi.fn();
  await mountChanges(section, { launch, go, load: files(), ...options });
  return { section, launch, go };
}

const refused = (mutate) => {
  const digest = changesDigestFixture();
  mutate(digest);
  return () => admitChangesDigest(digest, CHANGES_ID);
};

describe('RISE Changes addresses', () => {
  it('reads the list and one digest from the address, and nothing else', () => {
    expect(changesFromPath('/changes')).toEqual({ digestId: null });
    expect(changesFromPath('/changes/')).toEqual({ digestId: null });
    expect(changesFromPath('/changes/2026-10-13')).toEqual({ digestId: '2026-10-13' });
    expect(changesFromPath('/changes/2026-10-13/more')).toBeNull();
    expect(changesFromPath('/changelog')).toBeNull();
    expect(changesFromPath('/changes/%E0')).toBeNull();
    expect(sceneSampleFromPath('/changes/2026-10-13')).toBe('changes');
    expect(routeFromPath('/changes')).toMatchObject({ id: 'home', data: { demoMode: true } });
    expect(routeFromPath('/changes/2026-10-13')).toMatchObject({ id: 'home', data: { demoMode: true } });
  });
});

describe('RISE Changes admission', () => {
  it('admits the index, newest first as written', () => {
    const index = admitChangesIndex(changesIndexFixture());
    expect(index.map(entry => entry.id)).toEqual([CHANGES_ID, '2026-10-12']);
    expect(index[0]).toMatchObject({ audience: 'team', count: 5, title: 'What changed in RISE, 12–13 October' });
  });

  it.each([
    ['another schema', index => { index.schema = 'syberlabs.changes-index/v2'; }],
    ['no digests list', index => { delete index.digests; }],
    ['an id that is not a date', index => { index.digests[0].id = '../secrets'; }],
    ['an unknown audience', index => { index.digests[0].audience = 'everyone'; }],
    ['a count that is not a count', index => { index.digests[0].count = -1; }],
    ['a period that is not a time', index => { index.digests[0].period.to = 'Monday'; }],
    ['more than 200 digests', index => { index.digests = Array(201).fill(index.digests[0]); }]
  ])('refuses an index with %s', (_, mutate) => {
    const index = changesIndexFixture();
    mutate(index);
    expect(() => admitChangesIndex(index)).toThrow();
  });

  it('admits the digest, its Current through the same validator the card uses', () => {
    const digest = admitChangesDigest(changesDigestFixture(), CHANGES_ID);
    expect(digest.current.schema).toBe('rise.current.v2');
    expect(digest.included.map(change => change.number)).toEqual([652, 653, 655, 660, 667]);
    expect(digest.changes).toHaveLength(8);
  });

  it.each([
    ['another schema', digest => { digest.schema = 'syberlabs.changes-digest/v0'; }, /schema must be syberlabs\.changes-digest\/v1/u],
    ['an id other than its address', digest => { digest.id = '2026-10-12'; }, /not the one asked for/u],
    ['an unknown field', digest => { digest.script = 'alert(1)'; }, /A digest has exactly/u],
    ['a pull request link elsewhere', digest => { digest.changes[0].url = 'javascript:alert(1)'; }, /url must be https:\/\/github\.com\/SyberLabs\/RISE\/pull\/652/u],
    ['a pull request link to another number', digest => { digest.changes[0].url = 'https://github.com/SyberLabs/RISE/pull/1'; }, /url must be/u],
    ['a merge sha that is not one', digest => { digest.changes[0].mergeSha = 'main'; }, /mergeSha must be 40 hex/u],
    ['an unknown route', digest => { digest.changes[0].route.kind = 'secret'; }, /route must be one choice/u],
    ['an unknown reason', digest => { digest.changes[0].reason = 'because'; }, /reason must be one of/u],
    ['a title over 200 characters', digest => { digest.changes[0].title = 'x'.repeat(201); }, /title must be 1 to 200/u],
    ['a pull request listed twice', digest => { digest.changes[1].number = 652; digest.changes[1].url = digest.changes[0].url; }, /A pull request is listed twice/u],
    ['more than 60 changes', digest => { digest.changes = Array.from({ length: 61 }, (_, i) => ({ ...digest.changes[2], number: 1000 + i, url: `https://github.com/SyberLabs/RISE/pull/${1000 + i}` })); }, /At most 60 changes are listed/u],
    ['a source beat that does not exist', digest => { digest.sources['9'] = [652]; }, /names beat 9, but the Current has 5 beats/u],
    ['a source that is not included', digest => { digest.sources['0'] = [654]; }, /cites #654, which is not one of the included/u],
    ['an included change no beat cites', digest => { digest.sources['4'] = [653]; }, /No beat cites #652/u],
    ['a Current the validator refuses', digest => { digest.current.beats[0].scene = 'nowhere'; }, /scene/u],
    ['a v1 Current', digest => { digest.current = { schema: 'rise.current.v1', id: 'x', title: 'x', origin: digest.current.origin, segments: [{ id: 'a', text: 'Hello.' }] }; }, /current must be a rise\.current\.v2 Current/u],
    ['a Current written by another model than it names', digest => { digest.current.origin.name = 'gpt-6'; }, /another author/u],
    ['generated scene code the scene admission refuses', digest => { digest.current.scenes.push(REFUSED_SCENE); }, /`fetch` is not available/u],
    ['a figure the SVG admission refuses', digest => { digest.current.scenes.push({ id: 'pic', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>' }); }, /script/u],
    ['a file over 256 KB', digest => { digest.generatedAt = `2026-10-13T09:04:12Z${' '.repeat(262_144)}`; }, /over 256 KB/u]
  ])('refuses a digest with %s', (_, mutate, why) => {
    expect(refused(mutate)).toThrow(why);
  });

  it('admits the generator\'s own sample, digest and index', () => {
    expect(admitChangesIndex(sampleIndex).map(entry => entry.id)).toEqual(['2026-10-14']);
    const digest = admitChangesDigest(sampleDigest, '2026-10-14');
    expect(digest.included).toHaveLength(11);
    expect(digest.changes).toHaveLength(20);
  });

  it('loads a digest only by an id of the contract\'s form', async () => {
    const load = vi.fn(files());
    await expect(loadChangesDigest('../index', load)).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
    expect((await loadChangesDigest(CHANGES_ID, load)).id).toBe(CHANGES_ID);
  });

  it('says a period in words', () => {
    expect(periodWords({ from: '2026-10-12T09:00:00Z', to: '2026-10-19T09:00:00Z' })).toBe('12–19 October 2026');
    expect(periodWords({ from: '2026-09-28T09:00:00Z', to: '2026-10-05T09:00:00Z' })).toBe('28 September – 5 October 2026');
    expect(periodWords({ from: '2025-12-29T09:00:00Z', to: '2026-01-05T09:00:00Z' })).toBe('29 December 2025 – 5 January 2026');
  });
});

describe('RISE Changes pages', () => {
  it('lists the digests, newest first, each with its period, count and audience', async () => {
    const { section, go } = await mount();
    expect(section.querySelector('h1').textContent).toBe('What changed in RISE');
    const rows = [...section.querySelectorAll('.changes-digests li')];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('a').getAttribute('href')).toBe(`/changes/${CHANGES_ID}`);
    expect(rows[0].textContent).toContain('12–13 October 2026');
    expect(rows[0].textContent).toContain('5 changes in the reading');
    expect(rows[0].querySelector('.changes-badge').textContent).toBe('Team');
    rows[0].querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(go).toHaveBeenCalledWith(`/changes/${CHANGES_ID}`);
  });

  it('shows one digest: Play, what changed as links to the pull requests, how each was chosen, and who wrote it', async () => {
    const { section, launch } = await mount({ digestId: CHANGES_ID });
    expect(section.querySelector('h1').textContent).toBe('What changed in RISE, 12–13 October');
    const links = [...section.querySelectorAll('.changes-included a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual([652, 653, 655, 660, 667].map(n => `https://github.com/SyberLabs/RISE/pull/${n}`));
    expect(links[0].textContent).toContain('#652');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    const chosen = section.querySelector('details.changes-chosen');
    expect(chosen.open).toBe(false);
    expect(chosen.querySelectorAll('li')).toHaveLength(8);
    expect(chosen.textContent).toContain('Left out: records only');
    expect(chosen.textContent).toContain('Left out: skipped by the router');
    expect(chosen.textContent).toContain('team · major · feature');
    expect(section.textContent).toContain('Written by claude-sonnet-5-5 via Claude Code from 5 merged pull requests, 12–13 October 2026.');

    section.querySelector('[data-changes-play]').click();
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(1));
    const [sealed] = launch.mock.calls[0];
    expect(sealed.current).toEqual(changesDigestFixture().current);
    expect(sealed.path).toBe(`/changes/${CHANGES_ID}`);
    expect(sealed.who).toBe('Written by claude-sonnet-5-5 via Claude Code from 5 merged pull requests, 12–13 October 2026.');
    expect(sealed.about).toEqual([
      'What changed:',
      '#652 The attractor can be a swarm, and the harmonograph rotary',
      '#653 RISE Live: Sophia holds every visual in one of three frames — the inner eye, the outer shell, the full frame',
      '#655 RISE Live remembers the room: each new question goes up with the earlier questions and what RISE said',
      '#660 RISE Live: a visual the reader names is shown at once, with no model call (LIVE-029)',
      '#667 A visual the reader names in a held Live reading reaches the screen at once, not at the next phrase'
    ]);
  });

  it('says what the run let go, in its notes, under how this was chosen', async () => {
    const note = 'The picture for beat 3 (“The ask bar”) was not drawn: REFUSED after 3 attempts; the beat keeps the scene before it.';
    const digest = { ...changesDigestFixture(), notes: [note, '<b>not markup</b>'] };
    const { section } = await mount({ digestId: CHANGES_ID, load: files(undefined, digest) });
    const notes = [...section.querySelectorAll('details.changes-chosen .changes-notes li')].map(item => item.textContent);
    expect(notes).toEqual([note, '<b>not markup</b>']);
    const plain = await mount({ digestId: CHANGES_ID });
    expect(plain.section.querySelector('.changes-notes')).toBeNull();
  });

  it('says how right the run was the first time under how this was chosen, and shows a published digest without it', async () => {
    const quality = { firstPass: false, repairs: { composition: 0, illustrator: 1 }, checks: { 'text-crosses-shape': 1 } };
    const { section } = await mount({ digestId: CHANGES_ID, load: files(undefined, { ...changesDigestFixture(), quality }) });
    expect(section.querySelector('details.changes-chosen .changes-quality').textContent).toBe('First pass: no — 1 repair (0 composition, 1 illustrator); checks fired: text-crosses-shape (1)');
    const plain = await mount({ digestId: CHANGES_ID });
    expect(plain.section.querySelector('.changes-quality')).toBeNull();
    expect(refused(digest => { digest.quality = { ...quality, checks: { '<b>': 1 } }; })).toThrow(/quality/);
  });

  it('says why each change was left out, in the words of the team digest’s inclusion rule', async () => {
    const digest = changesDigestFixture();
    const base = digest.changes[6];
    const add = (number, route, extra = {}) => digest.changes.push({ ...base, number, url: `https://github.com/SyberLabs/RISE/pull/${number}`, route, included: false, reason: 'routed', ...extra });
    add(801, { audience: 'both', significance: 'minor', kind: 'design' });
    add(802, { audience: 'skip', significance: 'minor', kind: 'fix' });
    add(803, { audience: 'readers', significance: 'minor', kind: 'design' });
    add(804, { audience: 'team', significance: 'notable', kind: 'fix' }, { reason: 'limit' });
    add(805, { audience: 'readers', significance: 'notable', kind: 'fix' }, { reason: 'unspoken' });
    const { section } = await mount({ digestId: CHANGES_ID, load: files(undefined, digest) });
    const words = number => section.querySelector(`.changes-routes a[href$="/${number}"]`).closest('li').querySelector('.changes-meta').textContent.split(' — ')[1];
    expect(words(801)).toBe('Left out: minor');
    expect(words(803)).toBe('Left out: minor');
    expect(words(802)).toBe('Left out: skipped by the router');
    expect(words(654)).toBe('Left out: records only');
    expect(words(804)).toBe('Left out: over the 24-change limit');
    expect(words(805)).toBe('Left out: the reading did not speak of it');
    expect(words(653)).toBe('Included');
    expect(section.textContent).not.toMatch(/routed to (readers|the team) only/);
  });

  it('says when an included change was left out because the reading did not speak of it', async () => {
    const digest = changesDigestFixture();
    digest.changes.push({ ...digest.changes[6], number: 679, url: 'https://github.com/SyberLabs/RISE/pull/679', route: { audience: 'team', significance: 'notable', kind: 'fix' }, included: false, reason: 'unspoken' });
    const { section } = await mount({ digestId: CHANGES_ID, load: files(undefined, digest) });
    const row = section.querySelector('.changes-routes a[href$="/679"]').closest('li');
    expect(row.querySelector('.changes-meta').textContent).toBe('team · notable · fix — Left out: the reading did not speak of it');
  });

  it('writes what the files say as text, never markup', async () => {
    const digest = changesDigestFixture();
    digest.changes[0].title = '<img src=x onerror="window.pwned=1">';
    const index = changesIndexFixture();
    index.digests[0].title = '<b>bold</b>';
    const list = await mount({ load: files(index, digest) });
    expect(list.section.querySelector('b')).toBeNull();
    const detail = await mount({ digestId: CHANGES_ID, load: files(index, digest) });
    expect(detail.section.querySelector('img')).toBeNull();
    expect(detail.section.textContent).toContain('<img src=x onerror="window.pwned=1">');
  });

  it.each([
    ['a malformed digest', () => { const d = changesDigestFixture(); d.sources = { 0: [999] }; return d; }],
    ['refused scene code', () => { const d = changesDigestFixture(); d.current.scenes.push(REFUSED_SCENE); return d; }],
    ['a missing file', () => null]
  ])('refuses %s with one line and no reading', async (_, make) => {
    const digest = make();
    const load = async path => {
      if (path.endsWith('index.json')) return changesIndexFixture();
      if (digest === null) throw new Error(`${path}: 404`);
      return digest;
    };
    const { section, launch } = await mount({ digestId: CHANGES_ID, load });
    expect(section.querySelector('[role="status"]').textContent).toBe('This digest could not be shown.');
    expect(section.querySelector('[data-changes-play]')).toBeNull();
    expect(section.querySelector('a[href="/changes"]')).not.toBeNull();
    expect(launch).not.toHaveBeenCalled();
  });

  it('says so when no digest is published yet, or the list cannot be read', async () => {
    const empty = await mount({ load: files({ schema: 'syberlabs.changes-index/v1', digests: [] }) });
    expect(empty.section.querySelector('[role="status"]').textContent).toBe('No digest has been written yet.');
    const broken = await mount({ load: async () => { throw new Error('500'); } });
    expect(broken.section.querySelector('[role="status"]').textContent).toBe('The list of digests could not be shown.');
  });

  it('reads a missing index (the Worker 404s while the data branch holds no digest) as no digest written yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":"NOT_FOUND"}}', { status: 404, headers: { 'Content-Type': 'application/json' } })));
    try {
      const { section } = await mount({ load: undefined });
      expect(section.querySelector('[role="status"]').textContent).toBe('No digest has been written yet.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
