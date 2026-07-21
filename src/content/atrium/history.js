import { ATRIUM_CORPUS_VERSION, ATRIUM_SCHEMA_VERSION, freezeManifest } from './constants.js';
import { createCompletionPolicy } from './completion-policy.js';
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
    launchStatus: 'source-review',
    completion: createCompletionPolicy(id)
  };
};

export const HISTORY_EVENTS = Object.freeze([
  event('hist-seven-years-war', 'Seven Years’ War', '1756–1763', 1756, 1763, 'war-empire', ['war-empire'], 'Global / Atlantic', 'A global imperial war leaves Britain with new territory, new costs, and new arguments over taxation and authority.', ['LOC']),
  event('hist-social-contract', 'The Social Contract published', '1762', 1762, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Geneva / France', 'Rousseau opens a radical inquiry into legitimate association, sovereignty, and freedom.', ['STANDARD-EBOOKS']),
  event('hist-treaty-paris-1763', 'Treaty of Paris', '10 February 1763', 1763, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Atlantic empires', 'The treaty ends the Seven Years’ War and redraws imperial possession across several continents.', ['LOC']),
  event('hist-stamp-act', 'Stamp Act', '22 March 1765', 1765, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'British Atlantic', 'Parliament’s direct tax on printed material intensifies disputes about representation and imperial sovereignty.', ['UK-PARLIAMENT']),
  event('hist-watt-patent', 'Watt’s steam-engine patent', '1769', 1769, null, 'economic-technology', ['economic-technology'], 'Britain', 'Watt’s specification joins cylinder heat, a separate condenser, air removal, expansive steam, and sealing methods in a broad claim for reducing fuel consumption.', ['WATT-PATENT', 'SCIENCE-MUSEUM']),
  event('hist-water-frame', 'Arkwright’s spinning-frame patent', '1769', 1769, null, 'economic-technology', ['economic-technology'], 'Britain', 'Arkwright’s patented arrangement combines differential rollers, spindles, flyers, transmission, and drive; its move from horse to water power multiplies spindles and helps organize the mill as a production system.', ['ARKWRIGHT-PATENT', 'SCIENCE-MUSEUM']),
  event('hist-boston-massacre', 'Boston Massacre', '5 March 1770', 1770, null, 'war-empire', ['war-empire', 'social-movement'], 'Massachusetts', 'The killing of five civilians becomes a contested political event represented through rival testimony and print.', ['LOC']),
  event('hist-somerset', 'Somerset judgment', '22 June 1772', 1772, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'Britain', 'The judgment constrains a claimed power to remove and sell an enslaved man from England without resolving slavery across the empire.', ['OLD-BAILEY']),
  event('hist-boston-tea-party', 'Boston Tea Party', '16 December 1773', 1773, null, 'social-movement', ['social-movement', 'war-empire'], 'Massachusetts / Britain', 'Colonists destroy East India Company tea in a theatrical escalation of resistance.', ['LOC']),
  event('hist-first-continental-congress', 'First Continental Congress', '5 September–26 October 1774', 1774, null, 'politics-constitution', ['politics-constitution'], 'British North America', 'Delegates coordinate resistance while still arguing within an imperial constitutional frame.', ['LOC-JCC']),
  event('hist-lexington-concord', 'Lexington and Concord', '19 April 1775', 1775, null, 'war-empire', ['war-empire'], 'Massachusetts', 'A British expedition to seize military stores meets an alarm network and armed provincial resistance; rival official accounts immediately contest who began the firing.', ['LOC']),
  event('hist-continental-army', 'Continental Army organized', '14 June–4 July 1775', 1775, null, 'war-empire', ['war-empire', 'politics-constitution'], 'British North America', 'Congress takes provincial forces into Continental service while Washington’s first Cambridge orders turn political union into command, supply, discipline, health, and intelligence systems.', ['FOUNDERS', 'LOC']),
  event('hist-common-sense', 'Common Sense published', '10 January 1776', 1776, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'British North America', 'Thomas Paine argues for independence in a widely circulated pamphlet.', ['STANDARD-EBOOKS']),
  event('hist-us-declaration', 'Declaration of Independence', '4 July 1776', 1776, null, 'politics-constitution', ['politics-constitution', 'ideas-publication'], 'United States', 'The Continental Congress declares independence through universal claims, grievances, and an act of political separation.', ['NARA', 'LOC-JCC']),
  event('hist-vermont-constitution', 'Vermont Constitution', '8 July 1777', 1777, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'Vermont', 'The constitution limits adult slavery while retaining age qualifications and other exclusions.', ['AVALON']),
  event('hist-franco-american-alliance', 'Franco-American alliance', '6 February 1778', 1778, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Paris / Atlantic', 'France and the United States bind military effort, diplomatic consent, and American independence together while situating the war inside a wider imperial conflict.', ['FOUNDERS', 'LOC']),
  event('hist-articles-confederation', 'Articles of Confederation take effect', '1 March 1781', 1781, null, 'politics-constitution', ['politics-constitution'], 'United States', 'The first federal frame takes effect after Maryland becomes the final state to ratify it.', ['LOC-JCC', 'NARA']),
  event('hist-yorktown', 'British surrender at Yorktown', '19 October 1781', 1781, null, 'war-empire', ['war-empire'], 'Virginia / Atlantic', 'A combined American and French land-and-sea victory produces a negotiated capitulation that ends one major army’s campaign but not yet the war or the diplomatic settlement.', ['FOUNDERS', 'LOC']),
  event('hist-treaty-paris-1783', 'Treaty of Paris', '3 September 1783', 1783, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Atlantic', 'Britain recognizes United States independence while the treaty leaves other peoples and claims outside its settlement.', ['NARA']),
  event('hist-power-loom', 'Cartwright’s first power-loom patent', '1785', 1785, null, 'economic-technology', ['economic-technology'], 'Britain', 'Cartwright’s crude vertical loom proves neither a finished machine nor an isolated breakthrough: its failures prompt a substantially different second specification and a longer program of mechanizing weaving.', ['MARSDEN-WEAVING', 'SCIENCE-MUSEUM']),
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
  event('hist-napoleonic-wars', 'Napoleonic Wars and imperial collapse', '1803–1815', 1803, 1815, 'war-empire', ['war-empire', 'politics-constitution'], 'Europe / Atlantic', 'Successive coalitions mobilize states and armies against the Napoleonic empire; at the regime’s collapse, the French Senate indicts war, taxation, censorship, and concentrated executive power.', ['LOC-ANDERSON']),
  event('hist-uk-slave-trade-act', 'British Slave Trade Act', '25 March 1807', 1807, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'British Empire', 'Parliament prohibits British participation in the transatlantic slave trade without abolishing colonial slavery.', ['UK-PARLIAMENT']),
  event('hist-us-import-ban', 'U.S. importation ban takes effect', '1 January 1808', 1808, null, 'slavery-emancipation', ['slavery-emancipation', 'politics-constitution'], 'United States / Atlantic', 'Federal law prohibits the importation of enslaved people while domestic slavery and trade continue.', ['LOC']),
  event('hist-mexican-insurgency', 'Mexican insurgency begins', '16 September 1810', 1810, null, 'social-movement', ['social-movement', 'war-empire'], 'New Spain / Mexico', 'Hidalgo’s call helps begin a mass insurgency; no authoritative verbatim transcript of the Grito survives.', ['UNAM']),
  event('hist-venezuela-declaration', 'Venezuelan Declaration of Independence', '5 July 1811', 1811, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Venezuela', 'Representatives declare independence from the Spanish monarchy amid a conflict over sovereignty and social order.', ['BROWN-LA']),
  event('hist-cadiz-constitution', 'Constitution of Cádiz', '19 March 1812', 1812, null, 'politics-constitution', ['politics-constitution'], 'Spain / Spanish Atlantic', 'A liberal imperial constitution defines national sovereignty, representation, and citizenship during war.', ['BNE']),
  event('hist-congress-vienna', 'Final Act of the Congress of Vienna', '9 June 1815', 1815, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Europe', 'The powers consolidate territorial, dynastic, federal, and navigational settlements after the revolutionary and Napoleonic wars.', ['WIENBIBLIOTHEK']),
  event('hist-jamaica-letter', 'Bolívar writes the Jamaica Letter', '6 September 1815', 1815, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Caribbean / Spanish America', 'Writing in exile, Bolívar diagnoses colonial rule and speculates about the political futures of Spanish America.', ['BROWN-LA', 'UNAM']),
  event('hist-argentina-independence', 'Congress of Tucumán declares independence', '9 July 1816', 1816, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Río de la Plata', 'Delegates declare independence from Spain while the form and territorial scope of the new order remain unsettled.', ['ARGENTINA-ARCHIVE']),
  event('hist-angostura', 'Address to the Congress of Angostura', '15 February 1819', 1819, null, 'ideas-publication', ['ideas-publication', 'politics-constitution'], 'Venezuela / Gran Colombia', 'Bolívar argues for a republican constitution shaped by the region’s history and his preference for a strong executive.', ['BROWN-LA']),
  event('hist-mexico-independence', 'Army of the Three Guarantees enters Mexico City', '27 September 1821', 1821, null, 'war-empire', ['war-empire', 'politics-constitution'], 'Mexico', 'The entry marks the end of the principal independence struggle and the beginning of a contested imperial settlement.', ['UNAM']),
  event('hist-peru-independence', 'Peruvian independence proclaimed', '28 July 1821', 1821, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Peru', 'San Martín proclaims independence in Lima while the war continues in the Andes.', ['PERU-ARCHIVE']),
  event('hist-brazil-independence', 'Brazilian independence declared', '7 September 1822', 1822, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'Brazil / Portugal', 'Dynastic rupture produces an independent Brazilian empire while slavery remains foundational.', ['BRAZIL-ARCHIVE']),
  event('hist-monroe-doctrine', 'Monroe Doctrine articulated', '2 December 1823', 1823, null, 'politics-constitution', ['politics-constitution', 'war-empire'], 'United States / Americas', 'Monroe’s annual message rejects new European colonization while asserting a distinct hemispheric political sphere.', ['LOC']),
  event('hist-ayacucho', 'Battle of Ayacucho', '9 December 1824', 1824, null, 'war-empire', ['war-empire'], 'Peru / Spanish America', 'The patriot victory largely ends Spanish military power on the South American mainland.', ['PERU-ARCHIVE']),
  event('hist-haiti-recognition-1825', 'France recognizes Haitian independence under indemnity', '17 April–11 July 1825', 1825, null, 'war-empire', ['war-empire', 'politics-constitution', 'slavery-emancipation'], 'Haiti / France', 'Charles X conditions formal recognition on preferential tariffs and a 150-million-franc indemnity; Haiti’s government accepts while distinguishing its pre-existing political independence from its new international legal recognition.', ['ARD-HISTORY', 'FME-HAITI']),
  event('hist-stockton-darlington', 'Stockton and Darlington Railway opens', '27 September 1825', 1825, null, 'economic-technology', ['economic-technology'], 'Britain', 'The public railway opens as a mixed freight-and-passenger system using fixed steam engines, rope haulage, a locomotive, horses, company track, and port-to-coalfield organization.', ['GUARDIAN-ARCHIVE', 'SCIENCE-MUSEUM']),
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
  journey('seq-hist-empire-debt-resistance', 'War, Debt, and the Fiscal State', ['hist-seven-years-war', 'hist-treaty-paris-1763', 'hist-stamp-act', 'hist-first-continental-congress', 'hist-common-sense'], 'Colonial war finance, imperial territorial settlement, parliamentary revenue, intercolonial constitutional resistance, and political separation form one contested fiscal-state sequence.', [['pass-franklin-war-finance-1766', 'context'], ['pass-treaty-paris-1763', 'transmission'], ['pass-stamp-act', 'proposition'], ['pass-first-continental-resolves-1774', 'response'], ['pass-common-sense', 'aftermath']], 18),
  journey('seq-hist-war-independence', 'War for Independence', ['hist-lexington-concord', 'hist-continental-army', 'hist-franco-american-alliance', 'hist-yorktown', 'hist-treaty-paris-1783'], 'Competing accounts of the opening fire, Continental military organization, international alliance, combined surrender, and diplomatic recognition distinguish declaring independence from sustaining it through war and peace.', [['pass-lexington-provincial-evidence-1775', 'context'], ['pass-gage-lexington-report-1775', 'countervoice'], ['pass-washington-continental-orders-1775', 'transmission'], ['pass-franco-american-alliance-1778', 'proposition'], ['pass-yorktown-capitulation-1781', 'response'], ['pass-treaty-paris-1783', 'aftermath']], 18),
  journey('seq-hist-declaration-claim', 'Declaring the People', ['hist-us-declaration', 'hist-rights-man', 'hist-haiti-independence', 'hist-seneca-falls'], 'Four declarations expose the power and instability of universal political claims.', [['pass-us-declaration', 'proposition'], ['pass-rights-man', 'response'], ['pass-haiti-independence-1804', 'countervoice'], ['pass-seneca-declaration', 'aftermath']], 15),
  journey('seq-hist-faction-constitution', 'Designing a Republic', ['hist-us-constitution', 'hist-federalist', 'hist-cadiz-constitution', 'hist-angostura'], 'Different constitutional answers to representation, faction, and executive power.', [['pass-us-constitution', 'context'], ['pass-federalist-10', 'proposition'], ['pass-cadiz', 'response'], ['pass-angostura', 'aftermath']], 15),
  journey('seq-hist-association-confederation-amendment', 'Association, Confederation, Amendment', ['hist-social-contract', 'hist-vermont-constitution', 'hist-articles-confederation', 'hist-us-bill-rights'], 'Four constitutional positions ask how free persons become a political body, how states retain sovereignty while joining a union, and how declared rights and amendment constrain the resulting governments.', [['pass-rousseau-association', 'proposition'], ['pass-vermont-constitution-1777', 'response'], ['pass-articles-confederation-1777', 'transmission'], ['pass-us-bill-rights-proposal-1789', 'aftermath']], 18),
  journey('seq-hist-crowd-testimony-publicity', 'Crowd, Testimony, Publicity', ['hist-boston-massacre', 'hist-boston-tea-party', 'hist-womens-march'], 'Crowd action becomes public history through adversarial testimony, partisan newspaper narration, military intelligence, and institutional records that preserve some voices while subordinating others.', [['pass-boston-massacre-crown-evidence', 'proposition'], ['pass-boston-massacre-defense-evidence', 'countervoice'], ['pass-boston-tea-colonial-newspaper-1773', 'transmission'], ['pass-boston-tea-leslie-letter-1773', 'response'], ['pass-maillard-womens-march-deposition', 'countervoice'], ['pass-assembly-womens-march-1789', 'aftermath']], 12),
  journey('seq-hist-rights-exclusions', 'Rights and Their Boundaries', ['hist-rights-man', 'hist-rights-woman', 'hist-equiano-narrative', 'hist-haiti-constitution-1801'], 'Universal language encounters gender, slavery, race, and colonial rule.', [['pass-rights-man', 'proposition'], ['pass-rights-woman', 'critique'], ['pass-equiano', 'countervoice'], ['pass-haiti-constitution-1801', 'aftermath']], 16),
  journey('seq-hist-france-1789-1794', 'Assembly, Republic, Terror', ['hist-estates-general', 'hist-bastille', 'hist-french-republic', 'hist-thermidor'], 'Political nation, popular rupture, republican sovereignty, revolutionary government, and Thermidor confront one another in their own words.', [['pass-sieyes-third-estate', 'context'], ['pass-desmoulins-lanterne', 'countervoice'], ['pass-republic-constitution-1793', 'proposition'], ['pass-robespierre-virtue-terror', 'response'], ['pass-thermidor-convention', 'aftermath']], 18),
  journey('seq-hist-revolution-settlement-1789-1815', 'Revolution and Settlement, 1789–1815', ['hist-rights-man', 'hist-brumaire', 'hist-code-civil', 'hist-napoleonic-wars', 'hist-congress-vienna'], 'Revolutionary rights, consular executive power, civil codification, wartime imperial collapse, and diplomatic reconstruction test which transformations survived 1789.', [['pass-rights-man', 'proposition'], ['pass-constitution-year-viii', 'response'], ['pass-code-civil-1804', 'transmission'], ['pass-senate-deposition-napoleon-1814', 'critique'], ['pass-congress-vienna-final-act-1815', 'aftermath']], 18),
  journey('seq-hist-haiti-freedom-state', 'Freedom, Labor, Sovereignty', ['hist-haitian-uprising', 'hist-sonthonax-emancipation', 'hist-french-abolition-1794', 'hist-haiti-constitution-1801', 'hist-haiti-independence'], 'Insurgent claims, colonial emancipation, metropolitan abolition, labor discipline, and independence test what freedom could mean.', [['pass-haiti-insurgent-letter-1792', 'countervoice'], ['pass-sonthonax-emancipation-1793', 'response'], ['pass-convention-abolition-1794', 'transmission'], ['pass-haiti-constitution-1801', 'critique'], ['pass-haiti-independence-1804', 'aftermath']], 18),
  journey('seq-hist-abolition-law-limit', 'Abolition and Its Limits', ['hist-somerset', 'hist-equiano-narrative', 'hist-uk-slave-trade-act', 'hist-slavery-abolition-act', 'hist-british-emancipation', 'hist-french-abolition-1848'], 'Testimony, trade prohibition, compensated apprenticeship, parliamentary conflict, and colonial termination distinguish successive legal thresholds from freedom accomplished in a single act.', [['pass-equiano', 'countervoice'], ['pass-uk-slave-trade-act', 'response'], ['pass-slavery-abolition-1833', 'critique'], ['pass-commons-apprenticeship-debate-1838', 'response'], ['pass-barbados-apprenticeship-termination-1838', 'aftermath']], 18),
  journey('seq-hist-spanish-america', 'A Continent Imagined', ['hist-cadiz-constitution', 'hist-venezuela-declaration', 'hist-jamaica-letter', 'hist-angostura', 'hist-ayacucho'], 'Competing forms of sovereignty across the crisis of Spanish empire.', [['pass-cadiz', 'context'], ['pass-venezuela-declaration', 'response'], ['pass-jamaica-letter', 'critique'], ['pass-angostura', 'aftermath']], 16),
  journey('seq-hist-hemisphere-doctrine', 'Independence and Hemisphere', ['hist-haiti-independence', 'hist-jamaica-letter', 'hist-monroe-doctrine'], 'Contrasting claims to independence and hemispheric order.', [['pass-haiti-independence-1804', 'countervoice'], ['pass-jamaica-letter', 'proposition'], ['pass-monroe-message', 'response']], 13),
  journey('seq-hist-treaties-atlantic-order', 'Treaties and the Atlantic Order', ['hist-treaty-paris-1763', 'hist-treaty-paris-1783', 'hist-haiti-independence', 'hist-jamaica-letter', 'hist-monroe-doctrine', 'hist-haiti-recognition-1825'], 'Imperial cession, treaty recognition, Spanish American self-definition, hemispheric doctrine, and Haiti’s conditional recognition reveal who could enter the Atlantic order—and on what terms.', [['pass-treaty-paris-1763', 'context'], ['pass-treaty-paris-1783', 'proposition'], ['pass-jamaica-letter', 'critique'], ['pass-monroe-message', 'response'], ['pass-haiti-recognition-1825', 'aftermath']], 18),
  journey('seq-hist-machines-patents-production', 'Machines, Patents, and Production', ['hist-watt-patent', 'hist-water-frame', 'hist-power-loom', 'hist-stockton-darlington'], 'Efficiency claims, coordinated mechanisms, iterative failure, motive power, capital organization, and transport infrastructure reveal industrialization as a linked production system rather than a procession of heroic inventors.', [['pass-watt-steam-principles-1769', 'context'], ['pass-arkwright-water-frame-system-1769', 'transmission'], ['pass-cartwright-power-loom-iteration-1785', 'critique'], ['pass-stockton-darlington-opening-1825', 'aftermath']], 15),
  journey('seq-hist-independence-many-models', 'Independence without a Single Model', ['hist-argentina-independence', 'hist-mexico-independence', 'hist-peru-independence', 'hist-brazil-independence'], 'Congressional declaration without a settled form, a monarchical military compact, a capital act followed by provisional war government, and council action joined to provincial adhesion refuse a single retrospective script for independence.', [['pass-tucuman-independence-act-1816', 'context'], ['pass-plan-iguala-1821', 'proposition'], ['pass-mexico-independence-act-1821', 'response'], ['pass-peru-lima-independence-act-1821', 'proposition'], ['pass-peru-protector-decree-1821', 'critique'], ['pass-brazil-council-session-1822', 'transmission'], ['pass-cachoeira-adhesion-letter-1822', 'aftermath']], 17),
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
  'WATT-PATENT': { label: 'British Patent No. 913 official reprint', href: 'https://commons.wikimedia.org/wiki/File:James_Watt_Patent_1769_No_913.pdf' },
  'ARKWRIGHT-PATENT': { label: 'Derbyshire Record Office: Arkwright roller-spinning patent', href: 'https://artsandculture.google.com/asset/richard-arkwright-s-roller-spinning-patent-richard-arkwright/JQEM1h62uI09kQ?hl=en' },
  'MARSDEN-WEAVING': { label: 'University of Arizona: Marsden, Cotton Weaving', href: 'https://www2.cs.arizona.edu/patterns/weaving/books/mr_weave_1.pdf' },
  'GUARDIAN-ARCHIVE': { label: 'Guardian archive: Stockton and Darlington Railway, 1825', href: 'https://www.theguardian.com/uk-news/2025/sep/26/stockton-darlington-railway-first-public-passenger-service-opens-1825' },
  'OLD-BAILEY': { label: 'Old Bailey Online', href: 'https://www.oldbaileyonline.org/' },
  AVALON: { label: 'Avalon Project', href: 'https://avalon.law.yale.edu/' },
  BNE: { label: 'Biblioteca Nacional de España', href: 'https://www.bne.es/' },
  'ARGENTINA-ARCHIVE': { label: 'Archivo General de la Nación Argentina', href: 'https://www.argentina.gob.ar/interior/archivo-general-de-la-nacion' },
  'PERU-ARCHIVE': { label: 'Archivo General de la Nación del Perú', href: 'https://agn.gob.pe/' },
  'BRAZIL-ARCHIVE': { label: 'Arquivo Nacional do Brasil', href: 'https://www.gov.br/arquivonacional/' },
  EUROPEANA: { label: 'Europeana', href: 'https://www.europeana.eu/' },
  'LOC-ANDERSON': { label: 'Library of Congress: Anderson document collection', href: 'https://www.loc.gov/item/04025396/' },
  WIENBIBLIOTHEK: { label: 'Wienbibliothek: Congress of Vienna Final Act', href: 'https://digital.wienbibliothek.at/wbrobv/content/titleinfo/2293309' },
  'ARD-HISTORY': { label: 'Ardouin: Études sur l’histoire d’Haïti, tome 9', href: 'https://fr.wikisource.org/wiki/%C3%89tudes_sur_l%E2%80%99histoire_d%E2%80%99Ha%C3%AFti/Tome_9/4.7' },
  'FME-HAITI': { label: 'Fondation pour la mémoire de l’esclavage: Ordonnance of 1825', href: 'https://memoire-esclavage.org/lordonnance-de-charles-x-sur-lindemnite-dhaiti' }
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
