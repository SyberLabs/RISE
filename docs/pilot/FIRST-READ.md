# First-read entrance pilot

**Status: protocol and local comparison builds prepared; comparable hosted variants and reader observations are not yet available.** This is a five-reader formative check of the first-read entrance, not evidence of a tenfold result. Name one owner, freeze two comparable hosted variants, and record the session dates before inviting anyone. Keep observations in a restricted private ledger, never in this repository.

## Question and frozen comparison

Does **Experience 30 seconds** get a new visitor to the first legible word of *Meditations* faster than the shortest pre-existing public path, without fewer readers staying for thirty seconds?

Use two comparable, version-pinned deployments under the same hosting conditions. The proposed baseline is the last main commit before the new entrance, `4c27f1d`, and the proposed treatment is its merged release, `9c5e693`. Verify that the only material difference for this comparison is the entrance and choice, including the same admitted *Meditations* text and assets. If these variants cannot be served and verified side by side, do not run or claim a comparative timing result. Before each session, record both release commits, device, browser, network, and admitted reading version. Stop the pilot if either deployed version changes during collection. Use the same device and network for both paths within a reader's session.

Local readiness check (2026-09-26): detached builds are pinned to `4c27f1dee4e4ebd6c9876b781db71203d5ffae1d` and `9c5e693e650f5293bf212a11164073034ac189f7`. Their source content and public trees are identical, including the admitted *Meditations* edition. The built `audio/` (884 files), `fonts/` (13), `programs/` (1), `sequences/` (5), `engine-stills/` (4), and `chapel/` (9) files have matching SHA-256 hashes. Of 89 built `content/` files, 88 match byte for byte; `content/manifest.json` differs only in its generated timestamp, with the same revision and works. Both local routes opened readable *Meditations* text in smoke checks. This establishes local build comparability only; the required side-by-side hosted check and human observations remain open.

- **Existing path:** Portal → Try RISE → Meditations → first legible reading word.
- **New path:** Portal → Experience 30 seconds → first legible reading word.

Start each trial from a freshly loaded Portal with no previous session. The baseline variant must not expose the new entrance. Give both trials the same instruction: “Open *Meditations* and begin reading.” Do not point to a control or explain the route. Alternate order before observing results: readers 1, 3, and 5 use the existing path first; readers 2 and 4 use the new path first. A reader cannot be new twice; report that learning limitation.

## Consent and observation

Invite five first-time readers privately. Before recording anything, explain: “I am comparing two ways into the same reading. With your permission, I will write down a participant code, route order, time to the first readable word, whether you are still reading after thirty seconds, and your answers about the experience. I will not record your screen or collect your name in the results. You can stop, skip a question, or ask me to erase your record.” Record consent or do not run the trial.

For each route, ask the reader to say the first readable passage word aloud. Use a stopwatch from the facilitator's “begin” after the Portal has painted to that spoken signal. Do not count a title, loading label, or browser chrome. At **60 seconds**, mark a timeout if no passage word is spoken; retain that failure in the results. Do not guide a stuck reader before the timeout. Record errors, refusals, or assistance explicitly rather than silently excluding them.

Thirty seconds **after the first readable word**, note whether the reader is voluntarily still in Stream or Page. A pause, exit, loading screen, or prompted return is not retained reading. This is a human observation, not the Player's elapsed-time counter. Ask afterward, without teaching first: “What is the difference between Stream and Page?” and “Was this worth your time?” Keep each answer separate for each route. The reader may stop after this check; no full-work completion is inferred.

## Private record and decision

For each participant code, record consent and withdrawal state; release and reading version; device and network; route order; each route's time or 60-second timeout; thirty-second observed reading yes/no; assistance and errors; exact answers to both questions; and observation date. Do not put identity, contact details, or this ledger in Git. Allow each reader to inspect or erase their own record. Report only aggregate counts and nonidentifying issues.

Prespecified primary comparison: **median existing-path time ÷ median new-path time**, counting a timeout as 60 seconds. Keep all ten individual timings or timeout flags in the restricted ledger; report aggregate medians, the ratio, timeout counts, and group outcomes publicly. Call this pilot “10× faster median entry in this five-reader comparison” only if the ratio is at least 10, all five pairs have usable observations or recorded timeouts, and the new path's thirty-second reading count is no lower than the existing path's. A timeout cap can understate true delay; say so. Report the two retention counts, Page/Stream explanations, worth-time answers, failures, and assistance independently even when the ratio passes.

Five invited, repeated readers can reveal friction and defects. They cannot establish a population effect, broad retention, or causal superiority. If the pilot suggests an improvement, test a frozen pair of entrances with separate new-reader groups before making a broad 10× claim. If the ratio fails or retention drops, inspect the recorded friction before adding another model, event bus, or analytics service.
