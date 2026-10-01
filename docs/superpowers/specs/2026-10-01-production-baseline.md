# Production baseline and existing slices

Approved scope: production implementation of the baseline and existing visual-control/catalog slices, following the reader-controlled runtime direction approved in this conversation.

RISE owns playback and admission. Preserve the existing Player, clock, Dive/Surface lifecycle, closed visual capabilities, reader-owned inference, reduced-motion behavior, and explicit refusal paths. No new provider, microphone spending, scenes, telemetry, public SDK contract, or Portal promotion is part of this release.

Integrate PR364 (bounded Attractor control) and PR365 (visual catalog and admitted samples). First reproduce main's browser failures against their combined head; fix only remaining root causes. The recipient-remix helper must wait for the real initial Portal surface rather than a heading available only in the demonstration view. Preserve exported reader-selected pace and child lineage; do not change the expected pace to hide a persistence bug.

Close existing review defects before release: visual form submission must not navigate; visual outcome feedback must belong to the active run/segment; catalog conflicts must use the resolved provider, preserving unknown-provider mock fallback. Known real providers and embed/eval modes continue to refuse offline catalog samples.

Preserve the existing phone contracts: at 390 by 844 the normal controls bar stays below one third of the screen, and below half the screen even with the longest microphone message and disclosure open. Touch targets remain at least 44 px, all controls remain operable, and the page does not scroll horizontally. Bound and scroll the panel rather than hiding functionality or weakening the tests.

Acceptance: focused authored/remix browser tests, browser gate, full unit suite, required CI and production build pass. Merge through required CI in dependency order; verify the exact deployed release and live sample/control behavior without spending inference. Full main validation must establish the integrated baseline. Any remaining environmental or product failure must be reported explicitly.
