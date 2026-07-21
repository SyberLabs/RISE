import { freezeManifest } from './constants.js';
import { HISTORY_CORPUS } from './history.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';

export const ATRIUM_SENSORY_CONFIGS = freezeManifest({
  philosophy: {
    wpm: 140,
    chunkMode: 'phrase',
    curve: 'flat',
    soundscape: 'aurora',
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'blend',
        frequency: 0.15,
        duration: 700,
        procedural: ['harmonograph'],
        sourced: ['aic-oldmasters'],
        harmonographClimate: 'auto',
        responsive: false
      }
    }
  },
  history: {
    wpm: 140,
    chunkMode: 'phrase',
    curve: 'flat',
    soundscape: 'faded-signal',
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'blend',
        frequency: 0.15,
        duration: 700,
        procedural: ['klee'],
        sourced: ['aic-portraits', 'aic-landscapes'],
        kleePreset: 'architectural',
        responsive: false
      }
    }
  }
});

const POINT_PASSAGES = Object.freeze({
  'ph-school-epicurean': ['pass-epicurus-gods-death'],
  'ph-school-pyrrhonism': ['pass-sextus-skeptical-way'],
  'ph-school-academic-skepticism': ['pass-cicero-academic'],
  'ph-school-milesian': ['pass-anaximander-fragment'],
  'ph-school-atomism': ['pass-democritus-atoms'],
  'ph-thinker-heraclitus': ['pass-heraclitus-logos'],
  'ph-school-eleatic': ['pass-parmenides-being'],
  'ph-tradition-pluralists': ['pass-empedocles-roots'],
  'ph-movement-sophistic': ['pass-protagoras-measure'],
  'ph-tradition-socratic': ['pass-socrates-apology'],
  'ph-thinker-plato': ['pass-plato-recollection', 'pass-plato-divided-line', 'pass-plato-cave', 'pass-plato-forms'],
  'ph-thinker-aristotle': ['pass-aristotle-substance', 'pass-aristotle-soul'],
  'ph-school-peripatetic': ['pass-aristotle-human-good'],
  'ph-tradition-middle-platonism': ['pass-plato-cosmos'],
  'ph-thinker-philo': ['pass-philo-creation'],
  'ph-thinker-plotinus': ['pass-plotinus-beauty'],
  'ph-thinker-porphyry': ['pass-porphyry-isagoge'],
  'ph-tradition-iamblichean': ['pass-iamblichus-theurgy'],
  'ph-school-athenian-neoplatonism': ['pass-proclus-propositions'],
  'ph-tradition-roman-stoa': ['pass-epictetus-control'],
  'ph-thinker-augustine': ['pass-augustine-platonic-books'],
  'ph-thinker-pseudo-dionysius': ['pass-dionysius-mystical'],
  'ph-thinker-boethius': ['pass-boethius-eternity'],
  'hist-seven-years-war': ['pass-franklin-war-finance-1766'],
  'hist-social-contract': ['pass-rousseau-association'],
  'hist-vermont-constitution': ['pass-vermont-constitution-1777'],
  'hist-articles-confederation': ['pass-articles-confederation-1777'],
  'hist-us-bill-rights': ['pass-us-bill-rights-proposal-1789'],
  'hist-watt-patent': ['pass-watt-steam-principles-1769'],
  'hist-water-frame': ['pass-arkwright-water-frame-system-1769'],
  'hist-treaty-paris-1763': ['pass-treaty-paris-1763'],
  'hist-boston-massacre': ['pass-boston-massacre-crown-evidence', 'pass-boston-massacre-defense-evidence'],
  'hist-boston-tea-party': ['pass-boston-tea-colonial-newspaper-1773', 'pass-boston-tea-leslie-letter-1773'],
  'hist-treaty-paris-1783': ['pass-treaty-paris-1783'],
  'hist-stamp-act': ['pass-stamp-act'],
  'hist-first-continental-congress': ['pass-first-continental-resolves-1774'],
  'hist-lexington-concord': ['pass-lexington-provincial-evidence-1775', 'pass-gage-lexington-report-1775'],
  'hist-continental-army': ['pass-washington-continental-orders-1775'],
  'hist-franco-american-alliance': ['pass-franco-american-alliance-1778'],
  'hist-communist-manifesto': ['pass-communist-manifesto'],
  'hist-french-abolition-1848': ['pass-french-abolition-1848'],
  'hist-common-sense': ['pass-common-sense'],
  'hist-power-loom': ['pass-cartwright-power-loom-iteration-1785'],
  'hist-us-declaration': ['pass-us-declaration'],
  'hist-us-constitution': ['pass-us-constitution'],
  'hist-federalist': ['pass-federalist-10'],
  'hist-estates-general': ['pass-sieyes-third-estate'],
  'hist-bastille': ['pass-desmoulins-lanterne'],
  'hist-womens-march': ['pass-maillard-womens-march-deposition', 'pass-assembly-womens-march-1789'],
  'hist-french-republic': ['pass-republic-constitution-1793'],
  'hist-thermidor': ['pass-thermidor-convention'],
  'hist-rights-man': ['pass-rights-man'],
  'hist-brumaire': ['pass-constitution-year-viii'],
  'hist-code-civil': ['pass-code-civil-1804'],
  'hist-napoleonic-wars': ['pass-senate-deposition-napoleon-1814'],
  'hist-congress-vienna': ['pass-congress-vienna-final-act-1815'],
  'hist-rights-woman': ['pass-rights-woman'],
  'hist-equiano-narrative': ['pass-equiano'],
  'hist-haitian-uprising': ['pass-haiti-insurgent-letter-1792'],
  'hist-sonthonax-emancipation': ['pass-sonthonax-emancipation-1793'],
  'hist-french-abolition-1794': ['pass-convention-abolition-1794'],
  'hist-haiti-constitution-1801': ['pass-haiti-constitution-1801'],
  'hist-haiti-independence': ['pass-haiti-independence-1804'],
  'hist-haiti-recognition-1825': ['pass-haiti-recognition-1825'],
  'hist-yorktown': ['pass-yorktown-capitulation-1781'],
  'hist-somerset': ['pass-somerset'],
  'hist-uk-slave-trade-act': ['pass-uk-slave-trade-act'],
  'hist-us-import-ban': ['pass-us-importation-act'],
  'hist-slavery-abolition-act': ['pass-slavery-abolition-1833'],
  'hist-british-emancipation': ['pass-commons-apprenticeship-debate-1838', 'pass-barbados-apprenticeship-termination-1838'],
  'hist-cadiz-constitution': ['pass-cadiz'],
  'hist-venezuela-declaration': ['pass-venezuela-declaration'],
  'hist-jamaica-letter': ['pass-jamaica-letter'],
  'hist-angostura': ['pass-angostura'],
  'hist-monroe-doctrine': ['pass-monroe-message'],
  'hist-stockton-darlington': ['pass-stockton-darlington-opening-1825'],
  'hist-seneca-falls': ['pass-seneca-declaration'],
  'hist-argentina-independence': ['pass-tucuman-independence-act-1816', 'pass-belgrano-government-unsettled-1816', 'pass-tucuman-order-decree-1816'],
  'hist-mexico-independence': ['pass-plan-iguala-1821', 'pass-mexico-independence-act-1821'],
  'hist-peru-independence': ['pass-peru-lima-independence-act-1821', 'pass-peru-protector-decree-1821'],
  'hist-brazil-independence': ['pass-brazil-manifesto-peoples-1822', 'pass-brazil-council-session-1822', 'pass-cachoeira-adhesion-letter-1822']
});

