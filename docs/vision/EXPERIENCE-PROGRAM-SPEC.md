# The Experience Program — V2's missing abstraction

*Roadmap, 2026-07-31. Implementation began 2026-08-03. This records the
direction and the delivered slices so the build order below can be started,
paused, and resumed without re-deriving the argument.*

Workshop implementation companion:
[`WORKSHOP-COMPOSITION-STUDIO-SPEC.md`](./WORKSHOP-COMPOSITION-STUDIO-SPEC.md).

Agent composition and deterministic distribution companion:
[`AGENT-COMPOSITION-AND-RENDER-SPEC.md`](./AGENT-COMPOSITION-AND-RENDER-SPEC.md).

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

### Implementation status — 2026-08-03

The foundation is now implemented in `src/core/experience-program.js`:

- `rise.experience-program.v1` is a strict, immutable persistence boundary;
- movement, transition, visual, audio-bed, and swell clips are independent
  tracks with source-space anchors;
- published, user, and proposed authority/editability combinations are
  validated rather than inferred;
- unknown vocabulary, malformed anchors, duplicate ownership, invalid
  references, and every size/range overflow refuse with typed errors;
- the Journey compiler authors this format first, and one compatibility
  adapter derives the existing movement, visual, and audio schedules;
- the Session persists the canonical score and treats those derived
  schedules as runtime projections, not competing authorities.

Stable source spans are now implemented. In addition to the compiled
`fromProgress`/`toProgress` coordinates used by Journeys, a clip may author
exactly one half-open range in either UTF-16 character offsets
(`fromCharacter`/`toCharacter`) or non-whitespace source-token offsets
(`fromToken`/`toToken`). Both `quoteStart` and `quoteEnd` are required.
Compilation verifies those endpoint quotations against the supplied edition,
then stamps character, token, and clip-membership coordinates onto the
resulting atoms. It never rewrites the canonical anchor to an atom id.

The first Workshop visual lane is also implemented. Sequence images now have
stable asset ids and editor-only colours. A DOM selection becomes a
quote-fingerprinted character span; assignments highlight the source, preview
their exact image, erase independently, and reject overlaps until the author
explicitly chooses replacement. Saving or launching compiles that editor state
into the canonical user Experience Program, and both Rhythmic and Gallery
presentation resolve the named sequence asset rather than sampling the old
session-wide image pool.

Whitespace inside a quote fingerprint is normalized for comparison; offsets
are not searched or adjusted. An edition drift, missing source, out-of-bounds
range, Unicode-surrogate split, or span that produces no playable atom is a
typed refusal. Character, token, and progress coordinates cannot be mixed on
one anchor.

The audio runtime now executes the bed and swell tracks independently. One
atom observation resolves both lanes as a transaction: bed authority changes
first, then a co-anchored swell fires. A `syncGroup` records correspondence
without merging the clips. Beds replace beds; swells never replace beds;
explicit silence owns the bed lane; leaving an authored bed restores the
project atmosphere default. A pause **suspends the audio clock** and both
lanes hold their position; stale asynchronous events are cancelled by
generation.

Resume once restored the bed alone, on the reasoning that a swell is a
momentary event and replaying one would perform it a second time. That reading
of the lane is obsolete. The `swell` lane carries a layer that holds for the
length of its passage — a reader's own recording, minutes long, stacked over
the whole-reading bed — so pausing inside that passage and returning to it
silent loses the layer rather than avoiding a repeat.

Nor may a pause end the lanes and start them again. A buffer source can be
started but never resumed, so tearing a lane down and rebuilding it returns a
recording to its first second. The reading's silence comes from the engine
suspending its context, which freezes every layer where it stands; the
schedule holds its lanes rather than ending them. The two belong together —
if the schedule also cancelled, the suspension would have nothing left to
hold. Only a reading that ENDS cancels the lanes.

It follows that **a cue naming what is already sounding is not a change**.
Re-asserting a bed stops and starts it, because that is the only shape the
engine has, and `hold` keeps not only a lane's output but the id it is
sounding under. A procedural bed hides every one of these restarts — it is
self-evolving noise with no position to lose. A recording hides none of them.

`swell` remains the wire name of the overlay lane in every saved sequence and
published Journey. No authoring surface uses the word: audio is placed either
under the whole reading or over a highlighted passage, and how long it sounds
is a property of the file.

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

### 5.1 Persistent fields as schedulable visual works

Focal, Attractor, and Genesis are not separate child readings. They are
visual cues on the same source-coordinate clock as images, collections,
procedural works, and video:

