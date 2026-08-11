# Dreams — unscheduled experiments

*Deliberately not on the roadmap.* Nothing here is sequenced, estimated, or
blocking. This file exists so a good idea is not lost between the day it
arrives and the day there is room for it, and so that whoever picks it up
inherits the reasoning rather than the summary.

Two entries so far, and they turned out to be one system.

---

## The RISE Familiar *(Mateo, 2026-08-11)*

**A small being that lives beside the work.**

Naming is settled: **Familiar**, not Citizen. A familiar belongs in a world of
rooms, rituals, texts and states — it sits in the same vocabulary as Chamber,
Scriptorium, Solarium and Curia in a way "Citizen" does not. *Citizen* is kept
for the larger idea below, where it means something precise: an inhabitant of
Civitas rather than a companion to the reader.

### What it is not

- Not an avatar of the reader.
- Not a pet the reader owns.
- Not an assistant. No chat bubble, no *How can I help?*, no productivity
  mascot, no manufactured emotional dependency.

**It is something that lives inside RISE and occasionally notices you passing
through.** You encounter it doing its own thing.

### The behavioural grammar

State machine, with authored variation on top. No agent architecture.

```
SYSTEM STATE                      CITIZEN STATE
  room                              wandering   studying   sleeping
  local time            ─────►      waiting     observing  travelling
  recent reading                    reading     carrying   resting
  current reading                          │
  session activity                         ▼
  recurrence                        animation + line
  recommendation candidates
```

It reads only RISE-native facts: which room, what hour, what has been read
lately, which domains, whether a reading is running or paused, broad
recurrence. It never reads the text.

**The charm is specificity, not intelligence.** Instead of rendering
`Recently read: Philosophy 47%`, you find a small figure at a desk with three
books on it. You open RISE at 4am and it is asleep in a chair. You start a
Journey and it gets up and leaves through a door. You have not entered the
Chamber for days and it is sweeping the Portal.

### The writing rule, which is the whole risk

**Silence is the normal state.** Dry, sparse, and rare. A familiar that talks
constantly is Clippy inside fifteen minutes.

The register, when it does speak:

> *"You brought War and Peace in here?"*
> *"You do know we have novels."*
> *"The Chapel has noticed."*
> *"I finished my shift an hour ago."*
> *"Again?"* — 4:30am, leaning on a railing, visibly tired.

**And there is an existing ruling it must not cross.** The Solarium review
already said: *stop giving every human condition a RISE-authored motivational
response.* A familiar that comments on the reader is precisely where that
would come back. It may notice **what was read**. It may not diagnose **who is
reading**. *"You read Augustine, Marcus Aurelius and Ecclesiastes recently"* is
a fact. *"I understand you have been experiencing existential uncertainty"* is
a trespass, and would end the feature on contact.

**Its lines are content, not runtime composition.** Per the three-layer law
(`JOURNEYS-SPEC` §5) the Chamber receives a label and an identity, never a
meaning. A content domain authors what the Familiar can say; the runtime picks
an occasion; the cortex renders it. The Chamber must never compose a quip.

### Recommendation becomes diegetic

This is where it stops being a gag.

Rather than *Recommended because you like Stoicism*, you encounter the Familiar
holding something:

> *"This seemed adjacent."* — Plotinus, with a small **Open**.
>
> *"You keep circling the same century."*

The mechanism needs no model:

```
recent works → tags / period / author / domain / motifs
            → weighted similarity
            → exclude recently read
            → diversity adjustment
            → candidate → encounter
```

**The data for this already exists.** All 88 library works carry `words`,
`author`, and a `divisions` block through `INGESTED_META` and
`division-index.json`; the curator catalogue already surfaces exactly this
shape for the Scriptorium. A similarity function over it is a weekend, not a
project, and it is honest about what it knows because it only knows titles.

### Persistence — small, and dangerous in a known way

Location, activity, last seen, current book, recent encounter ids. **No stats,
no levels, no currency.** Nothing that turns RISE into gamified sludge. Only
continuity: leave it in the Solarium looking at the sky, return tomorrow, and
it is somewhere else.

> *"You missed something strange last night."*

**The illusion of life comes from continuity plus incompleteness.** You do not
see everything it does — and not seeing is the mechanism, not a limitation.

**Two known traps, both already paid for once:**

