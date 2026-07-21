import { freezeManifest } from './constants.js';

/**
 * Atrium-scoped Wikimedia categories.
 *
 * The shared provider registry offers GENRES ("Old Masters",
 * "Botanical Flora"). An Atrium reading wants its SUBJECT: Plato in
 * art while reading the Divided Line, the Bastille while reading the
 * Declaration of the Rights of Man.
 *
 * These categories are Atrium content, not general app settings. They
 * are namespaced `atr-` so they can never collide with a provider id,
 * and they are deliberately NOT offered in the Visual panel's
 * Collections list — a reader browsing categories should not find
 * "Toussaint Louverture" as a generic option. They arrive only with
 * the launch that curated them.
 *
 * EVERY category below was probed live against the Commons API and
 * returned real files; the recorded `verifiedFiles` count is the
 * number seen at curation time (capped at the 50-item probe limit).
 * A category that later empties degrades exactly like any other
 * source: the cortex falls back to the rest of the pool.
 *
 * Note the Commons convention this exploits: depicted historical
 * figures live under "<Name> in art", while events and objects use
 * their own name. Container categories (Socrates, Plato) hold only
 * subcategories and would yield nothing — hence "Plato in art".
 */
export const ATRIUM_CATEGORIES = freezeManifest({
  // ── Philosophy: the figures as depicted ──
  'atr-plato-art': {
    name: 'Plato in Art',
    category: 'Category:Plato in art',
    verifiedFiles: 50,
    tags: ['philosophy', 'portrait', 'reception']
  },
  'atr-socrates-art': {
    name: 'Socrates in Art',
    category: 'Category:Socrates in art',
    verifiedFiles: 50,
    tags: ['philosophy', 'portrait', 'reception']
  },
  'atr-aristotle-art': {
    name: 'Aristotle in Art',
    category: 'Category:Aristotle in art',
    verifiedFiles: 23,
    tags: ['philosophy', 'portrait', 'reception']
  },
  'atr-aristotle': {
    name: 'Aristotle',
    category: 'Category:Aristotle',
    verifiedFiles: 50,
    tags: ['philosophy', 'manuscript', 'reception']
  },
  'atr-cicero-art': {
    name: 'Cicero in Art',
    category: 'Category:Cicero in art',
    verifiedFiles: 48,
    tags: ['philosophy', 'portrait', 'rome']
  },
  'atr-heraclitus': {
    name: 'Heraclitus',
    category: 'Category:Heraclitus',
    verifiedFiles: 50,
    tags: ['philosophy', 'portrait', 'presocratic']
  },
  'atr-pythagoras': {
    name: 'Pythagoras',
    category: 'Category:Pythagoras',
    verifiedFiles: 50,
    tags: ['philosophy', 'mathematics', 'presocratic']
  },
  'atr-empedocles': {
    name: 'Empedocles',
    category: 'Category:Empedocles',
    verifiedFiles: 21,
    tags: ['philosophy', 'presocratic']
  },
  'atr-stoicism': {
    name: 'Stoicism',
    category: 'Category:Stoicism',
    verifiedFiles: 37,
    tags: ['philosophy', 'hellenistic']
  },
  'atr-marcus-aurelius': {
    name: 'Marcus Aurelius',
    category: 'Category:Marcus Aurelius',
    verifiedFiles: 50,
    tags: ['philosophy', 'portrait', 'rome']
  },
  'atr-plotinus': {
    name: 'Plotinus',
    category: 'Category:Plotinus',
    verifiedFiles: 24,
    tags: ['philosophy', 'late-antiquity']
  },

  // ── History: the events, documents, and actors themselves ──
  'atr-french-revolution': {
    name: 'French Revolution',
    category: 'Category:French Revolution',
    verifiedFiles: 50,
    tags: ['history', 'revolution', 'print']
  },
  'atr-bastille': {
    name: 'The Bastille',
    category: 'Category:Bastille',
    verifiedFiles: 46,
    tags: ['history', 'revolution', 'architecture']
  },
  'atr-rights-of-man': {
    name: 'Declaration of the Rights of Man',
    category: 'Category:Declaration of the Rights of Man and of the Citizen',
    verifiedFiles: 30,
    tags: ['history', 'document', 'revolution']
  },
  'atr-haitian-revolution': {
    name: 'Haitian Revolution',
    category: 'Category:Haitian Revolution',
    verifiedFiles: 50,
    tags: ['history', 'revolution', 'emancipation']
  },
  'atr-louverture': {
    name: 'Toussaint Louverture',
    category: 'Category:Toussaint Louverture',
    verifiedFiles: 50,
    tags: ['history', 'portrait', 'emancipation']
  },
  'atr-us-declaration': {
    name: 'US Declaration of Independence',
    category: 'Category:United States Declaration of Independence',
    verifiedFiles: 50,
    tags: ['history', 'document', 'revolution']
  },
  'atr-thomas-paine': {
    name: 'Thomas Paine',
    category: 'Category:Thomas Paine',
    verifiedFiles: 49,
    tags: ['history', 'portrait', 'pamphlet']
  },
  'atr-rousseau': {
    name: 'Jean-Jacques Rousseau',
    category: 'Category:Jean-Jacques Rousseau',
    verifiedFiles: 50,
    tags: ['history', 'portrait', 'enlightenment']
  },
  'atr-james-watt': {
    name: 'James Watt',
    category: 'Category:James Watt',
    verifiedFiles: 50,
    tags: ['history', 'portrait', 'industry']
  }
});

/** Atrium category ids are namespaced so they never collide with providers. */
export function isAtriumCategoryId(id) {
  return typeof id === 'string' && id.startsWith('atr-');
}

export function findAtriumCategory(id) {
  return ATRIUM_CATEGORIES[id] || null;
}

/**
 * Provider-shaped view of an Atrium category, for the Wikimedia
 * provider's category lookup (same shape as WIKIMEDIA_CATEGORIES).
 */
export function atriumCategoryDefinition(id) {
  const entry = ATRIUM_CATEGORIES[id];
  if (!entry) return null;
  return { name: entry.name, category: entry.category, tags: entry.tags };
}
