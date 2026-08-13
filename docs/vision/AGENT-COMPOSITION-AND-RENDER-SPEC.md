# Agent Composition and Experience Rendering

**Vision and implementation specification, 2026-08-12.**

Status: **PHASE 7 LANDED — human-reviewed social delivery (destination-neutral
queue, mock adapter, idempotent receipt, withdrawal, post-approval schedule).
Phase 8 (policy-bounded automation) is deferred.**

Companion specifications:

- [`EXPERIENCE-PROGRAM-SPEC.md`](./EXPERIENCE-PROGRAM-SPEC.md)
- [`WORKSHOP-COMPOSITION-STUDIO-SPEC.md`](./WORKSHOP-COMPOSITION-STUDIO-SPEC.md)
- [`SCRIPTORIUM-SPEC.md`](./SCRIPTORIUM-SPEC.md)
- [`RECITATION-SPEC.md`](./RECITATION-SPEC.md)
- [`NARRATION-LANE-SPEC.md`](./NARRATION-LANE-SPEC.md)
- [`../specs/ARCHIVE-CLEANSING-SPEC.md`](../specs/ARCHIVE-CLEANSING-SPEC.md)

This specification defines the path from an authored RISE experience to a
reproducible audiovisual artifact, and from the current Scriptorium proposal
loop to an agent that may gather admissible materials and compose with them.
It does not authorize autonomous publication, unrestricted network access, or
arbitrary executable media.

---

## 0. Decision

RISE will treat agent-driven text-to-video as **agent-directed audiovisual
composition**, not as a second generative-video product.

> **An agent gathers or generates admissible material, authors the same
> canonical Experience Program a human authors, RISE performs that program,
> and a deterministic render projection produces a distributable artifact.**

The distinction is structural:

- the text remains an edition-bearing source rather than prompt residue;
- media remains individually inspectable and attributable;
- the score remains editable in the Workshop;
- the interactive performance and rendered artifact share one composition;
- an export can be reproduced from its manifest;
- a human retains publication authority.

`rise.experience-program.v1` remains the one canonical score. The renderer is
a new projection of that score, parallel to Stream and Page. The agent is a
new author of validated Workshop operations, not a privileged runtime.

```
intent / source material
        ↓
agent proposal
        ↓
acquisition + provenance admission
        ↓
Workshop project + Experience Program
        ├──────────────→ Stream / Page performance
        └──────────────→ deterministic render job
                                ↓
                    MP4 + captions + credits + manifest
                                ↓
                         human publication gate
```

---

## 1. Product model

The system has three cooperating layers.

| layer | responsibility | authority |
|---|---|---|
| **Composition intelligence** | interpret intent, select sources, propose assets, author score operations | proposes |
| **RISE composition runtime** | validate, compile, preview, persist, perform | decides what is executable |
| **Distribution projection** | render an admitted composition into bounded platform editions | reproduces; never re-authors |

The surfaces keep their present roles:

| surface | role in this system |
|---|---|
| **Scriptorium** | intent, agent proposal, acquisition review, verdict |
| **Workshop** | human inspection, revision, preview, approval |
| **Vault** | durable project and render history |
| **Chamber / Page** | interactive projections of the score |
| **Render worker** | deterministic, non-interactive projection |
| **Distribution review** | final artifact, rights, credits, captions, approval |

The Scriptorium proposes; the Workshop refines; the Vault holds; the render
worker reproduces; the human publishes.

---

## 2. Goals and non-goals

### 2.1 Goals

The first complete system must:

1. render an existing, locally complete Workshop composition to MP4;
2. reproduce the same admitted render job deterministically;
3. retain stable correspondence between rendered time and source spans;
4. support explicit landscape, portrait, and square distribution profiles;
5. export captions, credits, provenance, and a render manifest beside the MP4;
6. let an agent propose bounded Workshop operations rather than opaque state;
7. admit external or generated text, image, video, and audio only through one
   acquisition and provenance gate;
8. expose every agent choice for human inspection and revision;
9. refuse unsupported or unresolvable behavior before an expensive render;
10. require an explicit human act before any public distribution.

### 2.2 Non-goals for the first release

The first release does **not**:

- allow an agent to execute arbitrary JavaScript or install render plugins;
- let an Experience Program refer directly to a remote URL;
- upload a private project to a render service without informed consent;
- promise pixel identity across unrelated browser, font, codec, and GPU stacks;
- synthesize arbitrary photorealistic video from a prompt inside RISE;
- infer rights from the fact that a model generated or found an asset;
- publish automatically to a social network;
- create a new timeline format beside the Experience Program;
- make narration an audio bed or swell to avoid designing narration authority;
- silently omit an unsupported cue from the rendered artifact;
- make the interactive Chamber obey a fixed social-media aspect ratio.

### 2.3 The first vertical slice

The first vertical slice is deliberately narrow:

> **One 20–30 second user-authored composition, one source, one image, one
> procedural visual, one muted MP4, one audio bed, on-screen text, captions,
> and a 1080×1920 MP4 rendered twice from the same job.**

Narration, autonomous acquisition, multi-platform posting, and full engine
coverage follow only after this slice is reproducible.

---

## 3. Standing invariants

These rules govern every phase.

### 3.1 One score

The Experience Program is canonical. Neither the agent nor the renderer owns
a shadow cue graph. Distribution-specific choices live in the render profile;
they do not rewrite source spans or clip authority.

### 3.2 One admitted identity per asset

Programs name durable project asset ids. They never name object URLs, delivery
URLs, temporary model URLs, local filesystem paths, or provider search results.
Those are acquisition inputs, not composition identities.

