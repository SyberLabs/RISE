import { freezeManifest } from './constants.js';
import { imageryPlanFor } from './imagery/assignments.js';

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
  'ph-tradition-pythagorean': ['atr-pythagoras', 'geometry', 'fractals'],
  'ph-tradition-neopythagorean': ['geometry', 'sacred'],
  'ph-school-eleatic': ['geometry'],
  'ph-school-atomism': ['microscopy', 'geometry'],
  'ph-tradition-pluralists': ['atr-empedocles', 'botany', 'microscopy'],
  'ph-thinker-heraclitus': ['atr-heraclitus', 'solar', 'astronomy'],

  // Classical Athens and its successors: the human figure and the
  // Old Master tradition that carried these texts forward.
  'ph-tradition-socratic': ['atr-socrates-art', 'aic-oldmasters'],
  'ph-thinker-plato': ['atr-plato-art', 'aic-oldmasters', 'geometry'],
  'ph-thinker-aristotle': ['atr-aristotle-art', 'atr-aristotle', 'anatomy', 'botany'],
  'ph-school-peripatetic': ['anatomy', 'botany'],
  'ph-movement-sophistic': ['aic-portraits'],

  // Hellenistic ethics: the cosmos as the Stoic proving ground.
  'ph-tradition-early-stoa': ['atr-stoicism', 'astronomy', 'aic-landscapes'],
  'ph-tradition-roman-stoa': ['atr-marcus-aurelius', 'atr-stoicism', 'aic-portraits'],
  'ph-school-epicurean': ['botany', 'aic-landscapes'],

  // Late antiquity: light, emanation, and the sacred image.
  'ph-thinker-plotinus': ['atr-plotinus', 'sacred', 'solar'],
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
  'hist-us-declaration': ['atr-us-declaration', 'aic-portraits'],
  'hist-rights-man': ['atr-rights-of-man', 'atr-french-revolution'],
  'hist-rights-woman': ['aic-portraits'],
  'hist-us-bill-rights': ['aic-portraits'],
  'hist-social-contract': ['atr-rousseau', 'aic-portraits'],
  'hist-common-sense': ['atr-thomas-paine', 'aic-portraits'],

  // Insurrection and its ground.
  'hist-bastille': ['atr-bastille', 'atr-french-revolution', 'romantic'],
  'hist-haitian-uprising': ['atr-haitian-revolution', 'atr-louverture'],
  'hist-haiti-independence': ['atr-haitian-revolution', 'aic-landscapes'],
  'hist-haiti-constitution-1801': ['atr-louverture', 'atr-haitian-revolution'],
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
  'hist-watt-patent': ['atr-james-watt', 'geometry'],
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
  const interlocution = sensoryConfig?.visualConfig?.interlocution;
  if (!interlocution) return sensoryConfig;

  // The classification pass established that these readings are three
  // different problems (ATRIUM-IMAGERY-CLASSIFICATION.md). A mechanism
  // wants a drafting plate, a liberation wants the Freedom field, and
  // only a genuinely depicted subject wants pinned museum works.
  const plan = imageryPlanFor(recordId);

  if (plan?.kind === 'mechanism') {
    // Blueprint is Atrium-exclusive and self-sufficient: it needs no
    // sourced imagery at all, so the keyword categories drop entirely.
    return {
      ...sensoryConfig,
      visualConfig: {
        ...sensoryConfig.visualConfig,
        interlocution: {
          ...interlocution,
          sourceFamily: 'procedural',
          procedural: ['blueprint'],
          sourced: [],
          // The plate carries no sourced imagery, but it IS curation —
          // the reader should still see that these visuals were chosen
          // for this passage rather than left to chance.
          atriumCollections: [`blueprint:${plan.mechanism}`],
          blueprintClimate: plan.climate,
          blueprintMechanism: plan.mechanism
        }
      }
    };
  }

  if (plan?.kind === 'liberation') {
    return {
      ...sensoryConfig,
      visualConfig: {
        ...sensoryConfig.visualConfig,
        interlocution: {
          ...interlocution,
          sourceFamily: 'procedural',
          procedural: ['freedom'],
          sourced: [],
          atriumCollections: [`freedom:${plan.relation}`],
          freedomRelation: plan.relation
        }
      }
    };
  }

  if (plan?.kind === 'conceptual') {
    // No canonical imagery exists for this subject, so none is asked
    // for. The authored procedural engine stands alone — which is the
    // honest answer, not a degraded one.
    return {
      ...sensoryConfig,
      visualConfig: {
        ...sensoryConfig.visualConfig,
        interlocution: {
          ...interlocution,
          sourceFamily: 'procedural',
          sourced: [],
          atriumCollections: undefined
        }
      }
    };
  }

  // Pinned museum works take precedence over the keyword categories
  // they replace. Legacy categories survive ONLY for records explicitly
  // marked as awaiting curation (assignments.js AWAITING_CURATION), so
  // an unmigrated record is visible as such rather than hidden behind a
  // working screen.
  const collections = plan?.kind === 'pinned'
    ? plan.collections
    : plan?.kind === 'legacy'
      ? collectionsForRecord(recordId)
      : null;
  if (!collections) return sensoryConfig;

  return {
    ...sensoryConfig,
    visualConfig: {
      ...sensoryConfig.visualConfig,
      interlocution: {
        ...interlocution,
        sourced: collections,
        // Curated imagery accompanies the procedural signature of the
        // domain, so the family stays a deliberate blend.
        sourceFamily: 'blend',
        atriumCollections: collections
      }
    }
  };
}
