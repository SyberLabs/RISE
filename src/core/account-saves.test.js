import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccount, listAccountSaves, saveAccountWork, restoreAccountWork, workPayload } from './account-saves.js';
import { LocalWorkStore } from './local-work-store.js';
import { draftLocalWork } from './local-works.js';

const store = new LocalWorkStore();
const makeWork = text => draftLocalWork({ title: 'My poem', text: text || 'The sea is still.\n\nThe light moves.' });
const response = body => ({ ok: true, status: 200, json: async () => ({ version: 1, ...body }) });
const backup = work => response({ save: { app: 'rise', payload: workPayload(work) } });
beforeEach(async () => { await store.clear(); });

describe('account boundary', () => {
  it('uses host cookies without storing or sending a bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ user: { id: 'u1', label: 'Reader' } }));
    expect(await getAccount(fetcher)).toEqual({ id: 'u1', label: 'Reader' });
    expect(fetcher).toHaveBeenCalledWith('https://syberlabs.io/admin/api/v1/account', { credentials: 'include' });
  });
  it('lists only RISE backups', async () => {
    expect(await listAccountSaves(async () => response({ saves: [{ id: 'x', app: 'omni', name: 'Vault' }, { id: 'y', app: 'rise', name: 'Poem' }] }))).toEqual([{ id: 'y', app: 'rise', name: 'Poem' }]);
  });
  it('sends an explicit bounded work with the mutation header and stable retry id', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ save: { id: '1' } }));
    const work = { ...makeWork(), providerKey: 'secret', media: { data: 'private' } };
    await saveAccountWork(work, '24476b3f-4439-4b5a-9d5b-133f89ac9113', fetcher);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://syberlabs.io/admin/api/v1/saves');
    expect(options.headers['X-SyberLabs-Account']).toBe('v1');
    expect(options.credentials).toBe('include');
    expect(options.body).not.toContain('secret');
    expect(JSON.parse(options.body).payload.work).toEqual(workPayload(work).work);
  });
  it('does not change browser data when the API fails', async () => {
    await store.save(makeWork());
    await expect(restoreAccountWork('x', store, { fetcher: async () => ({ ok: false, status: 503 }) })).rejects.toThrow('temporarily unavailable');
    expect(await store.all()).toHaveLength(1);
  });
  it('requires a current sign-in and protocol version', async () => {
    await expect(getAccount(async () => ({ ok: false, status: 401 }))).rejects.toMatchObject({ status: 401 });
    await expect(getAccount(async () => ({ ok: true, json: async () => ({ version: 2 }) }))).rejects.toThrow('unsupported');
  });
});

describe('restore crosses the existing work validator', () => {
  it('restores text and named divisions into a real IndexedDB shelf', async () => {
    const work = makeWork();
    await restoreAccountWork('x', store, { fetcher: async () => backup(work) });
    expect((await store.get(work.id)).text).toBe(work.text);
  });
  it('rejects other apps, corrupt divisions, and hostile metadata before writing', async () => {
    for (const save of [
      { app: 'omni', payload: workPayload(makeWork()) },
      { app: 'rise', payload: { schema: 'rise.account-work.v1', work: { ...makeWork(), cuts: [1, 2] } } },
      { app: 'rise', payload: { schema: 'rise.account-work.v1', work: { ...makeWork(), title: { html: '<script>' } } } }
    ]) {
      await expect(restoreAccountWork('x', store, { fetcher: async () => response({ save }) })).rejects.toThrow();
      expect(await store.all()).toHaveLength(0);
    }
  });
  it('never silently replaces an existing different work', async () => {
    const work = makeWork('A browser draft that I want to keep.');
    await store.save(work);
    const remote = makeWork('An older account draft.');
    await expect(restoreAccountWork('x', store, { fetcher: async () => backup(remote) })).rejects.toThrow('different browser copy');
    expect((await store.get(work.id)).text).toBe(work.text);
    await restoreAccountWork('x', store, { replace: true, fetcher: async () => backup(remote) });
    expect((await store.get(work.id)).text).toBe(remote.text);
  });
});
