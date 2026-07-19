# Atrium Pilot Content Pack v1

This is the first runnable Atrium release artifact. It contains 27 clean,
offline text excerpts backed by 26 edition-level source records and eight
curated journeys:

- Philosophy: 13 passages across early Greek, classical, Hellenistic/Roman,
  and late-antique/Latin transmission contexts; four launchable journeys.
- History: 14 passages across the Atlantic Revolutions pilot, including
  first-person and counter-declaration material; four launchable journeys.

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
  National Park Service, and the American Presidency Project.
- European records: UK Parliamentary Archives, Légifrance, the French National
  Assembly, and the Congreso de los Diputados.
- Haitian records: Library of Congress scans and the surviving 1804 print held
  by The National Archives (UK).
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
