# RISE: approved personal-reading design

Mission: **Bring a thought. Make a short original reading that gives it a form worth keeping.**

This document replaces the earlier Jev-authorship proposal. The user approved implementation on September 27, 2026. Jev does not write prose and is not required in the first pilot. Deployment and pilot activation remain separate from local implementation.

## The complete experience

Create → read → optionally revise → keep → return. One thought (up to 500 characters), one optional concrete detail (500), one hosted writer call. Produce a title and 2–5 paragraphs, targeting 120–180 words and accepting 80–220. Allow imaginative imagery, never unsupported personal facts or diagnoses. Display “An original piece inspired by your thought. Details may be imagined.”

Show the entire text immediately, plus explicit Start, Keep, Copy, revision, and text/JSON export. No autoplay. Paced reading uses 160 WPM, flat sentence pacing, neutral presentation, actual compiled duration, and sound off. Full text must survive media failure. Optional soft rain requires acoustic acceptance before activation.

A revision is a new immutable project with a parent relationship. Keep is available before playback. Vault replays, revises, deletes, and exports personal pieces. No new database, accounts, social feed, public sharing, narration, generated imagery/video, retrieval, or source quotations.

## System boundaries

- POST `/api/personal-piece` is separate from Jev endpoints. Same-origin JSON; 16 KiB body; creation or revision; exact request/output fields; 30-second overall server deadline and 35-second client deadline. No automatic retries, repairs, or provider fallback.
- Pilot writer: `qwen/qwen3.5-9b`, exact OpenRouter endpoint `darkbloom/fp4`, reasoning disabled, 700-token output cap. Generation remains disabled until exact-provider parameter, metering, and conservative cost bounds are verified.
- The model supplies title and paragraph strings only. Code assigns project identity, revision relationship, generated provenance, presentation, and all executable settings. Render text safely.
- Reuse `rise.workshop-project.v1`, existing compiler, `MemoryCore.saveWorkshopBlueprintAsync`, and Vault. Single embedded text source; no assets, narration, remote sources, or model-authored experience program. Preserve immutable personal IDs across all save paths.
- Dedicated import accepts at most 64 KiB. Validate before permissive normalization, rebuild executable settings, and reject unsafe authority fields. Same ID and same canonical content is idempotent; different content refuses. Unknown presentation versions preserve text with neutral playback and a notice. Imported provenance is declared, not authenticated.
- Start operation ownership before any asynchronous preparation. Navigation, cancellation, and replacement invalidate it; ignored aborts cannot publish stale results. Remove raw session and router-payload logging.

## Privacy and spending

Explain before submitting that hosted inference receives the thought/detail or parent text/revision instruction. Local storage is private to the browser, not local inference. Do not save original inputs in project metadata or exports. Generated prose can itself contain sensitive details.

Atomic Redis reservation precedes provider invocation: two attempts per IP per minute, ten per IP per day, 1,000 globally per UTC day. Daily pseudonymous IP keys; no user content in Redis. Never refund failed or ambiguous attempts. Global request-ID tombstones prevent duplicate dispatch; lost responses cannot be recovered from a server content store. Tombstones have a storage-growth cost and cannot be deleted without revisiting replay guarantees.

A modeled $5/day provider ceiling requires a verified maximum $0.005 per attempt, including all prompt, schema, chat-template, completion, reasoning, and request charges. Advertised rates and mocked tests do not prove this. Fail closed when disabled or quota enforcement fails. Log only status, latency, model, and numerical usage metadata.

## Evidence gates

1. Writer: forty fixed prompts; owner accepts at least 32 without substantive rewriting; zero observed fabricated personal facts or direct instruction violations.
2. Discovery: six participants; at least four keep a piece after at most one revision and identify a valued line or turn.
3. Return: at least two voluntary reopenings or new creations within seven days.
4. If writing fails, one focused revision and a fresh cohort; pause expansion if the second cohort fails.
5. Presentation: identical prose, varied order; at least four of six prefer the treatment and explain its contribution.
6. Jev: only after meaningful treatments exist, compare a single bounded Choice against neutral and writer-selected treatments using identical prose and concealed labels. Inconclusive evidence keeps Jev out of the required path.

These are discovery rules, not statistical evidence of demand. No participant outcomes or writing-quality results have been claimed.

## Review boundary

Source baseline: `SyberLabs/RISE@5e26c0b24e3c6860d2317ecf2f4588bbdc441192`. This is not a verified live deployment SHA. Review the implementation branch and its actual test evidence, provider activation gates, persistence/import authority, cancellation, media independence, and privacy. See the accompanying Opus review prompt and implementation report when complete.
