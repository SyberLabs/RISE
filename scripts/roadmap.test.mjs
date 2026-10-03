import assert from 'node:assert/strict';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createTrackerServer, loadTasks, updateTask, validateTasks } from './lib/roadmap.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const execFile = promisify(execFileCallback);

function task(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    lane: 'reader',
    milestone: 'M1',
    status: 'planned',
    delivery: 'not_shipped',
    owner: null,
    priority: 'next',
    dependencies: [],
    acceptance: ['A reviewed result exists'],
    evidence: [],
    activity: [],
    updatedAt: '2026-10-03T00:00:00.000Z',
    revision: 1,
    summary: 'Not started',
    blocker: null,
    ...overrides,
  };
}

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rise-roadmap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs/product/tasks'), { recursive: true });
  await mkdir(path.join(root, 'tools/roadmap'), { recursive: true });
  await execFile('git', ['init', '-q'], { cwd: root });
  await execFile('git', ['config', 'user.name', 'Roadmap Test'], { cwd: root });
  await execFile('git', ['config', 'user.email', 'roadmap@example.invalid'], { cwd: root });
  await writeFile(path.join(root, 'README.md'), 'temporary tracker fixture');
  await execFile('git', ['add', 'README.md'], { cwd: root });
  await execFile('git', ['commit', '-m', 'Create tracker fixture'], { cwd: root });
  return root;
}

