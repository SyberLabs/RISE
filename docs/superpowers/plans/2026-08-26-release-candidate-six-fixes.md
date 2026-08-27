# RISE Release Candidate: Six-Fix Implementation Spec

**Proposed plan file:** `docs/superpowers/plans/2026-08-26-release-candidate-six-fixes.md`

## Goal

Correct six release-candidate defects discovered during mobile/manual review without reopening RISE for feature expansion.

The tranche contains:

1. Preserve Composed sequences as one reading.
2. Replace the incorrect Ovid Keystone with *Metamorphoses* Book I, Invocation + Creation.
3. Restore a meaningful pre-text gate to Visual Navigator.
4. Make the Attractor Masking specimen accurately represent Chamber behavior.
5. Fix Orbital Chamber mobile header overlap.
6. Finish the interaction design of Living Text and Glass Behind Text.

This is a **correctness, coherence, and release-polish tranche**. No new modes, rooms, audio systems, persistence concepts, or content architectures are introduced.

---

## Architectural constraints

The implementation should preserve the existing distinction between **internal machinery** and **reader-facing semantics**.

A Composed reading may internally contain 16 segments, but it is one reading. A specimen may use a smaller viewport than Chamber, but it must represent the same visual effect. Visual Navigator may contain a fully functional browsing system internally, but it must not expose an impossible workflow before a text exists.

Also:

* Do not introduce a new persistence schema unless a fix proves it necessary.
* Do not hand-edit generated content hashes or release evidence.
* Do not preserve stale Keystone identity after changing the Ovid source span.
* Do not solve mobile overlap merely by making everything smaller.
* Do not duplicate Chamber rendering logic solely for a settings preview.
* Existing Book XIII Ovid material does **not** need to be removed from RISE. It simply ceases to be the Keystone.
* Human release evidence should continue to apply only to the exact content/build it certifies. RISE's release machinery is already designed around exact source identity and human certification.

Each defect should receive a regression test **before** its implementation change.

---

# 1. Preserve Composed sequences as one reading

### Problem

A Composed work such as **Creator Affirmations** currently surfaces its internal sequence structure as reader-facing content metadata:

> Composed · Affirmations · **16 readings**

That violates the content model.

The sixteen constituents are implementation/composition units. The user experiences the work as **one continuous reading**.

### Required behavior

For every item whose top-level content type is `Composed`:

* Library/catalog surfaces treat it as **one reading**.
* Opening it begins the composed experience as one continuous unit.
* Internal pieces remain available to the composition/runtime system.
* Internal pieces must not become independent Library readings merely because the renderer/compiler can enumerate them.
* Navigation between internal components must not behave like exiting one reading and starting another.
* Completion/progress semantics should belong to the parent composition unless an existing internal mechanism explicitly requires segment progress.

For the screenshot case, the card should display:

> `Composed` · `Affirmations` · `1 reading`

If singular reading counts are normally suppressed elsewhere in the Library, suppress the chip instead. What is forbidden is exposing `16 readings`.

### Implementation strategy

First identify where the decomposition occurs:

```bash
rg -n "Creator Affirmations|Composed|readings" src test tests e2e
```

Trace the value from:

```text
composition source
      ↓
content/catalog model
      ↓
card view model
      ↓
Library metadata
```

Do **not** fix this with:

```js
if (title === "Creator Affirmations") count = 1
```

and do not merely change the displayed string while leaving all user-facing counting semantics decomposed.

Introduce or clarify the distinction between something equivalent to:

```js
readingCount       // user-facing semantic units
segmentCount       // internal composed units
```

For a normal collection:

```text
readingCount = number of readings
```

For a Composed reading:

```text
readingCount = 1
segmentCount = internal sequence length
```

The exact property names should follow the existing model rather than adding redundant fields if the distinction already exists.

### Regression tests

Add the smallest unit/integration test at the catalog/view-model layer:

```js
it("treats a composed sequence as one reader-facing reading", () => {
  const item = makeComposedReading({ segments: sixteenSegments })

  expect(getReadingCount(item)).toBe(1)
})
```

