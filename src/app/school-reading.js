/**
 * A reading opened from the Mystery School, and the mark it leaves when
 * finished.
 *
 * The reading is the one the Library would open for the same division (its
 * `readEntry`, or its whole-text path for an undivided work), with the
 * school's provenance and origin and the house's colour theme. Loaded only
 * when the school asks, so the canon stays out of the first load.
 */

import { getTextById } from '../content/library.js';
import { houseById, recordById } from '../content/school/index.js';
import { contentsNoun } from '../components/Library.js';
import { jevColors } from '../core/jev-palette.js';
import { markRead } from '../core/school-progress.js';

export const SCHOOL_ORIGIN = Object.freeze({ view: 'school', icon: '☉', name: 'Mystery School' });

function presentation(theme) {
    return theme
        ? { colorTheme: theme, textColor: theme, backgroundColor: theme, colors: jevColors(theme, theme, theme) }
        : null;
}

/**
 * `{ text, source, config, origin }` for a record, or null when RISE holds no
 * text for it. A divided work opens at `entryIndex`, else at the division the
 * record pins by label, else at its first.
 */
export async function schoolReading(recordId, entryIndex = null) {
    const record = recordById(recordId);
    const text = record?.work ? getTextById(record.work.id) : null;
    if (!text) return null;

    const look = presentation(houseById(record.house)?.theme);
    const provenance = {
        kind: 'school',
        recordId,
        workId: text.workId || text.id,
        editionId: text.editionId ?? null,
        sourceRevision: text.sourceRevision ?? null,
        entryId: null
    };
    const divisions = typeof text.getDivisions === 'function' ? await text.getDivisions() : null;

    if (!divisions?.divided) {
        const sequences = await (typeof text.getSequences === 'function' ? text.getSequences() : (text.verses || []));
        const whole = (sequences || []).map(verse => verse.content || verse)
            .filter(content => content && content.trim()).join('\n\n');
        if (!whole) return null;
        return {
            text: whole,
            source: text.title,
            origin: SCHOOL_ORIGIN,
            config: { wpm: text.defaultWpm, curve: text.defaultCurve, provenance, ...(look ? { presentation: look } : {}) }
        };
    }

    const entries = divisions.entries;
    const pinned = record.work.entry ? entries.findIndex(entry => entry.label === record.work.entry) : -1;
    const index = Number.isInteger(entryIndex) && entries[entryIndex] ? entryIndex : Math.max(0, pinned);
    const entry = entries[index];
    if (!entry) return null;
    const label = entry.title ? `${entry.label} — ${entry.title}` : entry.label;
    return {
        text: entry.content,
        source: `${text.title} · ${label}`,
        origin: SCHOOL_ORIGIN,
        config: {
            wpm: text.defaultWpm,
            curve: text.defaultCurve,
            verseLines: entry.verse === true,
            ...(text.editionId && text.sourceRevision ? { continuation: {
                kind: 'library-division',
                workId: text.workId || text.id,
                editionId: text.editionId,
                sourceRevision: text.sourceRevision,
                entryId: String(entry.id),
                entryIndex: index,
                entryCount: entries.length,
                noun: contentsNoun(divisions).one
            } } : {}),
            provenance: { ...provenance, entryId: String(entry.id) },
            ...(look ? { presentation: look } : {})
        }
    };
}

/**
 * Marks a finished school reading. A reading carried on to later divisions
 * keeps its first provenance, so the division just read is the continuation's.
 */
export function recordSchoolReading(session) {
    const provenance = session?.provenance;
    if (provenance?.kind !== 'school' || typeof provenance.recordId !== 'string') return;
    const continuation = session.continuation;
    const entryId = continuation?.kind === 'library-division' && continuation.workId === provenance.workId
        && continuation.entryId != null
        ? continuation.entryId
        : provenance.entryId;
    markRead(provenance.recordId, entryId == null ? null : String(entryId));
}