### 3.3 The agent has proposal authority

An agent may propose sources, acquisitions, edits, and render profiles. It may
not convert its own proposal into `published` authority. Imported agent work
remains `authority: "proposed"` until a person accepts it into a user project.

### 3.4 Rendering does not reinterpret

The renderer may project, letterbox, caption, mix, and encode according to an
approved profile. It may not replace a missing asset, choose a different
engine, move a source boundary, rewrite text, or invent an unscored sound.

### 3.5 Absence is not substitution

A named object that cannot resolve is absent. An unsupported required cue is a
render refusal. A profile may declare a specific, inspectable degradation only
where the canonical cue already carries that policy—for example a video's
authored reduced-motion poster behavior.

### 3.6 Reproducibility is bounded and stated

RISE promises reproducibility within a pinned render environment:

- identical admitted bytes;
- identical canonical source and program;
- identical renderer version and profile;
- identical seeds;
- pinned fonts and engine implementations;
- pinned codec configuration.

The manifest must say when this environment differs. “Deterministic” must not
be used to imply that arbitrary GPUs or browser builds produce identical
pixels.

### 3.7 Publication is a separate authority

Successful compilation and successful rendering do not authorize publication.
Publication is a human decision over a concrete artifact and its concrete
rights/credit report.

---

## 4. Canonical artifact chain

The workflow produces six artifacts with distinct jobs.

| artifact | purpose | contains media bytes? |
|---|---|---|
| `rise.curator-context.v1` | capabilities and catalogue offered to an agent | no |
| agent operation proposal | reviewable mutations and acquisition requests | no |
| Workshop project | sources, editor state, canonical program, durable asset identities | references local durable bytes |
| `rise.render-job.v1` | immutable render input and environment contract | hashes/references, not necessarily bytes |
| render package | MP4, captions, poster, credits, manifest, diagnostics | yes |
| publication receipt | records the approved artifact and destination result | no secret credentials |

No artifact should perform two of these jobs. In particular:

- curator context remains safe to share because it carries no user media;
- an operation proposal cannot smuggle bytes or executable code;
- a render job cannot acquire new media;
- a publication receipt cannot become the credential store.

---

## 5. Project asset admission

### 5.1 Why the current asset boundary must grow

RISE already has durable Workshop images and MP4s, and personal audio has its
own store. Agent composition needs a common description of project-owned media
without erasing the lane-specific runtime contracts already shipped.

The first implementation introduces a **project asset manifest** over existing
stores. It does not require an immediate storage migration.

```js
{
  schema: "rise.project-asset.v1",
  id: "asset-rain-window",
  projectId: "project-memory",
  kind: "image" | "video" | "audio" | "font" | "document",
  mimeType: "image/png",
  byteLength: 483921,
  contentHash: "sha256:…",
  dimensions: { width: 2048, height: 1365 },
  durationMs: null,
  storage: { kind: "workshop-idb", recordId: "asset-rain-window" },
  provenance: {
    origin: "upload" | "remote-acquisition" | "generated" | "library",
    sourceUrl: null,
    provider: null,
    creator: "…",
    createdAt: null,
    acquiredAt: "2026-08-12T00:00:00.000Z",
    generator: null,
    promptDigest: null
  },
  rights: {
    status: "verified" | "restricted" | "unknown" | "user-asserted",
    license: "CC0-1.0",
    credit: "…",
    evidence: "…",
    distributionAllowed: true
  },
  transformations: []
}
```

Fields are illustrative until schema implementation; their semantic divisions
are normative.

### 5.2 Identity rules

- `id` is stable inside the project.
- `contentHash` identifies admitted bytes and is mandatory before rendering.
- two ids may point to the same hash; a hash never supplies editor identity.
- object URLs are hydration results and never persist.
- remote URLs are provenance and reacquisition evidence, never playback input.
- a transformed asset receives new bytes, a new hash, and a transformation
  record; it does not overwrite its parent silently.
- an asset referenced by a score cannot be deleted without an atomic repair or
  an explicit refusal.

### 5.3 Media classes

The admission gate validates by kind:

| kind | minimum validation |
|---|---|
| image | supported MIME, byte ceiling, decodable dimensions, no SVG script |
| video | supported container/codec policy, duration, dimensions, muted-runtime policy where applicable |
| audio | supported MIME/codec, duration, channel count, sample rate, loudness analysis |
| font | approved format, embedded-license evidence, bounded glyph/size inspection |
| document/text | encoding, size, edition/provenance record, cleansing report |

RISE's existing shared limits authority remains the starting point. Render
limits may be stricter and belong in one render-limits module rather than in UI
controls.

### 5.4 Rights states

An asset may be usable interactively while still being undistributable. The
rights record must distinguish:

- admission to a private project;
- use in local preview;
- inclusion in a rendered artifact;
- public distribution;
- commercial distribution, where known.

`unknown` and `user-asserted` are not equivalent to verified permission. A
render may be produced for private review under policy, but a distribution
package with unresolved rights must fail its publication gate visibly.

---

## 6. Acquisition gateway

### 6.1 Boundary

Every external or generated object enters through one acquisition service:

```js
request → inspect → fetch/generate → validate → hash → rights/provenance
        → human verdict where required → durable project asset
```

The Experience Program cannot trigger this service. Acquisition happens before
the program may legally name the resulting id.

### 6.2 Acquisition request

An agent requests an object; it does not assert that the object is safe or
owned.

