# Provider access and alternatives

Checked 25 September 2026. Recommendation: try the official TypeSafe console first; use OpenRouter as the fastest hosted alternative if account access is actually blocked. Evaluate Laya separately before making it responsible for reading progression. No provider change has been approved or implemented.

## TypeSafe / Jev

The [official quickstart](https://docs.typesafe.ai/introduction/quickstart) directs users to obtain an API key from the [console](https://console.typesafe.ai/) and call `/v1/systemone`. This documents an available signup path; it does not establish that this user's signed-in account can issue a key. The current RISE integration is already built for this API. A real provider response remains unverified.

## OpenRouter

The [structured-output API](https://openrouter.ai/docs/guides/features/structured-outputs) supports JSON Schema on compatible models. A selected model could return the same `continue`, `slower`, or `pause` choice. OpenRouter still requires a key and model selection. The SDK is a client library, not a decision model; one server-side HTTP call does not need another dependency.

Switching requires updating server response validation, consent and privacy disclosures, and evaluation evidence. Do not manufacture Jev-style confidence from a model's self-reported number. Keep the reading decision boundary mandatory and retain failure blocking, timeouts, bounded excerpts, and stale-response protection.

## Laya

[Laya's model card](https://huggingface.co/convaiinnovations/laya) publishes Apache-2.0 weights and a Jev-compatible serving interface. However, it describes its base checkpoint as a model to specialize, not a zero-shot decision engine; its reported typed-decision performance improves after task-specific fine-tuning. Its context and confidence semantics also need evaluation against RISE's actual requests.

Self-hosting would remove the TypeSafe-key dependency, but requires a model-serving deployment plus a small, held-out RISE evaluation before promotion. Similar response shapes do not prove equivalent decisions. Compare quality, latency, interruptions, and serving cost before selecting it.

## First-principles requirement

The useful requirement is a reliable, evaluated decision before reading progression. Requiring a particular vendor is the user's current product choice, not a technical necessity. Preserve that choice until explicitly changed; do not hide outages with an unapproved alternative model.
