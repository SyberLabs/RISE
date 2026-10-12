// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

let runtime, script, directory;
async function start() {
  runtime = new Miniflare(convertV4MiniflareOptions({
    resourcePersistencePath: directory,
    workers: [{ name: 'audio-test', modules: true, script, compatibilityDate: '2026-09-26',
      durableObjects: { PLUS_METER: { className: 'PlusMeter', useSQLite: true } } }]
  }));
  await runtime.ready;
}
async function call(owner, op, body = {}) {
  const namespace = await runtime.getDurableObjectNamespace('PLUS_METER', 'audio-test');
  const response = await namespace.get(namespace.idFromName(owner)).fetch(`https://meter/audio/${op}`, { method: 'POST', body: JSON.stringify(body) });
  expect(response.status).toBe(200);
  return response.json();
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'rise-audio-runtime-'));
  const bundle = await build({ stdin: { contents: "export { PlusMeter } from './worker/plus.mjs'; export default { fetch() { return new Response('test'); } };", resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, external: ['cloudflare:workers'] });
  script = bundle.outputFiles[0].text;
  await start();
}, 20000);
afterAll(async () => { await runtime?.dispose(); if (directory) await rm(directory, { recursive: true, force: true }); });

it('SQLite stores binary chunks and timings across runtime restart, without leaking between owners', async () => {
  const render = 'a'.repeat(64);
  const requests = await Promise.all(Array.from({ length: 8 }, () => call('owner-a', 'claim', { render })));
  expect(requests.filter(r => r.state === 'claimed')).toHaveLength(1);
  expect(requests.filter(r => r.state === 'pending')).toHaveLength(7);
  const token = requests.find(r => r.state === 'claimed').token;
  const audio = Buffer.alloc(150_000, 123).toString('base64');
  const timings = [0, 0.2, 0.2, 0.4];
  expect((await call('owner-a', 'complete', { render, token, audio, timings })).state).toBe('ready');
  await runtime.dispose();
  await start();
  const replay = await call('owner-a', 'claim', { render });
  expect(replay.state).toBe('ready');
  expect(replay.audio === audio).toBe(true);
  expect(replay.timings).toEqual(timings);
  expect((await call('owner-b', 'claim', { render })).state).toBe('claimed');
  await call('owner-a', 'erase');
  expect((await call('owner-a', 'claim', { render })).state).toBe('unavailable');
}, 20000);

it('SQLite deletion fences in-flight writes and retains the no-repeat safety record after restart', async () => {
  const render = 'b'.repeat(64);
  const claim = await call('owner-c', 'claim', { render });
  await call('owner-c', 'erase');
  expect((await call('owner-c', 'complete', { render, token: claim.token, audio: 'YWJj', timings: [0, 1] })).state).toBe('unavailable');
  await runtime.dispose();
  await start();
  expect((await call('owner-c', 'claim', { render })).state).toBe('unavailable');
}, 20000);
