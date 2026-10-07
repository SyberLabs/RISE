# Roadmap: the score, speech, and the service

Status: Record. Date: 2026-10-06. Direction by Mateo in the RISE development conversation of 2026-10-06, on a decomposition and recommendations presented the same day; recommendations marked as such are the coordinating agent's. This adds to the [October direction decisions](2026-10-03-direction-decisions.md), the [Composer decision](2026-10-04-composer-decision.md) and the [Consolidated Reader](../CONSOLIDATED-READER.md); it rewrites none of them.

Three asks were examined together: bring the Scriptorium's capabilities (the full experience program, with every engine and the imagery collections) into the model-facing paths; improve speech beyond the browser's own synthesis; and plan the RiseSDK, a model that can query an expanded visual library, and user-created content through the RISE service. They are three independent subsystems, so each has its own section, and one sequence joins them at the end.

## 0. The decision

**Now.** Speech stage 0 (choose the best installed voice), the ElevenLabs poem packs the owner decided on 2026-10-03, and the two Reader packages Score stage 1 stands on (FND-009 part 2 and RDR-020). Score stage 1 itself follows those, after LIVE-004 and LIVE-005 are witnessed.

**Deferred, each with the trigger that reopens it** (Mateo, 2026-10-06):

| Piece | Why deferred | Reopens when |
|---|---|---|
| A reader-owned voice key (speech stage 1) | A second bearer credential in page memory before Trusted Types; the poem packs and a better installed voice may be enough | Critique B5 (Trusted Types) has landed, and RDR-008 records the installed voice as insufficient, or Composer narration is observed to need it |
| The retrieval tool (`catalog.search` and `describe`) | The admitted visual library still fits in a static capability list | The curator context carries more than 64 collections, or the Composer's guide passes 4,000 characters; both are measurable |
| The hosted carry | It reverses two recorded rules at once (no hosted program store for the first proof; a Worker going stateless under FND-004) | Observed creator and recipient pairs (RDR-007) show file transfer failing, and FND-004 has settled where the Worker may hold state |
| Lineage, media and generated assets through the service | WP-RISE-05 and the agent-composition spec already wait on observed pairs | The hosted carry has run, and a recipient needs a change beyond title and pace |
| RiseSDK | Every record says last; `src/live` imports the Chamber, so it is not extractable yet | SDK-001's observed integration demand, after the critique's C1 to C3 |
| Re-qualifying on-device neural speech | A one-afternoon spike with no product dependency | Whenever an afternoon is free; the harness and the p95 bar exist |

**Score stage 2** (a `program` field on the Current carrying a full experience program) is designed inside stage 1's record so stage 1 does not close it off, and built only after stage 1 has run in the real host.

## 1. Where things stand

