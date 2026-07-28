import { freezeManifest } from './constants.js';
import { imageryPlanFor } from './imagery/assignments.js';

/**
 * Atrium-coupled collections.
 *
 * A record's collections are CONTENT, curated with the same editorial
 * care as its passages: an Atrium launch should show imagery that
 * belongs to what is being read, not a generic gallery rotation.
 *
 * Each entry names existing provider category ids — pinned Atrium works
 * (`atr-`) and Art Institute collections (`aic-`). Nothing here invents
 * a category or bypasses a provider contract — this is curation, not
 * plumbing.
 *
 * CURATION-ONLY (SOURCE-CURATION-SPEC): every id here resolves to works
 * that were CHOSEN. The keyword-searched Wikimedia categories that once
 * appeared in this file are retired; an audit found them returning
 * scratch files, topical noise, and in one case nothing at all. A
 * category that cannot promise a good image does not promise one.
 *
 * An EMPTY list is therefore a real editorial answer, not an omission:
 * the reading carries no sourced imagery and stands on its authored
 * procedural visuals. Many readings are stronger plain.
 *
 * Scope rules:
 * - Absent record → the launch keeps its domain sensory default.
 * - Present record → those categories REPLACE the domain default's
 *   `sourced` list for that launch only. The user may override
 *   everything in the orbital afterward; nothing is forced.
 * - Ids must exist in MUSEUM_CATEGORIES or the Atrium's pinned registry;
 *   a test asserts this so a renamed provider category can never leave
 *   a launch pointing at nothing.
 */
export const ATRIUM_RECORD_COLLECTIONS = freezeManifest({
  // ── Philosophy ──────────────────────────────────────────────
  // Cosmological and mathematical traditions read against the
  // diagrammatic and astronomical record.
  'ph-school-milesian': [],
  'ph-tradition-pythagorean': ['atr-pythagoras'],
  'ph-tradition-neopythagorean': [],
  'ph-school-eleatic': [],
  'ph-school-atomism': [],
  'ph-tradition-pluralists': ['atr-empedocles'],
  'ph-thinker-heraclitus': ['atr-heraclitus'],

  // Classical Athens and its successors: the human figure and the
  // Old Master tradition that carried these texts forward.
  'ph-tradition-socratic': ['atr-socrates-art', 'aic-oldmasters'],
  'ph-thinker-plato': ['atr-plato-art', 'aic-oldmasters'],
  'ph-thinker-aristotle': ['atr-aristotle-art', 'atr-aristotle'],
  'ph-school-peripatetic': [],
  'ph-movement-sophistic': ['aic-portraits'],

  // Hellenistic ethics: the cosmos as the Stoic proving ground.
  'ph-tradition-early-stoa': ['atr-stoicism', 'aic-landscapes'],
  'ph-tradition-roman-stoa': ['atr-marcus-aurelius', 'atr-stoicism', 'aic-portraits'],
  'ph-school-epicurean': ['aic-landscapes'],

  // Late antiquity: light, emanation, and the sacred image.
  'ph-thinker-plotinus': ['atr-plotinus'],
  'ph-school-athenian-neoplatonism': [],
  'ph-school-alexandrian-neoplatonism': [],
  'ph-tradition-iamblichean': [],
  'ph-thinker-porphyry': ['aic-oldmasters'],
  'ph-thinker-augustine': ['aic-oldmasters'],
  'ph-tradition-middle-platonism': [],
  'ph-thinker-philo': [],

  // ── History: Atlantic Revolutions ───────────────────────────
  // Read against portraiture (the actors and the declarations' signers)
  // and landscape (the contested ground). The Romantic sublime this
  // period was mythologized by is absent for now: it was a searched
  // Wikimedia category, and the Art Institute registry has no Romantic
  // collection to replace it with. Pinning one is future curation.
  //
  // Founding documents: the portrait tradition that framed their authors.
  'hist-us-declaration': ['atr-us-declaration', 'aic-portraits'],
  'hist-rights-man': ['atr-rights-of-man', 'atr-french-revolution'],
  'hist-rights-woman': ['aic-portraits'],
  'hist-us-bill-rights': ['aic-portraits'],
  'hist-social-contract': ['atr-rousseau', 'aic-portraits'],
  'hist-common-sense': ['atr-thomas-paine', 'aic-portraits'],

  // Insurrection and its ground.
  'hist-bastille': ['atr-bastille', 'atr-french-revolution'],
  'hist-haitian-uprising': ['atr-haitian-revolution', 'atr-louverture'],
  'hist-haiti-independence': ['atr-haitian-revolution', 'aic-landscapes'],
  'hist-haiti-constitution-1801': ['atr-louverture', 'atr-haitian-revolution'],
  'hist-lexington-concord': ['aic-landscapes'],
  'hist-boston-massacre': ['aic-portraits'],

  // Spanish American independence: the continental landscape as the
  // scale of the undertaking.
  'hist-venezuela-declaration': ['aic-landscapes'],
  'hist-argentina-independence': ['aic-landscapes'],
  'hist-mexico-independence': ['aic-landscapes', 'aic-portraits'],
  'hist-peru-independence': ['aic-landscapes'],
  'hist-brazil-independence': ['aic-landscapes', 'aic-portraits'],

  // Industry and empire: the machines and treaties that framed the era.
  'hist-watt-patent': ['atr-james-watt'],
  'hist-water-frame': [],
  'hist-seven-years-war': ['aic-landscapes'],
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
