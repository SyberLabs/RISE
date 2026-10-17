# School sources

Hand-made or proofed text artifacts for the Mystery School corpus, each in its own folder named by the School record id. A folder holds the text as it will be ingested, its provenance, and whatever a human must read before it is served. `scripts/school-ingest.mjs` ingests from here as from any other artifact, with the same gates. The design is `docs/product/discussions/2026-10-16-mystery-school-complete-library.md` (§4.3 proofing passes, §5 the Gate).

| Folder | What it holds | State |
| --- | --- | --- |
| `gate.oration/` | Pico's *Oratio de hominis dignitate*: the Latin (`oratio.la.md`, from Latin Wikisource cross-checked against Bibliotheca Augustana, Pico Project numbering, 47 paragraphs, 293 sentences), RISE's English draft (`oratio.en.md`, CC BY 4.0), the translator's notes (`oration.notes.md`) and the side-by-side reading copy (`oration.review.md`) | The Latin is served (47 units, § 1 to § 47, the sentence numbers struck). The English draft is not served until the owner has read every paragraph against the Latin. |
| `saturn.emerald-tablet/` | Newton's English *Emerald Tablet* (`newton-emerald-tablet.md`), re-keyed from Keynes MS. 28, ff. 2r–2v, reading the manuscript text only; provenance in the file's header | Served, one unit. |
