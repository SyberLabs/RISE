/**
 * The reader's Mystery School record, on their device only.
 *
 * `{ v: 1, read: { [recordId]: { entries: [entryId, ...], at, whole? } } }`.
 * `entries` are the division labels finished; `whole: true` marks a work
 * finished entire. Only canon record ids are kept, entries are deduped and
 * bounded, and anything malformed reads as the empty record.
 */

import { SCHOOL_CANON } from '../content/school/canon.js';
import { USER_DATA_KEYS } from './user-data-keys.js';

const VERSION = 1;
const MAX_ENTRIES = 1024;
const MAX_ENTRY_LENGTH = 160;
const MAX_AT_LENGTH = 40;
const RECORDS = new Map(SCHOOL_CANON.map(record => [record.id, record]));

function storage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

function empty() {
    return { v: VERSION, read: {} };
}

function validEntry(entry) {
    return typeof entry === 'string' && entry.length > 0 && entry.length <= MAX_ENTRY_LENGTH;
}

function validRecord(record) {
    return record !== null && typeof record === 'object'
        && Array.isArray(record.entries) && record.entries.every(validEntry)
        && typeof record.at === 'string' && record.at.length <= MAX_AT_LENGTH
        && (record.whole === undefined || record.whole === true);
}

export function readProgress() {
    let parsed;
    try {
        parsed = JSON.parse(storage()?.getItem(USER_DATA_KEYS.schoolProgress) ?? 'null');
    } catch {
        return empty();
    }
    if (parsed?.v !== VERSION || parsed.read === null || typeof parsed.read !== 'object'
        || Array.isArray(parsed.read)) return empty();

    const progress = empty();
    for (const [id, record] of Object.entries(parsed.read)) {
        if (!RECORDS.has(id) || !validRecord(record)) continue;
        progress.read[id] = {
            entries: [...new Set(record.entries)].slice(0, MAX_ENTRIES),
            at: record.at,
            ...(record.whole ? { whole: true } : {})
        };
    }
    return progress;
}

/** Records a finished entry, or the whole work when `entryId` is null. */
export function markRead(recordId, entryId = null) {
    if (!RECORDS.has(recordId) || (entryId !== null && !validEntry(entryId))) return;
    const progress = readProgress();
    const record = progress.read[recordId] ?? { entries: [] };
    progress.read[recordId] = {
        entries: entryId === null || record.entries.includes(entryId) || record.entries.length >= MAX_ENTRIES
            ? record.entries
            : [...record.entries, entryId],
        at: new Date().toISOString(),
        ...(record.whole || entryId === null ? { whole: true } : {})
    };
    try {
        storage()?.setItem(USER_DATA_KEYS.schoolProgress, JSON.stringify(progress));
    } catch {
        // Storage full or refused: the reading still happened; the record waits.
    }
}

/** 'read' needs the whole work, or every one of `entryCount` (> 0) entries. */
export function readState(recordId, entryCount = 0) {
    const record = readProgress().read[recordId];
    if (!record) return 'unread';
    if (record.whole || (entryCount > 0 && record.entries.length >= entryCount)) return 'read';
    return record.entries.length > 0 ? 'begun' : 'unread';
}

function houseRead(houseId, entryCountOf, degree = null) {
    return SCHOOL_CANON.filter(record => record.house === houseId
        && (degree === null || record.degree === degree)
        && readState(record.id, entryCountOf(record.id)) === 'read');
}

export function houseSeals(houseId, entryCountOf = () => 0) {
    return houseRead(houseId, entryCountOf).length;
}

export function holdsArcanum(houseId, entryCountOf = () => 0) {
    return houseRead(houseId, entryCountOf, 3).length > 0;
}

export function clearProgress() {
    try {
        storage()?.removeItem(USER_DATA_KEYS.schoolProgress);
    } catch {
        // An origin without storage holds no record to clear.
    }
}
