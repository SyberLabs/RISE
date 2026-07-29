# SOL public-domain acquisitions dossier

Issued 2026-07-28 for the R.I.S.E. Archive

## Decision

Clear **43 exact editions** for staged ingest: 21 for **Form**, 5 for **The Interior**, 7 for **The Limit**, and 10 for **The Recurrence**. This is deliberately an edition list, not a title list. Every cleared text is tied to a named source artifact and a rights basis recognized by the repository.

No proposed edition falls in the 1929–1963 renewal window. That is a curatorial result, not an omission: where a readable pre-1930 edition exists, it is safer and usually better sourced; where the only usable English is later, the work is excluded below. “Public domain in the USA” on a Gutenberg record is corroboration, never a substitute for opening the text and reading its title page. For image-dependent works, the scan—not a stripped transcript—is the work.

The basis label `pre-1930-us` below uses the repository's controlled vocabulary. Evidence still names the actual imprint and the translator or editor. All Gutenberg links below identify their source as public domain in the United States. Before production ingest, preserve the source file, its retrieval date, and SHA-256 digest in the same manner as `scripts/chapel-ingest.mjs`.

## Inherited-corpus repair order

1. **Keep one Marcus Aurelius.** Retain the full George Long text and delete the shorter duplicate record. A selection may be a reading route within the full work, not a second holding.
2. **Rebuild the Upanishads from Müller alone.** The current credit “Max Müller / Swami Nikhilananda” mixes an 1884 public-domain translation with Nikhilananda's later work. Quarantine the current text until every sentence is traced to Müller.
3. **Rebuild the Hermetica from Mead alone.** The current “G. R. S. Mead / Brian Copenhaver” credit mixes the 1906 edition with a copyrighted modern translation. Quarantine and reconstruct from Mead's scan.
4. **Retire Rilke/Norton.** The brief calls it “Norton, 1929,” but the first English Norton edition was 1934, and later publisher matter records renewed copyright. It is not a pre-1930 acquisition.
5. **Retire the current Heart Sutra and Gospel of Thomas.** Their files name Edward Conze and Thomas O. Lambdin respectively while their records say “Traditional.” Those are modern translators, not anonymous transmission.
6. **Quarantine “Zen koans—Various” and the contested Toltec item.** Neither record identifies a source edition or accountable translator. “Traditional” may describe a source community or anonymous authorship; it is never a translator credit.
7. **Audit exact printings** for Thoreau, Emerson, Blake, Dickinson, and Whitman before re-ingest. Authorial public-domain status does not identify which electronic edition the Archive is displaying.

## Shelf: Form

### F01 — The Ten Books on Architecture

