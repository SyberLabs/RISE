# OpenRouter reading decision service

`POST /api/jev-decision` is the existing same-origin server boundary. It accepts bounded intent, feedback, excerpt, request ID, reading/devotional mode, and pace. The server calls OpenRouter's `https://openrouter.ai/api/alpha/decisions` with `typesafe/jev-1.13`, the reading context as `state`, and one typed `reading_action` Choice question.

Jev chooses `continue`, `slower`, or `pause`. RISE validates the returned Choice, provider, and model before returning `{ requestId, action, model }`. It does not manufacture or forward confidence. Invalid or unavailable decisions block reading progression.

## Configuration

Set `OPENROUTER_API_KEY` in the Netlify site's environment-variable settings with both Builds and Functions scopes, including deploy previews. Get a key from [OpenRouter](https://openrouter.ai/settings/keys). Production builds stop before publishing when the key is missing or blank. This configuration check verifies presence only, not provider access or the Functions scope; configure both scopes and verify a real preview response before activating production. Redeploy after setting it. Never put the key in browser variables, source control, or PR comments.

The reading function fixes the model to `typesafe/jev-1.13` for this preview test. A stale `OPENROUTER_MODEL` setting cannot silently switch it back to the earlier chat model. Live RISE decision quality remains to be measured.

This request goes through OpenRouter to TypeSafe. The function does not deliberately store the request or response. This does not establish zero retention by Netlify, OpenRouter, or TypeSafe; review their policies before sending sensitive texts. No second model or local decision is substituted if Jev fails.

The upstream timeout is eight seconds; the client times out after ten seconds.

## Boundary controls

Same-origin JSON POSTs only; 32 KiB complete-body limit; intent and feedback at most 500 characters each; excerpt at most 2,000; request ID at most 100; pace 100–500. Netlify is configured for 30 requests per IP per 60 seconds. Responses are no-store. Provider response bodies and credentials are not returned in errors, and RISE's function does not deliberately log request contents.

Missing credentials return `503 DECISION_NOT_CONFIGURED`. Provider errors, timeout, malformed JSON, invalid actions, and incomplete outputs produce safe errors. Local tests simulate provider responses; only an authenticated preview call establishes a live integration.

## References

- [Jev on OpenRouter](https://openrouter.ai/docs/guides/community/jev)
- [Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request)
- [Current implementation evidence](README.md)
