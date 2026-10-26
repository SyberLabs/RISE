# Collection imagery in RISE Live: astronomy and landscapes

**Status (2026-10-26):** decided by the owner (below). The first slice, astronomy on `/live`, is task LIVE-039.
Task LIVE-037.

## Owner decisions (2026-10-26)

Decided by the owner:

1. **Option A, the whole collection, for now.** A collection is an engine and RISE chooses the work. Parameters
   (Option B's facets) are deliberately deferred: they will be designed together with the other natural-language
   visual parameters ("red kaleidoscope attractor", "solar harmonograph"). A later step, not designed here.
2. **Landscapes' rights are frozen at harvest, with a scheduled re-verification.** A refresh, roughly monthly,
   re-checks each frozen work against its institution and drops any whose rights changed. Astronomy already
   follows this model (`scripts/build-science-catalog.mjs` is its refresh). The landscape harvest is not part of
   the first slice.
3. **"Earth and sky" is its own set:** ESO's night landscapes and NASA's Earth. A later curation step that needs
   the owner's review by eye; not in the first slice.
4. **The dark room hangs a collection image too,** framed in the safe rectangle like the light room, never
   full-bleed. This replaces the full-bleed dark room of §4.1, §6 and §7 question 8.

Decided by default, from this design's recommendations; the owner may revisit any of them:

5. **Chip text:** the title before the credit (§4.2).
6. **Names:** `astronomy` and `landscapes`, plain, as the model and the reader say them.
7. **NASA's 640-pixel files** stay in the collection: every collection image is now hung in the safe rectangle,
   not spread over the room, so a 640-pixel file is shown smaller. To revisit on sight.
8. **The card:** a RISE image route on RISE's origin (§4.4), built after the first slice; until then Composer's
   guide does not offer the collections.
9. **Sacred readings:** no restriction; which pictures go with a reading is the model's and the reader's choice.
10. **Under "RISE only"** a refused model figure is not replaced by a collection picture.

The owner wants RISE Live (`/live`, where a model's answer becomes a spoken, visual reading) to show the
collections RISE already curates, especially astronomy and landscapes. Today a Live reading can show RISE's
engines, a figure or a code scene, and nothing from a collection. This page says what exists, offers three ways
to do it, recommends one, and names the smallest first slice and the questions only the owner can answer.

## 1. What must be true, and what was deleted before anything was added

What must be true:

1. **Only reviewed images.** Every picture a reader sees was looked at and accepted by the owner. A query never
   chooses what is shown. The live Wikimedia botanical service was disconnected for exactly this
   (`src/content/science/imagery/science-pins.js`, `BOTANICAL_DEFERRED`).
2. **A credit that is owed is always shown.** A work that owes a credit and cannot show one is not shown
   (`artworkMayBeShown` in `src/visuals/artwork-label.js`). Nothing may weaken the CC0 path.
3. **The words and the picture agree well enough.** A reader assumes the picture goes with what is said.
4. **No black frame and no long wait.** The previous visual holds until the next one has decoded.
5. **Cheap on the reader's key.** Every line added to the model's instructions is paid for on every question.

Deleted, because it already exists or fails the first question:

| Proposal | Verdict |
|---|---|
| Search an institution's API while a reading plays | **Refused.** Curation only; standing rule. |
| The model writes an image URL or a credit line | **Refused.** URLs and credits come from the catalog, never a model or a hand (SOURCE-EXPANSION-SPEC §5). |
| A new image presenter for Live | **Deleted.** The Reader's Gallery (`src/visuals/continuous-field.js`) already shows a work with its credit chip, and the room's full frame already holds "a museum image" full-bleed (`src/live/host/frames.js` `FRAME_OF.sourced`; [LIVE-CURRENT §23](LIVE-CURRENT.md)). |
| A new security-policy entry for `/live` | **Deleted.** `public/_headers` `img-src` already admits every collection host. |
| A landscapes curation from zero | **Deleted.** 216 landscapes are already pinned and reviewed (§2). |
| A new astronomy runtime category | **Deleted.** It was built after the August plan (§2). |

## 2. What exists

### The collections

| Collection | Where | Size and rights | State |
|---|---|---|---|
| **Astronomy** (witness-of: photographs by instrument) | verdicts `src/content/science/imagery/science-pins.js`; catalog `src/sources/visual/science-catalog.generated.json` (313 KB, generated 2026-08-06); refresh `scripts/harvest-science.mjs` then `scripts/build-science-catalog.mjs`; contact sheet `scripts/science-contact-sheet.mjs` | **216 works**, not 111: ESA/Hubble 98 (CC BY 4.0), NASA 64 (public domain, acknowledgement asked), ESO 54 (CC BY 4.0). ESO's shortlist is closed and folded in. Rights frozen at harvest. | Pinned, credit composed per work at build time. |
| **Landscapes** (art-of: paintings) | `src/sources/visual/museum-pins.js` `landscapes`; category `aic-landscapes` in `src/sources/visual/museum.js` | **216 pins**: Rijksmuseum 178 (Public Domain Mark), Cleveland 38 (CC0). Golden Age, the Hague School, Romantics, East Asian ink landscapes. | Contact-sheet reviewed 2026-07-22 and 07-23. Rights re-checked per object at resolution. |

The 111 in older notes counted the first pass only. The catalog's own comment in `science-pins.js`
(`SCIENCE_CATEGORIES`) still says 111; the data says 216.

### How the Reader shows them

- **Route 1 of SOURCE-EXPANSION-SPEC §4 is built.** `sci-astronomy` is a pool like any museum category:
  `ScienceCatalogProvider` (`src/content/science/imagery/provider.js`) serves the pinned works with no network
  request but the image; `visual-cortex.js` routes `sci-` ids to it (`_getProviderForCategory`); the Reader
  offers it as **Science → Astronomy** (`src/core/visual-taxonomy-config.js` `poolOptions`). Routes 2 (a science
  concordance) and 3 (the Ackerman vault) are not built.
- **A score cue names collections.** `{ kind: 'sourced', collections: ['sci-astronomy'] }` is a first-class cue
  (`src/core/experience-program.js`). `visualCortex.applyCue` makes those collections the live pool;
  `Chamber._presentScheduledVisualCue` keeps the old visual on screen until the new cue's first work has
  decoded (`isCuePrepared` and `prepareCue`), so a slow image never shows black.
- **Museum works** resolve through `src/content/imagery/service.js` and the adapters in
  `src/content/imagery/adapters/`. Rijksmuseum takes three Linked Art requests per work (object, then the
  VisualItem that states the licence, then the image), under an 8-second budget, in batches of 8, cached for 30
  days. Cleveland takes one request and accepts only `share_license_status === 'CC0'`.
- **The credit.** `licenceClassOf` sorts a work into `open`, `cc-by`, `cc-by-sa`, `public-domain-credit` and the
  rest; `displayedArtworkLabel` always shows a credit that is owed and shows title and artist only if the reader
  wants labels; `artworkMayBeShown` withholds a work that owes a credit it cannot show. The Gallery draws it as
  `.continuous-field-label` (`src/components/read/Chamber.css`), at the room's foot.
- **The owner's four credit rulings** (SOURCE-EXPANSION-SPEC §3a), which this design keeps:
  1. The chip carries the credit as **text**; the full record with links lives where a reader can reach it (the
     Curia). The ruling holds only because that place is reachable.
  2. A roster is cut **at its marker** (`Acknowledgement:`), never at a length. 25 astronomy credits are cut this
     way and keep their `fullCredit`.
  3. An API key **never leaves the workstation.** Harvests run by hand; the site never queries a keyed API.
  4. **None of it reaches the CC0 corpus.** Shortening applies only to the owed credit's text.

### How the room would show one

- **Frames** (`src/live/host/frames.js`). `visualOf` already maps a `sourced` cue to `'sourced'`, and `FRAME_OF`
  sends it to the **full frame**; it is not a picture with content (`CONTENT` holds figures and generated scenes
  only), so it is shown full-bleed with the scrim behind the words. Only `still` draws nothing.
- **Credit in the room** (`src/live/host/LiveHost.css`, "An engine's name, set at the gallery's corner"). The
  label is hidden in the inner eye and the shell and kept in the full frame, "where such an image always is".
  It still sits where the Reader puts it, at the foot, which in the room is the stage's instrument and the ask
  bar (`roomLayout`).
- **The light room** (PR #740, open, LIVE-034): a full-frame visual is "hung as a rounded picture in the room's
  safe rectangle, at most square on a tall screen" (`venue.hangs`). A nebula or a landscape would be hung like a
  print on porcelain.
- **The gap.** A Live reading has no way to ask for a `sourced` cue. `sceneCue` (`src/scenes/manifests.js`)
  lowers a scene to an engine's cue, a figure or a code scene, and a Current's shelf lists no sourced pools
  (`src/core/rise-current.js`, `sourced: []`). The catalog words (`src/live/catalog-words.js`) know only engines.

### How a model names a visual

- The beat line is `@scene <id> <engine> [<parameter>=<value> …]`, read by `src/live/adapters/segment-parser.js`
  and held to the engine's manifest (`validateSceneParams`). The engines and their parameters are taught to the
  model by `describeManifests()` inside `REALTIME_INSTRUCTIONS` (`src/live/adapters/openai-instructions.js`).
- The **same manifests** drive the Worker's admission of a Composer Current (`src/core/beats.js`), Composer's
  guide (`src/live/guide/beats.js`), the illustrator's "answered from RISE's own engines first"
  (`src/live/illustrator.js` `engineNamed`), the catalog words, and the RiseSDK's exported contract
  (`src/core/rise-sdk.js`). Adding an entry there teaches all of them at once.

### Image delivery, measured 2026-10-26

Sampled with `curl` against the public image hosts (no key, no API):

| Host | Sample | Bytes | Pixels | Cache | Cross-origin |
|---|---|---|---|---|---|
| `cdn.esahubble.org` (screen) | heic2017a, heic0506a | 138 KB, 221 KB | 1280 × 888 | `max-age=14400` | `access-control-allow-origin: *` |
| `cdn.eso.org` (screen) | eso1322a, eso1412a | 251 KB, 149 KB | 1280 × 1300 | not stated | `*` |
| `images-assets.nasa.gov` (`~small`) | GSFC_20171208_Archive_e000148 | 151 KB | **640 × 640** | `max-age=300` | none |

- NASA's catalog uses `~small`, 640 pixels: soft when spread over a 1440-pixel room. That item's asset manifest
  (`images-api.nasa.gov/asset/…`, keyless) offers only `~thumb`, `~small` and `~orig` (794 KB); `~medium` and
  `~large` answer 403. Larger NASA renditions must be read per item at harvest.
- `/live` may load every one of these hosts already (`public/_headers` `img-src`).
- **The card cannot.** The MCP card admits images from RISE's own origin only, both in what it declares to the
  host (`cardCsp`: `resourceDomains: [origin]`) and in its own `<meta>` policy (`cardPolicy`:
  `img-src ${origin} blob: data:`), in `src/live/hosts/mcp-card.js`.

### "Pictures by: RISE only"

Another agent is building a setting that limits the room to RISE's own visuals. No code or plan for it is in the
tree yet (searched every worktree on 2026-10-26), so this design states the one thing it needs from that setting
(§4.3) rather than citing it.

## 3. Three ways a reading could ask for an image

They differ in who chooses the work. Everything else (frames, credit, card, caching, the light room) is shared
and is in §4.

### Option A: a collection is an engine; RISE chooses the work (recommended)

Each collection becomes one entry in `src/scenes/manifests.js`, of kind `sourced`, with no parameters:

```
@scene sky astronomy
@say scene=sky Light from these clouds left them before there were people to see it.
```

- `sceneCue` lowers it to `{ kind: 'sourced', collections: ['sci-astronomy'] }`; a Current's shelf lists the
  collection beside its procedural engines, so the cortex can warm the pool. RISE draws a work from the reviewed
  pool through its shuffle bag (no repeats until the collection is spent).
- The model sees one more line in the engine list (`astronomy: no parameters`) and one rule: RISE chooses a
  reviewed picture from the collection, so say what the collection shows, never "this is" a named object.
- The reader's words work with no new code: "astronomy" or "show me astronomy" becomes a catalog word, answered
  at once by the venue, because catalog words are read from the manifests. The illustrator answers a brief that
  names "astronomy" from the collection at once, for the same reason.
- **For:** the smallest change (one manifest entry per collection, a lowering, a shelf line), nothing for the
  model to get wrong, no prompt cost beyond a line, and it is how the Reader's Gallery already works.
- **Against:** fit is at the level of the collection. A passage about the Crab Nebula may show the Orion Nebula.
  The chip names the work (§4.2), so the picture is never passed off as something it is not, but the reader may
  still notice the mismatch.

### Option B: subject facets; RISE chooses within the facet the model names

Option A plus one optional parameter per collection, its values a closed list reviewed by eye:

```
@scene sky astronomy subject=nebula
```

- Astronomy facets could start from the sources' own Astronomy Visualization Metadata branches, which the
  catalog already carries for ESA/Hubble and ESO (148 of 216 works: stars and nebulae 73, galaxies 59, solar
  system 9, cosmology 6, sky phenomena 2). NASA's 68 carry none and would be tagged by hand. Landscapes facets
  (winter, water, moonlight, mountains, ink) would be drafted from titles and then reviewed.
- SOURCE-EXPANSION-SPEC §3a measured that the branch **describes the subject and not the vantage point**: at ESO
  it predicted every rejection, at ESA/Hubble it marked approvals. So a facet may only be a draft for the owner's
  review, never a filter trusted on its own.
- An empty facet falls back to the whole collection.
- **For:** a better fit for a few words of prompt; still curation only.
- **Against:** a tagging pass over 432 works and the owner's review of it; the manifest grows a parameter per
  collection.

### Option C: RISE matches the model's words against the reviewed catalog

The model writes a brief (`@illustrate medium=image the Crab Nebula's filaments`); RISE ranks the works of the
closed catalog by their titles and descriptions; a named object wins, else a facet, else the collection.

- It never leaves the reviewed catalog, so it stays curation only.
- **For:** the best possible fit: when the reading names the Crab Nebula and RISE has it, the reader sees it.
- **Against:** a ranking subsystem to build and tune, and ranking is the trap this project has met before.
  Cleveland's API, asked for "night sky" on 2026-10-26, ranked three pages of a Persian *Tales of a Parrot* first
  (its "Twenty-fourth Night"). Over a reviewed set a wrong match is never an unsuitable picture, but a confident
  wrong one is worse than an honest collection draw.

### Comparison and recommendation

| | A: collection | B: facets | C: matching |
|---|---|---|---|
| What the model writes | an engine name | an engine name and one word | free words |
| Prompt cost | one line per collection | one line per collection | the illustrator's guide, already paid |
| Fit to the words | the collection | the facet | the named object, when held |
| New code | a manifest entry, a lowering, a shelf line | A plus facet tags and a filter | A plus a ranker |
| Owner's work | none beyond the collections | review the tags | review the matches |
| Can show a wrong object as if right | no: the chip names it | less often | yes, when ranking misfires |

**Recommendation: build Option A now, shaped so Option B is one added parameter later; do not build Option C.**
A delivers the distinctive thing (the room opening onto a nebula or a Ruisdael sky) at the cost of a few lines
and no new judgment calls. B is worth building only if the owner, watching A, finds the collection-level fit
wrong too often; its tags then cost the owner a review, which is the same step that made the collections good.
C buys the last bit of fit with the one mechanism this project has repeatedly found untrustworthy.

## 4. What every option shares

### 4.1 How it is shown, room by room

- **Dark room (the default): hung in the safe rectangle, never full-bleed (owner decision 2026-10-26).** A
  collection image never takes the inner eye or the shell: cropping a photograph or a painting to a circle makes
  it another picture. It is hung like the light room's, with the scrim behind the spoken words.
- **One picture per scene.** A scene that outlasts the Gallery's dwell (about 15.5 seconds at the default
  cadence, `galleryCadenceTimings` in `src/core/visual-presence.js`) crossfades to another work from the same
  collection; no work repeats in a reading until the collection is spent.
- **Changes.** A change to or from a collection image is the room's ordinary cut (one blink of the aperture,
  the swap made while it is shut); under reduced motion every change is instant. The flashing image stream
  (RDR-031) is never used in the room.
- **The light room (PR #740).** The image is hung as a rounded picture in the safe rectangle, as every
  full-frame visual is there. No change is needed for this beyond the credit's place (4.2).

### 4.2 The credit in the room

- **Text, per ruling 1.** The chip shows exactly what `displayedArtworkLabel` gives the Reader: for a work that
  owes a credit, its credit and licence ("ESO · CC BY 4.0"); for an open work, title and artist when the reader
  wants labels. Proposed for Live (an owner question, §7): put the title before the credit, so the reader always
  knows what the picture is. Measured over astronomy, title and credit together run 94 characters at the median,
  139 at the 90th percentile and 238 at most; the chip's existing long and very-long sizes hold them.
- **Placement.** Not at the foot, where the Reader's chip goes: in the room that is the instrument and the ask
  bar. The chip sits at the **lower right of the room's safe rectangle**: 16 pixels in from the right, its foot
  12 pixels above the words' zone, both read from `roomLayout(...).safe`. That rectangle is already clear of the
  words, the bar, the docked face and the corner's sign-in link. In the light room it is the hung picture's
  caption, at the picture's lower right inside the rectangle. The placement must be rendered and measured at
  1440 × 900 and 390 × 844, not reasoned from the CSS.
- **The full record must be reachable from the room**, or ruling 1 and the 25 roster cuts of ruling 2 do not hold
  in Live: the room has no door to the Curia. **"About this reading"** (in Settings, and in the card's Settings)
  lists each picture shown: title, full credit (`fullCredit`), licence, and a link to the institution's page.
- **Withholding** stays where it is: the build script refuses a work that cannot be credited, and the cortex
  refuses it again at hydration.

### 4.3 "Pictures by: RISE only"

Collection imagery is RISE's own: RISE's owner reviewed every work and RISE chooses which one shows; no model
draws it. Under "RISE only" a collection scene therefore shows like any engine. The one thing this design needs
from that setting is its classification: **a cue of kind `sourced` counts as RISE's own**, beside `field` and
`procedural`; a figure or a code scene (`kind: 'scene'`) does not. Nothing else in that setting changes. The owner
of that setting should add the case and a test; this design does not touch it.

### 4.4 The card (`?embed=mcp`)

The card admits only RISE's origin (§2). Three ways to show collection images there:

| | How | For | Against |
|---|---|---|---|
| 1. Declare the hosts | add the five image hosts to `cardCsp` and `cardPolicy` | no server code | five third-party domains in what the card declares to Claude and ChatGPT, each a review item; breaks the card's stated rule "only RISE's origin" |
| 2. **A RISE image route (recommended)** | the Worker serves `/collection-image/<work-id>`, looking the id up in the generated catalogs (a closed map, not an open proxy), fetching the institution's file and caching it at the edge | the card keeps one origin; caching is RISE's to set | Worker code, edge bandwidth, and RISE re-serving the files (allowed: CC0, public domain, and CC BY with the credit shown) |
| 3. Bundle the files | ship the images as static assets, restored like the recitation audio | no runtime fetch | about 45 MB per collection at 200 KB a work; too large for the repository |

Until the route exists, Composer's guide and advertised tool schema do not offer the collection engines (`src/live/guide/beats.js` lists
engines from the manifests; it gains a withheld list, as it already has for parameters). If a host model writes one
anyway, the Worker admits it (the manifests are shared), the card cannot prepare the image, and the previous visual
holds: a test must show exactly that, so the card never shows a black or broken frame.

### 4.5 Caching and latency

- **Astronomy is ready now.** Its works are resolved at harvest, so a picture costs one image request of
  140 to 250 KB from the institution's CDN, and nothing else. The 313 KB catalog loads lazily the first time a
  collection is asked for; it must not enter the first load (`npm run measure:first-load` must not move).
- **Warm at declaration.** The instructions already require a scene to be declared on its own line before the beat
  that starts it. When the runtime meets `scene.declare` for a collection, it asks the cortex to prepare the cue,
  so the image has usually decoded before its beat. If it has not, the old visual holds (§2).
- **Landscapes are not ready for Live as they stand.** A cold Rijksmuseum work takes three requests before its
  image; the pool resolves in batches of 8. The first slice for landscapes needs either the same warm-at-declare
  path (the first batch, not the whole pool), or a resolved landscapes catalog generated from the same pins, as
  astronomy has. The second freezes the rights at harvest, where the Reader re-checks them live today: that is the
  owner's call (§7). The card can only use the second.
- **Resolution floor.** For the full frame a work's long edge should be at least 1280 pixels. ESA/Hubble and ESO
  meet it; NASA's `~small` (640) does not. Either the harvest records each NASA work's `~orig` size and the room
  uses that rendition when it is within a byte budget, or the room draws only works above the floor. Measure the 64
  works before choosing.

## 5. Landscapes: the curation plan

Landscapes already exist as paintings. What the owner may want in addition is the photographic register, which
is what makes astronomy feel like witness rather than wallpaper.

### Sources and licence classes

| Candidate | Register | Licence class | What is known |
|---|---|---|---|
| The pinned `aic-landscapes` | paintings (art-of) | `open`: CC0, Public Domain Mark | 216 reviewed; ready |
| More Cleveland paintings | paintings | `open`: CC0 | `q=landscape&type=Painting&cc0=1&has_image=1` totals **458** (2026-10-26, keyless); 38 are pinned. Robert S. Duncanson's *Vale of Kashmir* is among the first three. |
| Cleveland photographs | 19th- and early 20th-century landscape photography (art-of) | `open`: CC0 | `type=Photograph` totals **145**; first three by Henry White, William B. Post and John Burke |
| ESO's observatory nights | night landscapes under the sky (witness-of) | `cc-by`: CC BY 4.0, credit composed | About 20 were **cut from Astronomy because they are landscapes**: AVM branches A and E, "ALMA's world at night", "The southern Milky Way above ALMA", "Total solar eclipse, La Silla Observatory", "Three planets dance over La Silla" (SOURCE-EXPANSION-SPEC §3a). Feed capped at 100 entries. |
| NASA Earth from orbit | the Earth as landscape (witness-of) | `public-domain-credit` | Keyless search; third-party works are marked only in prose, a residual risk the spec records |
| The Met, the Rijksmuseum search | paintings, photographs | `open` | Pinned ids only (`adapters/met.js`); Rijksmuseum's key-free search (MUSEUM-ATLAS §2) |

Not candidates: anything live (Wikimedia search), anything CC BY-SA, non-commercial or all rights reserved
(SOURCE-EXPANSION-SPEC §4, GBIF and iNaturalist deferred), and the retired Smithsonian holdings.

A photograph does not enter a hall of paintings unlabelled (SOURCE-EXPANSION-SPEC §5). So the photographs either
join Landscapes with their labels or form their own set, provisionally **"Earth and sky"** (the ESO nights and NASA's
Earth). That is the owner's choice.

### The steps, mirroring astronomy

1. **Harvest by hand**, keyless, on the workstation: extend `scripts/harvest-science.mjs` or add a sibling. Each
   candidate carries its licence class read per item at the authoritative place, a probe that its image resolves,
   its credit composed by `normalizeArtworkLabel`, its pixel size, and (for ESO) its AVM branch.
2. **Contact sheet** with `scripts/science-contact-sheet.mjs`: every candidate, with no `--limit` cut (the sheet
   names anything not shown), object and image counts both, elided credits flagged, warm colour on the branches
   that predicted cuts before.
3. **The owner's verdict by eye** on the sheet. This is the step no metric replaces. Verdicts go into a pins file
   (whole sources with named cuts, or work by work), and refusals into its retirement ledger so the next harvest
   does not re-propose them.
4. **Build** the catalog with the verdicts (a sibling of `scripts/build-science-catalog.mjs`), which re-checks
   every work's credit and delivery at the last gate.
5. **Tests:** every owed credit composes; the catalog's image hosts are in `img-src`
   (`src/core/csp-image-hosts.test.js`); the CC0 path is untouched (`src/visuals/artwork-label.test.js`).

An agent can run steps 1, 2, 4 and 5. Only the owner does step 3.

## 6. The smallest first slice: astronomy hung in the safe rectangle, with its credit

On `/live` only (not the card), dark room and light room, Option A, one collection.

**Changes:** an `astronomy` entry of kind `sourced` in `src/scenes/manifests.js` and its lowering in `sceneCue`;
the collection on the Current's shelf in `src/core/rise-current.js`; one rule in `REALTIME_INSTRUCTIONS`; the
collection's name in the catalog words' `NAMES` ("the Astronomy collection"); the chip's place and "About this
reading" in `src/live/host/`; the collection withheld from Composer's guide.
Nothing for landscapes, facets, the card or the Worker.

**Acceptance criteria:**

1. `@scene sky astronomy` is read by the segment parser, admitted, and lowered to
   `{ kind: 'sourced', collections: ['sci-astronomy'] }` (unit tests in `segment-parser`, `beats`, `manifests`,
   `rise-current`). A parameter on it is refused.
2. In the venue, a reading with that scene shows an astronomy work hung in the safe rectangle within the frame's
   transition, the face docked; never in the inner eye or the shell (`frames.test.js`, a venue or runtime test).
   Under reduced motion it is shown at once.
3. The chip shows the work's credit and licence for every credit-required work; at 1440 × 900 and 390 × 844 its
   box lies inside the safe rectangle and meets neither the words' zone, the ask bar, the docked face nor the
   sign-in link (a browser test with the image requests answered locally, measuring boxes).
4. "About this reading" lists each picture shown, with title, full credit, licence and a working source link; a
   work with a cut roster shows the whole roster there.
5. "astronomy" and "show me astronomy" in a held reading are answered by the venue at once, with no model call,
   and the bar says what is shown.
6. Until the image has decoded the previous visual stays; an image that fails to load leaves the previous visual,
   never a black or broken frame (test with a failing image response).
7. `npm run measure:first-load` and the security policy are unchanged; the catalog loads only when a collection is
   asked for.
8. Composer's guide does not offer `astronomy`; the Worker's tests pass.
9. **Human gate:** the owner watches a real model's reading on the deployed `/live` that uses the collection, in
   the dark room and (once #740 is merged) the light room. A green build does not pass this.

## 7. Questions only the owner can answer

1. **Option A or B first?** Collection-level fit now, or subject facets, which cost a review of the tags.
2. **The chip's text in Live:** the credit alone, as the Reader shows a credit-required work today, or the title
   before the credit?
3. **The words a model and a reader use:** `astronomy` and `landscapes`, or names in the Chapel's register (the
   spec's own open question: "The Firmament", "The Living World")?
4. **Landscapes' rights posture:** a resolved catalog with rights frozen at harvest (fast, and the only way into the
   card), or keep the Rijksmuseum and Cleveland live re-check (slower cold start, not possible in the card)?
5. **Photographs:** do the ESO night landscapes and NASA's Earth become their own set ("Earth and sky")? Do
   Cleveland's landscape photographs join the painted Landscapes, labelled?
6. **NASA's 640-pixel files:** excluded from the full frame, shown at their full rendition within a byte budget, or
   shown only where pictures are hung (the light room)?
7. **The card:** a RISE image route (recommended), or declare the five institution hosts?
8. **The dark room:** decided 2026-10-26: hung in the safe rectangle like the light room, never full-bleed.
9. **Under "RISE only":** when a model's figure is refused, should a collection picture take its place?
   Recommended: no; the picture would not be what the words asked for.
10. **Sacred readings:** the spec asks whether photographic imagery belongs behind Scripture. Should a Live reading
    of a sacred text be kept from the astronomy collection, or is that the model's and reader's choice?

## 8. What was not verified

- The "Pictures by" setting: no code or plan for it exists in any worktree; §4.3 is a stated contract.
- Image sizes come from five sampled files and one NASA asset manifest, not the whole catalog.
- How the Gallery's fit and backdrop look in the full frame behind the scrim was not rendered.
- Whether the cortex needs the collection on the shelf to warm its pool, or warms from the cue alone, is to be
  shown by a test in the slice.
- Cleveland's 458 and 145 are query totals, not reviewed works; the ESO "about 20" is the spec's count of the first
  pass's A and E cuts.
- No real model has been asked to use a collection scene; whether it uses one aptly is unknown.

## 9. Check before finishing (AGENTS.md §5)

- **Requirements questioned, deletions first.** Live search, model-written URLs, a new presenter, a new security
  entry for `/live` and a new landscapes curation were deleted before anything was added (§1).
- **Every layer earns its place.** The slice adds one manifest entry, a lowering, a shelf line, an instruction, a
  chip position and an About list. The Worker route, facets and the ranker are deferred until something proves
  they are needed.
- **Fundamentals first.** The decisive facts were the frame table that already admits a museum image, the shared
  manifests, and the card's one-origin rule.
- **Verified by something that ran:** catalog counts, credit lengths, image sizes and headers, Cleveland totals. The
  design itself is reasoning until the slice's tests and the owner's eye pass it.
- **Where it fails today:** fit at the collection level is weaker than the picture a reader may expect (Option A's
  cost), and landscapes are not fast enough for Live without the owner's rights decision.
