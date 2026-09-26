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

## Historical verification

The following results describe the prior implementation and are not validation
of this candidate:

- The prior full unit run reported **3,484 passed and 63 skipped**. Its dedicated
  gate browser checks used simulated service responses.
- Netlify deployed the gate code checkpoint `6b9b041`; a real preview request
  returned **503 `DECISION_NOT_CONFIGURED`** with **`Cache-Control: no-store`**.
  This verified the missing-key failure boundary, not a successful model call.
- No authenticated model decision or production activation was verified.
