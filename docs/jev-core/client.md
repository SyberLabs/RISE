# Reading guide client

The internal `JevGate` and `createJevConductor` names are retained for compatibility; user-facing text describes the reading guide and consent names OpenRouter and the selected model provider.

`requestJevSession(container, { onExit, mode, signal })` opens a top-level consent dialog while the reading route stays hidden. It resolves to a conductor only after explicit checkbox consent; Exit, Escape, or abort resolves to null. Opening or accepting the dialog does not itself send a model request.

`createJevConductor({ intent, mode, pace, fetchImpl })` sends same-origin JSON to `/api/jev-decision`. It accepts only a matching request ID, one of continue/slower/pause, and a nonempty model name. No probability or confidence field is required or exposed. Requests retain the 2,000-character excerpt and 500-character intent/feedback limits, ten-second timeout, and abort/supersession protection.

`setFeedback` queues feedback for one decision. `setPace` updates subsequent requests. `destroy` cancels work and prevents new decisions. Provider failure rejects the decision; production callers block progression and offer retry or exit. Ordinary playback code retains authority over the effect of slower and pause.

See [current verification](README.md) and the [OpenRouter review](openrouter-review.md). Older Jev test counts do not establish OpenRouter behavior.
