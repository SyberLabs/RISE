/**
 * Memory Core
 * Handles the persistence of user syntheses (journal entries) 
 * and sequence completion history to facilitate the Recursion stage.
 */

import {
  isWorkshopProject,
  migrateWorkshopBlueprint,
  validateWorkshopProject,
  workshopEditorDataToProject,
  workshopProjectToBlueprintView
} from './workshop-project.js';
import { WorkshopMedia } from './workshop-media.js';

const STORAGE_KEY = 'rise_recursions_v1';
const WORKSHOP_KEY = 'rise_workshop_v1';
const WORKSHOP_MUTATION_LOCK = 'rise-workshop-vault-mutation';
const WORKSHOP_MEDIA_LEASES_KEY = 'rise_workshop_media_leases_v1';
const WORKSHOP_MEDIA_LEASE_PREFIX = 'rise_workshop_media_lease_v2:';
const WORKSHOP_MEDIA_LEASE_HEARTBEAT_MS = 5000;
const WORKSHOP_MEDIA_LEASE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Larger than the maximum 24 × 160-character asset-id lease. A successful
// probe proves a real lease has room; a smaller sentinel can give a false yes
// at the localStorage quota boundary.
const WORKSHOP_MEDIA_LEASE_PROBE_VALUE = 'x'.repeat(8192);
const GLOBAL_IMAGES_KEY = 'rise_global_images_v1';
const MAX_GLOBAL_IMAGES = 20;

// MemoryCore is on the boot path; durability is not. Both callers below are
// already async and belong to Workshop, so importing here statically only put
// the asset layer in front of a reader who may never open Workshop — and it
// silently defeated app.js's own `await import()` of the same module, which
// Rollup reported on every build.
let durability = null;
const workshopDurability = async () =>
  (durability ??= await import('./workshop-asset-durability.js'));

function stableGlobalImageId(uri) {
  // Deterministic FNV-1a fallback keeps legacy string records addressable even
  // when a quota error prevents the one-time object migration from persisting.
  let hash = 0x811c9dc5;
  for (let i = 0; i < uri.length; i++) {
    hash ^= uri.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `global_${(hash >>> 0).toString(36)}_${uri.length.toString(36)}`;
}

function normalizeGlobalImageAsset(value, index = 0) {
  const uri = typeof value === 'string' ? value : value?.uri;
  if (typeof uri !== 'string' || !uri.startsWith('data:image/')) return null;
  const rawName = typeof value?.name === 'string' ? value.name.trim() : '';
  return {
    id: typeof value?.id === 'string' && value.id.length > 0
      ? value.id.slice(0, 120)
      : stableGlobalImageId(uri),
    uri,
    name: (rawName || `Global image ${index + 1}`).slice(0, 120),
    createdAt: Number.isFinite(Number(value?.createdAt)) ? Number(value.createdAt) : 0
  };
}

function normalizeGlobalImageAssets(values) {
  const assets = [];
  const seenIds = new Set();
  const seenUris = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const asset = normalizeGlobalImageAsset(value, assets.length);
    if (!asset || seenIds.has(asset.id) || seenUris.has(asset.uri)) continue;
    seenIds.add(asset.id);
    seenUris.add(asset.uri);
    assets.push(asset);
    if (assets.length >= MAX_GLOBAL_IMAGES) break;
  }
  return assets;
}

export class MemoryCore {
  /** @type {Map<string, object>|null} */
  static _hydratedWorkshopViews = null;
  static _workshopMutationTail = Promise.resolve();
  static _workshopAssetReferenceProviders = new Set();
  static _workshopLeaseHeartbeat = null;
  static _workshopLeasePagehideHandler = null;
  static _workshopLeasePageshowHandler = null;
  static _workshopLeaseStorageHealthy = true;
  static _workshopLeasePublishPending = null;
  static _workshopDeferredAssetDeletes = new Set();
  static _workshopDeferredDeleteTimer = null;
  static _workshopLeaseStorageHandler = null;
  static _workshopOrphanSweepStarted = false;

