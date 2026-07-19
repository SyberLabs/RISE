import { ATRIUM_CORPUS_VERSION, ATRIUM_SCHEMA_VERSION, freezeManifest } from './constants.js';
import { HISTORY_PILOT_JOURNEY_IDS } from './packs/pilot-v1/manifest.js';
import { createHistoryEventReview } from './editorial-review.js';

const publishableJourneyIds = new Set(HISTORY_PILOT_JOURNEY_IDS);

const event = (id, label, date, start, end, primaryLane, lanes, geography, summary, sourceRefs = []) => {
  const dates = {
    display: date,
    start,
    end: end ?? start,
    precision: date.includes('c.') ? 'approximate' : 'display-reviewed'
  };
  return {
    id,
    domain: 'history',
    kind: 'event',
    label,
    dates,
    primaryLane,
    lanes,
    geography,
    summary,
    sourceRefs,
    editorialReview: createHistoryEventReview({ summary, sourceRefs, dates }),
    status: 'reviewed',
    launchStatus: 'source-review'
  };
};

export const HISTORY_EVENTS = Object.freeze([
  event('hist-seven-years-war', 'Seven Years’ War', '1756–1763', 1756, 1763, 'war-empire', ['war-empire'], 'Global / Atlantic', 'A global imperial war leaves Britain with new territory, new costs, and new arguments over taxation and authority.', ['LOC']),
  event('hist-social-contract', 'The Social Contract published', '1762', 1762, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Geneva / France', 'Rousseau opens a radical inquiry into legitimate association, sovereignty, and freedom.', ['STANDARD-EBOOKS']),
  event('hist-treaty-paris-1763', 'Treaty of Paris', '10 February 1763', 1763, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Atlantic empires', 'The treaty ends the Seven Years’ War and redraws imperial possession across several continents.', ['LOC']),
  event('hist-stamp-act', 'Stamp Act', '22 March 1765', 1765, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'British Atlantic', 'Parliament’s direct tax on printed material intensifies disputes about representation and imperial sovereignty.', ['UK-PARLIAMENT']),
  event('hist-watt-patent', 'Watt’s separate-condenser patent', '1769', 1769, null, 'economic-technology', ['economic-technology'], 'Britain', 'James Watt patents a major improvement to the steam engine, part of a long transformation in power and production.', ['SCIENCE-MUSEUM']),
  event('hist-water-frame', 'Water frame patented', '1769', 1769, null, 'economic-technology', ['economic-technology'], 'Britain', 'Richard Arkwright’s water frame contributes to factory organization and mechanized cotton spinning.', ['SCIENCE-MUSEUM']),
  event('hist-boston-massacre', 'Boston Massacre', '5 March 1770', 1770, null, 'war-empire', ['war-empire', 'social-movement'], 'Massachusetts', 'The killing of five civilians becomes a contested political event represented through rival testimony and print.', ['LOC']),
  event('hist-somerset', 'Somerset judgment', '22 June 1772', 1772, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'Britain', 'The judgment constrains a claimed power to remove and sell an enslaved man from England without resolving slavery across the empire.', ['OLD-BAILEY']),
  event('hist-boston-tea-party', 'Boston Tea Party', '16 December 1773', 1773, null, 'social-movement', ['social-movement', 'war-empire'], 'Massachusetts / Britain', 'Colonists destroy East India Company tea in a theatrical escalation of resistance.', ['LOC']),
  event('hist-first-continental-congress', 'First Continental Congress', '5 September–26 October 1774', 1774, null, 'politics-constitution', ['politics-constitution'], 'British North America', 'Delegates coordinate resistance while still arguing within an imperial constitutional frame.', ['LOC-JCC']),
  event('hist-lexington-concord', 'Lexington and Concord', '19 April 1775', 1775, null, 'war-empire', ['war-empire'], 'Massachusetts', 'Armed conflict begins between provincial forces and British troops.', ['LOC']),
  event('hist-common-sense', 'Common Sense published', '10 January 1776', 1776, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'British North America', 'Thomas Paine argues for independence in a widely circulated pamphlet.', ['STANDARD-EBOOKS']),
  event('hist-us-declaration', 'Declaration of Independence', '4 July 1776', 1776, null, 'politics-constitution', ['politics-constitution', 'ideas-publication'], 'United States', 'The Continental Congress declares independence through universal claims, grievances, and an act of political separation.', ['NARA', 'LOC-JCC']),
  event('hist-vermont-constitution', 'Vermont Constitution', '8 July 1777', 1777, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'Vermont', 'The constitution limits adult slavery while retaining age qualifications and other exclusions.', ['AVALON']),
  event('hist-articles-confederation', 'Articles of Confederation take effect', '1 March 1781', 1781, null, 'politics-constitution', ['politics-constitution'], 'United States', 'The first federal frame takes effect after Maryland becomes the final state to ratify it.', ['LOC-JCC', 'NARA']),
  event('hist-yorktown', 'British surrender at Yorktown', '19 October 1781', 1781, null, 'war-empire', ['war-empire'], 'Virginia / Atlantic', 'A combined American and French victory effectively ends major fighting in the American war.', ['LOC']),
  event('hist-treaty-paris-1783', 'Treaty of Paris', '3 September 1783', 1783, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Atlantic', 'Britain recognizes United States independence while the treaty leaves other peoples and claims outside its settlement.', ['NARA']),
  event('hist-power-loom', 'Power loom patented', '1785', 1785, null, 'economic-technology', ['economic-technology'], 'Britain', 'Edmund Cartwright’s loom is one step in the uneven mechanization of weaving and factory labor.', ['SCIENCE-MUSEUM']),
  event('hist-us-constitution', 'United States Constitution signed', '17 September 1787', 1787, null, 'politics-constitution', ['politics-constitution'], 'United States', 'The Philadelphia Convention proposes a stronger federal structure whose compromises include protections for slavery.', ['NARA']),
  event('hist-federalist', 'The Federalist published', '27 October 1787–28 May 1788', 1787, 1788, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'United States', 'Hamilton, Madison, and Jay defend the proposed Constitution in a sequence of newspaper essays.', ['FOUNDERS']),
  event('hist-estates-general', 'Estates-General convenes', '5 May 1789', 1789, null, 'politics-constitution', ['politics-constitution', 'social-movement'], 'France', 'A fiscal and representational crisis opens a struggle over who constitutes the nation.', ['FRDA']),
  event('hist-bastille', 'Storming of the Bastille', '14 July 1789', 1789, null, 'social-movement', ['social-movement', 'politics-constitution'], 'France', 'A Parisian crowd seizes the fortress and its arms, creating an enduring revolutionary symbol.', ['FRDA']),
  event('hist-rights-man', 'Declaration of the Rights of Man and Citizen', '26 August 1789', 1789, null, 'politics-constitution', ['politics-constitution', 'ideas-publication'], 'France', 'The National Assembly articulates natural rights, sovereignty, law, and citizenship while leaving major exclusions unresolved.', ['FRDA', 'GALLICA']),
  event('hist-womens-march', 'Women’s March on Versailles', '5–6 October 1789', 1789, null, 'social-movement', ['social-movement', 'politics-constitution'], 'France', 'Market women and other marchers force the royal family and assembly back to Paris.', ['FRDA']),
  event('hist-equiano-narrative', 'Equiano’s Interesting Narrative', '1789', 1789, null, 'ideas-publication', ['ideas-publication', 'slavery-emancipation'], 'Britain / Atlantic', 'A first-person narrative enters abolitionist print culture and debates over slavery and commerce.', ['STANDARD-EBOOKS']),
  event('hist-haitian-uprising', 'Uprising in northern Saint-Domingue', 'August 1791', 1791, null, 'slavery-emancipation', ['slavery-emancipation', 'social-movement', 'war-empire'], 'Saint-Domingue', 'A massive uprising begins the revolutionary destruction of slavery; specific Bois Caïman narratives remain evidentially contested.', ['DUKE-HAITI']),
  event('hist-rights-woman', 'Declaration of the Rights of Woman', 'September 1791', 1791, null, 'ideas-publication', ['ideas-publication', 'social-movement'], 'France', 'Olympe de Gouges exposes the gendered limits of revolutionary universality by rewriting its declaration form.', ['GALLICA']),
  event('hist-us-bill-rights', 'United States Bill of Rights ratified', '15 December 1791', 1791, null, 'politics-constitution', ['politics-constitution'], 'United States', 'Ten amendments constrain federal power and enumerate protected liberties.', ['NARA']),
  event('hist-french-republic', 'First French Republic declared', '21 September 1792', 1792, null, 'politics-constitution', ['politics-constitution'], 'France', 'The National Convention abolishes monarchy and declares a republic.', ['FRDA']),
  event('hist-sonthonax-emancipation', 'Sonthonax emancipation proclamation', '29 August 1793', 1793, null, 'slavery-emancipation', ['slavery-emancipation', 'war-empire'], 'Saint-Domingue', 'Civil commissioner Léger-Félicité Sonthonax proclaims emancipation in the colony’s north amid war and revolution.', ['DUKE-HAITI', 'FRDA']),
  event('hist-french-abolition-1794', 'French Convention abolishes colonial slavery', '4 February 1794', 1794, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'French Atlantic', 'The Convention generalizes abolition across French colonies, a measure later reversed by Napoleon.', ['FRDA']),
  event('hist-thermidor', 'Fall of Robespierre', '27 July 1794', 1794, null, 'politics-constitution', ['politics-constitution'], 'France', 'The overthrow of Robespierre becomes a turning point in revolutionary government and political violence.', ['FRDA']),
  event('hist-brumaire', 'Coup of 18–19 Brumaire', '9–10 November 1799', 1799, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'France', 'The coup establishes the Consulate and concentrates power around Napoleon Bonaparte.', ['FRDA']),
  event('hist-haiti-constitution-1801', 'Constitution of Saint-Domingue', '8 July 1801', 1801, null, 'politics-constitution', ['politics-constitution', 'slavery-emancipation'], 'Saint-Domingue', 'The constitution abolishes slavery while imposing a centralized labor and executive order under Toussaint Louverture.', ['LOC-HAITI']),
  event('hist-haiti-independence', 'Haitian independence', '1 January 1804', 1804, null, 'politics-constitution', ['politics-constitution', 'slavery-emancipation', 'war-empire'], 'Haiti', 'Haiti declares independence after defeating the French expedition and destroying the colonial slave regime.', ['LOC-HAITI', 'DUKE-HAITI']),
  event('hist-code-civil', 'French Civil Code', '21 March 1804', 1804, null, 'politics-constitution', ['politics-constitution'], 'France / Empire', 'The code systematizes civil law while consolidating patriarchal authority and a new post-revolutionary order.', ['GALLICA']),
  event('hist-uk-slave-trade-act', 'British Slave Trade Act', '25 March 1807', 1807, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'British Empire', 'Parliament prohibits British participation in the transatlantic slave trade without abolishing colonial slavery.', ['UK-PARLIAMENT']),
  event('hist-us-import-ban', 'U.S. importation ban takes effect', '1 January 1808', 1808, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'United States / Atlantic', 'Federal law prohibits the importation of enslaved people while domestic slavery and trade continue.', ['LOC']),
  event('hist-mexican-insurgency', 'Mexican insurgency begins', '16 September 1810', 1810, null, 'social-movement', ['social-movement', 'war-empire'], 'New Spain / Mexico', 'Hidalgo’s call helps begin a mass insurgency; no authoritative verbatim transcript of the Grito survives.', ['UNAM']),
  event('hist-venezuela-declaration', 'Venezuelan Declaration of Independence', '5 July 1811', 1811, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Venezuela', 'Representatives declare independence from the Spanish monarchy amid a conflict over sovereignty and social order.', ['BROWN-LA']),
  event('hist-cadiz-constitution', 'Constitution of Cádiz', '19 March 1812', 1812, null, 'politics-constitution', ['politics-constitution'], 'Spain / Spanish Atlantic', 'A liberal imperial constitution defines national sovereignty, representation, and citizenship during war.', ['BNE']),
  event('hist-jamaica-letter', 'Bolívar writes the Jamaica Letter', '6 September 1815', 1815, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Caribbean / Spanish America', 'Writing in exile, Bolívar diagnoses colonial rule and speculates about the political futures of Spanish America.', ['BROWN-LA', 'UNAM']),
  event('hist-argentina-independence', 'Congress of Tucumán declares independence', '9 July 1816', 1816, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Río de la Plata', 'Delegates declare independence from Spain while the form and territorial scope of the new order remain unsettled.', ['ARGENTINA-ARCHIVE']),
  event('hist-angostura', 'Address to the Congress of Angostura', '15 February 1819', 1819, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Venezuela / Gran Colombia', 'Bolívar argues for a republican constitution shaped by the region’s history and his preference for a strong executive.', ['BROWN-LA']),
  event('hist-mexico-independence', 'Army of the Three Guarantees enters Mexico City', '27 September 1821', 1821, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Mexico', 'The entry marks the end of the principal independence struggle and the beginning of a contested imperial settlement.', ['UNAM']),
  event('hist-peru-independence', 'Peruvian independence proclaimed', '28 July 1821', 1821, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Peru', 'San Martín proclaims independence in Lima while the war continues in the Andes.', ['PERU-ARCHIVE']),
  event('hist-brazil-independence', 'Brazilian independence declared', '7 September 1822', 1822, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Brazil / Portugal', 'Dynastic rupture produces an independent Brazilian empire while slavery remains foundational.', ['BRAZIL-ARCHIVE']),
  event('hist-monroe-doctrine', 'Monroe Doctrine articulated', '2 December 1823', 1823, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'United States / Americas', 'Monroe’s annual message rejects new European colonization while asserting a distinct hemispheric political sphere.', ['LOC']),
  event('hist-ayacucho', 'Battle of Ayacucho', '9 December 1824', 1824, null, 'war-empire', ['war-empire'], 'Peru / Spanish America', 'The patriot victory largely ends Spanish military power on the South American mainland.', ['PERU-ARCHIVE']),
  event('hist-stockton-darlington', 'Stockton and Darlington Railway opens', '27 September 1825', 1825, null, 'economic-technology', ['economic-technology'], 'Britain', 'A public railway using steam locomotion signals a new transport infrastructure and industrial scale.', ['SCIENCE-MUSEUM']),
  event('hist-slavery-abolition-act', 'British Slavery Abolition Act', '28 August 1833', 1833, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'British Empire', 'Parliament legislates emancipation through exclusions, apprenticeship, and compensation to slaveholders.', ['UK-PARLIAMENT']),
  event('hist-british-emancipation', 'Apprenticeship ends in most British colonies', '1 August 1838', 1838, null, 'slavery-emancipation', ['slavery-emancipation', 'social-movement'], 'British Empire', 'The coerced apprenticeship system ends early in most colonies after sustained resistance and criticism.', ['UK-PARLIAMENT']),
  event('hist-communist-manifesto', 'Communist Manifesto published', 'February 1848', 1848, null, 'ideas-publication', ['ideas-publication', 'social-movement', 'economic-technology'], 'Europe / transatlantic', 'Marx and Engels interpret industrial capitalism through class conflict and revolutionary transformation.', ['STANDARD-EBOOKS']),
  event('hist-revolutions-1848', 'Revolutions of 1848', '1848', 1848, null, 'social-movement', ['social-movement', 'politics-constitution'], 'Europe', 'A cluster of uprisings makes competing demands for constitutions, nations, democracy, and social reform.', ['EUROPEANA']),
  event('hist-french-abolition-1848', 'France abolishes colonial slavery again', '27 April 1848', 1848, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'French Empire', 'The Second Republic abolishes slavery after the restoration imposed under Napoleon in 1802.', ['GALLICA']),
  event('hist-seneca-falls', 'Seneca Falls Convention', '19–20 July 1848', 1848, null, 'social-movement', ['social-movement', 'politics-constitution'], 'United States', 'The convention’s Declaration of Sentiments adapts revolutionary declaration language to demand women’s equality.', ['LOC'])
]);

const journey = (id, title, anchorIds, description, segments, estimatedMinutes, openRequirements = []) => {
  const publishable = publishableJourneyIds.has(id);
  return {
    id,
    domain: 'history',
    kind: 'journey',
    title,
    anchorIds,
    description,
    segments: segments.map(([passageId, role]) => ({ passageId, role })),
    openRequirements: publishable ? [] : openRequirements,
    estimatedMinutes,
    status: publishable ? 'publishable' : 'blocked',
    ...(publishable ? {} : {
      blockedReason: 'Rights-cleared passage payload is not yet available.'
    })
  };
};

export const HISTORY_JOURNEYS = Object.freeze([
  journey('seq-hist-empire-debt-resistance', 'Empire, Debt, Resistance', ['hist-seven-years-war', 'hist-stamp-act', 'hist-first-continental-congress', 'hist-common-sense'], 'War debt and imperial reform become a crisis of authority.', [['pass-stamp-act', 'context'], ['pass-common-sense', 'response']], 14, ['Add authenticated colonial resolutions connecting statute and pamphlet.']),
  journey('seq-hist-declaration-claim', 'Declaring the People', ['hist-us-declaration', 'hist-rights-man', 'hist-haiti-independence', 'hist-seneca-falls'], 'Four declarations expose the power and instability of universal political claims.', [['pass-us-declaration', 'proposition'], ['pass-rights-man', 'response'], ['pass-haiti-independence-1804', 'countervoice'], ['pass-seneca-declaration', 'aftermath']], 15),
  journey('seq-hist-faction-constitution', 'Designing a Republic', ['hist-us-constitution', 'hist-federalist', 'hist-cadiz-constitution', 'hist-angostura'], 'Different constitutional answers to representation, faction, and executive power.', [['pass-us-constitution', 'context'], ['pass-federalist-10', 'proposition'], ['pass-cadiz', 'response'], ['pass-angostura', 'aftermath']], 15),
  journey('seq-hist-rights-exclusions', 'Rights and Their Boundaries', ['hist-rights-man', 'hist-rights-woman', 'hist-equiano-narrative', 'hist-haiti-constitution-1801'], 'Universal language encounters gender, slavery, race, and colonial rule.', [['pass-rights-man', 'proposition'], ['pass-rights-woman', 'critique'], ['pass-equiano', 'countervoice'], ['pass-haiti-constitution-1801', 'aftermath']], 16),
  journey('seq-hist-france-1789-1794', 'Assembly, Republic, Terror', ['hist-estates-general', 'hist-bastille', 'hist-french-republic', 'hist-thermidor'], 'A political order is dismantled and repeatedly remade.', [['pass-rights-man', 'proposition']], 16, ['Add authenticated parliamentary voices and decrees for 1789–1794.', 'Add a non-state voice before sequence review.']),
  journey('seq-hist-haiti-freedom-state', 'Freedom, Labor, Sovereignty', ['hist-haitian-uprising', 'hist-sonthonax-emancipation', 'hist-haiti-constitution-1801', 'hist-haiti-independence'], 'Emancipation, war, coerced labor, and the creation of Haiti.', [['pass-haiti-constitution-1801', 'proposition'], ['pass-haiti-independence-1804', 'aftermath']], 16, ['Add authenticated counter-archive testimony.', 'Add the 1793/1794 emancipation decree from a verified edition.']),
  journey('seq-hist-abolition-law-limit', 'Abolition and Its Limits', ['hist-somerset', 'hist-equiano-narrative', 'hist-uk-slave-trade-act', 'hist-slavery-abolition-act', 'hist-french-abolition-1848'], 'Legal milestones read alongside what each measure leaves intact.', [['pass-somerset', 'context'], ['pass-equiano', 'countervoice'], ['pass-uk-slave-trade-act', 'response'], ['pass-slavery-abolition-1833', 'critique'], ['pass-french-abolition-1848', 'aftermath']], 16),
  journey('seq-hist-spanish-america', 'A Continent Imagined', ['hist-cadiz-constitution', 'hist-venezuela-declaration', 'hist-jamaica-letter', 'hist-angostura', 'hist-ayacucho'], 'Competing forms of sovereignty across the crisis of Spanish empire.', [['pass-cadiz', 'context'], ['pass-venezuela-declaration', 'response'], ['pass-jamaica-letter', 'critique'], ['pass-angostura', 'aftermath']], 16),
  journey('seq-hist-hemisphere-doctrine', 'Independence and Hemisphere', ['hist-haiti-independence', 'hist-jamaica-letter', 'hist-monroe-doctrine'], 'Contrasting claims to independence and hemispheric order.', [['pass-haiti-independence-1804', 'countervoice'], ['pass-jamaica-letter', 'proposition'], ['pass-monroe-message', 'response']], 13),
  journey('seq-hist-1848-unfinished', 'The Unfinished Revolution', ['hist-communist-manifesto', 'hist-revolutions-1848', 'hist-french-abolition-1848', 'hist-seneca-falls'], 'Industrial society, emancipation, democracy, and rights converge without resolution.', [['pass-communist-manifesto', 'proposition'], ['pass-french-abolition-1848', 'response'], ['pass-seneca-declaration', 'countervoice']], 14)
]);

export const HISTORY_RESEARCH_SOURCES = Object.freeze({
  LOC: { label: 'Library of Congress', href: 'https://www.loc.gov/' },
  'LOC-JCC': { label: 'LOC: Journals of the Continental Congress', href: 'https://www.loc.gov/item/05000059/' },
  'LOC-HAITI': { label: 'LOC: Constitutions of Haiti', href: 'https://www.loc.gov/item/78396819/' },
  NARA: { label: 'National Archives', href: 'https://www.archives.gov/' },
  FOUNDERS: { label: 'Founders Online', href: 'https://founders.archives.gov/about/' },
  FRDA: { label: 'French Revolution Digital Archive', href: 'https://frda.stanford.edu/' },
  GALLICA: { label: 'Gallica / BnF', href: 'https://gallica.bnf.fr/' },
  'DUKE-HAITI': { label: 'Duke Haiti Digital Library', href: 'https://sites.duke.edu/haitilab/english/haitian-revolution/' },
  'BROWN-LA': { label: 'Brown: Modern Latin America', href: 'https://library.brown.edu/create/modernlatinamerica/' },
  UNAM: { label: 'UNAM Open Data', href: 'https://datosabiertos.unam.mx/' },
  'STANDARD-EBOOKS': { label: 'Standard Ebooks', href: 'https://standardebooks.org/' },
  'UK-PARLIAMENT': { label: 'UK Parliament', href: 'https://www.parliament.uk/' },
  'SCIENCE-MUSEUM': { label: 'Science Museum Group', href: 'https://www.sciencemuseumgroup.org.uk/' },
  'OLD-BAILEY': { label: 'Old Bailey Online', href: 'https://www.oldbaileyonline.org/' },
  AVALON: { label: 'Avalon Project', href: 'https://avalon.law.yale.edu/' },
  BNE: { label: 'Biblioteca Nacional de España', href: 'https://www.bne.es/' },
  'ARGENTINA-ARCHIVE': { label: 'Archivo General de la Nación Argentina', href: 'https://www.argentina.gob.ar/interior/archivo-general-de-la-nacion' },
  'PERU-ARCHIVE': { label: 'Archivo General de la Nación del Perú', href: 'https://agn.gob.pe/' },
  'BRAZIL-ARCHIVE': { label: 'Arquivo Nacional do Brasil', href: 'https://www.gov.br/arquivonacional/' },
  EUROPEANA: { label: 'Europeana', href: 'https://www.europeana.eu/' }
});

export const HISTORY_CORPUS = freezeManifest({
  id: 'atrium-history-atlantic-revolutions',
  schemaVersion: ATRIUM_SCHEMA_VERSION,
  corpusVersion: ATRIUM_CORPUS_VERSION,
  label: 'Atlantic Revolutions, 1750–1850',
  status: 'draft',
  events: HISTORY_EVENTS,
  journeys: HISTORY_JOURNEYS,
  researchSources: HISTORY_RESEARCH_SOURCES
});
