# Journeys — authored transformations across works

*Written 2026-07-29. Reference production: **War**.*

Status: **SPEC — architecture traced; implementation not begun.**

---

## 0. Decision

A Journey is a premium, authored R.I.S.E. experience in which several
source-defined passages become movements in one irreversible intellectual and
sensory transformation.

A Journey is not:

- a themed playlist;
- an anthology of mutually affirming quotations;
- a generated sequence assembled from semantic similarity;
- a normal Session with a decorative title;
- a video export.

The first cross-work reference production is **War**:

> war descends from an event in the structure of being, into a code by which
> mortal people understand themselves, and finally into machinery that exceeds
> any participant's understanding.

Its three source worlds are:

1. *Paradise Lost* — metaphysical war;
2. *The Iliad* — heroic and mortal war;
3. *The Storm of Steel* — industrial war and its dangerous re-aestheticization.

The reference is deliberately demanding. If the architecture can preserve
three distinct textual, visual, and acoustic worlds while making each one
revise the previous one, it can support simpler single-work Editions and later
Journeys without special cases.

---

## 1. Editorial law

### 1.1 A Journey needs an argument, not a topic

“War in three works” is a topic. The movement from metaphysical order, through
heroic intelligibility, into industrial contingency is an argument.

Every Journey manifest must therefore state:

- **thesis** — the claim made by the whole sequence;
- **transformation** — what becomes impossible to believe, perceive, or feel
  by the end;
- **movement necessity** — what each movement contributes that no other
  movement can;
- **counterpressure** — how each source resists the Journey's thesis rather
  than becoming an illustration of it;
- **terminal condition** — the state in which the audience is left, which need
  not be a conclusion.

### 1.2 Each movement must change the active world

A movement is not a chapter heading laid over continuous playback. It may
change:

- the scale at which the subject can be perceived;
- the governing moral or epistemic frame;
- the relationship between voice and text;
- the image vocabulary;
- the musical grammar;
- the density and pace of presentation;
- the meaning of a form already encountered.

The change must survive as structured data. It cannot exist only in a curator's
essay or in unrecorded runtime behavior.

### 1.3 Sources do not become equivalent

Cross-work juxtaposition can falsely imply that works from different periods,
languages, traditions, and material circumstances “say the same thing.”

A Journey must preserve for every passage:

- exact edition and translator;
- exact locator and excerpt bounds;
- source and payload checksums;
- original language;
- editorial role within the Journey;
- contextual and rights notes;
- any mediation or revision history material to interpreting the passage.

The Journey may create a relation. It may not erase the differences that make
the relation meaningful.

### 1.4 The holding remains whole

The literature acquisition rule remains authoritative:

> A holding is the complete work or named collection. A reading unit is the
> smallest stable authored or source-defined division that can stand alone.

A Journey may use a disclosed route through a reading unit, but it may not
silently store or present an excerpt as though it were the complete holding.
The full acquired work and the Journey selection are separate records.

### 1.5 Silence is an authored event

Silence, black, stillness, and an unillustrated passage are valid scored
states. Missing or weak media must never be filled with a merely related asset.
Reverent degradation remains binding.

---

## 2. Reference treatment — **War**

This treatment is provisional until passage selection and edition work are
complete. It defines the architecture's required expressive range; it does not
pre-approve exact excerpt boundaries.

### 2.1 Thesis

War first appears as intelligible within a cosmic hierarchy, then as
intelligible through the honor and mortality of a single person, and finally
as an industrial environment no participant can perceive as a whole.

The final movement complicates, rather than completes, a simple
demythologization. Jünger's crafted testimony discovers precision,
exhilaration, and sublimity inside mechanized destruction. Myth does not merely
vanish; it attempts to re-form inside the machine.

### 2.2 Movement score

| Movement | Textual route | Function | Visual world | Acoustic world | Exit |
|---|---|---|---|---|---|
| **I · War in Heaven** | *Paradise Lost*, Book VI; final bounds selected around celestial combat, infernal artillery, and the Son's intervention | Establish war as metaphysical rebellion inside a total order | black, remote geometry, hierarchy of light, sparse cleared engravings; bodies withheld at first | pitched, ordered, spacious; violence still belongs to harmony | artillery appears in Heaven; order exposes the instrument that will survive it |
| **II · The Hero Under Heaven** | *Iliad*, a disclosed route from Hector's household in Book VI into his decision, pursuit, death, and desecration in Book XXII | Contract immortal scale into one mortal body; expose honor as both intelligibility and consumption | bronze, dust, walls, distance, vase painting and sculpture becoming progressively still | harmony contracts to pulse; pulse leaves at the treatment of the body | the hero becomes material; bronze, leather, and flesh yield to steel, earth, and fragments |
| **III · Under Steel** | *The Storm of Steel*, exact chapters and passages selected only after edition collation | Remove the perceptible whole; let tactics, shock, exhilaration, chance, and annihilation coexist without retrospective settlement | maps, trench plans, shell-cratered landscapes, archival photographs, decreasing access to faces | pitch gives way to pressure, texture, and finally silence | no synthesis; an emptied landscape remains |
| **Coda** | no source text | Refuse a moralizing summary | one damaged landscape or black; optional return of the title `WAR` | silence | completion |