function buildPoint(record, domain) {
  const passageIds = POINT_PASSAGES[record.id];
  if (!passageIds) return null;
  return {
    id: `point-${record.id}`,
    domain,
    kind: 'point',
    title: record.label,
    description: domain === 'philosophy'
      ? `Enter a rights-cleared source passage associated with ${record.label}.`
      : `Enter a rights-cleared primary-source passage at ${record.dates.display}.`,
    anchorIds: [record.id],
    segments: passageIds.map((passageId, index) => ({
      passageId,
      role: index === 0 ? 'point' : 'continuation'
    })),
    openRequirements: [],
    status: 'publishable'
  };
}

export const ATRIUM_POINT_LAUNCHES = freezeManifest([
  ...PHILOSOPHY_CORPUS.nodes.map(record => buildPoint(record, 'philosophy')),
  ...HISTORY_CORPUS.events.map(record => buildPoint(record, 'history'))
].filter(Boolean));

export function findAtriumPoint(anchorId) {
  return ATRIUM_POINT_LAUNCHES.find(point => point.anchorIds.includes(anchorId)) || null;
}

export function sensoryConfigFor(domain) {
  return ATRIUM_SENSORY_CONFIGS[domain] || ATRIUM_SENSORY_CONFIGS.philosophy;
}
