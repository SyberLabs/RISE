# RISE Roadmap
## From Model-Authored Scores to Realtime Performance

**Status:** Product and architecture direction  
**Date:** October 2026

## 0. Thesis

RISE is a runtime for model-authored experiences.

A model should not be limited to producing words into a chat box. RISE gives it a controlled audiovisual environment in which it can coordinate:

- language
- voice
- imagery
- sound
- pacing
- depth
- interaction
- reader-directed changes

The long-term product is not merely a renderer for completed model output.

> **RISE becomes a harness in which a model performs.**

There are two distinct modes of authorship.

### Composition

The model creates a complete audiovisual score before playback.

```text
intent
  ↓
model
  ↓
Experience Program
  ↓
RISE
  ↓
performance
```

Scriptorium already approximates this model.

### Live Performance

The model speaks and modifies the environment during the same conversational act.

```text
reader
  ↓
model session
  ├─ speech
  ├─ visual actions
  ├─ audio actions
  ├─ pacing actions
  └─ interaction
       ↓
      RISE
```

These modes share the same semantic language and runtime. They differ only in when the specification arrives.

---

# 1. Architectural Law: One Semantic Center

`rise.experience-program.v1` remains the canonical durable representation of a RISE experience.

It already describes the relationships RISE needs:

- movement
- visual
- audio
- narration
- pace
- swell
- thread
- transition

and anchors them to stable source coordinates.

The Experience Program is therefore the semantic center of RISE.

`rise.current.v1` remains useful, but it should be understood as a **simplified model-facing adapter**, not the final expressive language of RISE.

```text
Current
   ↓
Experience Program

Scriptorium
   ↓
Experience Program

Live events
   ↓
Experience Program

Workshop
   ↓
Experience Program

RiseSDK
   ↓
Experience Program capabilities
```

No second runtime and no competing score format should emerge.

---

# 2. Gate 0: Prove Realtime Host Interleaving

Before further investment in ChatGPT-specific Live architecture, determine what ChatGPT Live actually permits.

The decisive question is:

> **Can GPT-Live modify a persistent RISE interface multiple times during one spoken assistant turn?**

A voice interface alone does not make RISE realtime.

If interaction remains:

```text
reader speaks
   ↓
model finishes reasoning
   ↓
tool call
   ↓
RISE performs
```

then the system remains turn-based.

The required experiment is deliberately tiny.

Expose a persistent RISE surface with one operation:

```text
rise.setVisual({
  visual,
  intensity
})
```

Ask GPT-Live to explain something with several semantic stages while changing the visual between stages.

Instrument:

```text
VOICE_START
TOOL_CALL
VISUAL_CHANGE
TOOL_CALL
VISUAL_CHANGE
VOICE_END
```

The successful ordering is:

```text
VOICE_START
    ↓
speech
    ↓
RISE mutation
    ↓
speech continues
    ↓
RISE mutation
    ↓
speech continues
    ↓
VOICE_END
```

Also determine whether the persistent widget can emit reader interaction back into the same Live conversation without requiring a new conversational session.

### Gate 0 outcomes

**If host interleaving works:** ChatGPT Live becomes a viable host for canonical Live RISE.

**If tool calls interrupt speech but speech resumes afterward:** still viable. Tool calls themselves become semantic synchronization points.

**If all RISE actions occur only before or after a completed assistant turn:** ChatGPT remains a Composer host, not the canonical Live host.

RISE should not distort its architecture to simulate realtime inside a fundamentally turn-based host.

---

# 3. Phase 1: Consolidate the Semantic Architecture

Before adding capabilities, explicitly codify the relationship between the existing systems.

The architecture should state:

```text
Experience Program
      = durable score

Experience Events
      = changing score over time

Session
      = compiled executable presentation

Player
      = temporal execution

Chamber
      = presentation environment
```

Current becomes:

```text
rise.current.v1
      ↓
small Experience Program
```

Scriptorium becomes:

```text
capability context
      ↓
model
      ↓
complete Experience Program
```

Live becomes:

```text
model actions
      ↓
Experience Events
      ↓
evolving Experience Program
```

