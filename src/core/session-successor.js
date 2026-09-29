/**
 * The next division of a reading is the same reading over a different text.
 *
 * A compiled Session carries three kinds of thing, and a field is exactly one
 * of them:
 *
 *   identity — made fresh by every compile: the id, the name, the time.
 *   source   — true of the text just read, and of nothing else: the sources,
 *              the atoms cut from them, the pointer to what follows, and every
 *              score anchored to a span of that text. A successor reads other
 *              words, so an anchor written against these would name text that
 *              is not there, and the compiler refuses it.
 *   reading  — what the reader chose and the reading carries: pace, type,
 *              sound, imagery, projection, recitation, provenance.
 *
 * The successor used to be built by copying seventeen named fields, so a field
 * the Session learned later was dropped at the next division without a word.
 * Here a field must be classified, and `unclassifiedSessionFields` names any
 * that is not, so learning a new one forces the decision instead of hiding it.
 */

export const SESSION_FIELD_ROLES = Object.freeze({
    identity: Object.freeze(['id', 'name', 'createdAt']),
    source: Object.freeze([
        'sources',
        'atoms',
        'continuation',
        'experienceProgram',
        'visualProgram',
        'movementProgram',
        'audioProgram'
    ]),
    reading: Object.freeze([
        'intent',
        'wpm',
        'chunkMode',
        'curve',
        'displayMode',
        'audioPreset',
        'soundscape',
        'entrainmentMode',
        'entrainmentWaveform',
        'visualConfig',
        'origin',
        'provenance',
        'customVisuals',
        'sequenceVisualAssets',
        'capabilities',
        'recitation',
        'revealMode',
        'isCustom',
        'voiceEnabled',
        'voiceId',
        'selectedSwellId',
        'shuttleExempt',
        'projection',
        'presentation'
    ])
});

const CLASSIFIED = new Set(Object.values(SESSION_FIELD_ROLES).flat());

/** Fields a compiled session carries that no role claims. */
export function unclassifiedSessionFields(session) {
    return Object.keys(session || {}).filter(key => !CLASSIFIED.has(key));
}

/**
 * The compile input for the reading that follows `session`: every reading
 * field carried, the source fields left behind, and `next` (the new text, its
 * title, and anything the caller must state afresh) laid over the top.
 */
export function successorConfig(session, next = {}) {
    const carried = {};
    for (const key of SESSION_FIELD_ROLES.reading) carried[key] = session[key];
    return { ...carried, ...next };
}
