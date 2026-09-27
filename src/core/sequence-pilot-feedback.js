import { USER_DATA_KEYS } from './user-data-keys.js';

const MAX_RECORDS = 24;
const VALUES = new Set(['yes', 'somewhat', 'no']);
const RETURN_INTENTS = new Set(['yes', 'maybe', 'no']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/u;

function validRecord(record) {
    return record && typeof record.sequenceId === 'string'
        && ID.test(record.sequenceId) && Number.isSafeInteger(record.version) && record.version > 0
        && VALUES.has(record.value)
        && (record.returnIntent === undefined || RETURN_INTENTS.has(record.returnIntent));
}

export function listSequencePilotFeedback() {
    let records;
    try {
        records = JSON.parse(localStorage.getItem(USER_DATA_KEYS.sequencePilotFeedback) || '[]');
    } catch {
        return [];
    }
    if (!Array.isArray(records)) return [];
    return records.filter(validRecord).slice(-MAX_RECORDS).map(record => ({
        sequenceId: record.sequenceId,
        version: record.version,
        value: record.value,
        ...(record.returnIntent === undefined ? {} : { returnIntent: record.returnIntent })
    }));
}

export function saveSequencePilotFeedback({ sequenceId, version, value, returnIntent, consent } = {}) {
    if (consent !== true) throw new Error('Feedback requires explicit consent');
    const record = { sequenceId, version, value, ...(returnIntent === undefined ? {} : { returnIntent }) };
    if (!validRecord(record)) throw new TypeError('Invalid sequence pilot feedback');

    const records = listSequencePilotFeedback().filter(item =>
        item.sequenceId !== sequenceId || item.version !== version);
    records.push(record);
    localStorage.setItem(USER_DATA_KEYS.sequencePilotFeedback, JSON.stringify(records.slice(-MAX_RECORDS)));
    return record;
}

export function deleteSequencePilotFeedback() {
    localStorage.removeItem(USER_DATA_KEYS.sequencePilotFeedback);
}

export function exportSequencePilotFeedback({ consent } = {}) {
    if (consent !== true) throw new Error('Feedback export requires explicit consent');
    return listSequencePilotFeedback();
}
