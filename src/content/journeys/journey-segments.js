/**
 * One segment order, read one way.
 *
 * An authored Journey (JOURNEYS-SPEC §6.1) carries `movements`, each
 * with its own segments, because a movement is the unit that changes
 * the active world and a flat list cannot express that.
 *
 * The spec is emphatic:
 *
 *   "There must never be two independently maintained segment orders."
 *
 * So every consumer asks THIS module rather than reaching for a field.
 */

/**
 * Every segment of a Journey, in reading order.
 *
 * Returns the segments themselves, not copies, so identity comparisons
 * against a record's own objects keep working. Callers that annotate
 * segments already spread them into new objects.
 *
 * @param {object} journey
 * @returns {{passageId: string, role: string}[]}
 */
export function readJourneySegments(journey) {
    return readJourneyMovements(journey).flatMap(movement =>
        Array.isArray(movement?.segments) ? movement.segments : []);
}

/** The movements of a Journey; an empty list when it declares none. */
export function readJourneyMovements(journey) {
    return Array.isArray(journey?.movements) ? journey.movements : [];
}
