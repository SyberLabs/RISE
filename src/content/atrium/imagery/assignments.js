/**
 * Atrium imagery assignments — which surface serves which reading.
 *
 * The classification pass (ATRIUM-IMAGERY-CLASSIFICATION.md) found that
 * the corpus's 81 sequences are not one problem but three, and that
 * treating them all as curation is why the Wikimedia categories failed:
 *
 *   DEPICTED   — a famous depiction exists. Pinned museum works.
 *   MECHANISM  — the passage is about how a thing works. Blueprint.
 *   LIBERATION — a colonial relation. The Freedom field.
 *   CONCEPTUAL — no canonical imagery exists at all. Procedural only,
 *                which is CORRECT here rather than a fallback: Stoicism
 *                is an argument, not a scene, and asking a keyword
 *                search for it returns a Balinese toddler.
 *
 * A record absent from every table below resolves to procedural, which
 * is the honest answer for most of the corpus.
 */

/**
 * MECHANISM — the blueprint plate.
 *
 * These passages describe the separate condenser, the spinning frame,
 * the power loom, the railway. Open collections hold portraits of the
 * inventors; a picture of a man is not a picture of his machine.
 */
export const MECHANISM_RECORDS = Object.freeze({
    'hist-watt-patent': { mechanism: 'beam-engine', climate: 'cyanotype' },
    'hist-water-frame': { mechanism: 'gear-train', climate: 'sepia' },
    'hist-power-loom': { mechanism: 'linkage', climate: 'graphite' },
    'hist-stockton-darlington': { mechanism: 'beam-engine', climate: 'verdigris' }
});

/**
 * LIBERATION — the Freedom field.
 *
 * The imperial wash stripped back to the freed flag beneath. These are
 * the readings museum collections serve worst, because the collections
 * of this period were assembled by and for the colonizing powers.
 */
export const LIBERATION_RECORDS = Object.freeze({
    'hist-haitian-uprising': 'haiti-france',
    'hist-sonthonax-emancipation': 'haiti-france',
    'hist-haiti-constitution-1801': 'haiti-france',
    'hist-haiti-independence': 'haiti-france',
    'hist-haiti-recognition-1825': 'haiti-france',
    'hist-french-abolition-1794': 'abolition-france',
    'hist-french-abolition-1848': 'abolition-france',
    'hist-uk-slave-trade-act': 'abolition-britain',
    'hist-slavery-abolition-act': 'abolition-britain',
    'hist-british-emancipation': 'abolition-britain',
    'hist-somerset': 'abolition-britain',
    'hist-venezuela-declaration': 'venezuela-spain',
    'hist-angostura': 'venezuela-spain',
    'hist-jamaica-letter': 'venezuela-spain',
    'hist-peru-independence': 'peru-spain',
    'hist-argentina-independence': 'argentina-spain',
    'hist-brazil-independence': 'brazil-portugal',
    'hist-us-declaration': 'usa-britain'
});

/**
 * DEPICTED — pinned museum works, by the collection that serves them.
 * Only records whose collection actually exists appear here; the rest
 * keep their current imagery until curated.
 */
export const PINNED_RECORDS = Object.freeze({
    'ph-thinker-plato': ['atr-plato'],
    'ph-tradition-socratic': ['atr-socrates'],
    'ph-thinker-aristotle': ['atr-aristotle'],
    'ph-tradition-roman-stoa': ['atr-stoicism', 'atr-marcus-aurelius'],
    'ph-tradition-early-stoa': ['atr-stoicism'],
    'hist-bastille': ['atr-bastille', 'atr-french-revolution'],
    'hist-french-republic': ['atr-french-revolution'],
    'hist-estates-general': ['atr-french-revolution'],
    'hist-rights-man': ['atr-french-revolution'],
    'hist-social-contract': ['atr-rousseau']
});

/**
 * CONCEPTUAL — no canonical imagery exists, so none is requested.
 *
 * These readings previously asked for keyword pools ("geometry" for the
 * Eleatics, "sacred" for Iamblichus) which is the same fabrication the
 * audit removed: a pool of loosely-tagged files standing in for a
 * subject that was never depicted. The authored procedural engine is
 * the honest accompaniment, so these records clear their sourced
 * imagery rather than inheriting the legacy table.
 *
 * This list is explicit rather than implicit — "no assignment" must
 * never silently mean "use the old system", because that hides an
 * incomplete migration behind a working screen.
 */
export const CONCEPTUAL_RECORDS = Object.freeze(new Set([
    'ph-school-milesian',
    'ph-tradition-pythagorean',
    'ph-tradition-neopythagorean',
    'ph-school-eleatic',
    'ph-school-atomism',
    'ph-tradition-pluralists',
    'ph-thinker-heraclitus',
    'ph-school-peripatetic',
    'ph-movement-sophistic',
    'ph-school-epicurean',
    'ph-thinker-plotinus',
    'ph-school-athenian-neoplatonism',
    'ph-school-alexandrian-neoplatonism',
    'ph-tradition-iamblichean',
    'ph-thinker-porphyry',
    'ph-thinker-augustine',
    'ph-tradition-middle-platonism',
    'ph-thinker-philo'
]));

/**
 * DEPICTED but NOT YET CURATED. Real depictions exist — Revere's
 * engraving of the Boston Massacre, the Seneca Falls portraits — they
 * simply are not pinned yet, and neither the Met nor Cleveland covers
 * them well (see ATRIUM-IMAGERY-CLASSIFICATION.md).
 *
 * These keep their legacy categories deliberately, as a marked bridge
 * rather than an oversight. Removing the entry is what promotes a
 * record to pinned works.
 */
export const AWAITING_CURATION = Object.freeze(new Set([
    'hist-rights-woman',
    'hist-us-bill-rights',
    'hist-common-sense',
    'hist-lexington-concord',
    'hist-boston-massacre',
    'hist-mexico-independence',
    'hist-seven-years-war',
    'hist-treaty-paris-1763'
]));

export function isConceptual(recordId) {
    return CONCEPTUAL_RECORDS.has(recordId);
}

export function awaitsCuration(recordId) {
    return AWAITING_CURATION.has(recordId);
}

export function mechanismFor(recordId) {
    return MECHANISM_RECORDS[recordId] || null;
}

export function liberationFor(recordId) {
    return LIBERATION_RECORDS[recordId] || null;
}

export function pinnedFor(recordId) {
    const ids = PINNED_RECORDS[recordId];
    return Array.isArray(ids) ? [...ids] : null;
}

/**
 * The single question the handoff asks: what should accompany this
 * reading? Returns a descriptor, or null for "procedural, as authored".
 */
export function imageryPlanFor(recordId) {
    const mechanism = mechanismFor(recordId);
    if (mechanism) return { kind: 'mechanism', ...mechanism };

    const relation = liberationFor(recordId);
    if (relation) return { kind: 'liberation', relation };

    const collections = pinnedFor(recordId);
    if (collections) return { kind: 'pinned', collections };

    if (isConceptual(recordId)) return { kind: 'conceptual' };
    if (awaitsCuration(recordId)) return { kind: 'legacy' };

    return null;
}