  static _snapshotWorkshopLeaseKeys() {
    // Web Storage is a WebIDL named-property object. Object.keys captures its
    // supported names in one native enumeration, avoiding index shifts between
    // separate length/key(index) calls while another tab mutates storage.
    return Object.keys(localStorage)
      .filter(key => key.startsWith(WORKSHOP_MEDIA_LEASE_PREFIX))
      .sort();
  }
  static _workshopContextId = globalThis.crypto?.randomUUID?.()
    || `workshop-context-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  static _readWorkshopMediaLeases() {
    try {
      const leases = {};
      const legacyRaw = localStorage.getItem(WORKSHOP_MEDIA_LEASES_KEY);
      if (legacyRaw !== null) {
        const legacy = JSON.parse(legacyRaw);
        if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return null;
        Object.assign(leases, legacy);
      }
      const leaseKeys = this._snapshotWorkshopLeaseKeys();
      if (leaseKeys === null) return null;
      const staleKeys = [];
      const cutoff = Date.now() - WORKSHOP_MEDIA_LEASE_MAX_AGE_MS;
      for (const key of leaseKeys) {
        const contextId = key.slice(WORKSHOP_MEDIA_LEASE_PREFIX.length);
        const lease = JSON.parse(localStorage.getItem(key));
        if (!contextId || !lease || typeof lease !== 'object' || Array.isArray(lease)
          || !Number.isFinite(Number(lease.updatedAt)) || !Array.isArray(lease.ids)
          || lease.ids.some(id => typeof id !== 'string' || !id)) return null;
        if (Number(lease.updatedAt) < cutoff) staleKeys.push(key);
        else leases[contextId] = lease;
      }
      for (const key of staleKeys) localStorage.removeItem(key);
      return leases;
    } catch (error) {
      // An unreadable lease ledger is an uncertain ownership state. Deletion
      // must fail closed so corrupt metadata cannot destroy media bytes.
      console.warn('[Memory] Workshop media lease ledger unreadable:', error);
      return null;
    }
  }

  static _publishWorkshopAssetReferences() {
    const ids = new Set();
    for (const provider of this._workshopAssetReferenceProviders) {
      this._workshopAssetIdsFromProvider(provider).forEach(id => ids.add(id));
    }
    try {
      const key = `${WORKSHOP_MEDIA_LEASE_PREFIX}${this._workshopContextId}`;
      if (this._workshopAssetReferenceProviders.size) {
        localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), ids: [...ids] }));
      } else {
        localStorage.removeItem(key);
      }
      this._workshopLeaseStorageHealthy = true;
      return true;
    } catch (error) {
      this._workshopLeaseStorageHealthy = false;
      console.warn('[Memory] Workshop media lease publish failed:', error);
      return false;
    }
  }

  static _ensureWorkshopLeaseHeartbeat() {
    if (this._workshopLeaseHeartbeat !== null) return;
    this._workshopLeaseHeartbeat = setInterval(
      () => this.refreshWorkshopAssetReferences(),
      WORKSHOP_MEDIA_LEASE_HEARTBEAT_MS
    );
    this._workshopLeaseHeartbeat?.unref?.();
    if (!this._workshopLeasePagehideHandler && globalThis.window?.addEventListener) {
      this._workshopLeasePagehideHandler = event => {
        if (!event?.persisted) this._removeWorkshopContextLease();
      };
      this._workshopLeasePageshowHandler = event => {
        if (event?.persisted) this.refreshWorkshopAssetReferences();
      };
      window.addEventListener('pagehide', this._workshopLeasePagehideHandler);
      window.addEventListener('pageshow', this._workshopLeasePageshowHandler);
    }
  }

  static _removeWorkshopContextLease() {
    try {
      localStorage.removeItem(`${WORKSHOP_MEDIA_LEASE_PREFIX}${this._workshopContextId}`);
      this._workshopLeaseStorageHealthy = true;
    } catch (error) {
      this._workshopLeaseStorageHealthy = false;
      console.warn('[Memory] Workshop media lease release failed:', error);
    }
  }

  static _stopWorkshopLeaseHeartbeat() {
    if (this._workshopLeaseHeartbeat !== null) clearInterval(this._workshopLeaseHeartbeat);
    this._workshopLeaseHeartbeat = null;
    if (this._workshopLeasePagehideHandler && globalThis.window?.removeEventListener) {
      window.removeEventListener('pagehide', this._workshopLeasePagehideHandler);
      window.removeEventListener('pageshow', this._workshopLeasePageshowHandler);
    }
    this._workshopLeasePagehideHandler = null;
    this._workshopLeasePageshowHandler = null;
  }

  static refreshWorkshopAssetReferences() {
    if (this._workshopAssetReferenceProviders.size) this._ensureWorkshopLeaseHeartbeat();
    if (this._workshopLeasePublishPending) return this._workshopLeasePublishPending;
    const publication = this._queueWorkshopMutation(async () => {
      const success = this._publishWorkshopAssetReferences();
      if (success && this._workshopAssetReferenceProviders.size
        && !this._workshopOrphanSweepStarted) {
        this._workshopOrphanSweepStarted = true;
        if (!(await this._sweepWorkshopAssetOrphans())) {
          this._workshopOrphanSweepStarted = false;
        }
      }
      return success;
    });
    this._workshopLeasePublishPending = publication;
    const clearPending = () => {
      if (this._workshopLeasePublishPending === publication) {
        this._workshopLeasePublishPending = null;
      }
    };
    void publication.then(clearPending, clearPending);
    void publication.then(success => {
      if (success && this._workshopDeferredAssetDeletes.size) {
        void this._retryDeferredWorkshopAssetDeletes();
      }
    });
    return publication;
  }

  static _isWorkshopAssetReferencedAcrossContexts(id) {
    const probeKey = `${WORKSHOP_MEDIA_LEASE_PREFIX}${this._workshopContextId}:probe`;
    try {
      localStorage.setItem(probeKey, WORKSHOP_MEDIA_LEASE_PROBE_VALUE);
      localStorage.removeItem(probeKey);
      this._workshopLeaseStorageHealthy = true;
    } catch (error) {
      this._workshopLeaseStorageHealthy = false;
      console.warn('[Memory] Workshop media lease storage unavailable:', error);
      return true;
    }
    const leases = this._readWorkshopMediaLeases();
    if (leases === null) return true;
    const cutoff = Date.now() - WORKSHOP_MEDIA_LEASE_MAX_AGE_MS;
    return Object.entries(leases).some(([contextId, lease]) => {
      if (Number(lease?.updatedAt) < cutoff) return false;
      // A live editor in another tab blocks collection as a whole. Its last
      // successful asset list can be stale if a later lease write hit quota;
      // keeping bytes is safer than treating that stale list as proof.
      return contextId !== this._workshopContextId || lease.ids.includes(id);
    });
  }

  static _workshopAssetIdsFromProvider(provider) {
    try {
      const references = provider();
      if (references instanceof Map) return [...references.keys()].filter(Boolean);
      if (references && typeof references[Symbol.iterator] === 'function') {
        return [...references].filter(id => typeof id === 'string' && id);
      }
    } catch (error) {
      console.warn('[Memory] Workshop draft media lease failed:', error);
    }
    return [];
  }

  static _isWorkshopAssetReferencedByDraft(id) {
    for (const provider of this._workshopAssetReferenceProviders) {
      if (this._workshopAssetIdsFromProvider(provider).includes(id)) return true;
    }
    return false;
  }

  static registerWorkshopAssetReferenceProvider(provider) {
    if (typeof provider !== 'function') return async () => {};
    this._workshopAssetReferenceProviders.add(provider);
    const registered = this.refreshWorkshopAssetReferences();
    let released = false;
    return async () => {
      if (released) return Promise.resolve();
      released = true;
      await registered;
      const ids = this._workshopAssetIdsFromProvider(provider);
      this._workshopAssetReferenceProviders.delete(provider);
      await this.refreshWorkshopAssetReferences();
      if (!this._workshopAssetReferenceProviders.size) this._stopWorkshopLeaseHeartbeat();
      if (!ids.length) return Promise.resolve();
      return this._queueWorkshopMutation(() => this._deleteUnreferencedWorkshopAssets(ids));
    };
  }

  static _withWorkshopCrossContextLock(operation) {
    const locks = globalThis.navigator?.locks;
    if (!locks?.request) return operation();
    return locks.request(WORKSHOP_MUTATION_LOCK, { mode: 'exclusive' }, operation);
  }

  static _queueWorkshopMutation(operation) {
    const guarded = () => this._withWorkshopCrossContextLock(operation);
    const next = this._workshopMutationTail.then(guarded, guarded);
    this._workshopMutationTail = next.catch(() => {});
    return next;
  }

  /**
   * Fetch all past session journals
   * @returns {Array} List of past synthesis objects
   */
  static getRecursions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Memory] Fail read:', e);
      return [];
    }
  }

  /**
   * Save a new synthesis entry
   * @param {Object} session The session metadata and WPM
   * @param {String} journalText The raw reflection text from the user
   */
  static saveSynthesis(session, journalText) {
    const history = this.getRecursions();
    
    const entry = {
      id: `syn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      sequenceTitle: session?.title || session?.name || 'Unknown Sequence',
      duration: session?.totalDuration || 0,
      wpm: session?.wpm || 220,
      journal: journalText
    };

    history.unshift(entry); // Add to beginning
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      console.log('[Memory] Synthesis recorded:', entry.id);
      return entry;
    } catch (e) {
      console.error('[Memory] Fail save:', e);
      return null;
    }
  }

  /**
   * Delete a single synthesis entry by id
   * @param {String} id
   */
  static deleteRecursion(id) {
    const history = this.getRecursions().filter(entry => entry.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('[Memory] Fail delete:', e);
    }
  }


  /**
   * Fetch all saved workshop blueprints (sync metadata views).
   * Durable idb assets may lack runtime URIs — use
   * getWorkshopBlueprintsHydrated() before Preview / Run / cortex paint.
   * @returns {Array} List of saved session configs
   */
  static getWorkshopBlueprints() {
    try {
      const { views } = this._readWorkshopStore();
      if (!this._hydratedWorkshopViews) return views;
      return views.map((view) => {
        const hydrated = this._hydratedWorkshopViews.get(view.id);
        if (!hydrated) return view;
        return {
          ...view,
          assets: hydrated.assets,
          sequenceVisualAssets: hydrated.sequenceVisualAssets,
          customVisuals: hydrated.customVisuals,
          project: hydrated.project
        };
      });
    } catch (e) {
      console.error('[Memory] Fail read workshop data:', e);
      return [];
    }
  }

  /**
   * Migrate inline image bytes into IndexedDB and return hydrated views with
   * resolvable URIs for Workshop / Session / cortex consumers.
   */
  static async getWorkshopBlueprintsHydrated() {
    try {
      const { ensureWorkshopAssetsDurable, hydrateWorkshopProjectView } = await workshopDurability();
      const { stored } = this._readWorkshopStore();
      const nextStored = [];
      const views = [];
      let rewritten = false;

      for (const entry of stored) {
        try {
          const formal = isWorkshopProject(entry)
            ? validateWorkshopProject(entry)
            : migrateWorkshopBlueprint(entry);
          const durableAssets = await ensureWorkshopAssetsDurable(
            formal.id,
            formal.assets,
            null
          );
          const assetsChanged = JSON.stringify(durableAssets) !== JSON.stringify(formal.assets);
          const migrated = assetsChanged
            ? validateWorkshopProject({ ...formal, assets: durableAssets })
            : formal;
          if (assetsChanged) rewritten = true;
          nextStored.push(migrated);
          views.push(await hydrateWorkshopProjectView(migrated));
        } catch (error) {
          console.warn('[Memory] Workshop hydrate deferred:', error);
          nextStored.push(entry);
          views.push(entry);
        }
      }

      if (rewritten) {
        try {
          // Hydration may overlap a save or deletion. Only migrate entries
          // that still match the snapshot we hydrated.
          await this._withWorkshopCrossContextLock(() => {
            const originals = new Map(stored.map(entry => [entry.id, JSON.stringify(entry)]));
            const migrations = new Map(nextStored.map(entry => [entry.id, entry]));
            const latest = this._readWorkshopStore().stored.map(entry =>
              originals.get(entry.id) === JSON.stringify(entry)
                ? migrations.get(entry.id) || entry
                : entry);
            localStorage.setItem(WORKSHOP_KEY, JSON.stringify(latest));
          });
        } catch (e) { /* quota — hydrated values still served this session */ }
      }

      const current = new Map(this._readWorkshopStore().stored.map(entry => [entry.id, JSON.stringify(entry)]));
      const originals = new Map(stored.map(entry => [entry.id, JSON.stringify(entry)]));
      this._hydratedWorkshopViews = new Map(
        views.filter((view) => {
          if (!view?.id) return false;
          const currentEntry = current.get(view.id);
          const migratedEntry = nextStored.find(entry => entry.id === view.id);
          return currentEntry === originals.get(view.id)
            || currentEntry === JSON.stringify(migratedEntry);
        }).map(view => [view.id, view])
      );
      return this.getWorkshopBlueprints();
    } catch (e) {
      console.error('[Memory] Fail hydrate workshop data:', e);
      return [];
    }
  }

  static _readWorkshopStore() {
    const data = localStorage.getItem(WORKSHOP_KEY);
    if (!data) return { stored: [], views: [] };
    const parsed = JSON.parse(data);
    const blueprints = Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item === 'object')
      : [];

    let migrated = false;
    const stored = [];
    const views = blueprints.map((blueprint) => {
      try {
        const project = isWorkshopProject(blueprint)
          ? validateWorkshopProject(blueprint)
          : migrateWorkshopBlueprint(blueprint);
        stored.push(project);
        migrated ||= !isWorkshopProject(blueprint);
        return workshopProjectToBlueprintView(project);
      } catch (error) {
        console.warn('[Memory] Workshop project migration deferred:', error);
        stored.push(blueprint);
        return blueprint;
      }
    });
    if (migrated) {
      try {
        localStorage.setItem(WORKSHOP_KEY, JSON.stringify(stored));
      } catch (e) { /* quota — migrated values still served this session */ }
    }
    return { stored, views };
  }

  /**
   * Save a workshop blueprint (sync). Accepts tiny inline fixtures and already
   * durable idb metadata. Large images must use saveWorkshopBlueprintAsync.
   * @param {Object} blueprint The session config payload
   */
  static saveWorkshopBlueprint(blueprint) {
    try {
      if (!blueprint || typeof blueprint !== 'object') return null;
      const { stored } = this._readWorkshopStore();
      const id = blueprint.id || `blueprint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const updatedAt = Date.now();
      const formalInput = isWorkshopProject(blueprint)
        && !Object.hasOwn(blueprint, 'wpm')
        ? { ...blueprint, id, updatedAt }
        : null;
      const project = formalInput
        ? validateWorkshopProject(formalInput)
        : workshopEditorDataToProject(blueprint, { id, updatedAt });
      const storedHistory = [...stored];

      const existingIndex = storedHistory.findIndex(b => b.id === project.id);
      if (existingIndex >= 0) {
        storedHistory[existingIndex] = project;
      } else {
        storedHistory.unshift(project);
      }

      localStorage.setItem(WORKSHOP_KEY, JSON.stringify(storedHistory));
      console.log('[Memory] Workshop Project saved:', project.id);
      return workshopProjectToBlueprintView(project);
    } catch (e) {
      console.error('[Memory] Fail save workshop blueprint:', e);
      return null;
    }
  }

  /**
   * Persist bytes to IndexedDB, then write metadata-only project JSON.
   * @param {Object} blueprint editor or formal project payload
   * @param {{ blobs?: Map<string, Blob>|Record<string, Blob> }} [options]
   */
  static saveWorkshopBlueprintAsync(blueprint, options = {}) {
    return this._queueWorkshopMutation(
      () => this._saveWorkshopBlueprintDurable(blueprint, options)
    );
  }

  static async _saveWorkshopBlueprintDurable(blueprint, options = {}) {
    try {
      if (!blueprint || typeof blueprint !== 'object') return null;
      const { ensureWorkshopAssetsDurable, hydrateWorkshopProjectView } = await workshopDurability();
      const id = blueprint.id || `blueprint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const updatedAt = Date.now();
      const draft = isWorkshopProject(blueprint) && !Object.hasOwn(blueprint, 'wpm')
        ? validateWorkshopProject({ ...blueprint, id, updatedAt })
        : workshopEditorDataToProject(blueprint, { id, updatedAt });

      const durableAssets = await ensureWorkshopAssetsDurable(
        id,
        draft.assets,
        options.blobs || null
      );
      const project = validateWorkshopProject({
        ...draft,
        assets: durableAssets,
        updatedAt
      });

      // Read at commit, after all asynchronous media writes, so another
      // save cannot disappear when this operation publishes its metadata.
      const { stored: storedHistory } = this._readWorkshopStore();
      const previous = storedHistory.find(item => item.id === id);
      const previousIds = (previous?.assets || []).map(asset => asset.id);
      const existingIndex = storedHistory.findIndex(b => b.id === project.id);
      if (existingIndex >= 0) storedHistory[existingIndex] = project;
      else storedHistory.unshift(project);

      localStorage.setItem(WORKSHOP_KEY, JSON.stringify(storedHistory));
      this._hydratedWorkshopViews?.delete(id);
      await this._deleteUnreferencedWorkshopAssets(previousIds);
      console.log('[Memory] Workshop Project saved (durable):', project.id);
      try {
        return await hydrateWorkshopProjectView(project);
      } catch (error) {
        // Metadata is already committed. A temporary IndexedDB/object-URL read
        // failure must not turn that successful save into an apparent failure.
        console.warn('[Memory] Workshop saved; media view hydration deferred:', error);
        return workshopProjectToBlueprintView(project);
      }
    } catch (e) {
      console.error('[Memory] Fail save durable workshop blueprint:', e);
      throw e;
    }
  }

  /**
   * Delete a workshop blueprint and its durable media.
   */
  static _removeWorkshopBlueprint(id) {
    const { stored } = this._readWorkshopStore();
    const removed = stored.find(project => project.id === id);
    localStorage.setItem(WORKSHOP_KEY, JSON.stringify(stored.filter(project => project.id !== id)));
    this._hydratedWorkshopViews?.delete(id);
    return (removed?.assets || []).map(asset => asset.id);
  }

  static async _deleteUnreferencedWorkshopAssets(ids) {
    for (const id of ids) {
      try {
        const { stored } = this._readWorkshopStore();
        if (stored.some(project => (project.assets || []).some(asset => asset.id === id))) {
          this._workshopDeferredAssetDeletes.delete(id);
          if (!this._workshopDeferredAssetDeletes.size) this._stopWorkshopDeferredAssetRetries();
          continue;
        }
        if (this._isWorkshopAssetReferencedByDraft(id)
          || this._isWorkshopAssetReferencedAcrossContexts(id)) {
          this._deferWorkshopAssetDelete(id);
          continue;
        }
        await WorkshopMedia.delete(id);
        this._workshopDeferredAssetDeletes.delete(id);
        if (!this._workshopDeferredAssetDeletes.size) this._stopWorkshopDeferredAssetRetries();
      } catch (error) {
        this._deferWorkshopAssetDelete(id);
        console.warn('[Memory] Workshop media delete deferred:', error);
      }
    }
  }

  static _retryDeferredWorkshopAssetDeletes() {
    const ids = [...this._workshopDeferredAssetDeletes];
    if (!ids.length) return Promise.resolve();
    return this._queueWorkshopMutation(() => this._deleteUnreferencedWorkshopAssets(ids));
  }

  static _ensureWorkshopDeferredAssetRetries() {
    if (!this._workshopLeaseStorageHandler && globalThis.window?.addEventListener) {
      this._workshopLeaseStorageHandler = event => {
        if (event?.key === WORKSHOP_MEDIA_LEASES_KEY
          || event?.key?.startsWith(WORKSHOP_MEDIA_LEASE_PREFIX)) {
          void this._retryDeferredWorkshopAssetDeletes();
        }
      };
      window.addEventListener('storage', this._workshopLeaseStorageHandler);
    }
    if (this._workshopDeferredDeleteTimer !== null) return;
    this._workshopDeferredDeleteTimer = setTimeout(async () => {
      this._workshopDeferredDeleteTimer = null;
      await this._retryDeferredWorkshopAssetDeletes();
      if (this._workshopDeferredAssetDeletes.size) this._ensureWorkshopDeferredAssetRetries();
      else this._stopWorkshopDeferredAssetRetries();
    }, WORKSHOP_MEDIA_LEASE_HEARTBEAT_MS);
    this._workshopDeferredDeleteTimer?.unref?.();
  }

  static _stopWorkshopDeferredAssetRetries() {
    if (this._workshopDeferredDeleteTimer !== null) clearTimeout(this._workshopDeferredDeleteTimer);
    this._workshopDeferredDeleteTimer = null;
    if (this._workshopLeaseStorageHandler && globalThis.window?.removeEventListener) {
      window.removeEventListener('storage', this._workshopLeaseStorageHandler);
    }
    this._workshopLeaseStorageHandler = null;
  }

  static _deferWorkshopAssetDelete(id) {
    this._workshopDeferredAssetDeletes.add(id);
    this._ensureWorkshopDeferredAssetRetries();
  }

  static async _sweepWorkshopAssetOrphans() {
    try {
      const ids = await WorkshopMedia.getAllIds();
      await this._deleteUnreferencedWorkshopAssets(ids);
      return true;
    } catch (error) {
      console.warn('[Memory] Workshop orphan media sweep deferred:', error);
      return false;
    }
  }

  static deleteWorkshopBlueprint(id) {
    try {
      const ids = this._removeWorkshopBlueprint(id);
      void this._deleteUnreferencedWorkshopAssets(ids);
      return true;
    } catch (error) {
      console.error('[Memory] Fail delete workshop blueprint:', error);
      return false;
    }
  }

  static deleteWorkshopBlueprintAsync(id) {
    return this._queueWorkshopMutation(() => this._deleteWorkshopBlueprintDurable(id));
  }

  static async _deleteWorkshopBlueprintDurable(id) {
    try {
      const ids = this._removeWorkshopBlueprint(id);
      await this._deleteUnreferencedWorkshopAssets(ids);
      return true;
    } catch (error) {
      console.error('[Memory] Fail delete workshop blueprint:', error);
      return false;
    }
  }

  // ==========================================
  // Global Image Pool
  // ==========================================

  static getGlobalImageAssets() {
      try {
          const data = localStorage.getItem(GLOBAL_IMAGES_KEY);
          if (!data) return [];
          const parsed = JSON.parse(data);
          const assets = normalizeGlobalImageAssets(parsed);
          const requiresMigration = !Array.isArray(parsed)
            || parsed.length !== assets.length
            || parsed.some(item => typeof item === 'string' || !item?.id || !item?.uri || !item?.name);
          if (requiresMigration) {
              try {
                  localStorage.setItem(GLOBAL_IMAGES_KEY, JSON.stringify(assets));
              } catch (migrationError) {
                  console.warn('[Memory] Global image metadata migration deferred:', migrationError);
              }
          }
          return assets.map(asset => ({ ...asset }));
      } catch (err) {
          console.error('[Memory] Fail read global images:', err);
          return [];
      }
  }

  static getGlobalImages() {
      return this.getGlobalImageAssets().map(asset => asset.uri);
  }

  static resolveGlobalImageUris(selection = {}) {
      const assets = this.getGlobalImageAssets();
      if (selection?.mode !== 'selected') return assets.map(asset => asset.uri);
      const selectedIds = new Set(Array.isArray(selection.assetIds) ? selection.assetIds : []);
      return assets.filter(asset => selectedIds.has(asset.id)).map(asset => asset.uri);
  }

  static saveGlobalImage(base64Uri, metadata = {}) {
      const asset = normalizeGlobalImageAsset({
          id: `global_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          uri: base64Uri,
          name: metadata.name,
          createdAt: Date.now()
      });
      if (!asset) return false;

      const images = this.getGlobalImageAssets();
      const existingIndex = images.findIndex(item => item.uri === asset.uri);
      if (existingIndex >= 0) {
          const existing = images[existingIndex];
          images[existingIndex] = {
              ...existing,
              name: metadata.name ? String(metadata.name).slice(0, 120) : existing.name
          };
          try {
              localStorage.setItem(GLOBAL_IMAGES_KEY, JSON.stringify(images));
              return true;
          } catch (e) {
              console.error('[Memory] Fail update global image metadata:', e);
              return false;
          }
      }
      if (images.length >= MAX_GLOBAL_IMAGES) {
          console.warn(`[Memory] Global image pool is full (${MAX_GLOBAL_IMAGES} images)`);
          return false;
      }
      images.unshift(asset);
      
      try {
          localStorage.setItem(GLOBAL_IMAGES_KEY, JSON.stringify(images));
          return true;
      } catch(e) {
          console.error('[Memory] Fail save global image (Quota Exceeded?):', e);
          return false; // Typically means the image was too large or quota hit
      }
  }

  static removeGlobalImage(idOrIndex) {
      const assets = this.getGlobalImageAssets();
      const index = typeof idOrIndex === 'number'
        ? idOrIndex
        : assets.findIndex(asset => asset.id === idOrIndex);
      if (index < 0 || index >= assets.length) return false;
      assets.splice(index, 1);
      try {
          localStorage.setItem(GLOBAL_IMAGES_KEY, JSON.stringify(assets));
          return true;
      } catch (e) {
          console.error('[Memory] Fail remove global image:', e);
          return false;
      }
  }
}
