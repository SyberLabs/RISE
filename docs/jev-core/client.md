# Jev client

Status: implemented on `codex/jev-core`; not deployed.

`requestJevSession(container, { onExit, mode, signal })` opens a top-level
consent dialog so route initialization can remain hidden while the reader
decides. It resolves to a conductor only after the reader checks consent and
continues; Exit, Escape, or abort resolves to `null`. The intent field defaults
to “Read attentively” and accepts at most 500 characters. Consent explains
that only the excerpt passed to a decision (up to 2,000 characters), intent,
and feedback (up to 500 characters) go to TypeSafe. Opening the dialog and
accepting consent do not themselves send a request.

`createJevConductor({ intent, mode, pace, fetchImpl })` creates the same-origin
client. `decide({ excerpt, feedback, signal })` sends one JSON `POST
/api/jev-decision` and accepts only a matching request ID, one of the three
supported actions, a nonempty model name, and confidence from 0 through 1.
Requests are bounded to the shared contract, time out after ten seconds, and
are superseded by later decisions. `destroy()` aborts in-flight work and
prevents new decisions. `setFeedback(value)` validates and queues feedback
for one following decision, then clears it so it is not repeated across
reading positions. `setPace(value)` validates and updates the pace sent with
subsequent decisions, allowing ordinary session code to reflect Jev's slower
recommendation without granting Jev direct playback control.

Jev failure rejects the decision; the caller must block text progression and
offer retry or exit. The client does not select a fallback model or silently
continue. The conductor also does not interpret `slower` or `pause`; ordinary
session code owns those effects.

Focused evidence: `vitest run src/core/jev-conductor.test.js
src/components/JevGate.test.js` passes 19 tests covering consent, bounded
payloads, response validation, abort, timeout, stale requests, and teardown.
