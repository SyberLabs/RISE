import { PersonalSwells } from './personal-swells.js';
import { READING_LIMITS } from './reading-limits.js';
import { SourceCache } from '../sources/cache.js';
import { WorkshopMedia, blobToDataUrl } from './workshop-media.js';
import { endVisualInterlocutionSession } from './visual-safety.js';

export const USER_DATA_KEYS = Object.freeze({
    settings: 'rise-settings',
    journals: 'rise_recursions_v1',
    blueprints: 'rise_workshop_v1',
    globalImages: 'rise_global_images_v1',
    // OUTLIVES ITS ROOM. The Solarium is deleted and this key is not:
    // a reader who planned their day there still has one saved, and a
    // key dropped from this registry is data that export cannot carry
    // out and erase cannot clear. It is removed when nobody can still
    // be holding one, which is not the same day the room goes.
    solPlan: 'rise_sol_plan_v1',
    orbitalPreferences: 'rise_orbital_prefs_v1',
    orbitalText: 'rise_orbital_text_v1'
});

/**
 * JSON export is assembled in browser memory and base64 adds roughly one
 * third. Keep the binary payload deliberately below the durable media budget;
 * richer lossless media portability belongs in a streamed archive format.
 */
export const USER_DATA_EXPORT_LIMITS = Object.freeze({
    maxInlineBinaryBytes: 32 * 1024 * 1024,
    maxWarningIds: 12
});

function addWarning(data, warning) {
    data.warnings = Array.isArray(data.warnings) ? [...data.warnings, warning] : [warning];
}

function summarizeIds(ids) {
    const shown = ids.slice(0, USER_DATA_EXPORT_LIMITS.maxWarningIds);
    return `${shown.join(', ')}${ids.length > shown.length ? `, and ${ids.length - shown.length} more` : ''}`;
}

function byteLengthOf(blob, fallback = 0) {
    if (blob instanceof Blob) return blob.size;
    const declared = Number(fallback);
    return Number.isFinite(declared) && declared > 0 ? declared : 0;
}

function reserveInlineBytes(budget, byteLength) {
    if (!Number.isFinite(byteLength) || byteLength < 0) return false;
    if (budget.used + byteLength > budget.limit) return false;
    budget.used += byteLength;
    return true;
}

