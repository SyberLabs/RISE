#!/usr/bin/env node
/**
 * Run RISE and Kev on this computer: `npm run local`.
 *
 * 1. Checks the GPU and memory (never falls back to CPU or a smaller model).
 * 2. Installs pinned Kev once into an isolated environment in .rise-local/
 *    (ignored by git); the system Python is used only to create it.
 * 3. Starts the local bridge on 127.0.0.1 and opens RISE. Reading works at once.
 * 4. Rechecks free memory, then starts pinned Kev on another loopback port with
 *    a per-run key. The page shows installing / downloading / loading / ready.
 * 5. Ctrl+C stops both. Nothing else on the computer is touched.
 *
 * Flags: --port N (default 5780), --no-open, --check (hardware report only),
 * --python PATH (the Python 3.12 or 3.13 to create the environment from),
 * --self-test (once Kev is ready, prove identity, authentication, and the
 * bridge's origin checks, then keep running).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBridge } from './bridge.mjs';
import { seedCatalog } from './catalog.mjs';
import { REQUIREMENTS, detectHardware, readiness } from './hardware.mjs';

export const KEV_CODE_REVISION = '9c41005b2180347c3c646dfc9e50c4428483ec6b';
export const KEV_REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
export const KEV_PACKAGE = `kev[serve] @ https://github.com/jaredpalmer/kev/archive/${KEV_CODE_REVISION}.zip`;
// torch 2.8 cu128 wheels run on Blackwell (RTX 50-series, sm_120); kev pins torch <2.9.
export const CUDA_TORCH = ['torch==2.8.0', '--index-url', 'https://download.pytorch.org/whl/cu128'];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = join(ROOT, '.rise-local');
const VENV = join(HOME, 'venv');
const IS_WINDOWS = process.platform === 'win32';
const VENV_PYTHON = IS_WINDOWS ? join(VENV, 'Scripts', 'python.exe') : join(VENV, 'bin', 'python');

function arg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? fallback : process.argv[index + 1];
}

function say(message) {
  process.stdout.write(`[RISE local] ${message}\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))));
  });
}

function capture(command, args) {
  return new Promise(resolve => {
    const child = spawn(command, args, { windowsHide: true });
    let out = '';
    child.stdout?.on('data', chunk => { out += chunk; });
    child.on('error', () => resolve(null));
    child.on('exit', code => resolve(code === 0 ? out.trim() : null));
  });
}

async function findPython() {
  const explicit = arg('--python');
  const candidates = explicit ? [[explicit, []]]
    : IS_WINDOWS ? [['py', ['-3.13']], ['py', ['-3.12']], ['python', []]]
      : [['python3.13', []], ['python3.12', []], ['python3', []]];
  for (const [command, prefix] of candidates) {
    const version = await capture(command, [...prefix, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])']);
    if (version === '3.12' || version === '3.13') return { command, prefix, version };
  }
  return null;
}

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function openBrowser(url) {
  const [command, args] = IS_WINDOWS ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}

async function ensureBuild() {
  if (existsSync(join(ROOT, 'dist', 'index.html'))) return;
  say('Building RISE once (npm run build)…');
  await run(IS_WINDOWS ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: ROOT, shell: IS_WINDOWS });
}

async function ensureKev(status, gpuKind) {
  const marker = join(VENV, 'rise-install.json');
  const wanted = JSON.stringify({ kev: KEV_CODE_REVISION, gpu: gpuKind, torch: gpuKind === 'nvidia' ? CUDA_TORCH[0] : 'pypi' });
  if (existsSync(VENV_PYTHON) && existsSync(marker) && await readFile(marker, 'utf8') === wanted) return;
  status.set('installing', 'Creating the isolated Kev environment in .rise-local (first run only).');
  const python = await findPython();
  if (!python) throw new Error('Python 3.12 or 3.13 is required to install Kev. Install it, or pass --python PATH.');
  if (!existsSync(VENV_PYTHON)) await run(python.command, [...python.prefix, '-m', 'venv', VENV]);
  const pip = [VENV_PYTHON, '-m', 'pip', 'install', '--disable-pip-version-check'];
  if (gpuKind === 'nvidia') {
    status.set('installing', 'Installing PyTorch for CUDA 12.8 into the isolated environment (about 3 GB).');
    await run(pip[0], [...pip.slice(1), ...CUDA_TORCH]);
  }
  status.set('installing', `Installing Kev at ${KEV_CODE_REVISION.slice(0, 12)}.`);
  await run(pip[0], [...pip.slice(1), KEV_PACKAGE]);
  await writeFile(marker, wanted);
}

/** Shared state the bridge reports to the page. */
function createStatus() {
  const value = { state: 'checking', revision: KEV_REVISION, device: null, message: null };
  return {
    get: () => ({ ...value }),
    set(state, message = null, device = value.device) {
      Object.assign(value, { state, message, device });
      say(`Kev ${state}${message ? `: ${message}` : ''}`);
    }
  };
}