```js
cue: {
  kind: "field",
  renderer: "focal" | "attractor" | "genesis",
  config: { /* bounded renderer configuration captured by the clip */ }
}
```

The visual track fallback carries the whole-reading field (or `still`). A
passage field temporarily supersedes that fallback; when its half-open atom
range ends, the fallback resumes without rebuilding the Session. One runtime
field director owns mounting, crossfade, pause/resume, cancellation, and
destruction. WPM, chunking, pacing, audio, and recitation remain properties of
the uninterrupted reading and are never copied into field clips.

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

**Manual loop (wired):** Workshop exports `rise.curator-context.v1` and
`rise.experience-program.v1`; Import score accepts file or paste, runs
`validateExperienceProgram` (including same-lane exclusivity), optional
context membership checks, lands a Vault draft with
`authority: "proposed"`, and never embeds media bytes in the interchange.

**Capability gate claim (Scriptorium):** when the context ships the Library
catalogue, membership means *these works exist*, not *these are already
loaded*. Accepting a proposal may load named works; loading is visible and
refusable. Ids, titles, lengths only — never payloads in the context.

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
   movement, transition, later video. *(Foundation implemented 2026-08-03;
   video cue vocabulary added with Step 5 on 2026-08-11.)*
2. **Stable source-span anchors** — character/token ranges with quote
   fingerprints, compiled to atoms. *(Implemented 2026-08-03: strict
   character/token anchors, edition-drift refusal, atom coordinates, and
   chunk-mode-invariant runtime matching.)*
3. **The visual score lane for images** — colour-coded assets, text
   highlighting, preview, erase, overlap. *(Implemented 2026-08-03 in the
   Workshop: stable sequence-asset identity, selection authoring, explicit
   overlap replacement, canonical compilation, and exact runtime lookup.)*
4. **The audio lane and sync groups.** *(Implemented 2026-08-04: independent
   bed/event lowering and execution, tone cues, sync-group preservation,
   transport cancellation, and Workshop passage authoring.)*
5. **MP4 as a first-class visual asset.** *(Implemented 2026-08-11:
   sequence-local durable import, muted/poster cue policy, Workshop span
   authoring, persistence, compilation, and authority-bound runtime playback.)*
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

---

## 12. Page mode and the Journey — where this stands (2026-07-31)

Two faults, one fixed and one deferred.

**Fixed: the Page never read a Journey's program.** `compileFlow`
consulted the visual program only for atoms carrying chapter AND verse
— the scripture space it was written for. A Journey's atoms carry a
`sourceId`, so `cueForAtom` was never called and no authored cue of any
kind was read. And because `program` was set, the unscheduled fallback
(`placeCollectionFigures`) is deliberately skipped, so a Journey's page
came out as bare text while an ordinary session's was illustrated.

This is the same root as `normalizeVisualProgram` rejecting
`coordinateSpace: 'source'`: a second copy of "how do I read a
coordinate", which learned one space and not the other. `cueForAtom`
already understood both and was answering correctly — the question was
never put to it.

The Homeric movement's museum works now reach the page, which is what
that fix buys immediately.

**Deferred: procedural figures, until the Page paginates.** The
machinery is built and tested — `pageCollectionId` / `sampleWorkEngine`
in work-engines.js, and the Chamber's resolver branch — and one constant
in flow.js (`PROCEDURAL_FIGURES`) turns it on.

It is off because of what the Page currently *is*. PAGE-MODE-SPEC §199
and §250 put spread pagination at v4: v1 scrolls. A Journey is 23,000
words, so its page is one continuous column of ~2,800 atoms, and a
sampled engine still at every figure adds render cost to the largest
document this projection has been asked to typeset. Pagination is what
makes it tractable — it divides the reading into bounded units, and a
bounded unit can afford its own imagery.

Until then a Journey's procedural movements typeset as text, which §1.5
of JOURNEYS-SPEC names explicitly: *an unillustrated passage is a valid
scored state.*

**The doctrine, when it is turned on, is already settled.** The Chamber
decided it for Genesis and the attractor: a persistent field is *"a
dynamic system, not a pool, and a single still would misrepresent it —
its honest spatial translation is a SEQUENCE, the same system sampled at
evenly spaced states, the last being its settled form."* Work engines
get the same treatment, and one thing the general fields cannot do:
because a figure names its own engine, the id carries both family and
engine, so the flaming sword stands beside the passage where Michael's
sword falls.

**Trigger to revisit:** pagination, or a Journey short enough that the
column is bounded anyway — which the Demo journey would be.
