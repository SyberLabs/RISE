import { freezeManifest } from './constants.js';

/**
 * Atrium-coupled collections.
 *
 * A record's collections are CONTENT, curated with the same editorial
 * care as its passages: an Atrium launch should show imagery that
 * belongs to what is being read, not a generic gallery rotation.
 *
 * Each entry names existing provider category ids (Wikimedia bare ids,
 * Art Institute `aic-` ids). Nothing here invents a category or
 * bypasses a provider contract — this is curation, not plumbing.
 *
 * Scope rules:
 * - Absent record → the launch keeps its domain sensory default.
 * - Present record → those categories REPLACE the domain default's
 *   `sourced` list for that launch only. The user may override
 *   everything in the orbital afterward; nothing is forced.
 * - Ids must exist in WIKIMEDIA_CATEGORIES or MUSEUM_CATEGORIES; a
 *   test asserts this so a renamed provider category can never leave
 *   a launch pointing at nothing.
 */
export const ATRIUM_RECORD_COLLECTIONS = freezeManifest({
  // ── Philosophy ──────────────────────────────────────────────
  // Cosmological and mathematical traditions read against the
  // diagrammatic and astronomical record.
  'ph-school-milesian': ['astronomy', 'geometry'],
  'ph-tradition-pythagorean': ['geometry', 'fractals'],
  'ph-tradition-neopythagorean': ['geometry', 'sacred'],
  'ph-school-eleatic': ['geometry'],
  'ph-school-atomism': ['microscopy', 'geometry'],
  'ph-tradition-pluralists': ['botany', 'microscopy'],
  'ph-thinker-heraclitus': ['solar', 'astronomy'],

  // Classical Athens and its successors: the human figure and the
  // Old Master tradition that carried these texts forward.
  'ph-tradition-socratic': ['aic-oldmasters', 'aic-portraits'],
  'ph-thinker-plato': ['aic-oldmasters', 'geometry'],
  'ph-thinker-aristotle': ['aic-oldmasters', 'anatomy', 'botany'],
  'ph-school-peripatetic': ['anatomy', 'botany'],
  'ph-movement-sophistic': ['aic-portraits'],

  // Hellenistic ethics: the cosmos as the Stoic proving ground.
  'ph-tradition-early-stoa': ['astronomy', 'aic-landscapes'],
  'ph-tradition-roman-stoa': ['aic-portraits', 'astronomy'],
  'ph-school-epicurean': ['botany', 'aic-landscapes'],

  // Late antiquity: light, emanation, and the sacred image.
  'ph-thinker-plotinus': ['sacred', 'solar'],
  'ph-school-athenian-neoplatonism': ['sacred', 'geometry'],
  'ph-school-alexandrian-neoplatonism': ['sacred', 'astronomy'],
  'ph-tradition-iamblichean': ['sacred'],
  'ph-thinker-porphyry': ['sacred', 'aic-oldmasters'],
  'ph-thinker-augustine': ['sacred', 'aic-oldmasters'],
  'ph-tradition-middle-platonism': ['astronomy', 'sacred'],
  'ph-thinker-philo': ['sacred'],

  // ── History: Atlantic Revolutions ───────────────────────────
  // Read against portraiture (the actors and the declarations' signers),
  // landscape (the contested ground), and the Romantic sublime this
  // period produced and was mythologized by.
  //
  // Founding documents: the portrait tradition that framed their authors.
  'hist-us-declaration': ['aic-portraits', 'aic-oldmasters'],
  'hist-rights-man': ['aic-portraits', 'aic-oldmasters'],
  'hist-rights-woman': ['aic-portraits'],
  'hist-us-bill-rights': ['aic-portraits'],
  'hist-social-contract': ['aic-portraits', 'aic-oldmasters'],
  'hist-common-sense': ['aic-portraits'],

  // Insurrection and its ground.
  'hist-bastille': ['romantic', 'aic-portraits'],
  'hist-haitian-uprising': ['romantic', 'aic-landscapes'],
  'hist-haiti-independence': ['aic-landscapes', 'aic-portraits'],
  'hist-haiti-constitution-1801': ['aic-portraits'],
  'hist-lexington-concord': ['romantic', 'aic-landscapes'],
  'hist-boston-massacre': ['aic-portraits'],

  // Spanish American independence: the continental landscape as the
  // scale of the undertaking.
  'hist-venezuela-declaration': ['aic-landscapes', 'romantic'],
  'hist-argentina-independence': ['aic-landscapes'],
  'hist-mexico-independence': ['aic-landscapes', 'aic-portraits'],
  'hist-peru-independence': ['aic-landscapes'],
  'hist-brazil-independence': ['aic-landscapes', 'aic-portraits'],

  // Industry and empire: the machines and treaties that framed the era.
  'hist-watt-patent': ['microscopy', 'geometry'],
  'hist-water-frame': ['geometry'],
  'hist-seven-years-war': ['romantic', 'aic-landscapes'],
  'hist-treaty-paris-1763': ['aic-oldmasters']
});

export function collectionsForRecord(recordId) {
  const collections = ATRIUM_RECORD_COLLECTIONS[recordId];
  return Array.isArray(collections) ? [...collections] : null;
}

/**
 * Apply a record's curated collections over a domain sensory config.
 * Returns the config unchanged when the record has no curation.
 */
export function applyRecordCollections(sensoryConfig, recordId) {
  const collections = collectionsForRecord(recordId);
  if (!collections || !sensoryConfig?.visualConfig?.interlocution) {
    return sensoryConfig;
  }

  return {
    ...sensoryConfig,
    visualConfig: {
      ...sensoryConfig.visualConfig,
      interlocution: {
        ...sensoryConfig.visualConfig.interlocution,
        sourced: collections,
        // Curated imagery accompanies the procedural signature of the
        // domain, so the family stays a deliberate blend.
        sourceFamily: 'blend',
        atriumCollections: collections
      }
    }
  };
}