### 2.3 Negative direction

**War** must not use:

- a rapid explosion montage;
- generic cinematic combat effects;
- triumphal percussion at Hector's death;
- celestial fantasy art selected by keyword;
- decontextualized First World War gore;
- casualty statistics as an automatic moral conclusion;
- a closing aphorism explaining what the audience should think;
- one continuous music bed pretending the three worlds are already unified.

### 2.4 Source gates

*Paradise Lost* and *The Iliad* belong to acquisition Tranche A.

*The Storm of Steel* is blocked from production ingest until the 1929
Doubleday, Doran U.S. edition is acquired or collated against the available
1929 London witness. The dossier explicitly prohibits assuming that different
pagination conceals no textual variants. Jünger's revision history,
aestheticization of combat, and interwar nationalism require contextual
apparatus.

Architecture work must proceed with fixture passages and must not lower this
source gate to make the demo convenient.

---

## 3. Product scope

### 3.1 V1 goals

V1 must support:

- two to five ordered movements;
- one or more verified passage payloads per movement;
- an authored boundary between every adjacent passage;
- distinct movement-level visual programs;
- distinct movement-level audio cues;
- explicit silence and black/still states;
- one validated static voice pack for the complete Journey;
- exact source, image, and audio provenance;
- deterministic compilation into the existing Session and Player;
- pause, resume, restart, exit, and completion without timeline drift;
- a compact Journey introduction showing thesis, movements, duration, and
  credits before launch.

### 3.2 Deferred

V1 does not include:

- video playback or MP4 rendering;
- automatic asset search;
- LLM-authored Journeys;
- arbitrary natural-language revision;
- per-movement narrator changes;
- a cast of dramatic voices;
- frame-accurate music editing;
- arbitrary cue placement inside a passage by waveform time;
- user drag-and-drop authoring;
- cross-device authoring collaboration;
- Page Mode composition of multi-work Journeys;
- runtime Kokoro inference.

The architecture should leave these possible without pretending they are part
of the first production.

### 3.3 Authored sovereignty

A published Journey is an authored artifact. Ordinary accessibility and
transport controls remain available, but the Orbital must not silently turn
its movement order, transition lengths, image bindings, or audio score into
random user parameters.

The user may:

- pause, resume, exit, and restart;
- disable sound;
- disable recitation;
- request reduced motion;
- use a silent/still degradation path.

The user does not rewrite the published Journey merely by opening the generic
Session controls.

---

## 4. Current architecture — what already exists

### 4.1 Existing Atrium Journeys

The Atrium already has records named Journeys:

- `src/content/atrium/history.js`
- `src/content/atrium/philosophy.js`

They contain:

```js
{
  id,
  domain,
  kind: 'journey',
  title,
  anchorIds,
  description,
  segments: [{ passageId, role }],
  estimatedMinutes,
  status
}
```

Their strengths are substantial:

- exact passage and source records;
- a controlled segment-role vocabulary;
- edition-, rights-, and payload-level readiness;
- checksum verification before launch;
- stable provenance in the Session;
- an itinerary calculated from the actual compiler profile.

Their runtime limitation is equally precise: they are **editorial playlists**.
`createAtriumJourneyHandoff()` flattens the ready segments into ordinary text
sources, applies one domain-wide sensory config, and gives the result to
`compileSession()`.

### 4.2 The Chapel pericope engine is the direct predecessor

The strongest existing model is not the Atrium Journey handoff. It is the
Chapel's pericope pipeline:

```text
overlapping Gospel concordance
        ↓ Chapel compiler resolves editorial precedence
disjoint generic visualProgram
        ↓ VisualScheduleController follows atom coordinates
generic cues
        ↓ visualCortex.applyCue()
rendered visual field
```

This pipeline already proves the central Journey law:

> Content domains author schedules. The runtime follows schedules. The cortex
> renders cues.

The Journey implementation must reuse its successful disciplines:

- **compile ambiguity away:** the pericope compiler resolves
  `narrowest-wins` before launch; a Journey compiler likewise resolves
  movement order, passage membership, boundary ownership, and cue precedence
  before runtime;
