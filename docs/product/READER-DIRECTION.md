# Audiovisual Reader direction

Status: Intent. Date: 2026-10-03. Updated: 2026-10-04. Owner of product direction: Seth, with Mateo. Engineering task ownership is claimed separately in the tracker.

## Product job

Make reading feel welcoming, coherent and beautiful while retaining usable text, reader control and reader-owned AI. Improve the website as a product in its own right. The plugin roadmap does not replace this work.

## Current work and next decisions

Main through `2c71cba8` contains Seth's Home reading entrance (#388), Today selection/rotation (#387), build-time recitation machinery (#390), saved-accent CSP repair (#391), Attractor frame-quality adaptation (#392), missing-chunk recovery (#389), Fit-reading transition repair (#385) and Vault hydration repair (#384). New Home first-word loading (#393), Another reading preload (#394) and Home visual polish (#395) are also merged. Ember first-plate baking is sliced rather than blocking (#396). Git establishes merge and authorship; it does not establish witnessed live acceptance. The tracker links these changes individually.

Near-term work is to observe the whole entrance-to-reading journey, judge audiovisual coherence and beauty, verify narration/fallbacks, test reader controls and navigation, and reconcile the historical release ledger against today's exact release. These are acceptance packages, not instructions to implement a speculative redesign. Seth and Mateo choose concrete improvements from those observations.

## Existing obligations

The [release corridor](../RELEASE-ROADMAP-2026-08-20.md) and [human acceptance protocol](../RELEASE-ACCEPTANCE-PROTOCOL.md) govern applicable source certification, acoustic and device evidence. Historical green counts are dated records; the tracker must not treat them as fresh measurements. Until reconciled, current gate status is unknown rather than asserted passed or failed.

The [North Star](../vision/NORTH-STAR.md) records the earlier orientation/doorway philosophy. It is useful historical direction, not evidence that every proposed capability has been built. Page, narration, Workshop and source-curation documents remain accessible in the product library.

## Shared foundation and independence

Reader and plugin work share Experience Program, Session, Player, source-coordinate integrity and governed instruments. Record dependencies for a concrete task, not blanket dependencies between entire product lanes. Reader improvements can proceed while ChatGPT capability research remains unresolved. Plugin release must independently prove host admission, playback and return behavior.