/** Kev says ready before its server has bound the port; wait until it answers. */
async function reachable(port, fetchImpl = fetch, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fetchImpl(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

function startKev({ status, port, token, offline, gpu }) {
  const env = {
    ...process.env,
    KEV_API_KEY: token,
    // Load on the GPU the readiness check measured, and recheck there before loading.
    ...(gpu.kind === 'nvidia' ? { CUDA_VISIBLE_DEVICES: String(gpu.index) } : {}),
    RISE_KEV_MIN_RAM_MIB: String(gpu.kind === 'apple' ? REQUIREMENTS.appleFreeMiB : REQUIREMENTS.loadFreeRamMiB),
    RISE_KEV_MIN_VRAM_MIB: String(gpu.kind === 'nvidia' ? REQUIREMENTS.nvidiaFreeVramMiB : 0),
    HF_HOME: join(HOME, 'hf'),
    HF_HUB_DISABLE_TELEMETRY: '1',
    HF_HUB_DISABLE_PROGRESS_BARS: '1',
    TOKENIZERS_PARALLELISM: 'false',
    PYTHONUNBUFFERED: '1',
    ...(offline ? { HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' } : {})
  };
  const child = spawn(VENV_PYTHON, [join(ROOT, 'local', 'kev_server.py'), '--host', '127.0.0.1', '--port', String(port)],
    { env, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  let buffer = '';
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      const match = /^RISE_KEV_STATE (\w+) ?(.*)$/u.exec(line);
      if (!match) { if (line) process.stdout.write(`[Kev] ${line}\n`); continue; }
      const [, state, message] = match;
      if (state === 'ready') {
        status.set('loading', 'Starting Kev’s local server.');
        void reachable(port).then(ok => (ok ? status.set('ready', null, message || null)
          : status.set('error', 'Kev loaded but its local server did not answer.')));
      } else status.set(state, message || null);
    }
  });
  return child;
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  // Only the process tree this launcher started.
  if (IS_WINDOWS) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else {
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000).unref();
  }
}

/** Checks run against the live local services once Kev reports ready. */
export async function selfTest({ port, kevPort, token, fetchImpl = fetch }) {
  const kev = `http://127.0.0.1:${kevPort}`;
  const bridge = `http://127.0.0.1:${port}`;
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); say(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
  const bare = await fetchImpl(`${kev}/v1/models`);
  check('Kev refuses a request without the per-run key', bare.status === 401, `HTTP ${bare.status}`);
  const wrong = await fetchImpl(`${kev}/v1/models`, { headers: { Authorization: 'Bearer wrong-key' } });
  check('Kev refuses a wrong key', wrong.status === 401, `HTTP ${wrong.status}`);
  const models = await fetchImpl(`${kev}/v1/models`, { headers: { Authorization: `Bearer ${token}` } });
  const card = models.ok ? (await models.json()).models?.find(entry => entry.name === 'kev-latest') : null;
  check('Kev reports the pinned checkpoint and base', card?.run === `jaredpalmer/kev-4b@${KEV_REVISION}`
    && card?.base === 'Qwen/Qwen3.5-4B-Base', card ? `${card.run} on ${card.base}, ${card.device}/${card.backend}/${card.dtype}` : `HTTP ${models.status}`);
  check('Kev attests the pinned revision', models.headers.get('x-kev-revision') === KEV_REVISION);
  const body = JSON.stringify({ model: 'kev-latest', state: { reader_intent: 'A very slow, quiet reading.' },
    questions: { pace: { type: 'choice', instructions: 'Choose the reading speed.', criteria: { '100': 'Very slow.', '500': 'Fastest.' } } } });
  const started = performance.now();
  const answer = await fetchImpl(`${bridge}/api/local/kev/systemone`, { method: 'POST', body,
    headers: { Origin: bridge, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' } });
  const answered = answer.ok ? await answer.json() : null;
  check('the bridge returns an attested Kev choice', answer.headers.get('x-kev-revision') === KEV_REVISION
    && ['100', '500'].includes(answered?.answers?.pace?.choice),
  `choice ${answered?.answers?.pace?.choice ?? 'none'} in ${Math.round(performance.now() - started)} ms`);
  const foreign = await fetchImpl(`${bridge}/api/local/kev/systemone`, { method: 'POST', body,
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' } });
  check('the bridge refuses another website', foreign.status === 403, `HTTP ${foreign.status}`);
  return results;
}

async function main() {
  const hardware = await detectHardware();
  const verdict = readiness(hardware);
  say(`${hardware.platform}/${hardware.arch}; GPU: ${hardware.gpu ? `${hardware.gpu.name} (${hardware.gpu.memoryFreeMiB} of ${hardware.gpu.memoryTotalMiB} MiB free)` : 'none supported'}; RAM free ${hardware.ram.freeMiB} of ${hardware.ram.totalMiB} MiB.`);
  say(verdict.message);
  if (process.argv.includes('--check')) {
    process.exitCode = verdict.ok ? 0 : 1;
    return;
  }

  await mkdir(HOME, { recursive: true });
  await ensureBuild();
  const status = createStatus();
  const port = Number(arg('--port', 5780));
  const kevPort = await freePort();
  const token = randomBytes(32).toString('base64url');
  const catalog = seedCatalog();
  const bridge = await createBridge({ distDir: join(ROOT, 'dist'), port, catalog: () => catalog,
    kev: { port: kevPort, token, status: () => status.get() } });
  const url = `http://127.0.0.1:${port}/`;
  say(`RISE is running at ${url} (this computer only). Press Ctrl+C to stop.`);
  if (!process.argv.includes('--no-open')) openBrowser(url);

  let child = null;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    status.set('stopped');
    stopChild(child);
    bridge.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 6000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  if (!hardware.gpu) {
    status.set('error', verdict.message);
    return;
  }
  try {
    await ensureKev(status, hardware.gpu.kind);
  } catch (error) {
    status.set('error', error.message);
    return;
  }
  // Recheck right before loading weights: memory may have changed during install.
  const current = await detectHardware();
  const now = readiness(current);
  if (!now.ok) {
    status.set('error', now.message);
    return;
  }
  const weightsMarker = join(HOME, 'weights-ready.json');
  const offline = existsSync(weightsMarker);
  child = startKev({ status, port: kevPort, token, offline, gpu: current.gpu });
  child.on('exit', code => {
    if (stopping) return;
    if (status.get().state !== 'error') status.set('error', `Kev exited (code ${code}). See the messages above.`);
  });
  const markReady = setInterval(async () => {
    if (status.get().state !== 'ready') return;
    clearInterval(markReady);
    if (!offline) await writeFile(weightsMarker, JSON.stringify({ kev: KEV_REVISION, at: new Date().toISOString() }));
    if (process.argv.includes('--self-test')) {
      try {
        const results = await selfTest({ port, kevPort, token });
        say(results.every(result => result.ok) ? 'Self-test passed.' : 'Self-test FAILED.');
      } catch (error) {
        say(`Self-test could not run: ${error.message}`);
      }
    }
  }, 1000);
  markReady.unref();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    say(`Could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