```js
{
  kind: "image",
  purpose: "passage visual",
  query: "rain on a nineteenth-century railway window",
  sourcePreference: ["public-domain", "project-media", "generated"],
  constraints: {
    orientation: "portrait",
    motion: "still",
    maxDurationMs: null,
    avoid: ["visible logos", "modern text overlays"]
  },
  proposedAnchor: { sourceId: "anna-1", fromCharacter: 420, toCharacter: 610 }
}
```

The acquisition layer may return candidates. Candidate metadata is not yet a
project asset, and the agent cannot score it until admission completes.

### 6.3 Network and provider rules

- providers use explicit adapters and allowlisted schemes/hosts;
- redirects, MIME disagreement, decompression bombs, and oversized responses
  refuse before durable storage;
- credentials remain server-side or in a user-controlled secret store and
  never enter context, program, project, render job, or publication receipt;
- fetched HTML is not treated as media;
- provider search descriptions are untrusted text and never become prompts or
  instructions without delimiting and sanitization;
- a provider failure never selects an unrelated substitute.

### 6.4 Generated media

Generated output crosses the same gate as fetched output. Its provenance must
record at minimum:

- provider/model identifier;
- generation timestamp;
- parameters needed by the provider's audit surface;
- a digest of the prompt and, when policy permits, the prompt itself;
- referenced input asset ids and hashes;
- declared rights or usage conditions;
- safety/moderation result where applicable.

Generated status is not a rights classification.

### 6.5 Text acquisition and Archive integrity

External text is not “just another file.” Before it becomes a source it needs:

- title, author, edition/translation, and source artifact;
- rights basis for that edition;
- content hash;
- encoding normalization report;
- division boundaries;
- identity and apparatus checks;
- a declared relationship to the permanent Archive, project-only text, or
  temporary private material.

Agent ingestion must reuse the Archive cleansing and edition rules rather than
creating a fast path around them. A model may flag or propose a trim; it never
rewrites an edition silently.

---

## 7. Agent authoring protocol

### 7.1 Operations, not opaque snapshots

An agent should not repeatedly emit an entire Workshop project. It proposes a
bounded command list against an explicit revision:

```js
{
  schema: "rise.agent-operation-set.v1",
  projectId: "project-memory",
  baseRevision: 14,
  intent: "Build quietly, then open into color at the final paragraph.",
  operations: [
    { op: "add-source", sourceId: "literary-walden", division: 3 },
    { op: "request-asset", requestId: "rain-window", kind: "image", query: "…" },
    { op: "assign-visual", assetId: "asset-rain-window", anchor: { /* stable span */ } },
    { op: "set-pace", cue: { wpm: 150, chunkMode: "phrase" }, anchor: { /* span */ } },
    { op: "set-render-profile", profileId: "social-portrait-1080" }
  ]
}
```

The precise schema is a later implementation artifact. These rules are
normative:

- every operation has a closed name and bounded payload;
- every operation validates independently and transactionally;
- `baseRevision` prevents an agent from overwriting intervening human edits;
- acquisition requests remain unresolved until admitted ids exist;
- source-span mutations use the canonical anchor rules;
- the result is previewable before acceptance;
- accepted operations enter the same undo/redo history as human commands;
- a failed operation does not leave a partially mutated project;
- the verdict identifies the failing operation and gives copyable correction.

### 7.2 Initial operation vocabulary

The first vocabulary should cover existing Workshop power:

- add/remove/reorder source;
- request/import project asset;
- assign/replace/erase visual clip;
- assign/replace/erase audio bed or swell;
- configure a passage or whole-reading field;
- author pace and chunk mode;
- create or revise a transition;
- create/remove a sync group;
- set project atmosphere defaults;
- select a render profile;
- request bounded preview;
- request compilation and duration estimate.

Operations that do not yet have a human Workshop equivalent should not ship as
agent-only powers.

### 7.3 Inspection and rationale

Every proposed change shown in the Workshop must expose:

- what changed;
- which source span it affects;
- which asset and provenance record it names;
- why the agent proposed it, as non-authoritative explanation;
- predicted duration and sensory-density impact;
- accessibility implications;
- Preview, Accept, Revise, and Reject.

Rationale is UI metadata. It never enters the canonical Experience Program.

### 7.4 Concurrency and cancellation

- every agent run owns a generation id;
- changing project revision invalidates stale proposals;
- cancellation prevents late acquisition or analysis results from publishing;
- already admitted bytes remain inventory until explicitly removed;
- the agent cannot hold the Workshop mutation lock while waiting on a network
  or generation provider;
- retries are explicit and idempotent by request id.

---

## 8. Scriptorium evolution

The current Scriptorium performs:

```
intent → exported context/prompt → external model → pasted score → verdict
```

The evolution is incremental:

### Stage A — score assistant

Keep the manual loop, but let the model return agent operations as well as a
complete proposed score. Resolve only Library sources and already-admitted
project assets. No network acquisition.

### Stage B — candidate curator

The agent may request external or generated candidates. The Scriptorium shows
candidates, provenance, rights, cost, and intended span before admission.

### Stage C — draft producer

After admitted assets exist, the agent completes a render-ready Workshop draft,
runs preflight, and renders a private review package.

### Stage D — distribution assistant

The agent derives multiple bounded distribution profiles and proposes titles,
descriptions, excerpts, caption styles, and posting metadata. A human still
approves each concrete artifact and destination.

### Stage E — policy-bounded channel automation

Deferred. It requires destination credentials, rate limits, moderation,
withdrawal, audit logs, cost ceilings, and explicit channel policy. Nothing in
Stages A–D implies that this authority has been granted.

