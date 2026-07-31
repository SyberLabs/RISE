# The Experience Program — V2's missing abstraction

*Roadmap, 2026-07-31. Not implemented. This records a direction and the
reasoning for it, so the build order below can be started, paused, and
resumed without re-deriving the argument.*

---

## 0. The finding

Six proposals — a visual score editor, MP4 import, user engines, a Live
Curator, engine-registry scope, and RISE Chain — are not six features.
They are one missing abstraction:

> **A user-authorable media score over a compiled reading.**

The Sequence Creator already has the raw materials: source selection,
pacing, sequence images, global pools, focals, soundscapes, swells. But
those are configured as **pools and session-wide parameters**. What is
missing is the ability to author *relationships* between text, image,
video, audio, and procedural behaviour.

*War* already has that ability. It is hard-coded in a manifest, and only
we can write it.

---

## 1. The product model

| surface | role | analogy |
|---|---|---|
| **Chamber** | runtime and exploratory instrument | synthesiser, performance space |
| **Workshop + Vault** | authoring, storage, revision | DAW / studio |
| **Journeys** | published, editorially sovereign works | albums |

The Vault is not a fourth product; it is the Workshop's durable project
and publication library.

Then:

- **Live Curator** — an arranger, working through the validated score format
- **User procedural engines** — instruments/plugins
- **RISE Chain** — a generative sequencer
- **Journeys** — first-party published scores

Journeys can be the flagship public experience without displacing the
Chamber. A Journey demonstrates what the instrument becomes when
composed deliberately. The Chamber remains the deeper platform.

---

## 2. `rise.experience-program.v1`

One format, several tracks. **Journeys must not acquire a separate
runtime, and the Workshop must not grow a second visual-program format.**

```js
{
  schema: "rise.experience-program.v1",
  authority: "published" | "user" | "proposed",
  editable: false,
  tracks: [
    { id: "movements",   kind: "movement", clips: [] },
    { id: "visual-main", kind: "visual",   clips: [] },
    { id: "audio-bed",   kind: "audio",    clips: [] },
    { id: "audio-events",kind: "swell",    clips: [] }
  ]
}
```

**Tracks are independent.** A user must be able to change the image and
keep the sound. Where clips genuinely must move together, they share a
`syncGroup: "descent-1"` rather than collapsing into one cue type.

| authority | editable | meaning |
|---|---|---|
| `published` | no | a first-party Journey; provenance-gated |
| `user` | yes | a Vault sequence |
| `proposed` | yes, requires approval | a Live Curator result |

A first-party Journey is simply a published program with stricter
authorship. That is the whole difference.

---

## 3. The anchor rule — the most important technical constraint

> **Never bind authored media to atom IDs.**

Atoms are a product of chunking and compilation. A user authors against
phrase mode, later switches to sentence mode, and every assignment is
void. Worse: *we changed the chunker on the day this was written*, and
any atom-bound authoring would have silently moved.

Store a stable **source** coordinate:

```js
anchor: {
  sourceId: "my-source-1",
  fromCharacter: 842,
  toCharacter: 1137,
  quoteStart: "The first few words",
  quoteEnd: "the final few words"
}
```

The quote fingerprints are the integrity check, exactly as passage
checksums are for Journeys: if the text moved, the anchor must refuse
rather than land somewhere plausible.

Compilation is a lowering, and we have already built one:

```
    Journey (built)               User score (proposed)
    ───────────────               ─────────────────────
    edition line                  character span + quote
      → source progress             → source progress
      → atom range                  → atom range
      → procedural figure           → runtime cue
```

`Atom.sourceProgress` and the source-space `fromProgress`/`toProgress`
match already exist and were built for the Journey. The user-facing
version needs the character→progress step and nothing else structural.

---

## 4. The editor

A stable text pane with parallel lanes:

```
MOVEMENT  ──────── I ──────────── II ─────────────
VISUAL    [image A] [video B────] [engine C───────]
AUDIO     [bed 1───────────────]  [silence] [bed 2]
SWELL               [swell X]
VOICE     [recitation─────────────────────────────]
TEXT      The source text, selectable and highlighted
```

Select an asset, it takes an editor colour, paint a span of text. **The
colour is editor metadata; the compiled program carries the
relationship.** Internally `ProgramEditor`; publicly *Media Score* or
*Correspondence Editor*.

