# Premium Mobile Chamber

**Status:** proposed · not implemented
**Scope:** the mobile shell — Portal first, then the surfaces that inherit its grammar
**Supersedes nothing.** This is additive to `PAGE-MODE-SPEC`, `JOURNEYS-SPEC` and the three-layer law.

---

## 0. Where this came from

A reference composition was generated from the current mobile Portal. It is not a
mockup to copy — parts of it describe a product that does not exist (§6) — but its
**visual grammar** is a clear diagnosis of what the current screen lacks, and that
grammar is what this spec adopts.

The current screen is *correct*. Every element is legible, reachable, and honest.
It is not *premium*, and the gap between those two words is the whole subject here.

---

## 1. The thesis

> **A threshold should feel like an instrument panel at rest, not an empty room with
> labels in it.**

The current Portal is the result of a subtraction pass: after the density work, the
phone got one act and an index of rooms, in one idiom, with no ornament. That fixed
a real problem — four rows of equal weight, nothing telling you what to touch — and
it produced a screen that is *quiet to the point of being uninformative*.

The reference composition makes the opposite bet, and it is the right one for a
threshold: **spend the screen**. Fill it with structure that carries meaning —
a stage for the sigil, a lit primary action, rooms that say what they hold, colour
that means something — rather than leaving 40% of the glass dark to signal calm.

Calm is not emptiness. Calm is **order at density**.

The reading surfaces are exempt. Darkness-first, stillness-as-default and reverent
degradation continue to govern the Chamber, the Page and the Chapel without change.
This spec governs the rooms you pass *through*, not the room you read *in*.

---

## 2. Current weak points

Measured on iPhone 12 (390×844) against the deployed build.

### 2.1 The screen is 40% dead

| band | height | carries |
|---|---|---|
| top of glass → sigil | ~136px | nothing |
| sigil → subtitle | ~140px | the mark and the name |
| CHAMBER tile | 49px | the act |
| rule → room index | ~110px | five words |
| index → footer | ~70px | nothing |

Two voids of ~136px and ~70px, plus a 40px hole between the two index rows. The
composition is centred in a field of black, which reads as *unfinished* rather than
as *restrained* — the difference being that restraint shows you what it withheld.

### 2.2 The sigil has no stage

A 76px circle, unframed, floating. It is the identity of the product and the only
piece of motion on the screen, and it is presented at the scale of a favicon. There
is nothing around it to say it matters.

### 2.3 The primary act looks disabled

`CHAMBER` is a flat slate slab: grey fill, grey border, grey type, no icon, no
direction, no light. It is the single most important control on the screen and it
is styled exactly like the secondary nav tiles it replaced. A first-time reader has
no signal that this is the door in.

Worse: it is a **noun**. It names a place without saying what happens.

### 2.4 The rooms are anonymous

Five underlined words. `VAULT`, `LIBRARY`, `WORKSHOP`, `ATRIUM`, `SOLARIUM`.

Nothing distinguishes a collection from a workspace from a time-room. Nothing says
that the Vault holds published readings, that the Atrium is philosophy and history,
that the Solarium is a *when* rather than a place. A reader who does not already
know the product cannot form a model of it from this screen — and the Latin names,
which are a genuine part of the work's character, become an obstacle rather than an
invitation.

### 2.5 Three tiers of small caps compete

The room index (10px caps), the second index row (10px caps), and the footer
utilities (10px caps) are typographically identical. `ARCHIVE` and `GUIDE` are
utilities; `ATRIUM` and `SOLARIUM` are destinations; they look the same.

### 2.6 The Solarium's clock breaks the optical centre

The hour rides on the same line as the name and outside its underline, so the
`ATRIUM · SOLARIUM` pair centres around the *clock*, not the words. The pair sits
visibly left of the column above it.

### 2.7 There is no colour

