# External Current v1: first implementation slice

**Status:** implementation slice, 29 September 2026. The attached direction proposes a larger realtime protocol; this document scopes the first independently testable seam.

## Purpose

Let a human author or model provider hand RISE a bounded, declarative answer. RISE validates it and compiles it through the existing Experience Program and Session Compiler. The compiled Session and its Player remain the one runtime Current. An external Current document is input, not another player or an alternate score format.

## Document contract

`schema: "rise.current.v1"`, a trimmed `id`, a nonempty `title`, an `origin` (`kind: "human" | "model"`, `name`, required `provider` for a model), an optional `theme`, and 1–16 ordered `segments`. The `theme` is one of the shipped color themes (`JEV_COLOR_THEMES` in `src/core/jev-color-themes.js`); any other value, `null` included, is refused (`CURRENT_THEME`) with the list of valid ids. Every segment has a unique trimmed `id`, 1–4,000 characters of nonblank `text`, an optional visual selection (`"still"`, `"attractor"`, `"genesis"`), and up to eight `dives`. Each Dive has a unique id within the segment, text of at most 600 characters, and an exact, half-open UTF-16 character span covering complete whitespace tokens plus opening and closing quote fingerprints. The fingerprints must match the selected source text and cannot contain NUL. Total text is at most 20,000 characters. Text containing the existing chunker's control markers (`[PAUSE]`, `[FLASH]`, `[HOLD]`, `|`, or U+E000) is refused until a literal-text path exists. Unknown fields, explicit null optional fields, sparse entries, and unsafe/prototype keys are refused, not discarded. A model origin identifies who generated words; it is not a factual citation.

`validateRiseCurrent(input)` returns detached, immutable data, failing with a code and path. `compileRiseCurrent(input)` returns the Session from `compileSession`, with a canonical `rise.experience-program.v1`: one movement per segment, a visual lane with a closed renderer choice, and a thread lane for anchored Dive text. Every segment becomes a separately identified source with bounded origin metadata. Generated content has `proposed` score authority; human content has `user` authority. No model supplied script, URL, shader, CSS, or arbitrary renderer configuration reaches the runtime. A theme is a name only: RISE compiles it through a fixed table (`RISE_CURRENT_THEMES`) to the page colors of the matching shipped palette, an attractor system, palette and form, and a Genesis preset, so no model color reaches the runtime. A Current with no theme compiles exactly as before.

The compiler provides the same Stream and Page projections as other Sessions. A session with at least one non-still visual starts with the continuous field enabled so the authored visual schedule can reach the Chamber; an all-still document starts with visuals off. Playback, passage anchoring, and Dive use existing runtime semantics. A caller may explicitly choose `projection: "page"`; default is `stream`. Compilation never makes network calls.

## Deliberately outside this slice

This is a **sealed response**, not a realtime event stream. It does not synthesize speech, align audio, accept a microphone, connect to any model provider, provide an MCP app, or branch the conversation. A later event protocol must define incremental commit, cancellation, audio clock ownership, and branch/surface semantics before it claims to run live. No new Experience State or affect dimensions are introduced here; the unvalidated affect PR is not the foundation of the external format.

## Evidence

One fixture from a named human and one from a named model must compile to the same Session contract. Tests must reject unknown visuals, executable-looking extra fields, malformed or dishonest quote spans, duplicate ids, empty content, excessive length, and invalid provider attribution. A short demo module can feed a two-segment answer into the compiler without browser or provider credentials. Successful tests establish the protocol seam only, not the proposed audiovisual product's value.
