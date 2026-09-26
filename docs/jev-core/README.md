# Mandatory Jev conductor

Status: implementation in progress on `codex/jev-core`; not deployed.

## Approved direction

Every reading session requires a live Jev decision before text progression. Jev selects continue, slower, or pause using the reader's stated intent and a bounded excerpt. Existing source order, devotional order, content rights, and accessibility constraints remain ordinary-code invariants. No alternative model or static decision replaces a failed Jev call.

The first implementation conducts the reader's selected source. Automatic discovery and selection of new library passages is subsequent work; do not represent this first slice as semantic library search.

## Implementation plan

- [ ] Luna service: protected Netlify endpoint, bounded validated inputs, TypeSafe structured choices, timeout and unavailable responses, no secret or text logging.
- [ ] Luna client: explicit remote-processing consent, reader intent, strict client response validation, abort and stale-request handling.
- [ ] Luna playback: decisions before Stream and Page passage display, bounded slowing, retry, pause and destruction correctness.
- [ ] Coordinator: root session integration, devotional entry and boundaries, README/privacy updates, deployment configuration and validation.
- [ ] Review: focused failure/bypass tests, production build, browser smoke, real Jev and deployment verification when credentials are available.

## Shared contract

`POST /api/jev-decision` takes `requestId`, `intent`, `feedback`, `excerpt`, `mode` (`reading` or `devotional`), and `pace`. It returns `requestId`, `action` (`continue`, `slower`, or `pause`), `model`, and `confidence`. Intent and feedback are each at most 500 characters; the excerpt is at most 2000. The client never sends a provider key. The server uses `TYPESAFE_API_KEY` and optional `JEV_MODEL`, defaulting to `jev-latest`.

Consent is explicit for every session, including personal text. Excerpts are data, not instructions. Provider failure blocks progression but never prevents exit or access to saved work. A decision is specific to the active reading position; late results must not restart an exited or superseded session.

## Evidence and collaboration

The Luna agents own their source files and write evidence to service.md, client.md, and playback.md. The coordinator owns integration, commits, PR updates, and deployment. Keep credentials out of this repository and comments. Official protocol reference: https://docs.typesafe.ai/api.
