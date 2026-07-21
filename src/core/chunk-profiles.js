/**
 * Editorial, per-source normalization applied immediately before chunking.
 *
 * Profiles may move whitespace boundaries, but they must not add, remove, or
 * reorder source tokens. They run on display copies only; audited payload
 * bytes remain untouched for integrity verification.
 */

const DIALOGUE_LABEL_PATTERN = /(^|\s+)([A-Z][A-Z '.-]{1,30}):\s/g;

function prepareDialogue(rawText) {
    const text = typeof rawText === 'string' ? rawText : String(rawText ?? '');
    const syntheticSpeakerBoundaries = [];
    let speakerOrdinal = 0;

    const prepared = text.replace(
        DIALOGUE_LABEL_PATTERN,
        (match, leadingWhitespace, speaker, offset) => {
            const atStart = offset === 0 && leadingWhitespace === '';
            const alreadyHasParagraphBoundary = /\r?\n[\t ]*\r?\n/.test(leadingWhitespace);
            if (!atStart && !alreadyHasParagraphBoundary) {
                syntheticSpeakerBoundaries.push(speakerOrdinal);
            }
            speakerOrdinal += 1;
            return `${atStart ? '' : '\n\n'}${speaker}: `;
        }
    );

    return {
        text: prepared,
        hints: {
            dialogue: {
                preserveSpeakerHead: true,
                syntheticSpeakerBoundaries
            }
        }
    };
}

export const CHUNK_PROFILES = Object.freeze({
    dialogue: Object.freeze({
        id: 'dialogue',
        description: 'Keeps conservative all-caps speaker labels at the head of their utterances.',
        prepare: prepareDialogue
    })
});

export function findChunkProfile(profileId) {
    if (profileId == null) return null;
    return CHUNK_PROFILES[profileId] || null;
}

export function prepareChunkText(rawText, profileId = null) {
    if (profileId == null) return { text: rawText };
    const profile = findChunkProfile(profileId);
    if (!profile) throw new RangeError(`Unknown chunk profile: ${String(profileId)}`);
    return profile.prepare(rawText);
}

