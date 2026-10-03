# Invocation skins

RISE opens on an action, not a form. A **skin** is a way of presenting that
one interaction; it is never a second reader.

> **invoke → receive a composed reading → enter / go again / adjust**

| Skin | Where | Invoke | Enter | Go again | Adjust |
|---|---|---|---|---|---|
| **Night library** | Home, in the app (`src/components/Portal.js`, `src/components/night-library/`) | Roll a reading, or pick a star | Start reading | Roll again, or Redraw one part (the text, the mood, the passage) | Adjust first |
| **Wormhole** | a page of its own, `/wormhole.html` (`src/wormhole/`), reached from Home's Menu → *Other ways in* | ENTER WORMHOLE | DOCK | JUMP AGAIN | ADJUST COURSE |

See `docs/superpowers/specs/2026-10-03-night-library-home-design.md` for the
night library. It replaced the Oracle
(`docs/superpowers/specs/2026-09-28-oracle-home-design.md`, superseded).

## One engine

Both skins compose with **the roll** (`src/core/roll.js`): a reading on the
device, by chance inside bounds (work × section × temper). It is the decision
shape Jev returns, passes the same admission (`validateJevRecommendation`), and
says what it is (`model: rise/roll-1`, `provider: RISE`). Nothing is sent; no
provider is called. It never repeats the previous work or temper, so going
again always changes something. Any part it is given (the work, the temper, the
section) is kept and the rest is drawn, which is how the night library's Redraw
changes one part and a star rolls for its own work. A roll carries `title` and `author`, from a
small table held to the Library by a test, so a standalone page can name a work
without loading the Library.

The plan is put into words by `summarizeJevPlan` and `SECTION_WORDS` in
`src/core/jev-describe.js`, derived from the plan, so every skin says the same
thing about the same reading.

## One decision route, for a request in words

Asking sits beside the roll. Home's *Ask for one* needs the reader's own AI
(their OpenRouter account, or Kev on their computer); without one Home says so
and sends nothing. With one, it calls `requestComposedReading` (`src/app/invocation.js`), which posts to
`/api/jev-recommend` with schema version 3 and admits the answer before anything
is shown. The Worker owns that recommendation: its release metadata and
selector constraints are authoritative, and the app validates the full plan
again through `resolveJevReading` before use. A skin with no text field does
not use it.

## One way to open a reading

A response is a preview, never an automatically playing session. The enter and
adjust actions are the app's own, and a skin never compiles or starts a session:

* **enter** → `App.launchJevReading` → `resolveJevReading` →
  `handleBeginSession` → `compileSession`;
* **adjust** → `App.adjustJevReading` → the existing Reader Setup (`chamber`)
  with the text, the plan and the reading's opening look (face, size, colours)
  already set. Visual Navigator stays owned by `ChamberOrbital`.

Leaving a reading entered from Home returns to Home, where the proposal still
waits; one opened through adjust returns to Reader Setup (`origin.adjusted`),
wherever it began (`src/app/chamber-exit.js`).

### Crossing a page boundary

A separate page cannot call the app, so it hands the decision over.
`saveInvocationHandoff(decision, action)` (`action` is `dock` or `adjust`)
stores it in a one-use `sessionStorage` entry and the page loads
`/?invocation=wormhole`. The URL carries no plan or text. On app initialization
the handoff is removed before use, then `openInvocationDecision` calls the same
`launch` or `adjust` operation Home uses, revalidating the decision and the
edition. If the browser refuses storage, the skin says the transfer failed
rather than launching an unrelated reading.

A new separate page needs its own entry token in the startup branch of
`src/app.js`; the URL and the skin are never authoritative for session
configuration. An in-app skin calls the operations directly and skips the
handoff.

## The wormhole

Drawn in depth, and with no dependency: `src/wormhole/scene.js` is WebGL2.

* **The throat** is one fragment shader in true perspective. Depth is the inverse
  of the distance from the gate, so rings, spiralling veins and dust all converge
  on it and rush past faster toward the rim; light gathers where it narrows into
  an event horizon with a thin chromatic ring. In the crossing the view is pulled
  into the gate and the dust becomes streaks.
* **The rocket** is real geometry (`ship.js`): low-poly, flat-shaded, lit by the
  gate (an amber rim on every edge), a cool key from above and its own engine. It
  is seen from above and behind, nose toward the gate. Its flame lengthens in the
  crossing. `ship.js` and `gl-math.js` are pure and unit-tested.
* **Motion** is a small state (`scene-state.js`, also pure): thrust, flow and the
  gate's opening ease toward their targets instead of snapping. The crossing is a
  designed length (about 0.9 s), not a wait, because the roll is instant. On
  arrival the gate warms and the ship holds nearer it.
* **The ship rides a fixed ring round the gate** and follows the pointer's bearing
  from it (`bearing.js`), whether the pointer is over the picture or anywhere on
  the page; a tap sends it on a touchscreen. It never leaves the ring, its top
  always faces the gate (upright at the bottom, on its side at the edges, inverted
  at the top), and it never jumps: it has an angular speed, capped and smoothed,
  and its angle follows the speed, so its position is continuous even when the
  pointer crosses the point straight opposite, where the shorter way round flips.
  Pointing at the gate itself, which has no bearing, leaves it where it is. Under
  reduced motion it stays at the bottom of the ring.
* **Without WebGL2**, or after the GPU drops its context, the page keeps a flat
  picture: a pixel starfield, CSS geometry and an SVG craft. The swap needs no
  reload. Neither picture is needed to use the controls.
* Sound starts off and requires an explicit opt-in.

### Accessibility contract

Held by `e2e/wormhole.spec.js` at 1280×800, 390×844 and 360×640, and by
`src/wormhole/wormhole.test.js`:

* Landmarks: `header`, one `main`, `footer`; one `h1` that stays while the
  visible `h2` changes; `lang` set.
* The console is a picture and is `aria-hidden`; everything it says is said
  again in words by the controls beside it.
* Every control is at least 44×44. Text a reader must read is 12px or more;
  decorative furniture is 10px or more.
* AA contrast on the lightest ground the text can sit on.
* A busy control keeps focus and says so (`aria-disabled`, `aria-busy`); it is
  never `disabled`, which would drop focus to the page. After a jump, focus
  lands on DOCK; after a failure, on the launch key. The result is announced by
  a polite live region.
* Sound is one toggle with a constant name, **Sound**, and the state in
  `aria-pressed`, shown as a hollow or a lit dot.
* Reduced motion removes motion and skips the crossing: CSS animation is off
  (`animation: none`), and the deep scene is a single still frame, redrawn only
  when the state changes (a destination arriving). It never shortens animations
  to a fraction of a millisecond, which leaves an infinite animation repeating
  fast enough to flicker.
* The primary key is on the first screen, including a 360×640 phone.

A future skin should meet the same contract.
