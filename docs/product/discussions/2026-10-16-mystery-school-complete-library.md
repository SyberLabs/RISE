# The Mystery School's complete library: investigation and design

Status: Proposal, written 2026-10-16 at the owner's direction after RDR-029 shipped (#708, live at `063e3a92`). The owner lifted the Standard-Ebooks-only serving rule **for the School only** and asked how every one of the plan's 66 texts can become readable in RISE. This record holds the verified sourcing survey (one row per text, every link opened on 2026-10-16), the mechanism that admits them without touching the Archive canon, and the build order. Audience: the owner, and the engineers who build the slices.

Related: [the plan](2026-10-13-mystery-school-plan.md) · [the pane's design](../../superpowers/specs/2026-10-16-mystery-school-design.md) · [ARCHIVE-CANON-SPEC](../../specs/ARCHIVE-CANON-SPEC.md) · RDR-029, RDR-030.

## 0. Summary, bad news first

- **The rule is one membership test.** A work is served when its id is in `CANON` (`src/content/archive/canon.js`); nothing else counts. Lifting that for the School by widening `CANON` would make every School text a Library "Received" card, break the count pins at 15, give each a certification status of `invalid` (edition identity is hard-coded to Standard Ebooks), and put the Archive's own promise ("Standard Ebooks only") in a false position. **Do not widen the canon.** The Chapel already shows the right shape: a collection-scoped corpus with its own manifest, its own build loop, its own checksum gate and its own door, outside the canon machinery and never re-litigated by the August rule. The School gets the same: a **School corpus** (§3).
- **The survey (§2) finds a free, proofed edition for 46 of the 62 unreadable texts today.** Ten of those are a different edition from the one the plan names (a later printing or revision; recorded per row, and shown to the reader as the edition actually used). Nine texts exist only as scans or uncorrected OCR and need a proofing pass. Six have no free English at all and enter in their original language, as the plan's first selection principle allows; one of them is the Gate.
- **The Gate has no English before 1931.** The first complete English *Oration* is Forbes (1942); Wallis (1944/1949) is out of copyright under life+70 since 2015 but its US renewal is unverified; the Brown Pico Project's modern translation states no licence. The honest road is the one the plan already names: a **RISE translation from the clean Latin** (Latin Wikisource and Bibliotheca Augustana carry the Pico Project's numbered text), released CC BY as the school's first original work, made with a model and read line by line by the owner before it is served (§5).
- **Seven of the nine withheld Archive payloads are not the way in.** Two are usable now (Kandinsky, Zarathustra); the rest carry Wikisource boilerplate, prose-reflowed verse, a truncated extract, or OCR noise with a bibliography-named scheme. Each is re-sourced into the School corpus from a clean edition rather than repaired in place; the Archive's withheld copies stay as they are.
- **The whole thing is six pull requests** (§6). The first makes the mechanism and brings the ten Standard Ebooks texts in; after it, admitting a text is one recipe in one script, verified by the same gates every time.

## 1. What must be true