- **title:** *The Ten Books on Architecture*
- **author:** Vitruvius
- **shelf:** `form`
- **edition:** trans. Morris Hicky Morgan, Harvard University Press, 1914
- **source:** [Project Gutenberg #20239](https://www.gutenberg.org/ebooks/20239), checked against the title page in the illustrated text
- **basis:** `pre-1930-us`
- **evidence:** The opened title page names Morgan and Harvard's 1914 imprint; Gutenberg marks this exact electronic edition public domain in the USA. Vitruvius is ancient and Morgan died in 1910.
- **why:** It treats a building as the meeting place of proportion, material, climate, labor, acoustics, water, and civic life. Form here is not appearance but a compact between unlike kinds of knowledge.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** *The Elements*; Alberti's *Ten Books*; *The Seven Lamps of Architecture*
- **extent:** Full text, retaining diagrams and tables in page mode; provide RSVP routes through Books I, III, V, and VI.
- **caveats:** Morgan's Roman terminology can be dense. Illustration anchors and chapter headings must survive normalization.

### F02 — The Thirteen Books of Euclid's Elements

- **title:** *The Thirteen Books of Euclid's Elements*
- **author:** Euclid
- **shelf:** `form`
- **edition:** trans. and comm. Thomas L. Heath, 3 vols., Cambridge University Press, 1908
- **source:** Internet Archive scans: [vol. I](https://archive.org/details/thirteenbookseu02heibgoog), [vol. II](https://archive.org/details/thirteenbookseu00heibgoog), [vol. III](https://archive.org/details/thirteenbookseu01heibgoog)
- **basis:** `author-death-70`
- **evidence:** All three scans carry the 1908 Cambridge imprint and name Heath; Heath died in 1940, more than 70 years ago. Euclid is ancient.
- **why:** Few books let a reader watch necessity being built one permitted move at a time. The diagrams slow thought down until proof becomes visible as construction.
- **functions:** `install-pattern`, `serve-recursion`
- **rhymes:** *The Ten Books on Architecture*; *On Growth and Form*; *A Theory of Pure Design*
- **extent:** Heath's translations of Books I–VI, XI, and XII for first release; retain definitions, postulates, propositions, proofs, and diagrams. Add the remaining books in a second tranche.
- **caveats:** Page mode is mandatory. Heath's long historical notes should be collapsible apparatus, not interleaved RSVP text.

### F03 — The Architecture of Leon Battista Alberti in Ten Books

- **title:** *The Architecture of Leon Battista Alberti in Ten Books*
- **author:** Leon Battista Alberti
- **shelf:** `form`
- **edition:** trans. Giacomo Leoni, Edward Owen for Robert Alfray, London, 1755
- **source:** [Linda Hall Library full facsimile record](http://contentdm.lindahall.org/u?/classics,4839)
- **basis:** `author-death-70`
- **evidence:** The facsimile is the 1755 Leoni edition. Alberti died in 1472 and Leoni in 1746; both exceed life plus 70 by centuries.
- **why:** Alberti takes Vitruvius's inherited grammar and asks what building owes to a living city. The value is in the argument between rule and judgment, not in a catalogue of orders.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Vitruvius; Ruskin's *Seven Lamps*; *The Analysis of Beauty*
- **extent:** Books I, II, VI, and IX first—lineaments, materials, ornament, and beauty—then the complete work.
- **caveats:** Leoni's English is archaic and sometimes paraphrastic. Use the 1755 scan, never a modern Dover reprint as the provenance artifact.

### F04 — The Notebooks of Leonardo da Vinci

- **title:** *The Notebooks of Leonardo da Vinci*
- **author:** Leonardo da Vinci
- **shelf:** `form`
- **edition:** compiled and edited by Jean Paul Richter; English principally by R. C. Bell, with passages by E. J. Poynter; 2 vols., 1883
- **source:** [Project Gutenberg #5000](https://www.gutenberg.org/ebooks/5000) and [vol. I scan](https://archive.org/details/literaryworksofl01leon)
- **basis:** `author-death-70`
- **evidence:** The nineteenth-century title matter and preface identify Richter's arrangement and the English hands. Leonardo died in 1519, Richter in 1937, Poynter in 1919, and Bell's contribution was published in 1883.
- **why:** Leonardo refuses the later border between seeing and making: water, shadow, anatomy, flight, and painting become versions of the same question. Richter's topical rearrangement makes that traffic legible, even while it falsifies the notebooks' original disorder.
- **functions:** `generate-connection`, `install-pattern`, `serve-recursion`
- **rhymes:** *The Elements of Drawing*; *On Growth and Form*; *The Practice and Science of Drawing*
- **extent:** Substantial route through perspective, light and shade, color, proportion, landscape, and the practice of painting; retain manuscript and drawing references.
- **caveats:** This is a nineteenth-century thematic compilation, not notebook-order transcription. Credit Bell and Poynter in provenance; do not label Richter simply “translator.”

### F05 — The Analysis of Beauty

- **title:** *The Analysis of Beauty*
- **author:** William Hogarth
- **shelf:** `form`
- **edition:** J. Reeves for the author, London, 1753
- **source:** [Project Gutenberg #51459](https://www.gutenberg.org/ebooks/51459)
- **basis:** `author-death-70`
- **evidence:** The source reproduces the 1753 authorial text; Hogarth died in 1764. No later translation or editorial copyright is involved.
- **why:** Hogarth makes beauty move. His “line of beauty” matters less as a rule than as a wager that the eye prefers forms which imply a body turning through space.
- **functions:** `install-pattern`, `generate-connection`
- **rhymes:** Alberti; *Line and Form*; *A Theory of Pure Design*
- **extent:** Full text with plates and references bound to their passages.
- **caveats:** The argument is partially unintelligible without the plates; RSVP alone is insufficient.

### F06 — Principles of Decorative Design

- **title:** *Principles of Decorative Design*
- **author:** Christopher Dresser
- **shelf:** `form`
- **edition:** fourth ed., Cassell, Petter & Galpin, London/New York, 1873
- **source:** [Project Gutenberg #39749](https://www.gutenberg.org/ebooks/39749); source scan [Internet Archive](https://archive.org/details/principlesofdeco00dres)
- **basis:** `pre-1930-us`
- **evidence:** The source scan's catalog and title matter identify the fourth edition, the 1873 London/New York imprint, and Dresser; Internet Archive marks it `NOT_IN_COPYRIGHT`, and Gutenberg identifies its derivative as public domain in the USA.
- **why:** Dresser repeatedly asks whether ornament tells the truth about the material and use beneath it. The book turns a sugar bowl, carpet, or glass into a moral test of attention without pretending that usefulness abolishes delight.
- **functions:** `install-pattern`, `generate-connection`
- **rhymes:** *The Grammar of Ornament*; *The Bases of Design*; *Hopes and Fears for Art*
- **extent:** Full text, with all figures and object-specific chapters.
- **caveats:** Period judgments about national styles require contextual notes; retain the practical examples that keep its abstractions honest.

### F07 — Line and Form

- **title:** *Line and Form*
- **author:** Walter Crane
- **shelf:** `form`
- **edition:** George Bell & Sons, London, 1900
- **source:** [Project Gutenberg #25290](https://www.gutenberg.org/ebooks/25290)
- **basis:** `author-death-70`
- **evidence:** The illustrated text reproduces the 1900 edition; Crane died in 1915. Gutenberg marks it public domain in the USA.
- **why:** Crane teaches line not as contour but as an organizing force that travels from a leaf to a figure to the edge of a page. It is a grammar of continuity, especially valuable in an environment where text and image must share one field.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** *The Analysis of Beauty*; *The Elements of Drawing*; *Composition*
- **extent:** Full illustrated text in page mode; selected prose may also stream beside the cited figures.
- **caveats:** Never ingest the text-only variant as the canonical work.

### F08 — The Bases of Design

- **title:** *The Bases of Design*
- **author:** Walter Crane
- **shelf:** `form`
- **edition:** George Bell & Sons, London, 1898
- **source:** [Project Gutenberg #47967](https://www.gutenberg.org/ebooks/47967)
- **basis:** `author-death-70`
- **evidence:** The source text names Crane and the original Bell edition; Crane died in 1915. Gutenberg records public-domain status in the USA.
- **why:** Where *Line and Form* works close to the hand, this book moves outward to architecture, craft, and the social conditions of coherence. Its best claim is that design is relation before it is decoration.
- **functions:** `install-pattern`, `generate-connection`
- **rhymes:** *Line and Form*; Vitruvius; Morris's *Hopes and Fears for Art*
- **extent:** Full illustrated text.
- **caveats:** Some reproductions are tonal and need scan-quality validation at the target display size.

### F09 — The Elements of Drawing

- **title:** *The Elements of Drawing, in Three Letters to Beginners*
- **author:** John Ruskin
- **shelf:** `form`
- **edition:** text first published 1857; source printing by National Library Association, New York/Chicago
- **source:** [Project Gutenberg #30325](https://www.gutenberg.org/ebooks/30325)
- **basis:** `pre-1930-us`
- **evidence:** The electronic text exposes the New York/Chicago title matter and Ruskin's 1857 text; Ruskin died in 1900. Gutenberg marks it public domain in the USA.
- **why:** Ruskin makes drawing an ethics of refusing the thing one expected to see. The exercises train patience before skill, which is exactly why they remain alive after their materials have dated.
- **functions:** `induce-state`, `install-pattern`, `serve-recursion`
- **rhymes:** Leonardo's *Notebooks*; Speed's *Practice and Science*; *The Book of Tea*
- **extent:** Full three letters and exercises, preserving figures.
- **caveats:** Several material recommendations are obsolete; present them historically, not as current conservation advice.

### F10 — The Seven Lamps of Architecture

- **title:** *The Seven Lamps of Architecture*
- **author:** John Ruskin
- **shelf:** `form`
- **edition:** first published 1849; illustrated source edition
- **source:** [Project Gutenberg #35898](https://www.gutenberg.org/ebooks/35898)
- **basis:** `author-death-70`
- **evidence:** Ruskin died in 1900; the source reproduces a nineteenth-century text and plates and is marked public domain in the USA.
- **why:** Ruskin is least useful when treated as a style guide and most useful when he asks what a building reveals about sacrifice, memory, and obedience. The “lamps” are pressures placed on making, not decorative categories.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Vitruvius; Alberti; Morris
- **extent:** Full text, with an initial route through “Sacrifice,” “Truth,” and “Memory.”
- **caveats:** His polemics against restoration and architectural traditions should be framed as arguments, not neutral history.

### F11 — The Practice and Science of Drawing

- **title:** *The Practice and Science of Drawing*
- **author:** Harold Speed
- **shelf:** `form`
- **edition:** first American ed., J. B. Lippincott, Philadelphia, 1913; same setting as Seeley, Service & Co., London
- **source:** [Project Gutenberg #14264](https://www.gutenberg.org/ebooks/14264), with the American edition identified in the [Open Library edition record](https://openlibrary.org/books/OL7198921M/The_practice_and_science_of_drawing.)
- **basis:** `author-death-70`
- **evidence:** The catalog record identifies the 1913 joint J. B. Lippincott/Seeley publication; the text and plates correspond to Gutenberg's 1913 source, which is marked public domain in the USA. Speed died in 1957, so do not use author-death-70.
- **why:** Speed keeps two kinds of seeing in productive tension: the measured account of an object and the felt rhythm of its masses. That conflict is a better education than a sequence of drawing tricks.
- **functions:** `install-pattern`, `serve-recursion`
- **rhymes:** Ruskin's *Elements*; Leonardo; *Line and Form*
- **extent:** Full illustrated text.
- **caveats:** Rights should be recorded as `pre-1930-us`, not author-death-70; Speed's death date is too recent for the latter label.

### F12 — Concerning the Spiritual in Art

- **title:** *Concerning the Spiritual in Art*
- **author:** Wassily Kandinsky
- **shelf:** `form`
- **edition:** trans. Michael T. H. Sadler, Houghton Mifflin, Boston/New York, 1914
- **source:** [Project Gutenberg #5321](https://www.gutenberg.org/ebooks/5321)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names Sadler and the 1914 American imprint; Gutenberg marks this exact English text public domain in the USA. This is not the later *Point and Line to Plane* translation.
- **why:** Kandinsky asks what remains of form after depiction stops carrying the picture. The prose is most alive when color, interval, and pressure become instruments acting directly upon attention.
- **functions:** `induce-state`, `install-pattern`, `generate-connection`
- **rhymes:** *The Analysis of Beauty*; *A Theory of Pure Design*; *On the Sensations of Tone*
- **extent:** Full text, with plates; provide a focused route through “The Movement of the Triangle,” “Painting,” and “The Work of Art and the Artist.”
- **caveats:** Sadler's name appears as “Sadleir” in some catalogs. The source omits or poorly reproduces some full-page illustrations; validate against its scan.

### F13 — On the Sensations of Tone

- **title:** *On the Sensations of Tone as a Physiological Basis for the Theory of Music*
- **author:** Hermann von Helmholtz
- **shelf:** `form`
- **edition:** trans., rev., and annotated Alexander J. Ellis, third English ed., Longmans, Green & Co., London/New York, 1895
- **source:** [Internet Archive `onsensationsofto00helmrich`](https://archive.org/details/onsensationsofto00helmrich); independent [Wellcome public-domain record](https://wellcomecollection.org/works/rby988rq)
- **basis:** `pre-1930-us`
- **evidence:** The scan names Helmholtz, Ellis, the 1895 date, and London/New York imprint. Helmholtz died in 1894 and Ellis in 1890; Wellcome applies a Public Domain Mark.
- **why:** A vibrating body becomes a sensation, then a consonance, then a musical system. The book earns its place because it refuses to let physical law, perception, and aesthetic order remain separate subjects.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Kandinsky; Euclid; *On Growth and Form*
- **extent:** Curated route: introduction; Parts I–II on partials, resonance, beats, and combination tones; Part III chapters on consonance, scales, and tonality. Retain figures and musical examples.
- **caveats:** Not suitable as an undifferentiated 600-page stream. Ellis's pitch notation and extensive appendices require page mode and a notation legend.

### F14 — Aristotle's Poetics

- **title:** *Aristotle's Poetics*
- **author:** Aristotle
- **shelf:** `form`
- **edition:** trans. S. H. Butcher, third ed., Macmillan, 1902 (translation first issued 1895)
- **source:** [Project Gutenberg #1974](https://www.gutenberg.org/ebooks/1974)
- **basis:** `author-death-70`
- **evidence:** The source names Butcher; Aristotle is ancient and Butcher died in 1910. Gutenberg marks the English text public domain in the USA.
- **why:** The surviving fragment asks why a made action can feel more intelligible than an actual life. Its severe compression makes plot, recognition, reversal, and pity behave like structural loads.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Quiller-Couch; *The Analysis of Beauty*; *Myths of the Cherokee*
- **extent:** Full translation; omit later copyrighted introductions and keep Butcher's notes as optional apparatus.
- **caveats:** The treatise is incomplete and transmitted through damaged manuscripts; its prescriptive reputation is stronger than its actual tone.

### F15 — On the Art of Writing

- **title:** *On the Art of Writing*
- **author:** Arthur Quiller-Couch
- **shelf:** `form`
- **edition:** 1917 Cambridge University Press reprint of the 1916 first edition; U.S. copyright by G. P. Putnam's Sons, New York
- **source:** [Project Gutenberg #17470](https://www.gutenberg.org/ebooks/17470)
- **basis:** `pre-1930-us`
- **evidence:** The opened source identifies the 1917 reprint, states “First Edition 1916,” and names G. P. Putnam's Sons as the U.S. rightsholder; Gutenberg marks that exact source public domain in the USA. Quiller-Couch died in 1944.
- **why:** These lectures keep returning from rules of style to the character of the person making sentences. Their enduring use is not “murder your darlings” but the insistence that prose has an address, a breath, and a moral temperature.
- **functions:** `install-pattern`, `serve-recursion`
- **rhymes:** Aristotle's *Poetics*; Spencer's *Philosophy of Style*; Montaigne
- **extent:** Full text; surface Lectures V, VII, XII, and XIII as a shorter route.
- **caveats:** The Cambridge canon is narrow and period-bound; the craft judgments are the acquisition, not the survey of English letters.

### F16 — The Philosophy of Style

- **title:** *The Philosophy of Style*
- **author:** Herbert Spencer
- **shelf:** `form`
- **edition:** essay first published 1852; nineteenth-century authorial text
- **source:** [Project Gutenberg #5849](https://www.gutenberg.org/ebooks/5849)
- **basis:** `author-death-70`
- **evidence:** Spencer died in 1903; no translator or later creative apparatus is involved. Gutenberg marks the text public domain in the USA.
- **why:** Spencer's economy-of-attention model is partial, but it gives prose a material constraint: every needless friction spends the reader. It belongs here as a tool to test, not a law to obey.
- **functions:** `install-pattern`, `generate-connection`
- **rhymes:** Quiller-Couch; Euclid; *Line and Form*
- **extent:** Full essay.
- **caveats:** Its psychologizing and evolutionary analogies are dated. Frame as one strong model among others, not a complete aesthetics.

### F17 — On Growth and Form

- **title:** *On Growth and Form*
- **author:** D'Arcy Wentworth Thompson
- **shelf:** `form`
- **edition:** Cambridge University Press, 1917
- **source:** [Project Gutenberg #55264](https://www.gutenberg.org/ebooks/55264)
- **basis:** `pre-1930-us`
- **evidence:** The source reproduces the 1917 first edition and is marked public domain in the USA; a U.S. issue circulated through Cambridge's American distribution before 1930. Thompson died in 1948.
- **why:** Thompson looks at a shell, a bone, or a leaf and asks which forces are still visible in the finished shape. The book changes resemblance from a visual fact into a record of transformation.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Euclid; Leonardo; Helmholtz
- **extent:** Chapters I–IV, VI, VII, IX, and XVII first; retain equations and figures. Complete text may follow when mathematical layout is verified.
- **caveats:** Long and technically uneven. It needs named reading routes, not excerpting that severs examples from their diagrams.

### F18 — A Theory of Pure Design

- **title:** *A Theory of Pure Design: Harmony, Balance, Rhythm*
- **author:** Denman Waldo Ross
- **shelf:** `form`
- **edition:** Houghton, Mifflin & Co., Boston/New York, 1907
- **source:** [Project Gutenberg #74765](https://www.gutenberg.org/ebooks/74765)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names the 1907 American imprint; Gutenberg marks it public domain in the USA. Ross died in 1935.
- **why:** Ross reduces pictures to measurable relations without quite draining them of life. His diagrams make balance and rhythm available for inspection, disagreement, and reuse across page, interface, and image.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Euclid; Hogarth; Dow's *Composition*
- **extent:** Full text with color plates and diagrams in page mode.
- **caveats:** Color reproduction must be checked against the scan; a grayscale derivative would falsify several demonstrations.

### F19 — Composition

- **title:** *Composition: A Series of Exercises in Art Structure for the Use of Students and Teachers*
- **author:** Arthur Wesley Dow
- **shelf:** `form`
- **edition:** ninth ed., revised and enlarged, Doubleday, Page & Co., Garden City, New York, 1914
- **source:** [Project Gutenberg #45410](https://www.gutenberg.org/ebooks/45410)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names the 1914 New York edition; Gutenberg marks it public domain in the USA. Dow died in 1922.
- **why:** Dow's unit is not the depicted object but the relation among line, dark-and-light, and color. Because the book is built from exercises, its ideas can pass from reading into looking without motivational scaffolding.
- **functions:** `install-pattern`, `serve-recursion`, `generate-connection`
- **rhymes:** Ross; Crane's *Line and Form*; Jones's *Grammar of Ornament*
- **extent:** Full illustrated text and exercises.
- **caveats:** Reproduce Japanese examples with source captions and without presenting Dow's interpretation as a substitute for their own histories.

### F20 — The Grammar of Ornament

- **title:** *The Grammar of Ornament*
- **author:** Owen Jones
- **shelf:** `form`
- **edition:** Day and Son, London, 1856
- **source:** [Smithsonian Libraries scan `grammarornament00jone`](https://archive.org/details/grammarornament00jone)
- **basis:** `cc0-or-pd-dedication`
- **evidence:** The Smithsonian-contributed item is labeled CC0/no known U.S. copyright restriction; the scan carries the 1856 title page. Jones died in 1874.
- **why:** The chromolithographs are not a bag of motifs; they are Jones's attempt to infer generative laws from many ornamental systems. Its most productive reading holds the brilliance of the plates beside the violence of turning cultures into a Victorian grammar.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Dresser; Dow; *Specimens of Bushman Folklore*
- **extent:** Full work in page mode, including plates, captions, and propositions.
- **caveats:** Colonial taxonomy and unattributed extraction are structural defects, not footnote-sized issues. Never detach motifs as free design assets from their labeled source cultures.

### F21 — Hopes and Fears for Art

- **title:** *Hopes and Fears for Art*
- **author:** William Morris
- **shelf:** `form`
- **edition:** Longmans, Green & Co., London/New York, 1919 printing of the 1882 collection
- **source:** [Project Gutenberg #3773](https://www.gutenberg.org/ebooks/3773)
- **basis:** `pre-1930-us`
- **evidence:** The source identifies the Longmans collection and its American imprint; Morris died in 1896. Gutenberg marks it public domain in the USA.
- **why:** Morris asks what kind of labor a beautiful object records and what kind of life made that labor possible. Form expands here from the object to the social arrangement that either permits pleasure in work or extinguishes it.
- **functions:** `generate-connection`, `install-pattern`, `serve-recursion`
- **rhymes:** Dresser; Crane's *Bases of Design*; Ruskin's *Seven Lamps*
- **extent:** Full five lectures.
- **caveats:** Morris's medievalism is diagnosis and desire, not social history; contextualize without sanding away the political claim.

## Shelf: The Interior

### I01 — The Encheiridion

- **title:** *The Encheiridion*
- **author:** Epictetus
- **shelf:** `interior`
- **edition:** trans. George Long, in *A Selection from the Discourses of Epictetus with the Encheiridion*, George Bell, 1877
- **source:** [Project Gutenberg #10661](https://www.gutenberg.org/ebooks/10661)
- **basis:** `author-death-70`
- **evidence:** The opened edition names Long; Epictetus is ancient and Long died in 1879. Gutenberg marks the translation public domain in the USA.
- **why:** A small manual that begins by cutting experience in two: what is ours and what is not. Its severity becomes useful only when read slowly enough to notice how often control is confused with indifference.
- **functions:** `install-pattern`, `serve-recursion`
- **rhymes:** Marcus Aurelius; Seneca; *The Consolation of Philosophy*
- **extent:** Full *Encheiridion* only; the Discourses remain a later acquisition.
- **caveats:** Long's diction is spare but antique. Do not silently modernize its technical terms.

### I02 — Moral Letters to Lucilius

- **title:** *Moral Letters to Lucilius*
- **author:** Seneca
- **shelf:** `interior`
- **edition:** trans. Richard M. Gummere, Loeb Classical Library, 3 vols., 1917, 1920, 1925
- **source:** scan-backed Wikisource volumes: [I](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Volume_1), [II](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Volume_2), [III](https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Volume_3)
- **basis:** `pre-1930-us`
- **evidence:** The Boston/Harvard University Press volumes name Gummere and predate 1930; Seneca is ancient and Gummere died in 1942.
- **why:** Seneca writes philosophy under the pressure of friendship, money, illness, noise, travel, and approaching political danger. The repeated address to Lucilius keeps self-examination from becoming a sealed room.
- **functions:** `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Marcus Aurelius; Epictetus; Montaigne
- **extent:** All 124 letters, staged by volume; provide short routes on time, anger, death, friendship, and wealth.
- **caveats:** Gummere's Loeb translation is formal but lucid. Preserve letter numbering across volumes and keep Latin as optional parallel text.

### I03 — Essays

- **title:** *Essays of Michel de Montaigne*
- **author:** Michel de Montaigne
- **shelf:** `interior`
- **edition:** trans. Charles Cotton, ed. William Carew Hazlitt, 1877
- **source:** [Project Gutenberg #3600](https://www.gutenberg.org/ebooks/3600)
- **basis:** `author-death-70`
- **evidence:** The source title matter names Cotton and Hazlitt; Montaigne died in 1592, Cotton in 1687, and Hazlitt in 1913.
- **why:** Montaigne does not report a stable self; he catches judgment changing while the sentence is underway. The essays make inconsistency a method of honesty rather than a flaw to conceal.
- **functions:** `induce-state`, `generate-connection`, `serve-recursion`
- **rhymes:** Seneca; Quiller-Couch; *The Book of Tea*
- **extent:** Named substantial sequence: “Of Idleness,” “Of Custom,” “That to Philosophize Is to Learn to Die,” “Of Cannibals,” “Of Solitude,” “Of Experience,” and the “Apology for Raymond Sebond.”
- **caveats:** Cotton's vigor comes with seventeenth-century syntax; Hazlitt's notes and later editorial interventions must remain distinguishable from Montaigne.

### I04 — The Book of Tea

- **title:** *The Book of Tea*
- **author:** Kakuzo Okakura
- **shelf:** `interior`
- **edition:** Fox, Duffield & Co., New York, 1906
- **source:** [Project Gutenberg #769](https://www.gutenberg.org/ebooks/769)
- **basis:** `pre-1930-us`
- **evidence:** Written in English and published in New York in 1906; no translator right exists. Okakura died in 1913. Gutenberg marks the text public domain in the USA.
- **why:** The tea-room becomes a device for reducing possession, sharpening hospitality, and composing an interval in ordinary time. Okakura also turns the Western gaze back upon itself, so the book is not merely an exposition of Japan.
- **functions:** `induce-state`, `install-pattern`, `generate-connection`
- **rhymes:** Ruskin's *Elements of Drawing*; Montaigne; *Songs of Kabir*
- **extent:** Full text.
- **caveats:** Okakura writes strategically for an early twentieth-century Anglophone audience; “the East” and “the West” are rhetorical constructions, not neutral categories.

### I05 — The Journal of John Woolman

- **title:** *The Journal of John Woolman*
- **author:** John Woolman
- **shelf:** `interior`
- **edition:** text of the 1774 journal, Everyman's Library ed., with intro. Vida Dutton Scudder, 1909
- **source:** [Project Gutenberg #37311](https://www.gutenberg.org/ebooks/37311)
- **basis:** `pre-1930-us`
- **evidence:** The source reproduces a pre-1930 American-accessible edition and is marked public domain in the USA; Woolman died in 1772 and Scudder in 1954.
- **why:** Woolman records the slow conversion of conviction into inconvenience: altered trade, refused comfort, difficult speech, repeated travel. The journal's force lies in watching conscience become a practice costly enough to test itself.
- **functions:** `install-pattern`, `serve-recursion`, `generate-connection`
- **rhymes:** Marcus Aurelius; Seneca; *Hopes and Fears for Art*
- **extent:** Full Journal; exclude appended essays from the first ingest and make Scudder's introduction optional apparatus.
- **caveats:** Quaker diction and the historical setting of enslavement need notes, but the text should not be recast in contemporary moral vocabulary.

## Shelf: The Limit

### L01 — Thoughts

- **title:** *Thoughts* (*Pensées*)
- **author:** Blaise Pascal
- **shelf:** `limit`
- **edition:** trans. W. F. Trotter, P. F. Collier & Son, New York, 1908
- **source:** scan-backed [Wikisource edition](https://en.wikisource.org/wiki/Thoughts) and [Internet Archive scan](https://archive.org/details/thoughts00pasc)
- **basis:** `pre-1930-us`
- **evidence:** The title page identifies Trotter and the 1908 New York imprint. Pascal died in 1662 and Trotter in 1916.
- **why:** These are the remains of an argument never finished, and incompletion is their native form. Pascal's fragments keep reason at full strength while showing the places where reason cannot supply its own first premises.
- **functions:** `induce-state`, `generate-connection`, `serve-recursion`
- **rhymes:** Sextus Empiricus; Plotinus; Nietzsche
- **extent:** Full Trotter translation, preserving Brunschvicg fragment numbers.
- **caveats:** Do **not** ingest Gutenberg #18269 wholesale: that file includes T. S. Eliot's 1931 introduction. The Trotter text must be isolated from later apparatus.

### L02 — The Consolation of Philosophy

- **title:** *The Consolation of Philosophy*
- **author:** Boethius
- **shelf:** `limit`
- **edition:** trans. H. R. James, Elliot Stock, London, 1897
- **source:** [Project Gutenberg #14328](https://www.gutenberg.org/ebooks/14328)
- **basis:** `author-death-70`
- **evidence:** The source names James and the 1897 edition; Boethius died c. 524 and James in 1916. Gutenberg marks the translation public domain in the USA.
- **why:** A condemned prisoner stages an argument with Philosophy about fortune, freedom, and providence while the state prepares to kill him. The alternating prose and verse keep consolation from hardening into a system.
- **functions:** `induce-state`, `generate-connection`, `serve-recursion`
- **rhymes:** Epictetus; Pascal; Marcus Aurelius
- **extent:** Full five books, retaining meters as verse.
- **caveats:** James's verse forms sometimes domesticate the Latin. Preserve the mixed form; a prose-only derivative would damage the work.

### L03 — The First Book of Pyrrhonic Sketches

- **title:** *The First Book of Pyrrhonic Sketches*
- **author:** Sextus Empiricus
- **shelf:** `limit`
- **edition:** trans. Mary Mills Patrick, Cambridge University dissertation, 1899
- **source:** [Project Gutenberg #17556](https://www.gutenberg.org/ebooks/17556)
- **basis:** `pre-1930-us`
- **evidence:** The American dissertation and source text name Patrick and 1899; Sextus is ancient and Patrick died in 1940. Gutenberg marks it public domain in the USA.
- **why:** Skepticism here is not the performance of having no beliefs; it is a discipline of setting appearances against claims until compulsion loosens. The result is less a doctrine than a repeated mental action.
- **functions:** `install-pattern`, `induce-state`, `serve-recursion`
- **rhymes:** Pascal; Montaigne; Tao Te Ching
- **extent:** Patrick's translation of Book I in full.
- **caveats:** Exclude the dissertation's historical argument from the canonical text or label it clearly as Patrick's apparatus.

### L04 — The Works of Plotinus, Volume I

- **title:** *The Works of Plotinus, Volume I*
- **author:** Plotinus
- **shelf:** `limit`
- **edition:** trans. Kenneth Sylvan Guthrie, Comparative Literature Press, Bellmore, New York, 1918
- **source:** [Project Gutenberg #42930](https://www.gutenberg.org/ebooks/42930)
- **basis:** `pre-1930-us`
- **evidence:** The source names Guthrie and the 1918 New York imprint; Plotinus died c. 270 and Guthrie in 1940. Gutenberg marks the edition public domain in the USA.
- **why:** Plotinus asks how multiplicity can be real without being final, and how beauty can be an event of return rather than a property. The prose becomes difficult exactly where the object of thought refuses ordinary separation.
- **functions:** `induce-state`, `generate-connection`, `serve-recursion`
- **rhymes:** Kandinsky; Pascal; the verified Mead *Hermetica*
- **extent:** Ennead I selections “On Beauty,” “On the Virtues,” “On Dialectic,” and “On the Three Principal Hypostases,” with Porphyry's ordering note.
- **caveats:** Guthrie is idiosyncratic and much less readable than modern translations. Acquire only the named route; do not let public-domain availability justify a bulk ingest.

### L05 — The Cloud of Unknowing

- **title:** *The Cloud of Unknowing*
- **author:** anonymous
- **shelf:** `limit`
- **edition:** modernized and introduced by Evelyn Underhill, John M. Watkins, London, 1922
- **source:** [Internet Archive `bookofcontemplat00unde`](https://archive.org/details/bookofcontemplat00unde)
- **basis:** `author-death-70`
- **evidence:** The scan identifies Underhill and 1922; the Middle English author is anonymous and Underhill died in 1941.
- **why:** The book does not solve the failure of concepts before the divine; it turns that failure into a deliberate practice of attention. Its governing image—a cloud one enters rather than clears—gives ignorance a shape without pretending to master it.
- **functions:** `induce-state`, `install-pattern`, `serve-recursion`
- **rhymes:** Julian of Norwich; Plotinus; Tao Te Ching
- **extent:** Full text, with Underhill's introduction optional rather than pre-roll.
- **caveats:** Underhill modernizes Middle English and writes from her own revival of mysticism. Record her as editor/modernizer, not translator.

### L06 — Revelations of Divine Love

- **title:** *Revelations of Divine Love*
- **author:** Julian of Norwich
- **shelf:** `limit`
- **edition:** ed. and modernized Grace Warrack, Methuen, London, 1901
- **source:** [Project Gutenberg #52958](https://www.gutenberg.org/ebooks/52958)
- **basis:** `author-death-70`
- **evidence:** The source title page names Warrack and 1901; Julian died after 1416 and Warrack in 1932. Gutenberg marks the edition public domain in the USA.
- **why:** Julian subjects catastrophe to an almost unbearable patience: not denial of pain, but refusal to let pain have the last word about reality. The work's scale matters because assurance arrives through recurrence, not a quotable sentence.
- **functions:** `induce-state`, `serve-recursion`, `generate-connection`
- **rhymes:** *The Cloud of Unknowing*; Boethius; Blake
- **extent:** Full long text, not the familiar isolated sayings.
- **caveats:** Warrack smooths and modernizes the manuscript language. Note the Short/Long Text transmission and identify this as a rendering of the Long Text.

### L07 — Songs of Kabir

- **title:** *Songs of Kabir*
- **author:** Kabir
- **shelf:** `limit`
- **edition:** trans. Rabindranath Tagore, intro. Evelyn Underhill, Macmillan, New York, 1915
- **source:** [Project Gutenberg #6519](https://www.gutenberg.org/ebooks/6519)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names Tagore, Underhill, and the 1915 New York imprint; Kabir died c. 1518, Tagore in 1941, and Underhill in 1941.
- **why:** Kabir's songs strike at every shelter made from name, ritual, caste, and spiritual prestige, then return to the body and the ordinary room. Their speed and direct address are exceptionally suited to paced reading.
- **functions:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`
- **rhymes:** Rumi; *The Book of Tea*; Blake
- **extent:** All 100 numbered poems.
- **caveats:** Tagore worked through Kshitimohan Sen's Bengali collection rather than directly from every Hindi source. The mediation is lyrical and substantial; state it on the reader-facing provenance panel.

## Shelf: The Recurrence

These ten acquisitions make the shelf's name credible, but “recurrence” must not mean stripping stories of place in order to exhibit archetypes. Each ingest should preserve collector, narrator, language, community, and performance notes wherever the edition supplies them.

### R01 — Australian Legendary Tales

- **title:** *Australian Legendary Tales: Folk-Lore of the Noongahburrahs as Told to the Piccaninnies*
- **author:** collected by K. Langloh Parker
- **shelf:** `recurrence`
- **edition:** David Nutt, London, 1896
- **source:** [Project Gutenberg #3833](https://www.gutenberg.org/ebooks/3833)
- **basis:** `author-death-70`
- **evidence:** The source reproduces the 1896 collection; Parker died in 1940. Gutenberg marks it public domain in the USA.
- **why:** The tales carry law, landscape, kinship, and animal transformation together; recurrence appears inside an ecology, not above it. Read beside other collections, they also expose how much a settler collector's frame governs what reaches the page.
- **functions:** `generate-connection`, `serve-recursion`
- **rhymes:** *Myths of the Cherokee*; *Traditions of the Tinguian*; *Hawaiian Mythology*
- **extent:** Full 31 tales, with preface and glossary as apparatus.
- **caveats:** The subtitle and prose contain obsolete and offensive colonial terms. Preserve the historical title for identification, foreground Noongar/Yuwaalaraay context after specialist review, and never present Parker as the stories' author.

### R02 — Eskimo Folk-Tales

- **title:** *Eskimo Folk-Tales*
- **author:** collected by Knud Rasmussen
- **shelf:** `recurrence`
- **edition:** trans. W. J. Alexander Worster, Gyldendal, Copenhagen, 1921
- **source:** [Project Gutenberg #28932](https://www.gutenberg.org/ebooks/28932)
- **basis:** `author-death-70`
- **evidence:** The source title page names Rasmussen, Worster, and 1921; Rasmussen died in 1933 and Worster in 1929.
- **why:** Hunger, weather, kinship, taboo, and the instability between human and animal are not symbols laid over the stories; they are the conditions under which a world holds. The tales make survival social and metaphysical at once.
- **functions:** `generate-connection`, `induce-state`, `serve-recursion`
- **rhymes:** *White Mountain Apache Myths and Tales*; Parker; *Hawaiian Mythology*
- **extent:** Full collection.
- **caveats:** Retain the historical title for edition identity but describe the material as Greenland Inuit. English is mediated through Rasmussen's Danish; preserve named tellers and localities where supplied.

### R03 — Specimens of Bushman Folklore

- **title:** *Specimens of Bushman Folklore*
- **author:** recorded by Wilhelm H. I. Bleek and Lucy C. Lloyd from named |Xam and other San narrators
- **shelf:** `recurrence`
- **edition:** George Allen & Co., London, 1911
- **source:** [Smithsonian Libraries scan `specimensofbush00blee`](https://archive.org/details/specimensofbush00blee)
- **basis:** `cc0-or-pd-dedication`
- **evidence:** The Smithsonian-contributed scan is labeled CC0/no known U.S. copyright restriction and carries the 1911 imprint. Bleek died in 1875 and Lloyd in 1914.
- **why:** The parallel-language pages let the reader see where the English rests against a recorded voice instead of replacing it. The archive is most honest here when ||Kabbo and other narrators remain persons, not raw material for an editor's folklore.
- **functions:** `generate-connection`, `serve-recursion`, `install-pattern`
- **rhymes:** Parker; Mooney; Beckwith
- **extent:** Named cycles of Mantis, Moon, stars, animals, and customs; page images, source-language transcription, English, narrator, and note must travel together.
- **caveats:** The title's ethnonym is colonial and obsolete. Attribution is complex and must be modeled at item level; obtain community-informed review before public launch.

### R04 — Folk Stories from Southern Nigeria

- **title:** *Folk Stories from Southern Nigeria, West Africa*
- **author:** collected by Elphinstone Dayrell
- **shelf:** `recurrence`
- **edition:** Longmans, Green & Co., London/New York, 1910
- **source:** [Project Gutenberg #34655](https://www.gutenberg.org/ebooks/34655)
- **basis:** `pre-1930-us`
- **evidence:** The source title page identifies the 1910 London/New York imprint; Dayrell died in 1917. Gutenberg marks the work public domain in the USA.
- **why:** The stories repeatedly test bargains among people, animals, spirits, hunger, and authority. Their sharp causal turns are compelling, but the collection also shows how colonial office translated living performance into portable moral tale.
- **functions:** `generate-connection`, `serve-recursion`
- **rhymes:** Beckwith's *Jamaica Anansi Stories*; Cole's *Philippine Folk Tales*; Parker
- **extent:** Twenty selected tales spanning creation, trickster, transformation, judgment, and animal cycles; retain source notes.
- **caveats:** Dayrell's frame and Andrew Lang's introduction are colonial documents, not community authority. Exclude Lang's introduction from the default reading route.

### R05 — Traditions of the Tinguian

- **title:** *Traditions of the Tinguian: A Study in Philippine Folk-Lore*
- **author:** collected by Fay-Cooper Cole
- **shelf:** `recurrence`
- **edition:** Field Museum of Natural History, Anthropological Series vol. XIV, no. 1, 1915
- **source:** [Project Gutenberg #12545](https://www.gutenberg.org/ebooks/12545)
- **basis:** `pre-1930-us`
- **evidence:** The source reproduces the Chicago Field Museum publication and names Cole; Gutenberg marks it public domain in the USA. Cole died in 1961, so use publication—not author death—as the basis.
- **why:** Myth, ceremony, social obligation, and the conditions of telling remain entangled here. The collection becomes valuable when its variants are allowed to disagree rather than being compressed into one exemplary “myth.”
- **functions:** `generate-connection`, `install-pattern`, `serve-recursion`
- **rhymes:** *Philippine Folk Tales*; Mooney; Bleek and Lloyd
- **extent:** Substantial named selections across myths, ritual narratives, fables, and variant tellings, with informant and field notes.
- **caveats:** “Tinguian” is a historical exonym; use current Itneg naming in context while preserving edition identity. Cole's ethnographic synthesis is mediated and colonial-era.

### R06 — Philippine Folk Tales

- **title:** *Philippine Folk Tales*
- **author:** collected by Mabel Cook Cole
- **shelf:** `recurrence`
- **edition:** A. C. McClurg & Co., Chicago, 1916
- **source:** [Project Gutenberg #12814](https://www.gutenberg.org/ebooks/12814)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names Cole, Chicago, and 1916; Gutenberg marks it public domain in the USA. Cole died in 1978, so author-death-70 is not the basis.
- **why:** The book's value is comparative only if its internal borders remain visible: Tinguian, Igorot, Mindanao, Moro, and Christian narratives are not one undifferentiated Philippine voice. Read that way, repeated plots reveal both traffic and difference.
- **functions:** `generate-connection`, `serve-recursion`
- **rhymes:** *Traditions of the Tinguian*; Dayrell; Rasmussen
- **extent:** Full collection, partitioned by the edition's community groupings; surface a cross-route on creation, flood, trickster, and origin narratives.
- **caveats:** Several group names and generalizations are colonial-era. Do not merge duplicate tales with Fay-Cooper Cole; variants are data, not clutter.

### R07 — Myths of the Cherokee

- **title:** *Myths of the Cherokee*
- **author:** James Mooney, recording numerous named and unnamed Cherokee narrators
- **shelf:** `recurrence`
- **edition:** Nineteenth Annual Report of the Bureau of American Ethnology, part I, 1900
- **source:** [Project Gutenberg #45634](https://www.gutenberg.org/ebooks/45634)
- **basis:** `us-government-work`
- **evidence:** Published as a Bureau of American Ethnology report by the U.S. Government Printing Office; the source reproduces that report. Mooney died in 1921.
- **why:** The myths are mapped to rivers, mountains, towns, medicines, and remembered speakers, resisting the fantasy that recurrence means placelessness. The long historical apparatus also reveals the conditions under which the federal archive collected them.
- **functions:** `generate-connection`, `serve-recursion`, `install-pattern`
- **rhymes:** Bleek and Lloyd; Goddard; Parker
- **extent:** The complete myth corpus and sacred formulas; keep the historical sketch as optional context rather than the default opening.
- **caveats:** Federal authorship clears Mooney's report, not communal ownership in an ethical sense. Credit named Cherokee contributors and seek Cherokee Nation/Eastern Band review of presentation and access.

### R08 — Jamaica Anansi Stories

- **title:** *Jamaica Anansi Stories*
- **author:** collected by Martha Warren Beckwith, with music recorded by Helen H. Roberts
- **shelf:** `recurrence`
- **edition:** American Folk-Lore Society, New York, 1924
- **source:** [Project Gutenberg #72735](https://www.gutenberg.org/ebooks/72735)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names Beckwith, Roberts, the New York society, and 1924; Gutenberg marks it public domain in the USA.
- **why:** Anansi survives by making speech alter the balance of force. Variants, songs, and performance notes show a tradition moving through voices rather than a fixed sequence of clever plots.
- **functions:** `generate-connection`, `induce-state`, `serve-recursion`
- **rhymes:** Dayrell; *Philippine Folk Tales*; Mooney
- **extent:** Full collection, retaining Jamaican-language passages, standard-English parallels where present, teller names, music, and notes.
- **caveats:** Beckwith's transcription and comparison impose an academic frame. Never “correct” Creole into standard English; audit every contributor credit.

### R09 — Myths and Tales from the White Mountain Apache

- **title:** *Myths and Tales from the White Mountain Apache*
- **author:** collected and translated by Pliny Earle Goddard from Apache narrators
- **shelf:** `recurrence`
- **edition:** Anthropological Papers of the American Museum of Natural History, vol. XXIV, part II, 1919
- **source:** [Project Gutenberg #53113](https://www.gutenberg.org/ebooks/53113)
- **basis:** `pre-1930-us`
- **evidence:** The New York museum publication and 1919 date appear in the source; Goddard died in 1928. Gutenberg marks it public domain in the USA.
- **why:** Origin, danger, trickery, and instruction arrive in compressed narratives whose strangeness should not be repaired into European folktale shape. Goddard's notes make visible both the source language and the limits of his rendering.
- **functions:** `generate-connection`, `serve-recursion`
- **rhymes:** Mooney; Rasmussen; Bleek and Lloyd
- **extent:** Full short corpus with linguistic and explanatory notes.
- **caveats:** Goddard calls the English “free translations”; treat that as a material limitation. Use the community's preferred current name and retain narrator attribution wherever the edition supplies it.

### R10 — Legends of Gods and Ghosts

- **title:** *Legends of Gods and Ghosts (Hawaiian Mythology)*
- **author:** collected and translated by W. D. Westervelt
- **shelf:** `recurrence`
- **edition:** Geo. H. Ellis Press, Boston, 1915
- **source:** [Project Gutenberg #39195](https://www.gutenberg.org/ebooks/39195)
- **basis:** `pre-1930-us`
- **evidence:** The source title page names Westervelt, the Boston imprint, and 1915; Gutenberg marks it public domain in the USA. Westervelt died in 1939.
- **why:** The collection joins gods to winds, volcanoes, surf, chiefly lines, and particular islands; place is an actor, not a setting. Its recurring transformations become most legible when read beside, not collapsed into, other oceanic and circumpolar traditions.
- **functions:** `generate-connection`, `induce-state`, `serve-recursion`
- **rhymes:** Rasmussen; Parker; *Philippine Folk Tales*
- **extent:** Named route through creation, Māui, Pele, the Rainbow Maiden, the hog-god, and ghost narratives; retain Hawaiian names and place references.
- **caveats:** Westervelt was a missionary collector, and Christian interpretation may shape the record. This is not an authoritative Native Hawaiian edition; seek kānaka maoli review before launch.

## Wanted, but not cleared

These are exclusions. None may enter an ingest queue merely because its original-language author is old.

| work | disposition | reason |
|---|---|---|
| Paul Klee, *Pedagogical Sketchbook* | reject | The useful Sibyl Moholy-Nagy English edition is 1953. Renewal **RE090004**, filed 1981-01-26, expressly covers the “introduction & translation & concluding notes.” |
| Kandinsky, *Point and Line to Plane* | reject | The common English translation is Hilla Rebay/Howard Dearstyne, 1947; no rights-safe source artifact was established. Acquire *Concerning the Spiritual in Art* instead. |
| Albrecht Dürer, *Underweysung der Messung* | defer | No sufficiently readable, verified public-domain complete English translation was located. A German facsimile would not serve this English paced-reading library. |
| Luca Pacioli, *Divina Proportione* | defer | Public-domain Italian facsimiles exist, but no verified pre-1930 English translation suitable for ingest was established. |
| Alberti, *On Painting* | defer | The readable English editions found are modern copyrighted translations. Do not infer rights from the fifteenth-century original. |
| Jean-Philippe Rameau, *Treatise on Harmony* | reject | The standard Philip Gossett English translation is 1971 and copyrighted. |
| Paul Klee, *On Modern Art* | defer | Available English translations are later and no cleared exact edition was established. |
| Le Corbusier, *Towards a New Architecture* | defer | Frederick Etchells's English edition is early enough to investigate, but this review did not establish the exact U.S. publication artifact and applicable record well enough for ingest. |
| Rainer Maria Rilke, *Letters to a Young Poet*, trans. M. D. Herter Norton | retire current | Norton's first English edition is 1934, not 1929; publisher copyright lines identify later renewal. No public-domain basis was established for her translation. |
| *Heart Sutra*, Edward Conze adaptation | retire current | “Traditional” conceals a named twentieth-century translator. Conze's readable versions are not cleared by the ancient source text's age. |
| *Gospel of Thomas*, Thomas O. Lambdin | retire current | The codex was published in the twentieth century and Lambdin's English is modern; there cannot be a pre-1930 English edition of this discovered text. |
| Current “Zen koans — Various” | quarantine | No named source edition, editor, or translator. Replace only with a fully attributed historic collection after text-level comparison. |
| Current Toltec item | quarantine | Transmission and edition are contested and “Traditional” supplies neither chain of custody nor rights evidence. |

## Ingest order

1. **Form foundation:** Vitruvius, Euclid, Dow, Ross, Dresser, Crane's *Line and Form*, and Kandinsky. These establish architecture, proof, composition, object design, graphic relation, and abstraction without making the shelf a row of adjacent art manuals.
2. **Inherited repairs:** deduplicate Marcus; quarantine Rilke, Heart Sutra, Gospel of Thomas, koans, Toltec, mixed Upanishads, and mixed Hermetica before adding more.
3. **Depth:** Seneca, Montaigne, Pascal, Boethius, Julian, and Kabir. These correct the current 1,800-character-sample problem with works or named sequences long enough to sustain an hour.
4. **Recurrence pilot:** Beckwith, Mooney, Rasmussen, Bleek/Lloyd, and the Coles, with item-level narrator/community metadata. The remaining four follow after the same attribution model passes review.
5. **Image-dependent Form:** Jones, Hogarth, Leonardo, Helmholtz, Thompson, and the remaining drawing books only after page/figure anchoring is production-ready.

## Shelf architecture

Do **not** add a fifth acquisitions shelf yet. The supposed misfits prove the existing scheme rather than break it: Helmholtz belongs to Form because it shows order crossing physics, perception, and music; Morris belongs there because a made object's structure includes labor; the folklore collections belong to Recurrence only when differences and chains of transmission remain intact. A new shelf would presently hide curatorial decisions that the four shelves force into view.

## Acceptance checks for every resulting ingest

- Exact title page, translator/editor roles, publication place, and year recorded in provenance.
- Rights basis is one of the repository constants and evidence is edition-specific.
- Source artifact is downloaded and SHA-256 recorded; retrieval date is immutable metadata.
- Text is compared against the scan at the beginning, two interior points, and the end.
- Introductions, notes, and translations by different copyright holders are separable.
- Figures, plates, parallel languages, verse, and letter/fragment numbers survive normalization.
- Selections are generated from a canonical full source by stable anchors; they are not duplicate holdings.
- Community narrators and collectors are separate data roles; neither “Traditional” nor “Various” is accepted as translator.
- Reader-facing caveats remain attached to the work and are not reduced to internal comments.
- A page-dependent work fails ingest if its canonical asset is text-only.
