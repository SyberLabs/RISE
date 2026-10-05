# The Consolidated Reader and the canonical Home

Status: Intent, decided. Date: 2026-10-04. The six questions in §7 were answered on 2026-10-05 ([decision record](discussions/2026-10-05-consolidated-reader-decisions.md)). Based on `origin/main` = `97ca014f`, which is also the production release.

**How to read the sources.** Facts about today's product cite the [evidence record](discussions/2026-10-04-reader-evidence.md) as "(report §n)", or code on `origin/main` as "(code: file:line)". Anything marked **Proposal** is design and is not built. Nothing here was implemented or measured. Every acceptance check below can be run, but none has been run. §8 records who drafted and reviewed it.

## Bad news first

1. **The Home churn is a process failure as much as a design failure.** Home has been through 11 states in 12 weeks. The last five lasted 33 days, 1 day, 2 days, 3.5 days and 4.5 hours. There was never a written, shared set of acceptance criteria. Each redesign answered its author's latest criticism and erased the previous answer. Unless the frame is fixed and the criteria are agreed, a twelfth design will go the same way.
2. **The stutter has known causes, and they are cheap to fix.** Living Flame clears its image whenever its quality tier changes. Ember plates fade to near black by design. There is a ~4 s black gap after Home's "Read it with sound". These fixes need no product decision and should ship first.
3. **The Reader has two preset systems that never meet**: 3 stances in Reader setup and 8 tempers in rolls, Today and Home. It also has four colour vocabularies, four engine lists and two sound lists. Consolidating them is mostly deletion. The vocabulary that should win already exists: `rise-current.js` calls the 9 themes "one color vocabulary".

---

## 1. The Home redesigns so far

Each version's "reason" is the criticism its change made of the version before it (report §1; pre-#211 history comes from the local backup ref and PRs).

| # | Merged | PR / commit | Author | First screen | Led with | Reason the change gave | Lasted |
|---|---|---|---|---|---|---|---|
| 0 | 07-10 | `94ad18ba` | sykosyber | Video sigil; Chamber primary; Vault, Library, Workshop, SOL | Chamber | Baseline | 3 d |
| 1 | 07-13 | `af195ac3` | sykosyber | SOL becomes a living strip | Chamber | "Opaque nouns" | ~8 d |
| 2 | 07-21→24 | `eace88ca` … `0decec36` | sykosyber | Atrium and Solarium marble pavilions, Chapel lamp | Chamber with invitations | Busy doors pulled the eye three ways | ~10 d |
| 3 | 08-02→06 | mobile threshold 1–3; `4908de59` | sykosyber | Phone stage; "Audiovisual Reader" | Chamber | Acronym retired | ~15 d |
| 4 | 08-20→25 | #1–#7, #23/#24, #75, #77, #82, #85 | both | Vessel; Enter Chamber; Vault, Library, Workshop; Try RISE seal; orbs; Continue | Enter Chamber, Try RISE | "Nine ways in now offers seven" | **~33 d** |
| 5 | 09-27 | #203, #224, #235, #238, #254/#259/#261 | sdcarlson | Jev request box with length, pace, chunking, sound and visuals; 30 s first read | Typing to Jev | Jev-first direction | 1 d |
| 6 | 09-28 | #264 | sdcarlson | "What do you want to experience?" → preview → Play | A request, then a preview | A request got an unexplained classical reading | 2 d |
| 7 | 09-30 | #297 | sykosyber | WebGL 8-ball, one key, ROLL; Adjust; ask; Wormhole | Chance | "Home was a request box" | 3.5 d |
| 8 | 10-03 17:24 | #373, #375, #379 | sdcarlson | A star per released work; three-part result | A star map | #373 gives no reason for removing the Oracle | **4.5 h** |
| 9 | 10-03 21:54 | #388, #393–#395 | sdcarlson | Today's poem plays silently, full screen; Ask moves into the Menu | A reading in progress | Night library "too busy and not premium … read like a form … wasn't immersive" | current |
| 10 | 10-04 | #377 | sdcarlson | Same screen; `Portal.js` → `Home.js` | — | Five rooms | current |

Today's poem also changed shape four times on the afternoon of 10-03 (#374, #376, #386 closed, #387, #388).

### The failure patterns

