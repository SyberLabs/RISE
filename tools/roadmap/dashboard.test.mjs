import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import * as dashboard from './dashboard.js';

const { filterTasks, mapRecentCommits, renderDashboard, safeReferenceUrl, startDashboard } = dashboard;

const tasks = [
  {
    id: 'reader-shell', title: 'Reader shell', lane: 'reader', milestone: 'Reader 1',
    status: 'done', delivery: 'merged', owner: 'Mateo', priority: 'now',
    dependencies: [], acceptance: ['Opens the reader'],
    evidence: [{ kind: 'commit', ref: 'abcdef1234567890', note: 'Smoke checked', date: '2026-10-01' }],
    activity: [{ date: '2026-10-01', summary: 'Completed reader shell' }],
    updatedAt: '2026-10-01T12:00:00Z', revision: 2, summary: 'Ready to review', blocker: null,
  },
  {
    id: 'live-api', title: 'Live API', lane: 'live-sdk', milestone: 'Live 1',
    status: 'blocked', delivery: 'not_shipped', owner: null, priority: 'next',
    dependencies: ['reader-shell'], acceptance: ['Connects to a session'],
    evidence: [{ kind: 'document', ref: '../outside.txt', note: 'bad path', date: '2026-10-02' }],
    activity: [], updatedAt: '2026-10-02T12:00:00Z', revision: 1,
    summary: '<img src=x onerror=alert(1)>', blocker: 'Needs a decision',
  },
];

test('filters tasks by lane, status and case-insensitive search', () => {
  assert.deepEqual(filterTasks(tasks, { lane: 'reader' }).map((task) => task.id), ['reader-shell']);
  assert.deepEqual(filterTasks(tasks, { status: 'blocked', query: 'LIVE API' }).map((task) => task.id), ['live-api']);
  assert.deepEqual(filterTasks(tasks, { query: 'missing' }), []);
});

test('maps recent commits only through task commit or pull request evidence', () => {
  const result = mapRecentCommits([
    { sha: 'abcdef1234567890', date: '2026-10-03', subject: 'Reader work' },
    { sha: '1234567890abcdef', date: '2026-10-03', subject: 'Reader change (#42)' },
    { sha: '2234567890abcdef', date: '2026-10-03', subject: 'Merge pull request #42 from SyberLabs/branch' },
    { sha: '9999999999999999', date: '2026-10-03', subject: 'Unmapped' },
  ], [
    tasks[0],
    { ...tasks[1], evidence: [{ kind: 'pr', ref: 'https://github.com/SyberLabs/RISE/pull/42', note: 'Review', date: '2026-10-02' }] },
  ]);

  assert.deepEqual(result.map(({ commit, taskIds }) => [commit.sha, taskIds]), [
    ['abcdef1234567890', ['reader-shell']],
    ['1234567890abcdef', ['live-api']],
    ['2234567890abcdef', ['live-api']],
    ['9999999999999999', []],
  ]);
});

test('allows HTTPS and safe repository paths, rejecting active or escaping URLs', () => {
  assert.equal(safeReferenceUrl('https://github.com/SyberLabs/RISE/pull/42'), 'https://github.com/SyberLabs/RISE/pull/42');
  assert.equal(safeReferenceUrl('docs/product/README.md'), 'https://github.com/SyberLabs/RISE/blob/codex/roadmap-tracker/docs/product/README.md');
  assert.equal(safeReferenceUrl('docs/product/README.md', 'abcdef0123456789'), 'https://github.com/SyberLabs/RISE/blob/abcdef0123456789/docs/product/README.md');
  assert.equal(safeReferenceUrl('../secrets.txt'), null);
  assert.equal(safeReferenceUrl('javascript:alert(1)'), null);
});

