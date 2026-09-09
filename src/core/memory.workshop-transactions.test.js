// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCore } from './memory.js';
import { WorkshopMedia } from './workshop-media.js';

const asset = { id: 'shared-image', storage: 'idb', mimeType: 'image/png', byteLength: 5 };
const draft = (id, assets = []) => ({ id, title: id, sources: [{ id: 'source', data: 'one two three' }], sequenceVisualAssets: assets });
let values;
let storageKeys;
beforeEach(async () => {
  MemoryCore._stopWorkshopLeaseHeartbeat();
  MemoryCore._stopWorkshopDeferredAssetRetries();
  values = new Map();
  storageKeys = () => [...values.keys()];
  const storage = new Proxy({
    get length() { return values.size; },
    key: index => storageKeys()[index] ?? null,
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  }, {
    ownKeys: target => [...Reflect.ownKeys(target), ...storageKeys()],
    getOwnPropertyDescriptor: (target, key) => Reflect.getOwnPropertyDescriptor(target, key)
      || (values.has(key) ? { configurable: true, enumerable: true, value: values.get(key) } : undefined)
  });
  vi.stubGlobal('localStorage', storage);
  MemoryCore._hydratedWorkshopViews = null;
  MemoryCore._workshopMutationTail = Promise.resolve();
  MemoryCore._workshopAssetReferenceProviders = new Set();
  MemoryCore._workshopLeaseStorageHealthy = true;
  MemoryCore._workshopLeasePublishPending = null;
  MemoryCore._workshopDeferredAssetDeletes = new Set();
  MemoryCore._workshopOrphanSweepStarted = false;
  MemoryCore._workshopContextId = 'current-tab';
  await WorkshopMedia.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function saveImage(id) {
  return MemoryCore.saveWorkshopBlueprintAsync(draft(id, [asset]), {
    blobs: new Map([[asset.id, new Blob(['image'], { type: 'image/png' })]])
  });
}

describe('Workshop persistence transactions', () => {
  it('retains shared bytes when their original project is deleted, then cleans up the last reference', async () => {
    await saveImage('original');
    await MemoryCore.saveWorkshopBlueprintAsync(draft('imported', [asset]));
    await MemoryCore.deleteWorkshopBlueprintAsync('original');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
    await MemoryCore.deleteWorkshopBlueprintAsync('imported');
    expect(await WorkshopMedia.has(asset.id)).toBe(false);
  });

  it('retains bytes leased by a live draft after its Vault project is deleted', async () => {
    await saveImage('original');
    const release = MemoryCore.registerWorkshopAssetReferenceProvider(() => new Set([asset.id]));

    await MemoryCore.deleteWorkshopBlueprintAsync('original');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);

    await release();
    expect(await WorkshopMedia.has(asset.id)).toBe(false);
  });

  it('retains bytes leased by a live draft in another browser tab', async () => {
    await saveImage('original');
    values.set('rise_workshop_media_leases_v1', JSON.stringify({
      'another-tab': { updatedAt: Date.now(), ids: [asset.id] }
    }));

    await MemoryCore.deleteWorkshopBlueprintAsync('original');

    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('keeps independent cross-tab lease publications when two tabs publish before deletion', async () => {
    await saveImage('original');
    MemoryCore._workshopAssetReferenceProviders = new Set([() => new Set([asset.id])]);
    MemoryCore._workshopContextId = 'tab-a';
    await MemoryCore.refreshWorkshopAssetReferences();

    MemoryCore._workshopAssetReferenceProviders = new Set([() => new Set(['other-image'])]);
    MemoryCore._workshopContextId = 'tab-b';
    await MemoryCore.refreshWorkshopAssetReferences();
    await MemoryCore.deleteWorkshopBlueprintAsync('original');

    expect(storageKeys().filter(key => key.startsWith('rise_workshop_media_lease_v2:'))).toHaveLength(2);
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('fails closed when a cross-tab lease record is malformed', async () => {
    await saveImage('original');
    values.set('rise_workshop_media_lease_v2:another-tab', '{broken');

    await MemoryCore.deleteWorkshopBlueprintAsync('original');

    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('uses one snapshot enumeration even when indexed scans would shift identically', async () => {
    await saveImage('original');
    values.set('aaa-unrelated', 'value');
    values.set('rise_workshop_media_lease_v2:another-tab', JSON.stringify({
      updatedAt: Date.now(), ids: [asset.id]
    }));
    const originalKey = localStorage.key;
    let shiftCount = 0;
    vi.spyOn(localStorage, 'key').mockImplementation(index => {
      const key = originalKey(index);
      if (key === 'aaa-unrelated') {
        shiftCount += 1;
        values.delete('aaa-unrelated');
        values.set('aaa-unrelated', 'value');
      }
      return key;
    });

    await MemoryCore.deleteWorkshopBlueprintAsync('original');

    expect(shiftCount).toBe(0);
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('retries a deferred deletion when another tab removes its blank lease', async () => {
    await saveImage('original');
    const listeners = new Map();
    vi.stubGlobal('window', {
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    });
    const leaseKey = 'rise_workshop_media_lease_v2:editing-tab';
    values.set(leaseKey, JSON.stringify({ updatedAt: Date.now(), ids: [] }));

    await MemoryCore.deleteWorkshopBlueprintAsync('original');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
    values.delete(leaseKey);
    listeners.get('storage')({ key: leaseKey });
    await MemoryCore._workshopMutationTail;

    expect(await WorkshopMedia.has(asset.id)).toBe(false);
  });

  it('fails closed across independent tabs when a full lease exceeds remaining quota', async () => {
    await saveImage('original');
    const originalSetItem = localStorage.setItem;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith('rise_workshop_media_lease_v2:') && value.length > 50) {
        throw new Error('lease quota');
      }
      return originalSetItem(key, value);
    });
    MemoryCore._workshopAssetReferenceProviders = new Set([() => new Set([asset.id])]);
    await MemoryCore.refreshWorkshopAssetReferences();

    // A separate tab has independent module state.
    MemoryCore._workshopContextId = 'second-tab';
    MemoryCore._workshopLeaseStorageHealthy = true;
    await MemoryCore.deleteWorkshopBlueprintAsync('original');

    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('retries media collection after a transient lease-storage fault', async () => {
    await saveImage('original');
    const originalSetItem = localStorage.setItem;
    let failProbe = true;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (failProbe && key.endsWith(':probe')) {
        failProbe = false;
        throw new Error('temporary storage fault');
      }
      return originalSetItem(key, value);
    });

    await MemoryCore.deleteWorkshopBlueprintAsync('original');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);

    await MemoryCore._retryDeferredWorkshopAssetDeletes();
    expect(await WorkshopMedia.has(asset.id)).toBe(false);
  });

  it('sweeps media orphaned before reload after a healthy Workshop lease publishes', async () => {
    await WorkshopMedia.put({
      id: asset.id,
      projectId: 'deleted-project',
      data: new Blob(['image'], { type: 'image/png' })
    });
    const release = MemoryCore.registerWorkshopAssetReferenceProvider(() => new Set());
    await vi.waitFor(async () => expect(await WorkshopMedia.has(asset.id)).toBe(false));
    await release();
  });

  it('retries the orphan inventory after a transient IndexedDB failure', async () => {
    await WorkshopMedia.put({
      id: asset.id,
      projectId: 'deleted-project',
      data: new Blob(['image'], { type: 'image/png' })
    });
    const getAllIds = WorkshopMedia.getAllIds.bind(WorkshopMedia);
    vi.spyOn(WorkshopMedia, 'getAllIds')
      .mockRejectedValueOnce(new Error('temporary inventory failure'))
      .mockImplementation(getAllIds);

    const release = MemoryCore.registerWorkshopAssetReferenceProvider(() => new Set());
    await MemoryCore._workshopMutationTail;
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
    expect(MemoryCore._workshopOrphanSweepStarted).toBe(false);

    await MemoryCore.refreshWorkshopAssetReferences();
    expect(await WorkshopMedia.has(asset.id)).toBe(false);
    expect(WorkshopMedia.getAllIds).toHaveBeenCalledTimes(2);
    await release();
  });

  it('preserves a live lease while its page is held in the back-forward cache', async () => {
    const listeners = new Map();
    vi.stubGlobal('window', {
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    });
    const release = MemoryCore.registerWorkshopAssetReferenceProvider(() => new Set([asset.id]));
    await MemoryCore._workshopMutationTail;
    const leaseKey = 'rise_workshop_media_lease_v2:current-tab';
    expect(values.has(leaseKey)).toBe(true);

    listeners.get('pagehide')({ persisted: true });
    expect(values.has(leaseKey)).toBe(true);
    listeners.get('pageshow')({ persisted: true });
    await MemoryCore._workshopMutationTail;
    expect(values.has(leaseKey)).toBe(true);

    await release();
  });

  it('retains shared bytes when one project removes its image', async () => {
    await saveImage('original');
    await MemoryCore.saveWorkshopBlueprintAsync(draft('imported', [asset]));
    await MemoryCore.saveWorkshopBlueprintAsync(draft('original'));
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('keeps the previous saved media intact when metadata cannot be committed', async () => {
    await saveImage('original');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(MemoryCore.saveWorkshopBlueprintAsync(draft('original'))).rejects.toThrow('quota');
    expect(JSON.parse(values.get('rise_workshop_v1'))[0].assets).toHaveLength(1);
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('returns a successful saved view when post-commit media hydration fails', async () => {
    vi.spyOn(WorkshopMedia, 'resolveObjectUrl').mockRejectedValue(new Error('IndexedDB read failed'));

    const saved = await saveImage('committed');

    expect(saved.id).toBe('committed');
    expect(saved.sequenceVisualAssets).toEqual([expect.objectContaining({ id: asset.id })]);
    expect(MemoryCore.getWorkshopBlueprints().map(project => project.id)).toContain('committed');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('retains both projects from concurrent saves', async () => {
    await Promise.all([
      MemoryCore.saveWorkshopBlueprintAsync(draft('first')),
      MemoryCore.saveWorkshopBlueprintAsync(draft('second'))
    ]);
    expect(MemoryCore.getWorkshopBlueprints().map(project => project.id).sort()).toEqual(['first', 'second']);
  });

  it('coordinates durable mutations through a browser-wide Vault lock', async () => {
    let lockTail = Promise.resolve();
    const request = vi.fn((_name, _options, operation) => {
      const next = lockTail.then(operation, operation);
      lockTail = next.catch(() => {});
      return next;
    });
    vi.stubGlobal('navigator', { locks: { request } });

    const first = MemoryCore.saveWorkshopBlueprintAsync(draft('first-tab'));
    // A separate tab has its own in-memory tail but shares navigator.locks.
    MemoryCore._workshopMutationTail = Promise.resolve();
    const second = MemoryCore.saveWorkshopBlueprintAsync(draft('second-tab'));
    await Promise.all([first, second]);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(call => call[0]))
      .toEqual(['rise-workshop-vault-mutation', 'rise-workshop-vault-mutation']);
    expect(MemoryCore.getWorkshopBlueprints().map(project => project.id).sort())
      .toEqual(['first-tab', 'second-tab']);
  });

  it('does not delete media while an earlier save is publishing a shared reference', async () => {
    await saveImage('original');
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const originalHas = WorkshopMedia.has.bind(WorkshopMedia);
    vi.spyOn(WorkshopMedia, 'has').mockImplementation(async id => {
      await held;
      return originalHas(id);
    });

    const saving = MemoryCore.saveWorkshopBlueprintAsync(draft('imported', [asset]));
    await vi.waitFor(() => expect(WorkshopMedia.has).toHaveBeenCalledWith(asset.id));
    const deleting = MemoryCore.deleteWorkshopBlueprintAsync('original');
    await Promise.resolve();
    release();

    await Promise.all([saving, deleting]);
    expect(MemoryCore.getWorkshopBlueprints().map(project => project.id)).toContain('imported');
    expect(await WorkshopMedia.has(asset.id)).toBe(true);
  });

  it('does not overwrite a newer save while migrating inline media', async () => {
    MemoryCore.saveWorkshopBlueprint(draft('legacy', [{ id: 'inline', uri: 'data:image/png;base64,aW1hZ2U=' }]));
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const originalPut = WorkshopMedia.put.bind(WorkshopMedia);
    vi.spyOn(WorkshopMedia, 'put').mockImplementation(async input => { await held; return originalPut(input); });
    const hydration = MemoryCore.getWorkshopBlueprintsHydrated();
    await vi.waitFor(() => expect(WorkshopMedia.put).toHaveBeenCalled());
    await MemoryCore.saveWorkshopBlueprintAsync(draft('newer'));
    release();
    await hydration;
    expect(MemoryCore.getWorkshopBlueprints().map(project => project.id).sort()).toEqual(['legacy', 'newer']);
  });
});