The experience program (`rise.experience-program.v1`) is the canonical score: eight track kinds, every engine, museum and science imagery collections, soundscapes, pacing, narration and threads, admitted by `validateExperienceProgram` and the curator-context membership gate. The Scriptorium drives a real model through that gate by paste; RISE calls no model. The ChatGPT Composer sends a Current (`rise.current.v1`), whose visual choice is three ids, and the Worker lowers it into a program. The in-app Ask (Jev on the reader's OpenRouter key, or local Kev) answers finite menus. The Composer's narration is the browser's `speechSynthesis` with no voice chosen (`src/live/voices/browser.js` passes `voice: null`). Library keystones have one pre-rendered Kokoro pack; the poem packs are decided but not built on main (`src/audio/poem-recitation.json` is empty).

MasterMind binds three things: the Composer-first roadmap curated three instruments on purpose (LIVE-003, done); a change to the Current or to `rise_present` is a Class C owner decision; and RiseSDK extraction waits for demonstrated demand.

## 2. The score: Scriptorium's range into the model-facing paths

**Chosen: C, the Current as a thin envelope over the curator context, in two stages.** B (the tool accepts a raw program) is stage 2, placed behind a proven first step. The reasons, recorded so they are not re-argued: a menu-shaped stage serves ChatGPT, Ask and local Kev with one vocabulary, where a raw program serves only a model that can write deep JSON with exact quotation anchors; looks let the owners tune once and every answer inherit it; and the Worker carries the looks and collection ids instead of the whole catalogue (the critique's R3).

### Stage 1 (SCR-001 to SCR-004), in two halves

**1a is one word.** The Current gains `look` and nothing else; 1b adds the rest once 1a has run in the real host. The embed is a short answer card the reader does not control for long, so range belongs first to the Reader site, where the reader holds the Look sheet; a sound bed under `speechSynthesis` cannot be ducked honestly, a model-chosen pace fights the compiler's sentence timing that narration depends on, and a sourced still needs museum hosts admitted into the widget CSP. Each of those is a real change with its own witness, so none rides in with the first word.

The Current gains, beside its three visuals and nine themes:

- `look` (1a): one of the ten looks (RDR-020). It lowers through the same partial a look applies in Reader setup, so the Settings sheet's Theme and Intensity keep working.
- `collection` per segment (1b): an admitted imagery collection id for a sourced still, from the Curia-governed pools; the membership gate checks it.
- `sound` (1b): one id from the one sound list (RDR-024), or silence.
- `pace` (1b): a bounded reading-track value.

Everything a Current names must be an id the catalogue already publishes; nothing is invented, no URL, no media bytes. The Composer view of the engine catalog (FND-009's `composer` flag) states which engines a look may reach in the embed. A look whose engine has no verified mutable control hides the Intensity row rather than pretend (the experience-control contract advertises Attractor intensity only).

The approved [addressable-catalog design](../../superpowers/specs/2026-10-01-addressable-catalog-design.md) says not to widen the Current's visual enum as a shortcut and to admit only verified mappings. Stage 1 obeys it: a look is an admission mapping, and the three visual ids stay.

Prerequisites for 1a: RDR-020 (the looks exist in code) and FND-009 part 2 (Living Flame and night streaks in the catalog, `listed` and `composer` flags, the Composer view equal to `RISE_CURRENT_VISUALS`). For 1b: the embed's widget CSP admitting the museum image hosts, the curator context served to the host as an MCP resource so the model reads ids rather than guesses them, and a ducking path for a bed under the browser voice.

Order: SCR-001 the design record (Class C: the v2 Current, its lowering, stage 2's field shape, the guide text); SCR-002 the Worker's admission and the tool's schema and guide; SCR-003 the embed (sourced stills, CSP, the honest Intensity row); SCR-004 Ask lowers into the same vocabulary. Then a host session on the exact release, the LIVE-002 pattern, before the edition ships with it.

### Stage 2 (SCR-005, designed now, built later)

An optional `program` field on the Current: a full experience program over the Current's own segments as sources, validated in the Worker by the Scriptorium's two gates. This is what the critique's B4 asks for (every `rise.*.v1` is a program or carries one) and MasterMind's WP-RISE-03.

## 3. Speech

**Stage 0 (SPK-001, now).** The browser voice adapter chooses a voice: prefer a natural, same-language voice (Edge and Windows ship "Natural" voices, Safari ships Siri voices, Chrome ships Google voices through the same API), fall back to the default, and tune the rate. One file, zero cost, measurable at RDR-008.

**Poem packs (SPK-002, now); the recited shelf behind RDR-008.** Build the decided ElevenLabs poem packs with `npm run poem:recite` on the owner's key. A recited shelf (the keystones and the most-read divisions) waits until RDR-008 has listened to the poems and the owners set a storage budget; it is storage and build time spent before anyone has asked for it. Packs land in the home FND-004 chooses for audio, not on the branch FND-004 retires.

**Deferred:** the reader-owned voice key (SPK-003) and the on-device spike, per §0. The narration lane's rule stays the shape of all of it: a clip names a voice id, and the provider sits behind the id.

## 4. The service: retrieval, user content, the SDK

Deferred per §0, with the pieces named so the triggers have something to open.

**The hosted carry (SVC-001), explained.** Today a creator exports a portable sequence (`rise.portable-sequence.v1`: the score, exact Archive references, a creator claim; at most 2 MB; no media, no personal text) from the Vault and hands the file over by any channel; the recipient imports it, and their RISE re-derives source identity, rights and program validity before it becomes a proposed draft. A hosted carry is the same object through the Worker: upload, a random id in Cloudflare storage with an expiry, a short link (and QR) the recipient opens, and the same import gate on their side. No account, no listing, no search, no social graph; the host never grants authority. What it changes: the Worker gains storage and an upload surface (size cap, rate limit, expiry, no indexing), which runs against FND-004's direction and the product loop's rule. It is WP-RISE-04's unchecked deep-link item. Recommendation: file transfer suffices for the first proof; decide after RDR-007.

**Retrieval (SCR-006).** The original roadmap's Phase 3: `catalog.search` and `describe` over engines, looks, collections, soundscapes and voices, as one more MCP tool and a Scriptorium step, returning only ids the membership gate checks. The on-device embedder from the room-matching work can index the collections by meaning. Opens at the threshold in §0.

**Lineage and media (SVC-002, SVC-003), RiseSDK (SDK-001, SDK-002).** As the records already sequence them.

## 5. What begins Score stage 1: FND-009 part 2 and RDR-020

### FND-009 part 2

Part 1 landed as #419: the Workshop and the cortex read their engine lists from the registry, and `src/core/engine-lists.test.js` fails on a new hand-made list of three or more engine ids. Part 2 is what remains of the acceptance:

1. Living Flame and night streaks become catalog entries (CONSOLIDATED-READER §4.3: Living Flame is the Flame look's field; night streaks are Jev's neon scene, internal).
2. Every entry carries `listed` (Reader setup shows it) and `composer` (the embed may mount it) flags.
3. A test that the catalog's Composer view equals `RISE_CURRENT_VISUALS`, checked in that direction only, so the Reader never edits the Composer's contract.
4. Deferred from part 2: widening the guard to a ratchet over the 30 non-test modules that name engine ids today. It is hygiene, and RDR-020 deletes two of the listers (stances and tempers) on its own; count again after it.

### RDR-020, the ten looks

One module replaces `stances.js` and the tempers in `roll.js`: Plain, Gallery, Nocturne, Garden, Flame, Signal, Iris, Revel, Vigil, Inlay, each a named partial over the existing configuration (the stance mechanism, ARCHITECTURE §8.26), plus `lookOf(config)`, which derives the look from a configuration and answers "Custom" when none matches. The look is derived, never stored.

Surfaces that then speak looks: rolls and Today (`roll.js`), Home's featured reading, Ask (Jev's decision lowers into the same fields and the look name is derived), the Workshop's starting look. Reader setup's first screen (RDR-021) and the Look sheet (RDR-022) follow on it.

Acceptance, as recorded: every roll and Ask result reopens identically in Reader setup (a round-trip test); `validateJevRecommendation` is unchanged; one looks module, stances and tempers deleted.

Dependencies: FND-009 part 2 (the Flame look needs Living Flame in the catalog); FND-008's engine side (done, B2a) for the look colours. FND-008's chrome side (B2b) is not a prerequisite. Owner answer Q2 (2026-10-05) settles the names: salon folds into Garden, the ember temper becomes Iris.

Build order, three pull requests: the module and `lookOf` with the round-trip test; rolls, Today and Home through looks, tempers deleted; Ask and the Workshop through looks, stances deleted.

## 6. Sequence

| Step | Composer lane (M) | Shared | Reader lane (S) |
|---|---|---|---|
| Now | SPK-001 voice choice; LIVE-004 witness | FND-009 part 2; FND-004's audio home | SPK-002 poem packs; RDR-020 looks |
| Then | LIVE-005 | SCR-001 design record (Class C) | RDR-021, RDR-022 on the looks |
| Score stage 1a | SCR-002 Worker, SCR-003 embed, host session: `look` only | | SCR-004 Ask, as RDR-020's third pull request |
| Score stage 1b | collection, sound, pace, each with its own witness | | |
| Observe | LIVE-006, LIVE-007 | | RDR-007, RDR-008, RDR-009 |
| Reopen by trigger | SCR-005 stage 2; SCR-006 retrieval | SVC-001 hosted carry | SPK-003 voice key |

Whether Score stage 1 lands before or after V1's five sessions is the owners' call; the default is after, since LIVE-003 chose three instruments on purpose.

## 7. Owner questions

1. Score stage 1a before or after V1 (default: after).
2. The storage budget for the recited shelf, and FND-004's choice of where audio lives.
3. The retrieval threshold in §0, if 64 collections or 4,000 characters is the wrong measure.
4. The hosted carry, after RDR-007: open it, or keep file transfer.

## 8. Reported the same day: today's poem shows a stanza, not the poem

Mateo reports that Today's poem has shown stanzas or portions rather than whole poems. Verified on 2026-10-06 against main: `todayPoem` draws one whole division of at most 400 words and never cuts it; `resolveJevReading` hands the Chamber `entry.content`, the division entire; all 58 Lyrical Ballads divisions and all 246 Spoon River divisions are whole poems (no part or stanza labels); the poem served on 2026-10-05 (Rural Architecture, 150 words) compiled to 150 words in 20 verse lines with the poem's last line as the last atom, and 2026-10-04's (Roy Butler, 180 words) is a whole epitaph. The cut is therefore not in the selection, the index or the compiler as they stand.

**Cause, found the same day.** The line the poem ended on, "It would be the greatest court in the world.", is Roy Butler's fourth line and exactly where a 240-character opening cut at a sentence end falls. The Home that production served through 2026-10-04 streamed that opening (today-openings.json, built with the same `openingOf(content, 240)` the preview uses) in its centre as a decorative, silent reading that looped from the start; it was the poem's opening by design, and it read as the poem. The still Home that landed on 2026-10-05 (#436) deleted the stream; it shows the first line as an epigraph, and Begin plays the whole division, which is what the 5th's poem did. RDR-027 is closed on that evidence. A guard that Today's session text equals the division entire would be cheap and is optional.
