/**
 * The steps of a Begin, stamped only while a timing test is watching: e2e/home-begin.spec.js installs
 * `window.__riseBegin` with a `steps` list before the press, and reads them back beside the first word.
 * Without it this does nothing, so a reader pays for none of it.
 */
export function beginStep(name) {
    globalThis.__riseBegin?.steps?.push([name, performance.now()]);
}

/** The mark Home's Begin leaves on the page's timeline, for the reading it begins to measure its first word from. */
const BEGIN_MARK = 'rise:begin';

/** Home's Begin, pressed: where R2's interval to the first word starts (RDR-015), as the timing test starts it. */
export function markBegin() {
    try {
        performance.mark(BEGIN_MARK);
    } catch {
        // No timeline: nothing is measured.
    }
}

/** The milliseconds since Home's Begin, once: the mark is cleared, so no later reading measures from it. Null without one. */
export function takeBegin() {
    try {
        const mark = performance.getEntriesByName(BEGIN_MARK, 'mark').at(-1);
        performance.clearMarks(BEGIN_MARK);
        return mark ? performance.now() - mark.startTime : null;
    } catch {
        return null;
    }
}
