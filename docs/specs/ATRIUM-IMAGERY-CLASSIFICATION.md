# Atrium Imagery — Sequence Classification

**Companion to:** ATRIUM-IMAGERY-SPEC.md
**Scope:** all 81 launchable Atrium points (23 philosophy, 58 history)

---

## The finding

The imagery service treats every sequence as a curation problem: find the
right pinned works and the reading has its pictures. That assumption holds
for **26 of 81 sequences**. For the other 55 it is the wrong tool, and the
day spent auditing Wikimedia categories was largely the cost of discovering
this the slow way.

Sequences divide into three kinds by *what imagery they could possibly want*:

| Type | Count | What it needs |
|---|---|---|
| **Depicted** | 26 | Pinned museum works — curation, done once |
| **Conceptual** | 51 | Procedural fields — no canonical imagery exists |
| **Mechanism** | 4 | Blueprint procedural — drawings, not portraits |

The classification is not a judgment about importance. The Somerset judgment
and the Haitian Constitution are among the most consequential documents in
the corpus; they simply were not painted.

---

## DEPICTED (26) — pin museum works

A famous depiction exists that a reader would recognize mid-passage. This is
where curation compounds: the work is finite, verifiable, and permanent.

**Philosophy (9).** The named thinkers — Heraclitus, Plato, Aristotle, Philo
of Alexandria, Plotinus, Porphyry, Augustine, Pseudo-Dionysius, Boethius.

**History (17).** Events with canonical iconography — Boston Massacre, Boston
Tea Party, Lexington and Concord, Declaration of Independence, Yorktown, the
Constitutional Convention, the Estates-General, Storming of the Bastille, the
Declaration of the Rights of Man, the Women's March on Versailles, the
Saint-Domingue uprising, the First Republic, the fall of Robespierre, 18–19
Brumaire, Haitian independence, the Napoleonic Wars, Seneca Falls.

**Status:** 11 collections and 57 works are pinned, but only **3 of the 26
depicted sequences** are directly served (Plato, Aristotle, Storming of the
Bastille). The rest of the pinned work — Socrates, Cicero, Diogenes,
Demosthenes, Marcus Aurelius, Stoicism, Rousseau — attaches to *conceptual*
sequences or to figures who are not themselves launch points. That is not
wasted: those collections are correct and will be reused. But it means the
depicted backlog is **23 sequences**, not the handful it appeared to be.

The remaining 23 split cleanly by institution:
- **7 philosophy figures** (Heraclitus, Philo, Plotinus, Porphyry, Augustine,
  Pseudo-Dionysius, Boethius) — late-antique and medieval, where the Met's
  manuscript and print holdings are the likeliest source.
- **16 history events**, heavily American, Haitian, and revolutionary-French.
  Neither the Met nor Cleveland covers these well; NYPL Digital Collections
  and the Library of Congress are the strongest candidates, and both would
  need a new adapter.

---

## CONCEPTUAL (51) — procedural fields

**No canonical imagery exists**, and forcing one produces exactly the noise
the audit found. "Category:Stoicism" returned a Balinese toddler and
children's picture books not because Commons is careless but because there is
genuinely nothing to return: Stoicism is an argument, not a scene.

This is the largest group and includes some of the strongest readings.

**Philosophy (14).** Schools, traditions, and movements — Milesian Inquiry,
Eleatic Philosophy, the Pluralists, Early Atomism, the Sophistic Movement,
Socratic Inquiry, the Peripatetic Tradition, Epicureanism, Roman Stoicism,
Pyrrhonian and Academic Skepticism, Middle Platonism, Iamblichean Platonism,
Athenian Neoplatonism.

**History (37).** Treaties, statutes, constitutions, and published arguments —
the Seven Years' War, the Social Contract, Treaty of Paris (both), the Stamp
Act, the Somerset judgment, Common Sense, the Federalist, Equiano's Narrative,
the Declaration of the Rights of Woman, the Bill of Rights, Sonthonax's
proclamation, the Constitution of Saint-Domingue, the Civil Code, the Slave
Trade Act, Bolívar's Jamaica Letter and Angostura address, the Congress of
Vienna, the Monroe Doctrine, the Slavery Abolition Act, the Communist
Manifesto, and the Latin American independence declarations.

**These sequences already have their answer.** Genesis, the attractor field
(now with five filament colors and the kaleidoscope), Turrell apertures, the
harmonograph, and fractal fields are all beautiful and thematically neutral in
the right way — they accompany an argument without pretending to illustrate
it. Falling back to procedural is *correct here*, not a compromise.

The remaining work is assignment, not acquisition: choose which procedural
surface suits each reading's temperament. That is an afternoon of taste, not
weeks of curation.

---

## MECHANISM (4) — blueprint procedural

Watt's steam-engine patent, Arkwright's spinning frame, Cartwright's power
loom, the Stockton and Darlington Railway.

These passages are about **mechanism** — the separate condenser, the governor,
the linkage converting reciprocating motion to rotary. Open collections hold
portraits *of the inventors*: a seated gentleman in mezzotint, a gold medal,
cigarette cards. That is a picture of a man who invented something, not the
thing he invented, and no better searching closes the gap because that imagery
was never collected as art.

**The right surface is a procedural blueprint engine** — plates, gears,
sectional cutaways, pressure curves, drafting hatching on a dark ground. Four
sequences is enough to justify building it, and it would generalize to any
future technical subject.

---

## What this changes

1. **Curation is bounded.** 26 sequences need pinned works, not 81 — but 23
   of those 26 are still unserved, concentrated in American, Haitian, and
   late-antique subjects. Bounded is not the same as nearly finished.

2. **Most sequences are already served.** The 51 conceptual readings need
   assignment to existing procedural surfaces, which is taste rather than
   acquisition.

3. **One engine to build.** The blueprint generator serves 4 sequences now and
   any technical subject later.

4. **The fallback is a feature.** A conceptual sequence with no pinned
   collection falling through to procedural is the correct outcome. The
   imagery service should not be extended to cover them.

---

## Method

Classified from the corpus's own metadata — philosophy `kind`
(thinker vs. school/tradition/movement) and history `lanes` — then corrected
by judgment where the heuristic misread. Two corrections worth noting:

- The **Communist Manifesto** carries an `economic-technology` lane and was
  first sorted as MECHANISM. It is a published argument; corrected to
  CONCEPTUAL.
- The **Declaration of Independence** carries `ideas-publication` and was
  first sorted as CONCEPTUAL. Trumbull's painting is among the most
  reproduced images in American art; corrected to DEPICTED.

The heuristic is a skeleton, not an oracle — the same lesson the imagery audit
taught about automated quality metrics.