---

## 9. The render projection

### 9.1 Rendering is compilation, not capture

Screen recording the Chamber is insufficient because it depends on:

- wall-clock scheduling;
- frame delivery and tab visibility;
- live audio-device behavior;
- network and object-URL timing;
- user viewport and installed fonts;
- non-repeatable random state;
- interactive pause/resume ownership.

The renderer must be able to answer:

> **What is the complete visual and acoustic state of this admitted score at
> frame `n`, whose presentation time is exactly `n / fps`?**

It therefore consumes compiled temporal data under a virtual render clock.

### 9.2 `rise.render-job.v1`

```js
{
  schema: "rise.render-job.v1",
  id: "render-memory-portrait-001",
  projectId: "project-memory",
  projectRevision: 18,
  programHash: "sha256:…",
  sourceSnapshots: [
    { sourceId: "source-1", contentHash: "sha256:…", editionId: "…" }
  ],
  assetSnapshots: [
    { assetId: "asset-rain-window", contentHash: "sha256:…" }
  ],
  profile: "social-portrait-1080",
  viewport: { width: 1080, height: 1920, pixelRatio: 1 },
  frameRate: { numerator: 30, denominator: 1 },
  durationMs: 27400,
  seed: "project-memory:18",
  renderer: {
    version: "rise-renderer/0.1.0",
    environment: "rise-render-env/1",
    fontPackHash: "sha256:…",
    codecProfile: "h264-social-v1"
  },
  policies: {
    unsupportedCue: "refuse",
    missingAsset: "refuse",
    reducedMotion: false,
    includeCredits: true
  }
}
```

The job is immutable after admission. A changed source, program, asset,
profile, or renderer version creates a new job.

### 9.3 Preflight

Before allocating frames or encoding audio, preflight must:

1. validate the project and Experience Program;
2. compile the source spans and atom timeline;
3. resolve every referenced asset and verify its content hash;
4. validate rights against the requested distribution class;
5. classify every cue against the render-support matrix;
6. resolve every font and glyph dependency;
7. calculate exact duration and frame count;
8. calculate output, decoded-media, frame-buffer, and temporary-storage budgets;
9. validate audio decode and mix requirements;
10. produce a human-readable report before rendering begins.

Preflight returns one of:

- **renderable**;
- **renderable with declared degradations**, each individually approved;
- **refused**, with typed reasons and repair actions.

### 9.4 Virtual clock

The render clock is monotonic, integer/rational, and frame-addressable. Floating
wall-clock accumulation must not decide cue boundaries.

```js
presentationTime(frame) = frame * frameRate.denominator
                        / frameRate.numerator
```

Implementations may use rational time, integer microseconds, or media timebase
ticks, but they must define one conversion and test boundary frames directly.

The render driver exposes conceptual operations:

```js
prepare(job)
renderFrame(frameIndex, presentationTime)
renderAudio(fromTime, toTime)
finalize()
cancel(reason)
```

Interactive `requestAnimationFrame`, `setTimeout`, `AudioContext.currentTime`,
and DOM observers cannot be sources of render authority.

### 9.5 Presenter adapters

Every renderable visual family must implement or lower to a render adapter that
can produce a state for an explicit time and seed.

| cue family | initial render contract |
|---|---|
| still/project image | deterministic fit/crop under profile |
| focal | deterministic focal region and page/stream placement rule |
| Gallery | explicit ordered assets and cadence; no live shuffle |
| procedural engine | pinned engine version, seed, config, and explicit time |
| Genesis/Attractor | config-keyed deterministic sample or frame adapter |
| MP4 | explicit source time mapping, fit mode, poster/reduced-motion policy |
| unsupported live source | refuse |

An engine that only advances mutable state with `step(dt)` may be rendered by
deterministic stepping from a checkpoint, but checkpoint interval and initial
state must be part of the renderer contract. Seeking by replaying the entire
experience for every frame is not an acceptable final architecture.

### 9.6 Render-support matrix

Support is declared centrally, not inferred from whether a browser presenter
happens to exist.

```js
{
  cueKind: "field:genesis",
  interactive: true,
  render: "native" | "degraded" | "unsupported",
  degradation: null,
  reason: null,
  rendererVersion: "…"
}
```

CI must fail when a new canonical cue is added without a support declaration.
This makes future extensibility explicit: a feature may ship interactive-only,
but it cannot become accidentally absent from export.

### 9.7 Text projection

The render profile determines how the reading appears, but not what it says.
It must define:

- text region and safe areas;
- typeface and fallback glyph pack;
- font-size bounds and line-height;
- chunk entrance/exit treatment;
- source title and author treatment;
- quotation and line-break preservation;
- visual contrast floor;
- caption coexistence;
- behavior when a chunk does not fit.

Text may reflow within the render projection. Source-span identity and timing
must not change. Overflow refuses preflight rather than clipping silently.

### 9.8 Audio projection

Audio rendering uses an offline timeline, not the live Web Audio lifecycle.
It must define:

- decoded sample rate and channel layout;
- bed replacement and silence authority;
- swell start times and cancellation boundaries;
- fades and crossfades;
- project-atmosphere fallback;
- pause removal—rendered time contains no interactive pause;
- peak and integrated loudness targets;
- true-peak ceiling;
- deterministic resampling/mixing environment.

Missing named audio produces silence only where the canonical cue explicitly
permits silence; otherwise it refuses.