Also add a control case:

```js
it("retains the real reading count for ordinary collections", ...)
```

Browser regression:

1. Open Library.
2. Find Creator Affirmations.
3. Assert `Composed`.
4. Assert no `16 readings`.
5. Open it.
6. Assert one composed reading/session is created.
7. Assert its internal sequence still progresses normally.

### Acceptance criteria

* [ ] Creator Affirmations no longer says `16 readings`.
* [ ] Other composed works receive the same semantics automatically.
* [ ] Ordinary multi-reading collections retain their existing counts.
* [ ] Internal sequence playback is unchanged.
* [ ] No migration of existing user data is required.
* [ ] Unit and browser regressions pass.

**Suggested commit:** `fix(library): preserve composed reading identity`

---

# 2. Replace the Ovid Keystone with Book I, Invocation + Creation

### Problem

The current release plan identifies the Ovid Keystone as Book XIII, **“Story of Polyxena and Hecuba.”**

That is not the intended passage.

The intended passage is the **opening of Book I in the Brookes More translation**, beginning with the invocation:

> “My soul is wrought to sing…”

and immediately continuing into the Creation, including the passage describing Nature as Chaos, “uniformly waste.” ([Perseus Digital Library][1])

### Canonical new Keystone

**Ovid — *Metamorphoses*, Book I: Invocation and Creation**

Brookes More translation.

Scope:

```text
BOOK I

INVOCATION
    ↓
CREATION
    ↓
Creation/order of cosmos
    ↓
Creation of living things
    ↓
Creation of man
    ↓
STOP

THE FOUR AGES
    ← excluded
```

In conventional line numbering, this corresponds to approximately **Book I, lines 1–88**: invocation through creation, ending immediately before the Four Ages.

The source confirms the invocation followed immediately by “THE CREATION,” and places “THE FOUR AGES” after the creation of man. ([Perseus Digital Library][1])

### Content requirements

The resulting reading must:

* begin with the invocation;
* include “Immortal Gods … ye have changed yourselves”;
* contain the Chaos / “uniformly waste” passage;
* include the remainder of Creation through the creation of humanity;
* stop before **The Four Ages**;
* retain exact provenance/edition information;
* use the same text pipeline as other release works.

### Implementation strategy

Locate every current Keystone reference:

```bash
rg -n \
  "Polyxena|Hecuba|Book XIII|Metamorphoses|Ovid|keystone" \
  src docs scripts test tests e2e
```

Change the **source/span definition**, not a rendered copy.

Then regenerate every derived artifact that depends upon:

* source revision,
* source hash,
* excerpt boundaries,
* phrase segmentation,
* recitation inventory,
* Keystone manifest,
* Archive release inventory,
* render proof.

If the existing Keystone identifier denotes the **Ovid Keystone slot**, keeping the logical slot identifier may be correct.

If the identifier is content-addressed or encodes Book XIII, generate a new one.

Never preserve Book XIII's source hash/revision while silently substituting Book I.

### Certification consequences

This change should happen **before Ovid certification and acoustic review**.

Current release procedures deliberately tie certification and acoustic acceptance to exact material.

Therefore:

```text
Old Book XIII evidence
        ≠
New Book I evidence
```

Current checked-in human evidence was still empty during the release audit, so this is the ideal point to correct the Keystone before those gates are performed.

### Tests

Add content-contract assertions:

```js
expect(ovidKeystone.book).toBe(1)
expect(normalizedText).toContain("Immortal Gods")
expect(normalizedText).toContain("uniformly waste")
expect(normalizedText).not.toContain("THE FOUR AGES")
```

Prefer structural source/span assertions over relying exclusively on English phrase matching.

Also assert:

* generated Keystone manifest points at Book I;
* no Keystone-specific reference still targets Book XIII;
* all derived content artifacts are fresh;
* Book XIII can remain available as ordinary Ovid content if currently part of the Archive.

