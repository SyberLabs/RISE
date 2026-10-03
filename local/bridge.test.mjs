import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBridge, systemOneBody } from './bridge.mjs';
import { seedCatalog } from './catalog.mjs';

const REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const TOKEN = 'per-run-kev-token-never-shown-to-the-page';

let bridge;
let upstream;
let port;
let kevState = 'ready';
const upstreamCalls = [];

function call(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method,
      headers: { Host: `127.0.0.1:${port}`, ...headers } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const choice = { model: 'kev-latest', state: { reader_intent: 'quiet' },
  questions: { pace: { type: 'choice', instructions: 'Pick.', criteria: { '100': 'Slow', '300': 'Fast' } } } };
const page = port => ({ Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' });

before(async () => {
  upstream = createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      upstreamCalls.push({ url: req.url, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString('utf8') });
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Kev-Revision': REVISION });
      res.end(JSON.stringify({ model: 'kev-latest', answers: { pace: { type: 'choice', choice: '100' } } }));
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const parent = await mkdtemp(join(tmpdir(), 'rise-local-'));
  const dist = join(parent, 'dist');
  await mkdir(dist);
  await writeFile(join(dist, 'index.html'), '<!doctype html><html><head><title>RISE</title></head><body></body></html>');
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, 'assets', 'app-abc.js'), 'console.log(1)');
  await writeFile(join(dist, '..', 'secret-outside-dist.txt'), 'outside');
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  bridge = await createBridge({
    distDir: dist, port, catalog: seedCatalog,
    kev: { port: upstream.address().port, token: TOKEN,
      status: () => ({ state: kevState, revision: REVISION, device: 'Test GPU', message: null }) }
  });
});

after(async () => {
  await new Promise(resolve => bridge.close(resolve));
  await new Promise(resolve => upstream.close(resolve));
});

describe('local RISE bridge', () => {
  it('binds to loopback only', () => {
    assert.equal(bridge.address().address, '127.0.0.1');
  });

  it('serves the app shell marked as local RISE, with the local policy', async () => {
    for (const path of ['/', '/index.html', '/library']) {
      const res = await call(path);
      assert.equal(res.status, 200);
      assert.match(res.text, /<meta name="rise-local" content="1">/u);
      assert.match(res.headers['content-security-policy'], /connect-src 'self'/u);
      assert.doesNotMatch(res.headers['content-security-policy'], /openrouter/u);
      // Nor Google's Gemini API: local RISE keeps the reader's prompts on their own computer.
      assert.doesNotMatch(res.headers['content-security-policy'], /googleapis/u);
    }
    assert.equal((await call('/assets/app-abc.js')).status, 200);
    assert.equal((await call('/assets/missing.js')).status, 404);
  });

  it('never serves files outside the build', async () => {
    for (const path of ['/../secret-outside-dist.txt', '/%2e%2e/secret-outside-dist.txt', '/assets/..%2f..%2fsecret-outside-dist.txt']) {
      const res = await call(path);
      assert.doesNotMatch(res.text, /outside/u, path);
    }
  });

  it('refuses a request addressed to any other host name (DNS rebinding)', async () => {
    for (const host of ['evil.example', `evil.example:${port}`, `127.0.0.1:${port + 1}`, '127.0.0.1']) {
      const res = await call('/api/local/status', { headers: { Host: host } });
      assert.equal(res.status, 421, host);
    }
  });

  it('reports status without the Kev key', async () => {
    const res = await call('/api/local/status');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { rise: 'local', kev: { state: 'ready', revision: REVISION, device: 'Test GPU', message: null } });
    assert.doesNotMatch(res.text, new RegExp(TOKEN, 'u'));
  });

  it('serves the committed public catalog offline', async () => {
    const res = await call('/api/decision-catalog');
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.text).schemaVersion, 1);
  });

  it('forwards a same-origin choice request to the fixed Kev address with the per-run key', async () => {
    upstreamCalls.length = 0;
    const res = await call('/api/local/kev/systemone', { method: 'POST', headers: page(port), body: choice });
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-kev-revision'], REVISION);
    assert.equal(upstreamCalls.length, 1);
    assert.equal(upstreamCalls[0].url, '/v1/systemone');
    assert.equal(upstreamCalls[0].authorization, `Bearer ${TOKEN}`);
    assert.doesNotMatch(res.text, new RegExp(TOKEN, 'u'));
  });

  it('refuses requests from other websites and unsafe shapes before reaching Kev', async () => {
    upstreamCalls.length = 0;
    const cases = [
      [{ ...page(port), Origin: 'https://evil.example' }, choice, 403],
      [{ 'Content-Type': 'application/json' }, choice, 403],
      [{ ...page(port), 'Sec-Fetch-Site': 'cross-site' }, choice, 403],
      [{ ...page(port), 'Content-Type': 'text/plain' }, choice, 415],
      [page(port), { ...choice, url: 'https://attacker.example/v1/systemone' }, 400],
      [page(port), { ...choice, model: 'qwen/qwen3-chat' }, 400],
      [page(port), { ...choice, questions: { run: { type: 'text', instructions: 'x', criteria: {} } } }, 400],
      [page(port), 'x'.repeat(300 * 1024), 413]
    ];
    for (const [headers, body, status] of cases) {
      const res = await call('/api/local/kev/systemone', { method: 'POST', headers, body });
      assert.equal(res.status, status, JSON.stringify(headers));
    }
    assert.equal(upstreamCalls.length, 0);
  });

  it('answers 503 while Kev is installing or loading, and 404 for other API paths', async () => {
    kevState = 'loading';
    const res = await call('/api/local/kev/systemone', { method: 'POST', headers: page(port), body: choice });
    assert.equal(res.status, 503);
    kevState = 'ready';
    for (const path of ['/api/jev-recommend', '/api/local/kev/v1/models', '/api/local/proxy?url=https://example.com']) {
      assert.equal((await call(path, { method: 'POST', headers: page(port), body: choice })).status, 404, path);
    }
  });

  it('keeps only the three System One fields', () => {
    assert.deepEqual(systemOneBody({ ...choice, model: undefined }), choice);
    assert.equal(systemOneBody({ ...choice, stream: true }), null);
    assert.equal(systemOneBody([]), null);
  });
});
