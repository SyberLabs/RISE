# OpenRouter switch review

Reviewed the frozen server implementation in `netlify/functions/jev-decision.mjs`, its focused service tests, the client conductor contract, and the consent copy. This is a source and mocked-test review; it does not establish a successful authenticated provider request.

## Findings

- The configured default is `openai/gpt-4.1-mini`. OpenRouter lists structured-output support and prices it at $0.40/M input and $1.60/M output tokens. It is a candidate for this three-action task; RISE still needs an authenticated decision-quality evaluation. Capabilities and prices should be rechecked before changing the configured model.
- The request uses OpenRouter's documented strict `json_schema` response format and provider routing with `require_parameters: true` and `data_collection: 'deny'`. This filters to providers that support the requested parameters and are marked not to collect user data. It is not equivalent to Zero Data Retention; OpenRouter exposes ZDR as a separate routing control. Current privacy text does not promise no retention.
- Reader intent, feedback, excerpt, mode, and pace are serialized as user context, separate from the system instruction. That instruction treats those values as context rather than task overrides and disallows rewriting, summarizing, reordering, skipping, or adding to the source. The schema and local check accept exactly one action field with `continue`, `slower`, or `pause`.
- The service fails closed for upstream HTTP errors, invalid JSON, top-level and per-choice errors, multiple choices, non-stop finish reasons, refusals, tool calls, non-assistant messages, extra/malformed action fields, and unknown actions. It does not expose upstream error bodies or invent a confidence score. The client also checks the request ID before accepting a decision.
- OpenRouter's documented latest-family model IDs may have a leading `~`. The server now accepts that form in returned model metadata; the configured default remains fixed to that model name and does not use a latest-family alias. The focused service test covers alias metadata.
- The remaining malformed-shape nit is that `message.tool_calls?.length` rejects normal non-empty tool-call arrays but would not reject every malformed truthy non-array value. Since action JSON is independently exact-checked and tool use is not requested, this is not a demonstrated bypass. Consider rejecting the presence of `tool_calls` unless it is absent or an empty array if the upstream shape contract makes that distinction necessary; do not add more generic validation absent evidence.
- Consent says excerpt and associated reading context go through OpenRouter to the selected model provider, and says nothing is sent before agreement. It does not claim that the provider is a particular fixed model, which matters because `OPENROUTER_MODEL` can override the default.

## Evidence and limits

The focused function tests exercise the request shape, origin and size limits, routing fields, timeout/error handling, output rejection, and latest-alias metadata using mocked `fetch`. Those tests verify local behavior, not provider availability, actual data-retention policy, or decision quality. No authenticated live request was performed in this review.

Official references checked September 25, 2026:

- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [GPT-4.1 Mini catalog and pricing](https://openrouter.ai/openai/gpt-4.1-mini/benchmarks)
