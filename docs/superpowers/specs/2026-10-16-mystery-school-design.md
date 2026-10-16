# The Mystery School: design

**Status: Proposed**, written 2026-10-16 from the owner's plan *The RISE Mystery School* (Claude Doc, 2026-10-13) and the map of the Reader as of `0208164c`. Reader lane. The build proceeds under the assumptions in §9; the owner's answers there change data, not structure.

Audience: the owner, and the engineers who build the slices in §8.

## 0. Summary, bad news first

- **Four of the 66 texts can be read in RISE today**: Meditations, the Divine Comedy, the Tao Te Ching and Emerson (the 1844 essay *Nature* standing in for the 1836 book). Nine more are ingested but withheld (Zarathustra, Faust, Leaves of Grass, Kandinsky, the Gita, the Emerald Tablet, the Corpus Hermeticum, and two near misses: Blake's *Songs* for the *Marriage*, Rumi's *Dīvān* for the *Masnavi*). The other 53 are not in the tree. The serving policy since 2026-08-18 is Standard Ebooks editions only (`docs/specs/ARCHIVE-CANON-SPEC.md` §6), and Standard Ebooks carries few of these. Admitting texts is the owner's call (§9) and a separate lane; the school is built so that each admission is a data change and nothing else.
- **The Gate text cannot be read.** Pico's *Oration* has no free English edition the plan trusts. The Gate is therefore the charter and the reader's seat, not a reading; the Oration's record stands at the centre marked as the school's first commission.
- **The school is a Library pane, not a room.** The five rooms are pinned by tests and by the Consolidated Reader ("a canon map ... becomes content of the Library, not a new page"). It opens at `/school` and `/library/school`.
- **One interface, two instruments.** The *Wheel* is the school's map: seven houses as sectors of one circle, three degrees as rings climbing outward from the Gate, the five paths as lines across the sectors. The *Lectern* beside it reads whatever the Wheel points at: the charter, a house, a text, a path. Nothing in the school is reachable only through the picture; the Lectern lists everything in plain text.
- **Every text is shown in one of three honest states**: *read in RISE*, *carried, not served* (with the measured reason), or *not yet carried* (with the free edition named and a way to find it outside RISE). The state is resolved at runtime from the content manifest, never hand-written.
- **Initiation is recorded on the reader's device.** A reading launched from the school and finished marks the text; a house shows its seals; a reader who has finished an Arcanum text holds that house's arcanum. No account, no server, no scoring.

## 1. What must be true

From the plan, reduced to what cannot be otherwise:

1. **Everyone enters through the Gate; the seven houses can be taken in any order; inside each, the reader climbs Threshold → Core → Arcanum.** The interface's geometry must say this without a legend.
2. **A text is one record plus a clean body, presented many ways without re-sourcing.** The school holds records; bodies stay in the archive. A school record points at a RISE work and, when the assignment is a part, at its division.
3. **Paths cut across houses** so one question can be followed through many voices. A path is an ordered list of records, four to eight long.
4. **Free to carry, and honest about it.** Rights and edition travel with the record. What RISE cannot serve is still shown, with the reason, never hidden and never faked as readable.
5. **The commons is the ground.** The school's own text (the charter, the "why" lines, house mottos) is RISE's and may be reused freely.

Everything else, including the wheel, is a recommendation.

## 2. Questioned and deleted

| Requirement considered | Decision |
|---|---|
| A new room "School" beside Library | Deleted. Pane in the Library; the room register and its tests stay as they are. |
| A gating first-visit ceremony before the wheel shows | Deleted. The Gate is the default content of the Lectern on arrival and the centre of the Wheel; the first text opened is the entry. No extra state. |
| Degrees as badges awarded by rules (all of degree I before II) | Deleted. The plan says the houses may be taken in any order and the degrees are a climb, not a lock. v1 records what was read; the wheel shows it. No locks. |
| Nominations, commentary, new translations, a course calendar | Out of scope. The plan lists them as the school's later work. |
| A per-house generative visual engine | Deleted for v1. Launching from a house passes the house's colour theme into the reading's existing look; the engine catalog is untouched. |
| Fetching Gutenberg or Standard Ebooks at runtime for absent texts | Refused. Serving is the archive's job and policy-bound (§9 Q1). The school links outward for what it cannot serve. |
| Server-side or account-synced progress | Deferred. Local record only; it is exported and erased with the reader's other data. |