async function writeTasks(root, tasks) {
  for (const item of tasks) {
    await writeFile(path.join(root, 'docs/product/tasks', `${item.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  }
}

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [path.join(repoRoot, 'scripts/roadmap.mjs'), ...args], {
      cwd: options.cwd ?? repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('task IDs accept repository issue-style uppercase identifiers', () => {
  assert.equal(validateTasks([task('FND-001')])[0].id, 'FND-001');
});

test('unknown dependencies fail whole-graph validation', () => {
  assert.throws(() => validateTasks([task('alpha', { dependencies: ['missing'] })]), /unknown dependency.*missing/i);
});

test('dependency cycles fail whole-graph validation', () => {
  assert.throws(() => validateTasks([
    task('alpha', { dependencies: ['beta'] }),
    task('beta', { dependencies: ['alpha'] }),
  ]), /cycle/i);
});

test('done tasks require an owner and evidence, and accepted delivery requires observation evidence', () => {
  assert.throws(() => validateTasks([task('alpha', { status: 'done' })]), /owner/i);
  assert.throws(() => validateTasks([task('alpha', {
    delivery: 'accepted',
    owner: 'Mateo',
    evidence: [{ kind: 'test', ref: 'scripts/check.mjs', note: 'passed', date: '2026-10-03' }],
  })]), /observation/i);
});

test('task records reject unsupported keys and malformed evidence references', () => {
  assert.throws(() => validateTasks([task('alpha', { extra: true })]), /unknown field.*extra/i);
  assert.throws(() => validateTasks([task('alpha', {
    evidence: [{ kind: 'commit', ref: 'git push --force', note: 'done', date: '2026-10-03' }],
  })]), /repository-relative path/i);
});

test('update refuses stale revisions without changing the task file', async (t) => {
  const root = await temporaryRoot(t);
  const original = task('alpha', { revision: 2 });
  await writeTasks(root, [original]);
  const file = path.join(root, 'docs/product/tasks/alpha.json');
  const before = await readFile(file, 'utf8');
  await assert.rejects(updateTask(root, 'alpha', { status: 'in_progress' }, {
    expectedRevision: 1,
    summary: 'Started',
    now: '2026-10-03T12:00:00.000Z',
  }), /revision/i);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('invalid updates preserve the persisted task byte for byte', async (t) => {
  const root = await temporaryRoot(t);
  await writeTasks(root, [task('alpha')]);
  const file = path.join(root, 'docs/product/tasks/alpha.json');
  const before = await readFile(file, 'utf8');
  await assert.rejects(updateTask(root, 'alpha', { status: 'done' }, {
    expectedRevision: 1,
    summary: 'Done',
    now: '2026-10-03T12:00:00.000Z',
  }), /owner/i);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('valid updates increment revision and append dated activity', async (t) => {
  const root = await temporaryRoot(t);
  await writeTasks(root, [task('alpha')]);
  const updated = await updateTask(root, 'alpha', { status: 'in_progress', owner: 'Mateo' }, {
    expectedRevision: 1,
    summary: 'Implementation started',
    now: '2026-10-03T12:00:00.000Z',
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.updatedAt, '2026-10-03T12:00:00.000Z');
  assert.deepEqual(updated.activity, [{ date: '2026-10-03T12:00:00.000Z', summary: 'Implementation started' }]);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'docs/product/tasks/alpha.json'), 'utf8')), updated);
});

test('validate CLI validates the repository task graph and rejects an invalid patch', async (t) => {
  const root = await temporaryRoot(t);
  await writeTasks(root, [task('alpha')]);
  const valid = await runCli(['validate'], { cwd: root });
  assert.equal(valid.code, 0, valid.stderr);
  const patch = path.join(root, 'patch.json');
  await writeFile(patch, JSON.stringify({ owner: 'Mateo', madeUp: true }));
  const invalid = await runCli(['update', 'alpha', '--patch', patch, '--expect-revision', '1', '--summary', 'bad'], { cwd: root });
  assert.notEqual(invalid.code, 0);
});

test('serve exposes tracker data, rejects writes and path traversal, and only serves dashboard assets', async (t) => {
  const root = await temporaryRoot(t);
  await writeTasks(root, [task('alpha')]);
  await writeFile(path.join(root, 'tools/roadmap/index.html'), '<!doctype html><html><body><main>tracker</main></body></html>');
  await writeFile(path.join(root, 'tools/roadmap/dashboard.js'), 'document.body.dataset.ready = "yes";');
  await writeFile(path.join(root, 'outside.txt'), 'private');
  const server = createTrackerServer(root);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const payload = await (await fetch(`${base}/api/tracker`)).json();
  assert.deepEqual(Object.keys(payload).sort(), ['generatedAt', 'recentCommits', 'sourceRef', 'tasks']);
  assert.equal(payload.tasks[0].id, 'alpha');
  assert.ok(Array.isArray(payload.recentCommits));
  assert.equal((await fetch(base)).status, 200);
  assert.equal(await (await fetch(base)).text(), '<!doctype html><html><body><main>tracker</main></body></html>');
  assert.equal((await fetch(`${base}/api/tracker`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/api/tracker`, { method: 'HEAD' })).status, 405);
  assert.notEqual((await fetch(`${base}/outside.txt`)).status, 200);
  assert.notEqual((await fetch(`${base}/%2e%2e/outside.txt`)).status, 200);
  assert.notEqual((await fetch(`${base}/dashboard.js.map`)).status, 200);
});

test('build writes dashboard assets and a static snapshot with the server API shape', async (t) => {
  const root = await temporaryRoot(t);
  await writeTasks(root, [task('alpha')]);
  await writeFile(path.join(root, 'tools/roadmap/index.html'), '<!doctype html><html><body><main>tracker</main></body></html>');
  await writeFile(path.join(root, 'tools/roadmap/dashboard.js'), 'const ready = true;');
  await writeFile(path.join(root, 'tools/roadmap/styles.css'), 'main { color: black; }');
  const out = path.join(root, 'public-dashboard');
  const built = await runCli(['build', '--out', out], { cwd: root });
  assert.equal(built.code, 0, built.stderr);
  const html = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /data-tracker-mode="static"/);
  assert.equal(await readFile(path.join(out, 'dashboard.js'), 'utf8'), 'const ready = true;');
  assert.equal(await readFile(path.join(out, 'styles.css'), 'utf8'), 'main { color: black; }');
  const snapshot = JSON.parse(await readFile(path.join(out, 'snapshot.json'), 'utf8'));
  assert.deepEqual(Object.keys(snapshot).sort(), ['generatedAt', 'recentCommits', 'sourceRef', 'tasks']);
  assert.equal(snapshot.tasks[0].id, 'alpha');
});
