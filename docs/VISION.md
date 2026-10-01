# RISE as the harness for a model

**Status: Intent.** Written 1 October 2026. Nothing in this document is built
except where §3 says so, and §3 is measured against the code, not against hope.

This supersedes the documents in `docs/vision/` as the statement of where RISE
is going. Those describe the era in which RISE was a reading engine with a
doorway in front of it; they are a record of that work and are not authority
for this path. They have not been re-reviewed against it.

---

## 1. The vision, in one page

A model answering a question today gets one channel: words, one after another,
into a box. RISE gives it a room instead — time, a voice, imagery, depth,
provenance — and the claim of the live Current (`docs/plans/LIVE-CURRENT.md`)
is that this is a different medium, not a prettier box.

The vision is the next step past that claim: **RISE stops being a renderer the
model writes into and becomes the harness the model performs in.**

Concretely, three things that are not true today:

1. **The reader can redirect the room in words, while it is running.** "Change
   to a more vibrant visual." "Slow down." "Show me that as a diagram." The
   change lands in under a second, mid-sentence, without the reading restarting.
2. **The model can reach a large library of procedural imagery, and search it.**
   Not a list of three names compiled into the protocol: a catalog it can filter
   by what a surface looks like, what it costs, and what parameters it exposes.
   A reader can add their own (the SDK, §2.6).
3. **The reader can act inside the experience, and the model knows.** "I want an
   interactive page to learn about neural networks" produces a page with a
   diagram the reader can drag, and the model is explaining it *while* they drag
   it, because their action reached the model as an event.

Put together: a reader asks for something, a model composes a room for it, and
the two of them keep adjusting it together by voice while it plays. That is the
whole of it.

### The frame that tells us where to invest

A model's expressiveness in RISE is three independent things:

| Axis | Means | Today |
|---|---|---|
| **Vocabulary** | how many validated things it can say | 3 visuals, 10 condition dimensions of which 2 do anything |
| **Rate** | how often it may change them | once per passage, and only before the passage is sealed |
| **Perception** | what it can observe of the room and the reader | nothing, beyond an interruption and a Dive question |

Every stage in §4 widens exactly one of these. None of them requires giving the
model a compiler, and that is the point: **the model gets expressiveness from a
bigger validated vocabulary and a faster clock, never from being handed
execution.** The invariant that already governs `src/live/protocol.js` — a field
that is not named is refused, nothing executable is ever accepted — is not a
restriction on this vision. It is the only reason the vision can be handed to
other people's readers.

---

## 2. What has to become true

### 2.1 Every visual is addressable, with typed parameters

The repository has sixty-six modules in `src/visuals/` and a register of nine
procedural patterns (`src/core/visual-registry.js`), each with a sentence saying
what it *looks like* written for whoever is choosing one. None of that is
reachable from a live Current, which knows three names.

A visual becomes addressable when it declares a **manifest**: its id, that
sentence, tags, the capabilities it needs (`webgl2`, workers, memory), whether
words can sit over it, and its parameters — each typed, bounded, named, and
given a default. `src/core/jev-config.js` already proves the shape: a choice
model picks a plan, and `resolveJevChamberConfig` expands it into exact Chamber
controls (`system`, `palette`, `form`, `intensity`, `speed`, `streaks`). The
manifest is that table, written down beside the renderer rather than inferred in
one function, and checked against the renderer by a test so the two cannot
drift.

### 2.2 The room can change while it is playing

Today a model's choice of imagery arrives with `segment.begin` and its condition
with `state.set`, and `state.set` is refused once the segment has ended
(`src/live/stream.js`). Only ended segments lower into the Player
(`src/live/runtime.js`). So **a change cannot take effect while the reader is
inside the passage it applies to.** For a composed answer that is correct and
deliberate. For a performance it is fatal: "more vibrant" that waits for the end
of the paragraph is not an answer, it is a delay.