## 3. The interface

### 3.1 Geometry: the Wheel

One circle. The reader's seat, the **Gate**, is the disc at the centre: Pico's human "with no fixed place", free to climb. Seven **houses** are the seven equal sectors around it, in the Chaldean cycle clockwise from the top: **Sun** (top), Venus, Mercury, Moon, Saturn, Jupiter, Mars. Three **degree rings** climb outward from the Gate: Threshold (I) nearest the centre, Core (II), Arcanum (III) at the rim. This is the soul's ascent through the spheres as Ficino and Dante picture it: outward is upward.

Each **text** is a point on its house's sector at its degree's ring, spread evenly along the arc with a 12° margin at the sector's edges. The rings sit at 0.50, 0.68 and 0.86 of the wheel's radius, the Gate disc at 0.14. Where a house holds so many texts of one degree that even spacing would bring two points within 0.10 of the radius (Venus has six at the Threshold), the points alternate between an inner and an outer sub-ring 0.05 either side of the degree ring, so every pair stays at least 0.10 apart: 32 px on a 640 px wheel. Point states, in ink only (no icons): a hollow ring for *not yet carried*, a dashed ring for *carried, not served*, a solid ring for *readable*, a filled disc for *read*, a filled disc with a halo for the house's arcanum once held. Hover or focus raises the title beside the point; press opens it in the Lectern.

The five **paths** are drawn as lines through their points in order, hidden until a path is chosen; then the path's points stay lit, the rest of the wheel dims to ink, and the line draws itself. Choosing the path again, or Escape, clears it.

The wheel is SVG for the sectors, rings and lines, with **real buttons** for the points and house names positioned over it (percent coordinates from one geometry module), so keyboard and screen-reader use is the same as pointer use. The wheel is an enhancement of the Lectern, never the only road.

### 3.2 The Lectern

A column beside the Wheel on desktop and beneath it on a phone. It shows exactly one thing:

- **The Gate** (default): the charter in three short paragraphs, then the Oration's record with its state ("Latin original only; a free English edition is the school's first commission") and the house list as plain links.
- **A house**: planet glyph, name, the house's reading ("House of the Machine: computation, technology, signal"), then its texts grouped by degree, each a row: title, author, date, state, and the action.
- **A text**: title, author, date; degree and house; the "why" line; the edition and rights; bridges (other houses it crosses) and the paths it belongs to, as links; the state; the action. For a readable divided work, its divisions as a list with the ones already read marked.
- **A path**: its name and question, then its steps in order with their states; the first readable step carries the action.

The action is one of: **Read** (opens Reader setup with the text and the house's theme), **Read ·** *division* (for a pinned part), **Not served yet** (disabled, with the archive's reason beneath), or **Find the free edition** (an outward link, marked as leaving RISE).

### 3.3 Phone (≤ 820 px; fits 390×844 and 360×640)

The wheel is full width and square, the house names ride the rim, the paths are a horizontal row of chips beneath it, and the Lectern follows. Opening a text scrolls the Lectern into view. Nothing requires hover.

### 3.4 Motion and quiet

The wheel's degree rings turn once in ninety seconds; the points and labels do not turn. A chosen path draws in 600 ms. Points swell on hover in 160 ms. Under reduced motion (the media query or the reader's setting) nothing turns and the path appears at once. No sound.

## 4. Data

### 4.1 Files