**Narration is a separate lane.** See [`NARRATION-LANE-SPEC.md`](./NARRATION-LANE-SPEC.md).
It needs word/span correspondence, voice provenance, pronunciation policy, ducking
authority, caption alignment, and replacement/cancellation rules. It must not be
disguised as a bed or swell.

### 9.9 MP4 time mapping

For each video cue the compiled render plan resolves:

```js
{
  assetId,
  activeFromMs,
  activeToMs,
  sourceFromMs,
  sourceToMs,
  timeMode: "cue" | "fit-span" | "loop" | "hold-final",
  fit: "cover" | "contain",
  audioPolicy: "muted"
}
```

Frame extraction is deterministic within the pinned decoder environment.
Video audio remains muted under the current canonical policy; any future use
of embedded video audio needs explicit score authority and audio-mix rules.

### 9.10 Cancellation and recovery

- a render owns one job id and generation;
- cancellation stops frame production, audio mixing, and encoding;
- partial output is never presented as a completed artifact;
- resumability, if added, resumes only from verified checkpoints belonging to
  the exact same job hash;
- temporary files have bounded ownership and cleanup;
- a worker crash preserves diagnostics and never mutates the source project.

---

## 10. Distribution profiles

Profiles are versioned projection policies.

| profile | frame | typical use |
|---|---:|---|
| `social-portrait-1080` | 1080×1920 | vertical short-form video |
| `social-square-1080` | 1080×1080 | square feed |
| `cinema-landscape-1080` | 1920×1080 | landscape video |
| `archive-master-1080` | 1920×1080 or source-defined | high-quality preservation master |

A profile defines:

- dimensions, pixel ratio, frame rate, codec target, and bitrate policy;
- title, text, focal, caption, and credit safe areas;
- maximum/minimum duration where applicable;
- caption mode and style;
- content-fit rules for portrait/landscape mismatch;
- opening/closing-card policy;
- loudness target;
- reduced-motion edition policy;
- whether credits are burned in, appended, sidecar-only, or both.

Profiles may choose a different layout. They may not choose different source
text, cues, or assets. A shortened excerpt is a derived Experience Program or
explicit render range with a recorded source relationship—not an invisible
trim inside an encoder.

### 10.1 Excerpts and derivatives

A social excerpt must record:

- parent project revision and program hash;
- selected source/time range;
- whether an opening or closing card was added;
- any profile-only fades;
- the exact credits applicable to included material.

If editorial changes are required—different pacing, different visual, moved
clip—they create a new editable derivative project or program revision.

---

## 11. Render package

One successful render produces a directory or archive containing:

```
experience.mp4
poster.jpg
captions.vtt
captions.srt
credits.txt
rights-report.json
render-manifest.json
diagnostics.json
```

Optional platform metadata may include proposed title, description, hashtags,
alt text, content warning, and thumbnail variants.

### 11.1 Render manifest

The manifest records:

- render job and job hash;
- project revision and program hash;
- source edition ids and hashes;
- asset ids and content hashes;
- renderer/environment/font/codec versions;
- seed and profile;
- frame count, duration, and audio properties;
- applied degradations;
- output hashes;
- render start/end timestamps and diagnostics summary.

The manifest does not contain provider credentials, private local paths, or
full private source text.

### 11.2 Captions

Captions derive from the same compiled source/time relationship as the visual
text. They must not be reconstructed by OCR or speech recognition when the
canonical text is already known.

Caption segmentation may differ from RSVP chunks for readability, but each cue
must retain source coordinates. Captions preserve authored quotations and must
pass line-length, duration, overlap, and reading-speed checks.

### 11.3 Credits

Credits are composed from admitted source and asset provenance. A render
profile may change presentation but cannot remove an owed credit. If a platform
cannot fit the full credit in visible copy, the package must still retain the
full record and specify the required external placement.

---

## 12. Publication pipeline

### 12.1 Initial authority model

The first distribution workflow ends at a review screen:

1. render package completes;
2. output hashes and preflight verdict are shown;
3. the reviewer watches the exact artifact;
4. captions, credits, rights, and proposed metadata are inspected;
5. the reviewer downloads or explicitly approves a destination action.

No “render succeeded” event may trigger a public post.

### 12.2 Destination adapters

Future social adapters receive only an approved package and bounded metadata.
They do not receive the Workshop project or acquisition authority.

Adapters must provide:

- destination account identity;
- supported dimensions/duration/codec checks;
- upload progress and cancellation;
- idempotency key;
- returned platform post id and URL;
- failure/partial-publication state;
- deletion/withdrawal route where the platform supports it;
- publication receipt without credentials.

### 12.3 Semi-automated campaigns

A campaign may derive multiple proposed packages from one approved composition,
but approval is artifact-specific in the first release. Changing profile,
excerpt, captions, thumbnail, or text produces a new review item.

Scheduling and automatic retries follow destination approval; they do not
weaken content approval.

---

## 13. Safety, integrity, and privacy

### 13.1 Prompt and content boundaries

- external documents and provider metadata are content, never instructions;
- agent tools expose closed operations, not a shell or same-origin script;
- source text cannot request credentials or expand tool authority;
- generated descriptions are escaped before entering UI or metadata templates;
- model refusal or provider safety results are recorded without being treated
  as rights decisions.

### 13.2 Resource and cost bounds

Every agent/render run has explicit ceilings for:

- acquired bytes and asset count;
- provider requests and monetary cost;
- source characters and compiled atoms;
- duration and frame count;
- decoded video dimensions/duration;
- concurrent decoders and procedural surfaces;
- audio channels and sample count;
- temporary disk and final output size;
- retries and total wall time.

