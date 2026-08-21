# Prompt — Workshop capability analysis, and a mobile architecture

Paste this to a model with repository access. It has two halves and they must
be done in order: you cannot design the phone until you can say what the room
is for.

---

You are analysing the **Workshop** of RISE, a browser-based audiovisual
reader. It is the authoring room: a reader assembles sources, scores imagery
and audio against them on a timeline, previews, and saves to the Vault.

```
src/components/Workshop.js              5,414 lines — the room
src/components/Workshop.css             3,701 lines
src/components/workshop/                the extracted panels (thin)
src/core/experience-program.js          rise.experience-program.v1 — the score
src/core/visual-score-lane.js           cues, assets, lanes
src/core/session-compiler.js            score → atoms
src/core/materials.js                   what a reading may carry
src/core/workshop-project.js            the saved shape
docs/specs/WORKSHOP-*.md
```

## Part One — what can this room actually do?

Not a feature list. An inventory of **capabilities a reader can complete**,
each one with the shortest path to it. For every capability record: the entry
point, the steps, what it produces, where it is saved, and what happens when
it fails.

Cover at least: adding sources; choosing an extent; scoring visual cues;
scoring audio beds and swells; uploading media; pace and chunk mode; preview;
saving to the Vault; exporting and importing an Experience Program; the
render/MP4 path.

Then answer three questions plainly:

1. **What is the smallest useful thing a reader can finish here?** Time it in
   steps. If the answer is more than a dozen, that is the finding.
2. **Which capabilities exist but cannot be discovered?** Anything reachable
   only by knowing it is there.
3. **What does the room assume about the screen?** Enumerate every place the
   layout depends on two things being visible at once. This is the bridge to
   Part Two, so be exhaustive and cite lines.

A caution learned here repeatedly: **a runtime filter is not a capability
boundary.** If something is hidden but still built and shipped, say so.

## Part Two — a mobile architecture

Only after Part One. Design against mobile UI and engineering standards, and
against this constraint, which is a decision already taken:

> Workshop is full authoring on desktop and larger displays; **safe and
> usable** on mobile. Mobile Workshop does not have to equal desktop Workshop
> ergonomically. Nothing breaks; projects stay safe; controls stay readable;
> run, save and preview stay reachable; the source browser is navigable; no
> impossible multi-pane expectations.

### The diagnosis to test, not to assume

The desktop layout is a **workbench**: sources, score lanes, asset library,
transport and preview visible together, because authoring is about the
relationships *between* them. A phone shows one thing at a time, so shrinking
the bench destroys the very thing that made it one. If you disagree after
reading the code, say so — but say it with evidence.

### Directions to evaluate

Evaluate each against real standards (touch target sizing, thumb reach,
one-handed use, safe areas, virtual keyboard behaviour, `dvh` versus `vh`,
scroll containment, focus and screen-reader order, reduced motion, and
interruption/restore):

1. **The score as spine, one lane at a time.** The Experience Program is a
   timeline of lanes. Full-width for the focused lane; the others as thin
   collapsed strips showing where their clips sit, swipe to change focus. The
   claim is that strips preserve the relationships a tab bar destroys — test
   that claim.
2. **Transport as home.** Play, scrub and stop are the controls that survive
   a small screen. Opening on the transport matches how the device is held.
3. **Capture and review as the phone's native acts.** Photographing something
   and adding it is possible only here; approving what the Scriptorium
   composed needs no precision. This is an *addition* to the above, not a
   replacement for it — do not propose a phone that cannot touch the score.

### What to reject, and say why

Hiding panels behind a hamburger (it hides exactly the relationships
authoring depends on) and a horizontally-scrolling desktop layout (it turns a
bench into a maze). If you propose either, defeat these objections
explicitly.

### Deliverable for Part Two

- A component and state architecture: what renders, what owns state, what is
  lazily loaded, and where the breakpoint sits.
- The precise list of desktop capabilities you are **not** bringing to the
  phone, each with a one-line justification. An honest subtraction is the
  point of the exercise.
- A migration path from the current 5,414-line component that does not
  require a rewrite to be useful at any step.
- The first slice to build, chosen because it is the piece the whole idea
  rests on — if it feels wrong in the hand, the rest does not matter.
- What could make you wrong, and the cheapest way to find out.

Write no production code. Sketches and interface signatures are welcome.