### Documentation updates

At minimum inspect/update:

* `docs/RELEASE-ROADMAP-2026-08-20.md`
* `docs/RELEASE-ACCEPTANCE-PROTOCOL.md`
* any Keystone manifest/readme
* generated release inventory
* certification dossier descriptions

### Acceptance criteria

* [ ] Ovid Keystone is Book I, Invocation + Creation.
* [ ] It terminates before Four Ages.
* [ ] Book XIII is no longer identified as the Keystone anywhere.
* [ ] Provenance points to the correct Brookes More source/edition.
* [ ] All dependent manifests/hashes are regenerated.
* [ ] Acoustic/certification preparation now targets the corrected material.
* [ ] Tests lock the intended span.

**Suggested commit:** `fix(content): restore Ovid Book I keystone`

---

# 3. Restore the Visual Navigator pre-text gate

### Problem

Visual Navigator can currently be browsed before a reading has been selected.

The user is allowed to navigate almost the whole flow and encounters the restriction only at the end, where **Bring into room** is disabled without explanation.

That creates an impossible state with no causal explanation.

### Required behavior

When no text exists in the Chamber, Visual Navigator should show a deliberate gate instead of the normal browsing interface.

Recommended state:

> **Pick a text first**
> Choose a reading before bringing visuals into the Chamber.

The wording can be adjusted to existing RISE language, but it must explicitly explain the dependency.

### State model

The gate should derive from existing Chamber state:

```js
const canUseVisualNavigator = Boolean(selectedText)
```

Do not create a second persisted state such as:

```js
visualNavigatorUnlocked = true
```

The reading itself is the source of truth.

State machine:

```text
NO TEXT
   │
   └── Visual Navigator opened
           ↓
      TEXT REQUIRED GATE

TEXT SELECTED
   │
   └── Visual Navigator opened
           ↓
       NORMAL NAVIGATOR
           ↓
      Bring into room
```

And importantly:

```text
Navigator open
    +
text subsequently removed
        ↓
immediately return to gate
```

Any pending artwork selection whose operation depends upon that removed text should be discarded or made inert.

### UX requirements

While gated:

* artwork directories are not interactable;
* preview controls are not interactable;
* `Bring into room` should not appear as an unexplained disabled action;
* inaccessible child controls should not remain in the keyboard tab order;
* Back/Close/navigation out of the panel remains available.

Once a text is selected:

* full existing Visual Navigator appears;
* no intermediate unlock step;
* no stale gate;
* no visual flash from gated → enabled during ordinary hydration.

### Accessibility

Use a real heading/message.

If the state changes while the panel is already open, an appropriate status announcement may be used. Do not make the whole Navigator an aggressive `aria-live` region.

### Tests

Unit/component test:

```text
selectedText = null
→ gated UI
→ browser controls absent/inert
```

Then:

```text
selectedText = validText
→ normal navigator
→ Bring into room available according to existing rules
```

Browser corridor:

1. Start with empty Chamber.
2. Open Visual Navigator.
3. See `Pick a text first`.
4. Verify artwork browsing cannot be entered.
5. Select a text.
6. Reopen Navigator.
7. Browse artwork.
8. Bring artwork into room.
9. Remove text.
10. Verify Navigator returns to gated state.

### Acceptance criteria

* [ ] No unexplained disabled `Bring into room`.
* [ ] Before text selection, dependency is explicit.
* [ ] Gate is derived from actual text state.
* [ ] No inaccessible controls remain tabbable behind the gate.
* [ ] Existing post-selection workflow remains unchanged.

**Suggested commit:** `fix(visual-navigator): gate browsing until text selection`

---

# 4. Repair the Attractor Masking specimen

### Problem

The settings specimen for Attractor Masking is nearly invisible / visually malformed.

More importantly, it does **not accurately represent what the effect looks like in Chamber**.

That makes the specimen false documentation.

### Required behavior

The specimen should be a deterministic miniature of the real effect.

It does not need to reproduce the entire Chamber, but:

> same effect semantics, smaller surface.

### Architecture

First determine whether Chamber and the specimen currently implement masking independently.

Trace both:

```bash
rg -n \
  "Attractor|attractor|masking|mask|specimen|Living Text" \
  src test tests e2e
```

Given the recent extraction of masking/runtime responsibilities, inspect the existing runtime before introducing anything new.

Preferred structure:

```text
             Shared effect contract
              /               \
             /                 \
     Chamber renderer      Settings specimen
```

Not:

```text
Chamber masking implementation

           unrelated to

Approximate specimen implementation
```

Shared material may be:

* effect state/configuration;
* CSS custom properties;
* mask geometry;
* opacity/contrast rules;
* seeded attractor data;
* renderer helper;
* runtime itself, if lifecycle semantics permit it.

Do not force the full Chamber runtime into the specimen if a smaller shared pure primitive is the cleaner boundary.

### Determinism

The specimen must not randomly initialize into a pathological frame.

Use:

```text
fixed specimen text
fixed seed
fixed starting phase
fixed representative intensity
```

The same page reload should produce the same initial explanatory specimen.

Animation can proceed after initialization if that is part of the effect.

### Fidelity requirements

The miniature should share the Chamber's relevant:

* typography assumptions;
* foreground opacity;
* masking curve;
* effect intensity;
* blend/filter behavior;
* attractor geometry;
* background contrast.

Only these should differ:

* physical viewport;
* scale;
* perhaps animation duration if necessary for explanatory clarity.

### Legibility invariant

The default specimen state must have clearly recoverable text.

A user should never infer:

> “Attractor Masking means the word is almost entirely black/invisible.”

Do not fix this by disabling most of the effect. Fix the preview so the *real effect* is visible at explanatory scale.

### Lifecycle

If the specimen runs animation/runtime code:

* stop RAF loops on teardown;
* clear timers;
* disconnect observers;
* release any effect/runtime resources;
* guard against stale generations if the settings panel rapidly mounts/unmounts.

### Tests

Prefer structural/state tests over brittle screenshot snapshots.

Tests should establish:

* specimen and Chamber consume the same core mask configuration/primitive;
* deterministic seed produces deterministic initial effect;
* specimen renders a text target;
* initial visibility is nonzero and within a representative range;
* lifecycle teardown leaves no active timers/runtime generation.

Add a Playwright check that the specimen has nonzero dimensions and its rendered word is present/visible.

### Acceptance criteria

* [ ] Preview visibly resembles the actual Chamber effect.
* [ ] No almost-black/broken initial specimen.
* [ ] Effect logic is shared where architecturally appropriate.
* [ ] Initialization is deterministic.
* [ ] No leaked animation/runtime work after closing settings.
* [ ] Chamber itself is visually unchanged unless correcting a shared defect.

**Suggested commit:** `fix(settings): align attractor specimen with chamber`

---

# 5. Fix Orbital Chamber mobile header collision

### Problem

At iPhone width, the **Library** control occupies the same horizontal region as:

> HOW DO YOU WANT TO READ?

The result is visible collision/occlusion in a primary entry corridor.

### Required responsive hierarchy

Do not make the heading tiny enough to squeeze beside Library.

At compact widths, explicitly give each semantic element space.

Recommended layout:

```text
┌─────────────────────────────────┐
│ ← Portal              ◇ LIBRARY │
│                                 │
│     HOW DO YOU WANT TO READ?    │
│                                 │
│ [Plain] [Imagery] [Contemplate] │
└─────────────────────────────────┘
```

Desktop can retain its existing composition.

### Implementation

Locate the current ownership:

```bash
rg -n \
  "HOW DO YOU WANT TO READ|How do you want to read|LIBRARY|Portal" \
  src
```

At the mobile breakpoint, replace conflicting free/absolute placement with explicit layout areas.

CSS Grid is a good fit:

```css
.compact-header {
  display: grid;
  grid-template-areas:
    "back library"
    "prompt prompt";
  grid-template-columns: minmax(0, 1fr) auto;
}
```

