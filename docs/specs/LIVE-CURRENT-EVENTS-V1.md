# `rise.current-events.v1`

**Status:** contract for `src/live/protocol.js` and `src/live/stream.js`. The larger plan is `docs/plans/LIVE-CURRENT.md`. The live Current, and Dive with it, are out of current scope ([Composer decision](../product/discussions/2026-10-04-composer-decision.md)); this contract still holds for the code in the tree.

Changes to a Current over time. A provider, or a person's own interruption, supplies declarative events; RISE validates them, orders them, and lowers the words they commit into the sealed `rise.current.v1` (`docs/specs/RISE-CURRENT-V1-SLICE.md`), which the Session Compiler and the one Player already run. This protocol adds no second player and no second score format.

Nothing in an event is executable. Every field is named below; a field that is not named is refused, not ignored.

## Envelope

`{ "schema": "rise.current-events.v1", "currentId": <id>, "seq": <integer ≥ 0>, "type": <type>, ...fields }`

`currentId` and every id are trimmed strings of at most 120 characters. `seq` is a whole number starting at 0 and increasing by one. Optional fields are left out; `null` is refused.

## Events

| `type` | Fields | Notes |
|---|---|---|
| `current.open` | `title` (≤200), `origin` `{kind: "human"\|"model", name, provider?}`, `theme?` | First event. A model origin must name its provider; a human origin must not. Origin is attribution, never evidence. `theme` is one of the shipped color themes of `rise.current.v1` (`JEV_COLOR_THEMES` in `src/core/jev-color-themes.js`); any other value is refused (`EVENT_THEME`). |
| `segment.begin` | `segmentId`, `visual?`, `literal?` | `visual` is `still`, `attractor` or `genesis`, the same closed catalog as `rise.current.v1`. One segment is open at a time. `literal` is `true` or absent: it says the segment's `\|` and `[PAUSE]`, `[FLASH]`, `[HOLD]` are words (see Literal text). It is decided here, once. |
| `segment.text` | `segmentId`, `offset`, `text` (≤1,000), `literal?` | `offset` must equal the characters already committed, so a repeat is detectable. Text may not contain `[PAUSE]`, `[FLASH]`, `[HOLD]`, `\|` or U+E000, checked on the joined text so a split marker is caught. In a literal segment only U+E000 and the stand-ins U+E010 and U+E011 are refused. `literal` must be present exactly when the segment began literal, or the chunk is refused (`LITERAL_MISMATCH`). |
| `segment.end` | `segmentId` | Its words, condition, evidence and Dives are then immutable: a later `segment.text`, `state.set`, `evidence.add` or `dive.attach` for it is refused (`SEGMENT_CLOSED`). Refused if nothing was said. |
| `state.set` | `segmentId`, `state` | One to ten of `tension`, `warmth`, `expansiveness`, `perceptualDensity`, `motionEnergy`, `solemnity`, `novelty`, `uncertainty`, `intimacy`, `arousal`, each 0 to 1. These describe the intended presentation, never the reader. Later events overwrite only the dimensions they name. Set while the segment is open: the imagery of a passage already shown does not change. |
| `evidence.add` | `segmentId`, `evidence` `{id, kind, title, location?, uri?, supports?}` | `kind` is `supplied`, `retrieved` or `model-proposed`. `uri` is a plain public `https` address (no other scheme, no credentials, no whitespace, no bare, private or literal host) and is only ever shown. `supports` is a span inside committed words. Add while the segment is open: the sources of a passage already shown do not change. At most eight per segment. |
| `dive.attach` | `segmentId`, `dive` `{id, text (≤600), anchor}` | Stable depth. `anchor` is exactly the `rise.current.v1` Dive anchor and is verified against the committed words. Attach while the segment is open; a later attachment is refused because it would change a Current already returned by `toCurrent()`. At most eight per segment. |
| `speech.start` / `speech.mark` / `speech.end` | `segmentId`; `charIndex`, `tMs`; `durationMs` | Normalised speech progression. Marks fall inside the words and never run backwards. |
| `interrupt` | `reason` `"user"\|"system"`, `text?` | Recorded; the newest 32 are kept. |
| `branch.open` / `branch.close` | `branchId`, `parentSegmentId`, `atCharacter`, `question?`; `branchId` | Generative depth. One Dive is open at a time. A Current cannot complete while one is open. |
| `current.cancel` | `reason?` | Terminal. |
| `current.complete` | none | Terminal. Refused while a segment or a Dive is open, or if nothing was said. |
| `error` | `code`, `message` (≤500), `recoverable` | A recoverable error is recorded and the Current continues; any other is terminal. |

