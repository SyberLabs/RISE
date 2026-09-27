# Jev presentation variety evaluation

## What is measured

The [case set](../../scripts/jev-eval-cases.json) contains 16 synthetic reader prompts in eight contrast pairs. Each pair changes one or several explicit requests for pace, sound, moving visuals, visual energy, typeface, or type size. The [production option snapshot](../../scripts/jev-eval-options.json) is the six relevant fields from `worker/jev-recommend.mjs` on 2026-09-26. The [candidate snapshot](../../scripts/jev-eval-options-candidate.json) adds `soft-rain` sound and `mono` type. Keep both snapshots so the original production baseline remains reproducible. The scorer reports:

- Exact offered-choice validity (all six fields, no extra keys)
- Explicit preference matches, counted by field
- Pairs where every requested opposite field actually differs
- Distinct values selected per field
- Provider token usage when supplied, and the number of calls whose usage was not reported

A larger distinct-value count alone does not prove better personalization: the explicit-match and contrast results must improve as well. The fixture does not judge book relevance, reading quality, accessibility, or visual safety. It is a small regression set, not a reader study.

The candidate reuses one 5-minute decision cache slot for a specific intent. Exact open discovery requests rotate four slots. That caps fresh Jev calls for the same intent and menu in that window at one or four respectively, subject to the existing rate limit. The current route does not expose provider tokens or price, so this is a call-count bound, not a measured dollar cost.

## Current production baseline

On 2026-09-26, six prompts from the set were sent once each to `https://rise.syberlabs.io/api/jev-recommend` with the same-origin header. All six returned HTTP 200 from `typesafe/jev-1.13-20260917`. The [sanitized record](../../scripts/jev-eval-production-baseline-2026-09-26.json) retains only prompt IDs and the six selected fields; it contains no user input, request identifiers, or credentials.

For this **six-prompt partial baseline**, 7 of 8 explicitly requested fields matched, and 0 of 1 complete contrast pair differed on all requested opposite fields. `visualMode` was `interlocution` in all six; `visualStyle` was `psychedelic` in five. The "no moving visuals" prompt still selected `interlocution`, accounting for the explicit miss. The route did not return token usage or a price, so actual Jev cost is unknown. A single result per prompt does not measure run-to-run variance.

Reproduce the score:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options.json --input scripts/jev-eval-production-baseline-2026-09-26.json --only-recorded
```

For a full pre/post comparison, collect one decision for each of the 16 prompts on the candidate build, score with the candidate option snapshot, and omit `--only-recorded`. A `--input` file accepts `{ "model": "...", "rows": [{ "id": "...", "decision": { ... }, "usage": { "prompt_tokens": 0, "completion_tokens": 0 } }] }`. Omit `usage` when the route does not expose it; the scorer marks it unreported. The two new-option cases have no old-production result, so compare shared cases separately when attributing a change to the harness.

## Bounded Hugging Face comparison

The runner can ask a Hugging Face hosted chat model to choose the same six presentation fields. This is **exploratory**: a chat completion is not TypeSafe Jev's 22-question decision API, and it cannot establish that switching production models would improve the actual reader journey. It can reveal whether an available model follows explicit choice constraints and returns parseable JSON on these prompts. Model availability and provider price must be checked at run time.

With a Hugging Face token in `HF_TOKEN`, run one model per invocation:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --hf-model Qwen/Qwen3-4B-Instruct-2507 --max-calls 16 --output qwen-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --hf-model openai/gpt-oss-20b --max-calls 16 --output gpt-oss-eval.json
```

The runner makes at most 16 requests per invocation, never retries, limits each completion to 200 tokens, and uses a 15-second request timeout. The `--max-calls` argument has an absolute ceiling of 16 and must cover every case. It records provider usage when returned, but it cannot enforce a dollar limit because provider billing varies; check the [Hugging Face model listing and provider pricing](https://huggingface.co/docs/inference-providers/index) before a run and the [billing page](https://huggingface.co/docs/inference-providers/pricing) after it. The two candidate model IDs come from the [Qwen model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) and [Hugging Face's gpt-oss guide](https://huggingface.co/docs/inference-providers/guides/gpt-oss). Hugging Face also documents [JSON schema constrained output](https://huggingface.co/docs/inference-providers/guides/structured-output); this raw-JSON run intentionally measures format failures instead of hiding them behind provider constraints.

No **hosted chat model** inference was run on 2026-09-26: this workspace had no `HF_TOKEN`. There are no hosted-model quality or cost results yet.

## Local Hugging Face model sanity check

The repository's existing `@huggingface/transformers` dependency loaded the [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) q8 feature-extraction model locally. The [local selector](../../scripts/jev-eval-local-hf.mjs) chooses each field by cosine similarity between the prompt and short, human-authored option descriptions. This is a cheap semantic baseline and has no JSON generation, cross-field constraint handling, or Jev book selection. It is not a drop-in production alternative.

With the candidate options, the [captured 16-prompt run](../../scripts/jev-eval-local-hf-2026-09-26.json) had 23/26 explicit-field matches, 7/8 complete contrast pairs, and no invalid choices by construction. Its misses were large text selected as medium, and the combined vivid/fast request selected slow pace and graphic line art. The model selected all four sound values at least once, and four of five typefaces. Local inference elapsed 177 ms after the model was cached; model download time, electricity, and dollar cost were not measured. These scores cannot be directly compared with the six-prompt production Jev baseline because both the sample and the task differ.

Reproduce (model download is about 23 MB for the q8 file, plus tokenizer files):

```powershell
node scripts/jev-eval-local-hf.mjs scripts/jev-eval-cases.json scripts/jev-eval-options-candidate.json local-hf-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json --input local-hf-eval.json
```

## Local reader handoff

A production build was opened in Chromium on a separate local preview port. A synthetic, valid version-1 Worker JSON decision selected `soft-rain`, `mono`, large text, and a released Standard Ebooks division. The Portal opened a playable Chamber session; the live word element reported the `mono` face and the compiled session reported `soft-rain`. This verifies the JSON-to-reader path with a mocked decision, not the candidate Worker against live Jev. Soft Rain's graph and stop lifecycle passed unit tests, but its sound has not had a listening review. The Postgres seed has not been applied to the live database.