The UI shows estimated render time, output size, and external cost before the
user authorizes the work.

### 13.3 Private material

Project-only text, journal entries, personal audio, and uploads remain local by
default. A remote agent, generator, renderer, or publisher receives them only
through an explicit disclosure step that names:

- recipient/provider;
- exact material leaving the device;
- purpose;
- retention policy when known;
- estimated cost;
- whether the material may train a provider model, when known.

Local-only composition and rendering remain valid product paths.

### 13.4 Accessibility

Preflight reports:

- flashes and luminance transitions;
- minimum text contrast and size;
- caption availability and reading speed;
- audio peak/loudness;
- motion intensity;
- critical meaning carried by color alone;
- safe-area clipping.

The system may offer an independently rendered reduced-motion edition. It must
be labeled as a derivative profile and retain the same source/program identity.

---

## 14. Workshop and review UX

Agent authorship should make the Workshop clearer, not replace it with a chat
transcript.

### 14.1 Proposal map

The existing sequence-map Inspector becomes the natural review surface:

- agent-created clips appear in reading order;
- pending acquisitions appear at their proposed spans but cannot execute;
- accepted, pending, refused, and stale changes have distinct states;
- selecting a proposal highlights its text and asset provenance;
- batch acceptance remains transactional;
- the reviewer can accept one operation without accepting unrelated ones.

### 14.2 Render workspace

The render surface should show:

- profile and duration;
- support/preflight report;
- exact source and asset inventory;
- render progress by phase, not a fictional percent;
- Preview Range before Full Render;
- cancellation;
- completed artifact, poster, captions, credits, and manifest;
- derivative profiles grouped under their parent composition.

The full render is never the first feedback loop. Range preview and low-cost
draft render precede final encoding.

### 14.3 Agent conversation

Conversation may explain intent and request revisions. It is not project state.
Every accepted result must exist as validated operations and canonical project
state independently of the chat history.

---

## 15. Execution architecture

### 15.1 Separation of concerns

The implementation should introduce these boundaries:

| module/service | responsibility |
|---|---|
| project asset manifest | canonical admitted-media metadata |
| acquisition service | provider/generator requests and admission |
| agent operation validator | closed proposal vocabulary and revision checks |
| render planner | Session/Experience Program → immutable render plan |
| render support registry | cue capability and degradation declaration |
| frame presenters | explicit-time visual state |
| offline audio mixer | deterministic audio timeline |
| encoder adapter | frames + samples → media artifact |
| package builder | captions, credits, manifests, hashes |
| publication adapters | approved package → destination |

No provider SDK belongs in the Experience Program validator or Chamber.
No social API belongs in the renderer. No renderer should mutate Workshop
state.

### 15.2 Local and remote renderers

The contract permits two implementations:

- **local renderer:** strongest privacy, local CPU/GPU cost, environment setup;
- **remote renderer:** consistent pinned environment, upload/retention burden.

Both consume the same admitted render job and produce the same package shape.
The first implementation should optimize for correctness and pinned execution,
not pretend these operational models are interchangeable to the user.

A remote renderer receives a content-addressed bundle scoped to one job, never
the user's entire Vault.

### 15.3 Encoder boundary

The renderer emits timestamped frames and mixed samples to an encoder adapter.
The adapter may use an installed encoder, WebCodecs, or a render service, but
codec mechanics do not become visual-runtime authority.

The first production codec/profile must be explicitly pinned. Alternative
codecs follow only after playback compatibility and output determinism are
measured.

---

## 16. Observability and reproducibility

Each phase emits structured diagnostics:

- acquisition request/result ids;
- admission refusals;
- operation validation and stale-revision failures;
- preflight timing and support verdicts;
- per-presenter preparation/render timing;
- dropped/late frame count—required to be zero for offline render;
- decode and encode warnings;
- memory, temporary storage, and output sizes;
- package hashes;
- publication receipts.

Logs use asset/source ids and hashes. They do not print private source payloads,
prompts, credentials, or raw media.

A command-line verifier should be able to inspect a package and answer:

1. do all output hashes match?
2. which source/program/assets produced it?
3. which renderer/profile produced it?
4. were degradations applied?
5. are publication rights unresolved?

---

## 17. Build order

### Phase 0 — Render contract and inventory

1. catalogue every canonical cue and its current realtime dependencies;
2. create the central render-support registry;
3. define `rise.render-job.v1`, render limits, typed refusals, and manifest;
4. define the pinned first renderer environment and codec profile;
5. add CI guards for cue/support drift.

**Exit:** every shipped cue is declared native, degraded, or unsupported, and
one immutable job can be preflighted without rendering.

Landed in `src/core/render/`: support registry (`support.js`),
`rise.render-job.v1` (`job.js`), virtual clock (`clock.js`), pinned
environment (`environment.js`), limits/profiles (`limits.js`), and preflight
(`preflight.js`). The drift test in `support.test.js` fails CI when
`experience-program.js` grows a cue without a declaration.

### Phase 1 — Deterministic vertical slice

1. compile an existing Workshop project into a render plan;
2. implement virtual clock and static text/image projection;
3. add one deterministic procedural adapter;
4. add muted MP4 frame mapping;
5. add one offline audio-bed path;
6. encode the portrait vertical slice;
7. render the same job twice and compare decoded frames/audio under the pinned
   environment.

**Exit:** the 20–30 second reference composition renders twice with identical
manifest inputs and the chosen deterministic-output criterion.