function parseStoredValue(raw) {
    if (raw === null) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

export async function exportUserData(settings = null, options = {}) {
    const requestedLimit = Number(options.maxInlineBinaryBytes);
    const maxInlineBinaryBytes = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(USER_DATA_EXPORT_LIMITS.maxInlineBinaryBytes, Math.floor(requestedLimit))
        : USER_DATA_EXPORT_LIMITS.maxInlineBinaryBytes;
    const data = {
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        stores: {},
        personalSwells: [],
        workshopMedia: []
    };
    const inlineBudget = {
        used: 0,
        limit: maxInlineBinaryBytes
    };
    const withheldForBudget = [];
    const unavailable = [];

    for (const [label, key] of Object.entries(USER_DATA_KEYS)) {
        const value = parseStoredValue(localStorage.getItem(key));
        if (value !== null) data.stores[label] = value;
    }
    if (settings && !data.stores.settings) data.stores.settings = settings;

    try {
        const swells = await PersonalSwells.getAll();
        for (const swell of swells) {
            const byteLength = byteLengthOf(swell.data);
            const entry = {
                id: swell.id,
                name: swell.name,
                timestamp: swell.timestamp,
                type: swell.type,
                byteLength
            };
            if (!(swell.data instanceof Blob)) {
                unavailable.push(swell.id);
                data.personalSwells.push({ ...entry, data: null, withheld: 'unavailable' });
                continue;
            }
            if (!reserveInlineBytes(inlineBudget, byteLength)) {
                withheldForBudget.push(swell.id);
                data.personalSwells.push({ ...entry, data: null, withheld: 'budget' });
                continue;
            }
            try {
                data.personalSwells.push({ ...entry, data: await blobToDataUrl(swell.data) });
            } catch {
                inlineBudget.used -= byteLength;
                unavailable.push(swell.id);
                data.personalSwells.push({ ...entry, data: null, withheld: 'unavailable' });
            }
        }
    } catch (error) {
        addWarning(data, `Personal audio could not be exported: ${error.message || 'storage unavailable'}`);
    }

    try {
        await WorkshopMedia.init();
        const records = await WorkshopMedia.getAllRecords();
        const withheldVideos = [];
        for (const record of records) {
            const declaredByteLength = Number(record.byteLength);
            const payloadByteLength = byteLengthOf(record.data);
            const byteLength = Number.isFinite(declaredByteLength) && declaredByteLength >= 0
                ? declaredByteLength
                : payloadByteLength;
            const entry = {
                id: record.id,
                projectId: record.projectId,
                mimeType: record.mimeType,
                byteLength,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            };
            // VIDEO IS INVENTORIED, NEVER INLINED. A lossless MP4 export needs
            // a streamed archive; base64 inside one JSON string is not one.
            if (record.mimeType === 'video/mp4' || record.data?.type === 'video/mp4') {
                withheldVideos.push(record.id);
                data.workshopMedia.push({ ...entry, data: null, withheld: 'video' });
                continue;
            }
            if (!(record.data instanceof Blob)) {
                unavailable.push(record.id);
                data.workshopMedia.push({ ...entry, data: null, withheld: 'unavailable' });
                continue;
            }
            if (!reserveInlineBytes(inlineBudget, payloadByteLength)) {
                withheldForBudget.push(record.id);
                data.workshopMedia.push({ ...entry, data: null, withheld: 'budget' });
                continue;
            }
            try {
                // Sequential on purpose: at most one FileReader/base64
                // conversion exists in addition to the bounded final payload.
                data.workshopMedia.push({ ...entry, data: await blobToDataUrl(record.data) });
            } catch {
                inlineBudget.used -= payloadByteLength;
                unavailable.push(record.id);
                data.workshopMedia.push({ ...entry, data: null, withheld: 'unavailable' });
            }
        }
        if (withheldVideos.length) {
            addWarning(data,
                `${withheldVideos.length} video file${withheldVideos.length === 1 ? '' : 's'} `
                + `(up to ${Math.round(READING_LIMITS.maxVideoFileBytes / 1024 / 1024)} MB each) `
                + 'are listed but not included: video is too large to carry inside a JSON export. '
                + `Ids: ${summarizeIds(withheldVideos)}`);
        }
    } catch (error) {
        addWarning(data, `Workshop media could not be exported: ${error.message || 'storage unavailable'}`);
    }

    if (withheldForBudget.length) {
        addWarning(data,
            `${withheldForBudget.length} media file${withheldForBudget.length === 1 ? '' : 's'} `
            + 'are listed but not included because the JSON export reached its '
            + `${Math.round(inlineBudget.limit / 1024 / 1024)} MB binary budget. `
            + `Ids: ${summarizeIds(withheldForBudget)}`);
    }
    if (unavailable.length) {
        addWarning(data,
            `${unavailable.length} media file${unavailable.length === 1 ? '' : 's'} `
            + `could not be encoded and are inventory-only. Ids: ${summarizeIds(unavailable)}`);
    }

    data.exportSummary = {
        inlineBinaryBytes: inlineBudget.used,
        maxInlineBinaryBytes: inlineBudget.limit,
        withheldMedia: data.personalSwells.filter(item => item.withheld).length
            + data.workshopMedia.filter(item => item.withheld).length
    };

    return data;
}

export async function clearUserData() {
    for (const key of Object.values(USER_DATA_KEYS)) localStorage.removeItem(key);
    endVisualInterlocutionSession();

    const results = await Promise.allSettled([
        PersonalSwells.clear(),
        SourceCache.clear(),
        WorkshopMedia.clear()
    ]);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        throw new AggregateError(failures.map(result => result.reason), 'Some browser data could not be cleared');
    }
}