- **emit a disjoint executable schedule:** every playable atom belongs to one
  movement or one boundary, never several competing movement states;
- **follow coordinates, not elapsed wall time:** pericopes follow
  `(chapter, verse)`; Journeys follow stable `sourceId` values, including
  synthetic boundary source ids;
- **emit only on identity change:** a movement or cue activates once at its
  boundary, not once per atom;
- **hold structural silence:** paragraph breaks inherit their source id and
  therefore remain inside the active movement; they must not flash a fallback;
- **make absence explicit:** a works-less pericope compiles to `still`; a
  Journey movement or boundary with no admitted imagery does the same;
- **invalidate stale asynchronous work:** generation tokens prevent a late
  pool or audio load from publishing after the reading has crossed into the
  next movement;
- **bootstrap the first cue synchronously:** the Chapel seeds the first
  pericope's pool before autoplay, avoiding a stale collection flash while the
  first atom is observed;
- **persist launch identity:** the visual program is serialized with the
  reading, and its provider collections remain recoverable after reload.

Journeys generalize this pattern from one authored visual schedule to three
parallel programs—movement, visual, and audio—all following the same Player
atom. They do not replace or fork the pericope runtime.

There are two important differences:

1. A pericope's structural silence lacks a scripture coordinate and therefore
   holds the previous cue. A Journey boundary is intentional content: it
   carries a synthetic `sourceId`, matches its own cue, and actively enters
   stillness or silence.
2. A Chapel program currently has one rendering channel. A Journey carries
   coordinated movement metadata and audio cues as siblings of the visual
   program; none may become a second clock.

### 4.3 Gap ledger

| Layer | Existing behavior | Journey requirement | Ruling |
|---|---|---|---|
| Atrium record | flat `segments[]` with argument roles | movements containing segments, thesis, transformation, world states, and boundaries | extend compatibly; do not discard current roles |
| Readiness | excellent source, rights, payload, checksum, word-count checks | image/audio asset readiness and movement completeness | extend the same fail-closed pattern |
| Handoff | verified sources plus one global sensory config | lower an authored Journey into several independent runtime programs | add a Journey compiler above the canonical Session compiler |
| Session compiler | chunks multiple sources and inserts one generic three-beat break | authored boundary duration and identity between each source | add a bounded generic source-boundary contract |
| Atom | carries `sourceId`, position, tags, phase, duration | stable movement and boundary address | use `sourceId` for V1 movement matching; give boundary atoms stable synthetic source ids |
| Player | sole reading clock; blank timing-locked atoms already pause progression correctly | boundaries must own time and pause cleanly | retain Player authority; do not use wall-time side schedulers |
| Visual program | scripture coordinate only; generic cues; cortex remains domain-blind | source/movement coordinate and distinct pools per movement | add `coordinateSpace: 'source'` |
| Audio engine | session-wide preset/soundscape, swells, pause/resume, layer gain control | movement cues and silence; later crossfades | add an audio program/controller; do not schedule against `AudioContext` wall time alone |
| Recitation | one static voice id per Session; complete-pack admission; speech owns atom duration | reliable Journey narration | V1 uses one voice for the complete Journey |
| Page Mode | consumes atoms plus visual program spatially | multi-work spatial edition | defer; source-coordinate program should remain serializable |
| Persistence | Session carries serialized scripture visual program | Journey programs must survive Chamber creation/destruction | normalize and store programs on Session |
| `Sequencer` | unused heuristic strategies, including positional “ritual” phases | authored editorial transformation | do not revive it for Journeys |

### 4.4 Why the existing `Sequencer` is not the answer

`src/core/sequencer.js` contains useful early vocabulary, but its thematic,
emergent, and ritual strategies rearrange atoms through tags, shuffling, or
positional ratios. A Journey's movement cannot be inferred from being in the
first 10% or the “climax” 15% of a text.

Journeys are authored above the runtime. The runtime validates and follows;
it does not discover their argument.

---

## 5. Architectural law

Journeys preserve the existing three-layer law:

```text
the Journey manifest authors
            ↓
the Journey compiler validates and lowers
            ↓
generic programs travel with one Session
            ↓
the Player advances one canonical reading clock
            ↓
controllers follow atom coordinates
            ↓
the cortex, audio engine, and Chamber render cues
```

The Journey compiler must not directly manipulate the DOM, `AudioContext`,
visual cortex, or Player.

The Chamber must not know what “metaphysical,” “heroic,” or “industrial”
means. It receives movement labels and generic cues.

The cortex must not know what a Journey or movement is. It receives visual
cues.

The audio engine must not know what a Journey or movement is. It receives
bounded audio commands.