1. The Archive's rule stands for the Archive. The School's texts never enter `CANON`, `LIBRARY_TEXTS`, the Library's Received shelf, the decision catalogue, or the release-readiness count. Nothing the Archive promises becomes less true.
2. Every School text is served with a named edition, a source URL, the source's bytes hashed at ingest, a rights basis for the US and a stated life+70 status. What the reader sees under *Edition* is what was ingested, not what the plan hoped for.
3. Structure is declared, never inferred. Each work's sections carry verbatim names and a per-section verse flag, read from the edition's own markup where it has any and from a hand-written recipe where it has none. Words in equal words out, or the ingest refuses to write (the Standard Ebooks importer's gate, applied to every source).
4. No distributor matter is served: no Gutenberg header, licence or "produced by", no Wikisource export banner, no CCEL notice, no library card pocket.
5. A text with no free English enters in its original language and says so. A RISE translation is an original work, labelled as RISE's, licensed CC BY, and never shown as if it were a period edition.

## 2. The survey: where each text actually is

Legend. **Tier A**: proofed text, the plan's edition or a reprint of it. **Tier B**: proofed text, but a different edition than planned; the row says which, and the record will name it. **Tier C**: scan or uncorrected OCR only; needs a proofing pass against the scan before it can be served. **Tier D**: no free English; served in the original language, or translated by RISE. SE = Standard Ebooks, PG = Project Gutenberg (ebook number), WS = Wikisource, IA = Internet Archive. "Life+70" is the status in the EU and UK: PD, or in copyright until the year given; "?" where a translator's death year could not be found.

### The Gate

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Pico, *Oration on the Dignity of Man* | D | Latin: la.wikisource.org *Oratio de hominis dignitate*; Bibliotheca Augustana (Progetto Pico text) | Latin, 1486 (printed 1496), numbered paragraphs | PD | Serve the Latin; make the RISE translation (§5). Wallis 1944: renewal unverified, a human must search the Stanford renewal database. Brown's English: no licence stated, do not reuse. |

### Sun: House of the Logos

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Heraclitus, *Fragments* | B | PG 67097 *Early Greek Philosophy* | Burnet, **2nd ed. 1908** (1892 is scan only: IA earlygreekphilo01burngoog) | PD (Burnet d. 1928) | Extract the Herakleitos chapter; fragments as declared units |
| Plato, *Symposium, Phaedrus, Timaeus* | B | SE plato/dialogues/benjamin-jowett (also PG 1600, 1636, 1572) | Jowett, **3rd ed. 1892** text | PD (d. 1893) | Three dialogues from the SE bundle, each with Jowett's introduction as its own section |
| Nietzsche, *Thus Spoke Zarathustra* | A | SE friedrich-nietzsche/thus-spake-zarathustra/thomas-common | Common, 1909 | PD (d. 1919) | SE importer; replaces the withheld one-section payload |
| Leibniz, *Monadology* | A | WS *Monadology (Leibniz, tr. Latta)* | Latta, 1898, 90 sections with notes | PD (d. 1932) | WS page, 75 % proofread; 90 declared sections |
| Spinoza, *Ethics* | A | PG 3800 | Elwes, 1883 | PD (d. 1892) | Five parts; SE page is a placeholder |
| Plotinus, *Enneads* | A | WS *Plotinus (MacKenna)*, five volumes (sacred-texts mirror behind Cloudflare) | MacKenna (vol. 5 with B. S. Page), 1917–1930 | PD for MacKenna (d. 1934); Page ? | 54 tractates as declared units; the Ficino path pins I.6 *On Beauty*; PG has only Guthrie |
| Emerson, *Nature* (1836) | A | WS *Nature (1836)* | Munroe, 1836, validated, scan-backed | PD | Replaces the 1844-essay stand-in; PG 29433 is the 1849 revision |
| Marcus Aurelius, *Meditations* | served | Archive (SE) | Long | PD | already readable |

### Mercury: House of the Machine

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Bacon, *New Atlantis* | A | PG 2434 | modernised spelling | PD | one text; SE placeholder only |
| Menabrea and Lovelace, *Sketch of the Analytical Engine, with Notes* | A | PG 75107 (epub/html; WS scan-backed; fourmilab) | Taylor's *Scientific Memoirs* vol. 3, 1843 | PD | Memoir + Notes A–G as declared units; Note G's table as text |
| Babbage, *Ninth Bridgewater Treatise* | B | Victorian Web (one page per chapter, proofed 2008) | **2nd ed. 1838** (1837 is scan only) | PD | HTML per chapter; check the site's reuse terms (text is PD; their markup is theirs) |
| Boole, *Laws of Thought* | A* | PG 15114 | 1854; **LaTeX and PDF only** | PD | Convert from LaTeX; equations become plain text or are set aside; serve the prose chapters whole |
| Maxwell, *On Governors* | A* | WS *On Governors* (validated) | *Proc. Royal Society* 1868 | PD | Short; equations garbled in the transcription, re-set by hand from the scan |
| Butler, *Darwin among the Machines*; *The Book of the Machines* | B | PG 3279 *Canterbury Pieces* (essay; also WS); SE samuel-butler/erewhon ch. XXIII–XXV | essay 1914 reprint; *Erewhon* **1901 revised** text | PD | Two sources, two declared units; check the three chapters against 1872 |
| Forster, *The Machine Stops* | A | SE e-m-forster/short-fiction (parts I–III); PG 72890 | 1909 | **in copyright until 2041** (d. 1970) | One story from the SE bundle; US only |
| Čapek, *R.U.R.* | A | SE karel-capek/r-u-r/paul-selver_nigel-playfair; PG 59112 | Selver and Playfair, 1923, "slightly abridged" acting version | **until 2041** (Selver d. 1970) | US only; note the abridgement |
| Tesla, *The Problem of Increasing Human Energy* | A | WS | *Century*, June 1900, full length | PD | WS page; figure references kept as text |
| Kapp, *Grundlinien einer Philosophie der Technik* | C/D | IA 11379066bsb (Bavarian State Library scan + OCR) | German, 1877 | PD | No proofed text anywhere; German OCR needs a proofing pass; the 2018 English is in copyright |

### Moon: House of Mind

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Fechner, *Little Book of Life after Death* | A | PG 74480 | Wadsworth, 1904 | ? (Wadsworth's dates unknown) | one text |
| James, *The Stream of Thought* | A | PG 57628 *Principles* vol. 1 (also psychclassics ch. 9 html) | 1890 | PD | Extract chapter IX; sections by its own sub-headings |
| James, *Varieties of Religious Experience* | A | SE william-james/the-varieties-of-religious-experience; PG 621 | 1902 | PD | SE importer; 20 lectures |
| Bucke, *Cosmic Consciousness* | A | sacred-texts eso/cc (behind Cloudflare; mirror exists) | Dutton 1901, proofed 2009 | PD | Fetch by hand into the ingest cache; note the site's attribution request; IA scan is lending-only |
| Freud, *Interpretation of Dreams* | A | PG 66048 | Brill, 1913 | PD (d. 1948) | one text, seven chapters |
| Jung, *Psychological Types* | C | IA psychologicaltyp0000cgju (1924 printing, scan); psychclassics ch. X only | Baynes 1923 | **until 2014 → PD** (Baynes d. 1943) in life+70; US PD | Scan only; proofing pass, or serve chapter X (proofed) first and the rest later |
| Myers, *Human Personality* | B | PG 38492 | **1906 one-volume abridgment** by L. H. Myers (1903 two volumes: IA scans only) | PD | Serve the abridgment, say so |
| Bergson, *Matter and Memory* | A | WS (scan-backed; brocku.ca mirror) | Paul and Palmer, 1911 | ? (Paul, Palmer dates unverified) | WS page; four chapters |
| Ouspensky, *Tertium Organum* | B | sacred-texts eso/to (behind Cloudflare); 1920 IA PDF | **Knopf 1922 revised** (1920 Manas Press is scan only) | ? (Bragdon d. 1946; Bessaraboff ?) | Fetch by hand; serve 1922, say so |

### Venus: House of Imagination

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Blake, *Marriage of Heaven and Hell* | A | WS (from Copy D); PG 45315 (1906 Luce printing) | 1790–93 | PD | WS; plates as declared units, verse flagged |
| Novalis, *Hymns to the Night* | A | PG 8949 *Rampolli* | MacDonald, 1897 | PD (d. 1905) | Extract the Novalis section; six hymns as units, verse |
| Shelley, *A Defence of Poetry* | A | PG 5428; WS | 1821 (printed 1840) | PD | Extract from the essays volume |
| Whitman, *Leaves of Grass* | A | SE walt-whitman/leaves-of-grass (1891–92); WS *Leaves of Grass (1855)* | deathbed edition; 1855 also available | PD | SE importer; verse from markup; the owner may want 1855 as a second edition later |
| Kandinsky, *Concerning the Spiritual in Art* | A | PG 5321 | Sadler, 1914 | **until 2028** (d. 1957) | Re-ingest with the two Part banners; US only |
| Marinetti, *Futurist Manifesto* | D | French: Gallica, *Le Figaro* 20 Feb 1909 (page image); Italian: PG 28144; English: 1912 Sackville Gallery catalogue (IA, raw OCR) | original French, 1909 | PD (d. 1944) | Key the French from the page image (one newspaper page); the 1912 anonymous English (PD in the US) is a second unit after proofing; "read against the grain" note |
| Dante, *Divine Comedy* | served | Archive (SE) | Longfellow | PD | already readable |
| Goethe, *Faust* | B/C | PG 14591 (Part One); WS *Faust (trans. Bayard Taylor)* both parts, Part Two unproofread; IA tragedyfaust00goetrich scan | Taylor; **Part One proofed, Part Two OCR** | PD (d. 1878) | Serve Part One now; Part Two after a proofing pass against the scan |
| Coleridge, *Biographia Literaria* | A | PG 6081 | 1817 (source edition unstated) | PD | 24 chapters |
| Schiller, *Letters on the Aesthetic Education of Man* | B | PG 6798 *Aesthetical Essays* | **Bohn/Bell uncredited translation** (the 1845 Weiss translation is scan only; the plan's "Bohn 1845" conflates the two) | PD | Extract the 27 letters; name the edition honestly |

### Mars: House of the City

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Machiavelli, *The Prince* | A | SE niccolo-machiavelli/the-prince/w-k-marriott | Marriott, 1908 | PD (d. 1927) | SE importer |
| Thucydides, *Peloponnesian War* | A | SE thucydides/history-of-the-peloponnesian-war/richard-crawley | Crawley, 1874 | PD | SE importer; the Seasons path pins the Melian Dialogue (V.84–116) |
| Burckhardt, *Civilization of the Renaissance in Italy* | A | PG 2074 | Middlemore, 1878 (Allen & Unwin reissue) | PD (d. 1891) | Six parts |
| Frazer, *Golden Bough* | A | PG 3623 (1922 abridgement); PG 41082/41359 (1890 two vols) | 1922 abridged, as the plan allows | PD (d. 1941) | Serve the abridgement (single-volunteer transcription; check); note |
| Ibn Khaldun, *Muqaddimah* | C/D | IA lesprolgomne01/02/03abdauoft (de Slane, French, 1863–68); fr.wikisource uncorrected | French, scan only | PD | Original language only (French); OCR proofing pass; a chosen selection first (the plan's step names no part) |
| Vico, *The New Science* | D | PG 43307 | Michelet's French abridgment, 1827, proofed | PD | Serve the French; say "abridged, French" |
| Spengler, *Decline of the West* | A | PG 72344 (vol. 1), 78914 (vol. 2) | Atkinson 1926–28 | **until 2031** (d. 1960) | US only; the Seasons path pins vol. I; check vol. 2's single-producer quality |

### Jupiter: House of Cosmos

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Lucretius, *On the Nature of Things* | A | PG 785 | Leonard, 1916, verse | PD (d. 1944) | Six books, verse flagged |
| Abbott, *Flatland* | A | SE edwin-a-abbott/flatland | 2nd ed. | PD | SE importer |
| Haeckel, *Art Forms in Nature* | C | Wikimedia Commons (100 plates); IA kunstformenderna00haec (scan + supplement OCR) | plates 1904 | PD | A picture work: 100 plates as units with their German titles; the supplement's descriptions after an OCR pass. Needs the Gallery field, not text alone (§4.4) |
| Goethe, *Metamorphosis of Plants* | C | IA journalofbotanyb01londuoft (*Journal of Botany* 1863) | Cox, 1863 (the plan's "Goethe's Botany" is Arber 1946, in copyright) | ? (Cox's dates unknown) | OCR proofing pass of one article (123 numbered paragraphs) |
| Humboldt, *Cosmos* | B/C | PG 14565 (vol. 1); IA cosmossketchofph0000alex (vols 1–4, 1856) | Otté, 1849; **vol. 1 proofed**, rest scans | PD (d. 1903) | Serve vol. 1 now; the Bohn volumes later |
| D'Arcy Thompson, *On Growth and Form* | A | PG 55264 | 1917 first edition | PD (d. 1948) | 17 chapters; figures referenced as text |
| Einstein, *Relativity* | A | PG 30155 (1924, cleaner) or 5001 (1920) | Lawson, 1920/1924 | **until 2031** (d. 1960) | US only; equations in text |
| Kepler, *Harmonices Mundi* | C/D | IA ioanniskepplerih00kepl (1619, Smithsonian) | Latin, scan only | PD | Original language; OCR of 1619 type needs a real proofing pass; Book V first |

### Saturn: House of the Mysteries

| Text | Tier | Source | Edition actually available | Life+70 | What it takes |
|---|---|---|---|---|---|
| Laozi, *Tao Te Ching* | served | Archive (SE) | Legge | PD | already readable |
| Zhuangzi | A | PG 59709 (also WS, ready for export) | Giles, 1889 | PD (d. 1935) | 33 chapters; drop Aubrey Moore's essay or keep as front matter |
| *Bhagavad Gita* | A | PG 2388 | Arnold, 1885 (1900 printing) | PD (d. 1904) | Re-ingest with verse lineation and 18 chapters as declared units; replaces the withheld prose-reflowed payload |
| *Emerald Tablet* | A | Keynes MS 28 (Chymistry of Isaac Newton transcription, page under the project's copyright) | Newton, c. 1680s | PD | Re-key the ~15 lines from the manuscript ourselves; complete the sentence the withheld extract cut |
| *Upanishads* | A | sacred-texts hin/sbe01 and sbe15 (behind Cloudflare) | Müller, SBE vols 1 and 15, 1879–84 | PD (d. 1900) | Fetch by hand; the twelve Upanishads as declared units; WS copies are unproofed |
| *Corpus Hermeticum* | A | sacred-texts gno/th2 (the sermons; th1 prolegomena, th3 excerpts) | Mead, 1906 | PD (d. 1933) | Serve the tractates of vol. 2 only (Poimandres first); the withheld 366k-word OCR of all three volumes is not the way in |
| Rumi, *Masnavi* | A | sacred-texts isl/masnavi (also WS, no scan) | Whinfield, abridged 1887 | PD (d. 1922) | Six books, verse; replaces nothing (the withheld Rumi is the *Dīvān*) |
| *Cloud of Unknowing* | B | CCEL anonymous2/cloud (txt); WS | Underhill, **2nd ed. 1922** (1912 is not online) | PD (d. 1941) | 75 chapters; use CCEL's txt, not its epub (2010 notice on editorial matter) |
| Teresa, *Interior Castle* | B | CCEL teresa/castle2 | Stanbrook, **3rd ed. 1921**, rev. Zimmerman | PD (Zimmerman d. 1937) | Seven mansions as units |
| Pseudo-Dionysius, *Mystical Theology* | A | CCEL dionysius/works; WS; sacred-texts | Parker, 1897 | ? (Parker's dates not found) | Short; five chapters |
| Eckhart, *Sermons* | C | IA meistereckhart0001eckh (Evans vol. 1, 1924; CCEL has uncorrected OCR); Field's 7 sermons (c. 1909) proofed on CCEL/WS | Evans 1924 | PD (Evans d. 1935) | Serve Field's seven now as a threshold; Evans vol. 1 after an OCR proofing pass; vol. 2 (1931) is US-PD only from 2027 |
| Agrippa, *Three Books of Occult Philosophy* | A | **EEBO-TCP A26565, CC0** (TEI XML on GitHub) | J. F., 1651 | PD | TEI importer; three books, chapters as units; esotericarchives' copy is copyrighted, do not use |
| Bruno, *The Heroic Enthusiasts* | A | PG 19817, 19833 | Williams, 1887–89, two parts | ? (Williams's dates unknown) | Two parts, dialogues as units |

**Totals.** Tier A 36, Tier B 10 (46 proofed), Tier C 9 (scan or OCR: Kapp, Jung, Faust II, Haeckel, Goethe's *Metamorphosis*, Humboldt 2–5, Eckhart Evans, Ibn Khaldun, Kepler), Tier D 6 (no free English: Pico, Kapp, Marinetti, Ibn Khaldun, Vico, Kepler; four overlap C). Four already served. 66 in all.

**Rights to show.** US-only (life+70 still running): Forster and Čapek (2041), Spengler, Einstein (2031), Kandinsky (2028). Unknown translator dates: Wadsworth, Paul and Palmer, Bessaraboff, Page, Parker, Williams, Cox. The record's `rights` field grows a `life70` value (`pd` | `until:YYYY` | `unknown`) and the Lectern says it in one line.

## 3. The mechanism: a School corpus beside the Archive

Copied from the Chapel, which has served a Gutenberg Bible under its own rule since July without touching the canon.

```
src/content/school/works/<record-id>.js   generated: SECTIONS [{name, content, verse?}] + META
src/content/school/corpus.js              SCHOOL_WORKS: [{ id, constName, checksum, edition, source, rights }]
scripts/school-ingest.mjs                 recipes per work; adapters per source; the gates
scripts/lib/content-plane.mjs             a school loop like the chapel loop → public/content/school/<sha>.json, manifest.school[]
src/core/content-store.js                 getSections('school', id) with the same hash check
src/content/school/index.js               readable if manifest.school has it, or (as today) the Archive serves it
src/app/school-reading.js                 loads a corpus work through the store; divisions via declaredScheme (verse propagates)
```

- **META** carries `edition: { statement, translator, year }`, `source: { kind, url, retrieved, sha256 }` (kind ∈ standard-ebooks · gutenberg · wikisource · ccel · sacred-texts · eebo-tcp · archive-org · rise-original), `rights: { us: 'pd', life70 }`, `structure: 'declared'`, `payloadChecksum`. The content plane refuses a checksum mismatch, as it does for scripture.
- **Adapters.** Standard Ebooks: the existing spine-and-markup reader (`src/content/archive/standard-ebooks.js`) unchanged. Gutenberg: HTML where it exists (headings and verse are markup there), else txt; cut at the START/END markers; strip distributor matter; reconcile words exactly. Wikisource: the REST API's page HTML (never the ws-export epub). CCEL: txt. sacred-texts: fetched by hand into `.ingest-cache/` because of the bot challenge; the recipe records the sha. EEBO-TCP: TEI. Scans: never ingested directly; a proofing pass produces a text file that the recipe then ingests with its sha (§4.3).
- **Recipes**, not regexes: each work declares its artifacts, where its body starts and ends, its units by name (or a heading vocabulary when the edition's own markup gives one), which units are verse, and which parts to extract when the text lives inside a bundle (James ch. IX, Heraclitus's chapter, Butler's essay, Novalis in *Rampolli*, Shelley's *Defence*, Schiller's Letters, Forster's story, Erewhon's three chapters).
- **Gates, every work, every time:** words reconciled against the cut artifact; no `DISTRIBUTOR_MATTER` anywhere; unit names unique and not bare numerals; verse units keep their line count; minimum size; the recipe's expected unit count. A gate failure refuses to write.
- **What the School pane changes:** `schoolStatus` reads `manifest.school` first; the Lectern's *Edition* line shows META's statement and the life+70 line; `work: { corpus: true }` on a record marks a corpus work. Nothing else in the pane moves.
- **What stays untouched:** `canon.js`, `CANON`, `LIBRARY_TEXTS`, the Library's cards and counts, certification, release readiness, the decision catalogue. The Archive's tests stay green by construction.

## 4. Hard cases

### 4.1 Extracts from bundles
A recipe names the unit boundaries inside the artifact (by heading text, verified by the gate). The School record's `edition` states "from *Principles of Psychology* vol. 1, ch. IX".

### 4.2 Equations
Boole, Maxwell, Einstein: RISE presents words. Where a formula is in-line it stays as plain text as the edition set it; Boole's LaTeX is converted with a one-off converter to text with the equations in their TeX form in brackets; Maxwell's garbled equations are re-set by hand from the scan (the paper is nine pages). The Lectern notes "equations shown as text".

### 4.3 Scans
A proofing pass is a short lane of its own per text: OCR from the IA djvu text, corrected against the page images, with a model doing the first pass and a person reading the diff; the result is a plain text file committed under `scripts/school-sources/<id>.txt` with its provenance, then ingested like any artifact. Order by value: Faust Part Two, Eckhart (Evans vol. 1), Goethe's *Metamorphosis* (one article), Jung, Haeckel's supplement, Humboldt 2–5, Kapp, Ibn Khaldun (a selection), Kepler Book V.

### 4.4 A picture work
Haeckel's *Art Forms* is 100 plates. It becomes a School work whose units are the plates: each unit's text is the plate's title and its organisms (from the supplement), and the reading's visual is the plate itself through the Gallery field (pinned works, as the science and Rijksmuseum imagery already are). This is the one text that needs a pane change beyond the Lectern: the record carries `imagery: 'haeckel'` and the launch sets the Gallery collection. Last in the order.

### 4.5 Original language
Kapp (German), Ibn Khaldun (French), Vico (French), Kepler (Latin), Marinetti (French), Pico (Latin) are served in their language with `rights: 'orig-only'` kept, the Lectern's state "Original language" and the language named. RISE's voice already speaks the browser's voices; a reading in French or Latin uses the language's voice where the device has one. The plan admits them this way until a free translation exists.

## 5. The Gate: a RISE translation of the *Oration*

- Source: the Latin in the Pico Project's numbered paragraphs (Latin Wikisource / Augustana), ~7,500 words.
- Method: a model drafts the translation paragraph by paragraph with the Latin beside it; the owner reads it against the Latin and against Wallis (for sense only, nothing copied); every paragraph the owner has read is marked; the work is served only when all are.
- Licence: CC BY 4.0, "RISE, 2026, from the Latin of 1486". The record's edition says so; the Lectern says "RISE's own translation" and shows the Latin as a second unit so a reader can check.
- This is the school's first original work, as the plan proposed. It is also the pattern for Kapp, Vico, Ibn Khaldun and Kepler if the owner ever wants English for them.

## 6. Build order

| PR | Delivers | Texts readable after |
|---|---|---|
| 1 | The corpus mechanism (§3), the SE adapter, the gates, the content-plane loop, the store namespace, `schoolStatus` and launch for corpus works, tests; the ten SE texts: Zarathustra, Plato (3), Varieties, Erewhon chapters, Forster, R.U.R., Prince, Thucydides, Flatland, Leaves of Grass | 14 |
| 2 | The Gutenberg adapter (html and txt) and its 27 texts: Heraclitus, Spinoza, New Atlantis, Lovelace, Boole (prose), Butler's essay, Fechner, James ch. IX, Freud, Myers, Novalis, Shelley, Kandinsky, Faust I, Coleridge, Schiller, Burckhardt, Frazer, Vico, Spengler, Lucretius, Thompson, Einstein, Humboldt vol. 1, Zhuangzi, Gita, Bruno | 41 |
| 3 | Wikisource, CCEL, sacred-texts and TEI adapters and their 19 texts: Monadology, Enneads, Nature 1836, Maxwell, Tesla, Bergson, Blake, Bucke, Ouspensky, Upanishads, Corpus Hermeticum, Masnavi, Cloud, Interior Castle, Dionysius, Agrippa; Babbage from Victorian Web; the Emerald Tablet re-keyed; Eckhart (Field's seven) | 60 |
| 4 | The rights line (life+70) in the Lectern; the "edition actually used" notes; the Latin *Oration* served at the Gate; RDR-030 evidence | 61 |
| 5 | Proofing passes (§4.3), one PR each as they land: Faust II, Eckhart Evans, Goethe's *Metamorphosis*, Jung, Humboldt 2–5, Kapp, Ibn Khaldun selection, Kepler V, Marinetti | 65 |
| 6 | Haeckel as a picture work (§4.4); the RISE translation of the *Oration* (§5) once the owner has read it | 66 |

PR 1 is the one that matters: after it the rule, the gates and the door exist, and every later text is a recipe.

## 7. Questions for the owner

1. **Edition substitutions (Tier B).** The ten rows marked B serve a later or different edition than the plan names. Accept them as listed, with the Lectern naming what was used?
2. **Picture work.** Haeckel through the Gallery field as described, or defer the work until a text edition of the supplement exists?
3. **The translation.** Proceed with the RISE *Oration* by the method in §5, with you as its reader?
4. **Sizes.** The Enneads, *Thrice-Greatest Hermes* vol. 2, the *Golden Bough* abridgement and *Cosmos* are large; each work is one lazy JSON, so first load is unchanged, but the content plane grows by roughly 8 MB. Fine, or cap the School at a chosen selection per large work?
