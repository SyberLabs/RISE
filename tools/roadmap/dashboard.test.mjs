import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  filterTasks,
  mapRecentCommits,
  renderDashboard,
  safeReferenceUrl,
} from './dashboard.js';

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
    { sha: '1234567890abcdef', date: '2026-10-03', subject: 'Close #42' },
    { sha: '9999999999999999', date: '2026-10-03', subject: 'Unmapped' },
  ], [
    tasks[0],
    { ...tasks[1], evidence: [{ kind: 'pr', ref: 'https://github.com/SyberLabs/RISE/pull/42', note: 'Review', date: '2026-10-02' }] },
  ]);

  assert.deepEqual(result.map(({ commit, taskIds }) => [commit.sha, taskIds]), [
    ['abcdef1234567890', ['reader-shell']],
    ['1234567890abcdef', ['live-api']],
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
