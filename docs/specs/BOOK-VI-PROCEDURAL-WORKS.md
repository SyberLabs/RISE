# Book VI — the procedural works

*Milton's Book VI mapped figure by figure, with design briefs for the
engines that do not exist yet. Written 2026-07-31, after the first of
them shipped.*

A **figure** is an engine bound to a place in a passage. The mapping
lives in `src/content/journeys/war.js`; the engines live in
`src/visuals/paradise_lost/`. `fromLine` is the line as the edition
prints it, and each figure holds until the next begins.

**Book VI wants ten. Six exist.**

---

## 0. The rule the whole set obeys

The figures are a sequence, not a gallery. Each has to be legible
*against the one before it*, because the movement's argument is that war
enters an order that was previously whole.

That gives one structural constraint the engines must hold between them:

| register | motion | figures |
|---|---|---|
| **order** | rigid — rotation and translation only, no element has its own velocity | heaven-in-order |
| **collision** | rigid bodies meeting; deformation at contact only | adamant-array |
| **conspiracy** | concealment, occlusion, things happening out of sight | council-in-darkness |
| **invention** | growth, accretion, something being *made* | the-invention |
| **discharge** | emission — the first figure where matter leaves its source | deep-throated-engines |
| **counterforce** | mass displaced; landscape used as ammunition | uprooted-mountains |
| **judgment** | a power that was never contesting, arriving | the-chariot |
| **rout** | order failing all at once | the-expulsion |
| **dissolution** | no order left to fail | nine-days-falling |

The reader should feel the transition from register 1 to register 2 as
*the moment things start moving on their own*. If every engine has
particles drifting, that moment never lands, and the Journey's thesis
is carried by the text alone.

---

## 1. Built

| line | id | figure |
|---:|---|---|
| 0 | `heaven_in_order` | Dawn, the perpetual round, the quadrate on the plain |
| 251 | `flaming_sword` | "the sword of Michael smote, and felled" |
| 513 | `sulfur_magma` | "sulphurous and nitrous foam / They found, they mingled" |
| 712 | `chariot_deity` | "Ascend my chariot, guide the rapid wheels" |
| 857 | `fall_hypercube` | The crystal wall rolls inward; headlong from the verge |
| 872 | `dark_ocean_chaos` | "Nine days they fell: Confounded Chaos roared" |

Five of these predate the mapping and were written as a family. Only
`heaven_in_order` was written *to a line*, and it is the reference for
how the remaining four should be approached — read the passage, find
what it actually describes, and build that rather than a mood.

---

## 2. Wanted

Four engines. Each brief states the lines, what the poem says, the
figure's job in the sequence, and the trap.

### 2.1 `adamant_array` — the hosts meet (112–250)

> *"'Twixt host and host but narrow space was left, / A dreadful
> interval, and front to front / Presented stood in terrible array / Of
> hideous length"* — VI.105-108

Abdiel strikes the first blow; the armies close; "the horrid shock."

**Job.** The first breach of register 1. Two rigid orders meet and
neither yields. Deformation exists *only at the contact surface* — this
is the last figure in which the ranks still hold behind the line.

**Form.** Two opposed lattices, each internally exact, advancing on a
seam. Energy concentrates along the interface: brightness, compression,
interpenetration at the boundary and nowhere else. When the seam
releases, it releases locally.

**Trap.** Do not make it an explosion. Book VI's first day ends with
neither side broken, and an engine that scatters here spends the
Journey's one big gesture eleven hundred lines early. It should look
*held*, and strained.

**Palette.** `heaven_in_order`'s empyreal gold on one side, adamant —
cold white, steel — on the other. First appearance of a second colour
authority in the movement.

---

### 2.2 `council_in_darkness` — the first night (407–512)

> *"Now Night her course began, and, over Heaven / Inducing darkness,
> grateful truce imposed"* — VI.406-407

The first night in Heaven. The rebel council meets inside it.

**Job.** Conspiracy. The only figure in Book VI where the subject is
something the reader is *not shown*. Its whole content is occlusion.

