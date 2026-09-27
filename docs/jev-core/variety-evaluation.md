# Jev presentation variety evaluation

## Expressive look check

The [eight look prompts](../../scripts/jev-eval-look-cases.json) test independently requested text ink and background colors, typeface, size, sound, and visual motion against the [current offered choices](../../scripts/jev-eval-look-options.json). The local MiniLM semantic selector returned valid choices for all eight prompts, matched 11 of 14 explicitly requested fields, and made all requested opposite fields differ in 3 of 4 prompt pairs. Those contrast pairs measure **intent differentiation**, not color readability. The separate palette test checks all 36 ink and background pairings and found a minimum 10.85:1 text contrast ratio.

On 2026-09-26, the [sanitized live schema-v2 record](../../scripts/jev-eval-production-look-2026-09-26.json) captured eight HTTP 200 responses from `rise.syberlabs.io` while the site served release `467721cae7e1a1c76ed88a7864db11b4fb3d094a`. All eight offered-choice decisions were valid; 14 of 14 explicit preferences matched, and 4 of 4 contrast pairs changed the requested choice. The response model was `typesafe/jev-1.13-20260917`. The route does not report provider token usage, and a single pass does not measure repeatability or reader enjoyment. Live speech recognition also needs a reader with a microphone.

The local selector is an independent semantic baseline, not TypeSafe Jev. The live record excludes prompts, request IDs, and credentials; the case file supplies the synthetic prompts for reproduction.

```powershell
node scripts/jev-eval-local-hf.mjs scripts/jev-eval-look-cases.json scripts/jev-eval-look-options.json local-look-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-look-cases.json --options scripts/jev-eval-look-options.json --input local-look-eval.json
node scripts/jev-eval-live.mjs scripts/jev-eval-look-cases.json scripts/jev-eval-look-options.json live-look-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-look-cases.json --options scripts/jev-eval-look-options.json --input live-look-eval.json
```

## What is measured

The [case set](../../scripts/jev-eval-cases.json) now contains 39 synthetic reader prompts, including 19 contrast pairs, across pace, sound, moving visuals, visual energy, typeface, and type size. The [original production option snapshot](../../scripts/jev-eval-options.json) preserves the smaller menu used for the first six-prompt baseline. The [current candidate snapshot](../../scripts/jev-eval-options-candidate.json) includes all 23 sound beds, seven text faces, and five sizes. Keep both snapshots so the original production baseline remains reproducible. The scorer reports:

- Exact offered-choice validity (all six fields, no extra keys)
- Explicit preference matches, counted by field
- Pairs where every requested opposite field actually differs
- Distinct values selected per field
- Provider token usage when supplied, and the number of calls whose usage was not reported

A larger distinct-value count alone does not prove better personalization: the explicit-match and contrast results must improve as well. The fixture does not judge book relevance, reading quality, accessibility, or visual safety. It is a small regression set, not a reader study.

The candidate reuses one 1-hour decision cache slot for a specific intent. Exact open discovery requests rotate eight slots. That caps fresh Jev calls for the same intent and menu in that window at one or eight respectively, subject to the existing rate limit. The current route does not expose provider tokens or price, so this is a call-count bound, not a measured dollar cost.

## Current production baseline

The [full live v2 baseline](../../scripts/jev-eval-production-broad-baseline-2026-09-26.json) captured all 39 cases in three batches of at most 16, below the Worker's 30-per-minute per-IP limit. All 39 responses had valid offered choices; 47 of 49 explicit preferences matched, and all 19 paired contrasts differed. The two misses were sound: a combined fast/psychedelic prompt requested an atmospheric bed but got `chase`, and “Let the ending feel triumphant” got `happy` for the opening sound and the finale. Repeating the latter request three times again returned `happy` for the opening sound. These observations motivated phase-specific sound instructions and an alias for “triumphant” in the sound shortlist. The record was captured on release `e32bd26a280653a331d0743f661b0ff7d1300bb2`; it contains no prompts, request IDs, or secrets. The route reports no token usage.

The [four-prompt phase baseline](../../scripts/jev-eval-production-phase-baseline-2026-09-26.json) matched 8 of 12 explicit opening/finale choices and 1 of 2 contrast pairs on the same release. In both audio-phase prompts Jev chose a `single` arc, so the requested ending sound would not play even when its `finaleAudio` answer differed. The harness now permits an audio program with visuals off and a null visual program; it also makes opening and ending questions explicit. These new rules still require a post-deploy live check.

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --input scripts/jev-eval-production-broad-baseline-2026-09-26.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-phase-cases.json --options scripts/jev-eval-phase-options.json --input scripts/jev-eval-production-phase-baseline-2026-09-26.json
```

### Historical six-prompt baseline

On 2026-09-26, six prompts from the set were sent once each to `https://rise.syberlabs.io/api/jev-recommend` with the same-origin header. All six returned HTTP 200 from `typesafe/jev-1.13-20260917`. The [sanitized record](../../scripts/jev-eval-production-baseline-2026-09-26.json) retains only prompt IDs and the six selected fields; it contains no user input, request identifiers, or credentials.