This needs a control channel: events that may arrive at any moment and are
applied to the imagery now, with transition rules RISE owns — bounded, never a
hard cut under running words, never a flash. The model proposes; the renderer
and the transition rules dispose.

### 2.3 "More vibrant" has to land on a parameter

A phrase has to become a bounded change to a named parameter. Two paths, and
RISE should have both:

- **A closed local grammar** for a small set of adjustments — brighter, calmer,
  faster, slower, denser, different, stop moving. Deterministic, offline,
  instant, and it works when there is no provider at all. This is how the
  microphone already works (`src/live/mic/interpret.js`): a closed grammar, and
  anything outside it is handed back to the reader rather than guessed at.
- **The model**, for everything else, through a tool call it makes against the
  catalog: search it, then set a visual or adjust parameters.

The local grammar is the floor, so the feature is never worse than instant and
never depends on a provider. The model is the ceiling.

### 2.4 The model must be able to see the room

Perception is the axis we have invested nothing in. The model cannot see where
the reading is, that the reader held it, scrubbed it, opened a Dive and read it,
or touched anything. An interactive page is impossible without this, and so is
a model that notices it has lost you.

This is a reciprocal protocol: bounded, named events going *up* — position,
held, resumed, dived, surfaced, a widget moved, a value chosen. Two laws carry
over unchanged from the existing design and are not negotiable:

- **It is the reader's actions in the page, never an inference about the reader.**
  Experiential state describes what the presentation is meant to be like; it is
  never a diagnosis of the person. The same line holds for perception: that a
  slider moved is an action, that the reader is confused is a claim about them.
- **It goes to the provider the reader chose, with the reader's own credential**
  (`docs/USER-OWNED-AI.md`), and nowhere else. RISE spends no shared inference
  and keeps no copy.

### 2.5 Scenes: the interactive page

"I want an interactive page to learn about neural networks, and I want to touch
it while you explain it."

A **scene** is a composition declared as data: a layout of slots, each holding a
catalog visual, a text lane, or a widget from a **closed widget catalog** — a
slider, a labelled diagram, a step-through, a graph whose nodes can be dragged.
The model fills the slots, binds a widget to a parameter, and narrates. The
reader moves the slider; that is an event (§2.4); the model says "you have just
raised the learning rate — watch the loss". The widgets are ours, written once,
tested, accessible, and the same for every scene.

The obvious alternative is to let the model emit HTML, CSS, or a component tree
and render it. We refuse that, and the refusal is the architecture:

- It is executable content from a model, in the reader's page, with the reader's
  session. There is no validation story for it that ends well.
- It cannot be held to a budget, a frame rate, a contrast ratio, or a screen
  reader.
- A generated widget is a different widget every time, so nothing can be learned
  by using RISE twice.

A closed widget catalog is slower to build and strictly less general. It is also
the only version of this that can be given to someone else's reader, and the
only version whose quality we can hold.

### 2.6 RiseSDK: the reader's own library

A reader (or a team) registers their own renderer plus its manifest, and the
model can find it in the catalog and perform with it. This is what makes the
library *theirs* rather than ours.

It comes last, because it freezes the manifest as a public interface, and
because it is the one place where code we did not write enters the room. The
trust rule has to be stated before anything is built: **a reader's own renderer
runs for that reader; a renderer that is shared runs sandboxed — a worker, no
DOM, an offscreen canvas, a frame budget, no network — or it does not run.**

### 2.7 Voice mode

The reader talks, the model talks back, and both of them are adjusting the room.

Today speech recognition is the browser's (`src/live/mic/`) and the voice is
RISE's own, reading text the model wrote. A native-audio provider is a **sibling
adapter**, not a replacement — this was already the conclusion when Gemini was
added (`docs/plans/LIVE-GEMINI.md`): those models answer in audio, and RISE
wanted text and its own voice so that a Dive could hold it.

