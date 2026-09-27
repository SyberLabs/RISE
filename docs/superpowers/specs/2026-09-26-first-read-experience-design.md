# First-read experience design

## Reader outcome

A new visitor can enter a real audiovisual reading from the Portal with one action, encounter legible text quickly, and choose how to continue after thirty seconds of reading. The experiment is successful only if observed readers reach their first legible word faster without losing thirty-second retention. No measured tenfold improvement is claimed in advance.

## Entry and reading

- The Portal leads with one clearly labelled **Experience 30 seconds** button and identifies the fixed reading as *Meditations* by Marcus Aurelius. The Jev request, Try RISE corridor, and other rooms remain reachable.
- The button calls the existing `launchKeystone('meditations')` admission path. It does not compile text, call a model, or bypass release checks. If admission fails, the existing refusal toast appears and the reader stays on the Portal.
- The launched session carries one ephemeral `firstReadPreview` marker. The source, title, text, visual program, safety controls, and `/keystone/meditations` URL remain the normal Keystone's.
- Exiting this reading returns to Try RISE, where the reader can choose another admitted work; Back returns to the Portal. No automatic next book is inferred.

## Thirty-second choice

- After 30,000 milliseconds of **active reading elapsed time** reported by the existing Player, the Chamber shows a small, nonblocking, one-time choice: **Continue in Stream**, **Read as Page**, or **Pause**. Reading continues unless the reader chooses Pause or Page.
- Continue dismisses the choice. Page calls the existing Page projection and pauses Stream by its existing rules. Pause uses the existing transport. The regular Chamber controls remain available throughout.
- The choice never appears on normal Keystone launches, after session completion, or after the reader has already opened Page. It is removed when the Chamber exits or is destroyed. It does not store or transmit reading behavior.

## Boundaries

- `src/components/Portal.js` owns the visible entry button; `src/app/route-manifest.js` passes the launch operation; `src/app.js` invokes the existing Keystone path and attaches the ephemeral marker; `src/components/Chamber.js` owns the one-time reading choice.
- PostgreSQL, Redis, and Jev already serve the separate optional recommendation path. This first-read action requires no provider response. Kafka has no reader-facing event to process and is excluded.
- No new dependency, persistent user record, analytics service, or editorial text is added.

## Verification

- Unit tests cover Portal action wiring and a Chamber milestone that triggers only for marked sessions, once, after 30,000 active milliseconds.
- A browser test covers Portal → admitted Meditations Stream → choice → Page → exit, including URL and navigation behavior on desktop and phone. Existing Jev and Keystone tests continue to pass.
- Five unprompted readers use the old and new paths. Record time from landing to first legible word, thirty-second retention, and whether each can explain Page versus Stream. A tenfold claim requires a prespecified primary measure improving by at least 10× without lower retention.
