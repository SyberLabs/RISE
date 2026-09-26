# OpenRouter reading decision service

`POST /api/jev-decision` is the existing same-origin server boundary. Its internal name is retained; it no longer calls TypeSafe. It accepts bounded intent, feedback, excerpt, request ID, reading/devotional mode, and pace. The server calls `https://openrouter.ai/api/v1/chat/completions` with a system instruction and reader context serialized separately as user data.

The model returns only `{ "action": "continue" | "slower" | "pause" }`. RISE requests strict JSON Schema with additional properties forbidden, then validates the response locally before returning `{ requestId, action, model }`. It does not manufacture or forward confidence. Invalid, refused, truncated, or unavailable decisions block reading progression.

## Configuration

Set `OPENROUTER_API_KEY` in the Netlify site's environment-variable settings with both Builds and Functions scopes, including deploy previews. Get a key from [OpenRouter](https://openrouter.ai/settings/keys). Production builds stop before publishing when the key is missing or blank. This configuration check verifies presence only, not provider access or the Functions scope; configure both scopes and verify a real preview response before activating production. Redeploy after setting it. Never put the key in browser variables, source control, or PR comments.

`OPENROUTER_MODEL` is optional; the default is `openai/gpt-4.1-mini`. This compact non-reasoning model supports structured outputs and avoids allocating a reasoning budget for a three-way choice. Model support was checked in the official catalog on 25 September 2026; live RISE decision quality remains to be measured. A replacement model must support all requested parameters and be checked on RISE's evaluation set.

The request uses `provider.require_parameters: true` and `provider.data_collection: 'deny'`. These require compatible endpoints and exclude provider routes marked as allowing data collection. They are not a promise of zero retention by every processor. No second model, Jev fallback, or local decision is substituted if routing fails.

The output token limit is 32, temperature is 0, and upstream timeout is eight seconds. The client times out after ten seconds. Changes to a reasoning model may require different output-budget settings; don't assume every model is interchangeable.

## Boundary controls

Same-origin JSON POSTs only; 32 KiB complete-body limit; intent and feedback at most 500 characters each; excerpt at most 2,000; request ID at most 100; pace 100–500. Netlify is configured for 30 requests per IP per 60 seconds. Responses are no-store. Provider response bodies and credentials are not returned in errors, and RISE's function does not deliberately log request contents.

Missing credentials return `503 DECISION_NOT_CONFIGURED`. Provider errors, timeout, malformed JSON, invalid actions, and incomplete outputs produce safe errors. Local tests simulate provider responses; only an authenticated preview call establishes a live integration.

## References

- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Default model](https://openrouter.ai/openai/gpt-4.1-mini)
- [Current implementation evidence](README.md)
