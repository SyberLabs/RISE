# The Oracle as RISE's home

**Date:** 2026-09-28 · **Status:** built on branch `oracle-home`

## Why

The Oracle prototype (`/oracle.html`, #272) put two products on one screen:
"tell an AI what you want" and "shake and discover something". Discovery is
the one that is RISE's own. Every AI product now opens on a prompt box; RISE
opens on an object with one physical control.

> RISE becomes a machine you approach, not an application you operate.

```
Oracle          proposes an experience       (Home: ROLL)
Reader Setup    lets the reader alter it     (ADJUST: Visual Navigator, Timing, Sound)
Chamber         performs it                  (ENTER, or Begin)
```

## Decisions (asked and answered)

| Question | Decision |
|---|---|
| What stays around the object | The lockup and one **Menu** holding every room; a footer of Privacy · Terms only; Continue only when there is a session |
| Where ADJUST goes | **Reader Setup, pre-filled**, carrying the rolled look as the reading's opening position |
| What happens on arrival | **The object waits for ROLL**. The reveal belongs to the reader, and the key press is the gesture sound needs |
| How a roll composes | **Tempers**: authored coherent regions of the existing choices, varied inside their bounds |

## The screen

* Waiting: "What will you encounter?", the object, one lit key: **ROLL**.
* Rolling: ROLL, a flick of the object, or a shake of the phone churns the
  fluid; the old words sink (about 0.9 s; under reduced motion a 150 ms fade).
* Result: title, *author · section*, and one plan line rise inside the
  window. Keys: **ENTER** (lit) · **ROLL AGAIN** · **ADJUST**. The status
  line speaks the result to assistive technology and is not shown twice.
* Ask: after a first roll, *or ask for something specific* turns the window
  into a text field; the keys become **ASK** · microphone · **ROLL**. Jev's
  answer lands in the same result state. What RISE cannot do for the request
  (a film, a soundtrack, real places) is said before anything plays.
* The result, rolled or asked, and the ask draft survive navigation and
  reload in the tab (`sessionStorage` `rise-oracle-v1`). A stored result is
  re-admitted on restore; one that fails admission is dropped.
* The fixed demo pages (scene sample, Night Drive) keep their own markup.

## The roll (`src/core/roll.js`)

A roll is **work × section × temper**. Works are the 31 released editions
(15 Standard Ebooks classics, 16 RISE originals); sections are Jev's five.
Each temper is a short list per choice; a roll picks one from each.

| Temper | Unit · pace | Imagery | Sound | Type · colour |
|---|---|---|---|---|
| nocturne | phrases · 150–200 | soft light, harmonic lines, slow | soft rain, aurora, nocturne, starlight | literary/book · classic/amethyst |
| plainsong | sentences · 150–200 | none | silence | book/literary/display, large · classic/jade |
| signal | phrases/words · 250–300 | attractor field | faded signal, night drive, mystery | mono/sans · cobalt/prism |
| ember | words · 200–250 | prismatic / iridescent light | triumph, wonder, excited | display/bold, large/fit · ember |
| garden | phrases · 150–200 | growing line art | piano, lullaby, waltz | literary/book · jade/classic |
| vigil | sentences/phrases · 100–150 | a single quiet figure | haunted, mystery, sad, nocturne | display/literary · amethyst/classic |
| revel | words · 300–400 | fractal light, lively | chase, thrilling, excited | bold/sans, fit/xl · neon night |
| salon | phrases · 200–250 | line art, harmonic lines | jazz, bossa, ragtime, blues | sans/literary · cobalt/classic/ember |

* **One visual and one sound for the whole reading** (`visualArc: single`),
  so a roll survives the hand-off to Reader Setup intact.
* **Roll Again never repeats the previous work or temper.**
* **Honest admission.** A roll is the decision shape Jev returns and passes
  the same `validateJevRecommendation`, under its own name: `model:
  rise/roll-1`, `provider: RISE`. It is composed on the device; nothing is
  sent. (The fixed demo sample, by contrast, calls itself Jev.)
* **The plan line is derived from the plan** (`summarizeJevPlan`):
  *pace unit · imagery · sound · type*, e.g. "slow phrases · soft
  atmospheric light · soft rain · literary serif".
* **Next, deliberately not built:** text-led weighting (a work names the
  tempers that suit it) once the works carry tone tags.

## ADJUST: the hand-off

`App.adjustJevReading(decision)` resolves the decision through the same
released-edition gate as ENTER (`resolveJevReading`) and opens Reader Setup
with `{ text, source, config }`. Reader Setup already carried pace, unit,
reveal, sound bed, visuals and the visual program; it now also carries
`presentation` (face, size, colours):

* loaded with the text, persisted with the text, kept across Reset, cleared
  with the text; never written into preferences;
* passed to Begin untouched; the Chamber holds it as a lens the reader can
  take back key by key (`session-presentation.js`).

Leaving a reading: one entered from Home returns **Home**, where its
proposal still waits; one opened through ADJUST (`origin.adjusted`) returns
to Reader Setup like any other.

## The object (`src/components/oracle/`)

`orb.js` is the prototype's shader, unchanged. `OracleObject` owns only the
object: orientation spring, churn, sink and rise, flick and phone-shake
detection, and the iOS motion permission (asked inside the first ROLL). It
draws only between `start()` and `stop()`, which Portal calls on
`activate()` / `deactivate()`, so nothing renders behind a reading.
Without WebGL2 (or after a lost context) a CSS sphere stands in.

The stage clips its overflow (`overflow: clip`, which keeps the 3D): the
projected words and plate otherwise gave the page a sideways overflow that
focusing the ask field scrolled to.

## Removed

* The request form, example chips, interpretation panel with its Energy /
  Speed / Colours / Sound / Text segments, sigil plate and skeleton, and the
  Atlas atmosphere behind Home.
* The Meditations starter and `launchFirstRead`.
* `describeJevPlan`, `namesWork`, `JEV_ADJUSTMENTS`, `currentJevAdjustment`,
  `adjustJevDecision` (their only caller was the removed panel).
* `/oracle.html`, `src/oracle/oracle.js`, `src/oracle/oracle.css`.

## Found along the way

* **The phone Menu sheet was folded into the header.** `.sl-header` has a
  backdrop filter, which makes it the containing block of its fixed
  children, so the sheet resolved to the header's 64 px. Tests missed it
  because a scripted click scrolls inside the strip. While the Menu is open
  the header now gives up its blur.
* **Reader Setup named Home twice** (origin chip beside the Home back
  button). No chip is drawn for a Portal origin.

## Open

* **The Chamber's first-read choice** (the 30-second offer of Page view)
  was reachable only from the Meditations starter. It is now unreachable.
  Either remove it, or attach it to a reader's first-ever roll.
* Real-device checks: phone shake on iOS (permission) and Android, the
  object's frame rate on a mid-range phone.