---

## 5. Video as a first-class visual work

Two distinct ideas, and only one belongs now:

1. **MP4 as an imported media object** — belongs in the Workshop today.
2. **Exporting a program as MP4** — a rendering/distribution pipeline,
   correctly deferred by the North Star. Still deferred.

```js
{ id: "video-1", kind: "video", mimeType: "video/mp4",
  durationMs: 18400, posterAssetId: "poster-1", audioPolicy: "muted" }
```

```js
cue: { kind: "video", assetId: "video-1",
       timeMode: "cue" | "fit-span" | "loop" | "hold-final",
       audioPolicy: "muted", reducedMotion: "poster" }
```

Default behaviour, and these are requirements rather than preferences:

- muted; no autoplay outside an active visual cue;
- paused whenever the reading pauses;
- cancelled when its cue loses authority;
- poster frame under reduced motion;
- **no invisible playback**;
- stillness or the poster on decode failure (reverent degradation).

If video audio is ever enabled it must **explicitly transfer audio
authority** — bed ducks or suspends, swells stay governed, bed restores
on end. Two things must never quietly compete for the same ear.

Sequence-local video only at first. A global video library raises
storage and lifecycle questions that can wait.

---

## 6. Engine registry scope

The vocabulary should be:

```
Engine = a reusable generative algorithm
Scene  = a configured realization of an engine
Work   = a semantically authored scene, bound to a source
```

**Native instruments** (Klee, Attractor, Turrell, Harmonograph, Fractal)
are general. Their meaning is not tied to a text.

**Procedural works** (`flaming_sword`, `chariot_deity`,
`heaven_in_order`, the Storm fields) are authored realizations whose
meaning depends on a passage.

**One registry.** This codebase has already paid four times for a
vocabulary living in two places where only one copy learned a new word.
Scope and visibility are fields, not separate lists:

```js
{
  id: "paradise-lost/heaven-in-order",
  type: "procedural-work",
  scope: "native" | "domain" | "work" | "user",
  visibility: "public" | "contextual" | "private",
  sourceBinding: ["paradise-lost"],
  engineId: "particle-field",
  liveCapable: true, snapshotCapable: true, reducedMotionCapable: true,
  editableParameters: []
}
```

The Chamber's browser filters `visibility: public`; the Journey compiler
may use `contextual`; the user's library sees `scope: user`. That keeps
"Michael's Flaming Sword" out of a menu beside "Fractal Flame" without a
second allowlist.

---

## 7. Live Curator

The North Star's law already governs: **the doorway proposes; the
engine's validators dispose.**

The model receives a *capability document* — `rise.curator-context.v1`:
available sources with their divisions and passage locators, available
visual works, procedural works and soundscapes, and constraints (target
minutes, max movements, max visual density, sacred rules). It returns a
`rise.experience-program.v1`.

It may select only registered IDs. It may not inject URLs, provide
executable code, add remote media, bypass provenance, invent collection
identifiers, override photosensitivity, or refer to text that does not
resolve.

```
AI output → schema validation → source/asset identity → rights and
provenance → anchor compilation → duration and density → accessibility
and safety → dry-run trace → human preview → Vault draft
```

**The first version needs no AI integration at all:**

```
Export Curator Context → hand the JSON to any model → paste the
proposed program back → validate and preview
```

That tests the real product idea with no provider keys, no API cost, no
conversation storage, and no new network authority. Direct integration
later uses the identical import boundary.

---

## 8. User engines — recipes before code

Raw uploaded JavaScript is the wrong first format. Code that is not even
malicious can allocate without bound, freeze rendering, loop forever,
ignore reduced motion, produce flashing, or behave differently across
sessions.

Start declarative — `rise.procedural-recipe.v1`:

```js
{
  schema: "rise.procedural-recipe.v1",
  seed: 18429,
  canvas: { dimensionality: "2d", background: "#000000" },
  nodes: [
    { id: "field", type: "flow-field",
      parameters: { scale: 0.04, turbulence: 0.28 } },
    { id: "particles", type: "particle-system",
      parameters: { count: 420, decay: 0.012 } }
  ],
  bindings: [
    { signal: "text.density", target: "particles.emission",
      map: [0, 1, 0.1, 0.7] }
  ]
}
```