No controller owns a second clock.

---

## 6. Authored manifest

### 6.1 Proposed V2 shape

Existing flat Atrium Journeys remain readable. Authored Journeys use
`movements`; a helper exposes a flattened segment list to existing readiness
and coverage code.

```js
{
  schemaVersion: 'rise.journey.v1',
  id: 'journey-war',
  domain: 'literature',
  kind: 'authored-journey',
  title: 'War',
  subtitle: 'Heaven / Glory / Steel',

  thesis: 'War descends from metaphysical order through heroic ...',
  transformation: 'The perceptible and morally total war becomes impossible.',
  terminalCondition: 'No synthesis; damaged landscape and silence.',

  estimatedMinutes: 24,
  status: 'blocked',
  openRequirements: [
    'Collate the 1929 U.S. Storm of Steel edition.'
  ],

  movements: [
    {
      id: 'war-heaven',
      title: 'War in Heaven',
      function: 'establish-metaphysical-order',
      counterpressure: 'Infernal artillery carries industrial invention ...',
      segments: [
        {
          passageId: 'pass-paradise-lost-war-heaven',
          role: 'proposition'
        }
      ],
      presentation: {
        visual: {
          kind: 'sourced',
          collections: ['journey-war-celestial-geometry']
        },
        audio: {
          kind: 'soundscape',
          soundscapeId: 'war-ordered-field',
          gain: 0.55,
          fadeMs: 1200
        },
        textStyle: 'monumental'
      },
      transitionOut: {
        id: 'war-heaven-to-hero',
        durationMs: 1600,
        visual: { kind: 'still' },
        audio: { kind: 'silence', fadeMs: 300 }
      }
    },

    {
      id: 'war-hero',
      title: 'The Hero Under Heaven',
      function: 'contract-to-mortal-body',
      counterpressure: 'The gods remain active; heroic meaning is not merely ...',
      segments: [
        { passageId: 'pass-iliad-hector-household', role: 'context' },
        { passageId: 'pass-iliad-hector-death', role: 'critique' }
      ],
      presentation: {
        visual: {
          kind: 'sourced',
          collections: ['journey-war-homeric-bronze']
        },
        audio: {
          kind: 'soundscape',
          soundscapeId: 'war-mortal-pulse',
          gain: 0.48,
          fadeMs: 900
        },
        textStyle: 'heroic'
      },
      transitionOut: {
        id: 'war-hero-to-steel',
        durationMs: 2200,
        visual: { kind: 'still' },
        audio: { kind: 'silence', fadeMs: 500 }
      }
    },

    {
      id: 'war-steel',
      title: 'Under Steel',
      function: 'materialize-and-fragment',
      counterpressure: 'Jünger recovers sublimity within the machinery ...',
      segments: [
        { passageId: 'pass-storm-of-steel-arrival', role: 'transmission' },
        { passageId: 'pass-storm-of-steel-battle', role: 'response' },
        { passageId: 'pass-storm-of-steel-aftermath', role: 'aftermath' }
      ],
      presentation: {
        visual: {
          kind: 'sourced',
          collections: ['journey-war-industrial-witness']
        },
        audio: {
          kind: 'soundscape',
          soundscapeId: 'war-pressure-field',
          gain: 0.4,
          fadeMs: 700
        },
        textStyle: 'documentary'
      },
      transitionOut: {
        id: 'war-coda',
        durationMs: 7000,
        visual: { kind: 'still' },
        audio: { kind: 'silence', fadeMs: 1200 }
      }
    }
  ],

  recitation: {
    enabled: true,
    voiceId: 'am_michael'
  }
}
```

All identifiers and numeric values pass bounded normalizers before entering
runtime state. The example names creative intentions; it does not assert that
the referenced assets or soundscapes already exist.

### 6.2 Compatibility

Introduce:

```js
readJourneySegments(journey)
```

It returns:

- `journey.movements.flatMap(movement => movement.segments)` for authored
  Journeys;
- `journey.segments` for existing Atrium Journeys.

Readiness, coverage, itinerary, and handoff code migrate to this helper before
any existing Journey record is rewritten.

There must never be two independently maintained segment orders.

---

## 7. Compiled runtime programs

The authored manifest is not executable runtime state. A pure Journey compiler
lowers it into bounded generic programs.

### 7.1 `movementProgram`

