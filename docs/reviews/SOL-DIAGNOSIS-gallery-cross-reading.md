# SOL diagnosis — Gallery fails on the SECOND (and later) readings

**For SOL to fix. Investigation only on my side — no code changed.**

## Symptom (reader)

The Gallery (Continuous Field) is intermittent across readings:
- Numbers + Old Masters — **worked** (first reading of the session).
- Refresh, then Upanishads + knights — **did not work at all** (no imagery
  behind the text).
- Other free/non-pericope readings similarly fail on second+ launches.

Matthew's pericope path works because it drives its own cue-based category
rotation; the free/sourced path does not, which is why this surfaces there.

## The decisive evidence (from the reader's live console log)

The whole session log contains **exactly one** line:

```
[Visual Cortex] Category change detected, rotating asset generation.
```

…and it fires during **Run 1 (Numbers)** only. For **Run 2 (Upanishads +
knights)** the log shows:

- `[Chamber] Continuous Field (Gallery) host mounted`  ✓ (the host IS mounted)
- `[Visual Cortex] Config updated: Object`             ✓ (updateConfig ran)
- **NO** `Category change detected` for run 2.

So run 2: the field host mounts and the field runs, but the cortex **never
rotates its asset generation to the new reading's categories**. The field reads
`_activePoolCategories()` → the previous reading's stale set (or empty) → its
pool never matches the Upanishads/knights reading → nothing shows.

This is NOT the host-mount path (that works) and NOT the field presenter (it
runs). It is the **cortex category rotation being skipped on an
interlocution → interlocution transition.**

## Root cause — an asymmetry in session-identity reset

`app.js` installs an authoritative cortex identity per reading, but **only for
non-Rhythmic modes**:

```js
// app.js ~442
if (visualMode !== 'interlocution') {
    visualCortex.resetSessionVisualIdentity();   // forces activeTypes: [] etc.
}
if (visualMode === 'interlocution') {
    // build activeTypes from the selection, then updateConfig({ activeTypes, ... })
}
```

`resetSessionVisualIdentity()` (visual-cortex.js ~397) drives an authoritative
`activeTypes: []` (among other clears). That reset is exactly what guarantees
the *next* reading registers as a change. **A Gallery reading is
`visualMode === 'interlocution'`, so it skips the reset** and relies entirely on
`updateConfig`'s old-vs-new category diff:

```js
// visual-cortex.js ~627
const oldExternal = this._poolCategoriesForTypes(this.config.activeTypes || []);
const newExternal = this._poolCategoriesForTypes(nextConfig.activeTypes);
const changed = oldExternal.length !== newExternal.length
             || !oldExternal.every(t => newExternal.includes(t));
if (changed) { rotate(); }
```

For the diff to miss when the two readings genuinely differ (oldmasters vs
knights), run 2's `nextConfig.activeTypes` must have arrived **equal to the
stale set or empty** — i.e. the new reading's `sourced` did not flatten into a
fresh `activeTypes`, so `updateConfig` saw "no change" and skipped the rotate.
Either way, the fix is the same: **an interlocution → interlocution transition
must not depend on the diff against a previous reading's leaked state.**

## Why it looked flaky ("worked once, then never")

- Run 1 is always against a fresh cortex (activeTypes empty) → any real
  selection is a change → rotate → works.
- Run 2+ inherits Run 1's `activeTypes` in `this.config` because the
  interlocution path skips `resetSessionVisualIdentity`. If the new selection
  collides with, or fails to supersede, that stale set, no rotation fires and
  the pool never matches the new reading. Order- and content-dependent, hence
  "intermittent."

## Suggested fix direction (SOL to decide)

Make the identity reset **unconditional per reading**, not gated on mode:

- Call `visualCortex.resetSessionVisualIdentity()` for **every** new reading
  (including `interlocution`), BEFORE building and applying the new
  `activeTypes`. That authoritative `activeTypes: []` guarantees the subsequent
  real selection always registers as a category change → rotate → pool warms →
  the Gallery (and the flash economy) see the correct pool.
- Equivalent alternative: in `updateConfig`, when a NEW session's config is
  installed, force a rotation rather than trusting the diff (but the explicit
  per-reading reset is cleaner and matches the pattern SOL already established
  for non-Rhythmic modes).

Guard rails:
- Preserve the retained-pool contract for a *return* to the SAME reading (a
  legitimate warm-pool reuse) — the reset is per NEW reading, not per view
  entry. Verify Matthew's pericope path still rotates correctly (it drives its
  own cue rotation; the reset must not fight it).
- After the fix, the log for reading N (N>1) must show a fresh
  `Category change detected` whenever the new reading's categories differ from
  the prior one — that is the observable success signal.

## Confirmed NOT the cause (already ruled out here)

- The field presenter and the host-mount path: both fire correctly on run 2
  (`Continuous Field (Gallery) host mounted` is present).
- `normalizeVisualSelection` dropping `sourced`: `inferVisualSourceFamily`
  derives `collections` from a sourced-only selection, so a clean
  landscapes/knights selection preserves `sourced`. (Re-verify in the context
  of the leaked prior state, though — the collision may be there.)
- Category machinery for `dore:*` / `aic-*` / wikimedia: all resolve fine in
  isolation (first-reading launches of each worked in probes).