- **Churn.** Four doors in eight days, and one Home lived 4.5 hours. No version was observed against criteria before it was deleted. The first-read pilots (#239/#240) recorded only readiness (report §4). Authorship alternated, and each new Home replaced the last one whole.
- **Forms.** v5 (a request box with five choices), v6 (request → preview) and v8 (a roll result that "read like a form") all asked for parameters before the reader had felt anything.
- **Busy screens.** v2 (pavilions), v4 (nine ways in, cut to seven) and v8 (a star for every work). Each pulled the eye several ways at once.
- **Novelty objects carrying the page.** v7's 8-ball and v8's star map. Each was removed when its metaphor stopped working.
- **Losing the home.** v0–v1 led with the Chamber. v9–v10 open on a reading already playing, so Home has collapsed into the Reader. In the owner's words, it "heads straight into a reading and there's no real home". The Menu still uses pre-#377 names (report §1).

### What survived every rewrite (keep these)

- One primary action (since v4).
- Continue (since v4).
- A Library door (always).
- One Menu holding every room (since v7).
- The roll, now "Another reading" (since v7).
- Ask through the reader's own key (since v5).
- Today's poem (since v8).
- The reading's own visuals as the atmosphere (v9).
- Reduced-motion and no-WebGL fallbacks, and the first-load budget.

**The longest-lived Home (v4, 33 days) was the most conventional one**: a clear way in, Continue, a few doors.

### Rules the sequence teaches (Proposal)

1. **Fix the frame; vary the content.** Home's regions are permanent. Experiments (a roll skin, a star map, an Oracle) go into the featured slot or the Library, never into a Home rewrite.
2. **Home names a reading; it does not start one.** Words move only after the reader asks.
3. **No form before feeling.** Home never asks for parameters. Adjusting happens in Read.
4. **No metaphor carries the page.** The reading's own field is the atmosphere.
5. **Change by criteria and observation, not by rewrite.** Watch five readers against the written criteria (§2) before any structural change.

---

## 2. The canonical Home (Proposal)

**Idea: a home with a window.** The featured reading's own visual field fills the screen and moves, which keeps the immersion #388 was right to want. In front of it sits a calm home: what is featured, one way in, and where else you can go. Text does not stream on Home. The poem's opening line is set as a still epigraph. Pressing Begin turns that line into the reading's first unit over the same field, with no route change and no black frame.

### What leads

The featured slot holds exactly one reading. Its look owns the field.

| Visitor state | Featured slot | Primary | Secondary |
|---|---|---|---|
| First visit | Today's poem | **Begin** | Another reading · Adjust · one line saying what RISE is |
| Returning, with a resumable reading | That reading, with its progress | **Continue** | Today's poem as one line ("Begin ›") · Another reading |
| Returning, nothing to resume | Today's poem | **Begin** | Another reading · Adjust |
| After "Another reading" | The rolled reading; the field cross-fades | **Begin** | Another reading · Adjust |
| Reader connected (own key or local Kev) | As above | As above | **Ask for a reading** joins the secondary actions |

- Ask stays in the Menu for unconnected readers. On Home, Ask would lead most first-time visitors to a "connect your OpenRouter" dialog, so it appears there only for readers who can use it.
- Continue resumes the in-memory session, as today (report §2). Keeping it across visits needs projection and program persistence, which is out of scope here.

### Desktop wireframes (1280×800)

```
First visit
┌────────────────────────────────────────────────────────────────────────────┐
│ ◈ SYBERLABS / RISE                         Library     Make     Settings ≡ │
│                                                                            │
│        ░░▒▒▓▓  the featured reading's own field: full bleed, moving,       │
│        ░░▒▒▓▓  dimmed under the type. No words stream.                     │
│                                                                            │
│   TODAY'S POEM                                                             │
│   Roy Butler                                                               │
│   Edgar Lee Masters · Spoon River Anthology · 2 min · Iris                 │
│                                                                            │
│   ‹the poem's opening line, set still, in the look's typeface›             │
│                                                                            │
│   ( Begin ▶ )        Another reading        Adjust                         │
│                                                                            │
│   ‹one line on what RISE is: first visit only; copy is the owners'›        │
│                                                              Privacy Terms │
└────────────────────────────────────────────────────────────────────────────┘

Returning, with something to continue
┌────────────────────────────────────────────────────────────────────────────┐
│ ◈ SYBERLABS / RISE                         Library     Make     Settings ≡ │
│        ░░▒▒  the field of the reading being continued  ▒▒░░                │
│                                                                            │
│   CONTINUE                                                                 │
│   Meditations, Book II                                                     │
│   Marcus Aurelius · 6 min left · Nocturne   ▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░             │
│                                                                            │
│   ( Continue ▶ )     Another reading                                       │
│   ──────────────────────────────────────────────────────                   │
│   Today's poem · Roy Butler, by Edgar Lee Masters             Begin ›      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Phone wireframes (390×844; must also fit 360×640)

```
First visit                      Returning, with Continue
┌──────────────────────────┐     ┌──────────────────────────┐
│ ◈ RISE               ≡   │     │ ◈ RISE               ≡   │
│ ░░▒▒▓▓ field, full ▓▓▒▒░ │     │ ░░▒▒ that reading's ▒▒░░ │
│ ░░▒▒▓▓ bleed, moving ▓▒░ │     │ ░░▒▒ field          ▒▒░░ │
│                          │     │                          │
│ TODAY'S POEM             │     │ CONTINUE                 │
│ Roy Butler               │     │ Meditations, Book II     │
│ Edgar Lee Masters · 2 min│     │ 6 min left · Nocturne    │
│ ‹opening line, still›    │     │ ▬▬▬▬▬▬▬▬▬░░░░            │
│ ┌──────────────────────┐ │     │ ┌──────────────────────┐ │
│ │       Begin ▶        │ │     │ │     Continue ▶       │ │
│ └──────────────────────┘ │     │ └──────────────────────┘ │
│ Another reading   Adjust │     │ Today: Roy Butler    ›   │
│                          │     │ Another reading          │
└──────────────────────────┘     └──────────────────────────┘
```

### How the pieces relate

- **Today's poem** is what is featured when nothing else is. `/today` stays.
- **Another reading** replaces what is featured, on the spot.
- **Ask** produces the same decision shape (`validateJevRecommendation`), so its answer also becomes the featured reading.
- **Continue** takes the slot whenever it exists.
- **Adjust** opens Read with the featured reading and its look already loaded. It is Home's door into Read.
- **Library, Make and Settings** are the other three rooms: header links on desktop, the Menu on phone.

### The Menu: 16 entries become 8

Proposed Menu:

```
┌ Menu ─────────────────── ✕ ┐
│ Home                    ●  │
│ Read                       │  ← setup with the featured or last reading; never empty
│ Library                    │
│ Make                       │
│ Settings                   │
│ ─────────────────────────  │
│ Ask for a reading          │
│ Guide                      │
│ Wormhole                   │
└────────────────────────────┘
```

Every move below already exists as a route since #377 (code: `ROUTE_ALIASES` and `ROUTE_PANES` in `route-url.js`), so the Menu only has to say what the rooms already are. Where each of today's entries goes (code: `Home.js:181-205`):

| Today's entry | Proposed home |
|---|---|
| Home | Home |
| Ask for a reading | Ask (still in the Menu; also on Home when connected) |
| Today's poem | Home's featured reading; `/today` stays |
| Library | Library |
| Sequences | Make › Vault |
| Compose | Make › Workshop (avoids clashing with ChatGPT "Composer") |
| Reader setup | Read |
| Guide | Guide (overlay) |
| Settings | Settings |
| Wormhole | Wormhole |
| Live reading | Removed. Realtime Live is out of scope and off by default; `/live` stays for the Composer embed and the catalog |
| Chapel | Library › Chapel |
| Scriptorium | Make › Scriptorium |
| Visual Lab | Make › Visual Lab |
| Emotions | Settings › Affect |
| Curia | Library › Provenance |

### Counts

| | Today | Proposal |
|---|---|---|
| Visible decisions, desktop | 4 (Read it with sound, Another reading, Library, Menu) | 7 (Begin, Another reading, Adjust, Library, Make, Settings, Menu) |
| Visible decisions, phone | 4 | 4 (5 when connected) |
| Menu entries | 16 | 8 |
| Words streaming on arrival | yes | no |
| Taps to a reading | 1 | 1 |

The three extra desktop items are the doors that make Home a home. They are quiet header text, not competing objects.

### Acceptance criteria for Home (written down so the next change has something to answer to)

1. Exactly one primary action. At most 7 visible targets on desktop and 5 on phone, not counting legal links.
2. No text streams on Home, and no sound plays before a press.
3. All five rooms are reachable in 1 click on desktop and 2 taps on phone.
4. Begin to first word ≤ 1.5 s, with the field visible the whole time (R2 in §4).
5. Continue appears if and only if a resumable reading exists, and when it does, it is the primary.
6. `npm run measure:first-load` holds. The field loads after first paint, as today.
7. Five readers are observed against items 1–6 before any structural change. A structural change needs a dated decision record from both owners.

### Why this one should survive

- **It answers both owners' recorded criticisms at once.** It is not busy (one primary, quiet doors). It is premium and immersive (full-bleed field). It is not a form (Home asks nothing). It is a real home (it names what is featured, offers Continue, shows the rooms, and starts nothing on its own).
- **It separates the frame from the content.** The things each past redesign was really reaching for (chance, a canon map, an object, a request) become content of the featured slot or of the Library, not a new page.
- **It is the conventional structure.** A featured item, a primary action and navigation is the shape of the longest-lived Home (v4). It does not depend on novelty that wears off.
- **It comes with acceptance criteria and a change rule.** That is what the previous ten lacked.

---

## 3. The Consolidated Reader model (Proposal)

### Deleted before anything was added

- Stream/Page leaves setup. The reading bar already switches it, and switching never moves the reader's place (ARCHITECTURE §5).
- "Remove text" merges into "Change text".
- Reset is deleted. Choosing a look resets the look, and the rhythm sheet has its own default.
- The three stances merge into the looks.
- The legacy "Show imagery through words" toggle, the separate accent vocabulary and the hand-copied engine lists are deleted.

Details are in §4.6.

### The first-class choices: four

| Choice | Default | Why it is first-class |
|---|---|---|
| **Text** | Pre-filled from Home, the Library, Ask or a roll | Required |
| **Look**: field, colour, sound and typography as one coherent choice | The reading's own look, else Gallery | The one audiovisual decision. It replaces about 20 visual, sound and type parameters |
| **Rhythm**: how the text is cut | **Phrase** | Phrase was widely preferred in the owner's user testing (owner report; no recording exists, report §4). Word and Sentence stay available |
| **Pace** (words per minute) | The reader's last pace, else 200 | Reading speed belongs to the reader. Arrow keys still adjust it while reading |

The rule that keeps them independent: **a look never changes how the text moves, and rhythm and pace never change how it looks.** The one labelled exception is Inlay, which paints one word at a time by mechanism.

### Looks: one preset vocabulary

A look uses the mechanism ARCHITECTURE §8.26 already settled for stances: a named partial over the existing configuration. It takes the same validated road to the compiler. Which look a reading is in is **derived from its configuration, never stored**. A Jev decision that matches no look shows as "Custom". There is no new engine and no new contract.

Proposed set: 3 stances and 8 tempers (11 presets in two systems) become 10 looks in one.

| Look | Replaces | Field (catalog) | Colour* | Sound* | Typography* | Moves with the text? |
|---|---|---|---|---|---|---|
| Plain | "Read plainly" stance, plainsong temper | Off | classic | Silence | Book, L | — |
| Gallery | What "Read with imagery" promises; §8.22 default surface | Gallery of sourced works (manner, subject, science, your images); Turrell when offline | classic | Aurora | Literary, M | One work per passage, where the source allows |
| Nocturne | nocturne temper | Turrell + Harmonograph | amethyst | Soft rain | Literary, M | Intensity |
| Garden | garden and salon tempers (salon is Garden with jazz) | Genesis | jade | Piano | Literary, M | Intensity |
| Flame | Living Flame, today reachable only through Follow text | Living Flame (composition chosen by colour) | ember | Wonder | Display, L | Intensity and composition |
| Signal | signal temper | Attractor | cobalt | Faded signal | Mono, L | Intensity |
| Iris | ember temper, renamed because "ember" is also a colour theme | Iris + Spectral Plates | rose | Triumph | Display, L | Plate rotation |
| Revel | revel temper | Fractal Flames, psychedelic, lively | prism | Chase | Thick, XL | Cadence |
| Vigil | "Contemplate" stance, vigil temper | Focal (glyph, or the Chapel's icon) | amethyst | Aurora | Display, L | — |
| Inlay | "Fill" | Gallery imagery inside the word | classic | Aurora | Thick, **Fit** | — (requires Word) |

*Defaults are indicative. The owners tune them.

Sources: `stances.js:51-110` and `roll.js:78-127` (code). The temper names are already shown in the product (#297).

**Where the 10 looks appear:**

- Reader setup and the in-reading Look sheet.
- Rolls, Today and Home's featured reading.
- Ask: Jev's decision lowers into the same fields, and the look name is derived from them.
- Workshop: a starting look for a composition.

A roll becomes "work × section × look × rhythm × pace". Any roll or Ask result therefore reopens exactly in Reader setup. Today they cannot reproduce each other (report §2).

### One engine catalog

The catalog is `visual-taxonomy.js`, extended. It already states "every surface that shows a field reads it from here rather than re-listing it" (code: `visual-taxonomy.js:1-21`). The missing pieces are enforcement and two entries.

| Engine | Look(s) | Visual Lab | Visual Catalog | Workshop | Composer |
|---|---|---|---|---|---|
| Off / still | Plain | — | ● | ● | ● `still` |
| Focal (8 glyphs) | Vigil | glyph bench | ● | ● | — |
| Gallery, sourced and personal | Gallery, Inlay | — (Library and Curia own pools) | ● | ● | — |
| Turrell | Nocturne, Gallery offline | ● | ● | ● | — |
| Harmonograph | Nocturne | climate bench | ● | ● | — |
| Genesis (klee) | Garden | preset bench | ● | ● | ● `genesis` |
| Living Flame | Flame | full bench, as today | ● (new) | ● | — |
| Attractor | Signal | system and form bench (restored when fixed, `visual-taxonomy.js:104-122`) | ● | ● | ● `attractor` |
| Iris and Spectral Plates | Iris | palette bench | ● | ● | — |
| Fractal Flames | Revel, Inlay | ● | ● | ● | — |
| Klee Lines, Neural, Rock Garden | none (demoted from Reader setup) | ● | ● | ● | — |
| Night streaks | none (Jev's neon scene) | internal | — | — | — |

**Enforcement.** Add a test that fails if any module outside the catalog lists engine ids, the way `current.test.js` guards the Session and Player constructors. Workshop's hand-copied list (`workshop-visual-assets.js:11-20`) is deleted. Home's separate backdrop renderer goes away in package D1.

### One colour vocabulary: the 9 themes

| Vocabulary today | Count | Proposal |
|---|---|---|
| Colour themes: classic, amethyst, prism, ember, cobalt, jade, rose, citrine, silver | 9 | **The only colour names a reader or a model sees** |
| Accents | 11 defined, 4 offered (`chamber-accent.js:16-28`, `Settings.js:65`) | Chrome accent follows the reading's theme. The Settings control is deleted |
| Attractor palettes | 10 | Derived from the theme. `RISE_CURRENT_THEMES` already does this for 9 of them (`rise-current.js:122-131`) |
| Plate palettes, harmonograph climates, Living Flame compositions and hue, focal tint | 9 + 4 + 6 + 6 + 1 | Derived from the theme through a new map **beside** `RISE_CURRENT_THEMES`, keyed by the same 9 ids. The native lists stay in the Visual Lab for authors |

Example Living Flame mapping: ember → Ember Cathedral, amethyst → Violet Nebula, silver → Glacial Silk, citrine → Solar Bloom, jade → Verdant Current, prism → Prismatic Knot. Classic, cobalt and rose use the nearest composition plus the existing hue control.

Name collisions to retire: "Ember" is a temper, a theme, a climate, two plate palettes and a flame composition. "Nocturne" is a temper and a soundscape. "Compose", "Composer" and the Scriptorium composer are three different things.

### One sound list

Reader setup offers 3 soundscapes. Jev, rolls, Workshop and the in-reading Jev panel offer 24 (report §2).

**Proposal:** one list, grouped:

- Silence.
- Atmospheres: aurora, faded signal, soft rain, starlight, night drive.
- Music: piano, jazz, lullaby, nocturne, waltz, blues, bossa, ragtime.
- Feelings: wonder, mystery, triumph, chase, haunted and the rest.
- Tones: Focus, Deep, Gateway, with fixed delivery and waveform.

Personal swells, and tone delivery and waveform, move to Make. A **Voice** row appears only when the text has a recitation. Choosing it shows "Phrase (recited)" with its reason, instead of silently locking the rhythm.

### Progressive disclosure

| Layer | What the reader meets | Required? |
|---|---|---|
| 0: Home | Begin: the featured look, Phrase, the reader's pace | 1 tap |
| 1: Read setup | Text, 3 look tiles, Customize look, Rhythm & pace, Begin | Begin only |
| 2: Sheets | Customize look (all looks, Colour, Sound, Voice, Imagery or glyph, Size); Rhythm & pace (rhythm, pace, curve, echo) | Never |
| 3: Make | Visual Lab benches, Workshop passage assignments, personal media, tone delivery, text arrival | Never |

### Where Settings ends and per-reading choices begin

**Rule:** if it is about the reader's body or device, and true for every reading, it is a Setting. If it is about this reading's art, it is a per-reading choice. Per-reading choices never silently become preferences, as #297 already established. Pace and rhythm are remembered as "last used", not stored as Settings.

| Settings (the reader) | Per-reading (the reading) |
|---|---|
| Text size default (S/M/L) | Look |
| Typeface override ("the look's own" by default) | Colour |
| Living Text | Sound and voice |
| Photosensitivity; reduced motion | Imagery collection or glyph |
| Volume | Size for this reading; Fit only in Inlay |
| Progress, time and artwork labels | Rhythm, pace, curve |
| Affect; your data; about | Stream or Page (in the reading) |

### Before and after

| Measure | Today | Proposal |
|---|---|---|
| Setup first-screen controls (desktop and phone) | **11** (report §3) | **8** |
| Setup first-screen decisions | 6 (text, stance, adjust, projection, reset, begin) | 4 (text, look, rhythm & pace, begin) |
| Taps from setup to a reading | 1 | 1 |
| Reader-facing setup parameters | ~29, plus 4 in Settings (report §3) | 11 (8 always, 3 conditional: voice, imagery or glyph, echo) |
| Preset systems | 2 (3 stances, 8 tempers) | 1 (10 looks) |
| Engine lists | 4, plus the Lab's 1 and Home's 3 | 1 catalog with filtered views |
| Colour vocabularies | 4 | 1 |
| Places to set typeface and size | 3 | 1, plus a Settings override |
| Sound lists | 2 (3 vs 24) | 1 |
| In-reading bar buttons (Stream, most at once) | 11 (code: `Chamber.js:601-725`) | 7 (plus Dive when the text has threads) |
| In-reading panels | 3: Jev look (7 controls), Visual direction (3 modes, 4 sliders, 3 actions, 2 links), Settings | 2: Look, Settings |

### Setup, desktop

The live preview reuses the Visual Navigator's live stage (`visual-navigator/preview.js`, `live-stage.js`). It pauses when hidden and shows a still frame under reduced motion.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Home                                     Library     Make     Settings ≡ │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │   live preview: the chosen look's field and colour, and the first      │ │
│ │   unit in the chosen rhythm (muted)                                    │ │
│ │              It is not death that a man should fear,                   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│  Meditations · Marcus Aurelius · 680 words · about 4 min      Change text  │
│                                                                            │
│  LOOK   ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│         │ ▓▓ ░░ ▓▓ │ │          │ │  ░▒▓▒░   │                             │
│         │ Gallery ●│ │ Plain    │ │ Nocturne │      Customize look ›       │
│         └──────────┘ └──────────┘ └──────────┘                             │
│  Old masters, one work dissolving into the next · Aurora                   │
│                                                                            │
│  Phrase · 200 wpm ›                                    ( Begin reading → ) │
└────────────────────────────────────────────────────────────────────────────┘
8 controls: Home, Change text, 3 tiles, Customize look, Rhythm & pace, Begin
```

**Which three tiles show:** slot 1 is this reading's own look, or Gallery when it has none. Slot 2 is Plain. Slot 3 is **Inlay on phone**, and Nocturne or Gallery on desktop.

### Setup, phone (fits 390×844 and 360×640 with no scrolling)

Today on phone, Contemplate, Adjust and Stream/Page sit under the sticky footer (`setup-phone-main.png`).

```
┌──────────────────────────┐
│ ←                  RISE  │
│ ┌──────────────────────┐ │
│ │ live preview         │ │
│ │ It is not death that │ │
│ │ a man should fear,   │ │
│ └──────────────────────┘ │
│ Meditations              │
│ Marcus Aurelius · 4 min  │
│              Change text │
│ LOOK                     │
│ ┌──────┐┌──────┐┌──────┐ │
│ │Galler││Plain ││Inlay │ │
│ └──────┘└──────┘└──────┘ │
│ Customize look        ›  │
│ Phrase · 200 wpm      ›  │
│ ┌──────────────────────┐ │
│ │   Begin reading →    │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### The sheets (desktop side panel; phone bottom sheet)

```
┌ Customize look ────────────────────────────────── ✕ ┐  ┌ Rhythm & pace ─────────────── ✕ ┐
│ [Plain][Gallery●][Nocturne][Garden][Flame]          │  │ ( Phrase )  Sentence   Word     │
│ [Signal][Iris][Revel][Vigil][Inlay]                 │  │   Word: ☐ echo the last word    │
│ COLOUR  ◉ ○ ○ ○ ○ ○ ○ ○ ○   (the 9 themes)          │  │ Pace  ──────●──────  200 wpm    │
│ SOUND   Aurora ▾   (Silence · 24 · 3 tones)         │  │ Curve  Steady ▾  (6 curves)     │
│ VOICE   Recited ▾  (only with a recitation)         │  │                       Default   │
│ IMAGERY By manner ▾ (Gallery/Inlay) or GLYPH (Vigil)│  └─────────────────────────────────┘
│ SIZE    S (M) L        (Fit is fixed by Inlay)      │
│                               Open in Visual Lab ›  │
└─────────────────────────────────────────────────────┘
```

### In the reading

The bar covers only reader-origin sessions. The Composer embed keeps its own controls (§5).

```
Desktop
┌────────────────────────────────────────────────────────────────────────────┐
│                 (the field, full bleed, in the reading's look)             │
│                 It is not death that a man should fear,                    │
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ❚❚  1:12 / 4:05          Look     Phrase · 200     Page     ⛶     ⚙     ✕  │
└────────────────────────────────────────────────────────────────────────────┘
┌ Look ───────────────────────── ✕ ┐
│ [Gallery●][Plain][Nocturne] …    │   One sheet for every reading. It replaces the
│ Colour  ● ● ● ● ● ● ● ● ●        │   Jev look panel, the Visual direction drawer,
│ Sound   Aurora ▾  Volume ───●──  │   the Kaleidoscope, Next scene and the
│ Visuals Calmer ────●──── Vivid   │   Visuals toggle.
│ [ Hold this scene ] [ Off ]      │
│ Kaleidoscope (Signal only)       │
│ Next scene (where it applies)    │
│ Edit in Visual Lab ›             │
└──────────────────────────────────┘

Phone: tap to show the bar.  ❚❚   Look   Pace   Page   ⚙   ✕   (6 controls; time above)
```

"Calmer ↔ Vivid" takes its words from Composer's visual control. For the attractor it calls the same `validateVisualCommand`. For other engines it maps locally onto each engine's own energy setting, outside the contract.

"Dive" in the bar is the Reader's own hold-to-look-beneath gesture (`src/core/dive.js`), offered only when a program carries threads. The [Composer decision](discussions/2026-10-04-composer-decision.md) leaves it in scope; it is not the Dive that was removed.

---

## 4. Specific calls

### 4.1 Phrase is the default; Word and Revel are capabilities

- Set `chunkMode: 'phrase'` at the entrances: `ChamberOrbital.js:216`, the ember and signal tempers, and revel (word stays available). Today's poem reads in phrases on every date. Today it is word-by-word about 5 days in 6 (report §4).
- **Leave the compiler's own default unchanged.** Its input is a stable contract. Composer passes `sentence` explicitly (`rise-current.js:293`).
- Migrate saved setups once: a saved default of word becomes phrase. A reader who then picks Word keeps it.
- **Word** lives in the Rhythm sheet. It offers the "echo" (the previous word kept faint above), ported from Home's stream (`reading-stream.js:105-113`, 38% opacity). Echo is on by default for Word, except under Fit.
- **Revel** is a look: psychedelic fractal and lively cadence. It is no longer a word mode. Only Inlay requires Word.

### 4.2 Fill becomes the Inlay look

- **Today it is unreachable in practice.** It needs word chunking, a Gallery field, the Thick face, Fit size, ink plus border, and a legacy Settings toggle, spread across three panels (about 2,700 combinations). Rolls force plain ink, so Home never shows it (report §5; `chamber-text-material.js:11-39`).
- **Proposal.** Choosing Inlay resolves every precondition in one tap: Word, Gallery field, Thick, Fit, image ink, the look's border. The Settings toggle stops being a precondition and is deleted. The Rhythm sheet greys out Phrase and Sentence with the reason "Inlay paints one word at a time".
- **Mobile first.** Inlay is the third first-screen tile on phones.
- **The desktop flaw.** A fitted short word enlarges its own field, and the layout drifts (claimed in the specs, report §5). The fix copies the phone's constraint: fit the word into a fixed measure (about `min(92vw, 34rem)`), and size the field from the stage, never from the word's box.
- **Desktop acceptance.** Word-box centre drift ≤ 2 px and no change in field scale over 60 s at 1280×800, 1920×1080 and 2560×1440. `e2e/fit-mask*.spec.js` stays green.
- **Until that check passes,** Inlay is listed only on viewports ≤ 820 px wide (decision Q3).

### 4.3 Living Flame joins the catalog; Follow text stays inside the look

**Today.** Living Flame is the Visual Lab's only engine and is absent from Reader setup's list. It reaches readers only because "Read with imagery" seeds Turrell, an empty or Turrell shelf makes Follow text the default (`reading-state.js:18, 53`), and Follow text's director uses the flame preset. So the stance promises "a gallery behind the text, one work dissolving into the next" and shows a flame (`run-setup-imagery` frames). Choosing any engine switches Follow text to Hold (report §3).

**Proposal:**

- Living Flame is a Dynamic catalog engine and the field of the **Flame** look. Its composition comes from the colour theme (§3).
- Follow text becomes a behaviour of a look ("moves with the text"). Within a reading it varies **intensity and composition inside the look's own engines and theme**. It never switches engine family or colour (R6).
- The Gallery look follows with gallery works. Living Flame appears only in Flame, and later in Today's pool once R3 passes.
- In the reading, Follow / Hold / Off becomes "Hold this scene" and "Visuals off" in the Look sheet.
- The flame's energy slider becomes Calmer ↔ Vivid. Complexity, symmetry, hue, Mutate, Undo and Save move to "Edit in Visual Lab".

### 4.4 Experience requirements

These become the acceptance criteria for tracker item RDR-009. The checks reuse the investigator's probe metrics, centre brightness and frame intervals, as repeatable Chromium checks. A tier change must be forced deterministically, because #266's runs on SwiftShader never triggered one.

| # | Requirement | Pass condition | Today (report §6) |
|---|---|---|---|
| R1 | **Never a black frame between passages, plates or scenes** | Centre brightness never falls below 60% of its 1 s running median for more than 1 frame, except an authored cut or Visuals off | Ember: 48 → 9.5, ~4 s near black every ~15.5 s (`plate-field.js:243`, the new plate is held at progress 0) |
| R2 | **Home to reading with no gap** | First word ≤ 1.5 s after Begin; field visible throughout | ~4 s of black; visuals at 4.7 s |
| R3 | **Quality changes are invisible** | A quality step never clears accumulated imagery; no frame below 80% of the previous frame at a step | Living Flame frame 21.8 → 9.6, rebuilding from ~7% (`field.js:224-247`, `gl-flame.js:358-391`) |
| R4 | **Motion reads as smooth** | See 4.5 | Attractor ~26 fps, never steps down |
| R5 | **No visible stalls** | No long task > 100 ms after the first 2 s at 390×844@3 with 4x CPU throttle; none > 50 ms on the reference desktop | 915 and 1,241 ms at plate rotation; `toDataURL` 60–159 ms; Home bakes 81 and 112 ms |
| R6 | **A reading keeps one look** | Engine family and colour theme stay constant unless the reader changes them | Follow text switches engines per passage (#266) |
| R7 | **Home never plays words or sound unasked** | No text stream on Home; no audio before a press | Home streams today's poem silently |

**Fixes behind each requirement:**

- **R3, Living Flame.** A tier change alters particle count only. The canvas and image buffer survive. A real resize copies the old image into the new buffer before the next presented frame. Add a unit test for `nextQualityTier`.
- **R1, Ember.** Cross-dissolve: the new plate reveals from the start of the dissolve while the old one holds until the new one passes 50%.
- **R5, phone freeze.** Bake the next plate ahead of rotation, sliced the way #396 already slices first plates. Make the fractal snapshot asynchronous (`visual-cortex.js:1571`). Make attractor `resize()` do nothing when the size is unchanged (`attractor.js:328`).
- **R2, Home gap.** Short term: keep Home's last frame on screen until the reading's field paints, then cross-fade, and cancel Home's bakes at launch. Long term: one renderer (D1).

### 4.5 The attractor's frame-rate policy as an experience requirement

- #392 stepped down below 40 fps. #371 moved that to below 25 fps (`attractor.js:187-189`: "30fps counts as healthy"). Its PR body gives no reason.
- On a desktop GPU the attractor measured a 38 ms median and 49 ms p95 frame interval, so it never steps down (report §6).

**Proposal.** Over 1 s windows of visible, focused frames:

- Step down when the median interval is above 33.3 ms (below 30 fps) **or** the p95 is above 50 ms.
- Step back up after 3 windows with a median below 19 ms. Keep the 3 s cooldown, and allow at most one reversal per 10 s.
- A steady host-throttled 30 Hz (median ≈ 33 ms, p95 ≈ 34 ms) does not step down. That keeps #371's "30 fps is healthy".
- The observed 38/49 ms case does step down. That fixes #392's case.
- A step removes strands first and symmetry last, as now. It never changes system, palette or form, so each theme's look holds.
- **Composer protection.** At the lowest tier, `controlVisual` intensity (0.4–0.75) still changes the rendered result measurably.

### 4.6 What is deleted, merged or demoted

| Parameter | Today | Proposal | Who loses what |
|---|---|---|---|
| 3 stances | Setup first screen | **Merged** into looks | Nothing; names map to Plain, Gallery, Vigil |
| 8 tempers | Rolls, Today, Home | **Become** looks; salon merges into Garden | Salon's jazz becomes a sound choice |
| Stream/Page | Setup first screen | **Moved** to the reading only (exists) | Nothing |
| Remove text, Reset | Setup | **Deleted** / merged | Nothing |
| Chunk mode | Timing panel; default word | Rhythm sheet; **default phrase** | — |
| Pacing curve (6) | Timing panel | **Demoted** to the Rhythm sheet | — |
| Text arrival (2) | Timing panel | **Demoted** to Workshop | Rarely meaningful; rolls force Instant |
| Soundscapes 3 of 24; pure tones | Sound panel | **Merged** into one list | — |
| Tone delivery × waveform; personal swells | Sound panel | **Demoted** to Make | — |
| Ambient drone | Settings; never plays in a reading | **Deleted** (Q6) | Lobby ambience |
| 15 fields | Visuals panel | **Become** looks | Neural and Rock Garden go to Make only |
| Genesis preset, harmonograph climate, cadence | Visuals panel | **Derived** from colour and look, as Composer does; benches in the Lab | Direct choice in setup |
| Gallery engine blend, imagery pools | Visuals panel | One "Imagery" choice in Gallery and Inlay | — |
| Typeface (7) in 3 places | Setup, Settings, reading | From the look, plus a Settings override | — |
| Size (5) in 3 places | Setup, Settings, reading | Settings S/M/L plus a per-reading override; Fit only in Inlay | — |
| Ink (3 + 6 + 12), border (3), Glass | Visuals panel | **Decided by the look** | — |
| Living Text | Visuals panel | **Moved** to Settings | — |
| Accent (11; 4 offered) | Settings | **Merged** into the theme (Q6) | Personal chrome colour |
| "Show imagery through words" | Settings | **Deleted** (Inlay) | — |
| Follow / Hold / Off; 4 flame sliders; Mutate, Undo, Save | Reading drawer | Hold and Off in the Look sheet; energy becomes Calmer ↔ Vivid; the rest goes to the Lab | — |
| Jev look panel (7) | Reading, Jev only | **Merged** into the Look sheet for every reading | — |
| Kaleidoscope, Next scene, Visuals toggle | Reading bar | Moved into the Look sheet | — |
| "Live reading" Menu entry | Menu | **Deleted** from the Menu | — |

---

## 5. Relationship to the plugin (Composer)

The plugin is the ChatGPT presentation. The host model composes one sealed Current, RISE admits it, the reader presses Begin, and RISE presents it. It reuses most of the Reader's machinery and none of its setup. That is why the consolidation can go ahead, and also where it has to be careful.

### What exists today (report §8)

1. The host model writes one `rise.current.v1`: up to 16 segments, each with text, a visual (`still`, `attractor` or `genesis`) and one of the nine themes. The model's guide is generated from the same constants (`src/live/adapters/current-guide.js`).
2. The Worker admits it through the `rise_present` tool (`worker/mcp-server.mjs`), validated by the same code and switched off unless `MCP_ENABLED` is set.
3. RISE lowers the Current to a `rise.experience-program.v1` program (`rise-current.js:217-271`).
4. The compiler turns it into a Session, always in sentence chunks (`rise-current.js:284-297`).
5. The Player runs it in live mode (`setLive`, `extend`, `govern`).
6. The Reader's own reading view presents it, through `chamber-session-factory`, `live-handoff` and `live-present` (`LiveHost.js`). Fields mount through the Visual Field Director, `AttractorField` and `KleeField`.
7. The embed shows its own controls (`src/live/host/controls.js`): Begin, Interrupt and Resume, Stop, and one visual control, "more vibrant / make it calmer". That control drives `AttractorField.controlVisual` within `ATTRACTOR_VISUAL_MANIFEST`: intensity 0.4 to 0.75, default 0.65 (`visual-control-contract.js:1-13`). Narration uses browser speech or a synthetic voice.

**Evidence so far.** On 2026-10-04 an exact candidate narrated audibly in ChatGPT. The same session showed that a model's later tool calls do not reach a widget that is already open, which is why realtime work was deferred ([host record](../experiments/CHATGPT-HOST-2026-10-04.md)). #402 keeps an Interrupt made during startup, and #403 removed Dive from the embed. LIVE-002 still needs one host session for brightness while held, Resume, and the fallback when speech is unavailable.

The presentation does **not** use Reader setup, the Navigator, stances, soundscapes, Fill, the Gallery engines, Living Flame or Follow text, the tempers, or Home. The realtime adapters, the microphone and Dive questions stay in the tree, dormant and out of scope ([Composer decision](discussions/2026-10-04-composer-decision.md)).

### What holds constant

| Contract | Where | Why it cannot move |
|---|---|---|
| `rise.current.v1`: the schema, the nine theme ids, the visual ids, the 16-segment limit | `rise-current.js`, `jev-color-themes.js` | Models write it and the Worker admits it. A change is a v2 Current |
| `rise.experience-program.v1` | `experience-program.js` | The lowering target, saved and replayed |
| The compiler's input and default chunking | The session compiler; Composer passes `sentence` | Narration timing depends on it. The Phrase default is set at the Reader's entrances instead |
| The Player API: `setLive`, `extend`, `govern`, play, pause | The Player | The presentation's runtime |
| `RISE_CURRENT_THEMES`: what each theme draws with | `rise-current.js:122-131` | It is the look of every Composer answer |
| The visual control contract: `ATTRACTOR_VISUAL_MANIFEST`, the intensity range, `validateVisualCommand` | `visual-control-contract.js` | The only visual control in the embed |
| The embed's control set and the constructor guards | `controls.js`, `current.test.js` | What the reader can do inside ChatGPT. Amended 2026-10-05: the owner changed the embed's control set to Play/Pause and Settings, so it is no longer fixed ([embed stage decision](discussions/2026-10-05-embed-stage-decision.md)); the constructor guards stay |
| The admission surface | `rise_present`, `worker/mcp-server.mjs`, `worker/mcp-gate0.mjs` | What ChatGPT is allowed to send |

**The consolidation only adds; it never edits these.** New colour maps sit beside `RISE_CURRENT_THEMES`. The catalog's Composer view is checked against `RISE_CURRENT_VISUALS`, never the reverse. Package A0 (FND-006) turns this rule into tests before any Reader change to shared code lands.

### What is liable to change, and the guard for each

| Package | Shared code it touches | Risk for the presentation | Guard | Review |
|---|---|---|---|---|
| A5: attractor `resize()` no-op | `attractor.js` | The embed's only moving visual could keep the wrong size inside the ChatGPT frame | `e2e/live-mcp.spec.js` | M |
| B1: attractor frame policy | Attractor quality tiers | Fewer strands on slow devices; the visual control must still change the picture at the lowest tier | Policy unit tests; intensity test at the lowest tier; live-mcp | S+M |
| B2: one colour vocabulary | `jev-palette.js`, `chamber-accent.js`, the new theme map | Chrome colours inside the embed. Any theme rename would break Currents | A0 snapshots | M owns the ids |
| B3: one engine catalog | `visual-taxonomy.js` | Composer's three visuals become a declared view of the catalog | Test: the Composer view equals `RISE_CURRENT_VISUALS` | M |
| C3: Look sheet and 7-button bar | `Chamber.js`; the embed is the reading view | The embed could gain or lose controls | Live and embed origins keep the `controls.js` set; `controls.test.js`, live-mcp. Amended 2026-10-05: the embed gets its own two controls, and `controls.js` stays for the standalone `/live` page ([embed stage decision](discussions/2026-10-05-embed-stage-decision.md)) | M |
| D1: one renderer | Field mounting (`mountVisualFieldCue`, the Visual Field Director) | Composer's field cues mount through this path | live-mcp; the embed witnessed again before release | S+M |
| D2: Settings | Face and size defaults read by the reading view | Settings saved in the reader's browser probably do not reach the ChatGPT frame [inferred, unchecked] | The embed safety check in step 1 (§6) | M |
| A4: Phrase default | Setup, tempers, Today | None, as long as the compiler default stays | Test that Composer sessions still compile in sentences | — |

**Not touched.** A1, A2, A3, A6, B4, C1, C2, C4, C5 and C6 change only what the presentation does not use: Reader setup, the Visual Navigator, stances and tempers, soundscapes, Fill, the Gallery engines, Living Flame, Follow text, Home and the Menu.

**Not proposed.** Giving the attractor a single owner (`visual-cortex.js:2086-2100`) would break `controlVisual`.

### Where the two roadmaps meet

- **LIVE-003** (choose at most three instruments) is the catalog's Composer view in B3. Decide LIVE-003 before B3 sets its `composer` flag. Neural stays out without its own admission work.
- **LIVE-001** (themes and visual intent survive Current → Program → Session) rests on the same constants A0 guards.
- **LIVE-005** asks to "document durable presentation intent versus session preferences". The Settings-or-per-reading rule in §3 answers it for both products. Write it once.
- **LIVE-005** also asks for keyboard, phone-width and reduced-motion controls. The embed safety check belongs there and should run now, not at the end. `prefers-reduced-motion` reaches an iframe. A RISE photosensitivity choice saved in the reader's own browser storage probably does not reach a widget served on another origin inside ChatGPT.
- **RDR-003** (the attractor adapts to real frames, done) is what B1 revisits. Q5 is the open question on it.
- **RDR-009** (beauty and performance on real devices) can take R1–R7 as its acceptance criteria. **RDR-007** (observe the Reader journey) is package V.

### What Composer could borrow later (Mateo's lane, only on evidence)

1. **The phrase rhythm.** Test sentence against phrase in the reader sessions. The risk is narration timing.
2. **Looks as names.** A Current's `{visual, theme}` already names a look: still is Plain, attractor with a theme is Signal in that colour, genesis with a theme is Garden in that colour. After C1, "Open in RISE" can open the Reader in the same look with no contract change. A `look` field would be a v2 decision.
3. **A local colour control in the embed**, using the nine themes, with no model in the loop.
4. **A fourth visual** (Flame or Gallery), only with the separate admission work the roadmap requires.

---

## 6. Development sequencing

Owner lanes: **S** = Seth (Reader and Home direction); **M** = Mateo (Composer and contracts); **S+M** = shared, one builds and the other reviews. Each package is one narrow PR unless noted.

- **Guard the contracts before touching anything shared.** A0 lands first.
- **Neither lane waits for the other.** Reader-only fixes run in parallel with Composer acceptance.
- **Witness Composer acceptance on the final attractor**, before the reading view changes.
- **Witness the embed again on the exact release** before the Composer edition ships.

### Steps

| Step | Composer lane (M) | Shared (S+M) | Reader lane (S) |
|---|---|---|---|
| 1. Now | A0, landing first; the LIVE-002 host session on current main; LIVE-001 parity; LIVE-003 three instruments; the embed safety check | A5, merged after the LIVE-002 session | A1, A2, A3, A4, A6 |
| 2. Decide | | Q1–Q6 in one dated decision record from both owners, with the phrase evidence | |
| 3. Foundations | | B1, B2, B3 | B4 |
| 4. Composer acceptance | LIVE-004, witnessed on a candidate that includes A5 and B1 | | C1, then C2, C4, C5, C6 |
| 5. The reading view | LIVE-005 | C3 and D1, after LIVE-004 is witnessed (if either lands first, LIVE-004 is witnessed again) | D2 |
| 6. Observe and release | The embed witnessed on the exact release; LIVE-007, then LIVE-009 | V (RDR-007, RDR-009), in the same week as LIVE-006 if the observers can do both | |

During the LIVE-002 host session, hold changes to `src/live/**`, `controls.js` and `attractor.js`.

### Phase A: now, no owner decision needed (low-risk, visible wins; all run in parallel)

| Package | Tracker | Objective | Lane | Depends on | Acceptance check |
|---|---|---|---|---|---|
| A0 | FND-006 | Contract guards: snapshots of `JEV_COLOR_THEMES`, `RISE_CURRENT_THEMES`, `RISE_CURRENT_VISUALS`, `ATTRACTOR_VISUAL_MANIFEST` | M | — | Tests fail on any edit to these |
| A1 | RDR-013 | Living Flame keeps its image through tier changes | S | — | R3 under a forced tier change at DPR 1 and 2; unit test for `nextQualityTier` |
| A2 | RDR-014 | Ember dissolves through light; next plate baked ahead of rotation | S | — | R1 over 60 s; R5 at plate rotation |
| A3 | RDR-015 | No gap from Home to reading: hold Home's last frame until the first field frame; cancel Home bakes | S | — | R2; no Home long tasks after launch |
| A4 | RDR-016 | Phrase is the default rhythm: setup, tempers, Today, one-time migration; compiler untouched | S | — | Today is phrase on every date; a fresh setup shows Phrase; Composer tests unchanged |
| A5 | RDR-017 | Small stalls: attractor `resize()` no-op; asynchronous fractal snapshot | S builds, M reviews | A0; after the LIVE-002 session | Canvas size set once at mount; no snapshot task > 50 ms; live-mcp green |
| A6 | RDR-018 | The Menu names the five rooms (16 → 8) | S | — | Browser test of Menu entries; every old route id still resolves |

### Owner decision gate: questions Q1–Q6 in §7, recorded in one dated decision.

### Phase B: foundations

| Package | Objective | Lane | Depends on | Acceptance check | Parallel with |
|---|---|---|---|---|---|
| B1 | Attractor frame policy (4.5) | S+M | Q5 | Policy unit tests; live-mcp e2e; intensity visible at the lowest tier | B2, B3, B4 |
| B2 | One colour vocabulary: theme→engine map beside `RISE_CURRENT_THEMES`; chrome follows the theme; accent removed | M owns the ids; S implements | Q6, A0 | A0 guards green; each engine renders all 9 themes | B1, B3, B4 |
| B3 | One engine catalog: add Living Flame and night streaks; `listed`/`composer` flags; Workshop reads the catalog; "no engine ids outside the catalog" test (2 PRs) | S; M reviews the Composer view | A0, LIVE-003 | Parity test; Living Flame selectable in setup | B1, B2, B4 |
| B4 | Canonical Home layout: featured slot, still epigraph, header rooms, Continue lead (uses the existing backdrop) | S, with M sign-off | Q1, A3, A6 | Home criteria 1–6 | B1–B3 |

### Phase C: the Reader

| Package | Objective | Lane | Depends on | Acceptance check | Parallel with |
|---|---|---|---|---|---|
| C1 | Looks: one module replacing stances and tempers; rolls, Today and Jev output expressed as look, rhythm and pace (2–3 PRs) | S | Q2, B2, B3 | Every roll and Ask result reopens identically in setup (round-trip test); `validateJevRecommendation` unchanged | — |
| C2 | Setup first screen: 8 controls, preview, tiles, Rhythm & pace | S | C1, A4 | Count test = 8; no scrolling at 390×844 and 360×640; the preview's GPU cost measured on a phone | C3, C5 |
| C3 | In-reading Look sheet and 7-button bar | S; M reviews the embed | C1, LIVE-004 | Bar ≤ 7; live-mcp green; keyboard and phone reachable | C2, C5 |
| C4 | Follow text within the look | S | Q4, A1, B3, C1 | R6 over a 10-minute reading; Gallery shows sourced works | C5, C6 |
| C5 | One sound list; tones and swells demoted | S | C1 | All 24 soundscapes and 3 tones in setup; swells in Make | C2–C4 |
| C6 | The Inlay look | S | Q3, C1 | 4.2 drift check, or ≤ 820 px gating; fit-mask e2e green | C4, C5 |

### Phase D: finish

| Package | Objective | Lane | Depends on | Acceptance check |
|---|---|---|---|---|
| D1 | One renderer: Home mounts the reading's own field, and Begin hands it over (deletes `reading-backdrop.js`) | S+M | B3, B4, LIVE-004 | R2 with the field never unmounted; first-load budget holds; the embed witnessed again |
| D2 | Settings consolidation: typeface override, S/M/L, Living Text; accent, mask toggle and drone removed | S | B2, C5, C6 | Settings rows match the §3 table |
| V | Five-reader observation of Home and setup (tracker items RDR-007 and RDR-009) before any further structural change | S+M | B4, C2 | Written continue / change / stop decision |

### Into the tracker

- Phase A is seeded: FND-006 (A0) and RDR-013 to RDR-018 (A1 to A6), with the R requirements as acceptance.
- B, C and D are seeded after the decision gate, because the answers to Q1–Q6 change them.

---

## 7. Open decisions for the owners

These are the six questions whose answers change the design. Record them together in one dated decision, with the user testing behind the Phrase default: phrase was widely preferred, but no recording of those sessions exists (report §4).

1. **Q1 (Seth and Mateo): Home.** Adopt "a home with a window"? The field moves, words do not stream, Begin is the single primary, Continue leads when present, and structure changes only by a joint dated decision after observing five readers. *Changes B4 and D1.*
2. **Q2 (Seth): the look set and names.** Ten looks: stances and tempers merged, salon folded into Garden, Gallery, Flame and Inlay added, and the "Ember" look renamed Iris so it no longer clashes with the colour. *Changes C1.*
3. **Q3 (Seth): Inlay on desktop.** Ship phone-first (listed only on viewports ≤ 820 px) until the drift check passes, or hold it everywhere? May rolls and Today draw Inlay on phones? *Changes C6.*
4. **Q4 (Seth): the scope of Follow text.** Keep it inside one look (R6), or keep #266's mood director that switches engines per passage? *Changes C4.*
5. **Q5 (Mateo, with Seth): attractor policy.** Was #371's 25 fps threshold deliberate, for example because of a host constraint? Adopt "median > 33.3 ms or p95 > 50 ms"? *Changes B1.*
6. **Q6 (Mateo, with Seth for the chrome): one colour vocabulary.** Confirm the 9 themes as the only reader- and model-facing colours, remove the Settings accent (whose loading RDR-004 fixed on 2026-10-04), and remove the ambient drone. *Changes B2 and D2.*

---

## 8. Review notes

A product designer drafted §1–§4 and the first version of §5–§7 from the evidence record. The coordinator checked the claims against `origin/main` and changed the sequencing where it meets the plugin.

### Checked against the code

- `ChamberOrbital.js:216` defaults to `'word'`, and Composer passes `'sentence'` explicitly (`rise-current.js:293`). The Reader's default can change without touching Composer.
- `roll.js` holds eight tempers and `stances.js` three stances. There really are two preset systems.
- `visual-taxonomy.js` already says it is the single engine list. Nothing enforces it.
- `RISE_CURRENT_THEMES` maps each of the nine themes to an attractor and a Genesis preset. The colour vocabulary to adopt already exists.
- `route-url.js` already places Emotions under Settings (affect), Curia under Library (provenance), Chapel under Library, and Vault, Workshop, Scriptorium and Visual Lab under Make. A6 only makes the Menu say what #377 built, so it needs no decision.
- The [Composer decision](discussions/2026-10-04-composer-decision.md) exempts the Reader's own hold-to-look gesture (`src/core/dive.js`) from the Dive descoping. The Dive button in the proposed reading bar stays.
- The stutter: the investigation reproduced Living Flame clearing its image; the flame disappears for one frame at 3.13 s in the capture (report §6). That matches the owner's report of a cut to black that the older engines never showed. Living Flame is the newest engine and reaches readers through Follow text's default. Ember's fade is a slower, second cause.

### Changed from the designer's draft

1. **LIVE-002 does not wait for the Reader.** Its blocker merged in #402, and the remaining host checks touch nothing Phase A changes. Run it now. Witness LIVE-004 after A5 and B1, so the final acceptance sees the new attractor behaviour.
2. **A5 is shared, not Seth's alone.** `attractor.js` is the embed's only moving visual and the target of its only visual control.
3. **The embed safety check moves to step 1** and into LIVE-005's acceptance, instead of waiting for Phase D.
4. **C3 and D1 land after LIVE-004 is witnessed**, or LIVE-004 is witnessed again. LIVE-009 needs a witness on the exact release either way.
5. **Q6 names the cost.** B2 removes the Settings accent whose loading RDR-004 fixed.
6. **A4 does not wait for more evidence.** It is reversible, and the owner's testing report is the evidence there is. The decision record writes it down.
7. **B3 depends on LIVE-003**, which decides Composer's instruments.

### Where the design is still weak

- **Requirements questioned and deleted:** Stream/Page on the setup screen, Reset, Remove text, the accent, the mask toggle, salon, text arrival, tone delivery and waveform, Home's word stream, and the Live Menu entry were deleted before anything was simplified. The two "new" looks surface capabilities that already exist and are unreachable today.
- **Every layer earns its place?** Looks are the preset layer §8.26 already settled, not a second engine. The live setup preview is the one real addition. It reuses the Navigator's stage but adds phone GPU load, and C2 must measure that.
- **Verified by something that ran?** No. This is a design. All proposed counts hold by construction, not by measurement.
- **Experience risks:**
  - Ten looks may still be too many; the three-tile first screen hides most of them.
  - Removing the stream might feel less immersive than #388; only the full-bleed field answers that.
  - Phone-first Inlay depends on the 4.2 drift fix for parity.
  - The rule for changing Home only works if both owners keep it.
  - All of these need the five-reader observation (package V), not opinion.