```js
{
  schema: 'rise.movement-program.v1',
  journeyId: 'journey-war',
  movements: [
    {
      id: 'war-heaven',
      index: 0,
      title: 'War in Heaven',
      sourceIds: ['pass-paradise-lost-war-heaven']
    },
    {
      id: 'war-hero',
      index: 1,
      title: 'The Hero Under Heaven',
      sourceIds: [
        'pass-iliad-hector-household',
        'pass-iliad-hector-death'
      ]
    }
  ],
  boundaries: [
    {
      id: 'war-heaven-to-hero',
      sourceId: 'journey-boundary:war-heaven-to-hero',
      fromMovementId: 'war-heaven',
      toMovementId: 'war-hero',
      durationMs: 1600
    }
  ]
}
```

This program serves:

- current-movement UI;
- diagnostics;
- movement titles or accessibility announcements;
- deterministic restart and completion reporting.

It does not contain rendering implementation.

### 7.2 Source-coordinate `visualProgram`

Extend the existing visual program:

```js
{
  coordinateSpace: 'source',
  segments: [
    {
      id: 'war-heaven-visual',
      match: {
        sourceIds: ['pass-paradise-lost-war-heaven']
      },
      cue: {
        kind: 'sourced',
        collections: ['journey-war-celestial-geometry']
      }
    },
    {
      id: 'war-heaven-to-hero-black',
      match: {
        sourceIds: ['journey-boundary:war-heaven-to-hero']
      },
      cue: { kind: 'still' }
    }
  ],
  fallback: { kind: 'still' }
}
```

`sourceId` is already carried by ordinary atoms. V1 therefore needs no new
global atom coordinate model.

The existing scripture coordinate remains unchanged. Normalization must select
one known coordinate-space contract and reject mixed or malformed matches.

This is deliberately the Chapel `visualProgram`, not a Journey-specific visual
runtime. The only extension is a coordinate adapter:

- `scripture` reads `(chapter, verse)` exactly as today;
- `source` reads `sourceId` and indexes segments by that id.

A paragraph-break atom already carries its source's `sourceId`, so it naturally
holds the movement cue. An authored boundary atom carries a different synthetic
`sourceId`, so it deliberately changes the cue. This preserves the pericope
engine's structural-silence behavior without confusing a scored transition
with incidental whitespace.

The Journey compiler also derives the initial `visualConfig` collection from
the cue matching the first playable atom. The Chamber constructs the controller
synchronously before autoplay. This incorporates two production lessons from
the Chapel: do not show a stale broad pool before the first scheduled cue, and
do not race scheduler construction against playback.

### 7.3 `audioProgram`

Introduce a sibling contract:

```js
{
  coordinateSpace: 'source',
  segments: [
    {
      id: 'war-heaven-audio',
      match: {
        sourceIds: ['pass-paradise-lost-war-heaven']
      },
      cue: {
        kind: 'soundscape',
        soundscapeId: 'war-ordered-field',
        gain: 0.55,
        fadeMs: 1200
      }
    },
    {
      id: 'war-heaven-to-hero-silence',
      match: {
        sourceIds: ['journey-boundary:war-heaven-to-hero']
      },
      cue: {
        kind: 'silence',
        fadeMs: 300
      }
    }
  ],
  fallback: { kind: 'silence', fadeMs: 500 }
}
```

V1 cue kinds:

- `hold` — leave the active audio state unchanged;
- `silence` — fade the authored music bus to zero;
- `soundscape` — activate one approved local soundscape;
- `swell` — play one approved local accent asset.

Automatic voice ducking remains off. If music should move around recitation,
that movement is authored explicitly.

True overlap crossfades between two soundscapes require two independently
gained soundscape buses. The present engine owns one soundscape handle and
stops it before starting another. V1 may use fade-to-silence boundaries; it
must not label an abrupt replacement a crossfade.

### 7.4 Authored source boundaries

Extend the canonical Session compiler input with a bounded generic contract:

```js
{
  sourceBoundaries: [
    {
      id: 'war-heaven-to-hero',
      afterSourceId: 'pass-paradise-lost-war-heaven',
      beforeSourceId: 'pass-iliad-hector-household',
      sourceId: 'journey-boundary:war-heaven-to-hero',
      kind: 'movement',
      durationMs: 1600
    }
  ]
}
```

When compiling adjacent sources:

- a matching authored boundary replaces the generic three-beat source break;
- the compiler creates one blank, timing-locked Atom;
- its `sourceId` is the stable synthetic boundary source id;
- its tags include `source-break`, `authored-boundary`, and
  `boundary:<id>`;
- its duration is clamped to a safe range;
- unmatched adjacent sources retain the current generic break.

The boundary Atom is why the Player remains the only clock. Text does not
advance “under” a transition: the transition is the current atom.

No post-compilation splice may rewrite durations or insert unvalidated atoms.

### 7.5 Session shape

`Session` gains normalized, nullable:

```js
movementProgram
audioProgram
```

It already carries `visualProgram`.