test('renders task text safely and labels commits without a matching task', () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <main id="lanes"></main><section id="readiness"></section>
    <section id="activity"></section><section id="commits"></section>
    <span id="snapshot-time"></span><span id="connection-state"></span>
    <span id="mode-badge"></span><p id="error-message" hidden></p>
  </body></html>`);
  const data = {
    tasks,
    recentCommits: [
      { sha: 'abcdef1234567890', date: '2026-10-03', subject: '<script>bad()</script>' },
      { sha: '9999999999999999', date: '2026-10-03', subject: 'Unmapped change' },
    ],
    generatedAt: '2026-10-03T12:00:00Z',
    sourceRef: '11223344556677889900aabbccddeeff00112233',
  };

  renderDashboard(dom.window.document, data, { filters: {}, mode: 'api', loadedAt: data.generatedAt });

  assert.equal(dom.window.document.querySelector('#lanes script'), null);
  assert.match(dom.window.document.querySelector('#lanes').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(dom.window.document.querySelectorAll('#lanes .evidence-row a').length, 1);
  assert.equal(dom.window.document.querySelector('#lanes .evidence-row a').getAttribute('href'), 'https://github.com/SyberLabs/RISE/blob/11223344556677889900aabbccddeeff00112233/abcdef1234567890');
  assert.equal(dom.window.document.querySelectorAll('#commits [data-unmapped="true"]').length, 1);
  assert.equal(dom.window.document.querySelector('#commits a').getAttribute('href'), 'https://github.com/SyberLabs/RISE/commit/abcdef1234567890');
  assert.equal(dom.window.document.querySelector('#snapshot-time').textContent, 'Oct 3, 2026, 12:00 PM UTC');
  assert.match(dom.window.document.querySelector('#readiness').textContent, /Ready now · 0/);
  assert.match(dom.window.document.querySelector('#readiness').textContent, /Next \/ later · 1/);

  renderDashboard(dom.window.document, data, { filters: {}, mode: 'static', loadedAt: data.generatedAt, error: 'offline', stale: true });
  assert.equal(dom.window.document.querySelector('#mode-badge').textContent, 'Static snapshot');
  assert.match(dom.window.document.querySelector('#connection-state').textContent, /Refresh failed/);
  assert.equal(dom.window.document.querySelector('#error-message').hidden, false);
});

test('orders active milestones by priority and puts completed milestones last', () => {
  const milestoneTasks = [
    { ...tasks[1], id: 'sdk-horizon', title: 'SDK horizon', milestone: 'R02 conditional', lane: 'live-sdk', status: 'planned', priority: 'later', dependencies: [], evidence: [], blocker: null },
    { ...tasks[1], id: 'sdk-now', title: 'SDK work', milestone: 'M1', lane: 'live-sdk', status: 'planned', priority: 'now', dependencies: [], evidence: [], blocker: null },
    { ...tasks[1], id: 'sdk-done', title: 'Finished SDK', milestone: 'M0', lane: 'live-sdk', status: 'done', priority: 'now', dependencies: [], evidence: [], blocker: null },
  ];
  const dom = new JSDOM('<section id="lanes"></section><section id="readiness"></section><section id="activity"></section><section id="commits"></section>');

  renderDashboard(dom.window.document, { tasks: milestoneTasks }, { filters: {} });

  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.lane-column:nth-child(2) .milestone-title')].map((heading) => heading.textContent),
    ['M1', 'R02 conditional', 'M0'],
  );
});

test('keeps dependency, acceptance and evidence content in a collapsed disclosure', () => {
  const dom = new JSDOM('<section id="lanes"></section><section id="readiness"></section><section id="activity"></section><section id="commits"></section>');

  renderDashboard(dom.window.document, { tasks: [tasks[0]] }, { filters: {} });

  const disclosure = dom.window.document.querySelector('#lanes .task-card details');
  assert.ok(disclosure);
  assert.equal(disclosure.open, false);
  assert.equal(disclosure.querySelector('summary').textContent, 'Dependencies, acceptance & evidence');
  assert.match(disclosure.textContent, /Opens the reader/);
  assert.match(disclosure.textContent, /Smoke checked/);
});

test('shows a short recent-work preview and keeps every older record expandable', () => {
  const activity = Array.from({ length: 8 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, summary: `Update ${index + 1}` }));
  const commits = Array.from({ length: 8 }, (_, index) => ({ sha: `${String(index + 10).repeat(16)}`.slice(0, 16), date: '2026-10-03', subject: `Commit ${index + 1}` }));
  const dom = new JSDOM('<section id="lanes"></section><section id="readiness"></section><section id="activity"></section><section id="commits"></section>');

  renderDashboard(dom.window.document, { tasks: [{ ...tasks[0], activity }], recentCommits: commits }, { filters: {} });

  assert.equal(dom.window.document.querySelectorAll('#activity > .activity-row').length, 5);
  assert.equal(dom.window.document.querySelectorAll('#activity .activity-row').length, 8);
  assert.match(dom.window.document.querySelector('#activity details summary').textContent, /Show 3 older updates/);
  assert.equal(dom.window.document.querySelectorAll('#commits > .commit-row').length, 5);
  assert.equal(dom.window.document.querySelectorAll('#commits .commit-row').length, 8);
  assert.match(dom.window.document.querySelector('#commits details summary').textContent, /Show 3 older commits/);
});

test('counts one blocked task once when its dependency is unfinished', () => {
  const foundation = { ...tasks[0], id: 'foundation', title: 'Foundation', status: 'planned', delivery: 'not_shipped', dependencies: [], activity: [], evidence: [] };
  const blocked = { ...tasks[1], id: 'blocked-child', title: 'Blocked child', status: 'blocked', dependencies: ['foundation'], activity: [], evidence: [] };
  const dom = new JSDOM('<section id="lanes"></section><section id="readiness"></section><section id="activity"></section><section id="commits"></section>');

  renderDashboard(dom.window.document, { tasks: [foundation, blocked] }, { filters: {} });

  assert.match(dom.window.document.querySelector('#readiness').textContent, /Blocked or waiting · 1/);
});

test('places recent activity and commits before the roadmap lane cards', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const document = new JSDOM(html).window.document;

  assert.ok(document.querySelector('.lower-grid').compareDocumentPosition(document.querySelector('#lanes')) & 4);
});

test('the newest overlapping refresh wins when an older request finishes later', async () => {
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:4317/' });
  const requests = [];
  const fetcher = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));

  try {
    const dashboard = startDashboard(dom.window.document, fetcher, () => 1);
    assert.equal(requests.length, 1);
    const olderRequest = requests[0];
    const newerRefresh = dashboard.refresh();
    assert.equal(requests.length, 2);
    requests[1].resolve({ ok: true, json: async () => ({ tasks: [], recentCommits: [], generatedAt: '2026-10-03T12:02:00Z' }) });
    await newerRefresh;
    olderRequest.resolve({ ok: true, json: async () => ({ tasks: [], recentCommits: [], generatedAt: '2026-10-03T12:01:00Z' }) });
    await dashboard.initialLoad;
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(dom.window.document.querySelector('#snapshot-time').textContent, 'Oct 3, 2026, 12:02 PM UTC');
    assert.equal(dom.window.document.querySelector('#connection-state').textContent, 'Up to date');

    const olderFailure = dashboard.refresh();
    const oldErrorRequest = requests[2];
    const latestSuccess = dashboard.refresh();
    requests[3].resolve({ ok: true, json: async () => ({ tasks: [], recentCommits: [], generatedAt: '2026-10-03T12:03:00Z' }) });
    await latestSuccess;
    oldErrorRequest.reject(new Error('late network failure'));
    await olderFailure;
    assert.equal(dom.window.document.querySelector('#snapshot-time').textContent, 'Oct 3, 2026, 12:03 PM UTC');
    assert.equal(dom.window.document.querySelector('#connection-state').textContent, 'Up to date');
    assert.equal(dom.window.document.querySelector('#error-message').hidden, true);
  } finally {
    dom.window.close();
  }
});

test('polls the API every 15 seconds but never schedules polling for static snapshots', async () => {
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:4317/' });
  const delays = [];
  const urls = [];
  const fetcher = (url) => {
    urls.push(String(url));
    return Promise.resolve({ ok: true, json: async () => ({ tasks: [], recentCommits: [] }) });
  };
  const schedule = (_callback, delay) => {
    delays.push(delay);
    return 1;
  };

  try {
    const apiDashboard = startDashboard(dom.window.document, fetcher, schedule);
    assert.deepEqual(delays, [15_000]);
    assert.deepEqual(urls, ['http://127.0.0.1:4317/api/tracker']);
    await apiDashboard.initialLoad;

    delays.length = 0;
    urls.length = 0;
    dom.window.document.documentElement.dataset.trackerMode = 'static';
    const staticDashboard = startDashboard(dom.window.document, fetcher, schedule);
    assert.deepEqual(delays, []);
    assert.deepEqual(urls, ['http://127.0.0.1:4317/snapshot.json']);
    await staticDashboard.initialLoad;
  } finally {
    dom.window.close();
  }
});

test('preserves open task and history disclosures across successful and failed refreshes', async () => {
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:4317/' });
  const requests = [];
  const fetcher = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  let scheduledRefresh;
  const schedule = (callback, delay) => {
    assert.equal(delay, 15_000);
    scheduledRefresh = callback;
    return 1;
  };
  const activity = Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, summary: `Update ${index + 1}` }));
  const commits = Array.from({ length: 7 }, (_, index) => ({ sha: `${String(index + 10).repeat(16)}`.slice(0, 16), date: '2026-10-03', subject: `Commit ${index + 1}` }));
  const data = { tasks: [{ ...tasks[0], activity }], recentCommits: commits, generatedAt: '2026-10-03T12:00:00Z' };

  try {
    const dashboard = startDashboard(dom.window.document, fetcher, schedule);
    requests[0].resolve({ ok: true, json: async () => data });
    await dashboard.initialLoad;

    const taskDisclosure = dom.window.document.querySelector('#lanes .task-details');
    const activityDisclosure = dom.window.document.querySelector('#activity .history-more');
    const commitDisclosure = dom.window.document.querySelector('#commits .history-more');
    taskDisclosure.open = true;
    activityDisclosure.open = true;
    commitDisclosure.open = true;

    const successfulRefresh = scheduledRefresh();
    requests[1].resolve({ ok: true, json: async () => ({ ...data, generatedAt: '2026-10-03T12:01:00Z' }) });
    await successfulRefresh;

    assert.equal(dom.window.document.querySelector('#lanes .task-details').open, true);
    assert.equal(dom.window.document.querySelector('#activity .history-more').open, true);
    assert.equal(dom.window.document.querySelector('#commits .history-more').open, true);

    const failedRefresh = scheduledRefresh();
    requests[2].reject(new Error('network unavailable'));
    await failedRefresh;

    assert.equal(dom.window.document.querySelector('#lanes .task-details').open, true);
    assert.equal(dom.window.document.querySelector('#activity .history-more').open, true);
    assert.equal(dom.window.document.querySelector('#commits .history-more').open, true);
    assert.match(dom.window.document.querySelector('#connection-state').textContent, /Refresh failed/);
  } finally {
    dom.window.close();
  }
});
