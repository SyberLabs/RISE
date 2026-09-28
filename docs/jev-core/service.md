# Retired: server-side OpenRouter decision handler

`POST /api/jev-decision` was a same-origin server route that called OpenRouter's
Decisions API with a SyberLabs-held key. No reading path called it. It is
retired with every other shared inference route and now answers
`410 SHARED_INFERENCE_RETIRED` without reading any credential
(`worker/retired-inference.mjs`).

Decisions now run on the reader's own connection through the shared browser
contract in `src/core/decision/`. See [USER-OWNED-AI.md](../USER-OWNED-AI.md).