Exact classes should follow existing CSS architecture.

### Mobile requirements

Validate at minimum:

* 320 CSS px
* 375 px
* 390 px
* 430 px

Also account for:

```css
env(safe-area-inset-left)
env(safe-area-inset-right)
```

where appropriate.

Do not regress:

* Portal/back affordance;
* Library touch target;
* mode-selector buttons;
* temporal/audio/visual orbit below;
* desktop composition.

### Automated geometry test

A Playwright regression can explicitly compare bounds:

```js
const prompt = await heading.boundingBox()
const library = await libraryButton.boundingBox()

expect(rectsIntersect(prompt, library)).toBe(false)
```

Also assert:

```text
left >= 0
right <= viewport width
```

for both elements.

Test at representative mobile widths and one desktop width.

### Manual acceptance

Because automated browser CI is not Safari certification, manually inspect the actual iPhone Safari surface before closing this defect.

Portrait is mandatory. Landscape should at least receive a smoke check.

### Acceptance criteria

* [ ] Heading and Library never overlap at supported mobile widths.
* [ ] No horizontal viewport overflow.
* [ ] Portal remains usable.
* [ ] Library maintains an appropriate touch target.
* [ ] Heading keeps its intended typographic character.
* [ ] Desktop layout is unchanged.
* [ ] Verified on physical iPhone Safari.

**Suggested commit:** `fix(chamber): prevent orbital header overlap on mobile`

---

# 6. Finish Living Text and Glass Behind Text controls

### Problem

**Living Text** and **Glass behind the text** currently appear as small checkboxes with little surrounding interaction design.

They communicate boolean state, but not:

* what the setting does;
* what part of the row is interactive;
* why the user might enable it;
* hover/focus/pressed affordance;
* strong touch affordance.

### Required design

Convert each into an intentional settings row while preserving its actual boolean semantics.

Example:

```text
┌──────────────────────────────────────────────┐
│ Living Text                           [ ON ] │
│ Give displayed words subtle motion          │
│ and presence in the Chamber.                │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Glass Behind Text                     [ ON ] │
│ Add a translucent surface behind text       │
│ to preserve contrast against imagery.       │
└──────────────────────────────────────────────┘
```

The descriptions above are **provisional**. Before shipping, compare them against actual behavior. Copy must describe what the code really does.

### Semantic implementation

Prefer retaining a native checkbox under the styled control:

```html
<label class="setting-row">
  <span class="setting-copy">...</span>
  <input type="checkbox">
</label>
```

A visually custom switch is fine, but native checkbox behavior should remain underneath unless the existing component architecture already provides an accessible toggle.

Do not implement a generic `div onclick`.

### Interaction states

Each row requires:

* off;
* on;
* pointer hover;
* active/pressed;
* keyboard `:focus-visible`;
* disabled, if such a state exists;
* clear touch feedback.

The active setting should be perceptible from more than the tiny checkmark.

The **whole row** should activate the control.

Minimum touch target:

> **44 × 44 CSS px**

No explanation may exist only in a hover tooltip because mobile has no hover.

### Event correctness

Be careful with wrapping labels/row click handlers.

This must toggle **once**:

```text
tap row → one toggle
tap actual control → one toggle
keyboard Space → one toggle
```

Avoid:

```text
row onClick
+
checkbox onChange
=
double toggle
```

### Persistence

The styling change must preserve existing setting keys and round-trip behavior.

Do not rename the setting merely because its presentation changed.

Test:

```text
ON
→ leave settings
→ enter Chamber
→ reopen settings
→ still ON
```

and:

```text
reload/restore according to current persistence contract
→ same value
```

### Accessibility

Each control must have:

* programmatic label;
* associated description;
* visible keyboard focus;
* correct checked state;
* no color-only state communication.

If a switch role is already standardized in RISE, use it consistently. Otherwise a styled native checkbox is sufficient.

### Tests

Component/unit:

* row click toggles once;
* input click toggles once;
* keyboard activation toggles once;
* persistence serialization remains unchanged;
* hydration restores the same values.

Browser:

* toggle Living Text and observe actual Chamber change;
* toggle Glass and observe actual Chamber change;
* reopen settings and verify state;
* test keyboard focus order;
* test mobile touch target geometry.

### Acceptance criteria

* [ ] Both controls have explanatory text.
* [ ] Entire rows are intentional interactive targets.
* [ ] Strong on/off states.
* [ ] Pointer, keyboard, and touch affordances.
* [ ] No double-toggle bug.
* [ ] Existing persistence survives unchanged.
* [ ] Copy accurately describes actual behavior.

**Suggested commit:** `fix(settings): finish text appearance controls`

---

# Implementation order

I would execute the tranche in this order:

```text
1. Ovid Keystone
      ↓
   freeze correct release content identity

2. Composed sequence semantics
      ↓
   correct reader-facing content model

3. Visual Navigator gate
      ↓
   eliminate impossible workflow

4. Attractor specimen
      ↓
   restore truthful representation

5. Orbital mobile header
      ↓
   repair mobile entry geometry

6. Living Text / Glass controls
      ↓
   finish local interaction polish
```

Ovid goes first because certification, phrase review, and release evidence should not begin against the wrong Keystone.

Each task should remain an isolated commit. No opportunistic refactors.

---

# Integrated regression pass

After all six commits:

### Automated

Run the targeted tests first, then the complete machine corridor:

```bash
npm run test:run
npm run build
npm run test:e2e
npm run measure:first-load
```

Then run the relevant Archive/release preparation scripts from the current `package.json`, including the release inventory and preparation steps.

Finally:

```bash
npm run release:check
```

A successful six-fix tranche does **not** mean `release:check` must suddenly admit 1.0. RISE's formal checker intentionally includes outstanding human certification, acoustic, real-device, and stranger-testing requirements.

What matters is:

> **No new machine/content-integrity blocker is introduced. Any remaining block is an already-known human release gate.**

### Manual iPhone Safari corridor

Perform one concentrated physical-device pass:

1. Open Library and verify Creator Affirmations is one reading.
2. Open corrected Ovid Keystone and verify the Book I opening and proper ending.
3. Enter Chamber with no text and open Visual Navigator.
4. Verify `Pick a text first`.
5. Select a text and verify Navigator becomes fully functional.
6. Inspect Attractor Masking specimen against the live Chamber effect.
7. Return to Orbital Chamber and verify header layout.
8. Toggle Living Text.
9. Toggle Glass Behind Text.
10. Re-enter settings and verify both persisted.
11. Rotate portrait → landscape → portrait and smoke-check layout.

---

# Definition of Done

The tranche is complete only when:

* [ ] all six defects have regression coverage;
* [ ] Composed works remain one semantic reading;
* [ ] Ovid Keystone is Book I Invocation + Creation, not Book XIII;
* [ ] all generated Ovid-dependent artifacts are fresh;
* [ ] Visual Navigator has no unexplained pre-text dead end;
* [ ] Attractor specimen truthfully represents Chamber;
* [ ] Orbital mobile heading and Library never collide;
* [ ] Living Text and Glass are complete accessible controls;
* [ ] persistence schema has not changed unless explicitly justified;
* [ ] full unit/build/E2E corridor is green;
* [ ] first-load budget remains green;
* [ ] physical iPhone Safari verification passes;
* [ ] documentation contains no stale assertion that Polyxena/Hecuba is the Ovid Keystone;
* [ ] the branch contains no unrelated feature work.

After this merges, **feature freeze resumes**. MANTICE/Strudel exploration stays outside the 1.0 candidate until the remaining certification gates are closed.

[1]: https://atlas.perseus.tufts.edu/library/passage/urn%3Acts%3AlatinLit%3Aphi0959.phi006.perseus-eng3%3A1.1-1.253/?utm_source=chatgpt.com "atlas.perseus.tufts.edu"