This phase should remove conceptual ambiguity before adding another protocol.

---

# 4. Phase 2: Renderer Manifests

RISE already contains a substantial visual system, but model-facing Live currently exposes only a tiny fraction of it.

Every usable visual renderer should receive a formal manifest.

Example:

```text
id: attractor

description:
persistent strange-attractor filaments of light

tags:
chaotic
continuous
atmospheric
abstract

requirements:
canvas2d

parameters:
intensity  number  0..1
speed      number  0..3
density    number  0..1
palette    enum

reducedMotion:
supported

estimatedCost:
low
```

The manifest must be machine-readable and validated against the renderer implementation so metadata and actual capabilities cannot drift.

This turns the existing collection of renderers into an addressable instrument library.

---

# 5. Phase 3: Queryable Capability Catalog

The model should not receive an enormous static list of every visual RISE can perform.

RISE should expose a bounded catalog interface.

Conceptually:

```text
catalog.search({
  query: "quiet luminous topology"
})

catalog.describe({
  id: "harmonograph"
})
```

Search results should expose:

- id
- description
- tags
- parameters
- required capabilities
- performance class
- accessibility properties
- visual family

The catalog should include existing:

- procedural surfaces
- field renderers
- work engines
- admitted image collections
- audio capabilities
- voices
- later RiseSDK renderers

Model selection becomes retrieval rather than memorization.

---

# 6. Phase 4: Realtime Experience Events

This is the foundational Live abstraction.

Introduce a realtime protocol above the durable Experience Program.

For example:

```text
rise.experience-events.v1
```

The model should be able to progressively propose:

```text
experience.open

source.open
source.append

cue.add
cue.update
cue.remove

source.seal

experience.complete
```

A cue uses the same vocabulary as the Experience Program.

Example:

```text
cue.add

lane: visual

anchor:
  source: answer-1
  fromCharacter: 0
  toCharacter: 86

cue:
  kind: field
  renderer: attractor
  config:
    intensity: 0.45
```

Then:

```text
cue.add

lane: audio

anchor:
  same source span

cue:
  kind: soundscape
  soundscapeId: night-drive
```

The realtime reducer continuously produces a valid Experience Program prefix.

No separate Live score format should exist.

---

# 7. Phase 5: Commit Horizon

Realtime authorship requires explicit temporal authority.

The model may revise the future.

It may not rewrite the reader's experienced past.

```text
PAST             PRESENT             FUTURE

██████████████ | ████ | ░░░░░░░░░░░░
immutable        locked    editable
```

The runtime should distinguish:

**Committed history**

Already presented. Immutable.

**Active window**

Currently spoken or rendered. Only safe bounded controls may apply.

**Future score**

May still be modified by the model.

This gives RISE a foundational law:

> **Generation may revise anticipation, never history.**

The existing Live reducer's immutable committed segments are the beginning of this model. The commit horizon makes it finer-grained.

---

# 8. Phase 6: Full Live Lane Exposure

Once Experience Events exist, expose the compositional abilities Scriptorium already possesses.

A live model should eventually be able to control:

```text
visual
audio
narration
pace
thread
swell
transition
```

Not all of these need to arrive simultaneously.

The first useful subset is:

```text
text
visual
visual parameters
audio
pace
```

That alone is enough to establish a substantially richer medium.

Visual overlap is explicitly deferred.

One active visual lane is sufficient for the first full product.

```text
SPAN A           SPAN B           SPAN C

attractor   →    neural      →    generated-field
rain        →    silence     →    tone
slow        →    normal      →    deliberate
```

---

# 9. Phase 7: Reader Control Channel

Realtime does not only mean the model changes RISE.

The reader must be able to redirect the environment while it is running.

The deterministic local grammar remains the immediate floor:

```text
more vibrant
calmer
slower
faster
less dense
pause
resume
```

These should map directly to bounded typed operations without inference.

Everything outside that grammar may be sent to the active model session.

Example:

```text
reader:
"Show me that as a diagram."

       ↓

model:
catalog.search(...)
visual.set(...)
```