RISE defines the node types and parameter ranges. A model can compose
them; it cannot invent an executable operation. This is a safe visual
programming language.

A later **Engine Capsule** tier could admit a shader or Wasm module in an
isolated worker: no DOM, no network, no storage, no audio, fixed canvas,
strict message protocol, frame-time watchdog, memory limits,
deterministic seed, termination on budget violation, mandatory
reduced-motion path, photosensitivity analysis before preview. It emits
pixels or draw commands and never receives the app, cortex, session, or
browser APIs.

```
1. parameterized native engines
2. declarative user recipes
3. bounded shader/Wasm capsules
4. never unrestricted same-origin JavaScript
```

---

## 9. RISE Chain — A Dream of History

Recombining words from books is not disrespectful; it belongs to
collage, cut-up, found poetry, and generative literature. The distinction
that matters is not *canonical text versus alteration* but **source
presentation versus derivative transformation**.

RISE Chain may fragment, reorder and recombine the Archive, provided it
never presents the result as an original passage from a source.

The stronger form couples four processes rather than illustrating one:

```
generated phrase → shifts visual dynamics → changes acoustic state
    → alters transition probabilities → conditions the next phrase
```

Not an illustrated Markov text: a single coupled stochastic organism
whose linguistic, visual and acoustic forms evolve together.

Two shapes — **Archive Dream** (the whole corpus, freely traversed) and
**Source-Bounded Chain** (the user selects a small corpus, and that
selection is itself an act of composition).

The required boundary:

> Generated from selected Archive sources. This text is a stochastic
> recomposition, not a quotation.

Genealogy stays inspectable — per-fragment work attribution and the seed
— without displaying citations continuously, which would destroy the
experience. Reveal it afterwards, like retrieving a dream's source
material.

**One humility in the framing.** This is not History dreaming; it is
*this Archive's dream of history*. The corpus is broad but selected,
translated, mediated and uneven. That does not weaken the work — it gives
the dream a particular body. Dreams are never complete inventories of
reality; they are recompositions of what entered memory.

Reference: John Akomfrah, *The Last Angel of History* (1996) — the Data
Thief moving through fragments in search of the code connecting past to
future, history surviving not as continuous record but as scattered
signals awaiting recomposition.

**Keep it out of production initially.** Not because it is inappropriate,
but because production pressure would immediately impose questions of
comprehension, attribution display, model size, performance, moderation,
replay, and whether generation could accidentally reproduce long source
passages. A private research prototype lets the artistic question be
asked first:

> What happens when a library ceases to be a collection of separate books
> and becomes a stochastic linguistic substance?

---

## 10. The unifying architecture

```
                 Curated Journey
                       │
User Media Score ──────┼────── Live Curator
                       │
                       ↓
              Experience Program
                       ↓
              Session Compiler
                       ↓
                   Chamber
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
     Stream          Page          Gallery
```

---

## 11. Build order

1. **Define `rise.experience-program.v1`** — unify visual, audio,
   movement, transition, later video.
2. **Stable source-span anchors** — character/token ranges with quote
   fingerprints, compiled to atoms. *(Half-built: `sourceProgress` and
   ranged source-space segments exist.)*
3. **The visual score lane for images** — colour-coded assets, text
   highlighting, preview, erase, overlap.
4. **The audio lane and sync groups.**
5. **MP4 as a first-class visual asset.**
6. **Export/import Experience Program JSON** — this alone enables the
   manual Live Curator workflow.
7. **Formalise engine registry scope.**
8. **The declarative Procedural Recipe format.**
9. **RISE Chain as a research mode** — sandbox, one visual engine, one
   soundscape, before any Journey integration.

> **The Sequence Creator should evolve from a session form into a score
> editor.**

That single shift unifies everything: it gives users the authored
correspondence *War* already has, creates the serialization boundary the
Live Curator needs, makes MP4 just another visual work, clarifies what a
procedural engine is, and supplies the constraint structure inside which
RISE Chain can be meaningful rather than merely random.

> The Chamber is the instrument.
> The Workshop is the studio.
> The Experience Program is the score.
> A Journey is a published composition.
> The Live Curator is an arranger.
> RISE Chain is a generative sequencer.
