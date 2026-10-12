import { afterEach, expect, it, vi } from 'vitest';
import { PlusMeter } from './plus.mjs';

import { audioStorage } from './plus-test-storage.mjs';
const render = 'a'.repeat(64);
const audio = btoa('a voice');
const timings = [0, 0.1, 0.1, 0.2];
const call = async (obj, op, body = {}) => (await obj.fetch(new Request(`https://plus-meter/audio/${op}`, { method: 'POST', body: JSON.stringify({ render, ...body }) }))).json();
afterEach(() => vi.useRealTimers());

it('claims one concurrent render, persists it across restart and replays without a new claim', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const answers = await Promise.all([call(obj, 'claim'), call(obj, 'claim')]);
  expect(answers.map(a => a.state).sort()).toEqual(['claimed', 'pending']);
  const token = answers.find(a => a.state === 'claimed').token;
  expect(await call(obj, 'complete', { token, audio, timings })).toMatchObject({ state: 'ready' });
  const nextDevice = await call(new PlusMeter({ storage }), 'claim');
  expect(nextDevice).toMatchObject({ state: 'ready', audio, timings });
});

it('keeps an uncertain interrupted claim across restart and time instead of charging again', async () => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  const storage = audioStorage();
  expect(await call(new PlusMeter({ storage }), 'claim')).toMatchObject({ state: 'claimed' });
  vi.setSystemTime(Date.now() + 60 * 60 * 1000);
  expect(await call(new PlusMeter({ storage }), 'claim')).toMatchObject({ state: 'unavailable' });
});

it('release is fenced by the claim token, and a stale completion cannot overwrite the retry', async () => {
  const obj = new PlusMeter({ storage: audioStorage() });
  const { token } = await call(obj, 'claim');
  expect(await call(obj, 'release', { token: 'wrong' })).toMatchObject({ state: 'unavailable' });
  expect(await call(obj, 'release', { token })).toMatchObject({ state: 'released' });
  const retry = await call(obj, 'claim');
  expect(retry.state).toBe('claimed');
  expect(await call(obj, 'complete', { token, audio, timings })).toMatchObject({ state: 'unavailable' });
});

it('erasure fences in-flight completion and permanently refuses automatic regeneration', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const { token } = await call(obj, 'claim');
  expect(await call(obj, 'erase')).toEqual({ erased: true });
  expect(await call(obj, 'complete', { token, audio, timings })).toMatchObject({ state: 'unavailable' });
  expect(await call(new PlusMeter({ storage }), 'claim')).toMatchObject({ state: 'unavailable' });
  expect([...storage.rows.keys()].filter(key => key.startsWith('chunk:'))).toHaveLength(0);
});

it('expires stored bytes on alarm but keeps the non-regenerating record', async () => {
  vi.useFakeTimers({ now: 1_800_000_000_000 });
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const { token } = await call(obj, 'claim');
  const completed = await call(obj, 'complete', { token, audio, timings });
  vi.setSystemTime(completed.expiresAt * 1000 + 1);
  await obj.alarm();
  expect(await call(obj, 'claim')).toMatchObject({ state: 'unavailable' });
  expect([...storage.rows.keys()].filter(key => key.startsWith('chunk:'))).toHaveLength(0);
});

it('refuses missing or corrupt stored audio without a second claim', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const { token } = await call(obj, 'claim');
  await call(obj, 'complete', { token, audio, timings });
  const key = [...storage.rows.keys()].find(key => key.startsWith('chunk:'));
  storage.rows.delete(key);
  expect(await call(obj, 'claim')).toMatchObject({ state: 'unavailable' });
});

it('reserves bounded account capacity before any render and releases only its own reservation', async () => {
  const obj = new PlusMeter({ storage: audioStorage() });
  const claims = [];
  for (let n = 0; n < 4; n++) claims.push(await call(obj, 'claim', { render: String(n).repeat(64) }));
  expect(claims.every(c => c.state === 'claimed')).toBe(true);
  expect(await call(obj, 'claim', { render: 'f'.repeat(64) })).toMatchObject({ state: 'full' });
  await call(obj, 'release', { render: '0'.repeat(64), token: claims[0].token });
  expect(await call(obj, 'claim', { render: 'f'.repeat(64) })).toMatchObject({ state: 'claimed' });
});

