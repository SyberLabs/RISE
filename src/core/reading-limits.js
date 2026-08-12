/**
 * Shared reading-size authority for Workshop acceptance and Session compile.
 *
 * Workshop is an authoring surface for Sessions. Vault acceptance must be a
 * subset of compile acceptance — a project that validates and saves must
 * compile without a limit refusal (ROADMAP Phase 0.4 finding #2).
 *
 * Every reading-size ceiling lives here so Workshop and Session share one
 * vocabulary.
 */

export const READING_LIMITS = Object.freeze({
  maxTextCharacters: 2_000_000,
  maxTotalChars: 2_000_000,
  maxSources: 64,
  maxSequenceAssets: 24,

  /**
   * In word chunking one word is one atom, so this is also the ceiling on a
   * curator's word budget: a budget above it is one no session can honour.
   */
  maxAtoms: 120_000,
  maxImageFileBytes: 8 * 1024 * 1024,
  // Sequence-local MP4 only. Kept below half the durable project budget so
  // one import cannot crowd every other authored asset out of the store.
  maxVideoFileBytes: 96 * 1024 * 1024,

  /**
   * Two URI ceilings for the same asset at different moments:
   *   maxInlineProjectImageUriChars — what may be written into project
   *     JSON / localStorage (small origin budget; larger bytes → IndexedDB).
   *   maxSequenceAssetUriChars — what an asset may carry at runtime after
   *     hydration (blob: or legacy data: already in hand).
   * Inline must never exceed runtime, or a project could persist what it
   * cannot later carry (asserted in workshop-media.test.js).
   */
  maxInlineProjectImageUriChars: 64 * 1024,
  maxSequenceAssetUriChars: 12 * 1024 * 1024
});
