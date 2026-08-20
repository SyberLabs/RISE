/**
 * One segment order, read one way.
 *
 * An authored Journey (JOURNEYS-SPEC §6.1) carries `movements`, each
 * with its own segments, because a movement is the unit that changes
 * the active world and a flat list cannot express that. A flat record
 * still carries `segments` alone.
 *
 * The spec is emphatic:
 *
 *   "There must never be two independently maintained segment orders."
 *
 * So every consumer asks THIS module rather than reaching for a field.
 * A record's shape becomes a detail of the record instead of a fact
 * each caller has to know.
 */

/** Is this an authored Journey — one with movements rather than a flat list? */
function isAuthoredJourney(journey) {
    return Array.isArray(journey?.movements) && journey.movements.length > 0;
}

/**
 * Every segment of a Journey, in reading order, whichever shape it has.
 *
 * Returns the segments themselves, not copies, so identity comparisons
 * against a record's own objects keep working. Callers that annotate
 * segments already spread them into new objects.
 *
 * @param {object} journey
 * @returns {{passageId: string, role: string}[]}
 */
export function readJourneySegments(journey) {
    if (isAuthoredJourney(journey)) {
        return journey.movements.flatMap(movement =>
            Array.isArray(movement?.segments) ? movement.segments : []);
    }
    return Array.isArray(journey?.segments) ? journey.segments : [];
}

/**
 * The movements of a Journey, with a flat one presented as a single
 * unnamed movement.
 *
 * A caller that wants to reason about movements should not have to
 * branch on whether the record has any: an editorial playlist is a
 * Journey of one movement that changes nothing, which is exactly what
 * the existing records are.
 */
export function readJourneyMovements(journey) {
    if (isAuthoredJourney(journey)) return journey.movements;
    const segments = readJourneySegments(journey);
    if (!segments.length) return [];
    return [{
        id: `${journey?.id || 'journey'}-movement`,
        title: journey?.title || null,
        // Named so nothing downstream mistakes a flattened playlist for
        // an authored movement that declared no function.
        function: 'flat-sequence',
        segments
    }];
}
