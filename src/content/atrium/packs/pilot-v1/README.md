# Atrium Pilot Content Pack v1

This is the first runnable Atrium release artifact. Version 1.16.0 contains 101 clean,
offline text excerpts backed by 94 edition-level source records and twenty-seven
curated journeys:

- Philosophy: 31 passages across early Greek, classical, Hellenistic/Roman,
  and late-antique/Latin transmission contexts; ten launchable journeys.
- History: 70 passages across the Atlantic Revolutions pilot, including
  first-person, counter-declaration, parliamentary, constitutional, and collated
  legal material; seventeen launchable journeys. The 17.36-minute Assembly, Republic,
  Terror journey moves from Sieyès and Desmoulins through the republican settlement,
  Robespierre's defense of revolutionary government, and the Convention at Thermidor.
  The 17.98-minute Freedom, Labor, Sovereignty journey moves from an insurgent
  leaders' letter through Sonthonax's emancipation-and-labor regime, the Convention's
  abolition decree, the 1801 Constitution, and the 1804 declaration of independence.
  The 17.94-minute War, Debt, and the Fiscal State journey moves from Franklin's
  contested account of colonial wartime burdens through the 1763 territorial
  settlement, Parliament's Stamp Act, the Continental Congress's resolves, and
  Paine's argument for political separation. The 17.33-minute Revolution and
  Settlement, 1789–1815 journey tests the survival of revolutionary claims through
  consular executive design, civil codification, imperial collapse, and Vienna. The
  17.88-minute Treaties and the Atlantic Order journey compares imperial cession,
  treaty recognition, Spanish American political diagnosis, hemispheric doctrine,
  and Haiti's recognition under tariff and indemnity conditions. The 15.39-minute
  Machines, Patents, and Production journey moves from Watt's heat economy through
  Arkwright's coordinated spinning system and Cartwright's failed first loom to the
  Stockton–Darlington railway's mixed fixed-engine, locomotive, horse, freight, and
  passenger infrastructure. The 17.86-minute War for Independence journey begins
  with competing Lexington evidence, follows Washington's transformation of
  provincial forces into a Continental army, reads the French alliance as a
  reciprocal military instrument, and ends with Yorktown's negotiated surrender and
  the existing 1783 peace settlement. The 17.87-minute Association, Confederation,
  Amendment journey moves from Rousseau's act of association through Vermont's
  qualified rights settlement and the Articles' league of sovereign states to the
  twelve amendments Congress proposed in 1789, ten of which were ratified in 1791.
  The 15.86-minute Crowd, Testimony, Publicity journey refuses a single omniscient
  crowd story: prosecution and defense testimony contest the Boston firing, a
  colonial newspaper and a British officer publicize the destruction of the tea in
  opposing registers, and Maillard's deposition is set against the Assembly record
  that preserves the women's demand for bread while clearing them from the hall.
  The 17.51-minute Independence without a Single Model journey then compares four
  different state-making processes: Tucumán's declaration without a settled form,
  Mexico's monarchical military compact, Lima's act followed by a provisional war
  government, and Brazilian council action joined to provincial adhesion under fire.
  The repaired 17.80-minute Abolition and Its Limits journey now continues from
  testimony, trade prohibition, and the compensated 1833 apprenticeship settlement
  into Parliament's contested 1838 debate and Barbados's local termination record.

All 81 point launches are compiled and tested inside the three-to-seven-minute
editorial window. Excerpts end at textual boundaries; the expansion does not
repeat or pad source material.

Corpus schema 1.1 adds a reviewed completion disposition to every philosophy node
and history event. Two existing journeys now carry their semantically correct
umbrella anchors: Early Greek Inquiry is covered by *From Origin to Being*, and
Patristic Platonisms by *The Inward and the Eternal*. The runtime therefore reports
86 satisfied records, seven open required launches, no open alignment repairs, and
three accepted non-launch records. The raw `none` count is 10; it is no longer used
as a synonym for unfinished editorial work.

## Release boundary

The pack is reviewed for a United States release boundary. US is enforced by
the readiness gate and is written into every Chamber handoff. WORLDWIDE
sources also satisfy that gate. This is an editorial rights review, not a
global legal conclusion; a change in distribution jurisdiction requires a new
review and pack version.

The acquisition unit is the selected excerpt, not a downloaded complete
provider edition. Every source record identifies that scope. Every UTF-8
payload and every source acquisition unit has a checked-in SHA-256 checksum,
and the tests recompute all hashes and word counts before a journey can pass.

## Source method

1. Prefer institutional transcripts and scan-backed historical editions.
2. Record an exact canonical identifier, edition date, translator where
   applicable, stable locator scheme, retrieval date, attribution, rights
   evidence URL, and reviewed jurisdiction.
3. Collate the selected passage at a meaningful textual boundary.
4. Package only the historical text. Provider wrappers, introductions,
   footnotes, modern annotations, and trademarks are excluded.
5. Keep French and Spanish records in their audited original language. The
   pilot does not insert silent modern or generated translations.
6. Promote only records present in the pack manifests. The larger discovery
   catalogue remains blocked even when it shares a rights-cleared edition.

## Primary source families

- Philosophy: Project Gutenberg historical editions, Internet Archive scans,
  and scan-backed Wikisource transcriptions.
- United States records: National Archives, Founders Online historical text,
  Library of Congress scans and transcripts, National Park Service, Digital History
  at the University of Houston, and the American Presidency Project.
- War for Independence records: the scan-backed *Journals of the Continental
  Congress*, Gage's official report, Washington's General Orders, the signed
  Franco-American treaty text, and the Yorktown capitulation. Lexington preserves
  the conflict between provincial depositions and the British command account.
- European records: UK Parliamentary Archives, Légifrance, the French National
  Assembly, the Élysée historical collection, scan-backed Wikisource editions,
  the Library of Congress Anderson collection, the Wienbibliothek's official
  Congress of Vienna scan, the 1842 *Moniteur* scan, Archives parlementaires/Persée
  collation, and the Congreso de los Diputados.
- Industrial records: Watt's official patent reprint, Baines's 1835 scan-backed
  technical history and embedded Arkwright specification, Marsden's 1895 weaving
  scan, and two identified 1825 Stockton–Darlington records. Modern catalogue and
  newspaper wrappers are excluded from runtime text.
- Haitian records: Persée scan-backed collation of the 1792 insurgent letter, the
  John Carter Brown Library's contemporary Sonthonax broadside, the public-domain
  *Moniteur* reprint collated to *Archives parlementaires*, Library of Congress
  constitutional scans, the surviving 1804 print held by The National Archives (UK),
  and Ardouin's scan-backed transcription of the paired French and Haitian 1825 records.
- Witness texts: scan-backed editions of Thomas Paine and Olaudah Equiano.

## Machine-readable audit

- index.js: release manifest, counts, journey ids, and exclusions.
- source-audit-philosophy.js / source-audit-history.js: edition and rights
  records.
- passage-audit.js: canonical locators and payload bindings.
- integrity.js: checked-in word counts and SHA-256 values.
- payloads.js: the only runtime payload registry.

The exclusions log is a release control, not ancillary documentation. It
records rejected modern translations, provider wrappers, copyrighted
annotation layers, and provider-wide rights assumptions so later expansion
does not silently reintroduce them.