it('frees reserved capacity after a confirmed failed render without permitting a retry', async () => {
  const obj = new PlusMeter({ storage: audioStorage() });
  for (let n = 0; n < 5; n++) {
    const render = String(n).repeat(64);
    const { token } = await call(obj, 'claim', { render });
    expect(token).toBeTypeOf('string');
    expect(await call(obj, 'abandon', { render, token })).toMatchObject({ state: 'unavailable' });
    expect(await call(obj, 'claim', { render })).toMatchObject({ state: 'unavailable' });
  }
});

it('rolls back partial chunk persistence and never grants another claim', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const { token } = await call(obj, 'claim');
  const put = storage.kv.put;
  storage.kv.put = (key, value) => { if (key.startsWith('chunk:') && key.endsWith(':1')) throw new Error('disk failure'); return put(key, value); };
  await expect(call(obj, 'complete', { token, audio: btoa('x'.repeat(100_000)), timings })).rejects.toThrow('disk failure');
  expect([...storage.rows.keys()].some(k => k.startsWith('chunk:'))).toBe(false);
  expect(await call(new PlusMeter({ storage }), 'claim')).toMatchObject({ state: 'pending' });
});

it('does not acknowledge a claim until the durable write completes', async () => {
  const storage = audioStorage();
  storage.sync = async () => { throw new Error('durability unavailable'); };
  const obj = new PlusMeter({ storage });
  await expect(call(obj, 'claim')).rejects.toThrow('durability unavailable');
  storage.sync = async () => {};
  expect(await call(new PlusMeter({ storage }), 'claim')).toMatchObject({ state: 'pending' });
});

it('guards repeated meter reserve/release with the same operation identifier', async () => {
  const obj = new PlusMeter({ storage: audioStorage() });
  const meter = async (op, body) => (await obj.fetch(new Request(`https://plus-meter/${op}`, { method: 'POST', body: JSON.stringify(body) }))).json();
  const own = { period: 1, n: 5, limit: 50, operation: 'known-operation' };
  await meter('reserve', own);
  await meter('reserve', own);
  expect((await meter('reserve', { period: 1, n: 0, limit: 50 })).used).toBe(5);
  await meter('reserve', { ...own, operation: 'another-operation' });
  await meter('release', own);
  await meter('release', own);
  expect((await meter('reserve', { period: 1, n: 0, limit: 50 })).used).toBe(5);
  expect((await meter('reserve', own)).ok).toBe(false);
});

it('rolls back an interrupted meter transaction before retrying the reservation', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const reserve = () => obj.fetch(new Request('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period: 1, n: 5, limit: 50, operation: 'interrupted-operation' }) }));
  const put = storage.kv.put;
  storage.kv.put = (key, value) => { if (key === 'used') throw new Error('meter write failed'); return put(key, value); };
  await expect(reserve()).rejects.toThrow('meter write failed');
  storage.kv.put = put;
  expect(await (await reserve()).json()).toMatchObject({ ok: true, used: 5 });
});

it('detects same-length payload corruption and keeps the original render non-regenerating', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  const { token } = await call(obj, 'claim');
  await call(obj, 'complete', { token, audio, timings });
  const key = [...storage.rows.keys()].find(k => k.startsWith('chunk:'));
  const chunk = storage.kv.get(key);
  chunk[0] ^= 1;
  storage.kv.put(key, chunk);
  expect(await call(obj, 'claim')).toMatchObject({ state: 'unavailable' });
});

it('caps safety-record growth even after audio erasure', async () => {
  const storage = audioStorage();
  const obj = new PlusMeter({ storage });
  for (let i = 0; i < 1024; i++) storage.kv.put(`render:${i.toString(16).padStart(64, '0')}`, { state: 'unavailable', reason: 'erased' });
  expect(await call(obj, 'claim')).toMatchObject({ state: 'full' });
  await call(obj, 'erase');
  expect(await call(obj, 'claim')).toMatchObject({ state: 'full' });
});
