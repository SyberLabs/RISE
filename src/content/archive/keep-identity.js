/**
 * How a reviewed-and-kept passage is remembered.
 *
 * Shared by the job builder (which excludes them) and the applier (which
 * records them), because a ledger written with one identity and read with
 * another is a ledger that silently does nothing.
 */

/**
 * A durable identity for a reviewed passage.
 *
 * NOT offsets — cleansing makes those stale within the hour. And not
 * `workId + passage` either, which was the first version and is exactly
 * the mistake the reviewer exists to correct: identical text means
 * different things in different places. "BOOK 1" is a division heading
 * where the Mahabharata opens and would be page furniture in the middle
 * of a page. Keeping one occurrence must not silence the other.
 *
 * So the identity carries WHERE and WHAT-SURROUNDS, fingerprinted so the
 * ledger stays small and readable.
 */
function fingerprint(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim().slice(-90);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

export const keepIdentity = (o) => [
    o.workId, o.section ?? o.locator?.section,
    String(o.passage).replace(/\s+/g, ' ').trim(),
    fingerprint(o.before), fingerprint(o.after)
].join('|');
