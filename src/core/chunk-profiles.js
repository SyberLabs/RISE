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

// Chapel ingest emits one paragraph per verse, each opening with a
// `[v C:V] ` sentinel (scripts/chapel-ingest.mjs). The sentinel is
// navigation data, not Scripture — it must never be displayed or spoken.
const VERSE_SENTINEL = /^\[v (\d+):(\d+)\]\s/;

function prepareScripture(rawText) {
    const text = typeof rawText === 'string' ? rawText : String(rawText ?? '');

    // Split on the same paragraph boundary the chunker uses, but keep the
    // separators so unprofiled text reassembles byte-identically.
    const parts = text.split(/(\n\s*\n)/);
    const verseAnchors = [];
    const chapterStarts = [];
    let paragraphOrdinal = 0;
    let lastChapter = null;

    const prepared = parts.map((part, index) => {
        const isSeparator = index % 2 === 1;
        if (isSeparator) return part;
        if (part.trim() === '') return part; // chunker skips it; not a paragraph

        const match = part.match(VERSE_SENTINEL);
        if (match) {
            const chapter = Number(match[1]);
            const verse = Number(match[2]);
            verseAnchors.push({ paragraph: paragraphOrdinal, chapter, verse });
            if (chapter !== lastChapter) {
                chapterStarts.push({ paragraph: paragraphOrdinal, chapter });
                lastChapter = chapter;
            }
            paragraphOrdinal += 1;
            return part.slice(match[0].length);
        }

        paragraphOrdinal += 1;
        return part;
    }).join('');

    // Text with no sentinels (any non-Chapel source) passes through
    // byte-identical — the profile is inert outside its corpus.
    if (verseAnchors.length === 0) {
        return { text };
    }

    return {
        text: prepared,
        hints: {
            scripture: {
                verseAnchors,
                chapterStarts
            }
        }
    };
}

export const CHUNK_PROFILES = Object.freeze({
    dialogue: Object.freeze({
        id: 'dialogue',
        description: 'Keeps conservative all-caps speaker labels at the head of their utterances.',
        prepare: prepareDialogue
    }),
    scripture: Object.freeze({
        id: 'scripture',
        description: 'Strips [v C:V] verse sentinels from display while preserving them as navigation anchors.',
        prepare: prepareScripture
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