Landed in `src/core/render/`: `plan.js` compiles the session clock into an
immutable plan; `raster.js` / `klee-adapter.js` / `video-time.js` project
still, text, Klee, and muted MP4; `audio-mix.js` mixes an offline aurora bed;
`driver.js` renders the same job twice under `decoded-identity`. Captions,
credits, and a manifest ship beside the decoded hashes. H.264 mux is the next
encoder adapter — the manifest records that gap.

### Phase 2 — Distribution package

1. captions from compiled source timing;
2. poster and thumbnail;
3. credits and rights report;
4. landscape and square profiles;
5. range preview and draft/final quality tiers;
6. package verification CLI.

**Exit:** one approved composition yields three inspectable packages without
changing canonical authorship.

Landed: `renderDistributionPackages` emits portrait, square, and landscape
packages from one program hash; posters/thumbnails are deterministic BMPs;
`renderPreview` records the parent range; `scripts/verify-render-package.mjs`
answers the five inspect questions. Owed credits cannot be dropped by a
profile.

### Phase 3 — Project asset manifest and audio convergence

1. manifest existing Workshop images/MP4s without migrating bytes;
2. manifest project-owned audio;
3. content hashing and transformation lineage;
4. distribution rights states;
5. atomic referenced-asset deletion/recovery;
6. bounded export/import bundle for render transfer.

**Exit:** every rendered byte has one durable id, hash, provenance, rights
record, and verified local/remote transfer rule.

Landed: `rise.project-asset.v1` projects Workshop images/MP4s and personal
swells without migrating IndexedDB; library beds hash against the pinned
renderer rather than user bytes; a transform writes a new id and lineage
record; scored deletion requires an atomic program repair; local and remote
transfer share `verifyTransferBundle`.

### Phase 4 — Agent operations

1. define and validate the closed operation schema;
2. map operations onto Workshop commands and undo/redo;
3. add revision conflict and stale-result cancellation;
4. show proposals in the sequence map;
5. extend Scriptorium prompt/context and refusal copy;
6. run a real intent → proposal → Workshop revision → render loop.

**Exit:** an agent can compose from existing sources/assets with no power a
human cannot inspect and reproduce.

Landed: `rise.agent-operation-set.v1` is a closed command list against
`baseRevision`; apply is transactional and maps onto Workshop history;
stale revision and cancelled generation refuse; request-asset stays pending;
the sequence map marks proposed clips; the Scriptorium prompt and refusal
copy speak operations as well as scores. The loop test walks intent →
proposal → Workshop revision → render preflight.

### Phase 5 — Acquisition gateway

1. candidate model and provider interface;
2. one public-domain image provider;
3. direct upload through the same admission path;
4. one generated-image provider behind explicit consent/cost;
5. text admission through Archive identity/cleansing checks;
6. audio/video acquisition only after their media-specific checks exist.

**Exit:** external media may enter a proposed draft, but cannot bypass durable
identity, validation, provenance, rights, or human review.

Landed: `rise.acquisition-request.v1` / `rise.acquisition-candidate.v1` /
`rise.acquisition-verdict.v1` are the one doorway. AIC resolves pinned ids
only; upload and generated image share validate/hash/rights; generation
refuses without consent and cost acknowledgement and never becomes verified
rights; Archive text reuses the shelf cleansing scores; audio/video inspect
refuses until media-specific checks exist. Admission requires a human verdict
and returns a `rise.project-asset.v1` record plus bytes — it does not write
IndexedDB. `request-asset` still applies as pending.

### Phase 6 — Narration

Write and approve its separate lane contract first. Then implement voice asset
admission, word/span timing, pronunciation review, ducking, captions, and
render/runtime execution.

**Exit:** narration is independently editable and cannot steal atmosphere or
swell authority.

Landed: `narration` is an Experience Program track of `spoken` cues. Voice
audio admits as acquisition kind `voice` (WAV/MPEG, duration required);
generic audio/video stay deferred. An authored duck may lower the bed only.
Pronunciations are a review table and never rewrite the source. Captions
keep source coordinates when they follow word timings. Agent
assign/replace/erase-narration compile onto that track and leave
`defaults.audio` untouched. Chamber recitation remains presentation, not
authorship.

### Phase 7 — Human-reviewed social delivery

1. destination-neutral review queue;
2. metadata and thumbnail variants;
3. one destination adapter;
4. idempotent upload and publication receipt;
5. withdrawal route;
6. scheduling only after explicit artifact approval.

**Exit:** RISE can prepare and deliver one approved artifact without granting
the agent publication authority.

Landed: `rise.publication-review-item.v1` is destination-neutral. Enqueue is
explicit — render completion does not create a review item, and the agent has
no publish/approve/deliver op. A human approval must name the watched artifact
hash. Unresolved rights block `social-short`. `mock-social` delivers
idempotently, records platform id/URL and artifact hash on
`rise.publication-receipt.v1` without credentials, and can withdraw.
Scheduling is allowed only after approval; the host still calls deliver.

### Phase 8 — Policy-bounded automation

Deferred until real use establishes:

- channel editorial policy;
- moderation and escalation;
- rights renewal/withdrawal;
- cost and frequency ceilings;
- credential custody;
- audit and emergency stop;
- who is accountable for publication.

---

## 18. Acceptance criteria

### 18.1 Canonical integrity

- [ ] Interactive preview and render consume the same Experience Program.
- [ ] No render path accepts a remote URL as a canonical asset id.
- [ ] Every referenced asset resolves to the expected kind and content hash.
- [ ] Agent operations cannot create same-lane overlap or invalid source spans.
- [ ] Stale proposals cannot overwrite a newer project revision.

