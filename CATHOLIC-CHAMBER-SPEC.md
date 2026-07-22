# The Catholic Chamber — Specification

**Status:** proposed
**Ambition:** the highest expression of the R.I.S.E. system to date
**Constraint that governs everything else:** this room holds material that is
sacred to its readers. Every design decision below is subordinate to treating
it that way.

---

## 0. The nature of the room

The Chamber reads text rhythmically. The Atrium curates and verifies. The
Catholic Chamber is something neither of them is: a room built around
**practices**, not merely readings. Lectio divina, the Rosary, the Stations of
the Cross are not texts with settings — they are structured acts with their own
tempo, repetition, and posture, refined over centuries. The system's job is to
host them faithfully, never to reinterpret them.

This is also the first true test of whether R.I.S.E. is a *reading environment*
or *one aesthetic*. Devotional reading has formal requirements no other corpus
has imposed: fixed prayer counts, liturgical sequence, the distinction between
Scripture and devotion, and translation identity. If the engine can hold these
without bending them, the architecture is genuinely general.

### Non-negotiables, stated first

1. **Translation identity is provenance.** Douay-Rheims, Challoner, RSV-CE and
   NABRE are not interchangeable. The room ships ONE translation, names it on
   every surface that shows its text, and never mixes translations within a
   session. (Recommendation in §2.)
2. **The readiness gates apply in full.** The Atrium's rights/edition/checksum
   machinery is the right standard for Scripture — *more* right, not less.
   Nothing here bypasses it because the project is personal.
3. **Fixed forms are fixed.** The Rosary has its decades; the Stations have
   their fourteen. No semantic-track improvisation, no probabilistic anything
   inside a fixed devotional structure. The conductor's cleverness stays
   outside this room's fixed forms.
4. **Sacred imagery is pinned, never searched.** The imagery audit's lesson
   applies at maximum strength: "Category:Jesus Christ" on Commons is a
   container full of noise. Every image in this room is a specific work chosen
   by a human, resolved by object id, with attribution. The Freedom engine's
   interpretive license has no equivalent here — this room does not editorialize.
5. **Reverent degradation.** When an image fails to load or audio is absent,
   the room falls back to stillness and text — never to a wrong image, never to
   silence-as-error. Absence is already a liturgical register.

---

## 1. The doorway

A small luminous icon in the main Portal — deliberately NOT a third strip.

The Portal now has a grammar: the nav row is tools you own; the Atrium door and
SOL strip are living invitations. The Catholic Chamber enters differently — as
a small, quiet, constant light. Like a sanctuary lamp: it does not advertise,
it burns.

- **Form:** a small glyph (✛ or an oil-lamp mark) at low opacity with a slow
  luminous breath (8s cycle, disabled under reduced-motion), placed in the
  portal's lower region near the footer — present on every visit, prominent on
  none.
- **No copy, no live detail.** Unlike the Atrium door it does not rotate
  content or make an offer. Hover reveals a single name: *"The Chapel."*
  (Naming note: calling the ROOM "The Chapel" keeps "Chamber" meaning what it
  already means everywhere else in the app; the spec title keeps the working
  name.)
- **Navigation:** a `chapel` view registered like every other, lazy-loaded,
  inside the payload boundary. The icon is the only entrance; the Chapel never
  appears in the nav row.

---

## 2. The corpus: the Catholic Bible

**All 73 books**, divided as books — which is both liturgically correct and
architecturally required: the full text is ~4.3M characters against the
compiler's 2M/source limit and 120k-atom ceiling. A book is the natural unit
on every axis (Genesis ~190k chars ≈ 20–35k atoms at Phrase — comfortably
inside every limit; Psalms is the largest and still fits as one source; if any
book ever presses the atom ceiling it divides at its traditional internal seams,
e.g. the five books of the Psalter).

### Translation

