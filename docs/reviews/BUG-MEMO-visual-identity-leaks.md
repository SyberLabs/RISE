# Bug memo — visual-identity leaks and mode-switch residue

Companion to `SOL-PROMPT-gospel-pericope-races.md`. That prompt covers the
intermittent Matthew-27 "stuck on first episode" race. This memo collects the
**deterministic** bugs around launch-scoped visual identity — the pills, the
Chapel-held focal, and the sourced imagery pool — and what is fixed vs. still
open.

Background: several visual settings are **launch-scoped** — they belong to the
specific reading that was launched, not to the tab or the persisted prefs.
The set: the pericope `visualProgram`, the "From this reading" `atriumCollections`
pills, the Chapel-held focal (`focals.type === 'icon'` or `'rose'`), and the
`sourced` selection that drives the cortex's active pool. The recurring bug
class is one of these **outliving the reading that created it** and bleeding
into the next.

The single chokepoint that is supposed to reset them is
`ChamberOrbital._clearLaunchVisualIdentity()`, called at the top of every
`loadText` and on `clearText`.

---

## Bug 3 — Chapel-held focal persists past correctness  ✅ FIXED

**Repro:** Launch a Chapel reading whose focal is a held Icon (e.g. Matthew
17, "✛ The Transfiguration") or a per-book Rosa Mystica → clear the text, or
load a plain library text next → the panel still shows
"✛ The Transfiguration · Held from the Chapel · choose a glyph below to
release it."

**Root cause:** `_clearLaunchVisualIdentity` cleared `visualProgram` and
`atriumCollections` but **not** `focals`. A plain text carries no
`config.visualConfig`, so the `if (config.visualConfig)` branch in `loadText`
never runs and never overwrites `focals` — the Chapel icon/rose is stranded.
Exactly parallel to the 2026-07 Doré pill leak.

**Fix (committed):** `_clearLaunchVisualIdentity` now releases a held focal
(`type === 'icon'` or `'rose'`) back to the standard glyph, on both the
orbital config and the panel config. A real new Chapel launch re-seeds its
own icon via `visualConfig` afterward, so nothing legitimate is lost;
standard glyphs and Personal images are user choices and survive. Four
regression tests in `ChamberOrbital.origin.test.js`.

---

## Bug 1 — Doré imagery persists into a new sequence  ⚠️ OPEN (needs confirm)

**Repro (reader):** Launch Numbers 2 (a Doré-illustrated Chapel reading) →
remove it and switch to a different visual/sequence → the Doré **imagery
itself plays** in the new sequence (not merely the pill).

**Why this is distinct from the pill fix:** The 2026-07 fixes and Bug 3 above
clear the *identity markers* (`atriumCollections`, `focals`, `visualProgram`).
This report says the **actual cortex pool** keeps serving Doré works into the
next reading. That points one layer deeper: the cortex's `_assetPools` /
`activeTypes`, or the `sourced` selection that feeds them, is not being reset
when the launch changes.

**Where to look:**
- Does `_clearLaunchVisualIdentity` (or anything on the load path) reset the
  `interlocution.sourced` array, or only `atriumCollections`? If `sourced`
  still carries `dore:numbers` (or its resolved category) when the next
  reading begins, app.js will hand it to `visualCortex.updateConfig({
  activeTypes })` and the Doré pool warms again.
- The cortex `_assetPools` are **retained across readings by design** (a warm
  pool serves a possible return). Confirm `_rotateAssetGeneration` disposes
  the Doré category when the new reading's `activeTypes` no longer contains
  it — and that the new reading actually *sends* an `activeTypes` that omits
  it. A reading that sets `visualMode: 'off'` or `focals` may not call
  `updateConfig({ activeTypes })` at all, leaving the last pool live.
- Trace the exact "remove it and switch" gesture: is it clear-text then a new
  launch, or an in-panel source removal? The in-panel path may not run
  `_clearLaunchVisualIdentity` at all.

**Suggested first probe:** after the switch, log `visualCortex.config
.activeTypes` and the keys of `_assetPools`. If `activeTypes` is clean but a
Doré pool still shows, it's a stale-pool/disposal bug; if `activeTypes` still
lists the Doré category, it's a `sourced`-reset bug on the launch path.

---

## Bug 4 — Chapel icon → in-chamber switch to Rhythmic → "neither"  ⚠️ OPEN

**Repro (reader):** Chapel reading with an Icon focal → in the Chamber,
change the visual mode to Rhythmic → **neither** takes (the icon marker
lingers and/or Rhythmic does not fully engage).

**Why:** This is the *in-panel mode switch* path, not clear/load. When the
panel switches `visualMode` from `focals` to `interlocution`, the held Icon
focal (launch-scoped) is not released, and the mode change may not fully
reconcile the cortex. `_clearLaunchVisualIdentity` is not on this path — it
only fires on clear-text and load-text.

**Where to look:**
- `VisualInterlocutionPanel` mode-switch handler (`data-visual-mode` click):
  does switching away from `focals` release a *held* icon/rose focal the same
  way clear-text now does? It should, but only for the launch-held kind —
  a user's standard glyph or personal image must survive a round-trip.
- Does the in-chamber visual control push the new mode to the cortex
  atomically, or can the focal init and the interlocution enable both be
  half-applied?

**Suggested fix direction:** factor the "release a launch-held focal" step out
of `_clearLaunchVisualIdentity` into a small helper, and call it from the
panel's mode-switch away from `focals` as well. Keep the user-choice-survives
distinction (standard/personal survive; icon/rose release).

---

## Bug 2 — Matthew 27 intermittent "stuck on first"  → see SOL prompt

Deliberately **not** in this memo's scope — it is a timing/race problem, not a
deterministic identity leak. It has its own document
(`SOL-PROMPT-gospel-pericope-races.md`) with the empirical data already
gathered (atoms are correctly coordinated 27:1→27:66; the compiled program is
correct with 7 ordered episodes; the stick is in runtime advance/pool-warm
timing). Give a fresh reviewer that one.

---

## The common thread (for whoever picks this up)

There are **two chokepoints** and they are not symmetric:

- `_clearLaunchVisualIdentity` handles **clear-text and load-text** and (now)
  resets program + pills + held focal. It does **not** reset `sourced` or the
  cortex pools directly, and it is **not** on the in-panel mode-switch or
  source-removal paths.
- The **cortex** owns `activeTypes` + `_assetPools` and only reconciles when
  something calls `updateConfig`. A launch that changes mode without sending
  a fresh `activeTypes` can leave the previous reading's pool live.

Bugs 1 and 4 both live in that asymmetry. A durable fix is likely: (a) make
`_clearLaunchVisualIdentity` also authoritatively reset `sourced`, and (b)
ensure every launch/mode-switch drives one reconciling `updateConfig` to the
cortex (even an explicit `activeTypes: []`), so no pool is left live by
omission. Confirm against the retained-pool contract (a *return* to the same
reading should still be warm) before changing disposal.