For this **six-prompt partial baseline**, 7 of 8 explicitly requested fields matched, and 0 of 1 complete contrast pair differed on all requested opposite fields. `visualMode` was `interlocution` in all six; `visualStyle` was `psychedelic` in five. The "no moving visuals" prompt still selected `interlocution`, accounting for the explicit miss. The route did not return token usage or a price, so actual Jev cost is unknown. A single result per prompt does not measure run-to-run variance.

Reproduce the score:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options.json --input scripts/jev-eval-production-baseline-2026-09-26.json --only-recorded
```

For a new comparison, collect decisions against the current candidate snapshot and score all recorded cases. A `--input` file accepts `{ "model": "...", "rows": [{ "id": "...", "decision": { ... }, "usage": { "prompt_tokens": 0, "completion_tokens": 0 } }] }`. Omit `usage` when the route does not expose it; the scorer marks it unreported. Compare only shared cases when attributing a change to the harness.

## Bounded Hugging Face comparison

The runner can ask a Hugging Face hosted chat model to choose the same six presentation fields. This is **exploratory**: a chat completion is not TypeSafe Jev's multi-question decision API, and it cannot establish that switching production models would improve the actual reader journey. It can reveal whether an available model follows explicit choice constraints and returns parseable JSON on these prompts. Model availability and provider price must be checked at run time.

With a Hugging Face token in `HF_TOKEN`, run one model per invocation:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --hf-model Qwen/Qwen3-4B-Instruct-2507 --max-calls 16 --output qwen-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --hf-model openai/gpt-oss-20b --max-calls 16 --output gpt-oss-eval.json
```

The runner makes at most 16 requests per invocation, never retries, limits each completion to 200 tokens, and uses a 15-second request timeout. The `--max-calls` argument has an absolute ceiling of 16 and must cover every case. It records provider usage when returned, but it cannot enforce a dollar limit because provider billing varies; check the [Hugging Face model listing and provider pricing](https://huggingface.co/docs/inference-providers/index) before a run and the [billing page](https://huggingface.co/docs/inference-providers/pricing) after it. The two candidate model IDs come from the [Qwen model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) and [Hugging Face's gpt-oss guide](https://huggingface.co/docs/inference-providers/guides/gpt-oss). Hugging Face also documents [JSON schema constrained output](https://huggingface.co/docs/inference-providers/guides/structured-output); this raw-JSON run intentionally measures format failures instead of hiding them behind provider constraints.

No **hosted chat model** inference was run on 2026-09-26: this workspace had no `HF_TOKEN`. There are no hosted-model quality or cost results yet.

## Local Hugging Face model sanity check

The repository's existing `@huggingface/transformers` dependency loaded the [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) q8 feature-extraction model locally. The [local selector](../../scripts/jev-eval-local-hf.mjs) chooses each field by cosine similarity between the prompt and short, human-authored option descriptions. This is a cheap semantic baseline and has no JSON generation, cross-field constraint handling, or Jev book selection. It is not a drop-in production alternative.

The [first candidate run](../../scripts/jev-eval-local-hf-2026-09-26.json), before the six mood sounds were added, scored 23/26 explicit-field matches and 7/8 complete contrast pairs. The [merged candidate rerun](../../scripts/jev-eval-local-hf-merged-2026-09-26.json) also scored 23/26 and 7/8 after the high-energy combined case was updated to accept `excited` audio. It selected seven of ten sound values and four of five typefaces. Three misses remained: large text became medium, while the combined vivid/fast request became slow with graphic line art. Local inference elapsed 169 ms after the model was cached; model download time, electricity, and dollar cost were not measured. Neither local score can be directly compared with the six-prompt production Jev baseline because both the sample and the task differ. None of the 16 cases explicitly asks for each of the six new moods.

Reproduce (model download is about 23 MB for the q8 file, plus tokenizer files):

```powershell
node scripts/jev-eval-local-hf.mjs scripts/jev-eval-cases.json scripts/jev-eval-options-candidate.json local-hf-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --input local-hf-eval.json
```

## Local reader handoff

A production build was opened in Chromium on a separate local preview port. A synthetic, valid version-1 Worker JSON decision selected `soft-rain`, `mono`, large text, and a released Standard Ebooks division. The Portal opened a playable Chamber session; the live word element reported the `mono` face and the compiled session reported `soft-rain`. This historical check used a mocked decision. A later live browser request did open a Chamber reading from a real schema-v2 Jev choice. Soft Rain's graph and stop lifecycle passed unit tests, but its sound has not had a listening review.