The palette already defines `--color-threshold` (violet), `--color-ember` (gold),
`--color-chamber` (blue), `--color-growth`, `--color-rose`. The Portal uses **none**
of them. Everything is `--color-light` through `--color-mist` on `--color-void`.
Hue is the cheapest wayfinding available and the design system has already paid for
it.

### 2.8 The Curia is a rumour

A 13px `▣` at 14% opacity in the bottom-left corner, unlabelled. It is intended to
be discreet. It is currently indistinguishable from a rendering artefact.

### 2.9 Nothing has state

The sigil silently means "resume your last session" (`onQuickAccess`). Nothing says
so. On a fresh visit it goes to the Vault instead, which is why a tap on it once
read as a bug. The screen knows something the reader does not.

---

## 3. The design patterns

### P1 — The staged sigil

The vessel gains a **stage**: two concentric hairline rings and four cardinal marks
at N/E/S/W. A soft radial vignette behind it lifts it off the void.

- Rings: `1px solid rgba(139,127,212,0.14)` and `rgba(139,127,212,0.07)`, at radii
  of ~1.35× and ~1.9× the vessel.
- Cardinal marks: the app's existing glyph vocabulary — `⌐` `◊` `□` `✛` — at 9px,
  `--color-ember` at 45%, sitting *on* the inner ring.
- The vessel itself grows from 76px to **96px**. It is the identity; it can afford
  the room the dead band above it was wasting.
- **Static.** The rings do not rotate. The vessel's own loop is the only motion on
  the Portal, and it must stay the only one.

*Why:* an instrument at rest still shows its dial. This is the difference between a
logo and a mark that means something is running.

### P2 — The act is lit, and it is a verb

`CHAMBER` → **`ENTER CHAMBER`**, with a leading `✦` and a trailing `→`.

- Fill: `linear-gradient(180deg, rgba(139,127,212,0.16), rgba(139,127,212,0.06))`
- Border: `1px solid rgba(139,127,212,0.42)`
- Glow: `0 0 28px rgba(139,127,212,0.14)`, plus `inset 0 1px 0 rgba(255,255,255,0.06)`
- Type: `--font-display`, 14px, `0.22em`, `--color-light`
- Height: 56px (up from 49) — a primary action may be the tallest thing on the screen.
- Pressed: the glow contracts rather than the tile dropping. A threshold does not bounce.

*Why:* exactly one object on the screen should be self-evidently the way in. It
should be the only one carrying light, and it should say what it does.

### P3 — The jewelled seam

The hairline between the act and the rooms is interrupted at its centre by a small
`◊` in `--color-threshold` at 50%, with 10px of void either side of it.

*Why:* a bare 1px rule is a division. A rule with a mark on it is a *seam* — it says
the two halves belong to one object. This is the cheapest single gesture in the
reference composition and it does the most work.

### P4 — Rooms are cards that introduce themselves

Each of the five rooms becomes a bordered panel carrying **four** things:

```
┌─────────────────┐
│       ◊         │   glyph, 20px, in the room's hue
│                 │
│     VAULT       │   name, 11px display caps, --color-light
│                 │
│  Journeys and   │   line, 10px, --color-fog, max 2 lines
│  sequences you  │
│  can begin.     │
│            (→)  │   affordance, 22px ring, hue at 40%
└─────────────────┘
```