The architectural consequence is the one worth stating in advance. RISE has one
clock, and speech is its authority (`docs/plans/LIVE-CURRENT.md` §4): the voice
says where the reading is, and the text follows it. If the *provider* speaks,
the clock's authority moves into an audio stream RISE does not own and cannot
hold, pause, or restart a phrase in. Everything Dive and Surface do rests on
being able to hold the voice. So voice mode is not "swap the speaker": it is a
second clock discipline, and it must not be built by loosening the first.

---

## 3. Where we actually are

Measured against the code on `main` at the time of writing, not against intent.

| Piece | State |
|---|---|
| Streaming runtime, event protocol, reducer, one clock | Built, unit and browser tested |
| Dive and Surface, held voice, phrase-accurate return | Built (#359); verified on a fake device, **not with a real voice** |
| The undercurrent: every Dive kept at its place, follow-ups in the same Dive | Built (#361) |
| Press-to-talk speech recognition, closed grammar | Built (#360); **never run against a real recogniser** |
| Reader-owned providers: OpenAI (text over WebRTC), Gemini (streaming text) | Built, off by default; Gemini reached once with the creator's key, OpenAI **never** |
| MCP server and app, Dive through sampling | Built, off by default; **no product host has run it** |
| Model chooses imagery | **3 names**, at passage start only |
| Model adjusts imagery | **2 of 10** condition dimensions do anything, and only on one renderer |
| Model changes anything mid-passage | **Not possible** — refused by the reducer, by design |
| Catalog the model can search | **Does not exist** |
| Reader redirects the room in words | **Does not exist** |
| Model can observe the room or the reader's actions | **Does not exist** |
| Scenes, widgets, interactive pages | **Does not exist** |
| Model-spoken voice mode | **Does not exist** |
| RiseSDK | **Does not exist** |
| Does any of this differ from a music visualizer? | **Unmeasured.** The instrument exists (`docs/plans/LIVE-EVALUATION.md`); the study has never been run |

**Read the shape of that table.** Everything built so far is the plumbing the
vision needs and none of it is the vision. That is the honest account of why
this feels slow: the runtime, the clock, the Dive, the microphone and the voice
sync were each necessary, and not one of them lets a model do anything it could
not do in a chat window. The medium is in the vocabulary, the rate and the
perception, and we have barely begun on the first and not started the others.

---

## 4. The order to build it in

Each stage ends in something a person can be shown. No stage requires the one
after it.

### Stage 1 — The catalog is addressable
Manifests for the procedural visuals, generated or validated against the
renderers by a test, filtered by the capability record the runtime already
negotiates. A live Current's choice of imagery becomes the catalog instead of
three compiled-in names, with the capability floor deciding what is offered.
*Shown by:* a page listing every surface with its parameters and what it costs,
searchable, and a Current that opens with a visual chosen from it.
*Risk:* low. No new trust boundary, and the register and parameters largely
exist already.

### Stage 2 — The control channel, and "more vibrant"
Events that may arrive at any moment and change the imagery now, with RISE
owning the transition. The closed local grammar for adjustments, and the reader's
words routed through it by voice or by typing. The model's tool surface over the
catalog.
*Shown by:* saying "more vibrant" mid-paragraph and watching the room answer
without the reading faltering. **This is the first demo that is the vision.**
*Risk:* medium. Transitions under running words are a quality problem, not a
correctness one, and quality problems need a measurement before they need code.
*Budget to set first:* time from the end of the reader's phrase to the first
visible change — a target of under a second through the local grammar, and under
two and a half seconds through a model.

### Stage 3 — The model can see the room
Reader-observation events upward, bounded and named, with the two laws of §2.4
written into the protocol rather than into a convention.
*Shown by:* a model that notices the reader went back and re-read a passage, and
says something about it.
*Risk:* medium, and it is a privacy risk before it is a technical one. The
reader must be able to see exactly what is sent, and it must be off unless they
turned it on.

### Stage 4 — Scenes and the widget catalog
The layout, the slot model, the first three or four widgets, the bindings from a
widget to a parameter, and interaction flowing back through Stage 3.
*Shown by:* "an interactive page about neural networks", touched while it is
explained.
*Risk:* **high, and this is the stage to be most careful about.** It is where the
pressure to let the model write code will be greatest, where accessibility is
hardest, and where a bad abstraction would be most expensive to undo. It should
not start until Stages 1 to 3 are real, and it should start with one scene built
by hand, to find out what the slot model actually needs.

### Stage 5 — Voice mode
A native-audio sibling adapter, the second clock discipline of §2.7, and the
model's tool calls driving Stages 1 to 4.
*Shown by:* a conversation in which the room changes as you talk.
*Risk:* high. Latency, interruption, and the clock. Dive and Surface must keep
working, or the trade was not worth it.

### Stage 6 — RiseSDK
The manifest as a public interface, registration, and the trust tiers of §2.6.
*Risk:* high, and mostly about commitment rather than code: it is the first
thing here we cannot quietly change afterwards.

### Where the deferred work from the Dive redesign goes
Passing a Dive's earlier answers to a follow-up (`docs/plans/LIVE-UNDERCURRENT.md`)
belongs in **Stage 2**: it changes the request every adapter validates, which is
the same surface the control channel and the tool calls change. Doing them
together means reviewing that boundary once.

---

## 5. What we refuse, and why it is load-bearing

| Proposal | Verdict |
|---|---|
| The model emits HTML, CSS, a shader, a component tree, or any executable thing | **Refused.** The invariant the whole protocol rests on. §2.5. |
| A general "render this UI tree" scene format | **Refused.** A closed widget catalog instead, so quality, budget and accessibility can be held. |
| The model drives frames, or any per-frame parameter | **Refused.** The model sets intent; the renderer owns the frame loop and its budget. |
| The model infers what the reader feels, and the room follows | **Refused.** Intended condition describes the presentation. A claim about the reader is a different thing and RISE does not make it. |
| Reader-interaction events as analytics, or to anyone but the reader's chosen provider | **Refused.** §2.4, and `docs/USER-OWNED-AI.md`. |
| Shared inference so the vision can be demonstrated without a key | **Refused.** The deterministic provider is the demo path; it costs nothing and lies about nothing. |
| A second runtime, a second Player, or a parallel "interactive" pipeline | **Refused.** One runtime gains a vocabulary. Two pipelines would diverge within a month. |
| Loosening the one-clock rule to make a provider's voice fit | **Refused.** It is a second discipline, not a relaxation of the first. §2.7. |
| Widening the architecture to protect the thesis if the study separates nothing | **Refused**, and this was the original promise. The result gets recorded. |

---

## 6. What could make this wrong

Stated now, so none of it arrives as a surprise.

- **A model may choose badly.** Nothing establishes that a model picks good
  imagery for a passage, or that "more vibrant" maps to a change a person
  recognises as more vibrant. This is an experiment, and Stage 1 should end with
  it being run against the catalog rather than assumed.
- **It may not feel like a medium.** The comparison against voice over a generic
  visualizer has never been run. If it separates nothing, that is the answer.
- **Latency may eat it.** A room that answers in three seconds is a toy. The
  budget belongs in Stage 2 before the code does.
- **The widget catalog may be the wrong unit.** Hand-building one scene first is
  the cheapest way to find that out.
- **Scope.** Six stages is years at the current pace, and the project has one
  owner. The sequence is built so that stopping after Stage 2 still leaves
  something true and demonstrable, and so that no stage is wasted if the next
  never comes.

---

## 7. The shortest route to the feeling

If only one thing is built next, build this: **one visual, one phrase, one
second.** A reading in progress, the reader says "more vibrant", and the imagery
answers mid-sentence without the words faltering.

That is a slice of Stage 1 and Stage 2 — one manifest, one adjustable parameter,
the local grammar, the control channel, and the transition rule. It is small
enough to do in one pull request and it is the first time anyone, including us,
will be able to feel whether this vision is what it promises.