```
src/content/school/houses.js   the Gate and seven houses: id, planet, glyph, name, reading, theme, order
src/content/school/canon.js    the 66 records, one per text, in the plan's order
src/content/school/paths.js    the five paths
src/content/school/index.js    lookups, status resolution, wheel geometry inputs
src/core/school-progress.js    the reader's record (localStorage, registered key)
```

The canon is transcribed from the plan verbatim: 1 Gate, Sun 8, Mercury 10, Moon 9, Venus 10, Mars 7, Jupiter 8, Saturn 13. A test holds these counts and the invariants below.

### 4.2 The record

```js
{
  id: 'mercury.lovelace-notes',          // house.slug, unique
  house: 'mercury',                      // gate | sun | mercury | moon | venus | mars | jupiter | saturn
  degree: 2,                             // 1 threshold, 2 core, 3 arcanum (the Gate is 0)
  title, author, date,                   // as the plan writes them
  edition: 'Original English',           // the plan's "Free edition" column, verbatim
  rights: 'us-pd' | 'us-only' | 'orig-only',
  why: 'First vision of general-purpose computation beyond number',
  work: { id: 'literary-meditations', entry: null | 'nature' } | null,  // RISE archive work; entry pins a division
  bridges: ['sun', 'moon'],              // other houses it crosses (optional)
  note: null | 'The 1844 essay stands in until the 1836 book is carried'
}
```

`work.id` is set only where a RISE work exists (served or withheld). Everything else is derived: house name and theme from `houses.js`, paths from `paths.js`, state from the manifest.

### 4.3 State resolution

`schoolStatus(record, manifest, registry)` returns one of:

| state | when |
|---|---|
| `readable` | `work.id` is in the content manifest with `shelved: true` and in the Library registry |
| `carried` | `work.id` is in the manifest with `shelved: false`; carries `withheldReason` |
| `absent` | no `work.id`, or not in the manifest |

`rights: 'orig-only'` is shown with the state. The manifest is `contentStore`'s; the pane resolves once on mount and once more if the manifest loads after.

### 4.4 Progress

Key `USER_DATA_KEYS.schoolProgress = 'rise_school_progress_v1'`, registered in `user-data-keys.js` and therefore exported and erased with the rest. Shape:

```js
{ v: 1, read: { [recordId]: { entries: ['3', ...], whole?: true, at: '2026-10-16T…' } } }
```

