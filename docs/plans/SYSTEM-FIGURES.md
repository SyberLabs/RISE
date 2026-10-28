# System figures

A system figure draws the parts a change touched (services, queues and stores), the paths between them, and each state the change passed through. It is one kind of the figure kit (`src/core/figures/figure-kit.js`; [the figure kit in RISE Changes](RISE-CHANGES.md#the-figure-kit)). The model gives only data. RISE places every box, path and label, and refuses a spec it cannot draw cleanly instead of shrinking or cutting anything.

## What a spec says

```js
{ kind: 'system', title: 'Tinybird writes, batched', states: ['A write per check', 'Batched'],
  nodes: [
    { id: 'checker', label: 'Checker', at: [0, 1] },
    { id: 'batcher', label: 'Batcher', at: [1, 0], shape: 'queue', changed: true, in: ['Batched'] },
    { id: 'tinybird', label: 'Tinybird', at: [2, 1], shape: 'store' }
  ],
  links: [
    { from: 'checker', to: 'tinybird', many: true, in: ['A write per check'] },
    { from: 'tinybird', to: 'checker', label: '429s', in: ['A write per check'] },
    { from: 'checker', to: 'batcher', many: true, in: ['Batched'] },
    { from: 'batcher', to: 'tinybird', label: '2s or 5 MB', changed: true, in: ['Batched'] }
  ] }
```

- 3 to 8 nodes, each with an `id`, a `label` and `at: [column, row]` on a grid of 4 columns and 3 rows. `shape` is `service` (the default), `queue` or `store`.
- 2 to 10 links from one node to another. `many: true` draws a path that carries many messages at once. `label` is optional and short.
- `states` (2 or 3, in order) are optional. `in` on a node or link lists the states it is in; none means every state.
- `changed: true` marks what the change added or altered. It is drawn in the brand's accent.
- Each label's budget in characters is in `KIT_BUDGETS.system`. It is wider when fewer columns are used.

## How it is drawn

- The still is the last state. Whatever that state lacks is dashed, and its paths carry no dot.
- Where SMIL runs, the figure steps through the states every 3.2 seconds. Dots run along each live path, and the legend's bar and bold weight move to the state showing.
- `renderFigure(spec, { brand, state })` draws a still of any one state with no stepping. That is how a static image, a slide or a thumbnail shows an earlier state.

The kit refuses, in plain sentences:

- a label over its budget;
- a link that runs through another node, or too short to see;
- a link label with no clear place beside its link;
- a legend wider than the frame;
- a link in a state that one of its nodes lacks;
- a system with no states and nothing changed.

## Adding a case

The reference cases are real changes, kept in `src/core/figures/fixtures/systems.js` and held to goldens.

1. Read the pull requests. Name only the parts and numbers they state.
2. Add an entry to `SYSTEM_CASES`: a name, the `brand` it is drawn in (a key of `BRANDS` in `src/core/figures/brands.js`), its `sources` (`owner/repo#number`), and the spec.
3. Check it draws: `npx vitest run src/core/figures/system-cases.test.js`. A refusal names the node, link or label to move or shorten. Moving a node one column usually clears a link that crosses another.
4. Write its goldens: `npm run figures:systems -- --goldens`. This writes `system-case-<name>.svg` (the animation) and `system-case-<name>-<n>.svg` (one still per state) into `src/core/figures/fixtures`.
5. Look at it: `npm run figures:systems`, then open `out/system-figures/index.html` in a browser. Watch the animation, and read each state's still on its own.
6. Commit the entry and its goldens together. A change to how the kind draws shows up as a diff in every golden, so review those diffs on the sheet too.

The kind-wide goldens (`system-<theme or brand>.svg`, drawn from the study spec in `fixtures/specs.js`) are compared in `figure-kit.test.js` and `brands.test.js`, like every other kind's.

## Entry points

These are the stable calls to build on:

- `renderFigure(spec, { theme | brand, state })`: the figure as an SVG string, or an error that names what was refused.
- `figureProblems(spec)` and `brandProblems(brand)`: the refusals as plain sentences, empty when the figure can be drawn.
- `FIGURE_KINDS`, `FIGURE_BOUNDS` and `KIT_BUDGETS`: the kinds, their counts and each slot's budget. The composer's prompt is written from these, so it cannot drift from the kit.
- `KIT_EXAMPLES` in `scripts/changes/compose.js`: the example of each kind that the composer is shown.
- `BRANDS` in `src/core/figures/brands.js`: the reviewed brands.
- `SYSTEM_CASES`, and `caseFigures` and `systemSheet` in `src/core/figures/system-sheet.js`: the reference cases, and the files they are reviewed in.
- `npm run figures:systems`: the contact sheet, from a fresh checkout, with no model, network or browser.
