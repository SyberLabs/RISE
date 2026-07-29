# SOL public-domain acquisitions dossier — imaginative literature

**Issued:** 2026-07-28  
**Scope:** second acquisitions pass; epic, drama, narrative poetry, novel, tale cycle, and oral narrative  
**Decision set:** 66 edition-specific proposals — 42 Western, 16 Eastern, 8 Indigenous  
**Rights jurisdiction:** United States  
**Status:** acquisition recommendations, not ingest authorization

## Executive decision

The first pass found arguments, contemplative texts, essays, and short lyric forms. This pass supplies the missing imaginative library without treating “canon” as a synonym for Western philosophy.

Add a fourth division:

```js
{ id: 'imaginative', name: 'Imaginative', description: 'Worlds made in language — epic, drama, fiction, and tale' }
```

Keep the stored ID `literary` for compatibility, but relabel it **Discursive** in the interface: “Essays, letters, criticism, and the long argument after.” `classical` remains the place for a tradition's formative works, regardless of genre; `imaginative` names the mode of making, not a period. This is a smaller and more truthful migration than forcing novels and plays into a division already occupied by Montaigne, Emerson, and Okakura.

The proposed distribution is deliberately weighted Western but not Western-only:

| Tradition shelf | Classical | Discursive (`literary`) | Imaginative | Total |
|---|---:|---:|---:|---:|
| `western` | 15 | 1 | 26 | 42 |
| `eastern` | 6 | 0 | 10 | 16 |
| `indigenous` | 0 | 0 | 8 | 8 |
| **Total** | **21** | **1** | **44** | **66** |

Jünger's *The Storm of Steel* is the deliberate exception to this pass's imaginative emphasis. It is a crafted documentary narrative, not fiction, and therefore belongs in the existing `literary` division rendered as **Discursive**; placing it in `imaginative` would make the new category less exact at the moment of its creation.

No Indigenous work is filed as “Classical.” These are living traditions represented through finite, historical acts of collection; calling the collections classical would too easily make the communities sound concluded. Their narratives belong in `imaginative`, with tellers, language, collector, and institutional circumstances exposed.

Every selected edition is either published before 1930 in the United States, safely beyond life-plus-70 for all relevant textual contributors, or a United States government work. No selected edition enters the 1929–1963 renewal window, so no Stanford renewal result is needed to make this slate licensable. Project Gutenberg's status line is corroboration, not the sole evidence: the title page, named translator/editor, imprint, and source scan remain the accession evidence.

## Structural ingest rule

A holding is the complete work or complete named collection. A **reading unit** is the smallest stable authored or source-defined division that can stand alone without silently abridging the work: book, canto, act/scene, chapter, tale, poem, or numbered narrative. The parser must preserve:

