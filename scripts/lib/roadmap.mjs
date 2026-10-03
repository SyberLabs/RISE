import { execFile as execFileCallback } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const TASK_FIELDS = [
  'id', 'title', 'lane', 'milestone', 'status', 'delivery', 'owner', 'priority',
  'dependencies', 'acceptance', 'evidence', 'activity', 'updatedAt', 'revision',
  'summary', 'blocker',
];
const MUTABLE_FIELDS = new Set([
  'title', 'lane', 'milestone', 'status', 'delivery', 'owner', 'priority',
  'dependencies', 'acceptance', 'evidence', 'summary', 'blocker',
]);
const LANES = new Set(['reader', 'live-sdk', 'shared']);
const STATUSES = new Set(['planned', 'in_progress', 'blocked', 'in_review', 'done']);
const DELIVERIES = new Set(['not_shipped', 'branch', 'merged', 'deployed', 'accepted']);
const PRIORITIES = new Set(['now', 'next', 'later']);
const EVIDENCE_KINDS = new Set(['pr', 'commit', 'test', 'observation', 'document']);
const ASSETS = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(message) {
  throw new Error(message);
}

function requireString(value, label, { nonempty = true } = {}) {
  if (typeof value !== 'string' || (nonempty && !value.trim())) fail(`${label} must be a${nonempty ? ' non-empty' : ''} string`);
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isRepositoryPath(ref) {
  if (typeof ref !== 'string' || !ref || ref.includes(String.fromCharCode(92)) || ref.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(ref)) return false;
  const parts = ref.split('/');
  return parts.every((part) => part && part !== '.' && part !== '..' && !/\s/.test(part));
}

function validateEvidence(item, label) {
  if (!isObject(item)) fail(`${label} must be an object`);
  const keys = Object.keys(item).sort();
  if (keys.join(',') !== 'date,kind,note,ref') fail(`${label} has unsupported or missing fields`);
  if (!EVIDENCE_KINDS.has(item.kind)) fail(`${label}.kind is unsupported`);
  const https = typeof item.ref === 'string' && /^https:\/\//i.test(item.ref);
  if (https) {
    let parsed;
    try { parsed = new URL(item.ref); } catch { fail(`${label}.ref must be an HTTPS URL or repository-relative path`); }
    if (parsed.protocol !== 'https:' || !parsed.hostname) fail(`${label}.ref must be an HTTPS URL or repository-relative path`);
  } else if (!isRepositoryPath(item.ref)) {
    fail(`${label}.ref must be an HTTPS URL or repository-relative path`);
  }
  requireString(item.note, `${label}.note`);
  if (!isIsoDate(item.date)) fail(`${label}.date must be an ISO date or timestamp`);
}

function validateTask(task) {
  if (!isObject(task)) fail('each task must be an object');
  const unknown = Object.keys(task).filter((key) => !TASK_FIELDS.includes(key));
  if (unknown.length) fail(`task has unknown field ${unknown[0]}`);
  const missing = TASK_FIELDS.filter((key) => !Object.hasOwn(task, key));
  if (missing.length) fail(`task is missing field ${missing[0]}`);

  if (typeof task.id !== 'string' || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(task.id)) fail('task.id must be an alphanumeric hyphenated identifier');
  requireString(task.title, `${task.id}.title`);
  if (!LANES.has(task.lane)) fail(`${task.id}.lane is unsupported`);
  requireString(task.milestone, `${task.id}.milestone`);
  if (!STATUSES.has(task.status)) fail(`${task.id}.status is unsupported`);
  if (!DELIVERIES.has(task.delivery)) fail(`${task.id}.delivery is unsupported`);
  if (task.owner !== null) requireString(task.owner, `${task.id}.owner`);
  if (!PRIORITIES.has(task.priority)) fail(`${task.id}.priority is unsupported`);
  if (!Array.isArray(task.dependencies) || task.dependencies.some((id) => typeof id !== 'string' || !id)) fail(`${task.id}.dependencies must be task IDs`);
  if (new Set(task.dependencies).size !== task.dependencies.length) fail(`${task.id}.dependencies must not contain duplicates`);
  if (!Array.isArray(task.acceptance) || task.acceptance.length === 0 || task.acceptance.some((item) => typeof item !== 'string' || !item.trim())) fail(`${task.id}.acceptance must contain non-empty strings`);
  if (!Array.isArray(task.evidence)) fail(`${task.id}.evidence must be an array`);
  task.evidence.forEach((item, index) => validateEvidence(item, `${task.id}.evidence[${index}]`));
  if (!Array.isArray(task.activity)) fail(`${task.id}.activity must be an array`);
  task.activity.forEach((item, index) => {
    if (!isObject(item) || Object.keys(item).sort().join(',') !== 'date,summary') fail(`${task.id}.activity[${index}] must contain date and summary`);
    if (!isIsoDate(item.date)) fail(`${task.id}.activity[${index}].date must be an ISO date or timestamp`);
    requireString(item.summary, `${task.id}.activity[${index}].summary`);
  });
  if (!isIsoDate(task.updatedAt) || !task.updatedAt.includes('T')) fail(`${task.id}.updatedAt must be an ISO timestamp`);
  if (!Number.isInteger(task.revision) || task.revision < 1) fail(`${task.id}.revision must be a positive integer`);
  requireString(task.summary, `${task.id}.summary`, { nonempty: false });
  if (task.blocker !== null) requireString(task.blocker, `${task.id}.blocker`);
  if (task.status === 'blocked' && !task.blocker?.trim()) fail(`${task.id}.blocked status requires a blocker reason`);
  if (task.status === 'done' && (!task.owner || task.evidence.length === 0)) fail(`${task.id}.done requires an owner and evidence`);
  if (task.delivery === 'accepted' && !task.evidence.some((item) => item.kind === 'observation')) fail(`${task.id}.accepted delivery requires observation evidence`);
}

export function validateTasks(tasks) {
  if (!Array.isArray(tasks)) fail('tasks must be an array');
  const byId = new Map();
  for (const task of tasks) {
    validateTask(task);
    if (byId.has(task.id)) fail(`duplicate task ID ${task.id}`);
    byId.set(task.id, task);
  }
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!byId.has(dependency)) fail(`${task.id} has unknown dependency ${dependency}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail(`dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return tasks;
}

export async function loadTasks(root) {
  const directory = path.join(root, 'docs', 'product', 'tasks');
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const tasks = await Promise.all(files.map(async (file) => {
    const task = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    if (`${task.id}.json` !== file) fail(`${file} must match its task ID`);
    return task;
  }));
  return validateTasks(tasks);
}

async function writeAtomically(file, contents) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function updateTask(root, id, patch, { expectedRevision, summary, now = new Date().toISOString() } = {}) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(id)) fail('task ID is invalid');
  if (!isObject(patch)) fail('patch must be an object');
  const unsupported = Object.keys(patch).find((key) => !MUTABLE_FIELDS.has(key));
  if (unsupported) fail(`patch contains unsupported field ${unsupported}`);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) fail('expectedRevision must be a positive integer');
  requireString(summary, 'summary');
  if (!isIsoDate(now) || !now.includes('T')) fail('now must be an ISO timestamp');

  const tasks = await loadTasks(root);
  const current = tasks.find((task) => task.id === id);
  if (!current) fail(`task ${id} was not found`);
  if (current.revision !== expectedRevision) fail(`stale revision for ${id}: expected ${expectedRevision}, found ${current.revision}`);
  const updated = {
    ...current,
    ...patch,
    activity: [...current.activity, { date: now, summary }],
    updatedAt: now,
    revision: current.revision + 1,
  };
  validateTasks(tasks.map((task) => task.id === id ? updated : task));
  const file = path.join(root, 'docs', 'product', 'tasks', `${id}.json`);
  await writeAtomically(file, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}

