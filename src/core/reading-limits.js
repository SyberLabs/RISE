/**
 * Shared reading-size authority for Workshop acceptance and Session compile.
 *
 * Workshop is an authoring surface for Sessions. Vault acceptance must be a
 * subset of compile acceptance — a project that validates and saves must
 * compile without a limit refusal (ROADMAP Phase 0.4 finding #2).
 *
 * EVERY CEILING ON READING SIZE BELONGS HERE. This file was added to end a
 * failure this codebase keeps repeating — a vocabulary living in two places
 * where only one copy learns a new word — and it immediately grew a second
 * copy anyway: a bare `64 * 1024` in workshop-project.js governing the same
 * dimension as `maxSequenceAssetUriChars` below, 192 times smaller, with
 * nothing to say they were related. Both are named here now, and the test
 * that asserts their relationship is the point of naming them together.
 */

export const READING_LIMITS = Object.freeze({
  maxTextCharacters: 2_000_000,
  maxTotalChars: 2_000_000,
  maxSources: 64,
  maxSequenceAssets: 24,
  maxImageFileBytes: 8 * 1024 * 1024,

  /**
   * THE TWO IMAGE-URI CEILINGS, AND WHY THERE ARE TWO.
   *
   * They measure the same thing — the length of a sequence image's URI —
   * at two different moments, and the moments have genuinely different
   * budgets:
   *
   *   maxInlineProjectImageUriChars  what may be WRITTEN INTO project JSON
   *                                  and so into localStorage, which is a
   *                                  few megabytes for the whole origin.
   *                                  Anything bigger belongs in IndexedDB.
   *
   *   maxSequenceAssetUriChars       what an asset may CARRY AT RUNTIME,
   *                                  after hydration, when the URI is a
   *                                  blob: handle or a legacy data: URI
   *                                  already in hand. Nothing is being
   *                                  written to a 5MB store here.
   *
   * The invariant between them — the inline ceiling must never exceed the
   * runtime one, or a project could persist an asset it cannot later
   * carry — is asserted in workshop-media.test.js rather than left as an
   * arrangement two numbers happen to be in.
   */
  maxInlineProjectImageUriChars: 64 * 1024,
  maxSequenceAssetUriChars: 12 * 1024 * 1024
});