### 18.2 Deterministic rendering

- [ ] A pinned reference job produces the same declared output criterion twice.
- [ ] Boundary-frame tests cover every cue entrance and exit.
- [ ] Seeds and presenter versions appear in the manifest.
- [ ] Offline rendering reports zero dropped or late frames.
- [ ] Missing required fonts, assets, decoders, or cue adapters refuse preflight.
- [ ] Cancellation leaves no completed artifact and no mutated project.

### 18.3 Audio and video

- [ ] Bed replacement, silence, swells, fades, and fallback match runtime law.
- [ ] MP4 `cue`, `fit-span`, `loop`, and `hold-final` time mappings are tested.
- [ ] Video audio remains muted until a separate authority is specified.
- [ ] Loudness and true peak remain inside the profile bounds.

### 18.4 Distribution

- [ ] Portrait, square, and landscape safe-area tests pass.
- [ ] Captions derive from source timing and retain source coordinates.
- [ ] Owed credits cannot be removed by a profile.
- [ ] Rights-unknown media visibly blocks public approval.
- [ ] Every output file has a hash in the render manifest.
- [ ] An excerpt records its parent composition and exact range.

### 18.5 Agent and acquisition

- [ ] The model receives bounded catalogue/capability context, not private bytes
      by default.
- [ ] External provider text cannot become tool instructions.
- [ ] Every acquisition reports source, bytes, rights state, and cost before use.
- [ ] Generated media records model, inputs, prompt digest, and policy result.
- [ ] A human can reject one proposal without corrupting accepted operations.
- [ ] A real hand-run Scriptorium-to-render loop is recorded before removing
      the manual curator controls.

### 18.6 Publication

- [ ] No render completion event publishes automatically.
- [ ] The reviewer watches the exact hashed artifact being approved.
- [ ] Destination credentials never enter project, program, render job, or
      receipt.
- [ ] Upload retries are idempotent.
- [ ] The resulting platform id/URL and approved artifact hash are recorded.

---

## 19. Verification strategy

The system needs more than screenshot comparison.

### Unit

- schema bounds and typed refusals;
- rational clock/frame calculations;
- source-to-caption timing;
- cue-to-render-plan lowering;
- asset hash/kind/rights gates;
- operation revision and transaction rules;
- audio-mix laws;
- platform profile safe areas.

### Golden fixtures

Keep a small, rights-safe render corpus:

1. still image + text;
2. procedural field with pinned seed;
3. MP4 loop crossing an authored span boundary;
4. audio bed replacement + swell;
5. mixed visual/audio/pacing score;
6. portrait/landscape severe-aspect mismatch;
7. missing asset, unsupported cue, and rights-blocked refusals.

Goldens should compare semantic render plans and selected decoded frames/audio
windows. Whole-file MP4 bytes may vary with encoder metadata unless the pinned
encoder proves byte identity; the claimed criterion must be explicit.

### Integration

- Workshop project → render job → package;
- Scriptorium operations → Workshop transaction → render;
- acquisition candidate → admitted asset → score reference;
- cancellation at every expensive phase;
- local/remote bundle hash verification;
- approved package → mocked destination receipt.

### Physical and perceptual QA

- caption legibility on target devices;
- safe-area behavior in real platform previews;
- audio loudness and clipping;
- photosensitivity and reduced-motion editions;
- portrait and landscape visual composition;
- at least one complete piece watched without developer intervention.

---

## 20. Open decisions

These require explicit rulings before their phases begin.

1. **First renderer deployment:** local worker, remote pinned worker, or a local
   development renderer followed by a remote production renderer?
2. **Determinism criterion:** byte-identical encoded output, identical decoded
   frames/samples, or bounded perceptual identity under one pinned encoder?
3. **Private render policy:** may rights-unknown user media render locally for
   private review, while remaining publication-blocked?
4. **Fonts:** ship one render font pack initially, or admit project fonts with
   separate licensing and glyph validation?
5. **Credits:** which profiles require a visible closing card in addition to
   sidecar/full-description credits?
6. **Excerpt ownership:** render range over a parent score, derivative project,
   or both depending on whether authorship changes?
7. **Narration authority:** new track kind and schema revision, or an additive
   canonical extension with compatibility rules?
8. **Agent placement:** evolve the Scriptorium in place or introduce a dedicated
   Producer surface after Stage B?
9. **Publication threshold:** is one human approval required per artifact, per
   scheduled campaign, or per tightly bounded channel policy?
10. **Archive admission:** when may project-only text remain private without
    becoming a permanent shelved work?

None of these decisions blocks Phase 0's inventory and render-contract work.

---

## 21. Release relationship

This program is strategically important but does not become a prerequisite for
the current RISE stable release. The current release should continue its
Archive integrity, device certification, and onboarding consolidation.

The render program begins as a parallel, explicitly experimental track. Phase
0 may start during consolidation because it is specification and inventory;
Phase 1 should begin only after the stable release envelope is fixed.

This protects both objectives:

- the existing interactive medium reaches readers in a trustworthy form;
- new cues added after this date cannot ignore their eventual render status.

---

## 22. North star

The desired result is not a machine that decorates text automatically.

It is a system in which a person or agent can gather words, images, motion, and
sound; compose explicit relationships among them; inspect every source and
decision; perform the work interactively; and publish a faithful cinematic
projection without losing editability, provenance, or responsibility.

> **An agent composes a traceable audiovisual reading. RISE can perform it
> live, preserve it as a score, or publish it as cinema.**

