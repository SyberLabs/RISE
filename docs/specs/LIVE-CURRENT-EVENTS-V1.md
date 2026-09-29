# `rise.current-events.v1`

**Status:** contract for `src/live/protocol.js` and `src/live/stream.js`. The larger plan is `docs/plans/LIVE-CURRENT.md`.

Changes to a Current over time. A provider, or a person's own interruption, supplies declarative events; RISE validates them, orders them, and lowers the words they commit into the sealed `rise.current.v1` (`docs/specs/RISE-CURRENT-V1-SLICE.md`), which the Session Compiler and the one Player already run. This protocol adds no second player and no second score format.

Nothing in an event is executable. Every field is named below; a field that is not named is refused, not ignored.

## Envelope

`{ "schema": "rise.current-events.v1", "currentId": <id>, "seq": <integer ≥ 0>, "type": <type>, ...fields }`

`currentId` and every id are trimmed strings of at most 120 characters. `seq` is a whole number starting at 0 and increasing by one. Optional fields are left out; `null` is refused.

## Events

| `type` | Fields | Notes |
|---|---|---|
| `current.open` | `title` (≤200), `origin` `{kind: "human"\|"model", name, provider?}` | First event. A model origin must name its provider; a human origin must not. Origin is attribution, never evidence. |
| `segment.begin` | `segmentId`, `visual?`, `literal?` | `visual` is `still`, `attractor` or `genesis`, the same closed catalog as `rise.current.v1`. One segment is open at a time. `literal` is `true` or absent: it says the segment's `\|` and `[PAUSE]`, `[FLASH]`, `[HOLD]` are words (see Literal text). It is decided here, once. |
| `segment.text` | `segmentId`, `offset`, `text` (≤1,000), `literal?` | `offset` must equal the characters already committed, so a repeat is detectable. Text may not contain `[PAUSE]`, `[FLASH]`, `[HOLD]`, `\|` or U+E000, checked on the joined text so a split marker is caught. In a literal segment only U+E000 and the stand-ins U+E010 and U+E011 are refused. `literal` must be present exactly when the segment began literal, or the chunk is refused (`LITERAL_MISMATCH`). |
| `segment.end` | `segmentId` | Its words are then immutable. Refused if nothing was said. |
| `state.set` | `segmentId`, `state` | One to ten of `tension`, `warmth`, `expansiveness`, `perceptualDensity`, `motionEnergy`, `solemnity`, `novelty`, `uncertainty`, `intimacy`, `arousal`, each 0 to 1. These describe the intended presentation, never the reader. Later events overwrite only the dimensions they name. |
| `evidence.add` | `segmentId`, `evidence` `{id, kind, title, location?, uri?, supports?}` | `kind` is `supplied`, `retrieved` or `model-proposed`. `uri` is a plain public `https` address (no other scheme, no credentials, no whitespace, no bare, private or literal host) and is only ever shown. `supports` is a span inside committed words. At most eight per segment. |
| `dive.attach` | `segmentId`, `dive` `{id, text (≤600), anchor}` | Stable depth. `anchor` is exactly the `rise.current.v1` Dive anchor and is verified against the committed words. At most eight per segment. |
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

## Error codes

Protocol: `EVENT_LITERAL`, `EVENT_OBJECT`, `EVENT_SCHEMA`, `EVENT_TYPE`, `EVENT_ID`, `EVENT_SEQ`, `EVENT_UNKNOWN_FIELD`, `EVENT_ORIGIN`, `EVENT_VISUAL`, `EVENT_TEXT`, `EVENT_RESERVED_TEXT`, `EVENT_OFFSET`, `EVENT_STATE`, `EVENT_EVIDENCE_KIND`, `EVENT_EVIDENCE_URI`, `EVENT_SPAN`, `EVENT_TIMING`, `EVENT_INTERRUPT`, `EVENT_ERROR`, `EVENT_TOO_LARGE`, `EVENT_JSON`.

Meaning: `NOT_OPEN`, `DUPLICATE_OPEN`, `WRONG_CURRENT`, `UNKNOWN_SEGMENT`, `SEGMENT_OPEN`, `SEGMENT_CLOSED`, `DUPLICATE_SEGMENT`, `TOO_MANY_SEGMENTS`, `TEXT_OFFSET`, `TEXT_TOO_LONG`, `RESERVED_TEXT`, `LITERAL_MISMATCH`, `EMPTY_SEGMENT`, `TOO_MANY_EVIDENCE`, `DUPLICATE_EVIDENCE`, `EVIDENCE_SPAN`, `TOO_MANY_DIVES`, `DUPLICATE_DIVE`, `DIVE_ANCHOR`, `SPEECH_STATE`, `SPEECH_ORDER`, `BRANCH_OPEN`, `DUPLICATE_BRANCH`, `BRANCH_POSITION`, `UNKNOWN_BRANCH`, `EMPTY_CURRENT`, `SEQ_CONFLICT`, `SEQUENCE_GAP`, `TOO_MANY_REFUSALS`, `TOO_MANY_EVENTS`, `AFTER_TERMINAL`.