**Form.** The perpetual round of `heaven_in_order` seen from the wrong
side — the same mechanism, mostly eclipsed. Light survives at edges and
rims. Shapes are inferred from what they block rather than drawn.
Consider literally reusing the round's geometry at very low key: the
recurrence is the point, because this is the same Heaven with the light
withdrawn.

**Trap.** Darkness is not an absence of drawing. A near-black frame
reads as a bug or a failed load, and the field must never be mistaken
for a broken one. Keep a rim, a residue, something that proves the
canvas is live.

**Palette.** `pre_dawn` — the cold variant already defined in
`heaven_in_order._palette()`. Reuse it deliberately; it was written for
this.

---

### 2.3 `deep_throated_engines` — the cannonade (589–663)

> *"disgorging foul / Their devilish glut, chained thunderbolts and hail
> / Of iron globes"* — VI.589-591

The artillery invented at 513 is fired.

**Job.** The movement's own counterpressure, and the figure the third
movement will answer. First emission: matter leaving a source and
travelling.

**Trap, and it is the important one in this whole document.** It must
**not** borrow Jünger's ballistics engines. `StormBallisticSpirographEngine`
and `StormIncendiaryBlastEngine` exist and would fit mechanically. The
Journey's argument is that Milton's cannon and the Somme are the same
event three centuries apart — and that only reads if each is drawn in
its own book's hand. If they look alike, the third movement has nothing
left to reveal, and the descent the Journey claims becomes a repetition.

**Form.** Milton's guns are *ordered*. They are drawn up in rank, aimed,
and discharged on command — closer to a siege engine or a foundry than
to shelling. Volleys, not chaos: discrete, simultaneous, aimed. The
smoke that "obscured all Heaven" is the residue that should persist
after each volley and never quite clear.

**Palette.** Sulphur and iron, continuous with `sulfur_magma` — this is
what that invention became.

---

### 2.4 `uprooted_mountains` — the hills uptorn (664–711)

> *"So hills amid the air encountered hills"* — VI.664

The loyal angels tear up the landscape and throw it.

**Job.** Counterforce, and the opposite gesture to the cannonade. Where
the guns emit small fast things from a fixed line, this displaces
enormous slow masses. It should not look like the figure before it in
any respect.

**Form.** Mass. Silhouette. Few, large, slow bodies on ballistic arcs
that a reader can follow individually — the antithesis of a particle
field. What the eye reads is weight and the shadow it casts, not
brightness.

**Trap.** This is the last loyal action before the Son arrives, and it
FAILS. Milton's point is that the war could not be ended this way. The
figure should feel like enormous effort rather than triumph — reaching a
kind of stalemate rather than a climax, so the chariot at 712 arrives
into exhaustion.

**Palette.** Earth and shadow. Least luminous figure in the movement;
the only one whose subject is opaque.

---

## 3. Implementation contract

Every engine in `src/visuals/paradise_lost/`:

- exports a class with `generate(signal, seed, options)`,
  `step(dt, signal)` and `render(canvas, options)`;
- returns `false` from `render` on a zero-area or missing canvas rather
  than throwing;
- draws a full frame if `render` is called before `generate`;
- keeps geometry derived from its own parameters, so a long reading
  cannot accumulate drift;
- is registered in `paradise_lost/index.js` under a `snake_case` id;
- is named by a figure in `war.js` under that exact id — an engine the
  registry does not have makes the field go still and warn, which is
  correct but is not what anyone wanted.

`WorkEngineField` scales `dt` by `TIME_SCALE` (0.3), so an engine tuned
in a preview pane will be three times slower behind the reading. Tune
against the field, not the preview.

---

## 4. What is NOT specified here

- **The Storm of Steel family.** Eight engines exist and were written as
  a family, not to lines. Guillemont has not been mapped figure by
  figure, and it should be, on the model of §2 — but the argument for
  Jünger is different (the perceptible whole disappears), and the
  figures may want to *stop* being legible as the chapter proceeds.
- **The Homeric movement.** It is sourced, not procedural — Attic vases,
  by decision. Nothing here applies.
- **Whether ten figures is right.** The mapping came from one reading of
  Book VI. The four gaps are the ones that reading found; another might
  find that 407-512 wants two figures, or that 664-711 belongs with the
  chariot.