The programs are launch identity. They must survive the Chamber's
destroy/recreate cycle and serialize without executable objects, functions, DOM
nodes, or non-finite numbers.

Serialization is only half of recovery. Every collection or audio identity
named by a persisted Journey program must also be resolvable from a durable
provider catalog after a true page reload. A launch-time-only dynamic overlay
is insufficient. This follows the Chapel's `allPericopeCollections()` recovery
lesson.

---

## 8. Runtime behavior

### 8.1 Movement controller

A `MovementScheduleController` observes each emitted atom.

It:

- maps `atom.sourceId` to a movement or boundary in O(1);
- emits only when the movement/boundary identity changes;
- increments a generation token on every change;
- resets on Session restart;
- holds the active movement through paragraph-break atoms belonging to the
  same source;
- reports boundary entry distinctly from movement entry.

It does not schedule timeouts.

Its state-machine behavior follows `VisualScheduleController`: synchronous
construction, one emission per identity transition, generation increment on
change, deterministic rewind/jump resolution, and reset-triggered re-emission.
Shared coordinate/index helpers may be extracted if that reduces duplication,
but the first slice must not destabilize the proven scripture scheduler merely
to create an abstraction.

### 8.2 Visual controller

`VisualScheduleController` gains the source coordinate. It continues to emit
only cue changes and send generic cues to `visualCortex.applyCue()`.

For source-coordinate programs:

- look-ahead is based on ordered segments, not scripture chapter/verse;
- unresolved collections produce stillness;
- generation checks prevent late media from the previous movement publishing
  into the next one;
- a boundary's `still` cue clears sourced movement imagery before the next
  movement enters.

### 8.3 Audio controller

`AudioScheduleController` mirrors the visual controller:

- observes Player atom events;
- emits on cue identity change;
- delegates bounded commands to `AudioEngine`;
- uses the Player's state for pause/resume;
- cancels pending fades or stale loads with a generation token;
- never advances the Player;
- restores silence on stop and destroy.

No audio transition continues through a paused reading because a wall-clock
timer was left running. Web Audio ramps that have already been scheduled must
be cancelled or suspended by the engine's existing pause path.

### 8.4 Chamber

The Chamber wires controllers to subsystems and remains ignorant of editorial
meaning.

On atom entry, in order:

1. movement controller observes;
2. visual controller observes;
3. audio controller observes;
4. recitation begins if the atom is speakable;
5. the atom is displayed.

A boundary atom:

- speaks nothing;
- reveals no text;
- owns its full authored duration;
- applies its visual and audio cues;
- remains pausable;
- advances once, after completion.

### 8.5 Reduced motion and degradation

- Reduced motion may replace animated procedural work with a still raster or
  stillness.
- Missing visual media does not block text.
- A declared production soundscape missing from the shipped asset registry
  blocks publication; a runtime playback failure degrades to silence.
- A Journey declaring recitation is publishable only when its selected static
  voice pack covers every speakable atom in the final compiler profile.
- Runtime voice failure degrades the entire remaining reading to authored
  silent timing rather than alternating speech and silence.

---

## 9. Voice and text presentation

### 9.1 V1 voice

The current production manifest contains only the Heart static pack. Labels
exist for other voices, but a label is not an installed pack.

**War** tentatively calls for Michael (`am_michael`) as one even male narrator,
not because the authors or speakers are being impersonated, but because a
single stable documentary voice prevents the three works from becoming a
cast-performance pastiche.

Michael is not available until:

1. final passage bytes and chunk profile are fixed;
2. the static builder generates complete coverage;
3. signal validation passes;
4. the pack is included in the deployed manifest;
5. the complete Journey passes admission in a production build.

Do not generate the pack before the excerpts stabilize.

### 9.2 Per-movement voices

Deferred. The current `Voice` instance and `Session.voiceId` assume one pack
for the Session, and complete-pack admission is intentionally all-or-nothing.
Per-movement voice would require a voice resolver keyed by movement/source and
complete coverage for every declared pack. It is not necessary to prove
Journeys and would multiply asset size.

### 9.3 Text styles

The authored manifest may retain `textStyle` intent in V1, but runtime
activation is deferred until movement, visual, and audio timing are proven.

When implemented, styles must be named, bounded design-system identities—not
arbitrary CSS:

- `monumental`;
- `heroic`;
- `documentary`;
- `editorial`;
- `contemplative`.

They may change type family, scale, tracking, measure, and reveal character.
They may never reduce contrast or legibility below the base Chamber.

---

## 10. Provenance and readiness

Journey readiness is the conjunction of:

