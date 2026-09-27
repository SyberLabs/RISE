# Retired Chamber reading gate

The required per-passage JEV/OpenRouter gate was removed in #181. Chamber
reading presents text locally with playback and pace controls. Rosarium and
Via keep their authored local timing and manual controls. Reading does not
depend on a remote decision service or provider key.

The validated `/api/jev-decision` server handler has been restored for the
planned Cloudflare launch, but the reading path does not call it. Its contract
and configuration are documented in [service.md](service.md). This restoration
does not establish an authenticated model decision or production activation.

The optional Scriptorium **Route with JEV** action remains at `/api/jev/route`.
It sends the typed composition intent and target word count to TypeSafe using
a key supplied for that action, to choose among composition formats. It is an
authoring choice, not a reading gate.

## Jev reading recommendation candidate

The Portal and Library send a reader's short request to `/api/jev-recommend`.
Its versioned JSON chooses an admitted edition and a bounded Chamber plan.
The presentation choices include font face and size, separate `textColor` and
`backgroundColor` selectors, an accent motif, visual style and scene arc, and
an audio bed. The Worker resolves color names to shipped values; the browser
validates the complete plan before opening the reading. Model output cannot
provide CSS or arbitrary media URLs. The reader can change the look and sound
during the session or restore Jev's generated choices. Browser speech input
fills the editable request field and never submits it automatically.
The Chamber Look panel keeps face, text size, text ink, backdrop, visual
strength, sound bed, and listening volume in one place. The size and color
overrides stay local to the reading; volume follows the reader's saved setting.

This describes the candidate source. Live provider quality and public release
acceptance require separate verification.

## Historical verification

The following results describe the prior implementation and are not validation
of this candidate:

- The prior full unit run reported **3,484 passed and 63 skipped**. Its dedicated
  gate browser checks used simulated service responses.
- Netlify deployed the gate code checkpoint `6b9b041`; a real preview request
  returned **503 `DECISION_NOT_CONFIGURED`** with **`Cache-Control: no-store`**.
  This verified the missing-key failure boundary, not a successful model call.
- No authenticated model decision or production activation was verified.
