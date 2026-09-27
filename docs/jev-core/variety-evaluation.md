# Jev presentation variety evaluation

## What is measured

The [case set](../../scripts/jev-eval-cases.json) contains 12 synthetic reader prompts in six contrast pairs. Each pair changes one or several explicit requests for pace, sound, moving visuals, visual energy, typeface, or type size. The [option snapshot](../../scripts/jev-eval-options.json) is the six relevant fields from `worker/jev-recommend.mjs` on 2026-09-26; update it when the Worker menu changes. The scorer reports:

- Exact offered-choice validity (all six fields, no extra keys)
- Explicit preference matches, counted by field
- Pairs where every requested opposite field actually differs
- Distinct values selected per field
- Provider token usage when supplied, and the number of calls whose usage was not reported

A larger distinct-value count alone does not prove better personalization: the explicit-match and contrast results must improve as well. The fixture does not judge book relevance, reading quality, accessibility, or visual safety. It is a small regression set, not a reader study.

## Current production baseline

On 2026-09-26, six prompts from the set were sent once each to `https://rise.syberlabs.io/api/jev-recommend` with the same-origin header. All six returned HTTP 200 from `typesafe/jev-1.13-20260917`. The [sanitized record](../../scripts/jev-eval-production-baseline-2026-09-26.json) retains only prompt IDs and the six selected fields; it contains no user input, request identifiers, or credentials.

For this **six-prompt partial baseline**, 7 of 8 explicitly requested fields matched, and 0 of 1 complete contrast pair differed on all requested opposite fields. `visualMode` was `interlocution` in all six; `visualStyle` was `psychedelic` in five. The "no moving visuals" prompt still selected `interlocution`, accounting for the explicit miss. The route did not return token usage or a price, so actual Jev cost is unknown. A single result per prompt does not measure run-to-run variance.

Reproduce the score:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options.json --input scripts/jev-eval-production-baseline-2026-09-26.json --only-recorded
```

For a full pre/post comparison, collect one decision for each of the 12 prompts on the candidate build, use the same option snapshot, and omit `--only-recorded`. A `--input` file accepts `{ "model": "...", "rows": [{ "id": "...", "decision": { ... }, "usage": { "prompt_tokens": 0, "completion_tokens": 0 } }] }`. Omit `usage` when the route does not expose it; the scorer marks it unreported.

## Bounded Hugging Face comparison

The runner can ask a Hugging Face hosted chat model to choose the same six presentation fields. This is **exploratory**: a chat completion is not TypeSafe Jev's 22-question decision API, and it cannot establish that switching production models would improve the actual reader journey. It can reveal whether an available model follows explicit choice constraints and returns parseable JSON on these prompts. Model availability and provider price must be checked at run time.

With a Hugging Face token in `HF_TOKEN`, run one model per invocation:

```powershell
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options.json --hf-model Qwen/Qwen3-4B-Instruct-2507 --max-calls 12 --output qwen-eval.json
node scripts/jev-eval.mjs --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options.json --hf-model openai/gpt-oss-20b --max-calls 12 --output gpt-oss-eval.json
```

The runner makes at most 12 requests per invocation, never retries, limits each completion to 200 tokens, and uses a 15-second request timeout. The `--max-calls` argument has an absolute ceiling of 16 and must cover every case. It records provider usage when returned, but it cannot enforce a dollar limit because provider billing varies; check the [Hugging Face model listing and provider pricing](https://huggingface.co/docs/inference-providers/index) before a run and the [billing page](https://huggingface.co/docs/inference-providers/pricing) after it. The two candidate model IDs come from the [Qwen model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) and [Hugging Face's gpt-oss guide](https://huggingface.co/docs/inference-providers/guides/gpt-oss). Hugging Face also documents [JSON schema constrained output](https://huggingface.co/docs/inference-providers/guides/structured-output); this raw-JSON run intentionally measures format failures instead of hiding them behind provider constraints.

No Hugging Face inference was run on 2026-09-26: this workspace had neither `HF_TOKEN` nor a cached local Hugging Face model. There are no Hugging Face quality or cost results yet.