## Limits

An event is at most 16 KB when serialised, and `decodeEvent` checks that before it parses. A Current has at most 16 segments, 4,000 characters per segment and 20,000 in all (so it always lowers), 8 Dives and 8 evidence records per segment, and 5,000 events.

## Ordering and failure (`createCurrentStream`)

- Events are applied in `seq` order. One that arrives early waits; at most 16 may wait.
- A repeat of an applied event is `duplicate`. A different event under a used number is refused `SEQ_CONFLICT`. An event older than the last 32 applied is `late` and ignored.
- An event more than 16 ahead is refused `SEQUENCE_GAP` and `resumeFrom` names the number to ask the provider to resume from. This is a transport condition and is not counted as a refusal.
- A malformed event that has a usable `seq` still spends that number, so one bad event cannot hold the stream at a gap. Refusals are counted; at eight the Current fails `TOO_MANY_REFUSALS`.
- A refused event changes nothing. After a terminal event everything is `ignored`.
- `apply` never throws for anything a provider can send.

## Lowering

`toCurrent()` returns the `rise.current.v1` of the segments that have **ended**. A segment still being written is omitted, so each result is a prefix of every later one: the same atoms come back and only more are added. That is what allows the one Player to be extended (plan §5) rather than replaced. State, evidence and speech marks are not part of `rise.current.v1`; they are held on the stream for the runtime.

## Beats streamed (added 2026-10-10, additive)

RISE Live stage 3 ([the RISE Live design](../superpowers/specs/2026-10-09-rise-live-design.md) §5, §8). A streamed Current used to be passages only, so a model writing as it thinks could not ask for a hold, a scene or a cue until it had finished and sealed a `rise.current.v2`. A **beat stream** carries the beats of a `rise.current.v2` one at a time, so holds and scenes arrive, and take effect, while the answer is still being written.

**Versioning: still `rise.current-events.v1`.** Everything below is an optional field or a new type. A producer that sends no `beat` and no scene event sends exactly what it sent before, and the reducer reduces it exactly as before (the same refusals, the same `rise.current.v1`). There is no v2 of the events protocol because nothing in it changes meaning: the envelope, sequencing, windows, refusal budget, limits and terminal events are the same, and an old event never means something new. What a beat stream lowers into, `rise.current.v2`, already exists and is versioned on its own. A version number marks a break; this has none.

### What is added

