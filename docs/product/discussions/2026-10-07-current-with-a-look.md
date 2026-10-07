# The Current with a look (SCR-001, score stage 1) — 2026-10-07

Class C: it changes what `rise_present` accepts. Recommendations are recorded as defaults for the owner's sign-off (§6). It designs stage 1 of the [score roadmap](2026-10-06-score-speech-service-roadmap.md) (approach C: the Current as a thin envelope over the curator context) and reserves stage 2's field so stage 1 does not close it off. Building it (SCR-002 onward) follows the roadmap's own default: after the first reader observations (V1). Ground: `origin/main` = `52d5f847`.

## 1. What a Current is today

`rise.current.v1` (`src/core/rise-current.js`): `schema`, `id`, `title`, optional `theme` (one of the nine), `origin`, and 1–16 `segments` of `{ id, text, visual?, dives?, literal? }` where `visual` is `still`, `attractor` or `genesis`. The validator refuses any field it does not know. The guide a model reads (`src/live/adapters/current-guide.js`) is built from the validator's own constants around a real example a test validates.

## 2. Stage 1a: `look`, and nothing else

**The field.** An optional top-level `look`: the id of one of the looks (RDR-020, `src/core/looks.js`) that the Composer may draw.

**Which looks a Current may name.** A look draws engines (`look.engines`); the card draws only engines the catalogue marks `composer` (FND-009), today `attractor` and `klee` (Genesis). A look is admissible in a Current only if every engine it draws is a Composer engine:

| Look | Draws | In a Current |
|---|---|---|
| Plain | no field | yes: passages default to `still` |
| Garden | `klee` | yes: passages default to `genesis` |
| Signal | `attractor` | yes: passages default to `attractor` |
| Gallery, Nocturne, Flame, Iris, Revel, Inlay | Turrell, harmonograph, Living Flame, Ostensoria/Apparitio, fractal | no: not verified in the card |
| Vigil | a held focal | no: focals are not a Composer surface |

The list is derived, never kept by hand: verifying an engine for the card (its `composer` flag) admits every look made only of Composer engines, which is the [addressable-catalog design](../../superpowers/specs/2026-10-01-addressable-catalog-design.md)'s "admit only verified mappings". An inadmissible look is refused (`CURRENT_LOOK`), never approximated: a model that asked for Revel must not receive an attractor that claims to be Revel.

**How a look lowers.** Through the same partial it applies in Reader setup, as far as the card can honour it:

| Part of the look | In the card |
|---|---|
| Theme | the Current's theme when it names none; an explicit `theme` wins. The Settings sheet's "As written" is that effective theme |
| Field | the default `visual` of every passage that names none; a passage that names its `visual` keeps it |
| Typeface and size | the reading's own presentation, as in Reader; the reader's Text size row and Settings typeface still win |
| Sound | **not lowered in 1a.** A bed under `speechSynthesis` cannot be ducked honestly; Ask (SCR-004), which plays in the Reader, may lower it |
| Intensity row | unchanged rule: shown only where a passage draws the attractor |

**The schema id stays `rise.current.v1`.** `look` is additive, and the validator refuses unknown fields, so a reader without `look` refuses such a Current rather than misreads it; RISE ships as one deployment, Worker and card together. A version bump would add a migration and buy nothing.

**The guide** gains one rule, generated: the admissible looks with each look's own `line` (`looks.js`), and the example gains `"look": "signal"`; the existing test that validates the example then holds the guide to the validator.

## 3. Stage 1b: `collection`, `sound`, `pace`

Each lands alone, with its own witness, after 1a has run in the host.

| Field | Where | Value | Gate | Prerequisite |
|---|---|---|---|---|
| `collection` | per segment | an admitted imagery collection id from the curator context; the passage shows a sourced still from it | the curator-context membership gate; no URL, no bytes | the card's CSP admits the museum image hosts; the curator context served to the host as an MCP resource, so the model reads ids rather than guesses them |
| `sound` | top level | an id from the one sound list (RDR-024: `silence`, 5 atmospheres, 8 music, 11 feelings, 3 tones) | the list's own ids | a ducking path for a bed under the browser voice |
| `pace` | top level | `slow`, `natural` or `brisk`, lowered to the reading track's words per minute within the looks' pace ranges | the three names | applies to a paced (silent) reading only: when a voice speaks, the voice is the clock, and a model's pace must not fight the sentence timing narration depends on |

## 4. Stage 2: the field `program` is reserved

An optional `program`: a full `rise.experience-program.v1` whose sources are the Current's own segment ids, validated in the Worker by the Scriptorium's two gates (`validateExperienceProgram` and the curator-context membership gate). With `program` present, the per-passage `visual` is refused (one author of the visual track) and `look` contributes only its theme, typeface and size. Until SCR-005 builds it, the validator keeps refusing `program` like any unknown field; nothing in 1a or 1b may use that name.

## 5. What SCR-002 will hold with tests

- `look` admitted only from the Composer view; each inadmissible look refused with `CURRENT_LOOK` and its reason; the admissible set computed from `LOOKS` and `ENGINE_CATALOG`, equal to Plain, Garden and Signal today.
- Lowering: theme precedence; default visual for unnamed passages, kept for named ones; the look's typeface and size on the session, overridden by the reader's settings; no sound in the card.
- The guide lists exactly the admissible looks with their lines; the example with `look` validates.
- `program` still refused.

## 6. Owner questions, with the defaults in place

1. **Only Composer-verified looks** (three today), refusing the rest, rather than all ten approximated. Default: verified only.
2. **An explicit `theme` beats the look's.** Default: yes.
3. **No schema bump** (`look` is additive under v1). Default: yes.
4. **Stage 1a after V1** (the roadmap's default): unchanged; SCR-002 waits for the reader observations unless the owner moves it.