async function gitSnapshot(root) {
  try {
    const [history, head] = await Promise.all([
      execFile('git', ['log', '-30', '--format=%H%x00%cI%x00%s'], {
        cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, windowsHide: true,
      }),
      execFile('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }),
    ]);
    const recentCommits = history.stdout.split('\n').filter(Boolean).map((line) => {
      const [sha, date, ...subject] = line.split('\0');
      return sha && date ? { sha, date, subject: subject.join('\0') } : null;
    }).filter(Boolean);
    return { recentCommits, sourceRef: head.stdout.trim() };
  } catch (error) {
    throw new Error(`could not read Git snapshot metadata: ${error.message}`);
  }
}

export async function trackerSnapshot(root) {
  const [tasks, git] = await Promise.all([loadTasks(root), gitSnapshot(root)]);
  return { tasks, ...git, generatedAt: new Date().toISOString() };
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function createTrackerServer(root) {
  const absoluteRoot = path.resolve(root);
  return createHttpServer(async (request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { allow: 'GET', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/api/tracker') {
      try { sendJson(response, 200, await trackerSnapshot(absoluteRoot)); }
      catch (error) { sendJson(response, 500, { error: error.message }); }
      return;
    }
    const asset = ASSETS.get(pathname);
    if (!asset) { response.writeHead(404).end('Not found'); return; }
    try {
      const contents = await readFile(path.join(absoluteRoot, 'tools', 'roadmap', asset[0]));
      response.writeHead(200, { 'content-type': asset[1], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(contents);
    } catch { response.writeHead(404).end('Not found'); }
  });
}

export async function serveTracker(root, port = 4173) {
  const server = createTrackerServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

function markStaticHtml(html) {
  if (/<html\b[^>]*\bdata-tracker-mode=/i.test(html)) {
    return html.replace(/(<html\b[^>]*\bdata-tracker-mode=)["'][^"']*["']/i, '$1"static"');
  }
  if (!/<html\b[^>]*>/i.test(html)) fail('dashboard index.html must contain an <html> element');
  return html.replace(/<html\b([^>]*)>/i, '<html$1 data-tracker-mode="static">');
}

export async function buildTracker(root, out = path.join(root, '.roadmap-dashboard')) {
  const absoluteRoot = path.resolve(root);
  const absoluteOut = path.resolve(out);
  const payload = await trackerSnapshot(absoluteRoot);
  const source = path.join(absoluteRoot, 'tools', 'roadmap');
  await mkdir(absoluteOut, { recursive: true });
  const html = await readFile(path.join(source, 'index.html'), 'utf8');
  await writeFile(path.join(absoluteOut, 'index.html'), markStaticHtml(html));
  for (const name of ['dashboard.js', 'styles.css']) {
    await writeFile(path.join(absoluteOut, name), await readFile(path.join(source, name)));
  }
  await writeFile(path.join(absoluteOut, 'snapshot.json'), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}
