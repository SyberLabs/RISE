# Jev decision service

`POST /api/jev-decision` is the same-origin server boundary for one Jev choice. The browser sends JSON with `intent` (up to 500 characters), `feedback` (500), `excerpt` (2,000), `requestId` (100), `mode` (`reading` or `devotional`), and `pace` (100–500 words per minute). The function sends only those fields needed as TypeSafe `state`, asks one `choice` question, and returns `{ requestId, action, model, confidence }` for a validated `continue`, `slower`, or `pause` decision. The decision criteria consider passage density and unfamiliar or specialized concepts in relation to the stated intent and pace; the instructions forbid rewriting, summarizing, reordering, skipping, or adding to the source passage.

The route accepts same-origin JSON POSTs only, caps the complete request at 32 KiB, times out the upstream request after 8 seconds, and applies Netlify’s function rate limit at 30 requests per IP per 60 seconds. Provider errors, timeouts, malformed answers, and missing credentials return safe errors; there is no local decision fallback. The TypeSafe API key and reader text stay out of logs and client code. The intent, optional feedback, current excerpt, mode, and configured pace are sent to TypeSafe as request state after consent.

## Netlify environment

Set `TYPESAFE_API_KEY` in the Netlify project’s environment-variable settings with the Functions scope. Do not put it in `netlify.toml` or browser configuration. `JEV_MODEL` is optional and defaults to `jev-latest`. Netlify applies environment changes on the next deploy.

No TypeSafe API key is currently available in this workspace, so a live request or deployment check has not been performed. Create an account/key in the [TypeSafe console](https://console.typesafe.ai/login), then set it in Netlify and redeploy. The function does not substitute another provider when this key is missing.

## Verification

Verified locally with:

```powershell
node_modules/.bin/vitest.cmd run src/core/jev-decision.test.js
```

Result: 1 test file, 14 tests passed. The suite mocks TypeSafe and covers the exact request shape and decision criteria, valid decision, model default, origin/content-type/method restrictions, body and field limits, missing key, upstream outage and non-success response, timeout, malformed JSON/answers, secret-safe errors, and rate-limit config. It does not make a live TypeSafe request or exercise Netlify deploy-time rate limiting.

## Contract references

- [TypeSafe API reference](https://api.typesafe.ai/docs) documents bearer authentication, `/v1/systemone`, typed choices, and the response model/answer/usage structure. Its [OpenAPI schema](https://api.typesafe.ai/openapi.json) confirms `SystemOneRequest.state` accepts an object and `SystemOneResponse` requires model, answers, and usage.
- [Netlify Functions quickstart](https://docs.netlify.com/build/functions/get-started/) documents JavaScript `.mjs` handlers and exported function configuration.
- [Netlify function configuration](https://docs.netlify.com/build/functions/api/) documents route, method, and rate-limit config.
- [Netlify rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/) says function rate limits are exported from the function config, not `netlify.toml`.
- [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/) documents runtime scope and redeploy behavior.