| `type` | Fields | Notes |
|---|---|---|
| `segment.begin` | + `beat?` | The segment is one beat. `beat` carries the beat's fields as `rise.current.v2` defines them, except what it says: `show?` (shown in place of what is said; only without `hold`), `hold?` `{ms, maxMs?}`, `scene?` (starts that scene), `cue?`, `transition?` `{ms}`, `place?`, `size?`, `type?`, `emphasis?`, `sound?`. With `beat`, `visual` and `literal` are refused (`EVENT_BEAT`): a beat's imagery is its scene, and a beat has no literal form. |
| `scene.declare` | `sceneId`, then `engine` and `params?`, or `form` | A native scene (`engine` and its manifest's `params`), or one whose source follows: `form` `"code"` (an ES module) or `"svg"` (a figure). |
| `scene.text` | `sceneId`, `offset`, `text` (≤ 2,000) | More of a code or SVG scene's source. `offset` must equal what is already held. Source is not words: it is never checked for playback markers, and is never spoken or shown. |

**Which kind of stream.** The first `segment.begin` or `scene.declare` decides: one with a `beat`, or a scene, makes a beat stream; one without, a passage stream as before. The other kind is then refused (`BEAT_MIXED`).

**A beat segment.** Its id is `beat-<n>`, `n` its place from 0, which is the id the sealed `rise.current.v2` gives that beat, so a position in the stream and in the Current are the same (`BEAT_ID`). Its committed text is what is said; with a `hold`, what is shown and never said; a hold beat commits none. So the kind follows from the body and the words: no `hold` and words, a said beat; `hold` and words, a shown beat; `hold` and no words, a hold. A said beat with nothing said is refused `EMPTY_SEGMENT`. A beat stream has at most 64 segments (the beats of a `rise.current.v2`). `dive.attach` on a beat is refused `BEAT_DIVE`: a `rise.current.v2` carries no Dives, and one attached here would be lost silently.

Every beat is held, as it begins and as it ends, to `rise.current.v2`'s own beat rules over the beats before it, and refused with their codes (`BEAT_SCENE`, `BEAT_CUE`, `BEAT_HOLD`, `BEAT_PLACE`, …): a cue needs a scene running that takes it; a scene must have been declared.

**Scenes are declared inline.** A scene arrives in the stream, by its own event, before the first beat that starts it, never in the stream's header: the model declares a scene when it has decided to use one, and a stream that never uses one says nothing about scenes. A scene is its own event, not part of a beat, for two reasons that make it unavoidable: it spans many beats (started by one, cued by others), and a scene's source (24 KB of code, 32 KB of SVG) is larger than one event (16 KB), so it arrives in pieces the way words do. Native scenes are checked against their engine's manifest when declared (`SCENE_ENGINE`, `SCENE_PARAM`, …). At most 8 scenes (`TOO_MANY_SCENES`); an id once (`DUPLICATE_SCENE`); `scene.text` for a scene not declared with a `form` is `UNKNOWN_SCENE`, past its budget `SCENE_TOO_LARGE`.

**Admission, at the reducer.** A code or SVG scene's source is sealed when the first beat that starts it begins (later `scene.text` is `SCENE_CLOSED`), and it is admitted then by the same functions the Worker's `rise_present` runs: `admitSceneCode` (`src/core/scene-admission.js`) for code, `admitSvg` (`src/core/svg-admission.js`) for a figure, after the Current's own scene rules. A refusal is the Worker's sentence: `Scene "<id>" was refused: line L, column C: <rule>.` The reducer is handed this admission (`sceneRefusal`) by the adapters that read a model's text (`text-stream.js`, as the adapter's `admitScene`), so the code parser it needs is loaded with them and not with the card, whose Current arrives sealed; a stream handed none admits no generated scene or figure.

**What the reader sees of a refused scene.** The beat that starts it is applied, and keeps its words, timing and typography; it does not start that scene, and no cue lands while the model meant that scene to be running. The reading continues on what was showing: the look's field when no scene had started. The stream lists the refusal (`refusedScenes`), and the runtime writes `scene.refused` in the journal with the Worker's sentence. A refused scene is never retried and never reaches the sealed Current.