`markRead(recordId, entryId | null)` (null marks the whole work: `whole: true`), `readState(recordId, entryCount)` → `'unread' | 'begun' | 'read'`, `houseSeals(houseId, entryCountOf)`, `holdsArcanum(houseId, entryCountOf)`, `clearProgress()`. Bounded (66 records, at most 1024 entry ids per record; the module does not know a work's division count, the caller passes it), validated on read, pure. Division ids are positions in the archive, so entries are position strings; `sun.nature` pins its division by label.

## 5. Routing and integration

- `route-url.js`: a Library pane `school` at `/school/:focus?` (`focus` is a house id, a record id such as `sun.meditations`, or `path-<id>`), plus `/library/school` parse-only. `ROUTE_ALIASES.school = 'library'`, `ROUTE_PANES.school = 'school'`.
- `Library.js`: `LOADERS.school = () => import('./library/School.js')`, a factory passing `{ onNavigate, onSelect, initialFocus }`, and a **School** button in `PROGRAMS`.
- `route-manifest.js`: `paneCapabilities.school = { onNavigate, onSelect: operations.selectSchoolText }`.
- **Launch.** `App.handleTextSelection(text, source, config, origin)` takes an optional origin; the school's operation resolves the registry text, loads its divisions (`getDivisions()`), picks the pinned entry or lets the Lectern list them, and navigates to Reader setup with `origin: { view: 'school', icon: '☉', name: 'Mystery School' }`, `provenance: { kind: 'school', recordId, workId, editionId, sourceRevision, entryId }`, the Library's `continuation` descriptor for divided works, and the house's colour theme where the visual configuration carries one.
- **Return.** `chamber-exit.js`: `origin.view === 'school'` returns to the Library's school pane focused on the record's house, `replaceUrl: true`, as Keystones does.
- **Completion.** At the one seam where a finished session reaches `app.js`, a session whose provenance is `school` calls `markRead(recordId, entryId)`. The pane re-reads progress on `activate()`.
- **Docs.** `docs/specs/ARCHITECTURE.md` §5/§8.43 name the pane; `npm run docs:diagram` after the commit that adds the imports.

## 6. Visual design

- **Colour.** Each house maps to one of the nine themes, so a reading launched from a house wears its colour and the wheel speaks the same vocabulary: Sun citrine, Moon silver, Mercury prism, Venus rose, Mars ember, Jupiter cobalt, Saturn amethyst. The Gate is `--sy-accent-rise`. Sectors are the theme colour at 6–10 % over `--sy-bg`; rings and lines are `--sy-line`; ink is `--sy-text-2`, lit ink `--sy-text`.
- **Type.** House names and titles in Instrument Serif; metadata in Instrument Sans at the small scale; degree numerals I, II, III in serif small caps. The charter in Crimson Pro, the reading face.
- **Spacing.** Design-system tokens only (`--sy-space-*`, radii, motion). The pane uses `roomHeader` from `room-chrome.js` like its siblings.
- **Glyphs.** ☉ ☽ ☿ ♀ ♂ ♃ ♄ for the houses, in the serif face; no icon font, no images.
- **Verification.** Rendered and measured at 1440, 1280×720 and 390×844 before any claim: no horizontal overflow, labels never collide, every pair of points at least 0.10 of the wheel's radius apart (§3.1), the Lectern never clips.

## 7. Tests and CI obligations

- `src/content/school/canon.test.js` (fast list): 66 records, house counts as §4.1, unique ids, every record's house exists, every house has a degree-1 text, every path step resolves, every `work.id` exists in the archive's work list (served or withheld), rights in the allowed set.
- `src/content/school/index.test.js`: status resolution for the three states and `orig-only`; geometry gives distinct positions.
- `src/core/school-progress.test.js`: validation, bounds, begun → read, seals and arcanum, erase.
- `src/components/library/School.test.js` (jsdom): mounts, lists all houses and texts in the Lectern, opens a house and a text, selects a path, the action per state, reduced motion.
- `src/core/route-url.test.js`, `src/app/route-manifest.test.js`, `src/components/Library.panes.test.js`: the pane set and header buttons updated.
- `src/app/chamber-exit.test.js`: the school return.
- `e2e/school.spec.js` in the gate: `/school` shows the Gate; open Sun › Meditations › Read; `#chamber-display` visible; exit returns to `/school/sun`.
- `vitest.fast.config.js` count bumped by the fast files added; `npm run measure:first-load` unchanged because the pane is a lazy chunk.

## 8. Build order

1. **Data and progress** (pure modules, TDD): §4 files and their tests.
2. **Routing and the pane** : routes, Library integration, `School.js` with the Lectern complete and the Wheel in its first form, launch, return, completion; unit tests; ARCHITECTURE.md; diagram.
3. **The Wheel's finish and the browser proof**: path drawing, motion and reduced motion, the three widths measured, the e2e gate spec.
4. **Record and review**: task `RDR-029` in `docs/product/tasks/`, this spec's status, pull request.

## 9. Open questions for the owner

1. **Admission policy.** May the school serve Gutenberg or Wikisource editions where Standard Ebooks has none (most of the canon), or does the Standard-Ebooks-only rule stand and the school waits? Until answered the school serves the four texts and shows the rest honestly.
2. **The Gate.** Commission a new translation of the *Oration* as the school's first original work, or search for a pre-1931 English edition first?
3. **Progress beyond the device.** Should school progress join account saves later? v1 keeps it local.