**Recommendation: Douay-Rheims, Challoner revision.** It is the only complete
Catholic Bible unambiguously in the public domain (Challoner d. 1781),
includes all deuterocanonical books, and its slightly elevated English suits
the room's register. RSV-CE and NABRE remain in copyright and are not options
for a shipped corpus. The choice is recorded in the manifest and displayed
with the text: *"Douay-Rheims · Challoner revision"* — translation identity as
provenance, per non-negotiable #1.

Source, verified live: **Project Gutenberg #8300** is the complete
Douay-Rheims Challoner revision, and Gutenberg also hosts it **per book**
(e.g. #8326 is Ecclesiasticus alone) — which maps one-to-one onto the corpus
structure below. Ingested once, checksummed per book with the same SHA-256
payload discipline the Atrium uses, then treated as immutable content.

Size math, verified against the compiler's real limits: Psalms, the largest
book, is ~250k chars ≈ ~13k Phrase atoms against the 2M-char / 120k-atom
ceilings — every book fits as a single source with wide margin.

### Structure

```
chapel/
  corpus/
    manifest.js          — 73 books: id, name, testament, grouping,
                           chapters, charCount, checksum, chunkProfile
    books/               — one payload module per book, outside the
                           browse import graph (payload-boundary rules)
  liturgy/
    rosary.js            — the fixed prayer sequences (§4)
    stations.js          — the fourteen stations (§5)
    hours-lite.js        — (later) morning/evening reading orders
  imagery/
    icons.js             — pinned iconography (§4)
    passion.js           — pinned Passion works (§5)
  chants.js              — the chant registry (§3)
```

Books are grouped as the Church groups them: Pentateuch, Historical, Wisdom,
Prophets; Gospels, Acts, Pauline epistles, Catholic epistles, Apocalypse. The
Chapel's book-selection surface presents these groupings, not an alphabetical
list.

### Chunking

A dedicated `scripture` chunk profile (the chunk-profile system built for the
Atrium is exactly the right seam):

- **Verse-aware:** verse numbers become quiet structural boundaries, not
  spoken content — stripped from display, preserved as navigation anchors.
- **Phrase mode default**, with authored breath where it matters most (the
  Psalms want line-level breaks; genealogies want Sentence mode's mercy).
- **Lossless and checksum-safe:** like the dialogue profile, it must run
  display-side of the payload checksum and leave unprofiled output
  byte-identical.

Default pacing: authored under the honest contract (write the speed you want —
per the preset-migration lesson, no legacy factors). Contemplative register:
~240 wpm label, which Phrase mode + verse structure will deliver in the
140–180 range that suits Scripture.

---

## 3. Sound: chant

Chant is not a soundscape in the existing sense (those are synthesized beds).
Chant is **recorded sacred music**, which introduces a rights question and an
asset-weight question before an aesthetic one.

### Rights, first

Chant *compositions* are ancient; chant *recordings* are not. Every recording
ships with verified license:

- **Preferred sources:** recordings explicitly released CC0/CC-BY (several
  monastic and scholar-led projects publish these), or performances old enough
  for recording-copyright expiry in relevant jurisdictions.
- Each entry in `chants.js` carries `{ id, title, form, performer, license,
  sourceUrl, duration }` — same discipline as the imagery service. **No
  recording without established rights. Silence is acceptable; infringement is
  not.**

### Registry

Two families at launch, expandable:

| Family | Form | Use |
|---|---|---|
| **Gregorian** | Ordinary chants (Kyrie, Sanctus, Agnus Dei), office hymns, psalm tones | Scripture reading bed; Stations |
| **Byzantine/Orthodox** | Znamenny or Byzantine-tone selections | Alternative bed; especially apt under the Pantocrator (§4) |

### Behavior

- Chant plays as a **bed** (exclusive with pure-tone presets, like
  soundscapes) with gapless looping or a long silence-gap loop — a chant that
  visibly "restarts" breaks the room.
- Fetched as audio assets with the engine's existing content-type guard (the
  HTML-for-mp3 lesson) and cached via SourceCache.
- **The Rosary and Stations may run in silence by design.** Chant is offered,
  never imposed; the default for fixed devotions is quiet.
- If no rights-cleared recording is available at launch, the Chapel opens with
  the existing Faded Signal/Aurora beds and a visible "chant coming" note —
  honest absence over compromised presence.

---

## 4. The Icon mode and the Rosary

### Icon focal

The focal system already does persistent centered imagery
(`visualMode: 'focals'`, `type: 'personal'`). The Chapel adds a third focal
type: `icon` — a **pinned, attributed sacred image** rendered as an icon is
displayed: centered, unhurried, with a warm low vignette (candlelight, not
spotlight).

Launch icons (pinned per imagery-service discipline — object/source id,
rights, attribution; candidates verified before the manifest is written, not
after):

- **Christ Pantocrator** — the Sinai Pantocrator (6th c., St. Catherine's) is
  the canonical choice; verify a rights-cleared reproduction (photographic
  reproductions of 2D public-domain works; confirm per source).
- **Marian icon** for the Rosary — Salus Populi Romani or Our Lady of
  Częstochowa; same verification.
- The icon focal renders with subtle treatment only: slow vignette breath,
  faint gold-leaf edge glow. **No semantic response, no motion on the image
  itself.** An icon is written, not animated.

### The Rosary — a fixed liturgical sequence

The Rosary is the first true test of non-negotiable #3, and it needs one new
engine capability: the **liturgy runner** — a sequence of fixed steps, each a
(text, repetition-count, focal-state) triple. This is deliberately the first
concrete instance of the roadmap's "choreography object": a higher-level
structure that tells the player what to show and when. Build it as a general
`LiturgyRunner` so the Stations (§5) and future offices reuse it.

Structure per tradition:

```
Sign of the Cross → Apostles' Creed → Our Father → 3 Hail Marys → Glory Be
→ five decades, each:
    Mystery announcement (with its fruit)
    Our Father
    10 Hail Marys        ← the count is the form; displayed as beads
    Glory Be · Fatima Prayer
→ Hail Holy Queen → closing prayer
```

- **Mysteries:** all four sets (Joyful, Sorrowful, Glorious, Luminous), user-
  selected, with the traditional day-of-week default offered gently.
- **Bead visualization:** a minimal bead strand marks position through the
  decade — the one place the interface adds something, because the physical
  rosary's job is exactly this: holding your place so attention can leave the
  counting.
- **Pacing:** prayers at recitation pace, not reading pace. A Hail Mary is
  ~12–14 seconds spoken; each repetition is one atom-group at fixed duration.
  User pace control still applies as a global multiplier.
- **Per-decade imagery:** each mystery may pin ONE work (e.g. an Annunciation
  for the first Joyful) shown as a still behind glass for the decade's
  duration — pinned works, not rotation.
- The Marian icon holds the focal throughout; mystery imagery appears behind-
  stream, never displacing it.

---

## 5. Renaissance imagery and the Stations of the Cross

### The Passion collection

Museum-API imagery via the **existing pinned-works service** — this room is
why that architecture was worth building. New collections in the established
format:

```
'chapel-crucifixion'   — pinned Crucifixion works (AIC, Met, Cleveland)
'chapel-passion'       — the wider Passion: Agony, Ecce Homo, Deposition, Pietà
'chapel-nativity'      — for Advent/Christmas reading and the Joyful Mysteries
'chapel-resurrection'  — for Easter reading and the Glorious Mysteries
```

Every work: contact-sheet reviewed by a human before pinning (the
`atrium-contact-sheet.mjs` tool as-is), full attribution displayed, rights
gate enforced. AIC's Old Masters range is strong here; the Met's European
Paintings will carry the rest. These collections are **Chapel-scoped**: never
in the browsable Collections list, arriving only with Chapel launches — same
isolation contract as `atr-` ids.

During Scripture reading, Passion collections attach to the relevant books
(the four Gospels' Passion narratives) as behind-stream imagery at long
presence (≥1400ms) — museum stillness, not rhythmic flashing.

### The Stations — fourteen fixed steps

The second LiturgyRunner instance:

- **Fourteen stations**, traditional form. Each: station title → pinned
  artwork (displayed as a held still, not a flash) → the traditional
  versicle ("We adore Thee, O Christ…") → a short meditation text → silence.
- **Progression is manual by default** — the reader moves between stations
  deliberately, as one walks a nave. An optional timed mode exists for those
  who want to be carried.
- **Imagery:** fourteen pinned works, one per station. A single coherent
  cycle is strongly preferred over fourteen unrelated masterpieces —
  candidates: a complete engraved Stations series (Tissot's Passion series,
  public domain; or a single printmaker's cycle from AIC/Met holdings).
  Coherence of the cycle outranks fame of the individual work.
- Station text (versicles and meditations): traditional public-domain forms
  (e.g. St. Alphonsus Liguori's, d. 1787), named and attributed like every
  other text in the system.

---

## 6. Christian procedural forms

Three engines exist and more are planned (arriving when the stage is ready).
The stage, prepared now:

- **Registry:** `chapel/procedural.js` maps engine ids to the cortex the same
  way blueprint and freedom registered — **Chapel-exclusive**, never in the
  browsable Visual panel. They arrive only with the room that gives them
  meaning (established pattern, established tests).
- **House rules apply in full:** still frames, no shadowBlur, deterministic
  under seed, null-ctx guard, ASCII polylines export.
- **One added rule for this room:** procedural forms accompany; they do not
  depict. Geometry, light, and pattern (rose windows, Cosmatesque ornament,
  illuminated-margin logics) are the right register. Depicting Christ remains
  the province of the pinned masterworks and written icons — a procedural
  engine should never generate a face.
- Integration seam: each engine drops into `src/visuals/` per the blueprint
  pattern (engine + test + cortex branch + config field), and the Chapel's
  launch configs reference them by id. When your three arrive, wiring each is
  a contained, reviewable change.

---

## 7. What must be built, in order

The dependency order — each stage independently shippable:

1. **Corpus ingestion** — DR-Challoner, 73 payload modules, manifest with
   checksums, the `scripture` chunk profile with tests. *(The room is real
   once Scripture reads well, even bare.)*
2. **The Chapel view + Portal icon** — book selection by liturgical grouping;
   launches into the Chamber with the scripture profile and contemplative
   defaults. Payload boundary extended; isolation tests per the Atrium pattern.
3. **Pinned imagery** — the four collections, contact-sheet reviewed; icon
   focal type with the Pantocrator and the Marian icon.
4. **Chant registry** — rights-verified recordings, bed playback, graceful
   absence.
5. **LiturgyRunner + the Rosary** — the fixed-sequence engine, beads, the four
   mystery sets.
6. **The Stations** — fourteen steps on the same runner, one coherent art cycle.
7. **Procedural forms** — stage wired; engines land as they arrive.

Stages 1–2 make the room real. 3–4 make it beautiful. 5–6 make it a chapel.

---

## 8. Acceptance

- [ ] Every displayed Scripture text names its translation and edition
- [ ] Every book payload is checksummed; profiles run display-side of checksums
- [ ] No image in the Chapel arrives by search; all pinned, attributed, rights-gated
- [ ] Every chant recording carries a verified license
- [ ] Rosary and Stations sequences are byte-fixed; no probabilistic behavior inside them
- [ ] Chapel-scoped collections and engines never appear in browsable panels
- [ ] The Chapel view sits inside the payload boundary; Chamber behavior is
      provably unchanged for non-Chapel readings
- [ ] Degradation is reverent: absence of an asset yields stillness, never a
      wrong asset and never an error surface mid-devotion
- [ ] Reduced-motion and photosensitivity settings honored everywhere,
      including the portal icon's breath
```