1. **This is the Matthew-27 bug class.** Any Familiar state that persists must
   be in the lifecycle round-trip suite (Phase 0.3) on the day it is written,
   or it will silently fail to survive a restore and the Familiar will reset
   its life every launch with nothing reporting it.
2. **It is the first feature that genuinely wants the virtual clock.**
   "Resolve elapsed time into the next plausible state" is exactly the
   simulation kernel deferred as too expensive for its return. The Familiar
   might be the return. Worth re-costing against this rather than in the
   abstract.

---

## Civitas *(working title — Polis, The City, Arcology)*

**A continuously evolving miniature city whose inhabitants, illumination,
movement, density and architecture respond to the reading.**

Not SimCity. Not 3D realism. Abstract architectural drawing plus small moving
silhouettes and generative urban systems — axonometric, or extremely simplified
orthographic, on black.

```
        ┌─────┐
     ┌──┘  ▫  └──┐
     │    ┌──┐   │
  ┌──┘ ▪  │  │   └──┐
  │       └──┘      │
──┴─────────────────┴──
   ·   ·    ·
    ↗    →       ·
```

Illuminated windows. Figures crossing bridges. Lights moving through
infrastructure. Buildings growing and dissolving. The whole thing breathing
gently behind the reading.

### The law it must obey — and it is already written

> **Procedural imagery may accompany, never denote.**

That rule was ruled in Phase 9, for a different reason (a book's own plates,
where filling a figure reference with an invention would be a lie). It decides
Civitas completely, and the dream states it independently, which is a good sign:

- **Wrong.** The text mentions a church → generate a church.
- **Right.** The signal shifts the city toward density, verticality, movement,
  illumination, centralisation, fragmentation, order, entropy, openness — and
  the reader does the interpreting.

A passage about loneliness may happen to coincide with one figure crossing an
empty plaza. A passage about death may coincide with windows going out. None of
those meanings are encoded, and that is the entire effect.

### The state vector, and why memory is the point

```
population   0..1      cohesion     0..1      entropy   0..1
density      0..1      verticality  0..1      growth   -1..1
velocity     0..1      illumination 0..1      weather / time
```

Semantic signal **perturbs** this slowly. One sentence does not replace it.

**The city has memory, so the reading changes the civilisation rather than
addressing it.** Begin *Meditations* in a sparse settlement and arrive forty
minutes later somewhere denser and stranger — not because anything scripted
*Stoicism → Rome*, but because the cumulative trajectory drove the state.

### It is an engine, not a subsystem

Worth stating plainly, because it sounds enormous and is not:

**Every visual engine already takes a `signal` on every frame** —
`generate(signal, seed, options)` and `step(dt, signal)`. Civitas is an entry in
the same manifest as the other nineteen, with one difference: it integrates the
signal rather than reading it instantaneously. That is a field on the engine,
not a change to the cortex.

Which also means it inherits everything: the Gallery/Behind-Stream/Full-Frame
surfaces, the presentation clock, reduced motion, and the visual registry.

**One thing to verify rather than assume:** whether a city with extinguishing
windows and moving lights is *continuous* (Gallery-safe, no photosensitivity
prompt) or *flashing*. It reads as continuous, but that is a claim to measure —
Gallery is the default surface precisely because it never flashes, and an
engine that quietly does would put a safety prompt in a path the reader never
asked for.

---

## The connection, which is why both are here

The Familiar is **one inhabitant of Civitas.** Not metaphorically — the same
entity, at two scales.

```
                 RISE STATE
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
      FAMILIAR                 CIVITAS
  individual state         collective state
          │                       │
          └───────────┬───────────┘
                      ▼
                lived interface
```

As an ambient UI element you see it close up. When Civitas is running it is one
of the figures in the city, recognisable by some small visual signature.

**So the ridiculous version and the beautiful version are one architecture:**
the Familiar is system state embodied individually, Civitas is system state
embodied collectively. Either can ship without the other; building either one
second is cheaper if the first was built as a state projection rather than as a
character.

---

## Standing constraints, if either is ever built

- **Reverent degradation.** A Familiar that will not resolve is *absent*, never
  a broken sprite. Same law the imagery has followed from the beginning.
- **Nothing leaves.** It knows what you read. That stays local, on the same
  terms the Scriptorium established: ids, titles, lengths — no bytes out.
- **Silence is the default state**, in both senses: the Familiar rarely speaks,
  and Civitas never announces what it is depicting, because it is not
  depicting anything.
- **It may notice what was read. It may never diagnose who is reading.**