```text
editorial structure
+ every passage ready
+ every source edition ready
+ every visual collection ready
+ every audio asset ready
+ declared voice pack complete
+ compiler profile pinned
+ no open production requirement
```

### 10.1 Visual assets

Each Journey collection must record:

- stable collection id;
- stable work ids;
- provider and canonical URLs;
- artist, title, date, and credit;
- rights basis and jurisdiction;
- retrieval date;
- whether the work is an anchor, bridge, escalation, threshold, or coda asset.

Sacred imagery remains pinned and is never filled by search. **War** must not
keyword-search generic celestial figures at runtime.

### 10.2 Audio assets

Every recorded music or accent asset records:

- creator and title;
- source;
- license or public-domain basis;
- attribution;
- checksum;
- duration and technical format;
- permitted edit/derivative status.

Procedural soundscapes record their implementation version and seed policy.

### 10.3 Compiled provenance

The Session provenance includes:

- Journey id and schema version;
- movement ids in order;
- passage ids in order;
- compiler profile;
- program checksums;
- content pack version;
- build date.

Each source retains the existing edition- and passage-level provenance.

---

## 11. What to build first

### Slice 1 — authored movement skeleton

This is the first implementation. It deliberately contains no new artwork,
music, or literature payload.

Build:

1. `readJourneySegments()` compatibility helper.
2. Pure `normalizeMovementProgram()` and Journey-manifest validation.
3. `sourceBoundaries` normalization in `session-compiler.js`.
4. Stable synthetic source ids on authored boundary atoms.
5. Nullable `movementProgram` on `Session`.
6. `MovementScheduleController`.
7. Atrium handoff lowering from a three-movement fixture into:
   - verified sources;
   - authored boundaries;
   - a movement program.
8. Unit and integration tests.

Acceptance:

- three fixture movements compile in the authored order;
- every text atom resolves to exactly one movement;
- each movement boundary is a real blank Atom with the authored duration;
- total Session duration includes the exact boundary durations;
- pause during a boundary freezes progression;
- resume completes that boundary once and enters the next movement once;
- restart re-enters movement one;
- existing flat Atrium Journeys compile identically to today;
- no existing Session receives Journey state by default.

This slice proves the new medium's spine.

### Slice 2 — source-coordinate visuals

Build:

1. `coordinateSpace: 'source'` in `visual-program.js`.
2. Source matching and ordered prefetch in `visual-scheduler.js`.
3. Atrium Journey compiler emission of movement and boundary visual segments.
4. Stream tests plus Page serialization tests.
5. One fixture collection per movement and a `still` boundary.

Acceptance:

- movement entry activates only its collection;
- boundary entry clears the prior collection;
- the correct first collection is active before autoplay can display a stale
  pool;
- paragraph breaks retain the current source cue while authored boundary atoms
  enter their own cue;
- late work from movement one cannot appear in movement two;
- a persisted program can resolve all named collections after a true reload;
- missing collections yield stillness;
- scripture visual programs remain byte-for-byte behaviorally unchanged.

### Slice 3 — authored audio program

Build:

1. `audio-program.js` normalizer.
2. `audio-scheduler.js` controller.
3. bounded `AudioEngine.applyCue()` facade over existing soundscape, swell, and
   volume operations;
4. Session persistence and Chamber wiring;
5. pause, restart, teardown, and generation-race tests.

Acceptance:

- boundaries can reach real silence without ducking;
- audio does not advance when text is paused;
- repeated movement entry does not multiply soundscape handles;
- destroy leaves no live Journey sound;
- absent runtime audio degrades to silence without blocking text.

### Slice 4 — **War** editorial acquisition

Only after the skeleton is proven:

1. fix exact *Paradise Lost* route;
2. fix exact *Iliad* route and decide whether Book VI context is necessary;
3. acquire/collate the 1929 U.S. *Storm of Steel* edition;
4. create verified passage payloads and checksums;
5. perform editorial/context review;
6. compile durations using the pinned profile;
7. freeze the final movement order and boundaries.

### Slice 5 — **War** sensory production

1. build three pinned visual collections;
2. author or clear three acoustic worlds and boundary silences;
3. choose and generate the one complete static voice pack;
4. tune transitions in real browser playback;
5. add the Journey introduction, credits, and contextual apparatus;
6. conduct accessibility and photosensitivity review;
7. publish only when the complete production manifest is ready.

---

## 12. Expected file changes

First implementation slice:

