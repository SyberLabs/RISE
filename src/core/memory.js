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
import {
  ensureWorkshopAssetsDurable,
  hydrateWorkshopProjectView
} from './workshop-asset-durability.js';
import { WorkshopMedia } from './workshop-media.js';

const STORAGE_KEY = 'rise_recursions_v1';
const WORKSHOP_KEY = 'rise_workshop_v1';
const SOL_PLAN_KEY = 'rise_sol_plan_v1';
const GLOBAL_IMAGES_KEY = 'rise_global_images_v1';
const MAX_GLOBAL_IMAGES = 20;

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
   * SOL plan — user bindings of sequences to the canonical temporal
   * windows. Shape: { [windowKey]: { kind: 'sol'|'blueprint', id } }
   */
  static getSolPlan() {
    try {
      const data = localStorage.getItem(SOL_PLAN_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('[Memory] Fail read sol plan:', e);
      return {};
    }
  }

  /**
   * Assign (or clear with null) a window's custom sequence.
   */
  static setSolPlanEntry(windowKey, entry) {
    const plan = this.getSolPlan();
    if (entry) {
      plan[windowKey] = entry;
    } else {
      delete plan[windowKey];
    }
    try {
      localStorage.setItem(SOL_PLAN_KEY, JSON.stringify(plan));
    } catch (e) {
      console.error('[Memory] Fail save sol plan:', e);
    }
    return plan;
  }

  /**
   * Clear all memory (Amnesia protocol)
   */
  static clearMemory() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WORKSHOP_KEY);
    localStorage.removeItem(SOL_PLAN_KEY);
    localStorage.removeItem(GLOBAL_IMAGES_KEY);
    localStorage.removeItem('rise_orbital_prefs_v1');
    localStorage.removeItem('rise_orbital_text_v1');
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
          localStorage.setItem(WORKSHOP_KEY, JSON.stringify(nextStored));
        } catch (e) { /* quota — hydrated values still served this session */ }
      }

      this._hydratedWorkshopViews = new Map(
        views.filter(view => view?.id).map(view => [view.id, view])
      );
      return views;
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
  static async saveWorkshopBlueprintAsync(blueprint, options = {}) {
    try {
      if (!blueprint || typeof blueprint !== 'object') return null;
      const { stored } = this._readWorkshopStore();
      const id = blueprint.id || `blueprint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const updatedAt = Date.now();
      const draft = isWorkshopProject(blueprint) && !Object.hasOwn(blueprint, 'wpm')
        ? validateWorkshopProject({ ...blueprint, id, updatedAt })
        : workshopEditorDataToProject(blueprint, { id, updatedAt });

      const previous = stored.find(item => item.id === id);
      const previousIds = new Set((previous?.assets || []).map(asset => asset.id));
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

      const nextIds = new Set(project.assets.map(asset => asset.id));
      for (const assetId of previousIds) {
        if (!nextIds.has(assetId)) {
          try { await WorkshopMedia.delete(assetId); } catch { /* best effort */ }
        }
      }

      const storedHistory = [...stored];
      const existingIndex = storedHistory.findIndex(b => b.id === project.id);
      if (existingIndex >= 0) storedHistory[existingIndex] = project;
      else storedHistory.unshift(project);

      localStorage.setItem(WORKSHOP_KEY, JSON.stringify(storedHistory));
      console.log('[Memory] Workshop Project saved (durable):', project.id);
      return hydrateWorkshopProjectView(project);
    } catch (e) {
      console.error('[Memory] Fail save durable workshop blueprint:', e);
      throw e;
    }
  }

  /**
   * Delete a workshop blueprint and its durable media.
   */
  static deleteWorkshopBlueprint(id) {
     try {
       const { stored } = this._readWorkshopStore();
       const history = stored.filter(b => b.id !== id);
       localStorage.setItem(WORKSHOP_KEY, JSON.stringify(history));
       void WorkshopMedia.deleteByProject(id).catch((error) => {
         console.warn('[Memory] Workshop media delete deferred:', error);
       });
       return true;
     } catch (e) {
       console.error('[Memory] Fail delete workshop blueprint:', e);
       return false;
     }
  }

  static async deleteWorkshopBlueprintAsync(id) {
    const ok = this.deleteWorkshopBlueprint(id);
    if (!ok) return false;
    try {
      await WorkshopMedia.deleteByProject(id);
    } catch (error) {
      console.warn('[Memory] Workshop media delete deferred:', error);
    }
    return true;
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