- a machine-readable hierarchy (`work > volume > book > chapter`, or the edition's actual equivalent);
- explicit start and end anchors for every reading unit;
- front matter and notes as addressable apparatus, not mingled into the reading stream;
- speaker labels, verse lines, stanza boundaries, refrains, and source-language parallels where present;
- a facsimile/page route whenever typography, illustration, parallel text, or scholarly notation carries meaning.

“Extent: full” below means the whole named edition, including the editor's declared fragments. A staged interface may expose routes through it, but must not accession a route as though it were the work.

## Western Canon

### W01 — *The Iliad*

- **author / shelf / division:** Homer; `western`; `classical`
- **edition / source / basis:** trans. Andrew Lang, Walter Leaf, and Ernest Myers, 1883; [Project Gutenberg #3059](https://www.gutenberg.org/ebooks/3059); `author-death-70`
- **evidence:** The source title matter names all three translators and the 1883 Macmillan edition; the ancient author and every translator are beyond life plus 70.
- **why:** The poem makes glory audible and then measures its cost in bodies, households, and the enemy's grief. Its final act is not victory but two fathers recognizing what war has made of them.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Aeneid*, *The Oresteia*, *War and Peace*
- **structure / reading unit / bounds:** 24 machine-detectable books; one book, with speech blocks retained; start at each `BOOK` heading and end before the next.
- **extent / caveats:** Full text. Preserve verse lines and translator credits; do not merge prose argument or notes into the poem.

### W02 — *The Odyssey*

- **author / shelf / division:** Homer; `western`; `classical`
- **edition / source / basis:** trans. Samuel Butler, Longmans, Green, 1900; [Project Gutenberg #1727](https://www.gutenberg.org/ebooks/1727); `pre-1930-us`
- **evidence:** The opened text identifies Butler's translation and the 1900 London/New York imprint; Gutenberg records the edition public domain in the USA.
- **why:** Its true subject is the labor of return: identity must be tested, narrated, concealed, and finally recognized. The domestic ending corrects the appetite for adventure that the wanderings create.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Iliad*, *The Divine Comedy*, *Ulysses* in the exclusion ledger
- **structure / reading unit / bounds:** 24 books; one book; heading-to-heading, with embedded songs and speeches nested.
- **extent / caveats:** Full prose translation. Butler's controversial authorship claims belong in optional apparatus, not the work record.

### W03 — *The Aeneid*

- **author / shelf / division:** Virgil; `western`; `classical`
- **edition / source / basis:** trans. John Dryden, 1697; [Project Gutenberg #228](https://www.gutenberg.org/ebooks/228); `author-death-70`
- **evidence:** The source identifies Dryden's complete twelve-book translation; author and translator died centuries ago.
- **why:** Virgil turns the founding of an empire into an account of what foundation destroys. Dryden's public, propulsive English keeps the poem's political splendor and private recoil in the same register.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Iliad*, *Paradise Lost*, *The Divine Comedy*
- **structure / reading unit / bounds:** 12 books; one book; book heading through its final verse line.
- **extent / caveats:** Full translation. Retain Dryden's verse and arguments separately; disclose that the English is a seventeenth-century poetic recreation.

### W04 — *Metamorphoses*

- **author / shelf / division:** Ovid; `western`; `classical`
- **edition / source / basis:** trans. Brookes More, Cornhill Publishing/Four Seas, Boston, 1922; [Standard Ebooks source record](https://standardebooks.org/ebooks/ovid/metamorphoses/brookes-more); `pre-1930-us`
- **evidence:** The production record identifies More's 1922 American edition and its scans; Ovid is ancient and the U.S. imprint predates 1930.
- **why:** Transformation is not a theme laid over these stories but their grammar: desire, violence, art, and grief become changes of state. The work supplies connective tissue for nearly every later Western mythic library.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Divine Comedy*, Shakespeare, *The Faerie Queene*
- **structure / reading unit / bounds:** 15 books containing titled episodes; one episode, nested in its book; title/episode marker to the next marker.
- **extent / caveats:** Full translation. Preserve verse lines; validate episode headings against the 1922 scan because some are editorial navigation.

### W05 — *Beowulf*

- **author / shelf / division:** anonymous; `western`; `classical`
- **edition / source / basis:** trans. Francis B. Gummere, 1910; [Project Gutenberg #981](https://www.gutenberg.org/ebooks/981); `pre-1930-us`
- **evidence:** The source names Gummere and the 1910 printing; the edition is public domain in the USA.
- **why:** Its monsters are pressures on social memory: predation, vengeance, and the death waiting inside heroic order. Gummere's alliterative line preserves enough of the poem's acoustic engine to justify this edition.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Nibelungenlied*, *The Song of Roland*, *The Kalevala*
- **structure / reading unit / bounds:** numbered sections with verse lines; one section; numeral heading to the next.
- **extent / caveats:** Full surviving poem. Preserve caesural spacing where recoverable and label the translator's archaizing diction.

### W06 — *The Divine Comedy*

- **author / shelf / division:** Dante Alighieri; `western`; `classical`
- **edition / source / basis:** trans. Henry Wadsworth Longfellow, 1867; [Project Gutenberg #1001](https://www.gutenberg.org/ebooks/1001); `author-death-70`
- **evidence:** The source identifies Longfellow's complete three-canticle translation; author and translator are beyond life plus 70.
- **why:** It gives moral consequence a navigable architecture, then lets love exceed that architecture without dissolving it. Longfellow's restraint makes it unusually compatible with recursive, canto-scale reading.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; Virgil, *Paradise Lost*, *Faust*
- **structure / reading unit / bounds:** canticle > canto > tercet; one canto; canto heading to the next, preserving notes as apparatus.
- **extent / caveats:** Full *Inferno*, *Purgatorio*, and *Paradiso*. Do not ingest *Inferno* alone under the title of the whole.

### W07 — *The Nibelungenlied*

- **author / shelf / division:** anonymous; `western`; `classical`
- **edition / source / basis:** trans. Daniel B. Shumway, Houghton Mifflin, 1909; [Project Gutenberg #1151](https://www.gutenberg.org/ebooks/1151); `pre-1930-us`
- **evidence:** The source names Shumway and the 1909 American edition; Gutenberg marks it public domain in the USA.
- **why:** Courtly magnificence is built over an obligation to revenge that no character can safely fulfill or refuse. Its severe second half makes heroic continuity feel like a machine consuming its inheritors.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Beowulf*, *The Song of Roland*, *The Oresteia*
- **structure / reading unit / bounds:** 39 adventures with stanzas; one adventure; numbered heading to next.
- **extent / caveats:** Full poem. Keep stanza numbers and distinguish source lacunae from OCR loss.

### W08 — *The Song of Roland*

- **author / shelf / division:** anonymous; `western`; `classical`
- **edition / source / basis:** trans. C. K. Scott-Moncrieff, Chapman & Hall, 1919; [Project Gutenberg #391](https://www.gutenberg.org/ebooks/391); `pre-1930-us`
- **evidence:** The source title page names Scott-Moncrieff and the 1919 edition; it predates 1930.
- **why:** Repetition turns a disastrous rear-guard action into ritual memory. The poem matters beside Homer because its heroic code is narrower, more certain, and therefore easier to break.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Iliad*, *Beowulf*, *The Nibelungenlied*
- **structure / reading unit / bounds:** numbered laisses; a route of 10–20 laisses, while each laisse remains addressable; number to number.
- **extent / caveats:** Full poem. Preserve laisse breaks and repeated formulas; the translator's Christian-national framing needs context.

### W09 — *The Kalevala*

- **author / shelf / division:** traditional singers; compiled by Elias Lönnrot; `western`; `classical`
- **edition / source / basis:** trans. John Martin Crawford, 2 vols., 1888; [Project Gutenberg #5186](https://www.gutenberg.org/ebooks/5186); `author-death-70`
- **evidence:** The source names compiler, translator, and 1888 edition; Lönnrot and Crawford are beyond life plus 70.
- **why:** Formula and parallelism let acts of making become acts of singing. It belongs here as both epic and visibly edited oral archive: Lönnrot's compilation is part of the work's form, not transparent transmission.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *Beowulf*, Indigenous narrative collections, *The Shahnameh*
- **structure / reading unit / bounds:** 50 runos with verse lines; one runo; runo heading to next.
- **extent / caveats:** Full Crawford translation. Credit source singers collectively where the edition fails to name them and state Lönnrot's synthetic role.

### W10 — *The Canterbury Tales and Other Poems*

- **author / shelf / division:** Geoffrey Chaucer; `western`; `classical`
- **edition / source / basis:** ed. D. Laing Purves, 1870; [Project Gutenberg #2383](https://www.gutenberg.org/ebooks/2383); `author-death-70`
- **evidence:** The source identifies Purves's edition and pre-1930 text; Chaucer and Purves are beyond life plus 70.
- **why:** The frame makes a public out of incompatible voices, then refuses to let any one social register own the road. Its sequence is an argument made by adjacency rather than exposition.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Decameron*, *Don Quixote*, *The Arabian Nights*
- **structure / reading unit / bounds:** fragment > prologue/tale; one prologue-plus-tale pair; editorial heading to next.
- **extent / caveats:** Full Purves edition, including its “other poems,” but expose the *Canterbury Tales* as a nested collection. Middle English normalization and editorial completions must be disclosed.

### W11 — *Le Morte Darthur*

- **author / shelf / division:** Sir Thomas Malory; `western`; `classical`
- **edition / source / basis:** Everyman's Library ed. Ernest Rhys, 1906; [Project Gutenberg vol. I #1251](https://www.gutenberg.org/ebooks/1251) and [vol. II #1252](https://www.gutenberg.org/ebooks/1252); `pre-1930-us`
- **evidence:** Both source volumes form the 1906 Rhys edition and are public domain in the USA.
- **why:** It builds fellowship by repeated tests and then shows repetition wearing the fellowship away. The prose is both chronicle and dream, a necessary hinge between medieval cycle and modern novel.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Faerie Queene*, *The Song of Roland*, *Don Quixote*
- **structure / reading unit / bounds:** volume > book > chapter; one chapter or declared multi-chapter episode; heading to heading.
- **extent / caveats:** Both volumes, full. Never accession vol. I alone as the complete work; retain Rhys's editorial divisions.

### W12 — *The Decameron*

- **author / shelf / division:** Giovanni Boccaccio; `western`; `classical`
- **edition / source / basis:** trans. John Payne, 1886; [Project Gutenberg #23700](https://www.gutenberg.org/ebooks/23700); `author-death-70`
- **evidence:** The source names Payne's complete translation; author and translator are beyond life plus 70.
- **why:** Ten narrators turn plague-time isolation into a designed society of stories. The daily rules, songs, and changes of sovereign matter as much as any single tale.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; Chaucer, *The Arabian Nights*, *Strange Stories from a Chinese Studio*
- **structure / reading unit / bounds:** frame > 10 days > introductions/tales/conclusions; one tale with its teller and day metadata; tale rubric to next rubric.
- **extent / caveats:** Full 100-tale translation. Preserve frame matter and ballads; do not publish a “best tales” surrogate.

### W13 — *The House of Atreus*

- **author / shelf / division:** Aeschylus; `western`; `classical`
- **edition / source / basis:** trans. E. D. A. Morshead, 1881; [Project Gutenberg #1246](https://www.gutenberg.org/ebooks/1246); `author-death-70`
- **evidence:** The source record identifies Morshead and all three plays—*Agamemnon*, *The Libation-Bearers*, and *The Furies*; translator died in 1912.
- **why:** The trilogy changes vengeance from a sacred duty into a civic problem without pretending that a court erases blood. Its form supplies the decisive long arc missing from a shelf of isolated tragedies.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Iliad*, *The Nibelungenlied*, *Hamlet*
- **structure / reading unit / bounds:** trilogy > play > choral/scene blocks; one play for ordinary reading, one scene for RSVP; title/speaker boundary to next.
- **extent / caveats:** Full trilogy. Preserve chorus divisions and Morshead's play titles; do not split the three holdings without a parent cycle.

### W14 — *The Oedipus Trilogy*

- **author / shelf / division:** Sophocles; `western`; `classical`
- **edition / source / basis:** trans. Francis Storr, Loeb Classical Library, 1912; [Project Gutenberg #31](https://www.gutenberg.org/ebooks/31); `pre-1930-us`
- **evidence:** The source names Storr and contains *Oedipus the King*, *Oedipus at Colonus*, and *Antigone* in the 1912 edition.
- **why:** Read together, the plays make knowledge, exile, burial, and civic authority recur across a ruined family. Their transmitted sequence is not an authored trilogy, but the editorial grouping creates a valuable comparative chamber.
- **functions / rhymes:** `induce-state`, `install-pattern`, `serve-recursion`; *The House of Atreus*, *Phaedra*, *Hamlet*
- **structure / reading unit / bounds:** collection > play > scene/choral ode; one play or scene; play title to next title.
- **extent / caveats:** All three plays. Label the grouping editorial and preserve Storr's facing Greek only in facsimile mode.

### W15 — *The Bacchae*

- **author / shelf / division:** Euripides; `western`; `classical`
- **edition / source / basis:** trans. Gilbert Murray, 2nd ed., George Allen, 1906; [Project Gutenberg #35173](https://www.gutenberg.org/ebooks/35173); `author-death-70`
- **evidence:** The opened title page names Murray, the second edition, and 1906; Murray died in 1957 and is now beyond life plus 70.
- **why:** It refuses the safe opposition between reason and ecstasy: each becomes monstrous by trying to abolish the other. The torn ending in the manuscript is itself an honest boundary the edition must retain.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Oedipus Trilogy*, *Phaedra*, *Faust*
- **structure / reading unit / bounds:** prologue, episodes, choral odes, exodos; one scene/ode; speaker or choral heading to next.
- **extent / caveats:** Full surviving play and notes. Mark the manuscript lacuna as source loss, never repair it with modern conjectural text.

### W16 — *Hamlet*

- **author / shelf / division:** William Shakespeare; `western`; `imaginative`
- **edition / source / basis:** Cambridge Shakespeare, ed. W. G. Clark and W. Aldis Wright, 1863–66; [scan-backed Wikisource set](https://en.wikisource.org/wiki/The_Works_of_William_Shakespeare); `author-death-70`
- **evidence:** The linked volumes reproduce the Cambridge edition; Shakespeare and both editors are beyond life plus 70.
- **why:** The play makes interpretation an action with casualties. Every attempt to determine what a sign means—ghost, performance, prayer, hesitation—changes the situation being interpreted.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The House of Atreus*, *Doctor Faustus*, *The Brothers Karamazov*
- **structure / reading unit / bounds:** play > act > scene > speech; one scene; scene heading to next.
- **extent / caveats:** Full play. The holding is the play, not each scene; preserve verse/prose distinction and Cambridge textual notes as apparatus.

### W17 — *King Lear*

- **author / shelf / division:** William Shakespeare; `western`; `imaginative`
- **edition / source / basis:** Cambridge Shakespeare, ed. Clark and Wright, 1863–66; [scan-backed Wikisource set](https://en.wikisource.org/wiki/The_Works_of_William_Shakespeare); `author-death-70`
- **evidence:** Same exact Cambridge edition and cleared editors as W16.
- **why:** It strips authority, family language, and finally shelter from its characters until recognition comes with no power to repair. The double plot is not reinforcement but a second instrument sounding the same fracture.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Bacchae*, *The Brothers Karamazov*, *Wuthering Heights*
- **structure / reading unit / bounds:** act > scene > speech; one scene; scene heading to next.
- **extent / caveats:** Full play. State that this nineteenth-century conflated text does not represent the modern two-text theory of quarto and folio *Lear*.

### W18 — *The Tempest*

- **author / shelf / division:** William Shakespeare; `western`; `imaginative`
- **edition / source / basis:** Cambridge Shakespeare, ed. Clark and Wright, 1863–66; [scan-backed Wikisource set](https://en.wikisource.org/wiki/The_Works_of_William_Shakespeare); `author-death-70`
- **evidence:** Same exact Cambridge edition and cleared editors as W16.
- **why:** Art makes the island's order and then has to surrender it. The play is indispensable here because its enchantment is also administration: voices, labor, punishment, spectacle, and release are one apparatus.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *Metamorphoses*, *Faust*, *Moby-Dick*
- **structure / reading unit / bounds:** act > scene > speech/song; one scene; scene heading to next.
- **extent / caveats:** Full play. Preserve songs and stage directions; contextualize colonial readings without turning one interpretation into metadata fact.

### W19 — *The Tragical History of Doctor Faustus*

- **author / shelf / division:** Christopher Marlowe; `western`; `imaginative`
- **edition / source / basis:** Alexander Dyce text of the 1604 A-text, 1870s; [Project Gutenberg #779](https://www.gutenberg.org/ebooks/779); `author-death-70`
- **evidence:** The source identifies Marlowe and the early A-text tradition through a nineteenth-century edition; all textual contributors are beyond life plus 70.
- **why:** Infinite appetite contracts itself into a schedule of cheap spectacles. The tragic force lies in the mismatch between what Faustus imagines knowledge to be and what he repeatedly chooses to do with it.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *Hamlet*, *Faust*, *The Picture of Dorian Gray* in a later pass
- **structure / reading unit / bounds:** scenes and choruses; one scene; scene/chorus heading to next.
- **extent / caveats:** Full A-text as edited. Identify A-text versus the expanded 1616 B-text; do not silently hybridize them.

### W20 — *The Duchess of Malfi*

- **author / shelf / division:** John Webster; `western`; `imaginative`
- **edition / source / basis:** Harvard Classics-era public-domain text; [Project Gutenberg #2232](https://www.gutenberg.org/ebooks/2232); `author-death-70`
- **evidence:** The source supplies the full play, act/scene structure, and public-domain status; Webster and the historical editorial matter are beyond life plus 70.
- **why:** The Duchess's private choice exposes how thoroughly her brothers confuse blood, property, and power. Webster's images do not decorate the violence; they make a corrupt institution perceptible.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *Hamlet*, *Phaedra*, *Wuthering Heights*
- **structure / reading unit / bounds:** five acts > scenes > speeches; one scene; act/scene heading to next.
- **extent / caveats:** Full play. Verify the underlying printed edition before ingest because Gutenberg's catalog does not name its editor.

### W21 — *Phaedra*

- **author / shelf / division:** Jean Racine; `western`; `imaginative`
- **edition / source / basis:** trans. Robert Bruce Boswell, in *The French Classical Romances*, 1899; [Project Gutenberg #1977](https://www.gutenberg.org/ebooks/1977); `author-death-70`
- **evidence:** The catalog record names Boswell as translator; Racine and Boswell are beyond life plus 70.
- **why:** Racine compresses catastrophe until disclosure itself becomes the action. The controlled line makes desire feel less like release than a pressure the characters can neither confess nor contain.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Bacchae*, *The Oedipus Trilogy*, *Madame Bovary*
- **structure / reading unit / bounds:** five acts > scenes; one scene; numbered scene heading to next.
- **extent / caveats:** Full play. Boswell's prose/verse handling must be checked against scan; do not substitute later Lowell or Hughes adaptations.

### W22 — *Faust*

- **author / shelf / division:** Johann Wolfgang von Goethe; `western`; `imaginative`
- **edition / source / basis:** trans. Bayard Taylor, 2 vols., 1870–71; Boston/New York Houghton Mifflin reissue, 1912; [scan-backed Wikisource edition](https://en.wikisource.org/wiki/Faust_(trans._Bayard_Taylor)); `pre-1930-us`
- **evidence:** The scan-backed edition names Taylor and contains the complete First and Second Parts; its title pages record the 1870/1871 translations and 1912 American imprint.
- **why:** The bargain is only the first mechanism: the larger work tests whether ceaseless striving is liberation or appetite's alibi. Taylor keeps both parts available, which prevents Part I's cleaner tragedy from replacing Goethe's stranger whole.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Doctor Faustus*, *The Divine Comedy*, *The Tempest*
- **structure / reading unit / bounds:** part > titled scene > speech; one scene; scene title to next.
- **extent / caveats:** Full Parts I and II. Preserve songs and metrical lineation; Project Gutenberg #3023 is Part I only and must not be used as the source for this complete holding.

### W23 — *A Doll's House*

- **author / shelf / division:** Henrik Ibsen; `western`; `imaginative`
- **edition / source / basis:** trans. William Archer, 1889; [Project Gutenberg #2542](https://www.gutenberg.org/ebooks/2542); `author-death-70`
- **evidence:** The source names Archer and a pre-1930 English edition; Ibsen and Archer are beyond life plus 70.
- **why:** The play makes a household's endearments function as contracts before Nora learns to hear them that way. Its design is exact enough that a door closing can carry the entire accumulated argument.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Phaedra*, *Pride and Prejudice*, *Madame Bovary*
- **structure / reading unit / bounds:** three acts > continuous scene beats > speech; one act or editor-marked beat; act heading to next.
- **extent / caveats:** Full play. Preserve stage directions and Archer's period vocabulary; do not import the alternative German ending.

### W24 — *Don Quixote*

- **author / shelf / division:** Miguel de Cervantes; `western`; `imaginative`
- **edition / source / basis:** trans. John Ormsby, 1885; [Project Gutenberg #996](https://www.gutenberg.org/ebooks/996); `author-death-70`
- **evidence:** The source identifies Ormsby's complete two-part translation; author and translator are beyond life plus 70.
- **why:** It does not merely mock romance; it asks what becomes of a person when inherited forms are both false and necessary. The second part's awareness of the first makes the novel an early machine for examining its own reception.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Le Morte Darthur*, *The Canterbury Tales*, *Moby-Dick*
- **structure / reading unit / bounds:** part > chapter; one chapter; chapter heading to next.
- **extent / caveats:** Full Parts I and II. Exclude Ormsby's long critical apparatus from default streaming but retain it as edition context.

### W25 — *Paradise Lost*

- **author / shelf / division:** John Milton; `western`; `imaginative`
- **edition / source / basis:** 1674 twelve-book text; [Project Gutenberg #26](https://www.gutenberg.org/ebooks/26); `author-death-70`
- **evidence:** The poem and historical edition are centuries out of copyright; no modern translation is involved.
- **why:** Its syntax makes freedom felt as the burden of moving through reasons. The poem's Satanic energy and theological architecture must remain together; either one alone turns the work into propaganda.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Aeneid*, *The Divine Comedy*, *The Faerie Queene*
- **structure / reading unit / bounds:** 12 books > verse paragraphs; one book; book argument through final line.
- **extent / caveats:** Full 1674 form. Preserve book arguments and lineation; record which spelling normalization the source applies.

### W26 — *The Faerie Queene*

- **author / shelf / division:** Edmund Spenser; `western`; `imaginative`
- **edition / source / basis:** ed. John W. Hales, Everyman's Library, 2 vols., J. M. Dent/E. P. Dutton, London/New York, 1909; Internet Archive [vol. I `faeriequeenedis01spen`](https://archive.org/details/faeriequeenedis01spen) and [vol. II `faeriequeenedis02spen`](https://archive.org/details/faeriequeenedis02spen); `pre-1930-us`
- **evidence:** The scans identify Hales, both volumes, and the 1909 London/New York edition; Spenser's text and the edition predate 1930.
- **why:** Allegory here is not a code to solve but terrain that keeps changing under the virtue sent to master it. Its unfinished scale is essential: moral design expands faster than the poem can close it.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Le Morte Darthur*, *Paradise Lost*, *Metamorphoses*
- **structure / reading unit / bounds:** book > canto > stanza; one canto; canto heading to next.
- **extent / caveats:** Both volumes: all six completed books and the *Mutabilitie Cantos*. Do not use Gutenberg #6930, which carries a 2004 contributor copyright notice. Authorial incompletion is not an excuse to truncate the surviving work.

### W27 — *The Troubadours*

- **author / shelf / division:** named Occitan poets; translated and discussed by H. J. Chaytor; `western`; `imaginative`
- **edition / source / basis:** Cambridge University Press, 1912; [Project Gutenberg #12456](https://www.gutenberg.org/ebooks/12456); `pre-1930-us`
- **evidence:** The cataloged 1912 monograph contains attributed poems and translated examples; Chaytor's text was issued before 1930 and is public domain in the USA.
- **why:** The shelf needs the lyric technology that made distance, rank, refrain, and deferred address structural principles for later European poetry. Chaytor is not a complete corpus, but it names poets and forms instead of dissolving them into “medieval song.”
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; Dante, Chaucer, *A Hundred Verses from Old Japan*
- **structure / reading unit / bounds:** chapter > named poet/poem/example; one complete translated poem where present; attribution or incipit to next prose resumption.
- **extent / caveats:** Full book, with an explicit anthology-within-monograph route. Do not market the selected translations as “the complete troubadours”; retain Occitan incipits and Chaytor's historical limits.

### W28 — *Moby-Dick; or, The Whale*

- **author / shelf / division:** Herman Melville; `western`; `imaginative`
- **edition / source / basis:** Harper & Brothers, New York, 1851; [Project Gutenberg #2701](https://www.gutenberg.org/ebooks/2701); `author-death-70`
- **evidence:** Melville's American text is nineteenth-century and he died in 1891; Gutenberg marks the work public domain in the USA.
- **why:** The novel keeps changing the kind of book it is because no single discipline can contain the whale. Its catalogues, sermons, stage directions, and cetology are the pursuit—not detachable eccentricities.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Odyssey*, *Don Quixote*, *The Tempest*
- **structure / reading unit / bounds:** etymology/extracts > 135 chapters > epilogue; one chapter; heading to next.
- **extent / caveats:** Full American text including Etymology, Extracts, and Epilogue. Do not normalize the anomalous dramatic chapters into ordinary prose.

### W29 — *Pride and Prejudice*

- **author / shelf / division:** Jane Austen; `western`; `imaginative`
- **edition / source / basis:** 1813 text; [Project Gutenberg #1342](https://www.gutenberg.org/ebooks/1342); `author-death-70`
- **evidence:** Austen died in 1817 and the source contains a public-domain nineteenth-century text.
- **why:** Free indirect style lets judgment expose itself while it judges others. The marriage plot matters because the novel makes revision of perception, not romantic reward, its exacting standard.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *A Doll's House*, *Middlemarch*, *Madame Bovary*
- **structure / reading unit / bounds:** 61 chapters; one chapter; chapter heading to next.
- **extent / caveats:** Full novel. Identify the source's base printing before ingest and keep later editorial punctuation out of the canonical text.

### W30 — *Jane Eyre*

- **author / shelf / division:** Charlotte Brontë; `western`; `imaginative`
- **edition / source / basis:** Smith, Elder, 1847 text; [Project Gutenberg #1260](https://www.gutenberg.org/ebooks/1260); `author-death-70`
- **evidence:** Author and nineteenth-century text are beyond copyright; Gutenberg records public-domain status in the USA.
- **why:** Jane's first-person voice is a claim to moral scale made against every institution that calls her small. The novel earns its Gothic machinery by making desire answer to self-respect.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *Wuthering Heights*, *Pride and Prejudice*, *The Duchess of Malfi*
- **structure / reading unit / bounds:** 38 chapters; one chapter; chapter heading to next.
- **extent / caveats:** Full novel. Retain the subtitle *An Autobiography* and contextualize its colonial and disability representations.

### W31 — *Wuthering Heights*

- **author / shelf / division:** Emily Brontë; `western`; `imaginative`
- **edition / source / basis:** Thomas Cautley Newby, 1847; [Project Gutenberg #768](https://www.gutenberg.org/ebooks/768); `author-death-70`
- **evidence:** The first edition and author are nineteenth-century; no later editorial copyright is needed.
- **why:** Nested testimony prevents passion from becoming self-authenticating: every account reaches us through a listener with motives and limits. The houses are not settings but rival systems for reproducing injury.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Jane Eyre*, *King Lear*, *The Brothers Karamazov*
- **structure / reading unit / bounds:** 34 chapters with nested narrators; one chapter; chapter heading to next, with narrator changes tagged.
- **extent / caveats:** Full 1847 text. Do not silently use Charlotte Brontë's 1850 revisions; tag quoted narration without flattening voices.

### W32 — *Middlemarch*

- **author / shelf / division:** George Eliot; `western`; `imaginative`
- **edition / source / basis:** William Blackwood, 1871–72; [Project Gutenberg #145](https://www.gutenberg.org/ebooks/145); `author-death-70`
- **evidence:** Eliot died in 1880; the source is the public-domain Victorian novel.
- **why:** It makes consequence travel through a town by routes no single character can see. The finale's “unhistoric acts” is earned by hundreds of small causal crossings, not supplied as consolation.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Pride and Prejudice*, *War and Peace*, *Madame Bovary*
- **structure / reading unit / bounds:** eight books > 86 chapters > finale; one chapter; chapter heading to next.
- **extent / caveats:** Full novel including prelude and finale. Preserve book-level architecture and epigraphs as data, not decorative text.

### W33 — *The Brothers Karamazov*

- **author / shelf / division:** Fyodor Dostoevsky; `western`; `imaginative`
- **edition / source / basis:** trans. Constance Garnett, Macmillan, 1912; [Project Gutenberg #28054](https://www.gutenberg.org/ebooks/28054); `pre-1930-us`
- **evidence:** The source names Garnett and the 1912 edition; it predates 1930 and both author and translator are beyond life plus 70.
- **why:** The novel gives incompatible moral imaginations enough room to become events. “The Grand Inquisitor” belongs inside the family plot, where an idea can wound, tempt, and be answered by a gesture.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *King Lear*, *Crime and Punishment*, *War and Peace*
- **structure / reading unit / bounds:** parts > books > chapters > epilogue; one chapter; chapter heading to next.
- **extent / caveats:** Full novel. Preserve hierarchy so famous embedded chapters never masquerade as freestanding holdings.

### W34 — *Crime and Punishment*

- **author / shelf / division:** Fyodor Dostoevsky; `western`; `imaginative`
- **edition / source / basis:** trans. Constance Garnett, Heinemann, 1914; [Project Gutenberg #2554](https://www.gutenberg.org/ebooks/2554); `pre-1930-us`
- **evidence:** The source identifies Garnett's 1914 edition and public-domain U.S. status.
- **why:** It tests an abstract permission to kill against the body's inability to keep abstraction clean. Suspense matters less than the long collapse of Raskolnikov's theory into relation.
- **functions / rhymes:** `induce-state`, `install-pattern`, `serve-recursion`; *The Brothers Karamazov*, *Madame Bovary*, *The Scarlet Letter*
- **structure / reading unit / bounds:** six parts > chapters > epilogue; one chapter; numbered heading to next.
- **extent / caveats:** Full novel and epilogue. Keep Russian names consistent with Garnett rather than modernizing piecemeal.

### W35 — *Anna Karenina*

- **author / shelf / division:** Leo Tolstoy; `western`; `imaginative`
- **edition / source / basis:** trans. Constance Garnett, Heinemann, 1901; [Project Gutenberg #1399](https://www.gutenberg.org/ebooks/1399); `pre-1930-us`
- **evidence:** The source names Garnett and the 1901 edition; it predates 1930.
- **why:** Parallel plots refuse to let either passion or domestic virtue become a complete theory of life. Trains, glances, agricultural plans, and conversations carry forces the characters understand only after acting.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Madame Bovary*, *Middlemarch*, *War and Peace*
- **structure / reading unit / bounds:** eight parts > chapters; one chapter; numbered chapter to next.
- **extent / caveats:** Full novel. Retain epigraph and part divisions; note Garnett's smoothing of Tolstoy's repetitions.

### W36 — *War and Peace*

- **author / shelf / division:** Leo Tolstoy; `western`; `imaginative`
- **edition / source / basis:** trans. Louise and Aylmer Maude, Oxford University Press, 1922–23; [Project Gutenberg #2600](https://www.gutenberg.org/ebooks/2600); `pre-1930-us`
- **evidence:** The source names both Maudes and the pre-1930 edition; Gutenberg records public-domain status in the USA.
- **why:** The book's scale defeats the fantasy that history is authored from the top. Battles become failures of perception while households reveal causal chains no military map can show.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Iliad*, *Middlemarch*, *The Brothers Karamazov*
- **structure / reading unit / bounds:** volumes > parts > chapters > two-part epilogue; one chapter; numbered heading to next.
- **extent / caveats:** Full novel and both epilogue parts. Preserve French passages and supplied translations distinctly.

### W37 — *Madame Bovary*

- **author / shelf / division:** Gustave Flaubert; `western`; `imaginative`
- **edition / source / basis:** trans. Eleanor Marx-Aveling, Vizetelly, 1886; [Project Gutenberg #2413](https://www.gutenberg.org/ebooks/2413); `author-death-70`
- **evidence:** The source names Marx-Aveling; author and translator are beyond life plus 70.
- **why:** Emma's borrowed language of desire is not mocked from a safe exterior; the narration repeatedly catches itself wanting what it exposes. That contamination is the novel's formal intelligence.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Anna Karenina*, *A Doll's House*, *Pride and Prejudice*
- **structure / reading unit / bounds:** three parts > chapters; one chapter; chapter heading to next.
- **extent / caveats:** Full translation. Credit Eleanor Marx-Aveling exactly and do not substitute an anonymous or later translation.

### W38 — *The Scarlet Letter*

- **author / shelf / division:** Nathaniel Hawthorne; `western`; `imaginative`
- **edition / source / basis:** Ticknor, Reed & Fields, 1850; [Project Gutenberg #33](https://www.gutenberg.org/ebooks/33); `author-death-70`
- **evidence:** Hawthorne died in 1864 and the American text is nineteenth-century.
- **why:** A community tries to stabilize one meaning on a sign, while lived time keeps changing what the sign can mean. The scaffold scenes give that semantic struggle a rigorous repeating architecture.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Crime and Punishment*, *Jane Eyre*, *The House of Atreus*
- **structure / reading unit / bounds:** “Custom-House” preface > 24 chapters; one chapter; heading to next.
- **extent / caveats:** Full novel with “The Custom-House.” Keep the preface addressable but do not discard it as non-fictional surplus.

### W39 — *Mrs Dalloway*

- **author / shelf / division:** Virginia Woolf; `western`; `imaginative`
- **edition / source / basis:** Harcourt, Brace, New York, 1925; [Project Gutenberg #71865](https://www.gutenberg.org/ebooks/71865); `pre-1930-us`
- **evidence:** The opened title page identifies the 1925 American edition; publication before 1930 puts this exact U.S. text in the public domain.
- **why:** One day becomes a field in which private memory, public ceremony, class, illness, and war occupy the same clock without sharing the same time. Its transitions are the work's structure and must survive chunking.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Middlemarch*, *Swann's Way*, *War and Peace*
- **structure / reading unit / bounds:** continuous novel with scene/time transitions and no numbered chapters; one editorially mapped movement; transition anchor to next, never fixed-length chunks.
- **extent / caveats:** Full 1925 American text. Boundaries require a curated structural map; do not invent “chapters” or use a later British revision without separate provenance.

### W40 — *Swann's Way*

- **author / shelf / division:** Marcel Proust; `western`; `imaginative`
- **edition / source / basis:** trans. C. K. Scott-Moncrieff, Chatto & Windus, 1922; [Project Gutenberg #7178](https://www.gutenberg.org/ebooks/7178); `pre-1930-us`
- **evidence:** The source names Scott-Moncrieff and the 1922 English edition; it predates 1930.
- **why:** Memory is not stored content retrieved intact but a form built by sensation, delay, and return. The long sentence makes the act of qualification and recovery perceptible in real time.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Mrs Dalloway*, *Middlemarch*, *The Odyssey*
- **structure / reading unit / bounds:** three named parts > section breaks; one named part or curated section; printed ornament/blank-line transition to next.
- **extent / caveats:** Full first volume only, accurately titled *Swann's Way*, not the complete *In Search of Lost Time*. Preserve paragraph and sentence integrity; later volumes require separate edition review.

### W41 — *Ulysses*

- **author / shelf / division:** James Joyce; `western`; `imaginative`
- **edition / source / basis:** Shakespeare and Company, Paris, 2 February 1922; [scan-backed Wikisource 1922 edition](https://en.wikisource.org/wiki/Ulysses_(1922)) and [Project Gutenberg #4300](https://www.gutenberg.org/ebooks/4300); `pre-1930-us`
- **evidence:** The scan reproduces the Shakespeare and Company title page, colophon, and complete 1922 text; Wikisource and Gutenberg identify the work as public domain in the United States, and Gutenberg states that its electronic text is based on pre-1923 print editions.
- **why:** Joyce makes one ordinary Dublin day carry epic scale without allowing the Homeric parallel to dignify or simplify it. Each episode changes the rules by which prose can register a mind, a city, or a body; the succession of styles is the novel's argument.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Odyssey*, *Moby-Dick*, *Mrs Dalloway*, *Swann's Way*
- **structure / reading unit / bounds:** three editorially mapped parts > 18 episodes > paragraphs/speech/form-specific blocks; one episode; printed episode break to the next, with conventional episode names stored as navigation metadata rather than authorial headings.
- **extent / caveats:** Full 1922 first edition. Preserve its typographical errors and signal corrections as apparatus, as the source does; do not silently substitute the 1934 Random House, 1961 reset, or Gabler text. “Circe” requires dramatic-block parsing, “Ithaca” question-and-answer pairs, and “Penelope” its exceptional paragraph/sentence structure.

### W42 — *The Storm of Steel*

- **author / shelf / division:** Ernst Jünger; trans. Basil Creighton; `western`; `literary`
- **edition / source / basis:** first U.S. ed., Doubleday, Doran & Company, Garden City, New York, 1929; textual witnesses: [HathiTrust's 1929 Chatto & Windus record](https://catalog.hathitrust.org/Record/000487749) and [complete scan at Wikisource](https://en.wikisource.org/wiki/File:The_Storm_Of_Steel.pdf); U.S. edition evidence: [U.S. Army Heritage and Education Center bibliography](https://www.armyheritage.org/wp-content/uploads/2020/06/USAHECWWIholdings.pdf); `pre-1930-us`
- **evidence:** The Army Heritage catalog identifies the 284-page Garden City edition, Creighton's translation, and 1929 publication; HathiTrust identifies the 319-page London 1929 issue and the same translator. The complete scan names Jünger, Creighton, and R. H. Mottram, but its pagination is not the U.S. setting.
- **why:** Jünger records battle as alternating tactical precision, sensory shock, exhilaration, and annihilation while withholding the retrospective moral settlement most war memoirs provide. That refusal is the reason to hold it—and the reason it must be placed in argument with Homer, Tolstoy, and the political history surrounding Jünger's interwar reception, not offered as transparent testimony.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Iliad*, *War and Peace*, *Beowulf*
- **structure / reading unit / bounds:** foreword > titled chronological chapters > dated or place-defined movements; one chapter; chapter heading to next.
- **extent / caveats:** Full Creighton translation of the 1924 German revision. Jünger repeatedly revised *In Stahlgewittern*; this is not the text underlying Michael Hofmann's modern translation. Before production ingest, acquire or collate a scan of the 1929 Doubleday issue against the available London witness and pin the U.S. artifact; do not assume different pagination conceals no textual variants. Contextual notes must address the aestheticization of combat and Jünger's interwar nationalism without reducing the book to a verdict on its author.

## Eastern Canon

### E01 — *The Ramayan of Valmiki*

- **author / shelf / division:** Valmiki, traditional attribution; `eastern`; `classical`
- **edition / source / basis:** trans. Ralph T. H. Griffith, 5 vols., 1870–74; [Project Gutenberg #24869](https://www.gutenberg.org/ebooks/24869); `author-death-70`
- **evidence:** The source title matter names Griffith and the 1870–74 complete verse translation; Griffith died in 1906.
- **why:** Exile repeatedly enlarges the question of rightful conduct until family, kingship, alliance, and divine purpose cannot be separated. Its scale is the argument; the famous episodes should not replace the journey that gives them consequence.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Mahabharata*, *The Iliad*, *The Shahnameh*
- **structure / reading unit / bounds:** seven kandas > cantos > verse stanzas; one canto; canto heading to next.
- **extent / caveats:** Full Griffith translation. Preserve Griffith's book/canto hierarchy and explain that this Victorian rendering reflects one textual tradition and period assumptions.

### E02 — *The Mahabharata of Krishna-Dwaipayana Vyasa*

- **author / shelf / division:** Vyasa, traditional attribution; `eastern`; `classical`
- **edition / source / basis:** trans. Kisari Mohan Ganguli, 1883–96; [Project Gutenberg Ganguli set](https://www.gutenberg.org/ebooks/author/2563); `author-death-70`
- **evidence:** The nine Gutenberg records together identify Ganguli's complete prose translation and its original dates; the title pages and translator's preface name him.
- **why:** No excerpt can stand in for the work's pressure between kinship, duty, violence, instruction, and story-within-story. The battlefield teaching matters because the narrative has made every available duty costly.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Ramayan*, *The Iliad*, *War and Peace*
- **structure / reading unit / bounds:** parva > sub-parva > numbered section; one section, with a parva route; section heading to next.
- **extent / caveats:** All 18 parvas across the complete Ganguli set. Require a manifest proving no volume/record is missing; do not accession the *Bhagavad Gita* excerpt as a duplicate work.

### E03 — *The Shahnama of Firdausi*

- **author / shelf / division:** Ferdowsi; `eastern`; `classical`
- **edition / source / basis:** trans. Arthur George Warner and Edmond Warner, 9 vols., Kegan Paul, 1905–25; [Internet Archive vol. I](https://archive.org/details/shahnama01firduoft) through records `shahnama02firduoft`–`shahnama09firduoft`; `pre-1930-us`
- **evidence:** Each scan names the Warner brothers, volume number, and pre-1930 imprint; the nine-volume sequence is the complete English edition.
- **why:** Dynasties rise inside a longer memory that repeatedly judges kings by what their splendor costs. The Rostam cycle gains force from being held within, not substituted for, the history it both protects and disrupts.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Mahabharata*, *The Iliad*, *The Kalevala*
- **structure / reading unit / bounds:** volume > reign/cycle > titled episode > verse paragraph; one episode; title to next title.
- **extent / caveats:** All nine volumes, full. Build the manifest from scans and reconcile transliteration across volumes; never present a one-volume abridgement as the *Shahnameh*.

### E04 — *The Book of the Thousand Nights and a Night*

- **author / shelf / division:** anonymous Arabic/Persian tale tradition; trans. Richard F. Burton; `eastern`; `classical`
- **edition / source / basis:** Burton Club/Benares edition, 10 vols., text first issued 1885; [Internet Archive edition search](https://archive.org/search?query=title%3A%22Book+of+the+Thousand+Nights+and+a+Night%22+creator%3A%22Burton%2C+Richard+Francis%22); `author-death-70`
- **evidence:** The scanned volumes reproduce Burton's complete ten-volume translation; Burton died in 1890 and the source narratives are premodern.
- **why:** Scheherazade makes continuation itself an ethical and formal act: a story postpones death by opening another obligation to listen. The nested architecture, not a handful of familiar tales, is the acquisition.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Decameron*, *The Canterbury Tales*, *Strange Stories from a Chinese Studio*
- **structure / reading unit / bounds:** volume > night > nested tale > sub-tale; one night or complete tale arc; printed night/tale heading to its explicit close.
- **extent / caveats:** Full ten-volume main set; exclude later supplemental volumes from this holding. Burton's sexual, racial, and ethnographic notes require conspicuous period framing and separable apparatus.

### E05 — *Translations of Shakuntala and Other Works*

- **author / shelf / division:** Kalidasa; `eastern`; `classical`
- **edition / source / basis:** trans. Arthur W. Ryder, E. P. Dutton, 1912; [Project Gutenberg #16659](https://www.gutenberg.org/ebooks/16659); `pre-1930-us`
- **evidence:** The source title page names Ryder and the 1912 edition; it includes the full play, *The Cloud-Messenger*, and selected shorter poems as the edition defines them.
- **why:** *Shakuntala* turns recognition into a test of what love remembers when public evidence fails. Holding Ryder's named collection also preserves the change of scale from drama to messenger poem rather than pretending Kalidasa wrote one kind of work.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *The Little Clay Cart*, *Phaedra*, *A Hundred and Seventy Chinese Poems*
- **structure / reading unit / bounds:** collection > work > act/canto/poem; one act, canto, or complete poem; work/section heading to next.
- **extent / caveats:** Full named Ryder collection. Metadata must not call the shorter-poem selection “complete Kalidasa”; preserve stage directions and verse lineation.

### E06 — *The Little Clay Cart*

- **author / shelf / division:** Shudraka, traditional attribution; `eastern`; `imaginative`
- **edition / source / basis:** trans. Arthur W. Ryder, Harvard Oriental Series, 1905; [Project Gutenberg #21020](https://www.gutenberg.org/ebooks/21020); `pre-1930-us`
- **evidence:** The source identifies Ryder's full ten-act translation and its 1905 publication.
- **why:** Its crowded city lets courtesan, merchant, thief, gambler, servant, monk, and revolutionary alter one another's plots. The comedy's social range corrects any Eastern shelf built only from scripture and court epic.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`; *Shakuntala*, *The Decameron*, *A Doll's House*
- **structure / reading unit / bounds:** ten acts > scenes/speeches; one act or scene; act/scene heading to next.
- **extent / caveats:** Full play. Preserve Sanskrit/Prakrit role notes when the edition supplies them; Ryder's transliteration and social terminology need a glossary.

### E07 — *Twenty-Two Goblins*

- **author / shelf / division:** traditional Sanskrit *Vetala* cycle; trans. Arthur W. Ryder; `eastern`; `imaginative`
- **edition / source / basis:** University of Chicago Press, 1917; [Project Gutenberg #52309](https://www.gutenberg.org/ebooks/52309); `pre-1930-us`
- **evidence:** Gutenberg's record identifies Ryder's complete 1917 rendering of the 22-tale recension.
- **why:** Each carried corpse converts a journey into a problem of judgment, and every answer sends the king back to the tree. The recurrence is not ornamental framing; it is the device that trains comparison across cases.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Arabian Nights*, *The Decameron*, *Strange Stories from a Chinese Studio*
- **structure / reading unit / bounds:** frame > 22 numbered goblin tales > conclusion; one tale with its riddle and return; tale heading to next.
- **extent / caveats:** Full Ryder collection. State which Sanskrit recension underlies it and retain the repeated frame rather than deduplicating formulaic passages.

### E08 — *Strange Stories from a Chinese Studio*

- **author / shelf / division:** Pu Songling; `eastern`; `imaginative`
- **edition / source / basis:** trans. Herbert A. Giles, revised 2 vols., 1908; [Project Gutenberg #43629](https://www.gutenberg.org/ebooks/43629); `pre-1930-us`
- **evidence:** The combined record names Pu, Giles, both volumes, and the pre-1930 revised edition; it contains the complete named Giles collection.
- **why:** The supernatural arrives through the ordinary machinery of examination, marriage, debt, lodging, and office. Giles's selection is historically important but visibly selective, which the catalog must say instead of equating it with Pu's much larger Chinese corpus.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *Kwaidan*, *The Arabian Nights*, *The Decameron*
- **structure / reading unit / bounds:** volume > titled story > Giles note; one story; title to next title.
- **extent / caveats:** Full two-volume Giles edition, not the complete *Liaozhai*. Preserve story titles and separate translator annotations; flag dated romanization and bowdlerization.

### E09 — *The Nō Plays of Japan*

- **author / shelf / division:** named and anonymous Noh dramatists; trans. Arthur Waley; `eastern`; `imaginative`
- **edition / source / basis:** Alfred A. Knopf, New York, 1922; [Project Gutenberg #43304](https://www.gutenberg.org/ebooks/43304); `pre-1930-us`
- **evidence:** The title page names Waley and the 1922 American edition; the complete named anthology predates 1930.
- **why:** Plot is thinned until place, remembered action, music, and transformed identity can occupy the stage. The collection changes the Archive's model of drama: scene boundaries alone cannot describe a form organized by entrance, dance, and revelation.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Kwaidan*, *The Tempest*, *Shakuntala*
- **structure / reading unit / bounds:** introduction > complete play > role/speech/song/dance blocks; one play; title to next title.
- **extent / caveats:** Full Waley anthology. Preserve role labels, song/chorus divisions, and stage notes; make clear this is a selected repertory, not “complete Noh.”

### E10 — *A Hundred and Seventy Chinese Poems*

- **author / shelf / division:** named Chinese poets; trans. Arthur Waley; `eastern`; `imaginative`
- **edition / source / basis:** Alfred A. Knopf, New York, 1919 (London first ed. 1918); [Project Gutenberg #42290](https://www.gutenberg.org/ebooks/42290); `pre-1930-us`
- **evidence:** The source identifies Waley and the early U.S. edition; the anthology and all translations predate 1930.
- **why:** The anthology makes occasion—parting, office, age, weather, war—carry thought without requiring discursive explanation. Its named poets and chronological groupings provide a usable counterweight to anonymous “wisdom of the East” compilations.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *The Book of Poetry*, troubadour lyric, *A Hundred Verses from Old Japan*
- **structure / reading unit / bounds:** chronological/author group > titled poem > note; one poem; title to next title.
- **extent / caveats:** Full Waley anthology, not a complete national corpus. Retain author, dynasty/date, and notes; do not silently modernize Wade-Giles names.

### E11 — *The Shih King, or Book of Poetry*

- **author / shelf / division:** anonymous early Chinese poets; trans. James Legge; `eastern`; `classical`
- **edition / source / basis:** *Sacred Books of the East*, vol. 3, Clarendon Press, 1879; [Project Gutenberg #9394](https://www.gutenberg.org/ebooks/9394); `author-death-70`
- **evidence:** The source names Legge and the 1879 volume; Legge died in 1897 and the source poems are ancient.
- **why:** Refrain and image make social relation memorable before commentary explains it. The collection belongs among foundations because later Chinese poetic reading repeatedly begins by hearing these songs through an inherited arrangement.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *A Hundred and Seventy Chinese Poems*, *The Ramayan*, troubadour lyric
- **structure / reading unit / bounds:** part > book > numbered ode > stanza; one ode; number/title to next.
- **extent / caveats:** Full Legge volume. Keep Legge's notes as optional apparatus and expose his Victorian interpretive frame; preserve repeated lines exactly.

### E12 — *A Hundred Verses from Old Japan*

- **author / shelf / division:** the *Hyakunin Isshu* poets; trans. William N. Porter; `eastern`; `imaginative`
- **edition / source / basis:** Clarendon Press, 1909; [Internet Archive scan `100VersesFromOldJapan`](https://archive.org/details/100VersesFromOldJapan); `author-death-70`
- **evidence:** The scan names Porter, the complete hundred-poem sequence, and 1909; Porter died in 1929.
- **why:** The fixed one-poet/one-poem architecture turns selection and sequence into a second composition. It offers a finite, complete lyric object whose recurrence can be read without pretending to stand for all Japanese poetry.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; Waley's Chinese poems, troubadours, *The Book of Poetry*
- **structure / reading unit / bounds:** 100 numbered poet-poem entries with notes; one entry; number to next.
- **extent / caveats:** Full 100-poem anthology. Preserve Japanese names, attribution, order, and Porter's notes; his rhymed English is an interpretation, not a transparent equivalent.

### E13 — *Kwaidan: Stories and Studies of Strange Things*

- **author / shelf / division:** Lafcadio Hearn; `eastern`; `imaginative`
- **edition / source / basis:** Houghton, Mifflin, Boston/New York, 1904; [Project Gutenberg #1210](https://www.gutenberg.org/ebooks/1210); `pre-1930-us`
- **evidence:** The source reproduces Hearn's 1904 American edition; Hearn died the same year.
- **why:** Hearn's restraint lets repetition and withheld explanation do the frightening. The final insect studies alter the scale of the preceding tales and must remain part of the designed volume.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *Strange Stories from a Chinese Studio*, Noh plays, Indigenous narrative collections
- **structure / reading unit / bounds:** titled story/study > internal sections; one complete story or study; title to next.
- **extent / caveats:** Full volume, including “Insect-Studies.” Hearn is an intercultural literary mediator, not an anonymous conduit for Japan; identify source debts where known.

### E14 — *The Gulistan; or, Rose Garden of Sa'di*

- **author / shelf / division:** Sa'di; `eastern`; `imaginative`
- **edition / source / basis:** trans. Edward Rehatsek, 1888; [Project Gutenberg #13060](https://www.gutenberg.org/ebooks/13060); `author-death-70`
- **evidence:** The source names Rehatsek's nineteenth-century translation; Sa'di and Rehatsek are beyond life plus 70.
- **why:** Brief stories, maxims, and verse correct one another so that wisdom never settles into a single tone. The book's designed alternation is more important than harvesting detachable quotations.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Decameron*, *The Arabian Nights*, Montaigne
- **structure / reading unit / bounds:** preface > eight chapters > numbered/paragraph tales and verses; one tale cluster; heading or narrative boundary to next.
- **extent / caveats:** Full Rehatsek translation. Preserve prose/verse distinction and chapter order; transliteration and period vocabulary require a glossary.

### E15 — *Rubáiyát of Omar Khayyám*

- **author / shelf / division:** Omar Khayyam, attributed corpus; trans. Edward FitzGerald; `eastern`; `imaginative`
- **edition / source / basis:** FitzGerald's four principal editions, 1859–79, with variants; [Project Gutenberg #246](https://www.gutenberg.org/ebooks/246); `author-death-70`
- **evidence:** The source contains public-domain FitzGerald texts and edition variants; translator died in 1883.
- **why:** This is acquired as a major English poetic recreation, not as transparent access to Khayyam. Holding its variants makes revision visible and prevents a composite “definitive” sequence from erasing FitzGerald's changing design.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *The Gulistan*, *A Hundred Verses from Old Japan*, Dickinson
- **structure / reading unit / bounds:** edition > numbered quatrain; one quatrain, with cross-edition variant links; number to next.
- **extent / caveats:** Full variants supplied by the source. Catalog both attributed author and translator; do not call the English a literal Persian translation.

### E16 — *Romance of the Three Kingdoms*

- **author / shelf / division:** Luo Guanzhong, traditional attribution; `eastern`; `imaginative`
- **edition / source / basis:** trans. C. H. Brewitt-Taylor, Kelly & Walsh, Shanghai, 2 vols., 1925; scan-backed Wikisource [vol. I](https://en.wikisource.org/wiki/File:Romance_of_the_Three_Kingdoms_-_tr._Brewitt-Taylor_-_Volume_1.djvu) and [vol. II](https://en.wikisource.org/wiki/File:Romance_of_the_Three_Kingdoms_-_tr._Brewitt-Taylor_-_Volume_2.djvu); `author-death-70`
- **evidence:** The scan title page names Brewitt-Taylor and the 1925 two-volume edition; translator died in 1938, beyond life plus 70.
- **why:** Strategy, oath, rumor, and retrospective judgment make history legible without making it controllable. Its vast cast and repeated shifts of allegiance demand entity-aware navigation, not abridgement.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *The Shahnameh*, *War and Peace*, *The Mahabharata*
- **structure / reading unit / bounds:** two volumes > 120 chapters > poem/prose blocks; one chapter; chapter heading to next.
- **extent / caveats:** Both volumes, all 120 chapters. Pin both scans in one manifest; preserve names as Brewitt-Taylor gives them and add aliases separately.

## Indigenous Traditions

### I01 — *Tsimshian Mythology*

- **author / shelf / division:** primarily told and written in Sm'algyax by Henry W. Tate (Tsimshian); edited by Franz Boas; `indigenous`; `imaginative`
- **edition / source / basis:** Bureau of American Ethnology, 31st Annual Report, GPO, 1916; [Internet Archive scan](https://archive.org/details/tsimshianmytholo00boas); `us-government-work`
- **evidence:** The federal report identifies Tate's recorded texts, Boas's editorial role, community, and publication by the U.S. Government Printing Office.
- **why:** Tate's large connected body of narratives offers far more than motif specimens; recurrent names, places, crests, and transformations make a world across tellings. It is the strongest next Indigenous acquisition because the language-bearing contributor can be named.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Haida Texts and Myths*, *Tlingit Myths and Texts*, *The Kalevala*
- **structure / reading unit / bounds:** analytical introduction > numbered Tate texts > English renderings/notes; one numbered narrative; title/number to next.
- **extent / caveats:** Full report section and texts. Credit Tate before Boas, retain Sm'algyax where printed, and seek Tsimshian review before public presentation or pronunciation features.

### I02 — *Tlingit Myths and Texts*

- **author / shelf / division:** named and unnamed Tlingit narrators; recorded and translated by John R. Swanton; `indigenous`; `imaginative`
- **edition / source / basis:** BAE Bulletin 39, GPO, 1909; [Library of Congress item](https://www.loc.gov/item/2024780784/); `us-government-work`
- **evidence:** The federal bulletin identifies Swanton, the Tlingit language materials, and the Government Printing Office; the LOC record supplies the complete scan.
- **why:** The volume joins narrative to language rather than extracting plots into folklore types. Its value rises where speakers and clans are named, and its silences about others must remain visible.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Tsimshian Mythology*, *Haida Texts and Myths*, *Kutenai Tales*
- **structure / reading unit / bounds:** myths > texts with interlinear/translation material > vocabulary; one numbered narrative; heading to next.
- **extent / caveats:** Full bulletin. Preserve Tlingit text and translation alignment; audit every narrator credit and consult current Tlingit institutions about culturally restricted material.

### I03 — *Haida Texts and Myths: Skidegate Dialect*

- **author / shelf / division:** Skidegate Haida narrators; recorded and translated by John R. Swanton; `indigenous`; `imaginative`
- **edition / source / basis:** BAE Bulletin 29, GPO, 1905; [Smithsonian repository record](https://repository.si.edu/items/d6c9f2a9-7aa6-4303-b5e5-e11b3546b904); `us-government-work`
- **evidence:** The Smithsonian copy identifies the federal bulletin, Skidegate dialect, Swanton, and 1905 publication.
- **why:** Parallel language and translation make narrative form inspectable at the level of repetition, names, and speech. This is an accession of documented Haida performances under colonial collection conditions, not a generic mythology book.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Tlingit Myths and Texts*, *Tsimshian Mythology*, *Traditions of the Thompson River Indians*
- **structure / reading unit / bounds:** part > numbered text/myth > paragraph/aligned passage; one numbered narrative; number/title to next.
- **extent / caveats:** Full bulletin. Preserve X̱aad Kíl material and typography; verify teller names from preliminaries and request community review for access controls.

### I04 — *Kutenai Tales*

- **author / shelf / division:** Ktunaxa narrators, including Alexander; recorded by Franz Boas and Alexander F. Chamberlain; `indigenous`; `imaginative`
- **edition / source / basis:** BAE Bulletin 59, GPO, 1918; [Smithsonian PDF](https://repository.si.edu/bitstream/handle/10088/15526/bulletin591918smit.pdf) and [Wikisource transcription](https://en.wikisource.org/wiki/Kutenai_Tales); `us-government-work`
- **evidence:** The federal title page names Boas, Chamberlain, and the 1918 GPO bulletin; the work includes Kutenai texts, translations, and tale notes.
- **why:** Separate collecting moments let the reader see variation rather than a falsely singular “tribal version.” Its linguistic record and explicit source notes make it a responsible candidate if the Archive preserves those differences.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Tlingit Myths and Texts*, *Traditions of the Thompson River Indians*, *Twenty-Two Goblins*
- **structure / reading unit / bounds:** collector/source group > numbered tale > original/translation/note; one tale; heading to next.
- **extent / caveats:** Full bulletin. Use the scan as authority over Wikisource, retain Ktunaxa language, and verify the identity represented only as “Alexander” before display.

### I05 — *Traditions of the Thompson River Indians of British Columbia*

- **author / shelf / division:** Nlaka'pamux narrators; collected by James Teit; `indigenous`; `imaginative`
- **edition / source / basis:** American Folk-Lore Society/Houghton Mifflin, 1898; [Internet Archive scan](https://archive.org/details/traditionsofthom00teit); `pre-1930-us`
- **evidence:** The scan identifies Teit, the Thompson River community, named source acknowledgments, and the 1898 Boston/New York publication.
- **why:** Teit's long residence, family ties, and language knowledge yield narrative sequences and local distinctions absent from motif harvesting. The book is still mediated ethnography, but its accountability is unusually inspectable for its date.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Kutenai Tales*, *Haida Texts and Myths*, *Traditions of the Skidi Pawnee*
- **structure / reading unit / bounds:** cycle/category > numbered tradition > variants/notes; one numbered narrative plus its variants; heading to next.
- **extent / caveats:** Full volume. Restore narrator/community metadata from notes into records without implying individual authorship where the source does not; consult Nlaka'pamux authorities on circulation.

### I06 — *Traditions of the Skidi Pawnee*

- **author / shelf / division:** Skiri Pawnee narrators; collected by George A. Dorsey with James R. Murie (Pawnee); `indigenous`; `imaginative`
- **edition / source / basis:** American Folk-Lore Society/Houghton Mifflin, 1904; [Hathi/Internet Archive scan](https://archive.org/details/ack0569.0001.001.umich.edu); `pre-1930-us`
- **evidence:** The title matter names Dorsey, the Skidi/Skiri Pawnee corpus, and 1904 U.S. imprint; Murie's language and cultural work is documented in the volume.
- **why:** Murie's presence makes this more than an outsider's tale harvest, and the organized cycles preserve relations among stories. The acquisition should correct the title page's unequal credit rather than reproduce it as the last word.
- **functions / rhymes:** `install-pattern`, `generate-connection`, `serve-recursion`; *Traditions of the Thompson River Indians*, *Tsimshian Mythology*, *Aw-Aw-Tam Indian Nights*
- **structure / reading unit / bounds:** cycle > numbered tradition > note; one numbered tradition; heading to next.
- **extent / caveats:** Full volume. Credit Murie prominently, use the community's current preferred name alongside historical “Skidi,” and seek Pawnee review for ceremonial restrictions.

### I07 — *Zuñi Folk Tales*

- **author / shelf / division:** Zuni narrators, incompletely named; recorded and translated by Frank Hamilton Cushing; `indigenous`; `imaginative`
- **edition / source / basis:** G. P. Putnam's Sons, New York, 1901; [Project Gutenberg #54682](https://www.gutenberg.org/ebooks/54682); `pre-1930-us`
- **evidence:** The source title page names Cushing and the 1901 American imprint; the exact edition predates 1930.
- **why:** The collection has narrative density and evidence of sustained language contact, but its literary polish also makes Cushing's shaping unusually active. It belongs only if the interface teaches readers to see that mediation.
- **functions / rhymes:** `induce-state`, `generate-connection`, `serve-recursion`; *Aw-Aw-Tam Indian Nights*, *Kutenai Tales*, *Kwaidan*
- **structure / reading unit / bounds:** thematic group > titled tale > internal episode; one complete tale; title to next.
- **extent / caveats:** Full volume. Narrator names are often absent, some knowledge may be sensitive, and “Zuñi” is retained only as the historical title; consult the Pueblo of Zuni before release.

### I08 — *Aw-Aw-Tam Indian Nights*

- **author / shelf / division:** told by Comalk-Hawk-Kih (“Thin Buckskin”), Akimel O'odham; interpreted by Edward Hubert Wood; recorded by J. William Lloyd; `indigenous`; `imaginative`
- **edition / source / basis:** West Coast Magazine, 1911; [Project Gutenberg #38064](https://www.gutenberg.org/ebooks/38064); `pre-1930-us`
- **evidence:** The source identifies teller, interpreter, recorder, community, and 1911 U.S. publication.
- **why:** The unusually explicit chain from teller through interpreter to recorder makes the collection's mediation legible instead of hiding it behind “traditional.” Its night-by-night sequence preserves the event of telling as part of the work.
- **functions / rhymes:** `induce-state`, `install-pattern`, `generate-connection`, `serve-recursion`; *Traditions of the Skidi Pawnee*, *The Arabian Nights*, *Tsimshian Mythology*
- **structure / reading unit / bounds:** prefatory chain of custody > nights > titled/numbered narratives; one night or complete narrative; night/title heading to next.
- **extent / caveats:** Full volume. Use Akimel O'odham in current metadata, retain the historical title as title, credit all three roles, and seek community guidance before public release.

## Form & Design cross-shelf

The repository describes shelves as two axes but currently gives each work one scalar `shelf`. That cannot represent “Eastern and about form” at the same time. Do not move the works below out of their tradition shelves to solve that defect. Add an optional array such as `subjectShelves: ['form']`; keep `shelf` as the tradition shelf until the schema is migrated to `traditionShelf`.

The following imaginative works merit the cross-shelf because their designed structure is itself a principal reason to hold them:

| Work | Tradition | Form & Design reason |
|---|---|---|
| *The Divine Comedy* | Western | Three-part moral architecture; canto as navigable chamber |
| *The Canterbury Tales* | Western | Frame, teller order, interruption, and incomplete sequence |
| *The Decameron* | Western | Ten-day rule system organizing 100 stories |
| *The House of Atreus* | Western | Trilogy-scale conversion of vengeance into adjudication |
| *Don Quixote* | Western | A second part that reads and changes the first |
| *The Faerie Queene* | Western | Virtue-by-book architecture expanding into incompletion |
| *Moby-Dick* | Western | Deliberate collision of novel, drama, sermon, catalog, and science |
| *Mrs Dalloway* | Western | Clock time and associative transition in a chapterless day |
| *Swann's Way* | Western | Nested recollection and the sentence as an instrument of recovery |
| *Ulysses* | Western | Eighteen episodes whose changing styles are the novel's organizing system |
| *The Mahabharata* | Eastern | Frame within frame; instruction embedded in consequence |
| *The Arabian Nights* | Eastern | Survival organized by nested narration and deferred closure |
| *Twenty-Two Goblins* | Eastern | Recurrent riddle-and-return loop |
| *The Nō Plays of Japan* | Eastern | Entrance, song, dance, and revelation rather than scene alone |
| *A Hundred Verses from Old Japan* | Eastern | One-poet/one-poem constraint and inherited sequence |
| *Tsimshian Mythology* | Indigenous | Recurring persons, places, and transformations across a narrated corpus |
| *Aw-Aw-Tam Indian Nights* | Indigenous | The nights preserve the temporal design of the telling event |

## Wanted, not cleared

These absences are decisions about exact English editions, not judgments that the source works are secondary.

### *Journey to the West*

- Timothy Richard's 1913 *A Mission to Heaven* is radical adaptation/abridgement; Arthur Waley's 1942 *Monkey* is also abridged; the first complete Anthony C. Yu translation (1977–83) remains copyrighted.
- **decision:** do not ingest a partial text under the canonical title. Recheck when a complete translation with an acceptable basis becomes available.

### *The Tale of Genji*

- Arthur Waley's English sequence begins before 1930, but the complete six-volume translation depends on later volumes issued in the 1930s. The Gutenberg text commonly encountered as *The Tale of Genji* contains only the opening portion, not the complete work.
- **decision:** do not join editions with different rights states or present nine chapters as the novel. A Stanford renewal query for the post-1929 volumes could not be completed in this review because the database's automated endpoint returned a human-verification challenge; the edition therefore remains uncleared.

### *The Pillow Book*

- Waley's 1928 English volume explicitly selects roughly a quarter of the source. It is an important historical selection, but not a complete translation.
- **decision:** hold for a future “historic adaptations and selections” policy; do not accession it as the complete *Pillow Book*.

### *Water Margin*

- Pearl S. Buck's 1933 *All Men Are Brothers* and J. H. Jackson's 1937 *Water Margin* sit in the renewal-era investigation window and represent different textual/translation problems.
- **decision:** neither enters this slate. The Stanford endpoint returned a human-verification challenge during this pass, so absence of a result is not evidence of absence of renewal.

### *The Tale of the Heike*

- No complete, readable English translation located for this review has an independently verified acceptable basis. Early English material is excerpted.
- **decision:** do not assemble a synthetic text from excerpts.

### *Man'yōshū*

- Pre-1930 English sources offer selections, not a complete named translation of the anthology.
- **decision:** acquire the complete *Hyakunin Isshu* object now; keep *Man'yōshū* wanted.

### *The Conference of the Birds*

- Edward FitzGerald's nineteenth-century *Bird-Parliament* is an adaptation, and the widely read complete modern English translations remain protected.
- **decision:** a future adaptation shelf may hold FitzGerald under its own title; it must not substitute for Attar's complete work.

## Accession order

### Tranche A — build the load-bearing shelf (21)

1. *The Iliad*
2. *The Odyssey*
3. *The Aeneid*
4. *Metamorphoses*
5. *Beowulf*
6. *The Divine Comedy*
7. *The House of Atreus*
8. *The Oedipus Trilogy*
9. *Hamlet*
10. *Don Quixote*
11. *Paradise Lost*
12. *Moby-Dick*
13. *Pride and Prejudice*
14. *Middlemarch*
15. *The Brothers Karamazov*
16. *War and Peace*
17. *The Ramayan*
18. *The Mahabharata*
19. *The Shahnama*
20. *Romance of the Three Kingdoms*
21. *Ulysses*

This tranche establishes epic, tragedy, novel, and large-cycle navigation before the interface encounters the more difficult editorial cases.

### Tranche B — widen form and tradition (25)

Add the remaining Western drama and novels, including *The Storm of Steel* after U.S.-edition collation; *The Arabian Nights*; Kalidasa; *The Little Clay Cart*; Pu Songling; Noh; both Chinese poetry collections; *A Hundred Verses from Old Japan*; *Kwaidan*; and the *Gulistan*. These works test acts/scenes, nested tales, lyric sequences, continuous modernist prose, revision history, and cross-shelf Form & Design metadata.

### Tranche C — mediated corpora and specialist QA (20)

Add the medieval cycles, troubadour book, remaining Eastern collections, and all eight Indigenous works only after:

1. the interface can display teller, interpreter, collector, translator, editor, and community as distinct roles;
2. a source-language parallel view can be preserved where supplied;
3. community review/contact fields and access restrictions exist;
4. the source scan, normalized text, retrieval date, and SHA-256 digest are pinned;
5. every multi-volume holding has a machine-checkable completeness manifest.

The Indigenous titles are in the final technical tranche because they demand more accountability, not because they are of lower editorial priority. Community outreach should begin during Tranche A.

## Required data migration

The minimum content shape for this pass is:

```js
{
  traditionShelf: 'western' | 'eastern' | 'indigenous',
  subjectShelves: ['form'],
  division: 'classical' | 'literary' | 'imaginative' | 'esoteric',
  why: 'editorial judgment',
  functions: ['install-pattern'],
  rhymes: ['other-work-id'],
  provenance: {
    edition: 'exact imprint/printing',
    contributors: [{ name: '...', role: 'translator' }],
    year: 1925,
    basis: 'pre-1930-us',
    evidence: ['source-title-page', 'catalog-record']
  },
  structure: {
    levels: ['volume', 'book', 'chapter'],
    readingUnit: 'chapter',
    startRule: 'chapter heading',
    endRule: 'next chapter heading or end of work'
  },
  extent: 'full',
  caveats: ['...']
}
```

For a compatibility migration, derive the old `shelf` from `traditionShelf` and retain the stored division ID `literary` while rendering its label as “Discursive.” Do not encode a subject axis by replacing the tradition value.

## Rights and source gate

Before any entry moves from dossier to production:

- open the source object and transcribe its title page, including translator/editor, volume, place, publisher, and year;
- confirm that every volume in a claimed complete set is present;
- record one of the repository's four controlled bases exactly: `pre-1930-us`, `author-death-70`, `us-government-work`, or `cc0-or-pd-dedication`;
- for any substitute edition first published in 1929–1963, search the Stanford Copyright Renewal Database by title, author, translator, publisher, and variant title, then retain result URLs/screenshots and explain the conclusion;
- never infer rights from the source author's death while ignoring a translator, editor, notes, or later revision;
- treat a Gutenberg ebook as a derivative access copy, not proof that its unnamed base edition is the edition claimed;
- checksum the acquired scan and normalized text, and keep the scan available for audit.

## Acceptance checks

This dossier is ready for editorial approval when the following remain true:

- exactly 66 numbered proposals: W01–W42, E01–E16, I01–I08;
- every proposal contains author, shelf, division, exact edition, source, basis, evidence, editorial “why,” resonance functions, rhymes, structure, reading unit, boundaries, extent, and caveats;
- every basis value belongs to the repository's controlled vocabulary;
- every function belongs to `induce-state`, `install-pattern`, `generate-connection`, or `serve-recursion`;
- no proposal depends on a 1929–1963 renewal conclusion;
- complete works are not replaced by routes, excerpts, or famous embedded sections;
- every Indigenous proposal distinguishes community/teller, interpreter, collector/editor, and source language as far as the historical record permits.