The target should remain:

> visible response begins within approximately one second for local controls.

---

# 10. Phase 8: Local Neural Voice Clock

Browser `speechSynthesis` should remain a compatibility fallback, not the canonical voice architecture.

Build a `VoiceRenderer` boundary that can accept local lightweight neural models.

The renderer contract should expose more than `speak(text)`.

It should produce:

```text
audio chunk
word start
word end
character span
duration
```

Conceptually:

```text
VoiceRenderer.open(segment)

→ audio(...)
→ mark({
    fromCharacter,
    toCharacter,
    startTime,
    endTime
  })
→ end(...)
```

This permits the voice to become the authoritative RISE clock.

Investigate lightweight local engines such as Pocket TTS and other browser-capable models against:

- cold startup
- model download
- first audible sample
- realtime factor
- CPU/GPU interference with visuals
- memory
- voice quality
- word alignment
- interruption latency

The existing narration lane should remain the semantic representation of spoken spans.

---

# 11. Phase 9: Model Perception

The model cannot genuinely perform in a room it cannot observe.

RISE should expose bounded runtime events upward.

Examples:

```text
playback.position
playback.held
playback.resumed

dive.opened
dive.closed

visual.parameterChanged

interaction.valueChanged
```

These events describe observable actions and state.

RISE should never silently promote them into psychological claims.

Allowed:

```text
reader moved slider to 0.7
reader paused
reader replayed passage
```

Not allowed:

```text
reader is confused
reader is bored
reader dislikes this
```

The provider receives facts about the interaction, not inferred states of mind.

---

# 12. Phase 10: Scenes and Interactive Widgets

Only after the model can control and perceive the current environment should RISE introduce interactive scenes.

The first scene system should use a closed widget catalog:

- slider
- draggable node diagram
- graph
- step-through
- labelled diagram
- selector

The model declares composition and bindings as data.

Example:

```text
scene:
  visual: neural-network

  widget:
    slider

  binding:
    slider.value
      → visual.learningRate
```

Reader action:

```text
slider changed
      ↓
RISE event
      ↓
model
      ↓
spoken explanation
```

Generated arbitrary UI is not needed for the first scene system.

---

# 13. Phase 11: RiseSDK

RiseSDK turns the renderer contract into a stable platform interface.

Built-in visuals, reader-created visuals, team visuals, and eventually model-generated visuals should target the same abstraction.

A renderer supplies:

```text
manifest
create()
frame()
dispose()
```

and operates through a narrow rendering API.

RiseSDK should freeze only after the internal renderer manifest and catalog system has survived real use.

The SDK is therefore deliberately late.

---

# 14. Phase 12: Generated Visual Admission

Model-generated code should not execute directly inside RISE.

The correct rule is:

> **Untrusted model code never executes with RISE authority.**

A model may propose a RiseSDK renderer.

RISE then processes it through an admission pipeline.

```text
model-generated source
        ↓
parse
        ↓
static restrictions
        ↓
manifest validation
        ↓
sandbox compile
        ↓
frame tests
        ↓
parameter sweep
        ↓
performance budget
        ↓
error check
        ↓
content hash
        ↓
admitted renderer
```

On failure, RISE returns structured diagnostics to the model.

The model may repair and resubmit.

On success, the runtime receives an ID such as:

```text
generated:sha256:...
```

The Experience Program contains only:

```text
renderer id
parameters
anchor
```

Never raw code.

---

# 15. Generated Renderer Sandbox

Generated and third-party renderers should not receive access to the RISE application environment.

Preferred architecture:

```text
sandbox worker
      ↓
RiseSDK
      ↓
OffscreenCanvas
      ↓
ImageBitmap / validated frame output
      ↓
RISE compositor
```

The renderer should not receive:

```text
window
document
fetch
WebSocket
localStorage
IndexedDB
cookies
ChatGPT bridge
provider credentials
```

It should receive only bounded primitives such as:

```text
time
dimensions
parameters
seeded randomness
drawing primitives
```

Execution budgets should cover:

