/**
 * Memory Core
 * Handles the persistence of user syntheses (journal entries) 
 * and sequence completion history to facilitate the Recursion stage.
 */

const STORAGE_KEY = 'rise_recursions_v1';
const WORKSHOP_KEY = 'rise_workshop_v1';

export class MemoryCore {
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
      duration: session?.duration || 0,
      wpm: session?.wpm || 300,
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
   * Clear all memory (Amnesia protocol)
   */
  static clearMemory() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WORKSHOP_KEY);
  }

  /**
   * Fetch all saved workshop blueprints
   * @returns {Array} List of saved session configs
   */
  static getWorkshopBlueprints() {
    try {
      const data = localStorage.getItem(WORKSHOP_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Memory] Fail read workshop data:', e);
      return [];
    }
  }

  /**
   * Save a workshop blueprint
   * @param {Object} blueprint The session config payload
   */
  static saveWorkshopBlueprint(blueprint) {
    const history = this.getWorkshopBlueprints();
    
    // Add unique ID and timestamp if missing
    if (!blueprint.id) {
       blueprint.id = `blueprint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    blueprint.updatedAt = Date.now();
    
    // Replace if exists, otherwise append
    const existingIndex = history.findIndex(b => b.id === blueprint.id);
    if (existingIndex >= 0) {
       history[existingIndex] = blueprint;
    } else {
       history.unshift(blueprint); 
    }
    
    try {
      localStorage.setItem(WORKSHOP_KEY, JSON.stringify(history));
      console.log('[Memory] Workshop Blueprint saved:', blueprint.id);
      return blueprint;
    } catch (e) {
      console.error('[Memory] Fail save workshop blueprint:', e);
      return null;
    }
  }

  /**
   * Delete a workshop blueprint
   */
  static deleteWorkshopBlueprint(id) {
     const history = this.getWorkshopBlueprints().filter(b => b.id !== id);
     localStorage.setItem(WORKSHOP_KEY, JSON.stringify(history));
  }

  // ==========================================
  // Global Image Pool
  // ==========================================

  static getGlobalImages() {
      try {
          const data = localStorage.getItem('rise_global_images_v1');
          return data ? JSON.parse(data) : [];
      } catch (err) {
          console.error('[Memory] Fail read global images:', err);
          return [];
      }
  }

  static saveGlobalImage(base64Uri) {
      const images = this.getGlobalImages();
      // Enforce max size (e.g., 20) to prevent localStorage quota exhaustion quickly
      if (images.length >= 20) {
          images.pop(); // Remove oldest
      }
      images.unshift(base64Uri);
      
      try {
          localStorage.setItem('rise_global_images_v1', JSON.stringify(images));
          return true;
      } catch(e) {
          console.error('[Memory] Fail save global image (Quota Exceeded?):', e);
          return false; // Typically means the image was too large or quota hit
      }
  }

  static removeGlobalImage(index) {
      const images = this.getGlobalImages();
      images.splice(index, 1);
      localStorage.setItem('rise_global_images_v1', JSON.stringify(images));
  }
}