**Lowering a beat stream.** `toCurrent()` returns the `rise.current.v2` of the beats that have ended, in order, with the scenes they start that were admitted, in the order they were declared. It is validated by `validateRiseCurrent` like any sealed Current, it is a prefix of every later one (so the one Player is extended, as for passages), and the Current a beat stream completes with is one the Worker's `rise_present` accepts (a test holds it to the Worker's own door). The stream carries no `style` or `type` (a beat's own `type` does carry).

### The line format a model writes

The text-stream adapters (mock, Gemini, OpenAI, OpenRouter) read a model's text through one parser (`src/live/adapters/segment-parser.js`). It reads passages as before, and beats, one per line:

```text
@say [options] <words>                      said and shown
@say [options] <words said> => <words shown> said one way, shown another
@show hold=<ms> [options] <words>           shown, never said
@hold <ms> [max=<ms>] [options]             time nobody speaks
@scene <id> <engine> [<param>=<value> ...]  a native scene, declared
@scene <id> code                            a generated scene; its module follows in a ``` fence
@scene <id> svg                             a figure; its SVG follows in a ``` fence
```

Options come before the words, any order: `scene=<id>` (start that scene at this beat), `cue=<name>`, `place=`, `size=`, `type=`, `emphasis=<word>,<word>`, `sound=<id>`, `transition=<ms>`; a hold takes `scene`, `cue`, `sound`, `transition` and `max`. A fence opens on a line beginning with three backticks and closes on a line that is three backticks; what is between is the source, verbatim.

What the parser does with what a model actually sends:

- **The first line decides.** A `@passage` header or a line of words first makes a passage stream, exactly as before (a bare sentence line is still a passage); a `@say`, `@show`, `@hold` or `@scene` first makes a beat stream. The other format's directives are then ignored.
- **A beat is a whole line.** A beat line is read at its newline, or at the end of the answer; a line cut off by a dropped connection or an interruption is not a beat, as a half-written passage is not a passage. In a beat stream a line of words with no directive is said.
- **Bounds, not guesses.** An option the format does not name, or a value out of bounds, is dropped and the beat kept; a `@hold` or a `@show` without a valid hold is dropped. A cue the running scene cannot take is dropped; `scene=` naming a scene that was never declared, or whose declaration was dropped, is dropped, and so are cues until a scene that exists starts. A native scene keeps only the parameters its manifest admits. Words are neutralised as in passages (`|`, `[PAUSE]`, `[FLASH]`, `[HOLD]`). A beat line over 4,600 characters is skipped.
- **Fences.** A fence left open is closed by the next line that begins a beat or a scene; a source over its budget is dropped with its scene. A `@scene … code|svg` line not followed by a fence declares nothing.
- **Chunk-invariant.** However the same text is cut into deltas, the same events come out.

## The interjection's ending (added 2026-10-10, additive)

RISE Live stage 4.5 ([the RISE Live design](../superpowers/specs/2026-10-09-rise-live-design.md) §6.1; [the plan](../plans/LIVE-CURRENT.md) §17). An answer to a reader's interjection names how the held reading goes on. Still `rise.current-events.v1`: one optional field, no new type.

| `type` | Fields | Notes |
|---|---|---|
| `current.complete` | + `ending?` | `"resume"`, `"replace"` or `"end"`; any other value is refused (`EVENT_ENDING`). The reducer keeps it (`ending`, null when unnamed); only the runtime's interjection reads it, and an unnamed ending is `resume`. |

The line a model writes, its own line, outside a fence, in either format. It ends the answer: nothing after it is read (not said, shown or named), and a provider still writing is stopped. A line that begins `@then` and names anything else is ignored:

```text
@then resume    the held reading is taken up again where it was
@then replace   the rest of the reading is withdrawn; the answer carries on as the reading
@then end       the answer ends the reading
```

An answer's beats are numbered `beat-<n>` from 0 in its own stream, as every beat stream's are. Grafted into the room they are renumbered by their place in the room's reading, which is the one `rise.current.v2` the runtime lowers (`src/live/graft.js`), so ids stay unique across the whole run; the answer's scenes are named `i<n>-<id>` there.

## Error codes

Protocol: `EVENT_LITERAL`, `EVENT_OBJECT`, `EVENT_SCHEMA`, `EVENT_TYPE`, `EVENT_ID`, `EVENT_SEQ`, `EVENT_UNKNOWN_FIELD`, `EVENT_ORIGIN`, `EVENT_THEME`, `EVENT_VISUAL`, `EVENT_TEXT`, `EVENT_RESERVED_TEXT`, `EVENT_OFFSET`, `EVENT_STATE`, `EVENT_EVIDENCE_KIND`, `EVENT_EVIDENCE_URI`, `EVENT_SPAN`, `EVENT_TIMING`, `EVENT_INTERRUPT`, `EVENT_ERROR`, `EVENT_TOO_LARGE`, `EVENT_JSON`, `EVENT_BEAT`, `EVENT_SCENE`, `EVENT_ENDING`.

Meaning: `NOT_OPEN`, `DUPLICATE_OPEN`, `WRONG_CURRENT`, `UNKNOWN_SEGMENT`, `SEGMENT_OPEN`, `SEGMENT_CLOSED`, `DUPLICATE_SEGMENT`, `TOO_MANY_SEGMENTS`, `TEXT_OFFSET`, `TEXT_TOO_LONG`, `RESERVED_TEXT`, `LITERAL_MISMATCH`, `EMPTY_SEGMENT`, `TOO_MANY_EVIDENCE`, `DUPLICATE_EVIDENCE`, `EVIDENCE_SPAN`, `TOO_MANY_DIVES`, `DUPLICATE_DIVE`, `DIVE_ANCHOR`, `SPEECH_STATE`, `SPEECH_ORDER`, `BRANCH_OPEN`, `DUPLICATE_BRANCH`, `BRANCH_POSITION`, `UNKNOWN_BRANCH`, `EMPTY_CURRENT`, `SEQ_CONFLICT`, `SEQUENCE_GAP`, `TOO_MANY_REFUSALS`, `TOO_MANY_EVENTS`, `AFTER_TERMINAL`; for beat streams `BEAT_MIXED`, `BEAT_ID`, `BEAT_DIVE`, `DUPLICATE_SCENE`, `TOO_MANY_SCENES`, `UNKNOWN_SCENE`, `SCENE_CLOSED`, `SCENE_TOO_LARGE`, and `rise.current.v2`'s own beat and scene codes.
