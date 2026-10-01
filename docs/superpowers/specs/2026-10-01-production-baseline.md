# Production baseline and existing slices

Approved scope: production implementation of the baseline and existing visual-control/catalog slices, following the reader-controlled runtime direction approved in this conversation.

RISE owns playback and admission. Preserve the existing Player, clock, Dive/Surface lifecycle, closed visual capabilities, reader-owned inference, reduced-motion behavior, and explicit refusal paths. No new provider, microphone spending, scenes, telemetry, public SDK contract, or Portal promotion is part of this release.

Integrate PR364 (bounded Attractor control) and PR365 (visual catalog and admitted samples). First reproduce main's browser failures against their combined head; fix only remaining root causes. The recipient-remix helper must wait for the real initial Portal surface rather than a heading available only in the demonstration view. Preserve exported reader-selected pace and child lineage; do not change the expected pace to hide a persistence bug.

Acceptance: focused authored/remix browser tests, browser gate, full unit suite, required CI and production build pass. Merge through required CI in dependency order; verify the exact deployed release and live sample/control behavior without spending inference. Full main validation must establish the integrated baseline. Any remaining environmental or product failure must be reported explicitly.
