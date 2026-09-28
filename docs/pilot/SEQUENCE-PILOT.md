# Sequence discovery pilot

**Status: Intent.** This is a manual protocol, not a report of recruited readers, cleared sources, or observed results.

## Decision

Run one seven-day private pilot with 12 first-time readers, two invited creators, and three admitted Keystones. Test whether readers finish a complete Keystone, value the time, and voluntarily return on another day; test whether creators approve an exact, rights-cleared version and want to make another. Name one pilot owner and record the dates before inviting anyone.

**Pass only if:** at least **8 of 12** readers explicitly report completing one full Keystone; at least **8 of 12** explicitly say it was worth their time; at least **5 of 12** make a verified voluntary return on a different day; **both creators** approve rights-cleared versions; and **at least one creator** says they want to make another. Report each count separately against its fixed denominator. Missing answers and withdrawals do not become yes votes. An invited sample cannot establish population retention or demand.

## Prepare

1. Confirm all three Keystones are admitted. For each exact edition, translation, image, audio track, and other asset, record its identity, source, rights evidence, and restrictions for this private sharing. Unknown or withdrawn rights block that version. If a Keystone is not admitted, stop and report the blocker; do not substitute an excerpt or change the target.
2. Freeze a record for every reading and creator sequence: stable ID, version, content fingerprint or export, source and asset identities, rights evidence, creator identity or private pseudonym, and date. The curated Keystone manifest fingerprints are pinned in `src/content/sequence-pilot.js` and checked by a test. Material edits require a new version and reviewed fingerprint; recheck external asset identities manually. Tie each approval and feedback item to the version actually seen.
3. Invite readers and creators directly. Explain the material, seven-day period, requested feedback, voluntary participation, and feedback export and erasure route. Obtain explicit consent **before** storing identity, contact, feedback, or timestamps. Declines and nonresponses are not participants.
4. Get each creator's explicit permission to share their exact version with invited readers, then their separate approval of the rights-cleared version. Record permission scope and date. Run `node scripts/check-creator-sequence-record.mjs <record.json>` on each approved record; it checks structure only. The owner must still verify source bytes, rights, creator permission, and approver authority. Creator permission does not clear third-party rights.

## Observe manually

- Record a consenting reader's first-session date and version. Ask separately, “Did you finish the whole reading?” and “Was it worth your time?” Keep explicit answers and dates. A click, elapsed time, or partial reading is not completion.
- Provide a way to return without prompting or rewarding it. Count a different-day return only when the reader independently reopens a Keystone and confirms it, or the owner witnesses it with consent. Record both local dates, version, and verification method. Intentions, same-day revisits, reminder replies, and owner invitations do not count.
- Ask creators separately whether they approve the exact version and want to make another. Record answers, defects, refusals, and withdrawals; silence is not approval.
- Keep only a restricted manual ledger: participant code, consent/withdrawal, version, dates, explicit reader answers, return method, creator answers, and blockers. No passive metrics or inferred behavior.

## Close and limits

On day seven, report the five counts, missing evidence, withdrawals, rights blockers, and decision to continue, revise, or stop. Recalculate from remaining explicit evidence after erasure while displaying the original target. Give participants their own feedback on request; erase identifiable feedback and contact details on request, retaining only a content-free record that the request was completed. Report aggregate counts and nonidentifying issues.

No public creator publication, open signup, or provider generation is authorized here. Provider generation spend is **$0** in the first pilot. Do not call a paid provider to fill a gap. The manual ledger cannot prove unobserved behavior; state that limit in the closeout.
