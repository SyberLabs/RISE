# Production baseline and existing slices

Approved scope: production implementation of the baseline and existing visual-control/catalog slices, following the reader-controlled runtime direction approved in this conversation.

RISE owns playback and admission. Preserve the existing Player, clock, Dive/Surface lifecycle, closed visual capabilities, reader-owned inference, reduced-motion behavior, and explicit refusal paths. No new provider, microphone spending, scenes, telemetry, public SDK contract, or Portal promotion is part of this release.

Integrate PR364 (bounded Attractor control) and PR365 (visual catalog and admitted samples). First reproduce main's browser failures against their combined head; fix only remaining root causes. The recipient-remix helper must wait for the real initial Portal surface rather than a heading available only in the demonstration view. Preserve exported reader-selected pace and child lineage; do not change the expected pace to hide a persistence bug.

When Workshop opens a saved sequence or starts an imported-score variation, its shell may render before the asynchronous Vault lookup completes. During that lookup, show a plain loading status and disable editor, preview, run, and save controls so the prior draft cannot be mistaken for the selected project. Only the newest selection may install data; a failed lookup must unlock the existing editor, and completion after Workshop destruction must not mutate its state. Once ready, keep the existing variation title, reader pace, parent lineage, and proposed-score authority behavior. The authored-example pace journey waits for the loaded variation status before changing its pace to 240, then retains its existing exported-pace assertion.

Close existing review defects before release: visual form submission must not navigate; visual outcome feedback must belong to the active run/segment; catalog conflicts must use the resolved provider, preserving unknown-provider mock fallback. Known real providers and embed/eval modes continue to refuse offline catalog samples.

Preserve the existing phone contracts: at 390 by 844 the normal controls bar stays below one third of the screen, and below half the screen even with the longest microphone message and disclosure open. Touch targets remain at least 44 px, all controls remain operable, and the page does not scroll horizontally. Bound and scroll the panel rather than hiding functionality or weakening the tests.

Acceptance: focused authored/remix browser tests, browser gate, full unit suite, required CI and production build pass. Merge through required CI in dependency order; verify the exact deployed release and live sample/control behavior without spending inference. Full main validation must establish the integrated baseline. Any remaining environmental or product failure must be reported explicitly. Task 6 owns coordinator integration and release verification after Tasks 1–5 are reviewed.

Audio correctness validation also keeps every offline named bed audible and deterministic with a full repeated-render PCM comparison, and keeps every unordered bed pair distinct at the existing sample-difference threshold. These checks are independently bounded per bed and in one pairwise case, so a slow aggregate cannot hide which bed workload exceeds the unchanged default test timeout.
