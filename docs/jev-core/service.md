# OpenRouter reading decision handler

`POST /api/jev-decision` is a same-origin server boundary restored for the
Cloudflare launch. The current reading path does not call it. It accepts bounded
intent, feedback, excerpt, request ID, reading/devotional mode, and pace. The
server calls OpenRouter's `https://openrouter.ai/api/alpha/decisions` with the
fixed model `typesafe/jev-1.13`, the reading context as `state`, and one typed
`reading_action` Choice question.

The handler validates the returned Choice, provider, and model before returning
`{ requestId, action, model }`, where action is `continue`, `slower`, or `pause`.
It does not manufacture or forward confidence. Invalid or unavailable decisions
produce a safe error; there is no fallback decision.

## Configuration

The Netlify adapter reads `OPENROUTER_API_KEY` from its server environment. The
Cloudflare Worker will pass its own server-held secret into the shared handler.
Never put the key in browser variables, source control, or logs. A missing key
returns `503 DECISION_NOT_CONFIGURED`. The model is fixed server side; a stale
`OPENROUTER_MODEL` setting cannot override it.

This request goes through OpenRouter to TypeSafe. The handler does not
deliberately store request or response content. This does not establish zero
retention by hosting or provider services; review their policies before sending
sensitive texts. The upstream timeout is eight seconds.

## Boundary controls

Same-origin JSON POSTs only; 32 KiB complete-body limit; intent and feedback
at most 500 characters each; excerpt at most 2,000; request ID at most 100;
pace 100–500. Responses are no-store. Provider response bodies and credentials
are not returned in errors. The Netlify adapter declares a 30-request per-IP
60-second rate limit; the Cloudflare Worker must apply its own binding before
calling this handler.

Local tests simulate provider responses. An authenticated live call is still
required to establish that the integration works on a deployed host.