```text
src/core/journey-program.js                 new
src/core/journey-program.test.js            new
src/core/movement-scheduler.js              new
src/core/movement-scheduler.test.js         new
src/core/session-compiler.js                extend source boundaries
src/core/session-compiler.test.js           boundary proofs
src/core/models.js                          carry movementProgram
src/content/atrium/journey-structure.js     new compatibility/flattening helper
src/content/atrium/validate.js              validate authored movements
src/content/atrium/readiness.js             read both journey shapes
src/content/atrium/itinerary.js             movement-aware itinerary
src/content/atrium/handoff.js               lower authored Journey
src/content/atrium/handoff.test.js          three-movement vertical fixture
src/components/Chamber.js                   wire movement observer only
```

Second slice:

```text
src/core/visual-program.js
src/core/visual-scheduler.js
src/core/visual-program.test.js
src/core/visual-scheduler.test.js
src/page/flow.js                             only if source programs reach Page
```

Third slice:

```text
src/core/audio-program.js                    new
src/core/audio-program.test.js               new
src/core/audio-scheduler.js                  new
src/core/audio-scheduler.test.js             new
src/audio/engine.js                          bounded cue facade
src/audio/engine.lifecycle.test.js
src/components/Chamber.js
src/core/models.js
```

Content and asset files for **War** are intentionally excluded from the first
slice.

---

## 13. Complexity and performance

Let:

- `A` be compiled atoms;
- `M` be movements;
- `B` be boundaries;
- `V` be visual segments;
- `U` be audio segments.

Compilation remains `O(A + M + B + V + U)`.

Runtime movement, visual, and audio lookup should index known `sourceId`
values in maps during controller construction, making atom observation `O(1)`.
Do not add an `O(M)` or `O(V)` scan on every animation frame. Controllers run
on atom entry, not per frame.

Additional in-memory state is `O(M + B + V + U)`, negligible beside decoded
images and voice buffers.

Static recitation keeps its existing bounded lead. A longer Journey increases
manifest and deployed asset size, but not the browser's decoded-audio working
set in proportion to the entire Journey.

Movement visual collections must continue using provider and decode caches with
generation invalidation. They must not preload every full-resolution work for
the complete Journey at launch.

---

## 14. Test matrix

### Pure validation

- duplicate movement ids rejected;
- empty movement rejected;
- duplicate or unknown passage reference rejected;
- movement without function/counterpressure rejected for publishable content;
- malformed transition duration clamped or rejected according to origin;
- unknown visual/audio cue kind rejected;
- existing flat Journey accepted through compatibility reader;
- mixed flat and movement ordering rejected.

### Compiler

- authored boundary replaces generic break only for its declared adjacency;
- unrelated multi-source Sessions keep the historical three-beat break;
- boundary source ids are stable;
- boundary tags and timing lock survive pacing;
- atom/source order is unchanged;
- compiler does not mutate its input.

### Runtime

- movement cue fires once per movement entry;
- paragraph break holds movement;
- boundary cue fires once;
- pause/resume during text and boundary;
- stop/restart;
- hidden-tab auto-pause;
- shuttle leaves no stale movement/audio state;
- completion includes coda duration;
- destroy cancels pending work.

### Degradation

- missing image collection → stillness;
- late image from prior generation → discarded;
- missing audio asset at runtime → silence;
- incomplete declared voice pack → no speech admission;
- runtime voice failure → silent continuation;
- reduced motion → still or stillness;
- corrupted source/payload checksum → launch blocked.

### End to end

A three-fixture Journey launches from Atrium, enters three movements, holds two
different authored boundaries, pauses during the first boundary, resumes
without skipping or replaying a completed movement, and completes with exact
movement and total-duration accounting.

---

## 15. Open creative decisions — not architecture blockers

- exact *Paradise Lost* bounds;
- whether Hector's Book VI household scene is required before Book XXII;
- exact *Storm of Steel* chapters after collation;
- total duration and passage density;
- whether movement titles are visible, announced only to assistive technology,
  or absent;
- final coda image versus black;
- Michael versus another future static narrator;
- whether the three acoustic worlds use procedural sound, commissioned music,
  cleared recordings, or a mixture;
- exact visual works and their movement roles.

These decisions should remain open until the movement skeleton can be played.
They must not be guessed into permanent core APIs.

---

## 16. Ship bar

**War** is publishable only when:

1. the Journey's argument is legible without its introductory essay;
2. each movement is necessary and materially different;
3. the transitions own time rather than covering an advancing stream;
4. every textual excerpt is exact, disclosed, and edition-linked;
5. the 1929 U.S. *Storm of Steel* text has passed collation;
6. imagery is pinned, credited, and movement-specific;
7. audio is authored rather than globally ducked or randomly triggered;
8. the static voice pack covers the final compiled text completely;
9. pause, resume, restart, and degradation remain clean;
10. the ending refuses both spectacle and automatic moral summary.

The engine is successful when it can render this argument faithfully while
knowing nothing about war.