- Surface: `rgba(18,18,20,0.55)`, border `1px solid rgba(42,42,48,0.9)`
- Radius: `2px` — the design system's `--radius-sm`. **Not** the reference's soft
  cards; sharp corners are a stated principle of this product ("sharp corners =
  intention") and must survive the restyle.
- Layout: 3-up for the collections (Vault · Library · Workshop), then 2-up wider
  for the rooms (Atrium · Solarium). The reference's asymmetry is correct — it
  encodes that these are two *kinds* of place, which §2.4 says the current screen
  fails to communicate.

The descriptive lines, which must be written to the product and not to the mockup:

| room | line |
|---|---|
| Vault | Journeys and sequence archetypes to begin. |
| Library | The Archive: public-domain works, by resonance. |
| Workshop | Compose a reading of your own. |
| Atrium | Philosophy and history. |
| Solarium | *(the hour, then the window's name — see P6)* |

### P5 — Hue as wayfinding

| room | hue | token |
|---|---|---|
| Vault | violet | `--color-threshold` |
| Library | violet, quieter | `--color-threshold` @ 60% |
| Workshop | gold | `--color-ember` |
| Atrium | blue | `--color-chamber` |
| Solarium | gold | `--color-ember` |
| Chapel lamp | unchanged | its own light |

Hue appears **only** in the glyph and the affordance ring. Never in the name, never
in the border, never as a fill. The screen stays monochrome at a glance and reveals
its colour on inspection — which is the register this product works in.

*Constraint:* the Chapel's `✛` and the Curia's `▣` are exempt from this system.
Sacred and governance entrances are not rooms in the index.

### P6 — State, where state exists

The Solarium card carries the hour **and the window's name** (`7:04 AM` / `Dawn`),
because it already computes both and a bare clock is a widget while a named window
is a *state*.

Above the footer, a **Continue strip** appears **only when a last session exists**:

```
  ↺   CONTINUE          The Iliad · Book I          →
      12 minutes in
```

This is what the sigil silently does today (§2.9). Making it visible removes the
one genuinely confusing interaction on the screen and gives the Portal the sense of
a system that remembers you — which the reference composition achieves with a
fabricated status bar (§6.1).

When there is no last session the strip is **absent**, not empty. Reverent
degradation applies to chrome as much as to imagery.

### P7 — Utilities recede

`ARCHIVE`, `GUIDE`, `⚙` drop to 9px, `--color-mist`, letter-spacing `0.14em`, and
lose their icons except the gear. They are a colophon, not a row of destinations.

The Curia's `▣` rises from 14% to **22%** opacity and gains a `title`, which costs
nothing and stops it reading as damage.

---

## 4. Composition

Target: the screen is **full**, with no band over ~40px carrying nothing.

```
  ┌──────────────────────────────────┐  ← sl-header (unchanged, 38px)
  │                                  │
  │            ◌  stage              │  P1     ~150px
  │           R.I.S.E.               │          ~70px
  │   Recursive Installation of…     │
  │                                  │
  │  ┌────────────────────────────┐  │
  │  │  ✦   ENTER CHAMBER      →  │  │  P2      56px
  │  └────────────────────────────┘  │
  │                                  │
  │  ──────────────  ◊  ───────────  │  P3      ~24px
  │                                  │
  │  ┌──────┐ ┌──────┐ ┌──────┐     │
  │  │ ◊    │ │ □    │ │ +    │     │  P4     ~112px
  │  │VAULT │ │LIBR. │ │WORK. │     │
  │  └──────┘ └──────┘ └──────┘     │
  │  ┌───────────────┐ ┌──────────┐ │
  │  │ ATRIUM     →  │ │SOLARIUM →│ │  P4      ~72px
  │  └───────────────┘ └──────────┘ │
  │                                  │
  │  ↺ CONTINUE  The Iliad…      →  │  P6      ~44px (conditional)
  │                                  │
  │  ◊ ARCHIVE   □ GUIDE        ⚙   │  P7      ~30px
  └──────────────────────────────────┘
```

Budget at 844px: 38 + 150 + 70 + 56 + 24 + 112 + 72 + 44 + 30 = **596px**, leaving
~248px for the gaps — roughly 28px between bands, which is the `--space-xl` the
density step already defines at this width. It fits with air, without a void.

**The Portal remains one viewport and does not scroll.** The existing e2e guarantee
(`the Portal is one viewport, and does not scroll`) is not relaxed by this spec; if
the composition cannot fit, the *cards* lose their description lines before the
screen gains a scrollbar.

---

## 5. Where the grammar propagates

The Portal is first because it is the screen that sets expectations. The same four
patterns then answer open weaknesses elsewhere:

| surface | pattern | what it fixes |
|---|---|---|
| **Vault** | P4 cards, P5 hue | archetype rows are currently a 43px icon and two lines of text with no affordance |
| **Library** | P5 hue on tradition chips | four identical serif chips; hue would separate canon from subject |
| **Orbital** | P2 on Begin Session | the same "primary act is unlit" problem — Begin is a 156×40 outline |
| **Journeys** | P4, P6 | journey cards already carry thesis + credits; they want the affordance ring and a duration state |
| **Chamber (reading)** | **none — exempt** | the reading surface is governed by darkness-first and stays as built |
| **Page Mode** | **none — exempt** | a page is a page |

---

## 6. What is deliberately NOT adopted

The reference composition invents product surface. Adopting it would make the
interface claim things that are not true, which is a harder failure to undo than an
ugly screen.

### 6.1 The system-status strip

> `SYSTEM STATUS — All systems nominal ●` / `SYNC — Synced just now ✓`

**Rejected.** R.I.S.E. has no sync, no server-side state, and no account. A green
tick reporting a successful sync would be a fabricated reassurance about data that
never left the device. P6 replaces this band with the one true piece of state the
Portal has: a last session.

### 6.2 The five-item bottom tab bar with PROFILE

**Rejected.** There is no profile and no account. Beyond that, a persistent tab bar
is app chrome, and the Portal's whole premise is that *the interface is the first
session* — a threshold with a nav bar bolted to it is a dashboard. The raised centre
action also duplicates `ENTER CHAMBER` fifteen hundred pixels below it.

### 6.3 The Atrium's caption

> `Community, signals, and transmissions.`

**Wrong, as you noted.** The Atrium is philosophy and history. Every descriptive
line in P4 must be written from the product, not from the picture.

### 6.4 Soft-cornered, heavily rounded cards

**Adapted, not adopted.** The reference uses ~12px radii throughout. The design
system states sharp corners as intention and defines `--radius-sm: 2px`. The cards
take the border and the surface; they do not take the roundness.

### 6.5 The gold "+" badge beside the version chip

**Rejected.** It reads as an upgrade or add-account affordance. The Chapel's lamp is
already the only thing in that corner, and its discretion is the point.

---

## 7. Constraints this spec inherits

Non-negotiable, restated so an implementer does not have to go looking:

- **CSP `script-src` stays `'self'`.** No CDN, no icon font, no external asset. Every
  glyph above is either a Unicode character already in use or an inline SVG.
- **Curation only.** No decorative imagery is introduced anywhere by this spec. The
  cards carry glyphs and type; they do not carry pictures.
- **Procedural forms never depict the face of Christ**, and fixed liturgical forms
  have no probabilistic behaviour. The Chapel entrance is untouched here.
- **The density step is the source of truth for spacing.** All values above resolve
  through `--space-*` at ≤640; none are hard pixels except where a geometric
  constant is meant (the stage radii, the 56px action).
- **`aic-*` category ids remain untouched.**

---

## 8. Order of work

1. **P2** — the lit act. One rule, largest single gain, zero structural risk.
2. **P3** — the jewelled seam. One pseudo-element.
3. **P1** — the staged sigil. Self-contained; verify it does not reintroduce motion.
4. **P4 + P5** — rooms as cards with hue. The real work; also the change most likely
   to threaten the one-viewport guarantee, so it lands with that test watched.
5. **P6** — state. Needs `MemoryCore` for the last session; behind an existence check.
6. **P7** — utilities recede. Cleanup.

Each step ships behind the existing mobile e2e suite, and steps 4–6 need a new
assertion that the Portal still fits one viewport with the Continue strip present —
its widest state, which is the one that will break first.