- memory
- CPU time
- frame time
- initialization
- output dimensions
- reduced motion
- failure recovery

This allows generative extensibility without giving model output application authority.

---

# 16. Phase 13: Performance Materialization

A completed realtime experience should be convertible into a durable Experience Program.

This closes the loop:

```text
live performance events
        ↓
materialize
        ↓
Experience Program
        ↓
Vault
        ↓
replay / edit / render
```

A live session can therefore become:

- a replayable experience
- an editable Workshop composition
- an offline render
- a shareable artifact

Realtime and authored work remain two temporal forms of one system.

---

# 17. Phase 14: Product Hosts

Once the performance kernel is stable, individual integrations become hosts rather than architectures.

### ChatGPT Composer

ChatGPT authors a complete score and invokes RISE.

```text
ChatGPT
   ↓
Experience Program / Current adapter
   ↓
RISE
```

### ChatGPT Live

Only canonical if Gate 0 proves same-turn interleaving.

```text
GPT-Live
  ├ speech
  ├ RISE actions
  └ receives interaction events
```

### Standalone RISE Live

RISE owns the model transport and therefore the full realtime control loop.

### Other model providers

Adapters translate provider-specific streaming and tools into the same Experience Event protocol.

### Embed / developer product

Applications embed the RISE runtime and expose the same model-facing capability interface.

---

# 18. What Is Foundational

The roadmap divides into three strata.

## Foundation

Must be correct before substantial expansion:

```text
Gate 0
semantic convergence
renderer manifests
catalog
Experience Events
commit horizon
basic live lanes
voice clock
```

## Medium

Makes Live RISE genuinely reciprocal:

```text
reader control
model perception
scenes
widgets
```

## Platform

Expands the vocabulary without compromising the kernel:

```text
RiseSDK
generated renderer admission
performance materialization
multiple product hosts
```

Do not build platform breadth before the foundation is stable.

---

# 19. Immediate Execution Order

The next concrete sequence should be:

1. Finish the minimal #368 Begin activation fix and complete ordinary ChatGPT acceptance. Treat browser TTS as an acceptance mechanism, not the final voice architecture.

2. Run **Gate 0** inside ChatGPT Live with one persistent widget and one visual mutation tool. Do not widen the protocol first.

3. Record the result as a product-level architecture decision:
   - ChatGPT supports Live RISE, or
   - ChatGPT supports RISE Composer only for now.

4. Write the semantic convergence specification:
   - Experience Program = durable score
   - Experience Events = realtime score mutation
   - Current = simplified adapter

5. Build renderer manifests for the existing RISE visual vocabulary.

6. Build the queryable catalog over those manifests.

7. Specify and prototype `rise.experience-events.v1` with only:
   - source text
   - visual selection
   - visual parameter change
   - audio selection
   - pace

8. Add the commit horizon and prove future cues can change without rewriting experienced history.

9. Prototype the local neural `VoiceRenderer` separately, including timing marks.

10. Combine the voice clock and Experience Event prototype into the first provider-independent **true Live RISE** demo.

That demo should be deliberately simple:

> A model explains one concept aloud while it changes a single visual, changes one visual parameter, changes atmosphere, and responds to one reader interruption without restarting the experience.

If that does not feel meaningfully different from ordinary voice mode plus a visualizer, stop and evaluate before expanding the system.

---

# 20. Product Definition

The pieces can now be named clearly.

**Experience Program**  
The score.

**Experience Events**  
The live performance language.

**Catalog**  
The instruments available to the model.

**RiseSDK**  
The instrument interface.

**Scriptorium**  
Batch model composition.

**Workshop**  
Human composition and revision.

**Chamber**  
The stage.

**Player**  
The clock and execution engine.

**RISE Live**  
A model performing through Experience Events while the reader is present.

**RISE Composer**  
A model authoring an Experience Program before performance.

The long-term system is therefore:

> **A model composes or performs through a bounded audiovisual language. RISE validates the language, owns execution, preserves the relationship between media and source, and lets the reader redirect the experience while it is happening.**

The model proposes.

RISE disposes.

The reader remains in control.